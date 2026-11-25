// ダイスアカデミー 本体
'use strict';

const SAVE_KEY = 'diceacademy_save';
const SAVE_VERSION = 4;
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
    swords: '<path d="M4 4l9 9M4 4v3M4 4h3"/><path d="M20 4l-9 9M20 4v3M20 4h-3"/><path d="M9 15l-4 4M15 15l4 4M7 13l4 4M17 13l-4 4"/>',
    piece: '<circle cx="12" cy="7" r="4"/><path d="M6 21l2-9h8l2 9z"/>',
    book: '<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/><path d="M22 9v6"/>',
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
    STATS.forEach(st => { stats[st.key] = rand(...st.init); });
    job.favor.forEach(k => { stats[k] += rand(...STAT_BY_KEY[k].favor); });
    // 学年が上の生徒は、すでにある程度育っている
    for (let g = 1; g < grade; g++) STATS.forEach(st => { stats[st.key] += rand(...st.grade); });
    const s = { stats };
    STATS.forEach(st => fixOverflow(s, st.key));
    const talent = shuffle([...job.favor, ...STATS.map(s => s.key)]).filter((k, i, a) => a.indexOf(k) === i).slice(0, 2);
    const skills = grade >= 2 ? [SKILL_LINES[JOB_LINE[job.key]][0]] : [];
    return { id: game.nextId++, name, grade, hope: job.key, talent, stats, fatigue: rand(0, 15), mood: rand(50, 70), injuredUntil: -1, wins: 0, skills, skillProg: {} };
}
function usedNameSet() { return new Set(game.students.map(s => s.name)); }
function isInjured(s) { return s.injuredUntil >= game.day; }
function randomStat() { return pick(STATS).key; }
function roundStat(key, v) { return STAT_BY_KEY[key].pct ? Math.round(v * 10) / 10 : Math.round(v); }
// 割合の能力が 100% を超えたら、超えた分を決まった能力に移す（移す先が無い能力は超えたまま持つ）
function fixOverflow(s, key) {
    const st = STAT_BY_KEY[key];
    s.stats[key] = Math.max(0, roundStat(key, s.stats[key]));
    if (st.pct && st.overflow && s.stats[key] > 100) {
        const over = s.stats[key] - 100;
        s.stats[key] = 100;
        s.stats[st.overflow.to] = roundStat(st.overflow.to, s.stats[st.overflow.to] + over * st.overflow.rate);
    }
}
function addStat(s, key, amount) {
    s.stats[key] += amount;
    fixOverflow(s, key);
}
// 能力の変化（前の写しと比べて増えた分）
function statDiff(before, s) {
    const res = {};
    STATS.forEach(st => { const d = roundStat(st.key, s.stats[st.key] - before[st.key]); if (d > 0) res[st.key] = d; });
    return res;
}
function fmtDiff(res) { return Object.entries(res).map(([k, v]) => `${STAT_BY_KEY[k].name} +${STAT_BY_KEY[k].pct ? v.toFixed(1) : v}`).join('、'); }
// 段階（E〜S）。割合の能力には付けない
function statRank(key, v) {
    const st = STAT_BY_KEY[key];
    if (!st.ranks) return null;
    let i = 0; while (i < st.ranks.length && v >= st.ranks[i]) i++;
    return i;
}
// 能力の棒の長さ（0〜100）。割合の能力は 100% で満タン、定数の能力は今の段階の中での進み具合
function statBar(key, v) {
    const st = STAT_BY_KEY[key];
    if (st.pct) return clamp(v, 0, 100);
    const r = statRank(key, v);
    if (r >= st.ranks.length) return 100;
    const lo = r === 0 ? 0 : st.ranks[r - 1], hi = st.ranks[r];
    return clamp((v - lo) / (hi - lo) * 100, 0, 100);
}
// 足りない能力を埋める（古いセーブ・古い戦いの相手）
function fillStats(stats) {
    if (stats.pen !== undefined) {
        if (stats.ppen === undefined) stats.ppen = stats.pen;
        if (stats.mpen === undefined) stats.mpen = stats.pen;
        delete stats.pen;
    }
    if (stats.critdmg === undefined) stats.critdmg = 150;
    STATS.forEach(st => { if (typeof stats[st.key] !== 'number' || !isFinite(stats[st.key])) stats[st.key] = 0; });
    return stats;
}
// 練習の種類 line で次に覚える技（全部覚えていたら null）
function nextSkill(s, line) { return SKILL_LINES[line].find(id => !s.skills.includes(id)) || null; }
const SKILL_NEED = 100;
function fmtStat(key, v) {
    const st = STAT_BY_KEY[key];
    if (st.pct) return v > 100 ? `100%（+${(v - 100).toFixed(1)}%）` : `${v.toFixed(1)}%`;
    return `${v}${st.unit || ''}`;
}
function normalizeStudent(s) {
    if (!Array.isArray(s.skills)) s.skills = [];
    if (!s.skillProg || typeof s.skillProg !== 'object') s.skillProg = {};
    s.fatigue = clamp(Math.round(s.fatigue), 0, 100);
    s.mood = clamp(Math.round(s.mood), 0, 100);
}
// 職業の要件: 見る能力がどれも req 以上
function meetsJob(s, job) { return job.favor.every(k => s.stats[k] >= STAT_BY_KEY[k].req); }
// 卒業のときに選べる職業（どれも満たさなければ村人）
function eligibleJobs(s) {
    const ok = JOBS.filter(j => meetsJob(s, j));
    return ok.length ? ok : [VILLAGER];
}
function reqRows(s) {
    return `<div class="reqs">${JOBS.map(j => {
        const can = meetsJob(s, j);
        const items = j.favor.map(k => {
            const st = STAT_BY_KEY[k], v = s.stats[k];
            const fmt = x => st.pct ? `${Math.round(x)}%` : `${Math.round(x)}${st.unit || ''}`;
            return `<span class="req-item ${v >= st.req ? 'ok' : ''}">${st.name} <b>${fmt(Math.min(v, 999))}</b> / ${fmt(st.req)}</span>`;
        }).join('');
        return `<div class="req ${can ? 'can' : ''}"><span class="req-job">${j.name}${j.key === s.hope ? ' <small class="hope-tag">希望</small>' : ''}${can ? ' <small class="req-can">なれる</small>' : ''}</span><span class="req-items">${items}</span></div>`;
    }).join('')}</div>`;
}
// 能力ごとの大きさの違いをならした値（総合と適性に使う）
function statScore(key, v) { const sc = STAT_BY_KEY[key].score; return Math.max(0, v - sc.base) * sc.w; }
function power(s, weights = {}) {
    return STATS.reduce((a, st) => a + statScore(st.key, s.stats[st.key]) * (weights[st.key] || 1), 0);
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
        board: null, hand: [], specials: [], students: [], nextId: 1, alumni: [], records: [],
        message: '', pending: null, lastVersion: APP_VERSION, lastParty: [], lastTactic: 'balance', lastMode: 'stat',
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
        case 'battle': game.pending = { kind: 'battle', mode: 'small' }; break;
        case 'fixed': resolveFixed(sq.key); break;
    }
    saveGame();
    render();
}

