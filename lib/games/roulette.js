'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ROULETTE — one table, several bets, one message that edits itself
// Built on Discord's Components V2: cards with no code blocks, so custom emojis show.
//
// Money rules
//  • Chips are taken at the moment of Spin, never before. A table you walk away from costs nothing.
//  • The number is drawn and paid in the same step. The animation afterwards is only for show.
//  • The balance is read fresh at Spin, so two open tables can't spend the same credits.
// Texts: lang/<locale>/roulette.json     Emojis: config/emojis.js (roulette* keys)
// ═══════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');
const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} = require('discord.js');
const ui = require('./ui');
const session = require('./session');
const E = require('../../config/emojis');

const IDLE_MS = 120000;       // the table closes after 2 minutes without a click
const TOTAL_MS = 600000;      // and after 10 minutes in all
const MAX_CHIPS = 10;
const MAX_STAKE = 10000;      // most a single spin can cost
const HISTORY = 10;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const em = (key) => E[key] || '';
const fmt = (n) => `${Number(n || 0).toLocaleString('en-US')} ${em('coins')}`.trim();

// "<:name:id>" or "<a:name:id>" -> the object Discord wants in buttons; a plain emoji -> { name }
function toEmoji(value) {
  if (!value) return undefined;
  const m = /^<(a?):(\w+):(\d+)>$/.exec(value);
  return m ? { id: m[3], name: m[2], animated: m[1] === 'a' } : { name: value };
}

// ================= THE WHEEL =================
const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
const dot = (n) => em({ red: 'rouletteRed', black: 'rouletteBlack', green: 'rouletteGreen' }[colorOf(n)]);

// pays = profit per chip on a win (the chip itself comes back too)
const FIXED = {
  red:   { pays: 1, wins: (n) => colorOf(n) === 'red', emoji: 'rouletteRed' },
  black: { pays: 1, wins: (n) => colorOf(n) === 'black', emoji: 'rouletteBlack' },
  odd:   { pays: 1, wins: (n) => n !== 0 && n % 2 === 1 },
  even:  { pays: 1, wins: (n) => n !== 0 && n % 2 === 0 },
  low:   { pays: 1, wins: (n) => n >= 1 && n <= 18 },
  high:  { pays: 1, wins: (n) => n >= 19 && n <= 36 },
  d1:    { pays: 2, wins: (n) => n >= 1 && n <= 12 },
  d2:    { pays: 2, wins: (n) => n >= 13 && n <= 24 },
  d3:    { pays: 2, wins: (n) => n >= 25 && n <= 36 },
};
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const validKey = (k) => has(FIXED, k) || /^n(\d|[12]\d|3[0-6])$/.test(String(k));
function betDef(key) {
  if (key[0] === 'n') { const num = Number(key.slice(1)); return { pays: 35, wins: (n) => n === num, num }; }
  return FIXED[key];
}

const groupChips = (chips) => { const m = new Map(); for (const k of chips) m.set(k, (m.get(k) || 0) + 1); return m; };
const maxChipsFor = (chip) => Math.max(1, Math.min(MAX_CHIPS, Math.floor(MAX_STAKE / chip)));

// What a spin pays. Chips are one `chip` each; a win returns the chip plus `pays` times it.
function resolveSpin(chips, chip, number) {
  let staked = 0, returned = 0;
  const lines = [];
  for (const [key, n] of groupChips(chips)) {
    const def = betDef(key);
    const stake = n * chip;
    const win = def.wins(number);
    const got = win ? stake * (def.pays + 1) : 0;
    staked += stake; returned += got;
    lines.push({ key, n, stake, win, got });
  }
  return { staked, returned, net: returned - staked, lines };
}

// Last numbers per channel, kept in memory only.
const history = new Map();
function remember(channelId, number) {
  const list = history.get(channelId) || [];
  list.unshift(number);
  history.set(channelId, list.slice(0, HISTORY));
  if (history.size > 500) history.delete(history.keys().next().value);
}

