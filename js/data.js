// ゲームの決まった値（数値は仮。遊んで調整する）

// 能力 12 個。pct は割合の能力（% で表示し、上限あり）
const STATS = [
    { key: 'hp', name: '体力', short: '体', max: 999 },
    { key: 'mp', name: 'マナ', short: 'マ', max: 999 },
    { key: 'atk', name: '攻撃力', short: '攻', max: 999 },
    { key: 'mag', name: '魔力', short: '魔', max: 999 },
    { key: 'def', name: '物理防御', short: '防', max: 999 },
    { key: 'mdef', name: '魔法防御', short: '魔防', max: 999 },
    { key: 'aspd', name: '攻撃速度', short: '速', max: 999 },
    { key: 'mspd', name: '移動速度', short: '移', max: 999 },
    { key: 'crit', name: 'クリティカル率', short: '会', max: 100, pct: true },
    { key: 'haste', name: 'スキルヘイスト', short: 'ヘ', max: 999 },
    { key: 'pen', name: '防御貫通', short: '貫', max: 40, pct: true },
    { key: 'ten', name: '行動妨害耐性', short: '耐', max: 50, pct: true },
];
const STAT_BY_KEY = Object.fromEntries(STATS.map(s => [s.key, s]));

// 職業 6 つ。favor: 決まるときに見る能力（入学時の能力の偏りにも使う）
const JOBS = [
    { key: 'warrior', name: '戦士', favor: ['atk', 'hp'] },
    { key: 'knight', name: '騎士', favor: ['def', 'mdef', 'hp'] },
    { key: 'mage', name: '魔法使い', favor: ['mag', 'mp', 'haste'] },
    { key: 'priest', name: '僧侶', favor: ['mag', 'mdef', 'mp'] },
    { key: 'hunter', name: '狩人', favor: ['aspd', 'crit'] },
    { key: 'thief', name: '盗賊', favor: ['mspd', 'pen', 'crit'] },
];
const JOB_BY_KEY = Object.fromEntries(JOBS.map(j => [j.key, j]));

// 練習の種類。gains: 能力ごとの基本の伸び
const PRACTICES = [
    { key: 'sword', name: '剣術', gains: { atk: 6, aspd: 2 } },
    { key: 'shield', name: '盾の構え', gains: { def: 6, hp: 3 } },
    { key: 'magic', name: '魔法の授業', gains: { mag: 6, mp: 3 } },
    { key: 'ward', name: '結界の授業', gains: { mdef: 6, mp: 2 } },
    { key: 'run', name: '走り込み', gains: { hp: 6, mspd: 3 } },
    { key: 'study', name: '座学', gains: { haste: 5, mp: 3 } },
    { key: 'swing', name: '素振り', gains: { aspd: 5, atk: 2 } },
    { key: 'vital', name: '急所を狙う練習', gains: { crit: 2, atk: 2 } },
    { key: 'spar', name: '実戦形式', gains: { pen: 1, atk: 3, mag: 3 } },
    { key: 'mind', name: '精神修行', gains: { ten: 1.5, mdef: 3 } },
];
const PRACTICE_BY_KEY = Object.fromEntries(PRACTICES.map(p => [p.key, p]));

// マスの種類
const SQUARES = {
    practice: { name: '練習', color: 'var(--sq-practice)', icon: 'sword' },
    rest: { name: '休み', color: 'var(--sq-rest)', icon: 'moon' },
    event: { name: '出来事', color: 'var(--sq-event)', icon: 'alert' },
    shop: { name: '買い物', color: 'var(--sq-shop)', icon: 'bag' },
    treasure: { name: '宝', color: 'var(--sq-treasure)', icon: 'chest' },
    injury: { name: 'けが', color: 'var(--sq-injury)', icon: 'bandage' },
    fixed: { name: '行事', color: 'var(--sq-fixed)', icon: 'flag' },
};

// ふつうの日のマスの出やすさ
const SQUARE_WEIGHTS = { practice: 46, rest: 16, event: 16, shop: 8, treasure: 7, injury: 7 };
// 分かれ道の道ごとの出やすさ
const ROUTES = {
    training: { name: '訓練場の道', weights: { practice: 75, rest: 15, injury: 10 } },
    town: { name: '町の道', weights: { shop: 35, event: 40, rest: 20, treasure: 5 } },
    forest: { name: '森の道', weights: { treasure: 40, event: 20, injury: 25, practice: 15 } },
};

// 決まった日の行事（月, 日）
const FIXED_EVENTS = [
    { month: 4, day: 1, key: 'entrance', name: '入学式' },
    { month: 5, day: 20, key: 'rookie', name: '新人戦', tournament: true, desc: '1 年生だけの個人戦' },
    { month: 7, day: 20, key: 'sword', name: '剣技大会', tournament: true, desc: '物理が有利な個人戦' },
    { month: 12, day: 10, key: 'team', name: '学園対抗戦', tournament: true, desc: '4 人の団体戦' },
    { month: 3, day: 31, key: 'yearend', name: '修了式' },
];

