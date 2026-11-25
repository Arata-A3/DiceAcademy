// ダイスアカデミーの自動テスト
// 使い方: node tests/run.mjs
// 小さな HTTP サーバーでゲームを配り、ヘッドレス Chrome を DevTools プロトコルで動かして確かめる
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => fs.existsSync(p));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

// ---------- サーバー ----------
const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// ---------- Chrome ----------
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'diceacademy-test-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let port = null;
for (let i = 0; i < 100 && !port; i++) {
    await new Promise(r => setTimeout(r, 100));
    const f = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(f)) port = fs.readFileSync(f, 'utf8').split('\n')[0];
}
if (!port) throw new Error('Chrome が起動しなかった');
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let msgId = 0;
const waiting = new Map();
const errors = [];
ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
});
function send(method, params = {}) {
    const id = ++msgId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise(r => waiting.set(id, r));
}
async function evaluate(expr) {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result.result.value;
}
async function open(width = 1280, height = 800) {
    await send('Page.navigate', { url: 'about:blank' });
    await new Promise(r => setTimeout(r, 200));
    await send('Storage.clearDataForOrigin', { origin: BASE.slice(0, -1), storageTypes: 'local_storage' });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: BASE });
    for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 100));
        try { if (await evaluate("return typeof game !== 'undefined' && !!(game && game.board && ui.dlg);")) return; } catch (e) { /* 読み込み中 */ }
    }
    throw new Error('ゲームが読み込まれなかった');
}
await send('Runtime.enable');
await send('Page.enable');

