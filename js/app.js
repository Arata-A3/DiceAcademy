// ダイスアカデミー 本体
'use strict';

const SAVE_KEY = 'diceacademy_save';
const SAVE_VERSION = 1;
const BASE_YEAR = 2026;          // 暦の曜日を決めるための年（画面には出さない）
const DAYS_IN_YEAR = 365;
const STRIP_DAYS = 21;           // 暦の帯に出す日数
const LOOKAHEAD = 6;             // 予定変更で変えられる先の日数

let game = null;
let resetting = false;
let selected = null;             // { kind: 'hand'|'special', index }
const ui = {};

// ---------- 乱数・小物 ----------
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function weighted(weights) {
    const entries = Object.entries(weights);
    let r = Math.random() * entries.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of entries) { if ((r -= w) < 0) return k; }
    return entries[0][0];
}
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- 日付 ----------
function dateOf(i) { return new Date(BASE_YEAR, 3, 1 + i); }
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
function dateLabel(i) { const d = dateOf(i); return `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`; }
function dayIndexOf(month, day) {
    const y = month >= 4 ? BASE_YEAR : BASE_YEAR + 1;
    return Math.round((new Date(y, month - 1, day) - new Date(BASE_YEAR, 3, 1)) / 86400000);
}

// ---------- アイコン（SVG） ----------
const ICON_PATHS = {
    sword: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.5"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    chest: '<rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 10a9 5 0 0 1 18 0"/><path d="M12 13v3"/>',
    bandage: '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M10.5 10.5h.01M13.5 13.5h.01M13.5 10.5h.01M10.5 13.5h.01"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>',
    fork: '<path d="M6 3v6a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6V3"/><path d="M12 15v6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    piece: '<circle cx="12" cy="7" r="4"/><path d="M6 21l2-9h8l2 9z"/>',
};
function icon(name, cls = '') {
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

// ---------- 生徒 ----------
function makeStudent(grade, usedNames) {
    const job = pick(JOBS);
    const name = pick(NAMES.filter(n => !usedNames.has(n))) || pick(NAMES);
    usedNames.add(name);
    const stats = {};
    STATS.forEach(st => {
        if (st.pct) stats[st.key] = st.key === 'crit' ? rand(3, 8) : rand(0, 3);
        else stats[st.key] = rand(20, 45);
    });
    job.favor.forEach(k => { const st = STAT_BY_KEY[k]; stats[k] = st.pct ? stats[k] + rand(2, 5) : stats[k] + rand(10, 20); });
    // 学年が上の生徒は、すでにある程度育っている
    for (let g = 1; g < grade; g++) STATS.forEach(st => { stats[st.key] += st.pct ? rand(1, 3) : rand(25, 45); });
    STATS.forEach(st => { stats[st.key] = clamp(stats[st.key], 0, st.max); });
    const talent = shuffle([...job.favor, ...STATS.map(s => s.key)]).filter((k, i, a) => a.indexOf(k) === i).slice(0, 2);
    return { id: game.nextId++, name, grade, hope: job.key, talent, stats, fatigue: rand(0, 15), mood: rand(50, 70), injuredUntil: -1, wins: 0 };
}
function usedNameSet() { return new Set(game.students.map(s => s.name)); }
function isInjured(s) { return s.injuredUntil >= game.day; }
function randomStat() { return pick(STATS).key; }
function addStat(s, key, amount) {
    const st = STAT_BY_KEY[key];
    const v = s.stats[key] + amount;
    s.stats[key] = st.pct ? clamp(Math.round(v * 10) / 10, 0, st.max) : clamp(Math.round(v), 0, st.max);
}
function fmtStat(key, v) { return STAT_BY_KEY[key].pct ? `${v.toFixed(1)}%` : String(v); }
function normalizeStudent(s) {
    s.fatigue = clamp(Math.round(s.fatigue), 0, 100);
    s.mood = clamp(Math.round(s.mood), 0, 100);
}
function power(s, weights = {}) {
    return STATS.reduce((a, st) => a + (st.pct ? s.stats[st.key] * 8 : s.stats[st.key]) * (weights[st.key] || 1), 0);
}

// ---------- 盤 ----------
function makeSquare(type) {
    const sq = { type };
    if (type === 'practice') sq.sub = pick(PRACTICES).key;
    return sq;
}
function generateBoard() {
    const days = [];
    const fixedAt = {};
    FIXED_EVENTS.forEach(f => { fixedAt[dayIndexOf(f.month, f.day)] = f.key; });
    for (let i = 0; i < DAYS_IN_YEAR; i++) {
        days.push(fixedAt[i] ? { type: 'fixed', key: fixedAt[i] } : makeSquare(weighted(SQUARE_WEIGHTS)));
    }
    // 分かれ道: 月に 1〜2 回。長さ 4 日。行事の日と重ならないように置く
    const branches = [];
    const len = 4;
    for (let m = 0; m < 12; m++) {
        const first = days.findIndex((_, i) => dateOf(i).getMonth() === (3 + m) % 12);
        let last = first; while (last + 1 < DAYS_IN_YEAR && dateOf(last + 1).getMonth() === dateOf(first).getMonth()) last++;
        const count = rand(1, 2);
        for (let c = 0; c < count; c++) {
            for (let tries = 0; tries < 20; tries++) {
                const start = rand(first + 2, last - len);
                const span = [start - 1, start + len];
                const clash = branches.some(b => !(span[1] < b.start - 1 || span[0] > b.start + b.len))
                    || days.slice(span[0], span[1] + 1).some(d => d && d.type === 'fixed');
                if (clash) continue;
                const keys = shuffle(Object.keys(ROUTES)).slice(0, 2);
                branches.push({
                    start, len, chosen: 0,
                    routes: keys.map(k => ({ key: k, squares: Array.from({ length: len }, () => makeSquare(weighted(ROUTES[k].weights))) })),
                });
                break;
            }
        }
    }
    branches.sort((a, b) => a.start - b.start);
    return { days, branches };
}
function branchAt(i) { return game.board.branches.find(b => i >= b.start && i < b.start + b.len) || null; }
function squareAt(i) {
    const b = branchAt(i);
    return b ? b.routes[b.chosen].squares[i - b.start] : game.board.days[i];
}
function setSquareAt(i, sq) {
    const b = branchAt(i);
    if (b) b.routes[b.chosen].squares[i - b.start] = sq; else game.board.days[i] = sq;
}
function fixedInfo(key) { return FIXED_EVENTS.find(f => f.key === key); }
function squareName(sq) {
    if (sq.type === 'fixed') return fixedInfo(sq.key).name;
    if (sq.type === 'practice') return PRACTICE_BY_KEY[sq.sub].name;
    return SQUARES[sq.type].name;
}
function nextFixed(from) {
    for (let i = from + 1; i < DAYS_IN_YEAR; i++) { const sq = game.board.days[i]; if (sq.type === 'fixed') return { i, info: fixedInfo(sq.key) }; }
    return null;
}

// ---------- 手札 ----------
function handSize() { return game.fame >= 250 ? 5 : game.fame >= 100 ? 4 : 3; }
function refillHand() { while (game.hand.length < handSize()) game.hand.push(rand(1, 6)); }
function addSpecial(type) {
    if (game.specials.length >= MAX_SPECIAL) return false;
    game.specials.push({ type, n: (type === 'stride' || type === 'careful') ? rand(1, 6) : null });
    return true;
}
function specialLabel(c) { return SPECIAL_CARDS[c.type].name; }

// ---------- 新しいゲーム ----------
function makeDefaultGame() {
    return {
        saveVersion: SAVE_VERSION, appearance: 'auto',
        year: 1, day: 0, fame: 50, gold: 100,
        board: null, hand: [], specials: [], students: [], nextId: 1,
        message: '', pending: null, lastVersion: APP_VERSION,
    };
}
function newGame() {
    const appearance = game ? game.appearance : 'auto';
    game = makeDefaultGame();
    game.appearance = appearance;
    game.board = generateBoard();
    const used = new Set();
    for (let i = 0; i < 2; i++) game.students.push(makeStudent(3, used));
    for (let i = 0; i < 3; i++) game.students.push(makeStudent(2, used));
    refillHand();
    addSpecial('free');
    game.message = 'ダイスアカデミーへようこそ。今日は入学式です。';
    resolveSquare(1);
}

// ---------- 進む ----------
function destinationFor(sel) {
    if (!sel) return null;
    if (sel.kind === 'hand') return clampMove(game.hand[sel.index]);
    const c = game.specials[sel.index];
    if (c.type === 'stride') return clampMove(c.n * 2);
    if (c.type === 'careful') return clampMove(c.n);
    return null;
}
// 行事の日は通り過ぎられない
function clampMove(n) {
    let target = Math.min(game.day + n, DAYS_IN_YEAR - 1);
    for (let i = game.day + 1; i <= target; i++) { if (game.board.days[i].type === 'fixed') { target = i; break; } }
    return target;
}
function moveTo(target, mul) {
    const passed = target - game.day;
    // 通り過ぎた日のぶん、分かれ道は選んだ道で決まり、疲れが少し取れる
    // やる気は日がたつと 55 に向かって戻る
    game.students.forEach(s => { s.fatigue -= passed; s.mood += Math.sign(55 - s.mood) * Math.min(Math.abs(55 - s.mood), passed); normalizeStudent(s); });
    game.day = target;
    selected = null;
    resolveSquare(mul);
}
function playHand(index) {
    const n = game.hand[index];
    game.hand.splice(index, 1);
    refillHand();
    moveTo(clampMove(n), 1);
}
function playSpecial(index) {
    const c = game.specials[index];
    if (c.type === 'free') {
        showDialog({
            title: '好きな目', body: '<p>何日進みますか？</p>',
            buttons: [1, 2, 3, 4, 5, 6].map(n => ({ label: `${n}（${dateLabel(clampMove(n))}）`, onClick: () => { game.specials.splice(index, 1); moveTo(clampMove(n), 1); } }))
                .concat([{ label: 'やめる', ghost: true }]),
        });
        return;
    }
    if (c.type === 'replan') { openReplan(index); return; }
    game.specials.splice(index, 1);
    if (c.type === 'stride') moveTo(clampMove(c.n * 2), 1);
    else if (c.type === 'careful') moveTo(clampMove(c.n), 2);
}
function openReplan(index) {
    const opts = [];
    for (let i = game.day + 1; i <= Math.min(game.day + LOOKAHEAD, DAYS_IN_YEAR - 1); i++) {
        if (squareAt(i).type !== 'fixed') opts.push(i);
    }
    if (!opts.length) { toast('変えられるマスがありません'); return; }
    showDialog({
        title: '予定変更', body: '<p>どの日の予定を変えますか？</p>',
        buttons: opts.map(i => ({ label: `${dateLabel(i)}：${squareName(squareAt(i))}`, onClick: () => replanChoose(index, i) })).concat([{ label: 'やめる', ghost: true }]),
    });
}
function replanChoose(index, dayI) {
    const types = [...PRACTICES.map(p => ({ label: `練習：${p.name}`, sq: { type: 'practice', sub: p.key } })),
    { label: '休み', sq: { type: 'rest' } }, { label: '買い物', sq: { type: 'shop' } }, { label: '出来事', sq: { type: 'event' } }];
    showDialog({
        title: `${dateLabel(dayI)} を何にしますか？`, body: '',
        buttons: types.map(t => ({
            label: t.label, onClick: () => {
                game.specials.splice(index, 1);
                setSquareAt(dayI, t.sq);
                game.message = `${dateLabel(dayI)} の予定を「${squareName(t.sq)}」に変えた。`;
                saveGame(); render();
            }
        })).concat([{ label: 'やめる', ghost: true }]),
    });
}

// ---------- マスの効果 ----------
function resolveSquare(mul) {
    const sq = squareAt(game.day);
    const careful = mul > 1 ? '（じっくり: 効果 2 倍）' : '';
    switch (sq.type) {
        case 'practice': game.pending = { kind: 'practice', sub: sq.sub, mul }; break;
        case 'rest':
            game.students.forEach(s => { s.fatigue -= 25 * mul; s.mood += 5 * mul; normalizeStudent(s); });
            game.message = `休みの日。全員の疲れが取れた。${careful}`;
            break;
        case 'event': {
            const healthy = game.students.filter(s => !isInjured(s));
            const ev = rand(0, EVENTS.length - 1);
            const st = pick(healthy.length ? healthy : game.students);
            game.pending = { kind: 'event', ev, studentId: st ? st.id : null, mul };
            break;
        }
        case 'shop': game.pending = { kind: 'shop' }; break;
        case 'treasure': {
            if (Math.random() < 0.45 && game.specials.length < MAX_SPECIAL) {
                const t = pick(Object.keys(SPECIAL_CARDS));
                addSpecial(t);
                game.message = `宝を見つけた。特別な札「${SPECIAL_CARDS[t].name}」を手に入れた。`;
            } else {
                const g = rand(40, 100) * mul;
                game.gold += g;
                game.message = `宝を見つけた。${g} ゴールドを手に入れた。${careful}`;
            }
            break;
        }
        case 'injury': {
            const cands = game.students.filter(s => !isInjured(s)).sort((a, b) => b.fatigue - a.fatigue);
            if (!cands.length) { game.message = '何事もなかった。'; break; }
            const s = Math.random() < 0.7 ? cands[0] : pick(cands);
            const days = rand(4, 8) * mul;
            s.injuredUntil = game.day + days;
            game.message = `${s.name} が練習中にけがをした。${days} 日のあいだ練習できない。${careful}`;
            break;
        }
        case 'fixed': resolveFixed(sq.key); break;
    }
    saveGame();
    render();
}

function practiceGain(s, sub, coached, mul) {
    const p = PRACTICE_BY_KEY[sub];
    const res = {};
    const moodMul = 0.6 + s.mood / 100 * 0.8;
    const fatigueMul = s.fatigue > 80 ? 0.6 : 1;
    Object.entries(p.gains).forEach(([k, base]) => {
        const talentMul = s.talent.includes(k) ? 1.5 : 1;
        const v = base * talentMul * moodMul * fatigueMul * (coached ? 1 : 0.25) * mul * (0.8 + Math.random() * 0.4);
        const before = s.stats[k];
        addStat(s, k, v);
        const diff = Math.round((s.stats[k] - before) * 10) / 10;
        if (diff > 0) res[k] = diff;
    });
    return res;
}
function doPractice(ids) {
    const { sub, mul } = game.pending;
    const lines = [];
    let injuredMsg = '';
    game.students.forEach(s => {
        if (isInjured(s)) return;
        const coached = ids.includes(s.id);
        const res = practiceGain(s, sub, coached, mul);
        s.fatigue += coached ? 15 * mul : 3;
        s.mood += coached ? 3 : 0;
        normalizeStudent(s);
        if (coached && s.fatigue > 70 && Math.random() < (s.fatigue - 70) / 100) {
            s.injuredUntil = game.day + rand(3, 6);
            injuredMsg += ` ${s.name} は無理がたたってけがをした。`;
        }
        if (coached) lines.push(`${s.name}: ${Object.entries(res).map(([k, v]) => `${STAT_BY_KEY[k].name} +${STAT_BY_KEY[k].pct ? v.toFixed(1) : v}`).join('、') || '伸びなかった'}`);
    });
    game.pending = null;
    game.message = `${PRACTICE_BY_KEY[sub].name}。${lines.join(' / ')}${injuredMsg}`;
    saveGame(); render();
}

function resolveFixed(key) {
    const info = fixedInfo(key);
    if (key === 'entrance') {
        const n = game.fame >= 250 ? 4 : game.fame >= 100 ? 3 : 2;
        const used = usedNameSet();
        const added = [];
        for (let i = 0; i < n; i++) { const s = makeStudent(1, used); game.students.push(s); added.push(s); }
        game.pending = { kind: 'notice', title: '入学式', html: `<p>${n} 人の新入生が入ってきた。</p><ul class="plain">${added.map(s => `<li><b>${esc(s.name)}</b>　希望: ${JOB_BY_KEY[s.hope].name}　得意: ${s.talent.map(k => STAT_BY_KEY[k].name).join('・')}</li>`).join('')}</ul>` };
        game.message = `入学式。${n} 人の新入生が入ってきた。`;
    } else if (info.tournament) {
        runTournament(info);
    } else if (key === 'yearend') {
        game.pending = { kind: 'yearend' };
        game.message = '修了式。1 年が終わった。';
    }
}

// 大会（仮の判定）: 能力の合計に揺らぎを足して比べる。戦いは次の版から
function runTournament(info) {
    let team;
    let weights = {};
    if (info.key === 'rookie') team = game.students.filter(s => s.grade === 1 && !isInjured(s)).sort((a, b) => power(b) - power(a)).slice(0, 1);
    else if (info.key === 'sword') { weights = { atk: 2, def: 1.5, aspd: 1.5, mag: 0.3 }; team = game.students.filter(s => !isInjured(s)).sort((a, b) => power(b, weights) - power(a, weights)).slice(0, 1); }
    else team = game.students.filter(s => !isInjured(s)).sort((a, b) => power(b) - power(a)).slice(0, 4);
    if (!team.length) {
        game.pending = { kind: 'notice', title: info.name, html: '<p>出られる生徒がいなかった。</p>' };
        game.message = `${info.name}。出られる生徒がいなかった。`;
        return;
    }
    const mine = team.reduce((a, s) => a + power(s, weights), 0) / team.length;
    const base = 520 + game.day * 1.1 + (info.key === 'rookie' ? -120 : 0);
    const roundNames = ['1 回戦', '準々決勝', '準決勝', '決勝'];
    const rows = [];
    let wins = 0;
    for (let r = 0; r < roundNames.length; r++) {
        const opp = base * (1 + r * 0.08) * (0.85 + Math.random() * 0.3);
        const me = mine * (0.85 + Math.random() * 0.3);
        const win = me > opp;
        rows.push(`<li>${roundNames[r]}: ${win ? '勝ち' : '負け'}</li>`);
        if (!win) break;
        wins++;
    }
    const result = wins === 4 ? '優勝' : wins === 3 ? '準優勝' : wins === 2 ? 'ベスト 4' : wins === 1 ? 'ベスト 8' : '1 回戦負け';
    const fame = wins * 6 + (wins === 4 ? 20 : 0);
    const gold = wins * 20 + (wins === 4 ? 100 : 0);
    game.fame += fame; game.gold += gold;
    team.forEach(s => { s.wins += wins; s.fatigue += 20; s.mood += wins >= 2 ? 10 : -5; normalizeStudent(s); });
    game.pending = {
        kind: 'notice', title: `${info.name}（${info.desc}）`,
        html: `<p>出場: ${team.map(s => esc(s.name)).join('、')}</p><ul class="plain">${rows.join('')}</ul><p class="big">${result}</p><p>知名度 +${fame}　${gold} ゴールド</p><p class="muted">今は能力の合計で結果を決める仮の判定です。戦いは次の版から見られます。</p>`,
    };
    game.message = `${info.name}: ${result}。`;
}

// ---------- 画面 ----------
function $(id) { return document.getElementById(id); }
function render() {
    if (!game) return;
    applyAppearance();
    const nf = nextFixed(game.day);
    ui.date.textContent = `${game.year}年目 ${dateLabel(game.day)}`;
    ui.fame.textContent = game.fame;
    ui.gold.textContent = game.gold;
    ui.next.innerHTML = nf ? `${esc(nf.info.name)}まで ${nf.i - game.day}日` : '';
    renderStrip();
    renderBranch();
    renderStudents();
    renderHand();
    ui.message.textContent = game.message;
    openPending();
}
function squareHTML(i, opts = {}) {
    const sq = squareAt(i);
    const meta = SQUARES[sq.type];
    const d = dateOf(i);
    const cls = ['sq', `sq-${sq.type}`];
    if (i === game.day) cls.push('today');
    if (i < game.day) cls.push('past');
    if (opts.dest === i) cls.push('dest');
    if (branchAt(i)) cls.push('on-branch');
    const label = sq.type === 'practice' ? PRACTICE_BY_KEY[sq.sub].name : squareName(sq);
    return `<div class="${cls.join(' ')}" data-day="${i}" title="${esc(dateLabel(i))} ${esc(label)}">
        ${i === game.day ? `<span class="piece">${icon('piece')}</span>` : ''}
        <span class="sq-date ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}">${d.getMonth() + 1}/${d.getDate()}</span>
        ${icon(meta.icon)}<span class="sq-name">${esc(label)}</span></div>`;
}
function renderStrip() {
    const dest = destinationFor(selected);
    let html = '';
    for (let i = game.day; i < Math.min(game.day + STRIP_DAYS, DAYS_IN_YEAR); i++) {
        if (i > game.day && dateOf(i).getDate() === 1) html += `<div class="month-mark">${dateOf(i).getMonth() + 1}月</div>`;
        html += squareHTML(i, { dest });
    }
    ui.strip.innerHTML = html;
    ui.strip.scrollLeft = 0;
}
function renderBranch() {
    const b = game.board.branches.find(b => b.start > game.day && b.start <= game.day + 12);
    if (!b) { ui.branch.hidden = true; return; }
    ui.branch.hidden = false;
    ui.branch.innerHTML = `${icon('fork')}<span>${esc(dateLabel(b.start))}から分かれ道（${b.len}日）:</span>` +
        b.routes.map((r, ri) => `<button class="route ${b.chosen === ri ? 'on' : ''}" data-route="${ri}" aria-pressed="${b.chosen === ri}">${esc(ROUTES[r.key].name)}</button>`).join('');
    ui.branch.querySelectorAll('.route').forEach(btn => btn.addEventListener('click', () => {
        b.chosen = Number(btn.dataset.route); saveGame(); render();
    }));
}
function renderStudents() {
    const sorted = game.students.slice().sort((a, b) => b.grade - a.grade || a.id - b.id);
    ui.students.innerHTML = sorted.map(s => `<button class="stu ${isInjured(s) ? 'injured' : ''}" data-id="${s.id}">
        <span class="face">${esc(s.name.slice(0, 1))}</span>
        <span class="stu-main"><span class="nm">${esc(s.name)} <small>${s.grade}年</small></span>
        <span class="hope">希望: ${JOB_BY_KEY[s.hope].name}${isInjured(s) ? ` <em>けが（あと${s.injuredUntil - game.day + 1}日）</em>` : ''}</span>
        <span class="meter"><span class="lbl">疲れ</span><span class="bar"><i class="fat" style="width:${s.fatigue}%"></i></span></span>
        <span class="meter"><span class="lbl">やる気</span><span class="bar"><i class="mood" style="width:${s.mood}%"></i></span></span></span></button>`).join('');
    ui.students.querySelectorAll('.stu').forEach(el => el.addEventListener('click', () => openStudent(Number(el.dataset.id))));
}
function renderHand() {
    const locked = !!game.pending;
    ui.hand.innerHTML = game.hand.map((n, i) => `<button class="card ${selected && selected.kind === 'hand' && selected.index === i ? 'sel' : ''}" data-kind="hand" data-i="${i}" ${locked ? 'disabled' : ''} aria-label="${n} 進む">${n}</button>`).join('');
    ui.specials.innerHTML = game.specials.map((c, i) => `<button class="card sp ${selected && selected.kind === 'special' && selected.index === i ? 'sel' : ''}" data-kind="special" data-i="${i}" ${locked ? 'disabled' : ''} title="${esc(SPECIAL_CARDS[c.type].desc)}">
        <span class="sp-name">${esc(specialLabel(c))}</span>${c.n ? `<span class="sp-n">${c.n}</span>` : ''}</button>`).join('');
    ui.handbar.querySelectorAll('.card').forEach(el => el.addEventListener('click', () => {
        const sel = { kind: el.dataset.kind, index: Number(el.dataset.i) };
        if (selected && selected.kind === sel.kind && selected.index === sel.index) { go(); return; }
        selected = sel; render();
    }));
    const dest = destinationFor(selected);
    if (selected) {
        const c = selected.kind === 'special' ? game.specials[selected.index] : null;
        ui.go.disabled = locked;
        ui.goInfo.textContent = dest !== null ? `${dateLabel(dest)}：${squareName(squareAt(dest))}` : SPECIAL_CARDS[c.type].desc;
        ui.go.innerHTML = `${icon('arrow')}${c && (c.type === 'free' || c.type === 'replan') ? '使う' : '進む'}`;
    } else {
        ui.go.disabled = true;
        ui.goInfo.textContent = '札を選ぶと、止まる日が分かります';
        ui.go.innerHTML = `${icon('arrow')}進む`;
    }
    ui.handLabel.textContent = `手札 ${game.hand.length}/${handSize()}`;
}
function go() {
    if (!selected || game.pending) return;
    if (selected.kind === 'hand') playHand(selected.index); else playSpecial(selected.index);
}

// ---------- ダイアログ ----------
let dialogOpen = false;
function showDialog({ title, body, buttons = [{ label: '閉じる' }], onOpen, wide }) {
    ui.dlgTitle.textContent = title;
    ui.dlgBody.innerHTML = body;
    ui.dlg.classList.toggle('wide', !!wide);
    ui.dlgButtons.innerHTML = '';
    buttons.forEach(b => {
        const el = document.createElement('button');
        el.className = `btn ${b.primary ? 'primary' : ''} ${b.ghost ? 'ghost' : ''}`;
        el.innerHTML = b.label;
        if (b.id) el.id = b.id;
        el.addEventListener('click', () => { if (b.keepOpen) { b.onClick && b.onClick(); return; } closeDialog(); b.onClick && b.onClick(); });
        ui.dlgButtons.appendChild(el);
    });
    dialogOpen = true;
    if (!ui.dlg.open) ui.dlg.showModal();
    if (onOpen) onOpen();
}
function closeDialog() { dialogOpen = false; if (ui.dlg.open) ui.dlg.close(); }

function openPending() {
    const p = game.pending;
    if (!p || dialogOpen) return;
    if (p.kind === 'practice') openPractice();
    else if (p.kind === 'event') openEvent();
    else if (p.kind === 'shop') openShop();
    else if (p.kind === 'notice') showDialog({ title: p.title, body: p.html, buttons: [{ label: 'OK', primary: true, onClick: () => { game.pending = null; saveGame(); render(); } }] });
    else if (p.kind === 'yearend') openYearEnd();
}
function openPractice() {
    const { sub, mul } = game.pending;
    const p = PRACTICE_BY_KEY[sub];
    const avail = game.students.filter(s => !isInjured(s));
    const chosen = new Set();
    const body = `<p>練習: <b>${esc(p.name)}</b>（${Object.keys(p.gains).map(k => STAT_BY_KEY[k].name).join('・')}が伸びる）${mul > 1 ? '　<b>じっくり: 効果 2 倍</b>' : ''}</p>
        <p class="muted">指導する生徒を 2 人まで選んでください。選ばれなかった生徒も少しだけ伸びます。</p>
        <div class="pick">${avail.map(s => `<button class="pick-stu" data-id="${s.id}" aria-pressed="false"><b>${esc(s.name)}</b> ${s.grade}年<br><small>疲れ ${s.fatigue}・やる気 ${s.mood}${s.talent.some(k => p.gains[k]) ? '・得意' : ''}</small></button>`).join('') || '<p>練習できる生徒がいません。</p>'}</div>`;
    showDialog({
        title: '練習', body,
        buttons: [{ label: '指導する', primary: true, id: 'practice-go', onClick: () => doPractice([...chosen]) }],
        onOpen: () => {
            ui.dlgBody.querySelectorAll('.pick-stu').forEach(el => el.addEventListener('click', () => {
                const id = Number(el.dataset.id);
                if (chosen.has(id)) chosen.delete(id); else if (chosen.size < 2) chosen.add(id);
                ui.dlgBody.querySelectorAll('.pick-stu').forEach(e2 => e2.setAttribute('aria-pressed', chosen.has(Number(e2.dataset.id))));
            }));
        },
    });
}
function openEvent() {
    const { ev, studentId } = game.pending;
    const e = EVENTS[ev];
    const s = game.students.find(x => x.id === studentId) || game.students[0];
    showDialog({
        title: '出来事', body: `<p>${esc(e.text(s))}</p>`,
        buttons: e.choices.map(c => ({
            label: esc(c.label), onClick: () => {
                const msg = c.run(game, s);
                game.students.forEach(normalizeStudent);
                game.fame = Math.max(0, game.fame);
                game.pending = { kind: 'notice', title: '出来事', html: `<p>${esc(msg)}</p>` };
                game.message = msg;
                saveGame(); render();
            }
        })),
    });
}
function openShop() {
    const items = [
        ...Object.keys(SPECIAL_CARDS).map(k => ({ key: k, name: `札「${SPECIAL_CARDS[k].name}」`, desc: SPECIAL_CARDS[k].desc, price: SPECIAL_PRICE[k] })),
        { key: 'snack', name: '差し入れ', desc: '全員のやる気 +15', price: 60 },
        { key: 'potion', name: '疲れの取れる薬', desc: '全員の疲れ -20', price: 50 },
    ];
    const body = `<p>所持金: <b id="shop-gold">${game.gold}</b> ゴールド　特別な札 ${game.specials.length}/${MAX_SPECIAL}</p>
        <div class="shop">${items.map(it => `<button class="shop-item" data-key="${it.key}"><b>${esc(it.name)}</b><small>${esc(it.desc)}</small><span class="price">${icon('coin')}${it.price}</span></button>`).join('')}</div>`;
    showDialog({
        title: '買い物', body,
        buttons: [{ label: '店を出る', primary: true, onClick: () => { game.pending = null; game.message = '買い物を終えた。'; saveGame(); render(); } }],
        onOpen: () => {
            const refresh = () => {
                $('shop-gold').textContent = game.gold;
                ui.dlgBody.querySelectorAll('.shop-item').forEach(el => {
                    const it = items.find(x => x.key === el.dataset.key);
                    el.disabled = game.gold < it.price || (SPECIAL_CARDS[it.key] && game.specials.length >= MAX_SPECIAL);
                });
            };
            ui.dlgBody.querySelectorAll('.shop-item').forEach(el => el.addEventListener('click', () => {
                const it = items.find(x => x.key === el.dataset.key);
                if (game.gold < it.price) return;
                if (SPECIAL_CARDS[it.key]) { if (!addSpecial(it.key)) return; }
                else if (it.key === 'snack') game.students.forEach(s => { s.mood += 15; normalizeStudent(s); });
                else if (it.key === 'potion') game.students.forEach(s => { s.fatigue -= 20; normalizeStudent(s); });
                game.gold -= it.price;
                toast(`${it.name} を買った`);
                saveGame(); refresh();
                ui.gold.textContent = game.gold; renderHand(); renderStudents();
            }));
            refresh();
        },
    });
}
function openYearEnd() {
    const rows = game.students.slice().sort((a, b) => b.grade - a.grade).map(s => `<tr><td>${esc(s.name)}</td><td>${s.grade}年</td><td>${JOB_BY_KEY[s.hope].name}</td><td>${Math.round(power(s))}</td><td>${s.wins}</td></tr>`).join('');
    showDialog({
        title: `${game.year}年目が終わりました`, wide: true,
        body: `<p>知名度 ${game.fame}　所持金 ${game.gold} ゴールド</p>
            <table class="tbl"><tr><th>名前</th><th>学年</th><th>希望</th><th>総合</th><th>大会の勝ち</th></tr>${rows}</table>
            <p class="muted">進級と卒業、職業と勇者の認定は次の版から入ります。</p>`,
        buttons: [{ label: '1年目からもう一度', primary: true, onClick: () => { newGame(); } }],
    });
}
function openStudent(id) {
    const s = game.students.find(x => x.id === id);
    if (!s) return;
    const rows = STATS.map(st => {
        const v = s.stats[st.key];
        const w = Math.min(100, v / st.max * 100);
        return `<div class="srow ${s.talent.includes(st.key) ? 'talent' : ''}"><span>${st.name}${s.talent.includes(st.key) ? ' <small>得意</small>' : ''}</span><span class="bar"><i style="width:${w}%"></i></span><b>${fmtStat(st.key, v)}</b></div>`;
    }).join('');
    showDialog({
        title: `${s.name}（${s.grade}年）`, wide: true,
        body: `<p>希望の職業: <b>${JOB_BY_KEY[s.hope].name}</b>　疲れ ${s.fatigue}　やる気 ${s.mood}　大会の勝ち ${s.wins}</p><div class="stats">${rows}</div>`,
    });
}
function openCalendar(month) {
    const curMonth = dateOf(game.day).getMonth();
    let m = month === undefined ? curMonth : month;
    const draw = () => {
        const y = m >= 3 ? BASE_YEAR : BASE_YEAR + 1;
        const first = new Date(y, m, 1);
        const startI = dayIndexOf(m + 1, 1);
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        let cells = WEEK.map((w, i) => `<div class="cal-h ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</div>`).join('');
        for (let k = 0; k < first.getDay(); k++) cells += '<div></div>';
        for (let d = 0; d < daysInMonth; d++) cells += squareHTML(startI + d);
        ui.dlgTitle.textContent = `${m + 1}月の予定`;
        ui.dlgBody.innerHTML = `<div class="cal-nav"><button class="btn ghost" id="cal-prev" ${m === 3 ? 'disabled' : ''}>← 前の月</button><button class="btn ghost" id="cal-next" ${m === 2 ? 'disabled' : ''}>次の月 →</button></div><div class="cal">${cells}</div>
            <p class="muted">点線の枠は分かれ道の日（今選んでいる道を表示）。</p>`;
        $('cal-prev').onclick = () => { m = (m + 11) % 12; draw(); };
        $('cal-next').onclick = () => { m = (m + 1) % 12; draw(); };
    };
    showDialog({ title: '', body: '', wide: true, onOpen: draw });
}
function openSettings() {
    const opt = (v, l) => `<button class="seg ${game.appearance === v ? 'on' : ''}" data-ap="${v}" aria-pressed="${game.appearance === v}">${l}</button>`;
    showDialog({
        title: '設定',
        body: `<p>明るさ</p><div class="segs">${opt('auto', '端末に合わせる')}${opt('light', 'ライト')}${opt('dark', 'ダーク')}</div>
            <p style="margin-top:18px">データ</p><button class="btn danger" id="reset-btn">最初からやり直す</button>`,
        onOpen: () => {
            ui.dlgBody.querySelectorAll('.seg').forEach(el => el.addEventListener('click', () => {
                game.appearance = el.dataset.ap; saveGame(); applyAppearance();
                ui.dlgBody.querySelectorAll('.seg').forEach(e2 => { const on = e2.dataset.ap === game.appearance; e2.classList.toggle('on', on); e2.setAttribute('aria-pressed', on); });
            }));
            $('reset-btn').addEventListener('click', fullReset);
        },
    });
}
function openHistory() {
    showDialog({
        title: `ダイスアカデミー v${APP_VERSION}`,
        body: VERSION_INFO.history.map(h => `<h3>v${h.version}<small>　${h.date}</small></h3><ul>${h.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`).join(''),
    });
}
let toastTimer = null;
function toast(msg) {
    ui.toast.textContent = msg; ui.toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1800);
}

