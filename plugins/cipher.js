// ═══════════════════════════════════════════════════════════════════════════
// NEURAL CIPHER v3 — decode scrambled words against the clock
// Rules and content only. The look, payouts, daily cap, stats and sessions
// come from the shared game engine in lib/games/.
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, ComponentType } = require('discord.js');
const ui = require('../lib/games/ui');
const progress = require('../lib/games/progress');
const session = require('../lib/games/session');

const GAME = 'cipher';
const BETWEEN_MS = 2500;            // pause after a correct answer
const GRACE_MS = 1500;              // network grace after the deadline
const MAX_RUN_MS = 14 * 60 * 1000;  // interaction tokens expire after 15 min

const WORDS = {
  easy:   ['CODE', 'HACK', 'DATA', 'NODE', 'LINK', 'NEURAL', 'CYBER', 'GHOST', 'AGENT', 'BREACH', 'PROXY', 'SHELL'],
  medium: ['ENCRYPT', 'DECRYPT', 'FIREWALL', 'PROTOCOL', 'DATABASE', 'SECURITY', 'MALWARE', 'PHISHING', 'TROJAN', 'KEYLOGGER', 'BOTNET', 'SANDBOX'],
  hard:   ['ALGORITHM', 'BLOCKCHAIN', 'BIOMETRIC', 'EXPLOITATION', 'STEGANOGRAPHY', 'CRYPTOGRAPHY', 'AUTHENTICATION', 'VULNERABILITY', 'INFILTRATION', 'EXFILTRATION'],
  expert: ['QUANTUMCOMPUTING', 'MACHINELEARNING', 'PENETRATIONTEST', 'ZERODAYEXPLOIT', 'ROOTKITDETECTION', 'BACKDOORACCESS', 'DENIALOFSERVICE', 'MANINTHEMIDDLE', 'CROSSSITESCRIPTING', 'PRIVILEGEESCALATION'],
};

// Round time = (base + perLetter × length) × method factor, clamped to 20–90 s.
// Per cracked word: reward × (1 + 0.25 × (streak − 1)) credits and `xp` XP. Perfect run: 2× both as a bonus.
const TIERS = {
  NOVICE:     { key: 'novice',     emoji: '🌱', color: 0x2ecc71, rounds: 3, base: 20, perLetter: 2.5, words: 'easy',   methods: ['CAESAR'],                                reward: 25,  xp: 8 },
  OPERATIVE:  { key: 'operative',  emoji: '🔷', color: 0x3498db, rounds: 4, base: 18, perLetter: 2.5, words: 'easy',   methods: ['CAESAR', 'REVERSE'],                     reward: 35,  xp: 12 },
  SPECIALIST: { key: 'specialist', emoji: '⚡', color: 0xf1c40f, rounds: 5, base: 16, perLetter: 2.5, words: 'medium', methods: ['CAESAR', 'REVERSE', 'MIRROR'],           reward: 50,  xp: 16 },
  ELITE:      { key: 'elite',      emoji: '💎', color: 0x9b59b6, rounds: 6, base: 15, perLetter: 2.5, words: 'medium', methods: ['CAESAR', 'REVERSE', 'MIRROR', 'ROTATE'], reward: 70,  xp: 20 },
  ARCHITECT:  { key: 'architect',  emoji: '👑', color: 0xe67e22, rounds: 7, base: 14, perLetter: 2.5, words: 'hard',   methods: ['CAESAR', 'REVERSE', 'MIRROR', 'ROTATE'], reward: 100, xp: 25 },
  SUPREME:    { key: 'supreme',    emoji: '☠️', color: 0xe74c3c, rounds: 8, base: 12, perLetter: 2.5, words: 'expert', methods: ['CAESAR', 'REVERSE', 'MIRROR', 'ROTATE'], reward: 140, xp: 30 },
};
const TIER_ORDER = Object.keys(TIERS);
const METHOD_FACTOR = { CAESAR: 1, REVERSE: 1.1, MIRROR: 1, ROTATE: 1.4 };
const TITLES = [ // codebreaker titles by total cipher points (highest first)
  [12000, 'supremeDecryptor'], [7000, 'ghostOperative'], [3500, 'cipherArchitect'],
  [1500, 'cryptanalyst'], [500, 'codeBreaker'], [0, 'scriptKiddie'],
];

const games = new Map(); // userId → running game

