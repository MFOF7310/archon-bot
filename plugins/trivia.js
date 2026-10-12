// ═══════════════════════════════════════════════════════════════════════════
// NEURAL TRIVIA v4 — multiple-choice quiz on the shared game engine
// Questions live in data/games/trivia/<category>.json (every language side by side).
// No bets: each correct answer pays, streaks pay more, a perfect run adds a bonus.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const ui = require('../lib/games/ui');
const progress = require('../lib/games/progress');
const session = require('../lib/games/session');
const v2 = require('../lib/games/v2');
const E = require('../config/emojis');

const GAME = 'trivia';
const DATA_DIR = path.join(__dirname, '..', 'assets', 'games', 'trivia');
const GRACE_MS = 1500;
const NEXT_MS = 12000;            // the answer screen moves on by itself after this
const MENU_IDLE_MS = 60000;       // menu closes after a minute without a choice
const FR_ALIASES = ['quizz', 'culture'];

const CATEGORIES = {
  general:    { emoji: E.catGeneral || '🧠', color: 0x00f0ff },
  mali:       { emoji: E.catMali || '🇲🇱', color: 0xf1c40f },
  science:    { emoji: E.catScience || '🔬', color: 0x2ecc71 },
  history:    { emoji: E.catHistory || '📜', color: 0xe67e22 },
  gaming:     { emoji: E.catGaming || '🎮', color: 0x9b59b6 },
  technology: { emoji: E.catTechnology || '💻', color: 0x3498db },
  geography:  { emoji: E.catGeography || '🌍', color: 0x1abc9c },
  space:      { emoji: E.catSpace || '🚀', color: 0x8e44ad },
  animals:    { emoji: E.catAnimals || '🐾', color: 0xd35400 },
  sports:     { emoji: E.catSports || '⚽', color: 0xe74c3c },
  literature: { emoji: E.catLiterature || '📚', color: 0xf39c12 },
};
// Per correct answer: credits × streak bonus (+10% per streak step, max +50%) and xp. Perfect run: 2× credits and xp.
const DIFFICULTIES = {
  easy:   { emoji: E.diffEasy || '🟢', color: 0x2ecc71, questions: 5,  seconds: 20, credits: 12, xp: 15 },
  medium: { emoji: E.diffMedium || '🟡', color: 0xf1c40f, questions: 7,  seconds: 15, credits: 20, xp: 20 },
  hard:   { emoji: E.diffHard || '🔴', color: 0xe74c3c, questions: 10, seconds: 10, credits: 30, xp: 30 },
};
const DIFF_ORDER = Object.keys(DIFFICULTIES);
const LETTERS = ['A', 'B', 'C', 'D'];

