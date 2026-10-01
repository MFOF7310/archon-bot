// ═══════════════════════════════════════════════════════════════════════════
// NEURAL CIPHER v2 — decode scrambled words against the clock
// Answers go through a private text box (modal). Every string lives in
// lang/<locale>/cipher.json. Credits are paid per cracked word, capped per day.
// ═══════════════════════════════════════════════════════════════════════════
const {
  EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const i18n = require('../lib/i18n');

const C = { green: '\x1b[32m', red: '\x1b[31m', reset: '\x1b[0m' };

// ───────────────────────────── tuning ─────────────────────────────
const DAILY_CAP = 1500;             // max cipher credits per player, per server, per UTC day
const BETWEEN_MS = 2500;            // pause after a correct answer
const GRACE_MS = 1500;              // network grace after the deadline
const MAX_RUN_MS = 14 * 60 * 1000;  // interaction tokens expire after 15 min

const WORDS = {
  easy:   ['CODE', 'HACK', 'DATA', 'NODE', 'LINK', 'NEURAL', 'CYBER', 'GHOST', 'AGENT', 'BREACH', 'PROXY', 'SHELL'],
  medium: ['ENCRYPT', 'DECRYPT', 'FIREWALL', 'PROTOCOL', 'DATABASE', 'SECURITY', 'MALWARE', 'PHISHING', 'TROJAN', 'KEYLOGGER', 'BOTNET', 'SANDBOX'],
  hard:   ['ALGORITHM', 'BLOCKCHAIN', 'BIOMETRIC', 'EXPLOITATION', 'STEGANOGRAPHY', 'CRYPTOGRAPHY', 'AUTHENTICATION', 'VULNERABILITY', 'INFILTRATION', 'EXFILTRATION'],
  expert: ['QUANTUMCOMPUTING', 'MACHINELEARNING', 'PENETRATIONTEST', 'ZERODAYEXPLOIT', 'ROOTKITDETECTION', 'BACKDOORACCESS', 'DENIALOFSERVICE', 'MANINTHEMIDDLE', 'CROSSSITESCRIPTING', 'PRIVILEGEESCALATION'],
};

// Round time = (base + perLetter × word length) × method factor, clamped to 20–90 s.
// Credits per cracked word = reward × (1 + 0.25 × (streak − 1)); perfect run bonus = reward × 2.
const TIERS = {
  NOVICE:     { key: 'novice',     emoji: '🌱', color: 0x2ecc71, rounds: 3, base: 20, perLetter: 2.5, words: 'easy',   methods: ['CAESAR'],                                reward: 25 },
  OPERATIVE:  { key: 'operative',  emoji: '🔷', color: 0x3498db, rounds: 4, base: 18, perLetter: 2.5, words: 'easy',   methods: ['CAESAR', 'REVERSE'],                     reward: 35 },
  SPECIALIST: { key: 'specialist', emoji: '⚡', color: 0xf1c40f, rounds: 5, base: 16, perLetter: 2.5, words: 'medium', methods: ['CAESAR', 'REVERSE', 'MIRROR'],           reward: 50 },
  ELITE:      { key: 'elite',      emoji: '💎', color: 0x9b59b6, rounds: 6, base: 15, perLetter: 2.5, words: 'medium', methods: ['CAESAR', 'REVERSE', 'MIRROR', 'ROTATE'], reward: 70 },
  ARCHITECT:  { key: 'architect',  emoji: '👑', color: 0xe67e22, rounds: 7, base: 14, perLetter: 2.5, words: 'hard',   methods: ['CAESAR', 'REVERSE', 'MIRROR', 'ROTATE'], reward: 100 },
  SUPREME:    { key: 'supreme',    emoji: '☠️', color: 0xe74c3c, rounds: 8, base: 12, perLetter: 2.5, words: 'expert', methods: ['CAESAR', 'REVERSE', 'MIRROR', 'ROTATE'], reward: 140 },
};
const TIER_ORDER = ['NOVICE', 'OPERATIVE', 'SPECIALIST', 'ELITE', 'ARCHITECT', 'SUPREME'];
const METHOD_FACTOR = { CAESAR: 1, REVERSE: 1.1, MIRROR: 1, ROTATE: 1.4 };
const RANKS = [ // global points → rank key (highest first)
  [12000, 'supremeDecryptor'], [7000, 'ghostOperative'], [3500, 'cipherArchitect'],
  [1500, 'cryptanalyst'], [500, 'codeBreaker'], [0, 'scriptKiddie'],
];

const activeGames = new Map(); // userId → game

// ───────────────────────────── helpers ─────────────────────────────
const tr = (lang) => (key, vars) => i18n.t(`cipher.${key}`, lang, vars);
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
const clean = (s, max = 32) => String(s || '').replace(/[*_`~|\\]/g, '').slice(0, max);
const rankFor = (points) => (RANKS.find(([min]) => points >= min) || RANKS[RANKS.length - 1])[1];

// Server language when set (bm falls back to fr), otherwise the user's Discord locale.
function langFor(interaction) {
  let l = null;
  try {
    const s = interaction.client.getServerSettings?.(interaction.guildId);
    if (s?.language && s.language !== 'auto') l = s.language;
  } catch {}
  if (!l) { try { l = i18n.slashLang?.(interaction); } catch {} }
  if (l === 'bm') l = 'fr';
  return ['en', 'fr', 'zh', 'ar'].includes(l) ? l : 'en';
}

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
  while (out.length < n) out.push(...a.slice(0, n - out.length)); // pools are ≥ rounds; loop is a safety net
  return out;
}

function roundTime(tier, word, method) {
  const s = (tier.base + tier.perLetter * word.length) * (METHOD_FACTOR[method] || 1);
  return Math.round(Math.min(90, Math.max(20, s))) * 1000;
}

const roundCredits = (tier, streak) => Math.floor(tier.reward * (1 + 0.25 * (streak - 1)));

// ───────────────────────────── database ─────────────────────────────
let dbReady = false;
function setupCipherDB(db) {
  if (dbReady || !db) return;
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS cipher_scores (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        username TEXT,
        total_score INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        highest_difficulty TEXT DEFAULT 'NOVICE',
        ciphers_cracked INTEGER DEFAULT 0,
        last_played INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
      )`).run();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS cipher_global (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        global_score INTEGER DEFAULT 0,
        global_wins INTEGER DEFAULT 0,
        ciphers_total INTEGER DEFAULT 0,
        rank_title TEXT DEFAULT 'scriptKiddie'
      )`).run();
    // v2: daily credit cap tracking (ignore "duplicate column" on later boots)
    for (const col of ["earned_today INTEGER DEFAULT 0", "earned_day TEXT DEFAULT ''"]) {
      try { db.prepare(`ALTER TABLE cipher_scores ADD COLUMN ${col}`).run(); } catch {}
    }
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cipher_guild ON cipher_scores(guild_id)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cipher_score ON cipher_scores(total_score DESC)`).run();
    dbReady = true;
    console.log(`${C.green}[CIPHER]${C.reset} Database tables ready`);
  } catch (e) {
    console.error(`${C.red}[CIPHER DB]${C.reset} ${e.message}`);
  }
}