// 特別な札
const SPECIAL_CARDS = {
    free: { name: '好きな目', desc: '1〜6 から好きな目を選んで進む' },
    stride: { name: '大股', desc: '書かれた目の 2 倍進む' },
    careful: { name: 'じっくり', desc: '書かれた目だけ進み、止まったマスの効果が 2 倍' },
    replan: { name: '予定変更', desc: '6 日先までのマスを 1 つ、好きな種類に変える（行事は変えられない）' },
};
const SPECIAL_PRICE = { free: 120, stride: 80, careful: 100, replan: 90 };
const MAX_SPECIAL = 3;

const NAMES = ['アレン', 'ミラ', 'ゴード', 'セナ', 'リオ', 'カイ', 'ノエル', 'ティア', 'ルカ', 'エマ', 'ジーク', 'ユナ',
    'ハル', 'リリ', 'ダン', 'フィオ', 'レン', 'サラ', 'オルト', 'ニナ', 'ベル', 'トマ', 'イリス', 'グレン', 'マオ', 'シエル'];

// 出来事。choices の run(g, s) は結果の文を返す。s は選ばれた生徒（いれば）
const EVENTS = [
    {
        text: s => `${s.name} が夜遅くまで自主練をしているのを見つけた。`, needStudent: true, choices: [
            { label: 'ほめて続けさせる', run: (g, s) => { s.fatigue += 15; addStat(s, randomStat(s), 8); return `${s.name} の能力が伸びた。少し疲れたようだ。`; } },
            { label: '休むように言う', run: (g, s) => { s.fatigue -= 15; s.mood += 10; return `${s.name} はしっかり休んで元気になった。`; } },
        ]
    },
    {
        text: () => '町の人から、畑を荒らす獣を追い払ってほしいと頼まれた。', choices: [
            { label: '引き受ける', run: g => { g.gold += 60; g.fame += 5; g.students.forEach(s => s.fatigue += 8); return '無事に追い払った。お礼に 60 ゴールド。知名度 +5。'; } },
            { label: '練習を優先する', run: g => { g.fame -= 2; return '断った。少し評判が下がった。知名度 -2。'; } },
        ]
    },
    {
        text: s => `${s.name} が「伸び悩んでいる」と相談に来た。`, needStudent: true, choices: [
            { label: '一緒に原因を考える', run: (g, s) => { s.mood += 20; return `${s.name} のやる気が上がった。`; } },
            { label: '厳しく鍛える', run: (g, s) => { s.fatigue += 20; addStat(s, s.talent[0], 10); return `${s.name} の得意な能力がぐっと伸びた。かなり疲れたようだ。`; } },
        ]
    },
    {
        text: () => '旅の商人が、古い兵法書を売りに来た（80 ゴールド）。', choices: [
            { label: '買う', run: g => { if (g.gold < 80) return 'お金が足りなかった。'; g.gold -= 80; g.students.forEach(s => addStat(s, 'haste', 3)); return '全員のスキルヘイストが少し上がった。'; } },
            { label: '見送る', run: () => '商人は去っていった。' },
        ]
    },
    {
        text: () => '雨で練習場が使えない。', choices: [
            { label: '座学にする', run: g => { g.students.forEach(s => addStat(s, 'haste', 2)); return '全員のスキルヘイストが少し上がった。'; } },
            { label: '休みにする', run: g => { g.students.forEach(s => { s.fatigue -= 20; }); return '全員の疲れが取れた。'; } },
        ]
    },
    {
        text: () => '卒業生から差し入れが届いた。', choices: [
            { label: 'みんなで食べる', run: g => { g.students.forEach(s => s.mood += 12); return '全員のやる気が上がった。'; } },
            { label: '売ってお金にする', run: g => { g.gold += 50; return '50 ゴールドになった。'; } },
        ]
    },
    {
        text: s => `${s.name} がほかの学園の生徒とけんかになりかけている。`, needStudent: true, choices: [
            { label: '止めに入る', run: (g, s) => { s.mood -= 5; return `${s.name} は不満そうだが、騒ぎにはならなかった。`; } },
            { label: '腕比べで決着させる', run: (g, s) => { const win = Math.random() < 0.55; if (win) { g.fame += 6; s.mood += 10; return `${s.name} が勝った。知名度 +6。`; } s.mood -= 10; s.fatigue += 10; return `${s.name} は負けてしまった。`; } },
        ]
    },
    {
        text: () => '王都の吟遊詩人が学園の噂を聞きに来た。', choices: [
            { label: '生徒の活躍を話す', run: g => { g.fame += 8; return '噂が広まった。知名度 +8。'; } },
            { label: '練習を見せる', run: g => { g.fame += 4; g.students.forEach(s => s.mood += 5); return '生徒たちは張り切った。知名度 +4。'; } },
        ]
    },
];