// ───────────────────────────── rules ─────────────────────────────
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
const titleFor = (points) => (TITLES.find(([min]) => points >= min) || TITLES[TITLES.length - 1])[1];
const shiftChar = (c, n) => String.fromCharCode((((c.charCodeAt(0) - 65 + n) % 26) + 26) % 26 + 65);

function encode(word, method, shift) {
  const w = norm(word);
  switch (method) {
    case 'CAESAR':  return w.split('').map(c => shiftChar(c, shift)).join('');
    case 'REVERSE': return w.split('').reverse().map(c => shiftChar(c, shift)).join('');
    case 'MIRROR':  return w.split('').map(c => String.fromCharCode(155 - c.charCodeAt(0))).join(''); // A↔Z
    case 'ROTATE':  return w.split('').map((c, i) => shiftChar(c, shift + i)).join('');
    default:        return w;
  }
}

function pickWords(pool, n) {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const out = [];
  while (out.length < n) out.push(...a.slice(0, n - out.length));
  return out;
}

function roundTime(tier, word, method) {
  const s = (tier.base + tier.perLetter * word.length) * (METHOD_FACTOR[method] || 1);
  return Math.round(Math.min(90, Math.max(20, s))) * 1000;
}
const roundCredits = (tier, streak) => Math.floor(tier.reward * (1 + 0.25 * (streak - 1)));

function createGame(interaction, tierKey, lang) {
  const tier = TIERS[tierKey];
  const rounds = pickWords(WORDS[tier.words], tier.rounds).map(word => {
    const method = tier.methods[Math.floor(Math.random() * tier.methods.length)];
    const shift = Math.floor(Math.random() * 25) + 1;
    return { word, method, shift, cipher: encode(word, method, shift), timeMs: roundTime(tier, word, method), deadline: 0 };
  });
  return {
    userId: interaction.user.id, guildId: interaction.guildId, username: ui.clean(interaction.user.username),
    interaction, client: interaction.client, lang, tierKey, tier, rounds,
    round: 0, streak: 0, maxStreak: 0, cracked: 0, points: 0,
    paid: { credits: 0, xp: 0 }, capped: false, levelUp: null,
    phase: 'starting', timer: null, collector: null, release: null, startedAt: Date.now(),
  };
}

// Pays through the shared engine and remembers the totals and any level-up for the result card.
function pay(game, db, credits, xp) {
  const r = progress.award(game.client, db, { userId: game.userId, guildId: game.guildId, username: game.username, credits, xp });
  game.paid.credits += r.credits;
  game.paid.xp += r.xp;
  if (r.capped) game.capped = true;
  if (r.leveledUp) game.levelUp = r.newLevel;
  return r;
}

// ───────────────────────────── screens ─────────────────────────────
function header(game, C) {
  return C('title', { tier: `${game.tier.emoji} ${C(`tiers.${game.tier.key}`)}` });
}

function roundCard(game) {
  const T = ui.t(game.lang); const C = ui.t(game.lang, GAME);
  const r = game.rounds[game.round];
  const shown = r.cipher.length <= 12 ? r.cipher.split('').join(' ') : r.cipher; // spaced letters read better on phones
  return ui.card(game.client, {
    color: game.tier.color,
    author: header(game, C),
    title: C('roundTitle', { n: game.round + 1, total: game.tier.rounds, method: C(`methods.${r.method.toLowerCase()}.name`) }),
    description: (game.round === 0 ? `${C('howTo')}\n\n` : '') + '```\n' + shown + '\n```',
    fields: [
      { name: C('hint'), value: C(`methods.${r.method.toLowerCase()}.hint`, { shift: r.shift, shift1: (r.shift + 1) % 26, shift2: (r.shift + 2) % 26 }) },
      { name: T('timeLeft'), value: ui.countdown(r.deadline) },
    ],
    footer: C('footerRound', { streak: game.streak, reward: ui.rewardText(game.lang, game.paid) }),
  });
}