// Pays up to the daily cap and returns what was actually paid.
function payCredits(db, game, amount) {
  const day = new Date().toISOString().slice(0, 10);
  let already = 0;
  try {
    const row = db.prepare('SELECT earned_today, earned_day FROM cipher_scores WHERE user_id = ? AND guild_id = ?').get(game.userId, game.guildId);
    if (row && row.earned_day === day) already = row.earned_today || 0;
  } catch {}
  const pay = Math.max(0, Math.min(amount, DAILY_CAP - already));
  if (pay > 0) {
    try { game.interaction.client.addCredits?.(game.userId, game.guildId, pay); } catch (e) { console.error(`${C.red}[CIPHER PAY]${C.reset} ${e.message}`); }
  }
  try {
    db.prepare(`
      INSERT INTO cipher_scores (user_id, guild_id, username, earned_today, earned_day) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, guild_id) DO UPDATE SET
        earned_today = CASE WHEN earned_day = excluded.earned_day THEN earned_today + excluded.earned_today ELSE excluded.earned_today END,
        earned_day = excluded.earned_day`).run(game.userId, game.guildId, game.username, pay, day);
  } catch (e) { console.error(`${C.red}[CIPHER CAP]${C.reset} ${e.message}`); }
  return pay;
}

// Records the finished run; returns the player's new global points.
function saveRun(db, game, won) {
  try {
    const cur = db.prepare('SELECT highest_difficulty, best_streak FROM cipher_scores WHERE user_id = ? AND guild_id = ?').get(game.userId, game.guildId);
    const highest = TIER_ORDER.indexOf(game.tierKey) > TIER_ORDER.indexOf(cur?.highest_difficulty)
      ? game.tierKey : (cur?.highest_difficulty || game.tierKey);
    const best = Math.max(cur?.best_streak || 0, game.maxStreak);
    db.prepare(`
      INSERT INTO cipher_scores (user_id, guild_id, username, total_score, games_played, games_won, best_streak, highest_difficulty, ciphers_cracked, last_played)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, guild_id) DO UPDATE SET
        username = excluded.username,
        total_score = total_score + excluded.total_score,
        games_played = games_played + 1,
        games_won = games_won + excluded.games_won,
        best_streak = excluded.best_streak,
        highest_difficulty = excluded.highest_difficulty,
        ciphers_cracked = ciphers_cracked + excluded.ciphers_cracked,
        last_played = excluded.last_played`)
      .run(game.userId, game.guildId, game.username, game.points, won ? 1 : 0, best, highest, game.cracked, Date.now());

    const g = db.prepare('SELECT global_score FROM cipher_global WHERE user_id = ?').get(game.userId);
    const globalPoints = (g?.global_score || 0) + game.points;
    db.prepare(`
      INSERT INTO cipher_global (user_id, username, global_score, global_wins, ciphers_total, rank_title)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        global_score = global_score + excluded.global_score,
        global_wins = global_wins + excluded.global_wins,
        ciphers_total = ciphers_total + excluded.ciphers_total,
        rank_title = excluded.rank_title`)
      .run(game.userId, game.username, game.points, won ? 1 : 0, game.cracked, rankFor(globalPoints));
    return globalPoints;
  } catch (e) {
    console.error(`${C.red}[CIPHER SCORE]${C.reset} ${e.message}`);
    return game.points;
  }
}