// ───────────────────────────── questions ─────────────────────────────
const bank = {};
function loadBank() {
  for (const cat of Object.keys(CATEGORIES)) {
    try { bank[cat] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${cat}.json`), 'utf8')); }
    catch (e) { bank[cat] = []; console.error(`[TRIVIA] could not load ${cat}.json: ${e.message}`); }
  }
}
loadBank();

const seen = new Map(); // `${userId}:${cat}` → Set of question indexes, so players don't get repeats
function pickQuestions(userId, cat, count, lang) {
  const pool = bank[cat] || [];
  if (!pool.length) return [];
  const key = `${userId}:${cat}`;
  let used = seen.get(key) || new Set();
  let free = pool.map((_, i) => i).filter(i => !used.has(i));
  if (free.length < count) { used = new Set(); free = pool.map((_, i) => i); }
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  const chosen = free.slice(0, Math.min(count, free.length));
  chosen.forEach(i => used.add(i));
  seen.set(key, used);
  setTimeout(() => seen.delete(key), 2 * 60 * 60 * 1000).unref?.();
  return chosen.map(i => {
    const q = pool[i][lang] || pool[i].en; // Chinese/Arabic fall back to English until translated
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    return { q: q.q, a: order.map(k => q.a[k]), correct: order.indexOf(0), fact: q.fact };
  });
}

const streakMult = (streak) => Math.min(1.5, 1 + 0.1 * (streak - 1));

// ───────────────────────────── screens (Components V2) ─────────────────────────────
const em = (key) => E[key] || '';
const join = (...parts) => parts.filter(Boolean).join(' ');

function names(s) {
  const Q = ui.t(s.lang, GAME);
  return { cat: `${CATEGORIES[s.cat].emoji} ${Q(`categories.${s.cat}`)}`, diff: `${DIFFICULTIES[s.diff].emoji} ${Q(`difficulties.${s.diff}`)}` };
}

// Streak and score on one line, the same on the question and the answer screens.
function statsLine(s, played) {
  const Q = ui.t(s.lang, GAME);
  return `${join(em('streaks2'), Q('streak'))}: **${s.streak}**   ·   ${join(em('star'), Q('score'))}: **${s.correct}/${played}**`;
}

// A plain one-card message, for "cancelled" and "this menu closed".
const plainScreen = (message) => v2.card(ui.COLORS.neutral, [{ text: message }]);

// o.note: a line under the menu (for example "no questions yet"). o.closed: show it without buttons.
function menuScreen(s, o = {}) {
  const T = ui.t(s.lang); const Q = ui.t(s.lang, GAME);
  const d = s.client.getUserData?.(s.userId, s.guildId) || {};
  const level = d.level || progress.levelFromXp(d.xp);
  const rank = progress.rankForLevel(level);
  const n = names(s); const diff = DIFFICULTIES[s.diff];
  const choice = [`## ${n.cat} · ${n.diff}`, Q('difficultyInfo', { questions: diff.questions, seconds: diff.seconds }), '', Q('menuHow')];
  if (o.note) choice.push('', o.note);
  if (o.closed) choice.push('', Q('expired'));
  const items = [
    { text: `## ${Q('title')}\n${Q('menuPlayer', { name: ui.clean(s.username), rank: `${rank.emoji} ${T(`ranks.${rank.key}`)}`, level })}` },
    { rule: true },
    { text: choice.join('\n') },
  ];
  if (!o.closed) {
    const catMenu = new StringSelectMenuBuilder().setCustomId('trivia_cat').setPlaceholder(Q('pickCategory')).addOptions(
      Object.entries(CATEGORIES).map(([key, c]) => ({ label: Q(`categories.${key}`).slice(0, 100), value: key, emoji: ui.parseEmoji(c.emoji), default: key === s.cat })));
    const diffMenu = new StringSelectMenuBuilder().setCustomId('trivia_diff').setPlaceholder(Q('pickDifficulty')).addOptions(
      Object.entries(DIFFICULTIES).map(([key, x]) => ({
        label: Q(`difficulties.${key}`), value: key, emoji: ui.parseEmoji(x.emoji), default: key === s.diff,
        description: Q('difficultyInfo', { questions: x.questions, seconds: x.seconds }).slice(0, 100) })));
    items.push({ rule: true }, { row: ui.row(catMenu) }, { row: ui.row(diffMenu) },
      { row: ui.row(ui.button('trivia_start', Q('btnStart'), em('triviaStart'), ui.ButtonStyle.Success), ui.button('trivia_cancel', Q('btnCancel'), em('triviaCancel'))) });
  }
  return v2.card(CATEGORIES[s.cat].color, items);
}

// Each answer is its own row: the text on the left, its letter button on the right.
function questionScreen(s) {
  const T = ui.t(s.lang); const Q = ui.t(s.lang, GAME);
  const q = s.questions[s.index]; const n = names(s);
  return v2.card(DIFFICULTIES[s.diff].color, [
    { text: `-# ${n.cat} · ${n.diff}\n**${Q('questionTitle', { n: s.index + 1, total: s.questions.length })}**\n## ${q.q}` },
    { rule: true },
    ...q.a.map((ans, i) => ({ section: [`**${ans}**`, ui.button(`trivia_a${i}`, LETTERS[i], null, ui.ButtonStyle.Primary)] })),
    { rule: true },
    { text: `${statsLine(s, s.index)}   ·   ${join(em('clock'), T('timeLeft'))}: ${ui.countdown(s.deadline)}\n${ui.progressBar(s.index, s.questions.length)}` },
  ]);
}

function answerScreen(s, outcome, paid) {
  const Q = ui.t(s.lang, GAME);
  const q = s.questions[s.index];
  const look = { correct: [ui.COLORS.success, Q('correctTitle')], wrong: [ui.COLORS.danger, Q('wrongTitle')], timeout: [ui.COLORS.neutral, Q('timeoutTitle')] }[outcome];
  const last = s.index + 1 >= s.questions.length;
  const lines = [`## ${look[1]}`, Q('answerWas', { answer: q.a[q.correct] }), '', `${join(em('hubInfo'), `**${Q('didYouKnow')}**`)} ${q.fact}`];
  if (paid) lines.push('', ui.rewardText(s.lang, paid));
  return v2.card(look[0], [
    { text: lines.join('\n') },
    { rule: true },
    { text: statsLine(s, s.index + 1) },
    { rule: true },
    { row: ui.row(ui.button('trivia_next', last ? Q('btnResults') : Q('btnNext'), last ? em('triviaResults') : em('triviaNext'), ui.ButtonStyle.Success)) },
  ]);
}

// o.closed: the same results, without buttons.
function resultsScreen(s, hasGames, o = {}) {
  const T = ui.t(s.lang); const Q = ui.t(s.lang, GAME);
  const total = s.questions.length;
  const accuracy = Math.round((s.correct / total) * 100);
  const headline = accuracy === 100 ? Q('perfect') : accuracy >= 80 ? Q('great') : accuracy >= 60 ? Q('good') : Q('keepGoing');
  const n = names(s);
  const lines = [
    `## ${headline}`,
    `**${ui.clean(s.username)}** · ${n.cat} · ${n.diff}`, '',
    `${ui.progressBar(s.correct, total)}  ${Q('summary', { correct: s.correct, total, accuracy, streak: s.maxStreak })}`, '',
    Q('earned', { reward: ui.rewardText(s.lang, s.paid) }),
  ];
  if (s.levelUp) {
    const rank = progress.rankForLevel(s.levelUp);
    lines.push('', T('levelUp', { level: s.levelUp, rank: `${rank.emoji} ${T(`ranks.${rank.key}`)}` }));
  }
  if (s.capped) lines.push('', T('capNote', { credits: progress.DAILY.credits, xp: progress.DAILY.xp }));
  const items = [{ text: lines.join('\n') }];
  if (!o.closed) {
    items.push({ rule: true }, { row: ui.row(
      ui.button('trivia_again', Q('btnAgain'), em('triviaAgain'), ui.ButtonStyle.Success),
      ui.button('trivia_menu', Q('btnMenu'), em('triviaMenu'), ui.ButtonStyle.Primary),
      hasGames ? ui.button('trivia_games', Q('btnGames'), em('triviaGames')) : null,
    ) });
  }
  return v2.card(accuracy === 100 ? ui.COLORS.gold : CATEGORIES[s.cat].color, items);
}

// ───────────────────────────── session flow ─────────────────────────────
async function startSession(source, db, lang) {
  const ctx = session.context(source, lang);
  const T = ui.t(lang);
  if (!ctx.guildId) return source.reply({ content: T('serverOnly'), flags: 64 }).catch(() => {});
  const release = session.lock(`${GAME}:${ctx.user.id}:${ctx.guildId}`, 30 * 60 * 1000);
  if (!release) return source.reply({ content: T('alreadyPlaying'), ...(ctx.isSlash ? { flags: 64 } : {}) }).catch(() => {});

  const s = {
    ctx, db, lang, client: ctx.client, userId: ctx.user.id, guildId: ctx.guildId, username: ctx.member?.displayName || ctx.user.globalName || ctx.user.username,
    cat: 'general', diff: 'easy', phase: 'menu', release,
    questions: [], index: 0, correct: 0, streak: 0, maxStreak: 0, points: 0,
    paid: { credits: 0, xp: 0 }, capped: false, levelUp: null, deadline: 0, timer: null, collector: null,
  };
  try {
    const msg = await ctx.post(menuScreen(s));
    armMenu(s);
    s.collector = msg.createMessageComponentCollector({ idle: 5 * 60 * 1000, time: 30 * 60 * 1000 });
    s.collector.on('collect', (i) => onClick(s, i).catch(e => console.error('[TRIVIA CLICK]', e.message)));
    s.collector.on('end', () => {
      if (s.phase === 'menu') s.ctx.edit(menuScreen(s, { closed: true })).catch(() => {}); // no dead buttons
      else if (s.phase === 'results') s.ctx.edit(resultsScreen(s, Boolean(s.client.commands?.get?.('game')), { closed: true })).catch(() => {});
      close(s);
    });
  } catch (e) {
    console.error('[TRIVIA START]', e.message);
    close(s);
    source.reply?.({ content: T('error'), ...(ctx.isSlash ? { flags: 64 } : {}) }).catch(() => {});
  }
}

function setTimer(s, ms, fn) {
  clearTimeout(s.timer);
  s.timer = setTimeout(() => fn().catch(e => console.error('[TRIVIA TIMER]', e.message)), ms);
}

function armMenu(s) {
  const Q = ui.t(s.lang, GAME);
  setTimer(s, MENU_IDLE_MS, async () => {
    if (s.phase !== 'menu') return;
    s.phase = 'over';
    await s.ctx.edit(plainScreen(Q('expired'))).catch(() => {});
    s.collector?.stop('expired');
  });
}

function close(s) {
  clearTimeout(s.timer);
  if (s.phase !== 'closed') { s.phase = 'closed'; s.release?.(); }
}

async function onClick(s, i) {
  const T = ui.t(s.lang); const Q = ui.t(s.lang, GAME);
  if (i.user.id !== s.userId) return i.reply({ content: T('notYours'), flags: 64 }).catch(() => {});
  const id = i.customId;

  if (s.phase === 'menu') {
    if (id === 'trivia_cat' || id === 'trivia_diff') {
      if (id === 'trivia_cat' && CATEGORIES[i.values?.[0]]) s.cat = i.values[0];
      if (id === 'trivia_diff' && DIFFICULTIES[i.values?.[0]]) s.diff = i.values[0];
      await s.ctx.ack(i); armMenu(s);
      return s.ctx.edit(menuScreen(s));
    }
    if (id === 'trivia_cancel') {
      s.phase = 'over'; clearTimeout(s.timer);
      await s.ctx.ack(i);
      await s.ctx.edit(plainScreen(Q('cancelled'))).catch(() => {});
      return s.collector?.stop('cancelled');
    }
    if (id === 'trivia_start') { await s.ctx.ack(i); return beginRun(s); }
    return;
  }

  if (s.phase === 'question' && /^trivia_a[0-3]$/.test(id)) {
    if (Date.now() > s.deadline + GRACE_MS) return i.reply({ content: T('tooLate'), flags: 64 }).catch(() => {});
    await s.ctx.ack(i);
    return answer(s, Number(id.slice(-1)) === s.questions[s.index].correct ? 'correct' : 'wrong');
  }

  if (s.phase === 'answer' && id === 'trivia_next') { await s.ctx.ack(i); return advance(s); }

  if (s.phase === 'results') {
    if (id === 'trivia_again') { await s.ctx.ack(i); return beginRun(s); }
    if (id === 'trivia_menu') { await s.ctx.ack(i); s.phase = 'menu'; armMenu(s); return s.ctx.edit(menuScreen(s)); }
    if (id === 'trivia_games') {
      await s.ctx.ack(i);
      s.collector?.stop('games');
      const stats = s.client.getUserData?.(s.userId, s.guildId) || null;
      return i.followUp(require('../lib/games/hub').buildHub({ lang: s.lang, guildName: i.guild?.name, user: i.user, stats }))
        .catch((e) => console.error('[TRIVIA HUB]', e.message));
    }
  }
  return i.reply({ content: T('oneMoment'), flags: 64 }).catch(() => {});
}

async function beginRun(s) {
  const Q = ui.t(s.lang, GAME);
  const diff = DIFFICULTIES[s.diff];
  Object.assign(s, { questions: pickQuestions(s.userId, s.cat, diff.questions, s.lang), index: 0, correct: 0, streak: 0, maxStreak: 0, points: 0, paid: { credits: 0, xp: 0 }, capped: false, levelUp: null });
  if (!s.questions.length) { s.phase = 'menu'; armMenu(s); return s.ctx.edit(menuScreen(s, { note: Q('noQuestions') })); }
  return showQuestion(s);
}

async function showQuestion(s) {
  s.phase = 'question';
  s.deadline = Date.now() + DIFFICULTIES[s.diff].seconds * 1000;
  const idx = s.index;
  setTimer(s, DIFFICULTIES[s.diff].seconds * 1000 + GRACE_MS, async () => {
    if (s.phase === 'question' && s.index === idx) return answer(s, 'timeout');
  });
  await s.ctx.edit(questionScreen(s));
}

async function answer(s, outcome) {
  if (s.phase !== 'question') return;
  s.phase = 'answer';
  clearTimeout(s.timer);
  const diff = DIFFICULTIES[s.diff];
  let paid = null;
  if (outcome === 'correct') {
    s.correct++; s.streak++; s.maxStreak = Math.max(s.maxStreak, s.streak);
    const credits = Math.floor(diff.credits * streakMult(s.streak));
    s.points += credits;
    paid = pay(s, credits, diff.xp);
  } else {
    s.streak = 0;
  }
  setTimer(s, NEXT_MS, async () => { if (s.phase === 'answer') return advance(s); });
  await s.ctx.edit(answerScreen(s, outcome, paid)).catch(() => {});
}

function pay(s, credits, xp) {
  const r = progress.award(s.client, s.db, { userId: s.userId, guildId: s.guildId, username: s.username, credits, xp });
  s.paid.credits += r.credits; s.paid.xp += r.xp;
  if (r.capped) s.capped = true;
  if (r.leveledUp) s.levelUp = r.newLevel;
  return { credits: r.credits, xp: r.xp };
}

async function advance(s) {
  if (s.phase !== 'answer') return;
  s.index++;
  if (s.index < s.questions.length) return showQuestion(s);
  return finishRun(s);
}

async function finishRun(s) {
  s.phase = 'results';
  clearTimeout(s.timer);
  const diff = DIFFICULTIES[s.diff];
  const total = s.questions.length;
  const perfect = s.correct === total;
  const won = s.correct >= total / 2;
  if (perfect) { s.points += diff.credits * 2; pay(s, diff.credits * 2, diff.xp * 2); }
  progress.award(s.client, s.db, { userId: s.userId, guildId: s.guildId, username: s.username, played: 1, won: won ? 1 : 0 });
  progress.recordRun(s.db, { game: GAME, userId: s.userId, guildId: s.guildId, username: s.username, points: s.points, won, streak: s.maxStreak, correct: s.correct, tier: s.diff, tierOrder: DIFF_ORDER });
  if (won) grantQuizMaster(s).catch(() => {});
  await s.ctx.edit(resultsScreen(s, Boolean(s.client.commands?.get?.('game')))).catch(() => {});
}

async function grantQuizMaster(s) {
  const roleId = s.client.getServerSettings?.(s.guildId)?.quizMasterRoleId || process.env.QUIZ_MASTER_ROLE_ID;
  if (!roleId || !s.ctx.guild) return;
  const member = await s.ctx.guild.members.fetch(s.userId).catch(() => null);
  const role = s.ctx.guild.roles.cache.get(roleId);
  if (member && role && !member.roles.cache.has(roleId)) await member.roles.add(role, '🧠 Trivia champion').catch(() => {});
}

// ───────────────────────────── command ─────────────────────────────
module.exports = {
  name: 'trivia',
  aliases: ['quiz', 'culture', 'questions', 'trivial', 'quizz'],
  description: '🧠 Neural Trivia: pick a category, answer fast, earn credits and XP.',
  category: 'GAMING',
  usage: '.trivia',
  cooldown: 3000,

  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('🧠 Neural Trivia: pick a category, answer fast, earn credits and XP'),

  run: async (client, message, args, db, serverSettings, usedCommand) => {
    const lang = FR_ALIASES.includes(usedCommand) ? 'fr' : ui.langFor(message, 'en');
    try { await startSession(message, db || client.db, lang); }
    catch (e) { console.error('[TRIVIA]', e); message.reply({ content: ui.t(lang)('error') }).catch(() => {}); }
  },

  execute: async (interaction, client) => {
    const lang = ui.langFor(interaction);
    try { await startSession(interaction, client.db, lang); }
    catch (e) {
      console.error('[TRIVIA SLASH]', e);
      const reply = { content: ui.t(lang)('error'), flags: 64 };
      if (interaction.deferred || interaction.replied) await interaction.editReply(reply).catch(() => {});
      else await interaction.reply(reply).catch(() => {});
    }
  },

  _internals: { CATEGORIES, DIFFICULTIES, pickQuestions, streakMult, bank },
};