function resultCard(game, kind, extra = {}) {
  const T = ui.t(game.lang); const C = ui.t(game.lang, GAME);
  const earned = game.paid.credits || game.paid.xp ? ` ${C('keep', { reward: ui.rewardText(game.lang, game.paid) })}` : '';
  const look = {
    correct: { color: ui.COLORS.success, title: C('correctTitle'), body: `${C('correctDesc', { word: extra.word, reward: ui.rewardText(game.lang, extra.paid) })}\n${C('nextSoon')}` },
    wrong:   { color: ui.COLORS.danger,  title: C('wrongTitle'),   body: C('wrongDesc', { word: extra.word, guess: extra.guess || '—' }) + earned },
    timeout: { color: ui.COLORS.danger,  title: C('timeoutTitle'), body: C('answerWas', { word: extra.word }) + earned },
    giveup:  { color: ui.COLORS.neutral, title: C('giveupTitle'),  body: C('answerWas', { word: extra.word }) + earned },
    expired: { color: ui.COLORS.neutral, title: C('expiredTitle'), body: C('expiredDesc') + earned },
    victory: {
      color: ui.COLORS.gold,
      title: C('victoryTitle', { tier: C(`tiers.${game.tier.key}`) }),
      body: C('victoryDesc', { rounds: game.tier.rounds, time: Math.round((Date.now() - game.startedAt) / 1000), streak: game.maxStreak, reward: ui.rewardText(game.lang, game.paid) })
        + `\n\n${C('titleLine', { title: C(`titles.${extra.title || 'scriptKiddie'}`) })}`,
    },
  }[kind];

  const lines = [look.body];
  if (game.levelUp && kind !== 'correct') {
    const rank = progress.rankForLevel(game.levelUp);
    lines.push(`\n${T('levelUp', { level: game.levelUp, rank: `${rank.emoji} ${T(`ranks.${rank.key}`)}` })}`);
  }
  return ui.card(game.client, {
    color: look.color,
    author: header(game, C),
    title: look.title,
    description: lines.join('\n'),
    fields: game.capped ? [{ name: '\u200b', value: T('capNote', { credits: progress.DAILY.credits, xp: progress.DAILY.xp }) }] : [],
    footer: C('footerScore', { points: game.points, cracked: game.cracked }),
  });
}

// ───────────────────────────── flow ─────────────────────────────
function armRound(game, db) {
  clearTimeout(game.timer);
  const idx = game.round;
  const r = game.rounds[idx];
  game.timer = setTimeout(() => {
    if (game.phase === 'round' && game.round === idx) finish(game, db, 'timeout', { word: r.word }).catch(() => {});
  }, Math.max(0, r.deadline - Date.now()) + GRACE_MS);
}

async function startGame(interaction, db, tierKey) {
  const lang = ui.langFor(interaction);
  const T = ui.t(lang);
  if (!TIERS[tierKey]) tierKey = 'NOVICE';

  const release = session.lock(`${GAME}:${interaction.user.id}`);
  if (!release) return interaction.reply({ content: T('alreadyPlaying'), flags: 64 });

  const game = createGame(interaction, tierKey, lang);
  game.release = release;
  games.set(game.userId, game);
  try {
    game.rounds[0].deadline = Date.now() + game.rounds[0].timeMs;
    game.phase = 'round';
    await interaction.reply({ embeds: [roundCard(game)], components: [ui.answerRow(lang, GAME)] });
    armRound(game, db);
    const msg = await interaction.fetchReply();
    const total = game.rounds.reduce((s, r) => s + r.timeMs + BETWEEN_MS + GRACE_MS, 0) + 30_000;
    game.collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: Math.min(MAX_RUN_MS, total) });
    game.collector.on('collect', (i) => onButton(game, db, i).catch(e => console.error('[CIPHER BUTTON]', e.message)));
    game.collector.on('end', () => { if (game.phase !== 'over') finish(game, db, 'expired').catch(() => {}); });
  } catch (e) {
    clearTimeout(game.timer);
    game.phase = 'over';
    games.delete(game.userId);
    release();
    console.error('[CIPHER START]', e.message);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: T('error'), flags: 64 }).catch(() => {});
  }
}

async function onButton(game, db, i) {
  const T = ui.t(game.lang); const C = ui.t(game.lang, GAME);
  if (i.user.id !== game.userId) return i.reply({ content: T('notYours'), flags: 64 }).catch(() => {});
  if (game.phase !== 'round') return i.reply({ content: T('oneMoment'), flags: 64 }).catch(() => {});

  if (i.customId === `${GAME}_giveup`) {
    await i.deferUpdate().catch(() => {});
    return finish(game, db, 'giveup', { word: game.rounds[game.round].word });
  }
  if (i.customId !== `${GAME}_answer`) return;

  const idx = game.round;
  // Wait a little past the deadline so a late submit gets a friendly "too late" instead of a failed interaction.
  const res = await session.askText(i, { lang: game.lang, id: `${GAME}_modal`, title: C('modalTitle'), waitMs: Math.max(5000, game.rounds[idx].deadline - Date.now() + 15000) });
  if (!res) return;
  if (game.phase !== 'round' || game.round !== idx || Date.now() > game.rounds[idx].deadline + GRACE_MS) {
    return res.sub.reply({ content: T('tooLate'), flags: 64 }).catch(() => {});
  }
  await res.sub.deferUpdate().catch(() => {});
  return checkAnswer(game, db, res.value);
}

