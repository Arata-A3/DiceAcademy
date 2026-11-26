// 戦い（行動ゲージ制の自動戦闘）
'use strict';

// ---------- 技 ----------
// kind: phys 物理攻撃 / mag 魔法攻撃 / heal 回復 / selfheal 自分を回復 / buff 強化 / debuff 弱体
const SKILLS = {
    bash: { name: '強打', mp: 10, cd: 3, kind: 'phys', mult: 1.6, desc: '物理 1.6 倍' },
    twin: { name: '連続斬り', mp: 18, cd: 4, kind: 'phys', mult: 0.9, hits: 2, desc: '物理 0.9 倍を 2 回' },
    taunt: { name: '挑発', mp: 8, cd: 5, kind: 'buff', self: true, buff: { type: 'taunt', value: 1, left: 3 }, desc: '3 行動のあいだ敵の攻撃を引きつける' },
    wall: { name: '鉄壁', mp: 15, cd: 6, kind: 'buff', self: true, buff: { type: 'guard', value: 0.5, left: 3 }, desc: '3 行動のあいだ受けるダメージ半分' },
    fire: { name: '火の玉', mp: 14, cd: 3, kind: 'mag', mult: 1.7, desc: '魔法 1.7 倍' },
    storm: { name: '雷の雨', mp: 30, cd: 5, kind: 'mag', mult: 0.9, all: true, desc: '敵全体に魔法 0.9 倍' },
    heal: { name: '癒しの光', mp: 14, cd: 3, kind: 'heal', mult: 1.4, desc: '味方 1 人を回復' },
    bless: { name: '祝福の光', mp: 32, cd: 6, kind: 'heal', mult: 0.8, all: true, desc: '味方全体を回復' },
    dash: { name: '突進', mp: 8, cd: 3, kind: 'phys', mult: 1.2, gaugeBack: 50, desc: '物理 1.2 倍。次の行動が早くなる' },
    gale: { name: '疾風', mp: 14, cd: 6, kind: 'buff', self: true, buff: { type: 'haste', value: 0.4, left: 4 }, desc: '4 行動のあいだゲージが 4 割早くたまる' },
    expose: { name: '弱点を見抜く', mp: 12, cd: 5, kind: 'debuff', buff: { type: 'armorDown', value: 0.35, left: 3 }, desc: '敵 1 体の防御を 3 行動のあいだ 35% 下げる' },
    command: { name: '作戦指示', mp: 24, cd: 7, kind: 'buff', allAllies: true, gauge: 40, desc: '味方全員のゲージを 40 進める' },
    quick: { name: '早撃ち', mp: 6, cd: 2, kind: 'phys', mult: 0.8, gaugeBack: 50, desc: '物理 0.8 倍。次の行動が早くなる' },
    volley: { name: '乱れ撃ち', mp: 20, cd: 4, kind: 'phys', mult: 0.6, hits: 3, randomTarget: true, desc: '物理 0.6 倍を 3 回（狙いはばらばら）' },
    pierce: { name: '急所突き', mp: 10, cd: 3, kind: 'phys', mult: 1.2, crit: true, desc: '物理 1.2 倍。必ず会心' },
    lethal: { name: '致命の一撃', mp: 22, cd: 5, kind: 'phys', mult: 2.2, critBonus: 30, desc: '物理 2.2 倍。会心しやすい' },
    crush: { name: '鎧砕き', mp: 12, cd: 3, kind: 'phys', mult: 1.3, pen: 30, desc: '物理 1.3 倍。防御を 30% 無視' },
    stun: { name: '気絶打ち', mp: 16, cd: 5, kind: 'phys', mult: 0.8, stun: 2, desc: '物理 0.8 倍。相手を気絶させる' },
    focus: { name: '気合い', mp: 10, cd: 5, kind: 'selfheal', ratio: 0.2, desc: '自分の体力を 2 割回復し、気絶を解く' },
    endure: { name: '不屈', mp: 20, cd: 99, kind: 'buff', self: true, buff: { type: 'endure', value: 1, left: 99 }, desc: '一度だけ、倒れずに体力 1 で耐える' },
};
// 練習の種類ごとに覚える技（順番に覚える）
const SKILL_LINES = {
    sword: ['bash', 'twin'], shield: ['taunt', 'wall'], magic: ['fire', 'storm'], ward: ['heal', 'bless'], run: ['dash', 'gale'],
    study: ['expose', 'command'], swing: ['quick', 'volley'], vital: ['pierce', 'lethal'], spar: ['crush', 'stun'], mind: ['focus', 'endure'],
};
// 希望の職業ごとの、最初に覚えている技の系統
const JOB_LINE = { warrior: 'sword', knight: 'shield', mage: 'magic', priest: 'ward', hunter: 'swing', thief: 'vital' };