// ================= THE TABLE =================
async function play(deps) {
  const { ctx: legacy, getUser, charge, settle } = deps;
  const lang = ui.pickLang(deps.lang) || 'en';
  const T = ui.t(lang, 'roulette');
  const userId = deps.userId;
  const bal = () => Number((getUser() || {}).credits) || 0;

  const release = session.lock(`roulette:${deps.guildId}:${userId}`);
  if (!release) return legacy.reply({ content: T('haveTable') });

  const sctx = session.context(legacy.source, lang);
  const who = sctx.user || {};
  const S = {
    name: ui.clean(who.globalName || who.username || '?', 24) || '?',
    chip: deps.bet, chips: [], lastChips: [], credits: bal(),
    phase: 'table', busy: false, closed: false, note: '', result: null,
  };
  if (S.credits < S.chip) {
    release();
    return legacy.reply({ content: T('poor', { credits: fmt(S.credits), chip: fmt(S.chip) }) });
  }
  const channelId = (sctx.channel && sctx.channel.id) || 'dm';

  // ----- pieces -----
  const text = (s) => new TextDisplayBuilder().setContent(String(s).slice(0, 3900));
  const rule = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
  const row = (...parts) => new ActionRowBuilder().addComponents(...parts);
  const btn = (id, label, emoji, style = ButtonStyle.Secondary, disabled = false) => {
    const b = new ButtonBuilder().setCustomId(id).setLabel(String(label).slice(0, 80)).setStyle(style).setDisabled(disabled);
    const e = toEmoji(emoji);
    if (e) b.setEmoji(e);
    return b;
  };
  const card = (color, items) => {
    const c = new ContainerBuilder().setAccentColor(color);
    for (const it of items) {
      if (it.text !== undefined) c.addTextDisplayComponents(text(it.text));
      else if (it.rule) c.addSeparatorComponents(rule());
      else if (it.row) c.addActionRowComponents(it.row);
    }
    return { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
  };

  const label = (key) => {
    const def = betDef(key);
    if (key === 'n0') return `${em('rouletteGreen')} ${T('b_zero')}`.trim();
    if (key[0] === 'n') return `${dot(def.num)} ${T('b_number', { n: def.num })}`.trim();
    return `${def.emoji ? em(def.emoji) : ''} ${T('b_' + key)}`.trim();
  };
  const recent = () => {
    const list = history.get(channelId);
    return list && list.length ? `\n${T('recent', { list: list.map((n) => `${dot(n)} ${n}`.trim()).join(' · ') })}` : '';
  };

  // ----- views -----
  const head = () => `## ${[em('rouletteSpin'), T('title')].filter(Boolean).join(' ')}`;
  function tableView() {
    const groups = groupChips(S.chips);
    const bets = groups.size ? [...groups].map(([k, n]) => `${label(k)} ×${n}`).join(' · ') : T('noBets');
    const items = [
      { text: `${head()}\n${T('intro', { name: S.name, chip: fmt(S.chip) })}` },
      { rule: true },
      { text: `**${T('betsTitle')}**\n${bets}\n${T('onTable', { total: fmt(S.chips.length * S.chip), count: S.chips.length, max: maxChipsFor(S.chip) })}\n${T('balance', { credits: fmt(S.credits) })}${recent()}${S.note ? `\n\n${S.note}` : ''}${S.closed ? `\n\n${T('closed')}` : ''}` },
    ];
    if (!S.closed) {
      const empty = !S.chips.length;
      const more = new StringSelectMenuBuilder().setCustomId('rlt:more').setPlaceholder(T('btnMore')).addOptions([
        { label: T('b_low'), value: 'low' }, { label: T('b_high'), value: 'high' },
        { label: T('b_d1'), value: 'd1' }, { label: T('b_d2'), value: 'd2' }, { label: T('b_d3'), value: 'd3' },
        { label: T('b_pick'), value: 'pick' },
      ]);
      items.push({ rule: true },
        { row: row(
          btn('rlt:b:red', T('b_red'), em('rouletteRed'), ButtonStyle.Danger),
          btn('rlt:b:black', T('b_black'), em('rouletteBlack')),
          btn('rlt:b:odd', T('b_odd')),
          btn('rlt:b:even', T('b_even')),
          btn('rlt:b:n0', T('b_zero'), em('rouletteGreen'), ButtonStyle.Success)) },
        { row: row(more) },
        { row: row(
          btn('rlt:spin', T('btnSpin'), em('rouletteSpin'), ButtonStyle.Success, empty),
          btn('rlt:undo', T('btnUndo'), em('rouletteUndo'), ButtonStyle.Secondary, empty),
          btn('rlt:clear', T('btnClear'), em('rouletteClear'), ButtonStyle.Secondary, empty)) });
    }
    return card(ui.COLORS.gold, items);
  }

  function spinView(n) {
    return card(ui.COLORS.neutral, [{ text: `${head()}\n${T('spinning', { number: n, color: `${dot(n)} ${T('c_' + colorOf(n))}`.trim() })}` }]);
  }

  function resultView() {
    const R = S.result;
    const n = R.number;
    const lines = R.res.lines.map((l) => (l.win
      ? `${em('rouletteWin')} ${T('lineWin', { label: `${label(l.key)} ×${l.n}`, amount: fmt(l.got - l.stake) })}`
      : `${em('rouletteLose')} ${T('lineLose', { label: `${label(l.key)} ×${l.n}`, amount: fmt(l.stake) })}`).trim());
    const net = R.res.net;
    const summary = net > 0 ? T('sumWin', { amount: fmt(net) })
      : net === 0 ? T('sumEven')
        : R.res.returned > 0 ? T('sumPartial', { amount: fmt(-net) })
          : T('sumLose', { amount: fmt(-net) });
    const items = [
      { text: `${head()}\n${T('landed', { number: n, color: `${dot(n)} ${T('c_' + colorOf(n))}`.trim() })}` },
      { rule: true },
      { text: `${lines.join('\n')}\n\n**${summary}**\n${T('balanceAfter', { credits: fmt(S.credits) })}${recent()}${S.closed ? `\n\n${T('closed')}` : ''}` },
    ];
    if (!S.closed) {
      items.push({ rule: true }, { row: row(
        btn('rlt:again', T('btnAgain'), em('rouletteSpin'), ButtonStyle.Success),
        btn('rlt:double', T('btnDouble'), em('rouletteDouble'), ButtonStyle.Primary),
        btn('rlt:new', T('btnNew'))) });
    }
    return card(net > 0 ? ui.COLORS.success : net < 0 ? ui.COLORS.danger : ui.COLORS.neutral, items);
  }

  const current = () => (S.phase === 'result' && S.result ? resultView() : tableView());
  const show = async (i) => { await i.update(current()); sctx.last = i; sctx.lastAt = Date.now(); };

  // ----- actions -----
  function place(key) {
    if (!validKey(key)) return;
    if (S.chips.length >= maxChipsFor(S.chip)) { S.note = T('tooMany', { max: maxChipsFor(S.chip) }); return; }
    S.chips.push(key);
    S.note = '';
  }

  async function askNumber(i) {
    const id = `rlt:num:${i.id}`;
    const modal = new ModalBuilder().setCustomId(id).setTitle(T('modalTitle')).addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('num').setLabel(T('modalLabel')).setStyle(TextInputStyle.Short)
          .setRequired(true).setMinLength(1).setMaxLength(2)));
    await i.showModal(modal);
    return i.awaitModalSubmit({ time: IDLE_MS, filter: (m) => m.customId === id && m.user.id === userId }).catch(() => null);
  }

  // The one place money moves. Everything before `charge` can fail with nothing lost.
  async function spin(i) {
    await sctx.ack(i);
    const chips = S.chips.slice();
    if (!chips.length) { S.phase = 'table'; return sctx.edit(tableView()); }
    const staked = chips.length * S.chip;
    S.credits = bal();
    if (S.credits < staked || !charge(staked)) {
      S.phase = 'table';
      S.note = T('notEnough', { credits: fmt(bal()), total: fmt(staked) });
      S.credits = bal();
      return sctx.edit(tableView());
    }
    S.busy = true;
    try {
      const number = deps.random ? deps.random() : crypto.randomInt(0, 37);
      const res = resolveSpin(chips, S.chip, number);
      try {
        settle(res.net > 0, res.returned, res.net > 0 ? 150 : 25);
      } catch (e) {
        console.error(`[ROULETTE] settle failed after charge (user ${userId}, staked ${staked}, returned ${res.returned}):`, e.message);
        throw e;
      }
      S.lastChips = chips; S.note = ''; S.phase = 'result';
      S.credits = bal();
      S.result = { number, res };
      remember(channelId, number);
      for (let k = 0; k < 3; k++) {
        await sctx.edit(spinView(deps.random ? (number + k + 1) % 37 : crypto.randomInt(0, 37))).catch(() => {});
        await sleep(deps.pause === undefined ? 700 : deps.pause);
      }
      await sctx.edit(resultView());
    } finally { S.busy = false; }
  }

  // ----- go -----
  await sctx.post(tableView());
  const collector = sctx.message.createMessageComponentCollector({
    filter: (i) => String(i.customId).startsWith('rlt:'), idle: IDLE_MS, time: TOTAL_MS,
  });

  collector.on('collect', async (i) => {
    try {
      if (i.user.id !== userId) {
        return await i.reply({ content: T('notYours', { name: S.name }), flags: 64 }).catch(() => {});
      }
      if (S.busy) return await i.deferUpdate().catch(() => {});
      const id = String(i.customId).slice(4);

      if (id.startsWith('b:')) {
        if (S.phase !== 'table') return await i.deferUpdate().catch(() => {});
        place(id.slice(2)); S.credits = bal();
        return await show(i);
      }
      if (id === 'more') {
        if (S.phase !== 'table') return await i.deferUpdate().catch(() => {});
        const value = i.values && i.values[0];
        if (value === 'pick') {
          const sub = await askNumber(i);
          if (!sub) return;
          const raw = String(sub.fields.getTextInputValue('num') || '').trim();
          if (/^\d{1,2}$/.test(raw) && Number(raw) <= 36) place(`n${Number(raw)}`); else S.note = T('badNumber');
          S.credits = bal();
          return await show(sub);
        }
        place(value); S.credits = bal();
        return await show(i);
      }
      if (id === 'undo') { S.chips.pop(); S.note = ''; S.credits = bal(); return await show(i); }
      if (id === 'clear') { S.chips = []; S.note = ''; S.credits = bal(); return await show(i); }
      if (id === 'new') { S.chips = []; S.note = ''; S.phase = 'table'; S.credits = bal(); return await show(i); }
      if (id === 'spin') return await spin(i);
      if (id === 'again') { S.chips = S.lastChips.slice(); return await spin(i); }
      if (id === 'double') {
        const next = Math.min(S.chip * 2, 10000);
        S.chips = S.lastChips.slice();
        if (S.chips.length > maxChipsFor(next)) {
          S.phase = 'table'; S.note = T('tooMany', { max: maxChipsFor(next) }); S.credits = bal();
          return await show(i);
        }
        S.chip = next;
        return await spin(i);
      }
      return await i.deferUpdate().catch(() => {});
    } catch (e) {
      console.error('[ROULETTE]', e.message);
      try { await sctx.edit(card(ui.COLORS.danger, [{ text: T('error') }])); } catch (e2) { /* nothing more to do */ }
    }
  });

  collector.on('end', async () => {
    release();
    for (let k = 0; k < 10 && S.busy; k++) await sleep(500);
    S.closed = true;
    try { await sctx.edit(current()); } catch (e) { /* the message may be gone */ }
  });
}

module.exports = { play, _internal: { resolveSpin, betDef, colorOf, validKey, maxChipsFor, toEmoji } };