// ---------- 明るさ ----------
function applyAppearance() {
    if (game.appearance === 'light' || game.appearance === 'dark') document.documentElement.dataset.theme = game.appearance;
    else delete document.documentElement.dataset.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--bar').trim() || '#3b2f4a';
}

// ---------- セーブ ----------
function saveGame() {
    if (resetting || !game) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch (err) { console.error(err); }
}
function loadGame() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (err) { console.error(err); }
    if (!raw) return false;
    try {
        const p = JSON.parse(raw);
        if (!p || typeof p !== 'object' || !p.board || !Array.isArray(p.students)) throw new Error('invalid save');
        game = Object.assign(makeDefaultGame(), p);
        game.students.forEach(normalizeStudent);
        game.saveVersion = SAVE_VERSION;
        return true;
    } catch (err) {
        try { localStorage.setItem(SAVE_KEY + '_corrupted', raw); } catch (e) { }
        setTimeout(() => toast('セーブデータが壊れていたので、最初から始めました'), 0);
        return false;
    }
}
function fullReset() {
    if (!confirm('今までのデータを消して、最初からやり直しますか？（元に戻せません）')) return;
    resetting = true;
    [SAVE_KEY, SAVE_KEY + '_corrupted'].forEach(k => localStorage.removeItem(k));
    location.reload();
}