const TACTICS = {
    attack: { name: '攻める', desc: '弱った敵から狙い、攻撃の技を優先' },
    balance: { name: 'ばらんす', desc: '状況に合わせて戦う' },
    guard: { name: '守る', desc: '早めに回復し、守りの技を優先' },
    magic: { name: '魔法中心', desc: '魔法の技を優先して使う' },
};

// ---------- 魔物 ----------
const MONSTERS = [
    { name: 'スライム', from: 0, w: { hp: 1.2, atk: 0.7, def: 0.6, mdef: 0.5, aspd: 0.6, mspd: 0.5 }, skills: [] },
    { name: 'ゴブリン', from: 0, w: { atk: 1.0, aspd: 1.0, mspd: 1.1, def: 0.7 }, skills: ['quick'] },
    { name: '大コウモリ', from: 30, w: { hp: 0.6, mspd: 1.5, aspd: 1.4, atk: 0.8 }, skills: ['quick'] },
    { name: '森オオカミ', from: 60, w: { atk: 1.1, aspd: 1.3, mspd: 1.3, crit: 1.5 }, skills: ['bash'] },
    { name: 'ガイコツ兵', from: 120, w: { def: 1.3, atk: 1.0, mdef: 0.6 }, skills: ['crush'] },
    { name: '小悪魔', from: 150, w: { mag: 1.3, mp: 1.2, mdef: 1.1, def: 0.7 }, skills: ['fire'] },
    { name: '大イノシシ', from: 200, w: { hp: 1.5, atk: 1.2, def: 1.0, aspd: 0.7 }, skills: ['dash', 'stun'] },
    { name: '森の魔女', from: 250, w: { mag: 1.4, mp: 1.3, mdef: 1.2, hp: 0.8 }, skills: ['fire', 'storm'] },
];
const RIVAL_SCHOOLS = ['北の騎士学院', '湖の魔法学舎', '港町の武術館', '王都の兵学校', '山の修道院'];

// ---------- 戦う者を作る ----------
function enemyLevel(day) { return 38 + day * 0.16; }
// 大会の相手の強さ（rookie は 1 年生どうし）
function rivalLevel(day, rookie) { return (rookie ? 30 : 72) + day * 0.15; }
function statsFromWeights(level, w = {}) {
    const st = {};
    STATS.forEach(s => {
        const k = w[s.key] !== undefined ? w[s.key] : 1;
        if (s.key === 'crit') st.crit = clamp(5 * k + level * 0.04, 0, 100);
        else if (s.key === 'ppen' || s.key === 'mpen') st[s.key] = clamp(level * 0.04 * k, 0, 100);
        else if (s.key === 'ten') st.ten = clamp(level * 0.05 * k, 0, 100);
        else if (s.key === 'critdmg') st.critdmg = Math.round(150 + level * 0.08 * k);
        else if (s.key === 'plet' || s.key === 'mlet') st[s.key] = Math.round(level * 0.04 * k);
        else st[s.key] = Math.round(level * k * (0.9 + Math.random() * 0.2));
    });
    return st;
}
function makeMonsters(day) {
    const pool = MONSTERS.filter(m => m.from <= day);
    const n = Math.random() < 0.5 ? 2 : 3;
    const lv = enemyLevel(day) * (n === 3 ? 1.05 : 1.3);
    return Array.from({ length: n }, () => { const m = pick(pool); return { name: m.name, stats: statsFromWeights(lv, m.w), skills: m.skills.slice() }; });
}
// 討伐の相手: ボス 1 体と手下
function makeQuestEnemies(q, day) {
    const boss = QUEST_BOSSES.find(b => b.name === q.boss) || QUEST_BOSSES[0];
    const lv = enemyLevel(day) * QUEST_LEVELS[q.level].lv;
    const pool = MONSTERS.filter(m => m.from <= day);
    const minions = Array.from({ length: q.level + 1 }, () => { const m = pick(pool); return { name: m.name, stats: statsFromWeights(lv * 0.8, m.w), skills: m.skills.slice() }; });
    return [{ name: boss.name, stats: statsFromWeights(lv * 1.4, boss.w), skills: boss.skills.slice(), sub: 'ボス' }, ...minions];
}
function makeRival(day, strength, onlyJobs, rookie) {
    const job = pick(onlyJobs ? JOBS.filter(j => onlyJobs.includes(j.key)) : JOBS);
    const w = {}; job.favor.forEach(k => { w[k] = 1.35; });
    const line = SKILL_LINES[JOB_LINE[job.key]];
    const skills = rookie ? [] : day > 150 ? line.slice() : line.slice(0, 1);
    return { name: pick(NAMES), stats: statsFromWeights(rivalLevel(day, rookie) * strength, w), skills, job: job.name };
}
function makeUnit(src, side, idx) {
    const s = src.stats;
    const maxHp = Math.round(80 + s.hp * 2.5);
    const maxMp = Math.round(20 + s.mp);
    return {
        uid: `${side}${idx}`, side, name: src.name, sub: src.sub || '', studentId: src.id || null, look: src.look || null, job: src.hope || src.job || null,
        stats: s, maxHp, hp: maxHp, maxMp, mp: maxMp,
        skills: (src.skills || []).map(id => ({ id, cd: 0 })),
        gauge: clamp(s.mspd * 0.35, 0, 80) + Math.random() * 15,
        buffs: [], stunned: 0, dealt: 0, healed: 0,
    };
}