// ───────────────────────────── game state ─────────────────────────────
function createGame(interaction, tierKey, lang) {
  const tier = TIERS[tierKey];
  const rounds = pickWords(WORDS[tier.words], tier.rounds).map(word => {
    const method = tier.methods[Math.floor(Math.random() * tier.methods.length)];
    const shift = Math.floor(Math.random() * 25) + 1; // 1–25
    return { word, method, shift, cipher: encode(word, method, shift), timeMs: roundTime(tier, word, method), deadline: 0 };
  });
  return {
    userId: interaction.user.id, guildId: interaction.guildId, username: clean(interaction.user.username),
    interaction, lang, tierKey, tier, rounds,
    round: 0, streak: 0, maxStreak: 0, cracked: 0, points: 0, paid: 0, capped: false,
    phase: 'starting', timer: null, collector: null, startedAt: Date.now(),
  };
}

// ───────────────────────────── embeds ─────────────────────────────
function buttons(t, enabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cipher_answer').setLabel(t('btnAnswer')).setEmoji('🔓').setStyle(ButtonStyle.Success).setDisabled(!enabled),
    new ButtonBuilder().setCustomId('cipher_giveup').setLabel(t('btnGiveUp')).setEmoji('🏳️').setStyle(ButtonStyle.Secondary).setDisabled(!enabled),
  );
}

function baseEmbed(game, t) {
  return new EmbedBuilder()
    .setColor(game.tier.color)
    .setAuthor({ name: t('title', { tier: `${game.tier.emoji} ${t(`tiers.${game.tier.key}`)}` }), iconURL: game.interaction.client.user?.displayAvatarURL?.() })
    .setTimestamp();
}

function methodHint(r, t) {
  return t(`methods.${r.method.toLowerCase()}.hint`, { shift: r.shift, shift1: (r.shift + 1) % 26, shift2: (r.shift + 2) % 26 });
}