async function checkAnswer(game, db, guess) {
  if (game.phase !== 'round') return;
  const r = game.rounds[game.round];
  clearTimeout(game.timer);
  if (norm(guess) !== norm(r.word)) return finish(game, db, 'wrong', { word: r.word, guess: ui.clean(guess, 40) });

  game.streak++;
  game.maxStreak = Math.max(game.maxStreak, game.streak);
  game.cracked++;
  const credits = roundCredits(game.tier, game.streak);
  game.points += credits;
  const paid = pay(game, db, credits, game.tier.xp);
  game.round++;
  if (game.round >= game.tier.rounds) return finish(game, db, 'victory');

  game.phase = 'between';
  await game.interaction.editReply({ embeds: [resultCard(game, 'correct', { word: r.word, paid })], components: [ui.answerRow(game.lang, GAME, false)] }).catch(() => {});
  setTimeout(() => nextRound(game, db).catch(e => console.error('[CIPHER ROUND]', e.message)), BETWEEN_MS);
}

async function nextRound(game, db) {
  if (game.phase !== 'between') return;
  game.rounds[game.round].deadline = Date.now() + game.rounds[game.round].timeMs;
  game.phase = 'round';
  armRound(game, db);
  await game.interaction.editReply({ embeds: [roundCard(game)], components: [ui.answerRow(game.lang, GAME)] });
}

async function finish(game, db, kind, extra = {}) {
  if (game.phase === 'over') return;
  game.phase = 'over';
  clearTimeout(game.timer);
  games.delete(game.userId);
  game.release?.();

  const won = kind === 'victory';
  if (won) {
    game.points += game.tier.reward * 2;
    pay(game, db, game.tier.reward * 2, game.tier.xp * 2);
  }
  progress.award(game.client, db, { userId: game.userId, guildId: game.guildId, username: game.username, played: 1, won: won ? 1 : 0 });
  progress.recordRun(db, { game: GAME, userId: game.userId, guildId: game.guildId, username: game.username, points: game.points, won, streak: game.maxStreak, correct: game.cracked, tier: game.tierKey, tierOrder: TIER_ORDER });
  extra.title = titleFor(progress.statsFor(db, GAME, game.userId, game.guildId).all.points);

  await game.interaction.editReply({ embeds: [resultCard(game, kind, extra)], components: [] }).catch(() => {});
  game.collector?.stop('over');
}

// ───────────────────────────── leaderboard & profile ─────────────────────────────
function boardCard(interaction, db, lang, global) {
  const C = ui.t(lang, GAME);
  const rows = progress.board(db, GAME, global ? null : interaction.guildId);
  return ui.card(interaction.client, {
    color: global ? ui.COLORS.gold : ui.COLORS.info,
    title: global ? C('lbGlobalTitle') : C('lbTitle', { guild: ui.clean(interaction.guild?.name, 60) }),
    description: rows.length ? ui.boardLines(lang, rows).join('\n') : C('lbEmpty'),
    footer: ui.t(lang)('footer', { game: C('name') }),
  });
}

function profileCard(interaction, db, lang) {
  const C = ui.t(lang, GAME);
  const { here, all } = progress.statsFor(db, GAME, interaction.user.id, interaction.guildId);
  const tier = TIERS[here?.top_tier];
  return ui.card(interaction.client, {
    author: C('profileTitle', { name: ui.clean(interaction.user.username) }),
    fields: [
      { name: C('pTitle'), value: C(`titles.${titleFor(all.points)}`), inline: true },
      { name: C('pPoints'), value: String(all.points), inline: true },
      { name: C('pWins'), value: String(all.wins), inline: true },
      { name: C('pCracked'), value: String(all.correct), inline: true },
      { name: C('pStreak'), value: String(all.best_streak), inline: true },
      { name: C('pTier'), value: tier ? `${tier.emoji} ${C(`tiers.${tier.key}`)}` : '—', inline: true },
      { name: C('pServer'), value: String(here?.points || 0), inline: true },
    ],
    footer: ui.t(lang)('footer', { game: C('name') }),
  }).setThumbnail(interaction.user.displayAvatarURL?.({ size: 256 }) || null);
}