function practiceGain(s, sub, coached, mul) {
    const p = PRACTICE_BY_KEY[sub];
    const before = { ...s.stats };
    const moodMul = 0.6 + s.mood / 100 * 0.8;
    const fatigueMul = s.fatigue > 80 ? 0.6 : 1;
    Object.entries(p.gains).forEach(([k, base]) => {
        const talentMul = s.talent.includes(k) ? 1.5 : 1;
        const hopeMul = JOB_BY_KEY[s.hope].favor.includes(k) ? HOPE_GROWTH : 1;
        const v = base * talentMul * hopeMul * moodMul * fatigueMul * (coached ? 1 : 0.25) * mul * (0.8 + Math.random() * 0.4);
        addStat(s, k, v);
    });
    return statDiff(before, s);
}
function skillPractice(s, sub, mul) {
    const id = nextSkill(s, sub);
    if (!id) return null;
    const p = PRACTICE_BY_KEY[sub];
    const talentMul = Object.keys(p.gains).some(k => s.talent.includes(k)) ? 1.3 : 1;
    const moodMul = 0.6 + s.mood / 100 * 0.8;
    const gain = Math.round(34 * talentMul * moodMul * mul * (0.85 + Math.random() * 0.3));
    s.skillProg[sub] = (s.skillProg[sub] || 0) + gain;
    if (s.skillProg[sub] >= SKILL_NEED) { s.skillProg[sub] = 0; s.skills.push(id); return `技「${SKILLS[id].name}」を覚えた！`; }
    return `技「${SKILLS[id].name}」の練習 ${Math.min(99, Math.round(s.skillProg[sub]))}%`;
}
function doPractice(ids, mode) {
    const { sub, mul } = game.pending;
    const lines = [];
    let injuredMsg = '';
    game.lastMode = mode;
    game.students.forEach(s => {
        if (isInjured(s)) return;
        const coached = ids.includes(s.id);
        if (coached && mode === 'skill' && nextSkill(s, sub)) {
            const msg = skillPractice(s, sub, mul);
            s.fatigue += 15 * mul; s.mood += 3; normalizeStudent(s);
            lines.push(`${s.name}: ${msg}`);
            return;
        }
        const res = practiceGain(s, sub, coached, mul);
        s.fatigue += coached ? 15 * mul : 3;
        s.mood += coached ? 3 : 0;
        normalizeStudent(s);
        if (coached && s.fatigue > 70 && Math.random() < (s.fatigue - 70) / 100) {
            s.injuredUntil = game.day + rand(3, 6);
            injuredMsg += ` ${s.name} は無理がたたってけがをした。`;
        }
        if (coached) lines.push(`${s.name}: ${fmtDiff(res) || '伸びなかった'}`);
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
        game.pending = { kind: 'battle', mode: 'tournament', key, round: 0 };
        game.message = `${info.name}の日。`;
    } else if (key === 'graduation') {
        startGraduation(null);
    } else if (key === 'yearend') {
        game.pending = { kind: 'yearend' };
        game.message = '修了式。1 年が終わった。';
    }
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
    if (!sorted.length) { ui.students.innerHTML = '<p class="muted">生徒がいない。</p>'; return; }
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
    // 最初の選択肢に焦点が当たって選択の色が隠れないよう、主のボタンに焦点を置く
    const main = ui.dlgButtons.querySelector('.primary') || ui.dlgButtons.querySelector('button');
    if (main) main.focus();
}
function closeDialog() { dialogOpen = false; if (ui.dlg.open) ui.dlg.close(); }

function openPending() {
    const p = game.pending;
    if (!p || dialogOpen || battle) return;
    if (p.kind === 'practice') openPractice();
    else if (p.kind === 'event') openEvent();
    else if (p.kind === 'shop') openShop();
    else if (p.kind === 'notice') showDialog({ title: p.title, body: p.html, buttons: [{ label: 'OK', primary: true, onClick: () => { game.pending = p.next ? { kind: p.next } : null; saveGame(); render(); } }] });
    else if (p.kind === 'yearend') openYearEnd();
    else if (p.kind === 'graduation') openGraduation();
    else if (p.kind === 'battle') openFormation();
}
function openPractice() {
    const { sub, mul } = game.pending;
    const p = PRACTICE_BY_KEY[sub];
    const avail = game.students.filter(s => !isInjured(s));
    const chosen = new Set();
    let mode = game.lastMode === 'skill' ? 'skill' : 'stat';
    const segBtn = (m, l) => `<button class="seg ${mode === m ? 'on' : ''}" data-mode="${m}" aria-pressed="${mode === m}">${l}</button>`;
    const skillInfo = s => {
        const id = nextSkill(s, sub);
        return id ? `次の技「${SKILLS[id].name}」${Math.round(s.skillProg[sub] || 0)}%` : 'この系統の技は全部覚えた';
    };
    const body = `<p>練習: <b>${esc(p.name)}</b>${mul > 1 ? '　<b>じっくり: 効果 2 倍</b>' : ''}</p>
        <div class="segs">${segBtn('stat', `能力を伸ばす（${Object.keys(p.gains).map(k => STAT_BY_KEY[k].name).join('・')}）`)}${segBtn('skill', '技を練習する')}</div>
        <p class="muted">指導する生徒を 2 人まで選んでください。選ばれなかった生徒も、能力が少しだけ伸びます。</p>
        <div class="pick" data-mode="${mode}">${avail.map(s => `<button class="pick-stu" data-id="${s.id}" aria-pressed="false"><b>${esc(s.name)}</b> ${s.grade}年<br><small class="for-stat">疲れ ${s.fatigue}・やる気 ${s.mood}${s.talent.some(k => p.gains[k]) ? '・得意' : ''}</small><small class="for-skill">${esc(skillInfo(s))}</small></button>`).join('') || '<p>練習できる生徒がいません。</p>'}</div>`;
    showDialog({
        title: '練習', body,
        buttons: [{ label: '指導する', primary: true, id: 'practice-go', onClick: () => doPractice([...chosen], mode) }],
        onOpen: () => {
            ui.dlgBody.querySelectorAll('.seg[data-mode]').forEach(el => el.addEventListener('click', () => {
                mode = el.dataset.mode;
                ui.dlgBody.querySelectorAll('.seg[data-mode]').forEach(e2 => { const on = e2.dataset.mode === mode; e2.classList.toggle('on', on); e2.setAttribute('aria-pressed', on); });
                ui.dlgBody.querySelector('.pick').dataset.mode = mode;
            }));
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
// ---------- 戦いの準備と結果 ----------
const ROUND_NAMES = ['1 回戦', '準々決勝', '準決勝', '決勝'];
function battleSetup(p) {
    if (p.mode === 'small') return { title: '小さな戦い', max: 4, pool: game.students.filter(s => !isInjured(s)) };
    const info = fixedInfo(p.key);
    const individual = p.key !== 'team';
    const pool = game.students.filter(s => !isInjured(s) && (p.key !== 'rookie' || s.grade === 1));
    return { title: `${info.name}（${info.desc}）`, max: individual ? 1 : 4, pool, info, individual };
}
function tournamentFoes(p) {
    const st = battleSetup(p);
    const strength = 0.92 + p.round * 0.08;
    const jobs = p.key === 'sword' ? ['warrior', 'knight', 'thief', 'hunter'] : null;
    const school = p.schools[p.round];
    return Array.from({ length: st.max }, () => ({ ...makeRival(game.day, strength, jobs, p.key === 'rookie'), sub: school }));
}
function openFormation() {
    const p = game.pending;
    if (battle) return;
    if (p.mode === 'tournament' && p.round > 0 && p.party) { openNextMatch(); return; }
    const st = battleSetup(p);
    if (p.mode === 'small' && !p.enemies) { p.enemies = makeMonsters(game.day); saveGame(); }
    if (p.mode === 'tournament' && !p.schools) { p.schools = shuffle(RIVAL_SCHOOLS).slice(0, 4); saveGame(); }
    if (!st.pool.length) {
        game.pending = { kind: 'notice', title: st.title, html: '<p>出られる生徒がいなかった。</p>' };
        game.message = `${st.title}: 出られる生徒がいなかった。`;
        saveGame(); render(); return;
    }
    const chosen = new Set(game.lastParty.filter(id => st.pool.some(s => s.id === id)).slice(0, st.max));
    // 足りない分は総合の高い順に埋める
    st.pool.slice().sort((a, b) => power(b) - power(a)).forEach(s => { if (chosen.size < st.max) chosen.add(s.id); });
    let tactic = game.lastTactic || 'balance';
    const foeText = p.mode === 'small' ? `相手: ${p.enemies.map(e => esc(e.name)).join('、')}` : `${st.individual ? '学校代表を 1 人選んでください。' : '出場する 4 人を選んでください。'}勝ち抜くと ${ROUND_NAMES.length} 試合あります。`;
    const body = `<p>${foeText}</p>
        <div class="pick">${st.pool.map(s => `<button class="pick-stu" data-id="${s.id}" aria-pressed="${chosen.has(s.id)}"><b>${esc(s.name)}</b> ${s.grade}年<br><small>総合 ${Math.round(power(s))}・疲れ ${s.fatigue}・技 ${s.skills.length}</small></button>`).join('')}</div>
        <p style="margin-top:12px">作戦</p><div class="segs">${Object.entries(TACTICS).map(([k, t]) => `<button class="seg ${tactic === k ? 'on' : ''}" data-tactic="${k}" aria-pressed="${tactic === k}" title="${esc(t.desc)}">${t.name}</button>`).join('')}</div>
        <p class="muted" id="tactic-desc">${esc(TACTICS[tactic].desc)}</p>`;
    const buttons = [{ label: `${icon('swords')}戦う`, primary: true, id: 'fight-go', onClick: () => beginBattle([...chosen], tactic) }];
    if (p.mode === 'small') buttons.unshift({ label: '逃げる', ghost: true, onClick: () => { game.pending = null; game.message = '戦わずに引き返した。'; saveGame(); render(); } });
    showDialog({
        title: st.title, body, buttons,
        onOpen: () => {
            const sync = () => {
                ui.dlgBody.querySelectorAll('.pick-stu').forEach(e2 => e2.setAttribute('aria-pressed', chosen.has(Number(e2.dataset.id))));
                $('fight-go').disabled = !chosen.size;
            };
            ui.dlgBody.querySelectorAll('.pick-stu').forEach(el => el.addEventListener('click', () => {
                const id = Number(el.dataset.id);
                if (chosen.has(id)) chosen.delete(id);
                else { if (chosen.size >= st.max) chosen.delete([...chosen][0]); chosen.add(id); }
                sync();
            }));
            ui.dlgBody.querySelectorAll('.seg[data-tactic]').forEach(el => el.addEventListener('click', () => {
                tactic = el.dataset.tactic;
                ui.dlgBody.querySelectorAll('.seg[data-tactic]').forEach(e2 => { const on = e2.dataset.tactic === tactic; e2.classList.toggle('on', on); e2.setAttribute('aria-pressed', on); });
                $('tactic-desc').textContent = TACTICS[tactic].desc;
            }));
            sync();
        },
    });
}
function beginBattle(ids, tactic) {
    const p = game.pending;
    if (battleSetup(p).max === 4) game.lastParty = ids;   // 個人戦の代表は覚えない
    game.lastTactic = tactic;
    p.party = ids; p.tactic = tactic;
    saveGame();
    runMatch();
}
function runMatch() {
    const p = game.pending;
    const team = p.party.map(id => game.students.find(s => s.id === id)).filter(Boolean);
    const st = battleSetup(p);
    const enemies = p.mode === 'small' ? p.enemies : tournamentFoes(p);
    const title = p.mode === 'small' ? '小さな戦い' : `${st.info.name} ${ROUND_NAMES[p.round]}: ${p.schools[p.round]}`;
    const mods = p.key === 'sword' ? { phys: 1.3, mag: 0.7 } : null;
    renderHand();
    startBattle({ title, allies: team, enemies, tactic: p.tactic, mods, onEnd: afterMatch });
}
// 戦った生徒は少し伸びる
function battleGrowth(s, win) {
    const keys = shuffle(['hp', 'atk', 'mag', 'def', 'mdef', 'aspd', 'mspd']).slice(0, 2);
    keys.forEach(k => addStat(s, k, (rand(1, 3) + (win ? 1 : 0)) * (JOB_BY_KEY[s.hope].favor.includes(k) ? HOPE_GROWTH : 1)));
    if (Math.random() < 0.3) addStat(s, pick(['crit', 'ppen', 'mpen', 'ten']), 0.5);
    if (Math.random() < 0.3) addStat(s, pick(['critdmg', 'plet', 'mlet']), 1);
    return keys;
}
function afterMatch(r) {
    const p = game.pending;
    const team = r.units.map(u => game.students.find(s => s.id === u.studentId)).filter(Boolean);
    team.forEach(s => { battleGrowth(s, r.win); s.fatigue += p.mode === 'small' ? 8 : 10; s.mood += r.win ? 5 : -5; normalizeStudent(s); });
    refillHand();
    if (p.mode === 'small') {
        if (r.win) {
            const gold = rand(20, 50) + Math.floor(game.day / 10);
            game.gold += gold; game.fame += 1;
            game.message = `小さな戦いに勝った。${gold} ゴールド、知名度 +1。戦った生徒の能力が少し伸びた。`;
        } else {
            game.message = '小さな戦いに負けた。生徒たちは悔しそうだ。';
        }
        game.pending = null;
        saveGame(); render(); return;
    }
    // 大会
    if (r.win) {
        team.forEach(s => { s.wins++; });
        p.round++;
        if (p.round >= ROUND_NAMES.length) { finishTournament(p, 4); return; }
        team.forEach(s => { s.fatigue -= 5; normalizeStudent(s); });
        saveGame();
        openNextMatch(true);
    } else finishTournament(p, p.round);
}
function openNextMatch(justWon) {
    const p = game.pending;
    const st = battleSetup(p);
    showDialog({
        title: st.info.name,
        body: `${justWon ? `<p class="big">${ROUND_NAMES[p.round - 1]} 勝ち</p>` : ''}<p>次は <b>${ROUND_NAMES[p.round]}</b>。相手は ${esc(p.schools[p.round])}。</p><p class="muted">試合の間に体力は戻ります。</p>`,
        buttons: [{ label: `${icon('swords')}次の試合へ`, primary: true, onClick: runMatch }],
    });
}
function finishTournament(p, wins) {
    const st = battleSetup(p);
    const result = wins === 4 ? '優勝' : wins === 3 ? '準優勝' : wins === 2 ? 'ベスト 4' : wins === 1 ? 'ベスト 8' : '1 回戦負け';
    const fame = wins * 6 + (wins === 4 ? 20 : 0);
    const gold = wins * 20 + (wins === 4 ? 100 : 0);
    game.fame += fame; game.gold += gold;
    game.records.push({ year: game.year, name: st.info.name, result, wins });
    const team = p.party.map(id => game.students.find(s => s.id === id)).filter(Boolean);
    game.pending = {
        kind: 'notice', title: st.title,
        html: `<p>出場: ${team.map(s => esc(s.name)).join('、')}</p><p class="big">${result}</p><p>知名度 +${fame}　${gold} ゴールド</p>`,
    };
    game.message = `${st.info.name}: ${result}。`;
    saveGame(); render();
}

// ---------- 卒業と進級 ----------
function startGraduation(then) {
    const seniors = game.students.filter(s => s.grade >= 3).sort((a, b) => a.id - b.id);
    if (!seniors.length) {
        game.pending = then ? { kind: then } : { kind: 'notice', title: '卒業式', html: '<p>今年卒業する 3 年生はいなかった。</p>' };
        if (!then) game.message = '卒業式。卒業する 3 年生はいなかった。';
        return;
    }
    game.pending = { kind: 'graduation', queue: seniors.map(s => s.id), done: [], then };
    game.message = `卒業式。${seniors.length} 人の 3 年生が卒業する。`;
}
function openGraduation() {
    const p = game.pending;
    p.queue = p.queue.filter(id => game.students.some(s => s.id === id));
    if (!p.queue.length) { finishGraduation(); return; }
    const s = game.students.find(x => x.id === p.queue[0]);
    const ok = eligibleJobs(s);
    const note = ok[0] === VILLAGER ? 'どの職業の要件にも届かなかったので、村人として故郷に帰る。'
        : ok.length === 1 ? '要件を満たした職業は 1 つだけ。' : '要件を満たした職業から、進む道を選んでください。';
    showDialog({
        title: `卒業式: ${s.name}`, wide: true,
        body: `<p>希望の職業: <b>${JOB_BY_KEY[s.hope].name}</b>　総合 ${Math.round(power(s))}　大会の勝ち ${s.wins}　技 ${s.skills.length}</p>
            <p class="muted">職業の要件（その職業で見る能力が、どれも決まった値以上ならなれる）。</p>
            ${reqRows(s)}<p>${note}</p>`,
        buttons: ok.map(j => ({ label: `${icon('cap')}${j.name}${j.key === s.hope ? '（希望）' : ''}として卒業`, primary: j.key === s.hope || ok.length === 1, onClick: () => graduate(s, j) })),
    });
}
function graduate(s, job) {
    const p = game.pending;
    game.alumni.push({
        id: s.id, name: s.name, year: game.year, job: job.key, hope: s.hope, wins: s.wins,
        power: Math.round(power(s)), stats: { ...s.stats }, skills: s.skills.slice(),
    });
    game.students = game.students.filter(x => x.id !== s.id);
    game.lastParty = game.lastParty.filter(id => id !== s.id);
    p.queue = p.queue.filter(id => id !== s.id);
    p.done.push({ name: s.name, job: job.key, hope: s.hope });
    saveGame(); render();
}
function finishGraduation() {
    const p = game.pending;
    const list = p.done.map(d => `<li><b>${esc(d.name)}</b>　${JOB_BY_KEY[d.job].name}${d.job === d.hope ? '（希望どおり）' : `（希望は ${JOB_BY_KEY[d.hope].name}）`}</li>`).join('');
    game.message = `卒業式。${p.done.map(d => `${d.name}（${JOB_BY_KEY[d.job].name}）`).join('、')} が卒業した。`;
    game.pending = { kind: 'notice', title: '卒業式', html: `<p>${p.done.length} 人が卒業していった。</p><ul class="plain">${list}</ul><p class="muted">卒業生は「歴史」で見られる。</p>` };
    if (p.then) game.pending.next = p.then;
    saveGame(); render();
}
function openYearEnd() {
    // 卒業式を迎えずに修了式に来た 3 年生（古いセーブなど）は、先に卒業させる
    if (game.students.some(s => s.grade >= 3)) { startGraduation('yearend'); saveGame(); render(); return; }
    const rows = game.students.slice().sort((a, b) => b.grade - a.grade || a.id - b.id).map(s => `<tr><td>${esc(s.name)}</td><td>${s.grade}年 → ${s.grade + 1}年</td><td>${JOB_BY_KEY[s.hope].name}</td><td>${Math.round(power(s))}</td><td>${s.wins}</td></tr>`).join('');
    const recs = game.records.filter(r => r.year === game.year).map(r => `<li>${esc(r.name)}: ${esc(r.result)}</li>`).join('');
    const grads = game.alumni.filter(a => a.year === game.year).map(a => `${esc(a.name)}（${JOB_BY_KEY[a.job].name}）`).join('、');
    showDialog({
        title: `${game.year}年目が終わりました`, wide: true,
        body: `<p>知名度 ${game.fame}　所持金 ${game.gold} ゴールド</p>
            ${recs ? `<h3>今年の大会</h3><ul class="plain">${recs}</ul>` : ''}
            ${grads ? `<h3>今年の卒業生</h3><p>${grads}</p>` : ''}
            <h3>進級する生徒</h3>${rows ? `<table class="tbl"><tr><th>名前</th><th>学年</th><th>希望</th><th>総合</th><th>大会の勝ち</th></tr>${rows}</table>` : '<p class="muted">いない。</p>'}
            <p class="muted">春休みのあいだに疲れとけがは治る。次の日は入学式。</p>`,
        buttons: [{ label: `${icon('arrow')}${game.year + 1}年目へ`, primary: true, onClick: startNewYear }],
    });
}
function startNewYear() {
    game.year++;
    game.students.forEach(s => { s.grade++; s.fatigue = 0; s.injuredUntil = -1; s.mood = Math.max(s.mood, 55); });
    game.board = generateBoard();
    game.day = 0;
    game.pending = null;
    selected = null;
    refillHand();
    game.message = `${game.year}年目が始まった。今日は入学式です。`;
    resolveSquare(1);
}
function openAlumni() {
    const years = [...new Set([...game.alumni.map(a => a.year), ...game.records.map(r => r.year)])].sort((a, b) => b - a);
    const html = years.map(y => {
        const recs = game.records.filter(r => r.year === y);
        const al = game.alumni.filter(a => a.year === y);
        return `<h3>${y}年目</h3>
            ${recs.length ? `<p>大会: ${recs.map(r => `${esc(r.name)} ${esc(r.result)}`).join('、')}</p>` : ''}
            ${al.length ? `<table class="tbl"><tr><th>卒業生</th><th>職業</th><th>希望</th><th>総合</th><th>大会の勝ち</th><th>技</th></tr>${al.map(a => `<tr><td>${esc(a.name)}</td><td><b>${JOB_BY_KEY[a.job].name}</b></td><td>${JOB_BY_KEY[a.hope].name}</td><td>${a.power}</td><td>${a.wins}</td><td>${a.skills.length}</td></tr>`).join('')}</table>` : ''}`;
    }).join('');
    showDialog({
        title: '学園の歴史', wide: true,
        body: html || '<p class="muted">まだ記録がない。大会の結果と、3 月 20 日の卒業式で卒業した生徒がここに残る。</p>',
    });
}
function openStudent(id) {
    const s = game.students.find(x => x.id === id);
    if (!s) return;
    const rows = STATS.map(st => {
        const v = s.stats[st.key];
        const r = statRank(st.key, v);
        return `<div class="srow ${s.talent.includes(st.key) ? 'talent' : ''}"><span>${st.name}${s.talent.includes(st.key) ? ' <small>得意</small>' : ''}</span><span class="bar"><i style="width:${statBar(st.key, v)}%"></i></span><b>${fmtStat(st.key, v)}</b><span class="rank ${r === null ? '' : `r${r}`}">${r === null ? '' : RANK_NAMES[r]}</span></div>`;
    }).join('');
    showDialog({
        title: `${s.name}（${s.grade}年）`, wide: true,
        body: `<p>希望の職業: <b>${JOB_BY_KEY[s.hope].name}</b>　疲れ ${s.fatigue}　やる気 ${s.mood}　大会の勝ち ${s.wins}</p><div class="stats">${rows}</div>
            <h3>職業の要件</h3>${reqRows(s)}
            <p class="muted">卒業式（3 月 20 日）で、要件を満たした職業から選べる。どれも満たさなければ村人になる。希望の職業で見る能力は少し伸びやすい。${s.grade < 3 ? `卒業まであと ${3 - s.grade} 年。` : '今年卒業する。'}</p>
            <h3>覚えた技</h3>${s.skills.length ? `<ul class="plain">${s.skills.map(id => `<li><b>${SKILLS[id].name}</b>　<small>${esc(SKILLS[id].desc)}（マナ ${SKILLS[id].mp}）</small></li>`).join('')}</ul>` : '<p class="muted">まだない。練習のマスで「技を練習する」を選ぶと覚えられる。</p>'}
            ${Object.entries(s.skillProg).filter(([l, v]) => v > 0 && nextSkill(s, l)).map(([l, v]) => `<p class="muted">練習中: ${SKILLS[nextSkill(s, l)].name} ${Math.round(v)}%</p>`).join('')}`,
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
        if ((p.saveVersion || 1) < 2) migrateTo2();
        if ((p.saveVersion || 1) < 3) migrateTo3();
        if ((p.saveVersion || 1) < 4) migrateTo4();
        game.saveVersion = SAVE_VERSION;
        return true;
    } catch (err) {
        try { localStorage.setItem(SAVE_KEY + '_corrupted', raw); } catch (e) { }
        setTimeout(() => toast('セーブデータが壊れていたので、最初から始めました'), 0);
        return false;
    }
}
// v0.1 のセーブ: これから先の日に戦いのマスを足し、2・3 年生に最初の技を持たせる
function migrateTo2() {
    for (let i = game.day + 1; i < DAYS_IN_YEAR; i++) {
        if (game.board.days[i].type !== 'fixed' && Math.random() < 0.1) game.board.days[i] = { type: 'battle' };
    }
    game.board.branches.forEach(b => b.routes.forEach(r => { if (r.key === 'forest' && b.start > game.day) r.squares = r.squares.map(q => Math.random() < 0.3 ? { type: 'battle' } : q); }));
    game.students.forEach(s => { if (s.grade >= 2 && !s.skills.length) s.skills.push(SKILL_LINES[JOB_LINE[s.hope]][0]); });
}
// v0.2 までのセーブ: 暦に卒業式を足す（まだ過ぎていなければ）
function migrateTo3() {
    if (!Array.isArray(game.alumni)) game.alumni = [];
    if (!Array.isArray(game.records)) game.records = [];
    const gi = dayIndexOf(3, 20);
    if (game.day >= gi || game.board.days.some(d => d.type === 'fixed' && d.key === 'graduation')) return;
    game.board.branches = game.board.branches.filter(b => !(gi >= b.start - 1 && gi <= b.start + b.len));
    game.board.days[gi] = { type: 'fixed', key: 'graduation' };
}
// v0.3 までのセーブ: 防御貫通を物理・魔法に分け、新しい能力を足す
function migrateTo4() {
    const grow = s => {
        const had = s.stats.critdmg !== undefined;
        fillStats(s.stats);
        if (had) return;
        const g = s.grade || 3;
        ['critdmg', 'plet', 'mlet'].forEach(k => {
            const st = STAT_BY_KEY[k];
            let v = rand(...st.init);
            for (let i = 1; i < g; i++) v += rand(...st.grade);
            s.stats[k] = v;
        });
        STATS.forEach(st => fixOverflow(s, st.key));
    };
    game.students.forEach(grow);
    game.alumni.forEach(grow);
    if (game.pending && Array.isArray(game.pending.enemies)) game.pending.enemies.forEach(e => fillStats(e.stats));
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
    $('hist-btn').addEventListener('click', openAlumni);
    initBattleUI();
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