function roundEmbed(game, t) {
  const r = game.rounds[game.round];
  const shown = r.cipher.length <= 12 ? r.cipher.split('').join(' ') : r.cipher; // spaced letters are easier to read on phones
  const desc = (game.round === 0 ? `${t('howTo')}\n\n` : '') + '```\n' + shown + '\n```';
  return baseEmbed(game, t)
    .setTitle(t('roundTitle', { n: game.round + 1, total: game.tier.rounds, method: t(`methods.${r.method.toLowerCase()}.name`) }))
    .setDescription(desc)
    .addFields(
      { name: t('hint'), value: methodHint(r, t) },
      { name: t('timeLeft'), value: `<t:${Math.floor(r.deadline / 1000)}:R>` }, // Discord counts this down live
    )
    .setFooter({ text: t('footerRound', { streak: game.streak, credits: game.paid }) });
}

function resultEmbed(game, t, kind, extra = {}) {
  const e = baseEmbed(game, t);
  const credits = game.paid;
  const keep = credits > 0 ? ` ${t('keep', { credits })}` : '';
  switch (kind) {
    case 'correct':
      e.setColor(0x2ecc71).setTitle(t('correctTitle'))
        .setDescription(`${t('correctDesc', { word: extra.word, credits: extra.paid })}\n${t('nextSoon')}`);
      break;
    case 'wrong':
      e.setColor(0xe74c3c).setTitle(t('wrongTitle')).setDescription(t('wrongDesc', { word: extra.word, guess: extra.guess || '—' }) + keep);
      break;
    case 'timeout':
      e.setColor(0xe74c3c).setTitle(t('timeoutTitle')).setDescription(t('answerWas', { word: extra.word }) + keep);
      break;
    case 'giveup':
      e.setColor(0x95a5a6).setTitle(t('giveupTitle')).setDescription(t('answerWas', { word: extra.word }) + keep);
      break;
    case 'expired':
      e.setColor(0x95a5a6).setTitle(t('expiredTitle')).setDescription(t('expiredDesc') + keep);
      break;
    case 'victory':
      e.setColor(0xffd700).setTitle(t('victoryTitle', { tier: t(`tiers.${game.tier.key}`) }))
        .setDescription(
          t('victoryDesc', { rounds: game.tier.rounds, time: Math.round((Date.now() - game.startedAt) / 1000), streak: game.maxStreak, bonus: extra.bonus, credits })
          + `\n\n${t('rankLine', { rank: t(`ranks.${extra.rank || 'scriptKiddie'}`) })}`);
      break;
  }
  if (game.capped) e.addFields({ name: '\u200b', value: t('capNote', { cap: DAILY_CAP }) });
  return e.setFooter({ text: t('footerScore', { points: game.points, cracked: game.cracked }) });
}

// ───────────────────────────── game flow ─────────────────────────────
function armRound(game, db) {
  clearTimeout(game.timer);
  const idx = game.round;
  const r = game.rounds[idx];
  game.timer = setTimeout(() => {
    if (game.phase === 'round' && game.round === idx) finish(game, db, 'timeout', { word: r.word }).catch(() => {});
  }, Math.max(0, r.deadline - Date.now()) + GRACE_MS);
}

async function startGame(interaction, db, tierKey) {
  const lang = langFor(interaction);
  const t = tr(lang);
  if (!TIERS[tierKey]) tierKey = 'NOVICE';
  if (activeGames.has(interaction.user.id)) return interaction.reply({ content: t('alreadyPlaying'), flags: 64 });

  const game = createGame(interaction, tierKey, lang);
  activeGames.set(game.userId, game);
  try {
    game.rounds[0].deadline = Date.now() + game.rounds[0].timeMs;
    game.phase = 'round';
    await interaction.reply({ embeds: [roundEmbed(game, t)], components: [buttons(t, true)] });
    armRound(game, db);
    const msg = await interaction.fetchReply();
    const total = game.rounds.reduce((s, r) => s + r.timeMs + BETWEEN_MS + GRACE_MS, 0) + 30_000;
    game.collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: Math.min(MAX_RUN_MS, total) });
    game.collector.on('collect', (i) => onButton(game, db, i).catch(e => console.error(`${C.red}[CIPHER BUTTON]${C.reset} ${e.message}`)));
    game.collector.on('end', () => { if (game.phase !== 'over') finish(game, db, 'expired').catch(() => {}); });
  } catch (e) {
    clearTimeout(game.timer);
    game.phase = 'over';
    activeGames.delete(game.userId);
    console.error(`${C.red}[CIPHER START]${C.reset} ${e.message}`);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: t('error'), flags: 64 }).catch(() => {});
  }
}