// ---------- 戦いの計算 ----------
let battle = null;   // 今の戦い

function alive(units) { return units.filter(u => u.hp > 0); }
function buffVal(u, type) { return u.buffs.filter(b => b.type === type).reduce((a, b) => a + b.value, 0); }
function speedOf(u) { return (8 + u.stats.aspd * 0.12) * (1 + buffVal(u, 'haste')); }
function sideUnits(side) { return side === 'A' ? battle.allies : battle.enemies; }
function foesOf(u) { return alive(u.side === 'A' ? battle.enemies : battle.allies); }
function friendsOf(u) { return alive(sideUnits(u.side)); }

// 次に動く者（ゲージが 100 にいちばん早く届く者）
function nextActor(units = [...battle.allies, ...battle.enemies]) {
    let best = null, bestT = Infinity;
    alive(units).forEach(u => { const t = Math.max(0, 100 - u.gauge) / speedOf(u); if (t < bestT) { bestT = t; best = u; } });
    return { unit: best, t: bestT };
}
function advance(t) { alive([...battle.allies, ...battle.enemies]).forEach(u => { u.gauge += speedOf(u) * t; }); }
// 次に動く順（予想）。行動による変化は考えない
function predictOrder(count = 7) {
    const sim = alive([...battle.allies, ...battle.enemies]).map(u => ({ u, g: u.gauge, sp: speedOf(u) }));
    const out = [];
    for (let k = 0; k < count && sim.length; k++) {
        let best = null, bestT = Infinity;
        sim.forEach(x => { const t = Math.max(0, 100 - x.g) / x.sp; if (t < bestT) { bestT = t; best = x; } });
        sim.forEach(x => { x.g += x.sp * bestT; });
        best.g -= 100;
        out.push(best.u);
    }
    return out;
}

