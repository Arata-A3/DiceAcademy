// 生徒の見た目（キャラメイク）。SVG の部品を組み合わせて描く
'use strict';

// 部品の種類
const AVATAR_PARTS = {
    hair: [
        { key: 'short', name: 'ショート' }, { key: 'spiky', name: 'つんつん' }, { key: 'side', name: '流し前髪' }, { key: 'center', name: 'センター分け' },
        { key: 'buzz', name: '短髪' }, { key: 'bob', name: 'ボブ' }, { key: 'long', name: 'ロング' }, { key: 'wavy', name: 'ウェーブ' },
        { key: 'twin', name: 'ツインテール' }, { key: 'pony', name: 'ポニーテール' }, { key: 'braid', name: '三つ編み' }, { key: 'bun', name: 'おだんご' },
    ],
    eyes: [
        { key: 'round', name: 'まる' }, { key: 'sharp', name: 'つり目' }, { key: 'droopy', name: 'たれ目' }, { key: 'cat', name: 'ねこ目' },
        { key: 'sparkle', name: 'きらきら' }, { key: 'jito', name: 'ジト目' }, { key: 'narrow', name: '細め' }, { key: 'smile', name: 'にっこり' }, { key: 'wink', name: 'ウインク' },
    ],
    lash: [{ key: 'none', name: 'なし' }, { key: 'lash', name: 'あり' }],
    brow: [{ key: 'normal', name: 'ふつう' }, { key: 'thin', name: '細い' }, { key: 'thick', name: '太い' }, { key: 'angry', name: 'つり眉' }, { key: 'worried', name: '困り眉' }],
    mouth: [
        { key: 'smile', name: 'にこ' }, { key: 'open', name: 'ひらく' }, { key: 'grin', name: '歯を見せる' }, { key: 'fang', name: '八重歯' },
        { key: 'cat', name: 'ねこ口' }, { key: 'flat', name: 'まっすぐ' }, { key: 'pout', name: 'へ の字' },
    ],
    outfit: [{ key: 'tunic', name: 'チュニック' }, { key: 'robe', name: 'ローブ' }, { key: 'armor', name: 'よろい' }, { key: 'coat', name: '上着' }, { key: 'cape', name: 'マント' }],
    acc: [
        { key: 'none', name: 'なし' }, { key: 'ribbon', name: 'リボン' }, { key: 'clip', name: 'ヘアピン' }, { key: 'flower', name: '花飾り' },
        { key: 'hat', name: 'とんがり帽子' }, { key: 'band', name: 'はちまき' }, { key: 'horns', name: '角飾り' }, { key: 'glasses', name: 'めがね' },
        { key: 'eyepatch', name: '眼帯' }, { key: 'earring', name: '耳飾り' }, { key: 'freckles', name: 'そばかす' }, { key: 'scar', name: 'ほおの傷' },
    ],
};
// 色の見本（自由な色も選べる。ここは早く選ぶための候補）
const AVATAR_COLORS = {
    hair: ['#2b2230', '#5a3a26', '#a0612e', '#e2b04a', '#f1e3b8', '#c94a3a', '#e88aa8', '#4a6fc4', '#5fa07a', '#9a7ad0', '#d8d8e0', '#3a4a5a'],
    skin: ['#ffeadb', '#fcdcc4', '#f2c6a2', '#dca67e', '#b77f58', '#8a5c3e'],
    eye: ['#6a4a32', '#3a72d0', '#3f9a6a', '#d0503a', '#8a5ac0', '#d09a2a', '#3a3a4a', '#e06a8a'],
    cloth: ['#c0563a', '#4f7fc4', '#4f9a62', '#d0832a', '#9064b8', '#b8921c', '#3b2f4a', '#e7e2d6', '#d86a8a', '#3a8a9a'],
};
// 希望の職業ごとの持ち物
const JOB_ITEM = { warrior: 'sword', knight: 'shield', mage: 'staff', priest: 'book', hunter: 'bow', thief: 'dagger', villager: 'hoe' };
const LOOK_KEYS = ['hair', 'eyes', 'lash', 'brow', 'mouth', 'outfit', 'acc'];
const LOOK_COLORS = { hairColor: 'hair', skin: 'skin', eyeColor: 'eye', cloth: 'cloth' };