async function onButton(game, db, i) {
  const t = tr(game.lang);
  if (i.user.id !== game.userId) return i.reply({ content: t('notYours'), flags: 64 }).catch(() => {});

  if (i.customId === 'cipher_giveup') {
    if (game.phase !== 'round') return i.reply({ content: t('oneMoment'), flags: 64 }).catch(() => {});
    await i.deferUpdate().catch(() => {});
    return finish(game, db, 'giveup', { word: game.rounds[game.round].word });
  }
  if (i.customId !== 'cipher_answer') return;
  if (game.phase !== 'round') return i.reply({ content: t('oneMoment'), flags: 64 }).catch(() => {});

  const idx = game.round;
  const modalId = `cipher_modal_${i.id}`;
  await i.showModal(new ModalBuilder().setCustomId(modalId).setTitle(t('modalTitle')).addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('answer').setLabel(t('modalLabel')).setPlaceholder(t('modalPlaceholder'))
        .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40)),
  ));

  // Wait a little past the deadline so a late submit gets a friendly "too late" instead of a failed interaction.
  const wait = Math.max(5000, game.rounds[idx].deadline - Date.now() + 15000);
  const sub = await i.awaitModalSubmit({ time: wait, filter: (m) => m.customId === modalId && m.user.id === game.userId }).catch(() => null);
  if (!sub) return;
  if (game.phase !== 'round' || game.round !== idx || Date.now() > game.rounds[idx].deadline + GRACE_MS) {
    return sub.reply({ content: t('tooLate'), flags: 64 }).catch(() => {});
  }
  await sub.deferUpdate().catch(() => {});
  return checkAnswer(game, db, sub.fields.getTextInputValue('answer'));
}

async function checkAnswer(game, db, guess) {
  if (game.phase !== 'round') return;
  const t = tr(game.lang);
  const r = game.rounds[game.round];
  clearTimeout(game.timer);

  if (norm(guess) !== norm(r.word)) return finish(game, db, 'wrong', { word: r.word, guess: clean(guess, 40) });

  game.streak++;
  game.maxStreak = Math.max(game.maxStreak, game.streak);
  game.cracked++;
  const pts = roundCredits(game.tier, game.streak);
  const paid = payCredits(db, game, pts);
  game.points += pts;
  game.paid += paid;
  if (paid < pts) game.capped = true;
  game.round++;

  if (game.round >= game.tier.rounds) return finish(game, db, 'victory');

  game.phase = 'between';
  await game.interaction.editReply({ embeds: [resultEmbed(game, t, 'correct', { word: r.word, paid })], components: [buttons(t, false)] }).catch(() => {});
  setTimeout(() => nextRound(game, db).catch(e => console.error(`${C.red}[CIPHER ROUND]${C.reset} ${e.message}`)), BETWEEN_MS);
}

async function nextRound(game, db) {
  if (game.phase !== 'between') return;
  const t = tr(game.lang);
  game.rounds[game.round].deadline = Date.now() + game.rounds[game.round].timeMs;
  game.phase = 'round';
  armRound(game, db);
  await game.interaction.editReply({ embeds: [roundEmbed(game, t)], components: [buttons(t, true)] });
}

async function finish(game, db, kind, extra = {}) {
  if (game.phase === 'over') return;
  game.phase = 'over';
  clearTimeout(game.timer);
  activeGames.delete(game.userId);
  const t = tr(game.lang);

  if (kind === 'victory') {
    const bonus = game.tier.reward * 2;
    const paid = payCredits(db, game, bonus);
    game.points += bonus;
    game.paid += paid;
    if (paid < bonus) game.capped = true;
    extra.bonus = bonus;
  }
  extra.rank = rankFor(saveRun(db, game, kind === 'victory'));

  await game.interaction.editReply({ embeds: [resultEmbed(game, t, kind, extra)], components: [] }).catch(() => {});
  game.collector?.stop('over');
}