function pickTarget(actor, foes) {
    const taunters = foes.filter(f => buffVal(f, 'taunt') > 0);
    if (taunters.length && Math.random() < 0.75) return pick(taunters);
    if (battle.tactics[actor.side] === 'attack' || Math.random() < 0.35) return foes.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    return pick(foes);
}
function chooseAction(u) {
    const tactic = battle.tactics[u.side];
    const usable = u.skills.filter(s => s.cd <= 0 && u.mp >= SKILLS[s.id].mp).map(s => ({ ...SKILLS[s.id], id: s.id }));
    const friends = friendsOf(u), foes = foesOf(u);
    const healAt = tactic === 'guard' ? 0.7 : tactic === 'magic' ? 0.6 : 0.5;
    const hurt = friends.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    const heal = usable.filter(s => s.kind === 'heal').sort((a, b) => (b.all ? 1 : 0) - (a.all ? 1 : 0));
    if (heal.length && hurt && hurt.hp / hurt.maxHp < healAt) {
        const many = friends.filter(f => f.hp / f.maxHp < healAt).length >= 2;
        const s = heal.find(h => h.all === many) || heal[0];
        return { skill: s, target: hurt };
    }
    const self = usable.find(s => s.kind === 'selfheal');
    if (self && (u.hp / u.maxHp < 0.45 || u.stunned)) return { skill: self, target: u };
    const endure = usable.find(s => s.id === 'endure');
    if (endure && u.hp / u.maxHp < 0.5 && !buffVal(u, 'endure')) return { skill: endure, target: u };
    const buffs = usable.filter(s => s.kind === 'buff' && s.id !== 'endure' && (s.allAllies || !buffVal(u, s.buff.type)));
    const buffChance = tactic === 'guard' ? 0.8 : tactic === 'attack' ? 0.25 : 0.45;
    if (buffs.length && Math.random() < buffChance) return { skill: pick(buffs), target: u };
    const debuff = usable.find(s => s.kind === 'debuff');
    if (debuff) { const t = foes.find(f => !buffVal(f, 'armorDown')); if (t && Math.random() < 0.6) return { skill: debuff, target: t }; }
    let atk = usable.filter(s => s.kind === 'phys' || s.kind === 'mag');
    if (tactic === 'magic' && atk.some(s => s.kind === 'mag')) atk = atk.filter(s => s.kind === 'mag');
    if (atk.length) {
        const score = s => s.mult * (s.hits || 1) * (s.all ? foes.length : 1) * (s.kind === 'mag' ? u.stats.mag : u.stats.atk);
        const s = atk.sort((a, b) => score(b) - score(a))[0];
        if (tactic === 'attack' || tactic === 'magic' || Math.random() < 0.8) return { skill: s, target: pickTarget(u, foes) };
    }
    return { skill: null, target: pickTarget(u, foes) };
}

function hitOnce(actor, target, sk) {
    const magic = sk && sk.kind === 'mag';
    const ev = { target: target.uid, name: target.name };
    // よける（移動速度の差。最大 30%）
    const dodge = clamp(0.05 + (target.stats.mspd - actor.stats.mspd) / 1000, 0, 0.3);
    if (Math.random() < dodge) { ev.miss = true; return ev; }
    let power = (magic ? actor.stats.mag : actor.stats.atk) * (sk ? sk.mult : 1);
    if (battle.mods) power *= magic ? (battle.mods.mag || 1) : (battle.mods.phys || 1);
    // 防御 ×（1 − 貫通率）− 貫通力。貫通率の 100% を超えた分と、防御を引き切って余った貫通力は、ダメージを増やす
    const penPct = Math.max(0, (magic ? actor.stats.mpen : actor.stats.ppen) + (sk && sk.pen ? sk.pen : 0));
    const penFlat = Math.max(0, magic ? actor.stats.mlet : actor.stats.plet);
    let defense = (magic ? target.stats.mdef : target.stats.def) * (1 - buffVal(target, 'armorDown'));
    defense = defense * (1 - Math.min(penPct, 100) / 100) - penFlat;
    let dmg = defense >= 0 ? power * 100 / (100 + defense * 0.5) : power * (1 - defense * LET_OVER_RATE / 100);
    if (penPct > 100) dmg *= 1 + (penPct - 100) * PEN_OVER_RATE / 100;
    const critRate = magic ? 0 : (sk && sk.crit ? 100 : actor.stats.crit + (sk && sk.critBonus ? sk.critBonus : 0));
    if (Math.random() * 100 < critRate) { dmg *= Math.max(100, actor.stats.critdmg) / 100; ev.crit = true; }
    dmg *= 1 - clamp(buffVal(target, 'guard'), 0, 0.8);
    dmg *= 0.9 + Math.random() * 0.2;
    dmg = Math.max(1, Math.round(dmg));
    target.hp -= dmg;
    actor.dealt += dmg;
    ev.dmg = dmg;
    if (target.hp <= 0 && buffVal(target, 'endure')) {
        target.hp = 1; target.buffs = target.buffs.filter(b => b.type !== 'endure'); ev.endured = true;
    }
    if (target.hp <= 0) { target.hp = 0; ev.down = true; }
    else if (sk && sk.stun) {
        const turns = Math.round(sk.stun * (1 - clamp(target.stats.ten, 0, 100) / 100));
        if (turns > 0) { target.stunned = Math.max(target.stunned, turns); ev.stun = turns; }
    }
    return ev;
}