// ---------- 起動 ----------
function init() {
    ['date', 'fame', 'gold', 'next', 'strip', 'branch', 'students', 'hand', 'specials', 'handbar', 'go', 'goInfo', 'handLabel', 'message', 'dlg', 'dlgTitle', 'dlgBody', 'dlgButtons', 'toast', 'version']
        .forEach(id => { ui[id] = $(id); });
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
    ui.version.textContent = `v${APP_VERSION}`;
    ui.version.addEventListener('click', openHistory);
    $('cal-btn').addEventListener('click', () => openCalendar());
    $('set-btn').addEventListener('click', openSettings);
    ui.go.addEventListener('click', go);
    ui.dlg.addEventListener('cancel', e => { if (game.pending) e.preventDefault(); else dialogOpen = false; });
    ui.dlg.addEventListener('close', () => { if (ui.dlg.open) return; dialogOpen = false; if (game.pending) setTimeout(openPending, 0); });
    ui.dlg.addEventListener('click', e => { if (e.target === ui.dlg && !game.pending) closeDialog(); });

    const loaded = loadGame();
    if (!loaded) newGame();
    else {
        refillHand();
        if (game.lastVersion !== APP_VERSION) {
            const h = VERSION_INFO.history[0];
            setTimeout(() => toast(`v${h.version} に更新: ${h.changes[0]}`), 300);
            game.lastVersion = APP_VERSION;
        }
    }
    render();
    setInterval(saveGame, 10000);
    window.addEventListener('beforeunload', saveGame);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyAppearance);
}
document.addEventListener('DOMContentLoaded', init);
