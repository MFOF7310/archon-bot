// ═══════════════════════════════════════════════════════════════════════════
// /calc <expression> — a calculator card: + − × ÷ ^ %, brackets, sqrt, sin/cos/tan (degrees), log, ln, abs,
// round, floor, ceil, min, max, pi, e. Your last 5 results below.
// The expression is read by a small parser of its own (no eval). The old version ran the text as JavaScript with
// a letter whitelist that blocked half its own functions: sqrt, floor, round, abs, exp never worked, "ceil" was
// broken by the e → Math.E replacement, and sin(45) used radians.
// Texts: lang/<l>/calc.json
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../lib/i18n');
const { icon } = require('../lib/ui/icons');
const v2 = require('../lib/games/v2');

const T = (lang, k, v) => t(`calc.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const RAD = Math.PI / 180;
const FN = {
    sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, exp: Math.exp,
    ln: Math.log, log: Math.log10, log2: Math.log2, cbrt: Math.cbrt,
    sin: (x) => Math.sin(x * RAD), cos: (x) => Math.cos(x * RAD), tan: (x) => Math.tan(x * RAD),
    asin: (x) => Math.asin(x) / RAD, acos: (x) => Math.acos(x) / RAD, atan: (x) => Math.atan(x) / RAD,
};
const FN2 = { min: Math.min, max: Math.max, pow: Math.pow };
const CONST = { pi: Math.PI, e: Math.E, π: Math.PI };

// Tokens: numbers (1.5, 2e3), names, operators; × ÷ − are accepted, "," separates min/max/pow arguments.
function tokens(src) {
    const s = String(src).replace(/×/g, '*').replace(/(?<=[\d)]\s*)x(?=\s*[\d(.])/gi, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/\*\*/g, '^');
    const out = [];
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (/\s/.test(c)) { i++; continue; }
        const num = /^(\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i));
        if (num) { out.push({ n: Number(num[0]) }); i += num[0].length; continue; }
        const name = /^[a-zπ][a-z0-9]*/i.exec(s.slice(i));
        if (name) { out.push({ id: name[0].toLowerCase() }); i += name[0].length; continue; }
        if ('+-*/^%(),;!'.includes(c)) { out.push({ op: c === ';' ? ',' : c }); i++; continue; }
        throw new Error(`char ${c}`);
    }
    return out;
}

// expr := term (('+'|'-') term)* ; term := unary (('*'|'/') unary | implicit power)* ;
// unary := ('-'|'+') unary | power ; power := postfix ('^' unary)? ; postfix := primary ('%'|'!')*
function evaluate(src) {
    const tk = tokens(src);
    let p = 0;
    const peek = () => tk[p], is = (op) => tk[p]?.op === op, eat = (op) => { if (!is(op)) throw new Error(`expected ${op}`); p++; };
    function expr() {
        let v = term();
        while (is('+') || is('-')) { const o = tk[p++].op; const r = term(); v = o === '+' ? v + r : v - r; }
        return v;
    }
    function term() {
        let v = unary();
        for (;;) {
            if (is('*') || is('/')) { const o = tk[p++].op; const r = unary(); v = o === '*' ? v * r : v / r; }
            else if (peek() && (peek().n !== undefined || peek().id || is('('))) v *= power();   // 2pi, 3(4+1)
            else return v;
        }
    }
    // -2^2 = -4: the minus applies after the power, as in math
    function unary() { if (is('-')) { p++; return -unary(); } if (is('+')) { p++; return unary(); } return power(); }
    function power() { const b = postfix(); if (is('^')) { p++; return Math.pow(b, unary()); } return b; }
    function postfix() {
        let v = primary();
        for (;;) {
            if (is('%')) { p++; v /= 100; }
            else if (is('!')) { p++; if (!Number.isInteger(v) || v < 0 || v > 170) throw new Error('factorial'); let f = 1; for (let k = 2; k <= v; k++) f *= k; v = f; }
            else return v;
        }
    }
    function primary() {
        const tok = tk[p++];
        if (!tok) throw new Error('end');
        if (tok.n !== undefined) return tok.n;
        if (tok.op === '(') { const v = expr(); eat(')'); return v; }
        if (tok.id) {
            if (Object.hasOwn(CONST, tok.id) && !is('(')) return CONST[tok.id];
            if (Object.hasOwn(FN, tok.id)) { eat('('); const v = expr(); eat(')'); return FN[tok.id](v); }
            if (Object.hasOwn(FN2, tok.id)) { eat('('); const args = [expr()]; while (is(',')) { p++; args.push(expr()); } eat(')'); return FN2[tok.id](...args); }
            throw new Error(`unknown ${tok.id}`);
        }
        throw new Error('syntax');
    }
    const v = expr();
    if (p < tk.length) throw new Error('trailing');
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('not a number');
    return Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(12));
}

const fmt = (n, lang) => (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-6 && n !== 0)) ? n.toExponential(6) : n.toLocaleString({ fr: 'fr-FR', zh: 'zh-CN', ar: 'en-US' }[lang] || 'en-US', { maximumFractionDigits: 10 });
const history = new Map();   // userId -> [{ expr, result }]

function card(lang, uid, expr, where) {
    let result;
    try { result = evaluate(expr); }
    catch {
        return v2.card(0xE24B4A, [{ text: `### ${icon('warn', where)} ${T(lang, 'bad')}\n\`${String(expr).replace(/`/g, "'").slice(0, 200)}\`\n-# ${T(lang, 'help')}` }]);
    }
    const h = history.get(uid) || [];
    const past = h.slice(0, 4);
    h.unshift({ expr, result });
    history.set(uid, h.slice(0, 5));
    if (history.size > 5000) history.clear();
    const items = [
        { text: `-# ${icon('calc', where)} ${T(lang, 'title')}\n\`${String(expr).replace(/`/g, "'").slice(0, 300)}\`\n## = ${fmt(result, lang)}` },
    ];
    if (past.length) items.push({ rule: true }, { text: `-# ${T(lang, 'recent')}\n${past.map((x) => `-# \`${String(x.expr).replace(/`/g, "'").slice(0, 60)}\` = ${fmt(x.result, lang)}`).join('\n')}` });
    return v2.card(0x378ADD, items);
}

module.exports = {
    name: 'calc', aliases: ['calculate', 'math', 'calculator', 'c'],
    userApp: true,   // also works as a user app (DMs, servers without ARCHON): lib/slash-payload.js
    description: 'Calculator: + − × ÷ ^ %, sqrt, sin/cos/tan in degrees, log, pi…',
    category: 'UTILITY', cooldown: 2000, usage: '.calc <expression>', examples: ['.calc 2+2', '.calc sqrt(144)', '.calc 15% * 2000', '.calc sin(30)'],
    evaluate,
    data: new SlashCommandBuilder().setName('calc').setDescription('Calculator').setDescriptionLocalizations({ fr: 'Calculatrice' })
        .addStringOption((o) => o.setName('expression').setDescription('For example 2+2, sqrt(144), 15% * 2000, sin(30)').setRequired(true).setMaxLength(300)),
    run: async (client, message, args) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        const expr = args.join(' ').trim();
        if (!expr) return message.reply(`${icon('warn', message)} ${T(lang, 'usage')}`).catch(() => {});
        return message.reply(card(lang, message.author.id, expr, message)).catch(() => {});
    },
    execute: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        return interaction.reply(card(lang, interaction.user.id, interaction.options.getString('expression'), interaction));
    },
};