// ───────────────────────────── leaderboard & profile ─────────────────────────────
function leaderboardEmbed(db, interaction, global, t) {
  let rows = [];
  try {
    rows = global
      ? db.prepare('SELECT username, global_score AS points, global_wins AS wins FROM cipher_global WHERE global_score > 0 ORDER BY global_score DESC LIMIT 10').all()
      : db.prepare('SELECT username, total_score AS points, games_won AS wins FROM cipher_scores WHERE guild_id = ? AND total_score > 0 ORDER BY total_score DESC LIMIT 10').all(interaction.guildId);
  } catch {}
  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.map((r, i) => t('lbLine', { medal: medals[i] || `**${i + 1}.**`, name: clean(r.username) || t('unknown'), points: r.points, wins: r.wins }));
  return new EmbedBuilder()
    .setColor(global ? 0xffd700 : 0x00d4ff)
    .setTitle(global ? t('lbGlobalTitle') : t('lbTitle', { guild: clean(interaction.guild?.name, 60) }))
    .setDescription(lines.length ? lines.join('\n') : t('lbEmpty'))
    .setFooter({ text: t('footer') })
    .setTimestamp();
}

function profileEmbed(db, interaction, t) {
  let s = null; let g = null;
  try { s = db.prepare('SELECT * FROM cipher_scores WHERE user_id = ? AND guild_id = ?').get(interaction.user.id, interaction.guildId); } catch {}
  try { g = db.prepare('SELECT * FROM cipher_global WHERE user_id = ?').get(interaction.user.id); } catch {}
  const tier = TIERS[s?.highest_difficulty];
  const played = (s?.games_played || 0) > 0;
  return new EmbedBuilder()
    .setColor(0x00d4ff)
    .setAuthor({ name: t('profileTitle', { name: clean(interaction.user.username) }), iconURL: interaction.user.displayAvatarURL?.() })
    .setThumbnail(interaction.user.displayAvatarURL?.({ size: 256 }) || null)
    .addFields(
      { name: t('pRank'), value: t(`ranks.${rankFor(g?.global_score || 0)}`), inline: true },
      { name: t('pPoints'), value: String(g?.global_score || 0), inline: true },
      { name: t('pWins'), value: String(g?.global_wins || 0), inline: true },
      { name: t('pCracked'), value: String(g?.ciphers_total || 0), inline: true },
      { name: t('pStreak'), value: String(s?.best_streak || 0), inline: true },
      { name: t('pTier'), value: played && tier ? `${tier.emoji} ${t(`tiers.${tier.key}`)}` : '—', inline: true },
      { name: t('pServer'), value: String(s?.total_score || 0), inline: true },
    )
    .setFooter({ text: t('footer') })
    .setTimestamp();
}

// ───────────────────────────── slash command ─────────────────────────────
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
  const lang = langFor(interaction);
  const t = tr(lang);
  const db = client?.db || interaction.client?.db;
  if (!interaction.guildId) return interaction.reply({ content: t('serverOnly'), flags: 64 }).catch(() => {});
  if (!db) return interaction.reply({ content: t('error'), flags: 64 }).catch(() => {});
  setupCipherDB(db);

  try {
    const sub = interaction.options.getSubcommand();
    if (sub === 'play') return await startGame(interaction, db, interaction.options.getString('difficulty'));
    if (sub === 'leaderboard') return await interaction.reply({ embeds: [leaderboardEmbed(db, interaction, false, t)] });
    if (sub === 'global') return await interaction.reply({ embeds: [leaderboardEmbed(db, interaction, true, t)] });
    if (sub === 'profile') return await interaction.reply({ embeds: [profileEmbed(db, interaction, t)] });
  } catch (e) {
    console.error(`${C.red}[CIPHER]${C.reset} ${e.message}`);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: t('error'), flags: 64 }).catch(() => {});
  }
}

// Prefix fallback: same argument order as the other plugins (client, message, args, database, serverSettings).
async function run(client, message, args, database, serverSettings) {
  let l = serverSettings?.language && serverSettings.language !== 'auto' ? serverSettings.language : 'en';
  if (l === 'bm') l = 'fr';
  if (!['en', 'fr', 'zh', 'ar'].includes(l)) l = 'en';
  return message.reply(tr(l)('slashOnly')).catch(() => {});
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
  _internals: { encode, norm, roundTime, roundCredits, rankFor, TIERS, WORDS, DAILY_CAP },
};