// ---------- テスト ----------
const results = [];
async function test(name, fn) {
    errors.length = 0;
    try {
        await fn();
        if (errors.length) throw new Error(`ブラウザのエラー: ${errors.join(' / ')}`);
        results.push([true, name]);
    } catch (e) { results.push([false, name, e.message]); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ゲームの中で使う小道具（ダイアログの主ボタン・戦いを最後まで進める・行事の日へ進む）
const HELPERS = `
    const clickMain = () => (ui.dlgButtons.querySelector('button.primary') || ui.dlgButtons.querySelector('button')).click();
    const finishBattles = () => { let g = 0; while (game.pending && game.pending.kind === 'battle' && g++ < 12) { if ($('fight-go')) $('fight-go').click(); else clickMain(); if (battle) { skipBattle(); document.querySelector('#b-result button').click(); } } };
    const goTo = i => { closeDialog(); game.pending = null; game.day = i - 1; game.hand = [1, 1, 1]; playHand(0); };
    const goEvent = key => { const f = FIXED_EVENTS.find(x => x.key === key); goTo(dayIndexOf(f.month, f.day)); };
    const strong = (s, years) => { STATS.forEach(st => { s.stats[st.key] = st.base + st.growth * years; }); };
`;

await test('版の表示と読み込みの ?v= が APP_VERSION とそろっている', async () => {
    await open();
    const v = await evaluate('return APP_VERSION;');
    const label = await evaluate("return document.getElementById('version').textContent;");
    assert(label === `v${v}`, `表示 ${label} / 版 ${v}`);
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const vs = [...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1]);
    assert(vs.length >= 5 && vs.every(x => x === v), `?v= が ${[...new Set(vs)].join(',')}`);
    const hist = await evaluate('return VERSION_INFO.history[0].version;');
    assert(hist === v, '変更の記録の先頭が今の版でない');
});

await test('画面とコードに絵文字がない', async () => {
    await open();
    const files = ['index.html', 'js/app.js', 'js/data.js', 'js/battle.js', 'js/version.js', 'css/style.css'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const text = await evaluate('return document.body.innerText;');
    const found = [...new Set([text, ...files].join('').match(/\p{Extended_Pictographic}/gu) || [])];
    assert(!found.length, `見つかった: ${found.join(' ')}`);
});

await test('新しいゲームは入学式の 1 年生だけで始まり、行事が暦に並ぶ', async () => {
    await open();
    const r = await evaluate(`return { title: ui.dlgTitle.textContent, grades: game.students.map(s => s.grade), fixed: FIXED_EVENTS.every(f => { const d = game.board.days[dayIndexOf(f.month, f.day)]; return d.type === 'fixed' && d.key === f.key; }), branchOnFixed: game.board.branches.some(b => { for (let i = b.start; i < b.start + b.len; i++) if (game.board.days[i].type === 'fixed') return true; return false; }) };`);
    assert(r.title === '入学式', `最初のダイアログ ${r.title}`);
    assert(r.grades.length >= 2 && r.grades.every(g => g === 1), `学年 ${r.grades}`);
    assert(r.fixed, '行事の日が暦にない');
    assert(!r.branchOnFixed, '分かれ道が行事の日に重なっている');
});

await test('練習で指導でき、指導の人数は在校生 3 人に 1 人', async () => {
    await open();
    const r = await evaluate(`${HELPERS} clickMain(); closeDialog(); game.pending = null;
        const before = game.students[0].stats.atk;
        game.pending = { kind: 'practice', sub: 'sword', mul: 1 }; render();
        ui.dlgBody.querySelector('.pick-stu').click(); $('practice-go').click();
        const u = usedNameSet(); while (game.students.length < 7) game.students.push(makeStudent(1, u));
        return { grew: game.students[0].stats.atk >= before, max2: coachMax(), msg: game.message };`);
    assert(r.grew, '能力が伸びなかった');
    assert(r.max2 === 3, `7 人のときの指導の人数 ${r.max2}`);
});

await test('大会・王国武闘会・卒業試験が最後まで進む', async () => {
    await open();
    const r = await evaluate(`${HELPERS} clickMain(); closeDialog(); game.pending = null;
        const u = usedNameSet(); while (game.students.length < 5) game.students.push(makeStudent(1, u));
        game.students.forEach((s, i) => { s.grade = i < 3 ? 3 : 2; strong(s, 7); });
        const out = {};
        for (const key of ['team1', 'sword', 'magic', 'team']) { goEvent(key); finishBattles(); out[key] = game.records.some(r => r.key === key); }
        game.records.push({ year: game.year, key: 'team', name: '学園対抗戦・冬', result: '準優勝', wins: 3 });
        goEvent('royal'); out.royalBattle = !!(game.pending && game.pending.kind === 'battle'); finishBattles(); out.royal = game.records.some(r => r.key === 'royal');
        goEvent('exam'); out.examFoes = game.pending.enemies.length; finishBattles(); out.exam = game.records.some(r => r.key === 'exam');
        out.renown = game.students.filter(s => s.grade === 3).every(s => s.renown > 0);
        return out;`);
    for (const k of ['team1', 'sword', 'magic', 'team', 'royalBattle', 'royal', 'exam', 'renown']) assert(r[k], `${k} が進まなかった ${JSON.stringify(r)}`);
    assert(r.examFoes === 3, `教官の人数 ${r.examFoes}`);
});

await test('王国武闘会は学園対抗戦で準優勝以上でないと出られない', async () => {
    await open();
    const r = await evaluate(`${HELPERS} clickMain(); goEvent('royal'); return { kind: game.pending && game.pending.kind, text: ui.dlgBody.textContent };`);
    assert(r.kind === 'notice' && r.text.includes('出場できなかった'), JSON.stringify(r));
});

await test('卒業式で職業を選び、英傑録・勇者・初めての勇者の画面が出る', async () => {
    await open();
    const r = await evaluate(`${HELPERS} clickMain(); closeDialog(); game.pending = null;
        const [a, b] = game.students; a.grade = 3; b.grade = 3; a.hope = 'warrior';
        strong(a, 3); a.stats.atk = STAT_BY_KEY.atk.base + STAT_BY_KEY.atk.growth * 6; a.stats.hp = STAT_BY_KEY.hp.base + STAT_BY_KEY.hp.growth * 6; a.renown = 250;
        b.renown = 0;
        goEvent('graduation');
        const btns = [...ui.dlgButtons.querySelectorAll('button')].map(x => x.textContent);
        let g = 0; while (game.pending && game.pending.kind === 'graduation' && g++ < 5) clickMain();
        clickMain();
        const heroTitle = ui.dlgTitle.textContent;
        clickMain();
        return { btns, heroTitle, alumni: game.alumni.map(x => x.job + ':' + x.tier), firstHero: !!game.firstHero, fame: game.fame };`);
    assert(r.btns.some(t => t.includes('勇者')), `卒業のボタン ${r.btns}`);
    assert(r.heroTitle === '初めての勇者', `画面 ${r.heroTitle}`);
    assert(r.alumni[0] === 'warrior:hero' && r.alumni[1] === 'villager:null', `卒業生 ${r.alumni}`);
    assert(r.firstHero, '初めての勇者が記録されていない');
});

await test('修了式で設備を建て、次の年に進級して暦が作り直される', async () => {
    await open();
    const r = await evaluate(`${HELPERS} clickMain(); closeDialog(); game.pending = null; game.gold = 1000;
        const board0 = JSON.stringify(game.board.days.slice(0, 40));
        goTo(DAYS_IN_YEAR - 1);
        [...ui.dlgButtons.querySelectorAll('button')].find(x => x.textContent.includes('設備')).click();
        ui.dlgBody.querySelector('.fac-build[data-key="dorm"]').click();
        clickMain(); openPending();
        [...ui.dlgButtons.querySelectorAll('button')].find(x => x.textContent.includes('年目へ')).click();
        return { year: game.year, day: game.day, dorm: facility('dorm'), gold: game.gold, grades: game.students.map(s => s.grade).sort().join(','), title: ui.dlgTitle.textContent, newBoard: JSON.stringify(game.board.days.slice(0, 40)) !== board0, fresh: game.students.filter(s => s.grade === 1).length };`);
    assert(r.year === 2 && r.day === 0, `年 ${r.year} 日 ${r.day}`);
    assert(r.dorm === 1 && r.gold === 800, `設備 ${r.dorm} お金 ${r.gold}`);
    assert(r.grades.startsWith('1') && r.grades.includes('2'), `学年 ${r.grades}`);
    assert(r.fresh === 3, `寮 1 段階で新入生 3 人のはず: ${r.fresh}`);
    assert(r.title === '入学式' && r.newBoard, '入学式と新しい暦にならなかった');
});

await test('討伐の依頼を受けて助っ人と戦い、期限切れでは依頼が消える', async () => {
    await open();
    const r = await evaluate(`${HELPERS} clickMain(); closeDialog(); game.pending = null;
        const st = {}; STATS.forEach(s => st[s.key] = s.base + s.growth * 5);
        game.alumni.push({ id: 900, uid: 'h1', name: '先輩', year: 1, job: 'warrior', hope: 'warrior', tier: 'elite', renown: 100, power: 250, rank: 2, titles: 0, wins: 0, helped: 0, stats: st, gradStats: { ...st }, skills: [] });
        game.students.forEach(s => strong(s, 3));
        const keep = Math.random;
        game.day = 10; game.board.days[10] = { type: 'event' }; Math.random = () => 0.01; resolveSquare(1); Math.random = keep;
        const offered = game.pending && game.pending.kind === 'questOffer';
        [...ui.dlgButtons.querySelectorAll('button')].find(x => x.textContent.includes('引き受ける')).click();
        const squares = game.board.days.filter(d => d.type === 'quest').length;
        goTo(game.quest.days[0]);
        game.quest.helpers = [900]; closeDialog(); openPending();
        ui.dlgBody.querySelector('.helper').click(); $('fight-go').click();
        const allies = battle.allies.length; skipBattle(); document.querySelector('#b-result button').click();
        const done = { quest: game.quest, left: game.board.days.filter(d => d.type === 'quest').length };
        clickMain();
        game.questCount = 0; game.day = 100; game.board.days[100] = { type: 'event' }; Math.random = () => 0.01; resolveSquare(1); Math.random = keep;
        [...ui.dlgButtons.querySelectorAll('button')].find(x => x.textContent.includes('引き受ける')).click();
        const fame0 = game.fame; goTo(game.quest.deadline + 1);
        return { offered, squares, allies, done, expired: game.quest === null, fameDown: fame0 - game.fame, left2: game.board.days.filter(d => d.type === 'quest').length };`);
    assert(r.offered && r.squares >= 2, `依頼 ${JSON.stringify(r)}`);
    assert(r.allies === 3, `味方の数（1 年生 2 人＋助っ人）${r.allies}`);
    assert(r.done.quest === null && r.done.left === 0, '討伐のあとにマスが残った');
    assert(r.expired && r.fameDown === 3 && r.left2 === 0, `期限切れ ${JSON.stringify(r)}`);
});

await test('英傑録を書き出して読み込める（同じ人は重ならない）', async () => {
    await open();
    const r = await evaluate(`${HELPERS} clickMain(); closeDialog(); game.pending = null;
        const st = {}; STATS.forEach(s => st[s.key] = s.base + s.growth * 4);
        game.alumni.push({ id: 900, uid: 'x1', name: 'アレン', year: 1, job: 'knight', hope: 'knight', tier: 'hero', renown: 200, power: 260, rank: 2, titles: 3, wins: 9, helped: 0, stats: st, gradStats: { ...st }, skills: ['bash'] });
        let cap = null; const orig = downloadJSON; downloadJSON = obj => { cap = obj; }; exportRoster(); downloadJSON = orig;
        importRoster(JSON.stringify(cap)); const same = game.alumni.length;
        const other = { ...cap, members: cap.members.map(m => ({ ...m, uid: 'o-' + m.uid, name: 'ミラ', school: '北の学園', yearsSince: 5 })) };
        importRoster(JSON.stringify(other)); importRoster('{"format":"x"}'); importRoster('壊れた');
        const m = game.alumni.find(a => a.name === 'ミラ');
        return { format: cap.format, count: cap.members.length, same, total: game.alumni.length, imported: m && m.imported, since: m && game.year - m.year, firstHero: game.firstHero };`);
    assert(r.format === 'diceacademy-roster' && r.count === 1, JSON.stringify(r));
    assert(r.same === 1 && r.total === 2, `重なり ${JSON.stringify(r)}`);
    assert(r.imported && r.since === 5, `読み込んだ人 ${JSON.stringify(r)}`);
    assert(!r.firstHero, '読み込みで初めての勇者になった');
});

await test('古いセーブ（v0.2 の形）を読み込める', async () => {
    await open();
    const r = await evaluate(`${HELPERS} clickMain(); closeDialog(); game.pending = null;
        const old = JSON.parse(JSON.stringify(game));
        old.saveVersion = 2; delete old.alumni; delete old.records; delete old.quest; delete old.facilities;
        old.students.forEach(s => { s.stats.pen = 5; ['ppen', 'mpen', 'plet', 'mlet', 'critdmg'].forEach(k => delete s.stats[k]); delete s.potential; delete s.renown; });
        FIXED_EVENTS.filter(f => !['entrance', 'rookie', 'sword', 'team', 'yearend'].includes(f.key)).forEach(f => { old.board.days[dayIndexOf(f.month, f.day)] = { type: 'practice', sub: 'run' }; });
        localStorage.setItem(SAVE_KEY, JSON.stringify(old));
        const ok = loadGame();
        return { ok, ver: game.saveVersion, stats: game.students.every(s => typeof s.stats.ppen === 'number' && typeof s.stats.critdmg === 'number' && !('pen' in s.stats)), pot: game.students.every(s => s.potential), events: FIXED_EVENTS.every(f => { const d = game.board.days[dayIndexOf(f.month, f.day)]; return d.type === 'fixed' && d.key === f.key; }), alumni: Array.isArray(game.alumni) };`);
    assert(r.ok && r.ver === await evaluate('return SAVE_VERSION;'), JSON.stringify(r));
    assert(r.stats && r.pot && r.events && r.alumni, JSON.stringify(r));
});

await test('壊れたセーブでも起動し、別のキーに退避する', async () => {
    await open();
    await evaluate(`localStorage.setItem(SAVE_KEY, '{壊れた'); resetting = true;`);
    await send('Page.reload');
    await new Promise(r => setTimeout(r, 1500));
    const r = await evaluate(`return { ok: !!game.board, saved: localStorage.getItem(SAVE_KEY + '_corrupted') === '{壊れた' };`);
    assert(r.ok && r.saved, JSON.stringify(r));
});

await test('スマホの幅で横にはみ出さない', async () => {
    for (const [w, h] of [[360, 640], [390, 844], [844, 390]]) {
        await open(w, h);
        const r = await evaluate(`return { sw: document.documentElement.scrollWidth, w: innerWidth };`);
        assert(r.sw <= r.w + 1, `${w}x${h}: 横幅 ${r.sw} > ${r.w}`);
    }
});

await test('サービスワーカーが動き、マニフェストが読める', async () => {
    await open();
    const r = await evaluate(`const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 5000))]);
        const man = await (await fetch('manifest.webmanifest')).json();
        return { sw: !!reg, icons: man.icons.length, maskable: man.icons.some(i => i.purpose === 'maskable'), display: man.display };`);
    assert(r.sw, 'サービスワーカーが動かなかった');
    assert(r.icons >= 3 && r.maskable && r.display === 'standalone', JSON.stringify(r));
});

// ---------- 結果 ----------
ws.close(); chrome.kill(); server.close();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Chrome が掴んでいるときは残る */ }
let failed = 0;
for (const [ok, name, msg] of results) { console.log(`${ok ? 'OK  ' : 'NG  '} ${name}${ok ? '' : `\n      ${msg}`}`); if (!ok) failed++; }
console.log(`\n${results.length - failed} / ${results.length} 件が通った`);
process.exit(failed ? 1 : 0);