// One-time copy of v1/v2 cipher scores into the shared stats table.
let migrated = false;
function migrateOldScores(db) {
  if (migrated) return;
  migrated = true;
  try {
    const has = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cipher_scores'").get();
    const done = db.prepare("SELECT 1 FROM game_stats WHERE game = 'cipher' LIMIT 1").get();
    if (!has || done) return;
    const n = db.prepare(`INSERT OR IGNORE INTO game_stats (game, user_id, guild_id, username, points, played, won, best_streak, correct, top_tier, last_played)
      SELECT 'cipher', user_id, guild_id, username, total_score, games_played, games_won, best_streak, ciphers_cracked, highest_difficulty, last_played
      FROM cipher_scores WHERE games_played > 0 OR total_score > 0`).run();
    console.log(`[CIPHER] moved ${n.changes} old score rows into game_stats`);
  } catch (e) { console.error('[CIPHER MIGRATE]', e.message); }
}

function setupCipherDB(db) {
  if (!db) return;
  progress.setup(db);
  migrateOldScores(db);
}

// ───────────────────────────── command ─────────────────────────────
const data = new SlashCommandBuilder()
  .setName('cipher')
  .setDescription('🦅 Neural Cipher: decode scrambled words against the clock')
  .addSubcommand(sub => sub.setName('play').setDescription('🔐 Start a run')
    .addStringOption(opt => opt.setName('difficulty').setDescription('Pick your level').setRequired(true)
      .addChoices(
        { name: '🌱 Novice (easy)', value: 'NOVICE' },
        { name: '🔷 Operative', value: 'OPERATIVE' },
        { name: '⚡ Specialist', value: 'SPECIALIST' },
        { name: '💎 Elite', value: 'ELITE' },
        { name: '👑 Architect (hard)', value: 'ARCHITECT' },
        { name: '☠️ Supreme (legendary)', value: 'SUPREME' },
      )))
  .addSubcommand(sub => sub.setName('leaderboard').setDescription('🏆 Top codebreakers in this server'))
  .addSubcommand(sub => sub.setName('global').setDescription('🌍 Top codebreakers everywhere'))
  .addSubcommand(sub => sub.setName('profile').setDescription('👤 Your codebreaker profile'));

async function execute(interaction, client) {
  const lang = ui.langFor(interaction);
  const T = ui.t(lang);
  const db = client?.db || interaction.client?.db;
  if (!interaction.guildId) return interaction.reply({ content: T('serverOnly'), flags: 64 }).catch(() => {});
  if (!db) return interaction.reply({ content: T('error'), flags: 64 }).catch(() => {});
  setupCipherDB(db);
  try {
    const sub = interaction.options.getSubcommand();
    if (sub === 'play') return await startGame(interaction, db, interaction.options.getString('difficulty'));
    if (sub === 'leaderboard') return await interaction.reply({ embeds: [boardCard(interaction, db, lang, false)] });
    if (sub === 'global') return await interaction.reply({ embeds: [boardCard(interaction, db, lang, true)] });
    if (sub === 'profile') return await interaction.reply({ embeds: [profileCard(interaction, db, lang)] });
  } catch (e) {
    console.error('[CIPHER]', e.message);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: T('error'), flags: 64 }).catch(() => {});
  }
}

// Prefix fallback (client, message, args, database, serverSettings)
async function run(client, message, args, database, serverSettings) {
  const lang = ui.pickLang(serverSettings?.language) || 'en';
  return message.reply(ui.t(lang)('slashOnly', { command: 'cipher play' })).catch(() => {});
}

module.exports = {
  name: 'cipher',
  aliases: ['neuralcipher', 'decrypt', 'codebreak'],
  description: 'Neural Cipher: decode scrambled words against the clock and climb the leaderboard.',
  category: 'GAMING',
  cooldown: 10000,
  usage: '/cipher play <difficulty>',
  data,
  execute,
  run,
  setupCipherDB,
  _internals: { encode, norm, roundTime, roundCredits, titleFor, TIERS, WORDS },
};