// 1 回の行動を進める。戦いが終わったら true
function battleStep() {
    if (battle.over) return true;
    const { unit: u, t } = nextActor();
    advance(t);
    u.gauge -= 100;
    battle.turns++;
    const entry = { actor: u.uid, side: u.side, text: '', hits: [] };
    // 強化の残りを減らす（自分の行動ごと）
    u.buffs.forEach(b => { b.left--; });
    u.buffs = u.buffs.filter(b => b.left > 0);
    u.skills.forEach(s => { if (s.cd > 0) s.cd--; });
    u.mp = Math.min(u.maxMp, u.mp + 2 + u.maxMp * 0.04);

    if (u.stunned > 0) {
        u.stunned--;
        entry.text = `${u.name} は気絶して動けない`;
    } else {
        const { skill: sk, target } = chooseAction(u);
        if (sk) {
            u.mp -= sk.mp;
            const own = u.skills.find(s => s.id === sk.id);
            own.cd = Math.ceil(sk.cd * 100 / (100 + u.stats.haste));
        }
        const label = sk ? sk.name : '攻撃';
        if (!sk || sk.kind === 'phys' || sk.kind === 'mag') {
            const foes = foesOf(u);
            const hits = sk && sk.hits ? sk.hits : 1;
            const targets = sk && sk.all ? foes : null;
            if (targets) targets.forEach(f => entry.hits.push(hitOnce(u, f, sk)));
            else for (let h = 0; h < hits; h++) {
                const live = foesOf(u); if (!live.length) break;
                const tg = sk && sk.randomTarget ? pick(live) : (target.hp > 0 ? target : pickTarget(u, live));
                entry.hits.push(hitOnce(u, tg, sk));
            }
            if (sk && sk.gaugeBack) u.gauge += sk.gaugeBack;
            const parts = entry.hits.map(h => h.miss ? `${h.name} はよけた` : `${h.name} に ${h.dmg}${h.crit ? '（会心）' : ''}${h.endured ? '（耐えた）' : ''}${h.stun ? '（気絶）' : ''}`);
            entry.text = `${u.name} の ${label}！ ${parts.join('、')}`;
        } else if (sk.kind === 'heal') {
            const tgs = sk.all ? friendsOf(u) : [target];
            const parts = tgs.map(f => {
                const amt = Math.round(u.stats.mag * sk.mult + 12);
                const real = Math.min(amt, f.maxHp - f.hp); f.hp += real; u.healed += real;
                entry.hits.push({ target: f.uid, heal: real });
                return `${f.name} ${real}`;
            });
            entry.text = `${u.name} の ${label}！ 回復: ${parts.join('、')}`;
        } else if (sk.kind === 'selfheal') {
            const real = Math.min(Math.round(u.maxHp * sk.ratio), u.maxHp - u.hp); u.hp += real; u.stunned = 0;
            entry.hits.push({ target: u.uid, heal: real });
            entry.text = `${u.name} の ${label}！ 体力 ${real} 回復`;
        } else if (sk.kind === 'buff') {
            if (sk.allAllies) { friendsOf(u).forEach(f => { f.gauge += sk.gauge; }); entry.text = `${u.name} の ${label}！ 味方の動きが早まった`; }
            else { u.buffs.push({ ...sk.buff }); entry.text = `${u.name} の ${label}！`; }
        } else if (sk.kind === 'debuff') {
            target.buffs.push({ ...sk.buff });
            entry.text = `${u.name} の ${label}！ ${target.name} の守りが下がった`;
        }
    }
    battle.log.push(entry);
    battle.last = entry;
    const aDead = !alive(battle.allies).length, eDead = !alive(battle.enemies).length;
    if (aDead || eDead || battle.turns >= 400) {
        battle.over = true;
        if (aDead || eDead) battle.win = eDead && !aDead;
        else {
            const ratio = us => us.reduce((a, x) => a + x.hp / x.maxHp, 0) / us.length;
            battle.win = ratio(battle.allies) >= ratio(battle.enemies);
        }
    }
    return battle.over;
}

