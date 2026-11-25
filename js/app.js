// ダイスアカデミー 本体
'use strict';

const SAVE_KEY = 'diceacademy_save';
const SAVE_VERSION = 8;
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
    skull: '<path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 5 4 6v3h8v-3c2.5-1 4-3 4-6a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/><path d="M10 20v-2M14 20v-2"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
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
    const potential = rollPotential();
    const stats = {};
    STATS.forEach(st => { stats[st.key] = rand(...st.init); });
    job.favor.forEach(k => { stats[k] += rand(...STAT_BY_KEY[k].favor) * POTENTIAL_BY_KEY[potential].favor; });
    // 学年が上の生徒は、すでにある程度育っている
    for (let g = 1; g < grade; g++) STATS.forEach(st => { stats[st.key] += rand(...st.grade); });
    const s = { stats };
    STATS.forEach(st => fixOverflow(s, st.key));
    const talent = shuffle([...job.favor, ...STATS.map(s => s.key)]).filter((k, i, a) => a.indexOf(k) === i).slice(0, 2);
    const skills = grade >= 2 ? [SKILL_LINES[JOB_LINE[job.key]][0]] : [];
    return { id: game.nextId++, name, grade, hope: job.key, potential, renown: 0, talent, stats, fatigue: rand(0, 15), mood: rand(50, 70), injuredUntil: -1, wins: 0, skills, skillProg: {} };
}
// 素質を決める（知名度が高いほど良い素質が来やすい）
function rollPotential() {
    return weighted(Object.fromEntries(POTENTIALS.map(p => [p.key, p.weight + p.fame * game.fame])));
}
function potentialOf(s) { return POTENTIAL_BY_KEY[s.potential] || POTENTIAL_BY_KEY.normal; }
// 1 回の練習で指導できる人数
function coachMax() { return Math.max(COACH_MIN, Math.ceil(game.students.length / COACH_PER)); }
// 指導の効果の倍率（知名度で上がる）
function coachMul() { return 1 + Math.min(COACH_FAME_MAX, game.fame * COACH_FAME_RATE); }
// 英傑録・勇者の判定
function renownTier(renown, pw) {
    if (renown + pw >= HERO_SUM) return 'hero';
    if (renown >= ROSTER_RENOWN) return 'elite';
    return null;
}
function jobTitle(a) {
    if (a.tier === 'hero') return HERO_NAME;
    if (a.tier === 'elite') return ELITE_NAMES[a.job] || JOB_BY_KEY[a.job].name;
    return JOB_BY_KEY[a.job].name;
}
function fmtRenown(v) { return String(Math.round(v)); }
function potentialTag(s) { const p = potentialOf(s); return `<span class="pot pot-${p.key}">${p.name}</span>`; }
// 名声と、卒業したらどうなるかの見込み
function renownLine(s) {
    const t = renownTier(s.renown || 0, power(s));
    const sum = Math.round((s.renown || 0) + power(s));
    const next = t === 'hero' ? `勇者になれる（名声 ＋ 総合力 = ${sum} / ${HERO_SUM}）`
        : t === 'elite' ? `英傑録に載る。勇者には名声 ＋ 総合力が ${HERO_SUM} 以上（今 ${sum}）`
            : `英傑録には名声 ${ROSTER_RENOWN} 以上。勇者には名声 ＋ 総合力が ${HERO_SUM} 以上（今 ${sum}）`;
    return `名声 <b>${fmtRenown(s.renown || 0)}</b> <small class="muted">（${next}）</small>`;
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
// 評価点: ふつうの 1 年分の伸びで 100 点。どの能力も同じ物差し
function statPoints(key, v) { const st = STAT_BY_KEY[key]; return Math.max(0, (v - st.base) / st.growth * 100); }
// 評価点の段階（0 = E 〜 5 = S）
// 評価（段階ごとに 100）: E 0〜・D 100〜・C 200〜・B 300〜・A 400〜・S 500〜
function gradeOf(points) {
    const edges = [0, ...RANKS];
    for (let i = 0; i < RANKS.length; i++) {
        if (points < edges[i + 1]) return i * 100 + (points - edges[i]) / (edges[i + 1] - edges[i]) * 100;
    }
    const last = RANKS[RANKS.length - 1] - RANKS[RANKS.length - 2];
    return RANKS.length * 100 + (points - RANKS[RANKS.length - 1]) / last * 100;
}
function statGrade(key, v) { return gradeOf(statPoints(key, v)); }
function rankOf(grade) { return clamp(Math.floor(grade / 100), 0, RANK_NAMES.length - 1); }
// 段階と + −（段階の中の下 3 分の 1 が −、上 3 分の 1 が +）
function gradeLabel(grade) {
    const r = rankOf(grade);
    const f = r === RANK_NAMES.length - 1 ? Math.min(grade - r * 100, 99) : grade - r * 100;
    return RANK_NAMES[r] + (f < 100 / 3 ? '−' : f >= 200 / 3 ? '+' : '');
}
function rankTag(grade) { return `<span class="rank r${rankOf(grade)}">${gradeLabel(grade)}</span>`; }
// 総合力: 16 の能力の評価の平均（段階ごとに 100。能力の段階と同じ物差し）
function power(s) { return STATS.reduce((a, st) => a + statGrade(st.key, s.stats[st.key]), 0) / STATS.length; }
function powerRank(s) { return rankOf(power(s)); }
function powerText(s) { return `${Math.round(power(s))}（${RANK_NAMES[powerRank(s)]}）`; }
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
    return `${v}${st.suffix || ''}`;
}
function normalizeStudent(s) {
    if (!Array.isArray(s.skills)) s.skills = [];
    if (!s.skillProg || typeof s.skillProg !== 'object') s.skillProg = {};
    s.fatigue = clamp(Math.round(s.fatigue), 0, 100);
    s.mood = clamp(Math.round(s.mood), 0, 100);
}
// 職業の要件: 見る能力の評価の平均が段階 B 以上
function jobGrade(s, job) { return job.favor.reduce((a, k) => a + statGrade(k, s.stats[k]), 0) / job.favor.length; }
function meetsJob(s, job) { return jobGrade(s, job) >= JOB_NEED_RANK * 100; }
// 卒業のときに選べる職業（どれも満たさなければ村人）
function eligibleJobs(s) {
    const ok = JOBS.filter(j => meetsJob(s, j));
    return ok.length ? ok : [VILLAGER];
}
function reqRows(s) {
    return `<div class="reqs">${JOBS.map(j => {
        const can = meetsJob(s, j);
        const g = jobGrade(s, j);
        const items = j.favor.map(k => `<span class="req-item">${STAT_BY_KEY[k].name} ${rankTag(statGrade(k, s.stats[k]))}</span>`).join('');
        return `<div class="req ${can ? 'can' : ''}"><span class="req-job">${j.name}${j.key === s.hope ? ' <small class="hope-tag">希望</small>' : ''}${can ? ' <small class="req-can">なれる</small>' : ''}
            <span class="req-sum">平均 ${rankTag(g)}（${RANK_NAMES[JOB_NEED_RANK]} 以上でなれる）</span></span>
            <span class="bar"><i style="width:${clamp(g / (JOB_NEED_RANK * 100) * 100, 0, 100)}%"></i></span><span class="req-items">${items}</span></div>`;
    }).join('')}</div>`;
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
    if (sq.type === 'quest') return game.quest ? `討伐: ${game.quest.boss}` : '討伐';
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
        board: null, hand: [], specials: [], students: [], nextId: 1, alumni: [], records: [], quest: null, questCount: 0,
        message: '', pending: null, lastVersion: APP_VERSION, lastParty: [], lastTactic: 'balance', lastMode: 'stat',
    };
}
function newGame() {
    const appearance = game ? game.appearance : 'auto';
    game = makeDefaultGame();
    game.appearance = appearance;
    game.board = generateBoard();
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
    if (game.quest && game.day > game.quest.deadline) {
        const q = game.quest;
        endQuest();
        game.fame = Math.max(0, game.fame - QUEST_FAIL_FAME);
        setTimeout(() => toast(`討伐の依頼「${q.boss}」の期限が過ぎた。知名度 -${QUEST_FAIL_FAME}`), 0);
    }
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
        if (squareAt(i).type !== 'fixed' && squareAt(i).type !== 'quest') opts.push(i);
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
            if (!game.quest && game.questCount < QUEST_MAX_PER_YEAR && Math.random() < QUEST_CHANCE + game.fame * QUEST_CHANCE_FAME) {
                const q = makeQuest();
                if (q) { game.pending = { kind: 'questOffer', q }; break; }
            }
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
        case 'quest':
            if (game.quest) game.pending = { kind: 'battle', mode: 'quest' };
            else { setSquareAt(game.day, sq.orig || { type: 'rest' }); game.message = '討伐の依頼はもう終わっていた。'; }
            break;
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
        const v = base * talentMul * hopeMul * potentialOf(s).growth * moodMul * fatigueMul * (coached ? coachMul() : 0.25) * mul * (0.8 + Math.random() * 0.4);
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
    const gain = Math.round(34 * talentMul * potentialOf(s).growth * coachMul() * moodMul * mul * (0.85 + Math.random() * 0.3));
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
        game.pending = { kind: 'notice', title: '入学式', html: `<p>${n} 人の新入生が入ってきた。</p><ul class="plain">${added.map(s => `<li><b>${esc(s.name)}</b>　素質: ${potentialTag(s)}　希望: ${JOB_BY_KEY[s.hope].name}　得意: ${s.talent.map(k => STAT_BY_KEY[k].name).join('・')}</li>`).join('')}</ul>` };
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
    renderQuestBar();
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
function showDialog({ title, body, buttons = [{ label: '閉じる' }], onOpen, wide, hero }) {
    ui.dlgTitle.textContent = title;
    ui.dlgBody.innerHTML = body;
    ui.dlg.classList.toggle('wide', !!wide);
    ui.dlg.classList.toggle('hero', !!hero);
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
    else if (p.kind === 'notice') showDialog({ title: p.title, body: p.html, buttons: [{ label: 'OK', primary: true, onClick: () => { game.pending = p.nextPending || (p.next ? { kind: p.next } : null); saveGame(); render(); } }], hero: p.hero });
    else if (p.kind === 'yearend') openYearEnd();
    else if (p.kind === 'graduation') openGraduation();
    else if (p.kind === 'questOffer') openQuestOffer();
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
        <p class="muted">指導する生徒を ${coachMax()} 人まで選んでください（在校生 ${COACH_PER} 人に 1 人）。選ばれなかった生徒も、能力が少しだけ伸びます。</p>
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
                if (chosen.has(id)) chosen.delete(id); else if (chosen.size < coachMax()) chosen.add(id);
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
    if (p.mode === 'quest') return { title: `魔物討伐: ${game.quest.boss}（${QUEST_LEVELS[game.quest.level].name}）`, max: 4, pool: game.students.filter(s => !isInjured(s)), quest: true };
    const info = fixedInfo(p.key);
    const individual = p.key !== 'team';
    const pool = game.students.filter(s => !isInjured(s) && (p.key !== 'rookie' || s.grade === 1));
    return { title: `${info.name}（${info.desc}）`, max: individual ? 1 : 4, pool, info, individual };
}
function tournamentFoes(p) {
    const st = battleSetup(p);
    const strength = (0.92 + p.round * 0.08) * (p.key === 'team' ? TEAM_RIVAL_SCALE : 1);
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
    if (p.mode === 'quest' && !p.enemies) { p.enemies = makeQuestEnemies(game.quest, game.day); saveGame(); }
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
    const helpers = p.mode === 'quest' ? availableHelpers() : [];
    let helper = null;
    const foeText = p.mode !== 'tournament' ? `相手: ${p.enemies.map(e => esc(e.name)).join('、')}` : `${st.individual ? '学校代表を 1 人選んでください。' : '出場する 4 人を選んでください。'}勝ち抜くと ${ROUND_NAMES.length} 試合あります。`;
    const body = `<p>${foeText}</p>
        <div class="pick">${st.pool.map(s => `<button class="pick-stu" data-id="${s.id}" aria-pressed="${chosen.has(s.id)}"><b>${esc(s.name)}</b> ${s.grade}年<br><small>総合力 ${powerText(s)}・疲れ ${s.fatigue}・技 ${s.skills.length}</small></button>`).join('')}</div>
        <p style="margin-top:12px">作戦</p><div class="segs">${Object.entries(TACTICS).map(([k, t]) => `<button class="seg ${tactic === k ? 'on' : ''}" data-tactic="${k}" aria-pressed="${tactic === k}" title="${esc(t.desc)}">${t.name}</button>`).join('')}</div>
        <p class="muted" id="tactic-desc">${esc(TACTICS[tactic].desc)}</p>
        ${p.mode === 'quest' ? `<p style="margin-top:12px">助っ人（英傑録の卒業生。今回予定が空いている人から 1 人まで）</p>
            ${helpers.length ? `<div class="helpers">${helpers.map(a => `<button class="helper" data-hid="${a.id}" aria-pressed="false"><b>${esc(a.name)}</b> <span class="ros-title">${jobTitle(a)}</span><br><small>総合力 ${Math.round(power(a))}（${RANK_NAMES[powerRank(a)]}）・${a.year}年目卒業</small></button>`).join('')}</div>
            <p class="muted">助っ人を呼ぶと勝ちやすいが、生徒の名声は ${Math.round(HELPER_RENOWN_MUL * 100)}% になる。</p>`
                : `<p class="muted">${game.alumni.some(a => a.tier) ? '今回は予定の空いている卒業生がいない。' : 'まだ英傑録に誰も載っていない。'}</p>`}` : ''}`;
    const buttons = [{ label: `${icon('swords')}戦う`, primary: true, id: 'fight-go', onClick: () => { p.helper = helper; beginBattle([...chosen], tactic); } }];
    if (p.mode === 'quest') buttons.unshift({ label: '今回は見送る', ghost: true, onClick: () => { game.pending = null; game.message = `討伐は見送った。期限（${dateLabel(game.quest.deadline)}）までに、ほかの討伐のマスでも挑める。`; saveGame(); render(); } });
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
            ui.dlgBody.querySelectorAll('.helper').forEach(el => el.addEventListener('click', () => {
                const id = Number(el.dataset.hid);
                helper = helper === id ? null : id;
                ui.dlgBody.querySelectorAll('.helper').forEach(e2 => e2.setAttribute('aria-pressed', Number(e2.dataset.hid) === helper));
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
    const enemies = p.mode === 'tournament' ? tournamentFoes(p) : p.enemies;
    const title = p.mode === 'small' ? '小さな戦い' : p.mode === 'quest' ? st.title : `${st.info.name} ${ROUND_NAMES[p.round]}: ${p.schools[p.round]}`;
    const h = p.mode === 'quest' && p.helper ? game.alumni.find(a => a.id === p.helper) : null;
    if (h) team.push({ name: h.name, stats: h.stats, skills: h.skills, sub: `助っ人・${jobTitle(h)}` });
    const mods = p.key === 'sword' ? { phys: 1.3, mag: 0.7 } : null;
    renderHand();
    startBattle({ title, allies: team, enemies, tactic: p.tactic, mods, onEnd: afterMatch });
}
// ---------- 魔物討伐 ----------
function makeQuest() {
    const f = game.fame;
    const level = Number(weighted({ 0: 60, 1: f / 5, 2: Math.max(0, f - 150) / 6 }));
    const deadline = Math.min(DAYS_IN_YEAR - 2, game.day + QUEST_DAYS);
    const cands = [];
    for (let i = game.day + 2; i <= deadline; i++) {
        const sq = game.board.days[i];
        if (sq.type !== 'fixed' && sq.type !== 'quest' && !branchAt(i)) cands.push(i);
    }
    if (cands.length < 2) return null;
    return { boss: pick(QUEST_BOSSES).name, level, deadline, days: shuffle(cands).slice(0, rand(2, 3)).sort((a, b) => a - b) };
}
function openQuestOffer() {
    const q = game.pending.q;
    const L = QUEST_LEVELS[q.level];
    showDialog({
        title: '魔物討伐の依頼',
        body: `<p>近くの村から、<b>${esc(q.boss)}</b> を退治してほしいと依頼が届いた。</p>
            <table class="tbl"><tr><th>難しさ</th><td>${L.name}</td></tr><tr><th>期限</th><td>${dateLabel(q.deadline)}（あと ${q.deadline - game.day} 日）</td></tr>
            <tr><th>お礼</th><td>${L.gold} ゴールド・知名度 +${L.fame}・出た生徒の名声 +${L.renown}</td></tr></table>
            <p class="muted">引き受けると、期限までの日に討伐のマスが ${q.days.length} つ出る（${q.days.map(d => dateLabel(d)).join('、')}）。どれかに止まると挑める。期限を逃すか負けると知名度 -${QUEST_FAIL_FAME}。英傑録の卒業生を助っ人に呼べる。</p>`,
        buttons: [
            { label: '断る', ghost: true, onClick: () => { game.pending = null; game.message = `${q.boss} の討伐の依頼を断った。`; saveGame(); render(); } },
            { label: `${icon('skull')}引き受ける`, primary: true, onClick: () => acceptQuest(q) },
        ],
    });
}
function acceptQuest(q) {
    q.days.forEach(i => { game.board.days[i] = { type: 'quest', orig: game.board.days[i] }; });
    game.quest = q;
    game.questCount++;
    game.pending = null;
    game.message = `${q.boss} の討伐を引き受けた。期限は ${dateLabel(q.deadline)}。`;
    saveGame(); render();
}
// 依頼を終える（盤の討伐のマスを元に戻す）
function endQuest() {
    if (!game.quest) return;
    game.board.days.forEach((sq, i) => { if (sq.type === 'quest') game.board.days[i] = sq.orig || { type: 'rest' }; });
    game.quest = null;
}
function finishQuest(p, win, team) {
    const q = game.quest;
    const L = QUEST_LEVELS[q.level];
    const h = p.helper ? game.alumni.find(a => a.id === p.helper) : null;
    endQuest();
    if (win) {
        const ren = Math.round(L.renown * (h ? HELPER_RENOWN_MUL : 1));
        team.forEach(s => { s.renown = (s.renown || 0) + ren; });
        game.gold += L.gold; game.fame += L.fame;
        if (h) { h.helped = (h.helped || 0) + 1; growAlumnus(h, HELPER_QUEST_GROWTH); }
        game.records.push({ year: game.year, name: `討伐: ${q.boss}`, result: '成功' });
        game.pending = {
            kind: 'notice', title: '魔物討伐 成功',
            html: `<p class="big">${esc(q.boss)} を退治した</p><p>出た生徒: ${team.map(s => esc(s.name)).join('、')}${h ? `　助っ人: ${esc(h.name)}（${jobTitle(h)}）` : ''}</p>
                <p>${L.gold} ゴールド・知名度 +${L.fame}・生徒の名声 +${ren}${h ? `（助っ人を呼んだので ${Math.round(HELPER_RENOWN_MUL * 100)}%）` : ''}</p>${h ? `<p class="muted">${esc(h.name)} も腕を上げた。</p>` : ''}`,
        };
        game.message = `${q.boss} の討伐に成功した。`;
    } else {
        game.fame = Math.max(0, game.fame - QUEST_FAIL_FAME);
        game.records.push({ year: game.year, name: `討伐: ${q.boss}`, result: '失敗' });
        game.pending = { kind: 'notice', title: '魔物討伐 失敗', html: `<p>${esc(q.boss)} に敗れ、依頼は果たせなかった。知名度 -${QUEST_FAIL_FAME}</p>` };
        game.message = `${q.boss} の討伐に失敗した。`;
    }
    saveGame(); render();
}
function isRetired(a) { return game.year - a.year >= HELPER_RETIRE; }
// 今回予定の空いている助っ人（強い人・勇者ほど空きにくい）。依頼ごとに一度だけ決める
function availableHelpers() {
    const q = game.quest;
    if (!q.helpers) {
        q.helpers = game.alumni.filter(a => a.tier && !isRetired(a) && Math.random() < clamp(0.75 - (power(a) - 150) / 300, 0.15, 0.75) * (a.tier === 'hero' ? 0.6 : 1)).map(a => a.id);
        saveGame();
    }
    return q.helpers.map(id => game.alumni.find(a => a.id === id)).filter(Boolean);
}
// 卒業生が育つ（rate はその能力の成長率に対する割合）
function growAlumnus(a, rate) {
    STATS.forEach(st => { a.stats[st.key] += st.growth * rate * (0.5 + Math.random()); fixOverflow(a, st.key); });
}
function growHelpers() { game.alumni.forEach(a => { if (a.tier && !isRetired(a)) growAlumnus(a, HELPER_YEAR_GROWTH); }); }
function renderQuestBar() {
    const q = game.quest;
    if (!q) { ui.questbar.hidden = true; return; }
    ui.questbar.hidden = false;
    const left = q.days.filter(d => d > game.day);
    ui.questbar.innerHTML = `${icon('skull')}<span>討伐の依頼: <b>${esc(q.boss)}</b>（${QUEST_LEVELS[q.level].name}）期限まで ${q.deadline - game.day} 日。</span><span class="muted">${left.length ? `討伐のマス: ${left.map(d => `${dateOf(d).getMonth() + 1}/${dateOf(d).getDate()}`).join('・')}` : 'もう討伐のマスが残っていない'}</span>`;
}
// 戦った生徒は少し伸びる
function battleGrowth(s, win) {
    const keys = shuffle(['hp', 'atk', 'mag', 'def', 'mdef', 'aspd', 'mspd']).slice(0, 2);
    keys.forEach(k => addStat(s, k, (rand(1, 3) + (win ? 1 : 0)) * potentialOf(s).growth * (JOB_BY_KEY[s.hope].favor.includes(k) ? HOPE_GROWTH : 1)));
    if (Math.random() < 0.3) addStat(s, pick(['crit', 'ppen', 'mpen', 'ten']), 0.5);
    if (Math.random() < 0.3) addStat(s, pick(['critdmg', 'plet', 'mlet']), 1);
    return keys;
}
function afterMatch(r) {
    const p = game.pending;
    const team = r.units.map(u => game.students.find(s => s.id === u.studentId)).filter(Boolean);
    team.forEach(s => { battleGrowth(s, r.win); s.fatigue += p.mode === 'small' ? 8 : 10; s.mood += r.win ? 5 : -5; normalizeStudent(s); });
    refillHand();
    if (p.mode === 'quest') { finishQuest(p, r.win, team); return; }
    if (p.mode === 'small') {
        if (r.win) {
            const gold = rand(20, 50) + Math.floor(game.day / 10);
            game.gold += gold; game.fame += 1;
            team.forEach(s => { s.renown = (s.renown || 0) + RENOWN.small; });
            game.message = `小さな戦いに勝った。${gold} ゴールド、知名度 +1。戦った生徒の能力が少し伸びた。`;
        } else {
            game.message = '小さな戦いに負けた。生徒たちは悔しそうだ。';
        }
        game.pending = null;
        saveGame(); render(); return;
    }
    // 大会
    if (r.win) {
        team.forEach(s => { s.wins++; s.renown = (s.renown || 0) + RENOWN.win * (p.key === 'team' ? RENOWN.team : 1); });
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
    if (wins === 4) team.forEach(s => { s.renown = (s.renown || 0) + RENOWN.title * (p.key === 'team' ? RENOWN.team : 1); s.titles = (s.titles || 0) + 1; });
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
        body: `<p>希望の職業: <b>${JOB_BY_KEY[s.hope].name}</b>　総合力 ${powerText(s)}　大会の勝ち ${s.wins}　技 ${s.skills.length}</p>
            <p>${renownLine(s)}</p>
            <p class="muted">職業の要件: その職業で見る能力の評価の平均が ${RANK_NAMES[JOB_NEED_RANK]} 以上ならなれる。</p>
            ${reqRows(s)}<p>${note}</p>`,
        buttons: ok.map(j => {
            const t = renownTier(s.renown || 0, power(s));
            const shown = jobTitle({ job: j.key, tier: t });
            return { label: `${icon('cap')}${shown}${t ? `（${j.name}）` : ''}${j.key === s.hope ? '・希望' : ''}として卒業`, primary: j.key === s.hope || ok.length === 1, onClick: () => graduate(s, j) };
        }),
    });
}
function graduate(s, job) {
    const p = game.pending;
    const tier = renownTier(s.renown || 0, power(s));
    const a = {
        id: s.id, name: s.name, year: game.year, job: job.key, hope: s.hope, wins: s.wins, titles: s.titles || 0,
        renown: Math.round((s.renown || 0) * 10) / 10, tier, potential: s.potential || 'normal',
        power: Math.round(power(s)), rank: powerRank(s), stats: { ...s.stats }, gradStats: { ...s.stats }, skills: s.skills.slice(), helped: 0,
    };
    game.alumni.push(a);
    if (tier === 'hero' && !game.firstHero) { game.firstHero = { year: game.year, name: s.name, id: s.id }; p.firstHero = true; }
    game.students = game.students.filter(x => x.id !== s.id);
    game.lastParty = game.lastParty.filter(id => id !== s.id);
    p.queue = p.queue.filter(id => id !== s.id);
    p.done.push({ name: s.name, job: job.key, hope: s.hope, tier });
    saveGame(); render();
}
function finishGraduation() {
    const p = game.pending;
    const tierNote = d => d.tier === 'hero' ? ' <b class="hero-tag">勇者に認定</b>' : d.tier === 'elite' ? ' <b class="elite-tag">英傑録に載った</b>' : '';
    const list = p.done.map(d => `<li><b>${esc(d.name)}</b>　${jobTitle(d)}${d.tier ? `（${JOB_BY_KEY[d.job].name}）` : ''}${d.job === d.hope ? '・希望どおり' : `・希望は ${JOB_BY_KEY[d.hope].name}`}${tierNote(d)}</li>`).join('');
    game.message = `卒業式。${p.done.map(d => `${d.name}（${jobTitle(d)}）`).join('、')} が卒業した。`;
    const after = p.then ? { kind: p.then } : null;
    game.pending = { kind: 'notice', title: '卒業式', html: `<p>${p.done.length} 人が卒業していった。</p><ul class="plain">${list}</ul><p class="muted">卒業生は「歴史」で見られる。名声が高い卒業生は英傑録に載る。</p>`, nextPending: after };
    if (p.firstHero) {
        const a = game.alumni.find(x => x.id === game.firstHero.id);
        game.pending.nextPending = {
            kind: 'notice', title: '初めての勇者', hero: true, nextPending: after,
            html: `<p class="hero-big">${esc(a.name)} が勇者に認定された</p>
                <p>ダイスアカデミーから、初めての勇者が生まれた。開校から ${game.year} 年目のことだった。</p>
                <table class="tbl"><tr><th>職業</th><td>${JOB_BY_KEY[a.job].name}</td></tr><tr><th>名声</th><td>${fmtRenown(a.renown)}</td></tr>
                <tr><th>総合力</th><td>${a.power}（${RANK_NAMES[a.rank]}）</td></tr><tr><th>大会の優勝</th><td>${a.titles} 回</td></tr><tr><th>大会の勝ち</th><td>${a.wins}</td></tr></table>
                <p class="muted">学園の歴史と英傑録に残る。このまま次の年も続けられる。</p>`,
        };
    }
    saveGame(); render();
}
function openYearEnd() {
    // 卒業式を迎えずに修了式に来た 3 年生（古いセーブなど）は、先に卒業させる
    if (game.students.some(s => s.grade >= 3)) { startGraduation('yearend'); saveGame(); render(); return; }
    const rows = game.students.slice().sort((a, b) => b.grade - a.grade || a.id - b.id).map(s => `<tr><td>${esc(s.name)}</td><td>${s.grade}年 → ${s.grade + 1}年</td><td>${JOB_BY_KEY[s.hope].name}</td><td>${powerText(s)}</td><td>${s.wins}</td></tr>`).join('');
    const recs = game.records.filter(r => r.year === game.year).map(r => `<li>${esc(r.name)}: ${esc(r.result)}</li>`).join('');
    const grads = game.alumni.filter(a => a.year === game.year).map(a => `${esc(a.name)}（${jobTitle(a)}）`).join('、');
    showDialog({
        title: `${game.year}年目が終わりました`, wide: true,
        body: `<p>知名度 ${game.fame}　所持金 ${game.gold} ゴールド</p>
            ${recs ? `<h3>今年の大会</h3><ul class="plain">${recs}</ul>` : ''}
            ${grads ? `<h3>今年の卒業生</h3><p>${grads}</p>` : ''}
            <h3>進級する生徒</h3>${rows ? `<table class="tbl"><tr><th>名前</th><th>学年</th><th>希望</th><th>総合力</th><th>大会の勝ち</th></tr>${rows}</table>` : '<p class="muted">いない。</p>'}
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
    game.quest = null;
    game.questCount = 0;
    growHelpers();
    selected = null;
    refillHand();
    game.message = `${game.year}年目が始まった。今日は入学式です。`;
    resolveSquare(1);
}
function openAlumni(tab = 'roster') {
    const years = [...new Set([...game.alumni.map(a => a.year), ...game.records.map(r => r.year)])].sort((a, b) => b - a);
    const yearly = years.map(y => {
        const recs = game.records.filter(r => r.year === y);
        const al = game.alumni.filter(a => a.year === y);
        return `<h3>${y}年目</h3>
            ${recs.length ? `<p>大会: ${recs.map(r => `${esc(r.name)} ${esc(r.result)}`).join('、')}</p>` : ''}
            ${al.length ? `<table class="tbl"><tr><th>卒業生</th><th>職業</th><th>希望</th><th>総合力</th><th>名声</th></tr>${al.map(a => `<tr><td>${esc(a.name)}</td><td><b>${jobTitle(a)}</b></td><td>${JOB_BY_KEY[a.hope].name}</td><td>${a.power}（${RANK_NAMES[a.rank || 0]}）</td><td>${fmtRenown(a.renown || 0)}</td></tr>`).join('')}</table>` : ''}`;
    }).join('') || '<p class="muted">まだ記録がない。大会の結果と、3 月 20 日の卒業式で卒業した生徒がここに残る。</p>';
    const listed = game.alumni.filter(a => a.tier).sort((x, y) => (y.tier === 'hero') - (x.tier === 'hero') || y.year - x.year || y.renown - x.renown);
    const roster = listed.length ? `<div class="roster">${listed.map(a => `<div class="ros ${a.tier === 'hero' ? 'hero' : ''}">
            <span class="ros-mark">${icon(a.tier === 'hero' ? 'crown' : 'star')}</span>
            <span class="ros-main"><b>${esc(a.name)}</b> <span class="ros-title">${jobTitle(a)}</span>${a.tier === 'hero' ? `<small>（${JOB_BY_KEY[a.job].name}）</small>` : ''}<br>
            <small>${a.year}年目に卒業・名声 ${fmtRenown(a.renown)}・卒業時の総合力 ${a.power}（${RANK_NAMES[a.rank || 0]}）・今の総合力 ${Math.round(power(a))}・優勝 ${a.titles || 0} 回・助っ人 ${a.helped || 0} 回${isRetired(a) ? '・引退' : ''}</small></span></div>`).join('')}</div>`
        : `<p class="muted">まだ誰も載っていない。在学中に名声 ${ROSTER_RENOWN} 以上を集めて卒業すると載る。</p>`;
    const seg = (k, l) => `<button class="seg ${tab === k ? 'on' : ''}" data-tab="${k}" aria-pressed="${tab === k}">${l}</button>`;
    showDialog({
        title: '学園の歴史', wide: true,
        body: `<div class="segs">${seg('roster', '英傑録')}${seg('years', '年ごとの記録')}</div><div class="hist-body">${tab === 'roster'
            ? `<p class="muted">名声の高い卒業生が載り、職業は上位の名で呼ばれる（${JOBS.map(j => `${j.name} → ${ELITE_NAMES[j.key]}`).join('、')}、村人 → ${ELITE_NAMES.villager}）。名声 ＋ 総合力が ${HERO_SUM} 以上で卒業すると勇者になる。英傑録の卒業生は、魔物討伐の助っ人に呼べる（卒業から ${HELPER_RETIRE} 年で引退）。</p>${roster}`
            : yearly}</div>`,
        onOpen: () => ui.dlgBody.querySelectorAll('.seg[data-tab]').forEach(el => el.addEventListener('click', () => openAlumni(el.dataset.tab))),
    });
}
function openStudent(id) {
    const s = game.students.find(x => x.id === id);
    if (!s) return;
    const rows = STATS.map(st => {
        const v = s.stats[st.key];
        return `<div class="srow ${s.talent.includes(st.key) ? 'talent' : ''}"><span>${st.name}${s.talent.includes(st.key) ? ' <small>得意</small>' : ''}</span><b>${fmtStat(st.key, v)}</b>${rankTag(statGrade(st.key, v))}</div>`;
    }).join('');
    showDialog({
        title: `${s.name}（${s.grade}年）`, wide: true,
        body: `<p class="power-line">総合力 <b class="power-num">${Math.round(power(s))}</b> <span class="rank r${powerRank(s)}">${RANK_NAMES[powerRank(s)]}</span></p>
            <p>希望の職業: <b>${JOB_BY_KEY[s.hope].name}</b>　素質: ${potentialTag(s)}　疲れ ${s.fatigue}　やる気 ${s.mood}　大会の勝ち ${s.wins}</p>
            <p>${renownLine(s)}</p><div class="stats"><div class="srow head"><span>能力</span><span>能力値</span><span>評価</span></div><div class="srow head"><span>能力</span><span>能力値</span><span>評価</span></div>${rows}</div>
            <p class="muted">能力値は戦いで使う実際の数。評価は、その能力の伸びやすさに合わせて付けた段階（E・D・C・B・A・S と + −）で、どの能力も同じ物差し。総合力は 16 の能力の評価の平均（E 0〜・D 100〜・C 200〜・B 300〜・A 400〜・S 500〜）。</p>
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
        if ((p.saveVersion || 1) < 6) migrateTo5();
        if ((p.saveVersion || 1) < 7) migrateTo7();
        if ((p.saveVersion || 1) < 8) migrateTo8();
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
// v0.6 までのセーブ: 卒業生の総合力を今の物差しで計算し直す
function migrateTo5() {
    game.alumni.forEach(a => { fillStats(a.stats); a.power = Math.round(power(a)); a.rank = powerRank(a); });
}
// v0.7 までのセーブ: 素質と名声を足し、卒業生の英傑録入りを決める
function migrateTo7() {
    game.students.forEach(s => { if (!s.potential) s.potential = 'normal'; if (typeof s.renown !== 'number') s.renown = s.wins || 0; });
    game.alumni.forEach(a => { if (typeof a.renown !== 'number') a.renown = a.wins || 0; if (a.tier === undefined) a.tier = renownTier(a.renown, a.power); });
    if (game.firstHero === undefined) { const h = game.alumni.find(a => a.tier === 'hero'); game.firstHero = h ? { year: h.year, name: h.name, id: h.id } : null; }
}
// v0.8 までのセーブ: 名声を 5 倍の整数にし、卒業時のデータを残す
function migrateTo8() {
    game.students.forEach(s => { s.renown = Math.round((s.renown || 0) * 5); });
    game.alumni.forEach(a => { a.renown = Math.round((a.renown || 0) * 5); if (!a.gradStats) a.gradStats = { ...a.stats }; if (a.helped === undefined) a.helped = 0; });
    if (game.quest === undefined) game.quest = null;
    if (game.questCount === undefined) game.questCount = 0;
}
function fullReset() {
    if (!confirm('今までのデータを消して、最初からやり直しますか？（元に戻せません）')) return;
    resetting = true;
    [SAVE_KEY, SAVE_KEY + '_corrupted'].forEach(k => localStorage.removeItem(k));
    location.reload();
}

// ---------- 起動 ----------
function init() {
    ['date', 'fame', 'gold', 'next', 'strip', 'branch', 'questbar', 'students', 'hand', 'specials', 'handbar', 'go', 'goInfo', 'handLabel', 'message', 'dlg', 'dlgTitle', 'dlgBody', 'dlgButtons', 'toast', 'version']
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