function randomLook() {
    const p = arr => arr[Math.floor(Math.random() * arr.length)];
    return {
        hair: p(AVATAR_PARTS.hair).key, eyes: p(AVATAR_PARTS.eyes.slice(0, 7)).key, lash: Math.random() < 0.4 ? 'lash' : 'none',
        brow: p(AVATAR_PARTS.brow).key, mouth: p(AVATAR_PARTS.mouth.slice(0, 6)).key, outfit: p(AVATAR_PARTS.outfit).key,
        acc: Math.random() < 0.45 ? 'none' : p(AVATAR_PARTS.acc.slice(1)).key,
        hairColor: p(AVATAR_COLORS.hair), skin: p(AVATAR_COLORS.skin), eyeColor: p(AVATAR_COLORS.eye), cloth: p(AVATAR_COLORS.cloth),
    };
}
// 読み込んだ見た目を確かめる（知らない値は既定に）
function cleanLook(l) {
    const d = randomLook();
    if (!l || typeof l !== 'object') return d;
    const out = {};
    const fallback = { acc: 'none', lash: 'none', brow: 'normal', outfit: 'tunic' };
    LOOK_KEYS.forEach(k => { out[k] = AVATAR_PARTS[k].some(x => x.key === l[k]) ? l[k] : (fallback[k] || d[k]); });
    Object.keys(LOOK_COLORS).forEach(k => { out[k] = typeof l[k] === 'string' && /^#[0-9a-f]{6}$/i.test(l[k]) ? l[k].toLowerCase() : d[k]; });
    return out;
}

// ---------- 色の小道具 ----------
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function hexToHsl(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
        const d = mx - mn;
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
// 明るさを変える（amt: -1〜1。正で白へ、負で黒へ）
function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const t = amt < 0 ? 0 : 255, k = Math.abs(amt);
    return rgbToHex(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k);
}

// ---------- 描く ----------
let avatarUid = 0;
// look: 見た目、job: 希望の職業（持ち物）、opt.face: 顔だけ（一覧の小さな絵）
function avatarSVG(look, job, opt = {}) {
    const L = cleanLook(look);
    const uid = `av${++avatarUid}`;
    const ln = '#3a2630';
    const c = {
        line: ln, hair: L.hairColor, hairD: shade(L.hairColor, -0.32), hairL: shade(L.hairColor, 0.45),
        skin: L.skin, skinD: shade(L.skin, -0.13), skinS: shade(L.skin, -0.07),
        cloth: L.cloth, clothD: shade(L.cloth, -0.28), clothL: shade(L.cloth, 0.35), eye: L.eyeColor,
    };
    const sw = `stroke="${ln}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
    const parts = [hairBack(L.hair, c, sw)];
    if (!opt.face) parts.push(bodySVG(L.outfit, c, sw), jobItem(JOB_ITEM[job] || 'hoe', ln));
    if (L.hair === 'braid') parts.push(braidSVG(c, sw));
    parts.push(faceSVG(L, c, sw, uid), hairFront(L.hair, c, sw), browSVG(L.brow, c), accSVG(L.acc, c, sw));
    const vb = opt.face ? '10 2 80 84' : '0 0 100 130';
    return `<svg class="avatar" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts.join('')}</svg>`;
}

// 顔の形（あごが少しとがる）
const FACE_PATH = 'M20 47 C20 26 33 17 50 17 C67 17 80 26 80 47 C80 62 70 75 50 79 C30 75 20 62 20 47 Z';

function bodySVG(outfit, c, sw) {
    const neck = `<path d="M44 74 L44 84 L56 84 L56 74 Z" fill="${c.skinD}"/>`;
    const hands = `<circle cx="24" cy="118" r="4.5" fill="${c.skin}" ${sw}/><circle cx="76" cy="118" r="4.5" fill="${c.skin}" ${sw}/>`;
    const sleeves = (l, r) => `<path d="M25 92 Q19 104 21 115 L28 115 Q27 104 31 96" fill="${l}" ${sw}/><path d="M75 92 Q81 104 79 115 L72 115 Q73 104 69 96" fill="${r}" ${sw}/>`;
    const torso = `<path d="M27 88 Q30 82 42 81 L50 88 L58 81 Q70 82 73 88 L76 128 L24 128 Z" fill="${c.cloth}" ${sw}/>
        <path d="M60 84 Q70 84 73 88 L76 127 L64 127 Q66 104 60 86 Z" fill="${c.clothD}" opacity=".45"/>`;
    const belt = `<path d="M27 110 H73" stroke="${shade(c.cloth, -0.5)}" stroke-width="4"/><rect x="46" y="107" width="8" height="6" rx="1" fill="#e0b44a" stroke="${c.line}" stroke-width="1.2"/>`;
    switch (outfit) {
        case 'robe':
            return neck + `<path d="M22 92 Q12 108 14 120 L30 120 Q28 106 32 96" fill="${c.cloth}" ${sw}/><path d="M78 92 Q88 108 86 120 L70 120 Q72 106 68 96" fill="${c.clothD}" ${sw}/>
                <path d="M28 87 Q32 81 42 80 L50 86 L58 80 Q68 81 72 87 L82 129 L18 129 Z" fill="${c.cloth}" ${sw}/>
                <path d="M60 83 Q68 83 72 87 L82 128 L66 128 Q68 104 60 85 Z" fill="${c.clothD}" opacity=".45"/>
                <path d="M34 82 Q50 96 66 82 Q62 92 50 94 Q38 92 34 82 Z" fill="${c.clothL}" ${sw}/><path d="M50 94 V128" stroke="${c.clothD}" stroke-width="2"/>
                <path d="M18 126 H82" stroke="#e0b44a" stroke-width="2.5"/>` + `<circle cx="22" cy="121" r="4.5" fill="${c.skin}" ${sw}/><circle cx="78" cy="121" r="4.5" fill="${c.skin}" ${sw}/>`;
        case 'armor':
            return neck + sleeves(c.cloth, c.clothD) + torso + `<path d="M32 88 Q50 84 68 88 L66 110 Q50 116 34 110 Z" fill="#c8ccd6" ${sw}/><path d="M38 92 Q50 89 62 92" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/><path d="M50 90 V112" stroke="#8a90a0" stroke-width="1.6"/>
                <path d="M20 88 Q24 80 34 82 L34 92 Q26 94 20 88 Z" fill="#aab0bd" ${sw}/><path d="M80 88 Q76 80 66 82 L66 92 Q74 94 80 88 Z" fill="#8a90a0" ${sw}/>` + belt + hands;
        case 'coat':
            return neck + sleeves(c.cloth, c.clothD) + `<path d="M27 88 Q30 82 42 81 L50 88 L58 81 Q70 82 73 88 L76 128 L24 128 Z" fill="#f2efe6" ${sw}/>
                <path d="M27 88 Q30 82 42 81 L48 96 L46 128 L24 128 Z" fill="${c.cloth}" ${sw}/><path d="M73 88 Q70 82 58 81 L52 96 L54 128 L76 128 Z" fill="${c.cloth}" ${sw}/>
                <path d="M62 86 Q70 84 73 88 L76 127 L64 127 Q66 104 60 90 Z" fill="${c.clothD}" opacity=".45"/>
                <path d="M42 81 L48 96 L40 92 Z M58 81 L52 96 L60 92 Z" fill="${c.clothL}" ${sw}/><path d="M45 88 L50 94 L55 88" fill="none" stroke="#c0563a" stroke-width="3"/>
                <circle cx="44" cy="106" r="1.6" fill="#e0b44a"/><circle cx="44" cy="116" r="1.6" fill="#e0b44a"/>` + hands;
        case 'cape':
            return `<path d="M24 86 Q12 108 14 128 L86 128 Q88 108 76 86 Z" fill="${c.clothD}" ${sw}/>` + neck + sleeves('#e7e2d6', '#cfcabd')
                + `<path d="M27 88 Q30 82 42 81 L50 88 L58 81 Q70 82 73 88 L76 128 L24 128 Z" fill="#e7e2d6" ${sw}/><path d="M60 84 Q70 84 73 88 L76 127 L64 127 Q66 104 60 86 Z" fill="#cfcabd" opacity=".6"/>
                <path d="M27 86 Q50 96 73 86 L70 92 Q50 100 30 92 Z" fill="${c.cloth}" ${sw}/><circle cx="50" cy="94" r="3.2" fill="#e0b44a" stroke="${c.line}" stroke-width="1.2"/>` + belt + hands;
        default:
            return neck + sleeves(c.cloth, c.clothD) + torso + `<path d="M42 81 L50 92 L58 81" fill="${c.clothL}" ${sw}/>` + belt + hands;
    }
}

function faceSVG(L, c, sw, uid) {
    return `<ellipse cx="19.5" cy="52" rx="4" ry="6" fill="${c.skin}" ${sw}/><ellipse cx="80.5" cy="52" rx="4" ry="6" fill="${c.skin}" ${sw}/>
        <path d="${FACE_PATH}" fill="${c.skin}" ${sw}/>
        <path d="M24 40 Q50 30 76 40 L76 46 Q50 36 24 46 Z" fill="${c.skinS}" opacity=".9"/>
        <ellipse cx="32" cy="63" rx="5.5" ry="2.8" fill="#f2828a" opacity=".38"/><ellipse cx="68" cy="63" rx="5.5" ry="2.8" fill="#f2828a" opacity=".38"/>
        ${eyesSVG(L.eyes, L.lash === 'lash', c, uid)}
        <path d="M50.5 61 l-1.2 2.2" stroke="${c.skinD}" stroke-width="1.8" stroke-linecap="round"/>
        ${mouthSVG(L.mouth, c)}`;
}

function eyesSVG(kind, lash, c, uid) {
    const id = `${uid}e`;
    const dark = shade(c.eye, -0.6), light = shade(c.eye, 0.5), ln = c.line;
    const defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dark}"/><stop offset=".5" stop-color="${c.eye}"/><stop offset="1" stop-color="${light}"/></linearGradient></defs>`;
    const rx = 7.2, ry = 10;
    // 右目（目尻が右）で描き、左目は左右を返す
    const one = (x, flip) => {
        const m = flip ? ` transform="translate(${2 * x} 0) scale(-1 1)"` : '';
        const cy = 53;
        const iris = `<ellipse cx="${x}" cy="${cy}" rx="${rx + 1.6}" ry="${ry}" fill="#fff"/>
            <ellipse cx="${x + 0.4}" cy="${cy + 0.6}" rx="${rx}" ry="${ry - 0.6}" fill="url(#${id})"/>
            <ellipse cx="${x + 0.4}" cy="${cy + 0.6}" rx="${rx}" ry="${ry - 0.6}" fill="none" stroke="${dark}" stroke-width="1.2"/>
            <ellipse cx="${x + 0.4}" cy="${cy + 1.6}" rx="${rx * 0.42}" ry="${ry * 0.48}" fill="${dark}"/>
            ${kind === 'sparkle'
                ? `<path d="M${x - 2.2} ${cy - 7} l1.7 3.6 3.6 1.7 -3.6 1.7 -1.7 3.6 -1.7 -3.6 -3.6 -1.7 3.6 -1.7z" fill="#fff"/><path d="M${x + 3.4} ${cy + 3} l.9 1.9 1.9.9 -1.9.9 -.9 1.9 -.9 -1.9 -1.9 -.9 1.9 -.9z" fill="#fff"/>`
                : `<ellipse cx="${x - 2.4}" cy="${cy - 4}" rx="2.9" ry="3.6" fill="#fff"/><circle cx="${x + 3}" cy="${cy + 4.2}" r="1.5" fill="#fff" opacity=".95"/>`}
            <path d="M${x - 4.5} ${cy + ry - 0.3} q4.5 1.6 9 0" fill="none" stroke="${ln}" stroke-width="1.3" stroke-linecap="round" opacity=".55"/>`;
        // まぶた（上の太い線）・二重の線・まつげ
        const lid = (d, crease) => `<path d="${d}" fill="none" stroke="${ln}" stroke-width="3.6" stroke-linecap="round"/>${crease ? `<path d="${crease}" fill="none" stroke="${ln}" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>` : ''}`;
        const lashes = (x0, y0) => lash
            ? `<path d="M${x0} ${y0} l5 -3.5 M${x0 - 1} ${y0 + 2.4} l5.6 -.6 M${x0 - 2.5} ${y0 - 2} l3.2 -4.4" stroke="${ln}" stroke-width="1.9" stroke-linecap="round"/>`
            : `<path d="M${x0} ${y0} l3.6 -2.4" stroke="${ln}" stroke-width="2.4" stroke-linecap="round"/>`;
        switch (kind) {
            case 'cat':
                return `<g${m}><ellipse cx="${x}" cy="${cy}" rx="${rx + 1.6}" ry="${ry}" fill="#fff"/><ellipse cx="${x + 0.4}" cy="${cy + 0.6}" rx="${rx}" ry="${ry - 0.6}" fill="url(#${id})" stroke="${dark}" stroke-width="1.2"/>
                    <ellipse cx="${x + 0.4}" cy="${cy + 1}" rx="1.6" ry="${ry * 0.62}" fill="${dark}"/><ellipse cx="${x - 2.6}" cy="${cy - 4}" rx="2.4" ry="3" fill="#fff"/>
                    ${lid(`M${x - 9.5} ${cy - 2} Q${x - 1} ${cy - 11} ${x + 10.5} ${cy - 13}`)}${lashes(x + 10, cy - 13)}</g>`;
            case 'jito':
                return `<g${m}><clipPath id="${id}j${x}"><rect x="${x - 12}" y="${cy - 2}" width="24" height="20"/></clipPath><g clip-path="url(#${id}j${x})">${iris}</g>${lid(`M${x - 9.5} ${cy - 2} L${x + 9.5} ${cy - 2.5}`)}${lashes(x + 9, cy - 3)}</g>`;
            case 'wink':
                return flip ? `<g${m}><path d="M${x - 8} ${cy - 2} Q${x} ${cy + 5} ${x + 8} ${cy - 2}" fill="none" stroke="${ln}" stroke-width="3.4" stroke-linecap="round"/></g>`
                    : `<g${m}>${iris}${lid(`M${x - 9.5} ${cy - 5} Q${x - 1} ${cy - 13.5} ${x + 9.5} ${cy - 8}`, `M${x - 7} ${cy - 12.5} Q${x} ${cy - 16} ${x + 8} ${cy - 12}`)}${lashes(x + 9, cy - 8)}</g>`;
            case 'smile':
                return `<g${m}><path d="M${x - 8} ${cy + 1} Q${x} ${cy - 8} ${x + 8} ${cy + 1}" fill="none" stroke="${ln}" stroke-width="3.4" stroke-linecap="round"/>${lash ? `<path d="M${x + 7.4} ${cy - 0.5} l4 -2.4" stroke="${ln}" stroke-width="1.8" stroke-linecap="round"/>` : ''}</g>`;
            case 'narrow':
                return `<g${m}><clipPath id="${id}c${x}"><rect x="${x - 12}" y="${cy - 3}" width="24" height="20"/></clipPath><g clip-path="url(#${id}c${x})">${iris}</g>${lid(`M${x - 9.5} ${cy - 2} Q${x} ${cy - 5} ${x + 9.5} ${cy - 3}`)}${lashes(x + 9, cy - 3.4)}</g>`;
            case 'sharp':
                return `<g${m}>${iris}${lid(`M${x - 9.5} ${cy - 3} Q${x - 1} ${cy - 11} ${x + 9.5} ${cy - 12}`, `M${x - 7} ${cy - 11} Q${x} ${cy - 15} ${x + 8} ${cy - 15.5}`)}${lashes(x + 9, cy - 12)}</g>`;
            case 'droopy':
                return `<g${m}>${iris}${lid(`M${x - 9.5} ${cy - 10} Q${x} ${cy - 13} ${x + 9.5} ${cy - 4}`, `M${x - 7} ${cy - 14} Q${x} ${cy - 16} ${x + 8} ${cy - 10}`)}${lashes(x + 9.2, cy - 4.4)}</g>`;
            default:
                return `<g${m}>${iris}${lid(`M${x - 9.5} ${cy - 5} Q${x - 1} ${cy - 13.5} ${x + 9.5} ${cy - 8}`, `M${x - 7} ${cy - 12.5} Q${x} ${cy - 16} ${x + 8} ${cy - 12}`)}${lashes(x + 9, cy - 8)}</g>`;
        }
    };
    return defs + one(36, true) + one(64, false);
}
// 眉（右目の上で描き、左は左右を返す。前髪の上に少し透けて見える）
function browSVG(kind, c) {
    const w = kind === 'thick' ? 2.8 : kind === 'thin' ? 1.1 : 1.6;
    const one = (x, flip) => {
        const m = flip ? ` transform="translate(${2 * x} 0) scale(-1 1)"` : '';
        const d = kind === 'angry' ? `M${x - 7} 39 Q${x} 36 ${x + 8} 34.5`
            : kind === 'worried' ? `M${x - 7} 34.5 Q${x} 35 ${x + 8} 38.5`
                : `M${x - 7} 37.5 Q${x} 34.5 ${x + 8} 36.5`;
        return `<path d="${d}" fill="none" stroke="${c.hairD}" stroke-width="${w + 1.2}" stroke-linecap="round" opacity=".5"/><path d="${d}" fill="none" stroke="${shade(c.hairD, -0.35)}" stroke-width="${w}" stroke-linecap="round"${m}/>`
            .replace('opacity=".5"/>', `opacity=".5"${m}/>`);
    };
    return one(36, true) + one(64, false);
}
function braidSVG(c, sw) {
    const knots = [86, 96, 106].map(y => `<ellipse cx="${74 + (y - 86) * 0.15}" cy="${y}" rx="6" ry="6" fill="${c.hair}" ${sw}/><path d="M${69 + (y - 86) * 0.15} ${y - 2} Q${74} ${y + 3} ${79 + (y - 86) * 0.15} ${y - 2}" fill="none" stroke="${c.hairD}" stroke-width="1.4"/>`).join('');
    return `<path d="M70 60 Q76 70 74 82" fill="none" stroke="${c.line}" stroke-width="8" stroke-linecap="round"/><path d="M70 60 Q76 70 74 82" fill="none" stroke="${c.hair}" stroke-width="5" stroke-linecap="round"/>${knots}
        <path d="M74 112 L72 120 M76 112 L78 120 M75 112 L75 121" stroke="${c.hairD}" stroke-width="2" stroke-linecap="round"/><circle cx="75" cy="112" r="2.6" fill="#e0506a" stroke="${c.line}" stroke-width="1.2"/>`;
}
function mouthSVG(kind, c) {
    const ln = c.line;
    switch (kind) {
        case 'open': return `<path d="M45 67 Q50 76 55 67 Z" fill="#b8424e" stroke="${ln}" stroke-width="1.8" stroke-linejoin="round"/><path d="M47 71.5 Q50 74.5 53 71.5" fill="#f08a8a"/>`;
        case 'flat': return `<path d="M46.5 69 h7" stroke="${ln}" stroke-width="2.2" stroke-linecap="round"/>`;
        case 'grin': return `<path d="M43.5 66 Q50 75 56.5 66 Z" fill="#fff" stroke="${ln}" stroke-width="1.8" stroke-linejoin="round"/><path d="M44.5 67.6 H55.5" stroke="${ln}" stroke-width="1" opacity=".5"/>`;
        case 'fang': return `<path d="M45 67 Q50 71.5 55 67" fill="none" stroke="${ln}" stroke-width="2.2" stroke-linecap="round"/><path d="M52 68.6 l1.2 2.6 1.2 -3" fill="#fff" stroke="${ln}" stroke-width="1" stroke-linejoin="round"/>`;
        case 'pout': return `<path d="M45.5 70 Q50 65.5 54.5 70" fill="none" stroke="${ln}" stroke-width="2.2" stroke-linecap="round"/>`;
        case 'cat': return `<path d="M44 67 q3 3.5 6 0 q3 3.5 6 0" fill="none" stroke="${ln}" stroke-width="2.2" stroke-linecap="round"/>`;
        default: return `<path d="M45.5 67.5 Q50 71.5 54.5 67.5" fill="none" stroke="${ln}" stroke-width="2.2" stroke-linecap="round"/>`;
    }
}

function hairBack(kind, c, sw) {
    switch (kind) {
        case 'long': return `<path d="M18 46 C12 80 14 104 22 114 Q36 108 50 112 Q64 108 78 114 C86 104 88 80 82 46 Z" fill="${c.hairD}" ${sw}/>`;
        case 'bob': return `<path d="M16 46 C14 66 16 78 24 84 Q50 88 76 84 C84 78 86 66 84 46 Z" fill="${c.hairD}" ${sw}/>`;
        case 'twin': return `<path d="M20 34 C0 40 2 80 10 100 C14 92 18 84 16 72 C20 64 22 54 24 44 Z" fill="${c.hair}" ${sw}/><path d="M80 34 C100 40 98 80 90 100 C86 92 82 84 84 72 C80 64 78 54 76 44 Z" fill="${c.hair}" ${sw}/>
            <path d="M8 56 Q10 76 12 90" fill="none" stroke="${c.hairD}" stroke-width="2"/><path d="M92 56 Q90 76 88 90" fill="none" stroke="${c.hairD}" stroke-width="2"/>
            <circle cx="20" cy="36" r="3.6" fill="#e0506a" ${sw}/><circle cx="80" cy="36" r="3.6" fill="#e0506a" ${sw}/>`;
        case 'pony': return `<path d="M72 22 C98 18 100 54 88 86 C86 70 82 52 70 36 Z" fill="${c.hair}" ${sw}/><path d="M86 34 Q92 56 88 76" fill="none" stroke="${c.hairD}" stroke-width="2"/><circle cx="74" cy="26" r="3.6" fill="#e0506a" ${sw}/>`;
        case 'wavy': return `<path d="M18 46 C10 62 16 72 12 84 C18 92 14 104 22 112 Q36 106 50 112 Q64 106 78 112 C86 104 82 92 88 84 C84 72 90 62 82 46 Z" fill="${c.hairD}" ${sw}/>`;
        case 'bun': return `<circle cx="50" cy="11" r="11" fill="${c.hair}" ${sw}/><path d="M43 7 Q50 2 57 7" fill="none" stroke="${c.hairD}" stroke-width="2"/>`;
        default: return '';
    }
}
function hairFront(kind, c, sw) {
    // つやの輪（頭の丸みに沿った明るい帯）と毛の流れの線
    const shine = `<path d="M30 24 Q50 15 70 24" fill="none" stroke="${c.hairL}" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>`;
    const strands = d => `<path d="${d}" fill="none" stroke="${c.hairD}" stroke-width="1.6" stroke-linecap="round"/>`;
    switch (kind) {
        case 'spiky':
            return `<path d="M17 50 L13 28 L23 31 L20 12 L33 21 L40 3 L50 17 L60 3 L67 21 L80 12 L77 31 L87 28 L83 50 C79 40 71 36 64 35 L60 42 L56 35 L50 43 L44 35 L40 42 L36 35 C29 36 21 40 17 50 Z" fill="${c.hair}" ${sw}/>${strands('M40 12 L44 30 M60 12 L56 30 M28 26 L34 34 M72 26 L66 34')}${shine}`;
        case 'side':
            return `<path d="M17 52 C14 22 34 12 52 12 C72 12 87 24 83 52 C80 40 76 32 70 28 C62 34 50 34 36 44 C30 47 22 48 17 52 Z" fill="${c.hair}" ${sw}/>${strands('M70 28 Q58 30 44 40 M62 18 Q52 26 34 34')}${shine}`;
        case 'bob':
            return `<path d="M16 58 C12 24 32 12 50 12 C68 12 88 24 84 58 C81 46 79 38 73 33 L68 41 L62 33 L56 40 L50 31 L44 40 L38 33 L32 41 L27 33 C21 38 19 46 16 58 Z" fill="${c.hair}" ${sw}/>${strands('M50 16 L50 30 M38 18 L40 30 M62 18 L60 30')}${shine}`;
        case 'long':
            return `<path d="M17 66 C12 24 32 12 50 12 C68 12 88 24 83 66 C81 50 78 40 72 34 L67 42 L60 33 L53 41 L48 32 L42 41 L36 34 L30 42 C24 44 20 54 17 66 Z" fill="${c.hair}" ${sw}/>${strands('M48 16 L48 30 M36 18 L38 32 M62 18 L60 32')}${shine}`;
        case 'center':
            return `<path d="M17 54 C15 22 32 12 50 12 C68 12 85 22 83 54 C80 40 72 30 58 26 Q52 30 50 36 Q48 30 42 26 C28 30 20 40 17 54 Z" fill="${c.hair}" ${sw}/>${strands('M50 16 L50 32 M40 18 Q34 26 26 36 M60 18 Q66 26 74 36')}${shine}`;
        case 'buzz':
            return `<path d="M19 42 C18 22 32 14 50 14 C68 14 82 22 81 42 C76 34 68 31 50 31 C32 31 24 34 19 42 Z" fill="${c.hair}" ${sw}/><path d="M34 22 Q50 17 66 22" fill="none" stroke="${c.hairL}" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`;
        case 'wavy':
            return `<path d="M17 62 C12 24 32 12 50 12 C68 12 88 24 83 62 C82 50 78 42 73 36 Q70 44 64 38 Q60 32 54 38 Q50 44 46 38 Q40 32 36 38 Q30 44 27 36 C22 42 18 52 17 62 Z" fill="${c.hair}" ${sw}/>${strands('M48 16 Q46 24 50 32 M36 18 Q34 26 38 34 M62 18 Q64 26 60 34')}${shine}`;
        case 'twin': case 'pony': case 'bun': case 'braid':
            return `<path d="M17 50 C15 22 32 12 50 12 C68 12 85 22 83 50 C79 40 73 34 66 33 L60 41 L54 32 L48 41 L42 33 L36 40 C28 36 21 42 17 50 Z" fill="${c.hair}" ${sw}/>${strands('M50 16 L52 30 M38 18 L40 30 M62 18 L62 30')}${shine}`;
        default:
            return `<path d="M17 50 C15 22 32 12 50 12 C68 12 85 22 83 50 C79 41 73 37 67 36 L63 43 L57 35 L51 43 L45 35 L39 43 L35 36 C27 37 21 42 17 50 Z" fill="${c.hair}" ${sw}/>${strands('M50 16 L51 32 M38 18 L40 32 M62 18 L61 32')}${shine}`;
    }
}
function accSVG(kind, c, sw) {
    const ln = c.line;
    switch (kind) {
        case 'ribbon': return `<path d="M66 16 L79 8 L80 25 Z M66 16 L56 6 L53 22 Z" fill="#e0506a" ${sw}/><path d="M70 14 L77 11 M62 13 L57 10" stroke="#f08aa0" stroke-width="1.6" stroke-linecap="round"/><circle cx="66" cy="16" r="3.6" fill="#c03a52" ${sw}/>`;
        case 'hat': return `<path d="M12 30 Q50 21 88 30 Q68 35 50 35 Q32 35 12 30 Z" fill="#3b3a6a" ${sw}/><path d="M28 28 L57 -8 Q61 -12 63 -6 L72 28 Z" fill="#3b3a6a" ${sw}/><path d="M29 26 Q50 19 71 26" fill="none" stroke="#e0b44a" stroke-width="3.2"/><path d="M58 0 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1z" fill="#e0b44a"/>`;
        case 'glasses': return `<rect x="26" y="45" width="20" height="16" rx="6" fill="#fff" fill-opacity=".12" stroke="${ln}" stroke-width="2.2"/><rect x="54" y="45" width="20" height="16" rx="6" fill="#fff" fill-opacity=".12" stroke="${ln}" stroke-width="2.2"/><path d="M46 51 h8 M26 50 L20 48 M74 50 L80 48" stroke="${ln}" stroke-width="2.2" stroke-linecap="round"/>`;
        case 'band': return `<path d="M17 37 Q50 27 83 37 L83 44 Q50 34 17 44 Z" fill="#f2efe6" ${sw}/><path d="M81 39 L96 31 M81 42 L94 48" stroke="#f2efe6" stroke-width="4.5" stroke-linecap="round"/><path d="M81 39 L96 31 M81 42 L94 48" stroke="${ln}" stroke-width="1" stroke-linecap="round" opacity=".4"/><circle cx="50" cy="35.5" r="3.2" fill="#c0563a"/>`;
        case 'flower': return `<g transform="translate(29 22)">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-6.5" rx="4.2" ry="6.4" fill="#f7c4d4" stroke="${ln}" stroke-width="1.5" transform="rotate(${a})"/>`).join('')}<circle r="3.6" fill="#f0c030" stroke="${ln}" stroke-width="1.5"/></g>`;
        case 'clip': return `<path d="M62 27 L74 23 M63 31 L75 27" stroke="#e0b44a" stroke-width="3" stroke-linecap="round"/><path d="M62 27 L74 23 M63 31 L75 27" stroke="${ln}" stroke-width="0.8" stroke-linecap="round" opacity=".5"/>`;
        case 'horns': return `<path d="M30 20 Q22 8 30 2 Q30 12 38 16 Z" fill="#f2efe6" ${sw}/><path d="M70 20 Q78 8 70 2 Q70 12 62 16 Z" fill="#f2efe6" ${sw}/>`;
        case 'eyepatch': return `<path d="M20 38 L80 30" stroke="${ln}" stroke-width="2"/><ellipse cx="36" cy="53" rx="10" ry="9" fill="#2b2230" ${sw}/>`;
        case 'earring': return `<circle cx="19.5" cy="60" r="2.6" fill="#e0b44a" stroke="${ln}" stroke-width="1.2"/><circle cx="80.5" cy="60" r="2.6" fill="#e0b44a" stroke="${ln}" stroke-width="1.2"/>`;
        case 'freckles': return [[29, 61], [33, 63], [31, 65], [67, 61], [71, 63], [69, 65]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#a0603a" opacity=".7"/>`).join('');
        case 'scar': return `<path d="M63 61 l11 6 M66 59 l-2 5 M70 61 l-2 5" stroke="#b04a4a" stroke-width="2" stroke-linecap="round"/>`;
        default: return '';
    }
}
function jobItem(kind, ln) {
    const sw = `stroke="${ln}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
    switch (kind) {
        case 'sword': return `<path d="M80 78 L86 112" stroke="${ln}" stroke-width="7" stroke-linecap="round"/><path d="M80 78 L86 112" stroke="#d8dce6" stroke-width="4" stroke-linecap="round"/><path d="M78 110 h16" stroke="${ln}" stroke-width="6" stroke-linecap="round"/><path d="M78 110 h16" stroke="#c9952b" stroke-width="3.5" stroke-linecap="round"/>`;
        case 'shield': return `<path d="M68 96 L88 90 L91 108 Q89 122 78 127 Q66 120 67 106 Z" fill="#4f7fc4" ${sw}/><path d="M79 98 v20 M72 106 h14" stroke="#e0b44a" stroke-width="3"/>`;
        case 'staff': return `<path d="M86 74 V128" stroke="${ln}" stroke-width="6" stroke-linecap="round"/><path d="M86 74 V128" stroke="#9a6a3a" stroke-width="3.5" stroke-linecap="round"/><circle cx="86" cy="69" r="7" fill="#7ad0f0" ${sw}/><circle cx="84" cy="67" r="2" fill="#fff"/>`;
        case 'book': return `<path d="M64 104 L82 99 L85 118 L67 123 Z" fill="#9a3a4a" ${sw}/><path d="M74 104 v14 M69 110 h10" stroke="#f0e0b0" stroke-width="2.5"/>`;
        case 'bow': return `<path d="M82 76 Q100 100 82 124" fill="none" stroke="${ln}" stroke-width="6" stroke-linecap="round"/><path d="M82 76 Q100 100 82 124" fill="none" stroke="#9a6a3a" stroke-width="3.5" stroke-linecap="round"/><path d="M82 76 V124" stroke="#e7e2d6" stroke-width="1.5"/>`;
        case 'dagger': return `<path d="M80 98 L84 114" stroke="${ln}" stroke-width="6" stroke-linecap="round"/><path d="M80 98 L84 114" stroke="#d8dce6" stroke-width="3.4" stroke-linecap="round"/><path d="M76 113 h12" stroke="#3b2f4a" stroke-width="4" stroke-linecap="round"/>`;
        default: return `<path d="M84 78 V128" stroke="${ln}" stroke-width="6" stroke-linecap="round"/><path d="M84 78 V128" stroke="#9a6a3a" stroke-width="3.5" stroke-linecap="round"/><path d="M78 78 h14 l-2 7 h-10 z" fill="#9aa0aa" ${sw}/>`;
    }
}