// ---------- 切り札 ----------
const TRUMPS = {
    rally: { name: '立て直し', desc: n => `味方全員の体力を ${n * 6}% 回復` },
    rush: { name: '総攻撃', desc: n => `味方全員のゲージを ${n * 15} 進める` },
    guard: { name: '守る', desc: n => `3 行動のあいだ受けるダメージ -${n * 6}%` },
};
function useTrump(kind, n) {
    if (battle.trumpUsed || battle.over) return;
    battle.trumpUsed = true;
    const allies = alive(battle.allies);
    if (kind === 'rally') allies.forEach(u => { u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * n * 0.06)); });
    if (kind === 'rush') allies.forEach(u => { u.gauge += n * 15; });
    if (kind === 'guard') allies.forEach(u => { u.buffs.push({ type: 'guard', value: n * 0.06, left: 3 }); });
    const entry = { actor: null, side: 'A', text: `監督の切り札「${TRUMPS[kind].name}」（${n}）！ ${TRUMPS[kind].desc(n)}`, hits: [], trump: true };
    battle.log.push(entry); battle.last = entry;
}

// ---------- 戦いの画面 ----------
const SPEEDS = { normal: 750, fast: 180 };
function startBattle(opts) {
    // opts: { title, allies: [student], enemies: [src], tactic, mods, onEnd(result) }
    battle = {
        title: opts.title, mods: opts.mods || null, onEnd: opts.onEnd,
        allies: opts.allies.map((s, i) => makeUnit({ ...s, sub: s.sub || `${s.grade}年`, skills: s.skills }, 'A', i)),
        enemies: opts.enemies.map((e, i) => makeUnit({ ...e, sub: e.job || e.sub || '' }, 'B', i)),
        tactics: { A: opts.tactic || 'balance', B: 'balance' },
        log: [], last: null, turns: 0, over: false, win: false, speed: 'normal', timer: null, trumpUsed: false, trumpCard: null,
    };
    const el = document.getElementById('battle');
    el.hidden = false;
    document.body.classList.add('in-battle');
    document.getElementById('b-title').textContent = opts.title;
    renderBattle();
    scheduleStep(900);
}
function scheduleStep(ms) {
    clearTimeout(battle.timer);
    battle.timer = setTimeout(() => {
        if (!battle) return;
        const over = battleStep();
        renderBattle();
        if (over) showBattleResult(); else scheduleStep(SPEEDS[battle.speed]);
    }, ms === undefined ? SPEEDS[battle.speed] : ms);
}
function skipBattle() {
    if (!battle || battle.over) return;
    clearTimeout(battle.timer);
    while (!battleStep()) { /* 最後まで計算する */ }
    renderBattle();
    showBattleResult();
}
function unitHTML(u, actingUid, hitMap) {
    const pct = v => `${Math.max(0, Math.min(100, v))}%`;
    const h = hitMap[u.uid];
    const pop = h ? (h.miss ? '<span class="pop miss">よけた</span>' : h.heal !== undefined ? `<span class="pop heal">+${h.heal}</span>` : `<span class="pop ${h.crit ? 'crit' : ''}">${h.dmg}${h.crit ? '!' : ''}</span>`) : '';
    const states = [];
    if (u.stunned) states.push('気絶');
    if (buffVal(u, 'guard')) states.push('守り');
    if (buffVal(u, 'taunt')) states.push('挑発');
    if (buffVal(u, 'haste')) states.push('疾風');
    if (buffVal(u, 'armorDown')) states.push('防御↓');
    if (buffVal(u, 'endure')) states.push('不屈');
    return `<div class="bu ${u.side === 'B' ? 'foe' : ''} ${u.hp <= 0 ? 'down' : ''} ${u.uid === actingUid ? 'acting' : ''}">
        ${pop}<div class="bu-nm">${u.look && typeof avatarSVG === 'function' ? `<span class="bu-face">${avatarSVG(u.look, u.job, { face: true })}</span>` : ''}<span>${esc(u.name)}</span><small>${esc(u.sub)}</small></div>
        <div class="bbar hp"><i style="width:${pct(u.hp / u.maxHp * 100)}"></i></div>
        <div class="bbar mp"><i style="width:${pct(u.mp / u.maxMp * 100)}"></i></div>
        <div class="bbar gg"><i style="width:${pct(u.gauge)}"></i></div>
        <div class="bu-num">${u.hp}/${u.maxHp}${states.length ? ` <em>${states.join('・')}</em>` : ''}</div></div>`;
}
function renderBattle() {
    if (!battle) return;
    const last = battle.last;
    const hitMap = {};
    if (last) last.hits.forEach(h => { hitMap[h.target] = h; });
    const acting = last ? last.actor : null;
    document.getElementById('b-allies').innerHTML = battle.allies.map(u => unitHTML(u, acting, hitMap)).join('');
    document.getElementById('b-enemies').innerHTML = battle.enemies.map(u => unitHTML(u, acting, hitMap)).join('');
    document.getElementById('b-order').innerHTML = battle.over ? '' : predictOrder(7).map((u, i) =>
        `<span class="ord ${u.side === 'B' ? 'foe' : ''} ${i === 0 ? 'first' : ''}" title="${esc(u.name)}">${esc(u.name.slice(0, 2))}</span>`).join('');
    const lines = battle.log.slice(-4);
    document.getElementById('b-log').innerHTML = lines.map((e, i) => `<div class="${i === lines.length - 1 ? 'new' : ''} ${e.side === 'B' ? 'foe' : ''} ${e.trump ? 'trump' : ''}">${esc(e.text)}</div>`).join('');
    // 切り札
    const tr = document.getElementById('b-trump');
    if (battle.trumpUsed || battle.over) {
        tr.innerHTML = `<span class="muted-l">${battle.trumpUsed ? '切り札は使った' : ''}</span>`;
    } else {
        const n = battle.trumpCard !== null ? game.hand[battle.trumpCard] : null;
        tr.innerHTML = `<span class="tl">切り札</span>` + game.hand.map((v, i) => `<button class="card mini ${battle.trumpCard === i ? 'sel' : ''}" data-i="${i}">${v}</button>`).join('') +
            `<span class="tbtns">${Object.entries(TRUMPS).map(([k, t]) => `<button class="btn tb" data-k="${k}" ${n === null ? 'disabled' : ''} title="${n !== null ? esc(t.desc(n)) : '先に札を選ぶ'}">${t.name}</button>`).join('')}</span>`;
        tr.querySelectorAll('.card').forEach(b => b.addEventListener('click', () => { battle.trumpCard = Number(b.dataset.i); renderBattle(); }));
        tr.querySelectorAll('.tb').forEach(b => b.addEventListener('click', () => {
            if (battle.trumpCard === null) return;
            const n2 = game.hand[battle.trumpCard];
            game.hand.splice(battle.trumpCard, 1);
            useTrump(b.dataset.k, n2);
            renderBattle();
        }));
    }
    document.querySelectorAll('#battle .spd').forEach(b => b.classList.toggle('on', b.dataset.spd === battle.speed));
}
function showBattleResult() {
    const res = document.getElementById('b-result');
    const all = battle.allies;
    const mvp = all.slice().sort((a, b) => (b.dealt + b.healed) - (a.dealt + a.healed))[0];
    res.innerHTML = `<div class="res-box"><p class="res-title ${battle.win ? 'win' : 'lose'}">${battle.win ? '勝利' : '敗北'}</p>
        <p>活躍: <b>${esc(mvp.name)}</b>（与えたダメージ ${mvp.dealt}${mvp.healed ? `・回復 ${mvp.healed}` : ''}）</p>
        <button class="btn primary" id="b-continue">続ける</button></div>`;
    res.hidden = false;
    document.getElementById('b-continue').addEventListener('click', endBattle);
}
function endBattle() {
    const b = battle;
    clearTimeout(b.timer);
    document.getElementById('b-result').hidden = true;
    document.getElementById('battle').hidden = true;
    document.body.classList.remove('in-battle');
    battle = null;
    const units = b.allies.map(u => ({ studentId: u.studentId, dealt: u.dealt, healed: u.healed, down: u.hp <= 0 }));
    b.onEnd({ win: b.win, units });
}
function initBattleUI() {
    document.querySelectorAll('#battle .spd').forEach(btn => btn.addEventListener('click', () => {
        if (!battle) return;
        if (btn.dataset.spd === 'skip') { skipBattle(); return; }
        battle.speed = btn.dataset.spd; renderBattle();
        if (!battle.over) scheduleStep();
    }));
}
