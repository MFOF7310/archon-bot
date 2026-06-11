const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

// ================= NEURAL CIPHER v1.0 — GUILD SLASH ONLY =================
// Decrypt shifting codes before neural link collapses
// Guild-only registration: instant, no global wait

const C = {
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', blue: '\x1b[34m', reset: '\x1b[0m'
};

// ================= CIPHER ENGINE =================
const WORD_BANK = {
  easy: ['CODE', 'HACK', 'DATA', 'NODE', 'LINK', 'NEURAL', 'CYBER', 'GHOST', 'AGENT', 'BREACH'],
  medium: ['ENCRYPT', 'DECRYPT', 'FIREWALL', 'PROTOCOL', 'DATABASE', 'SECURITY', 'MALWARE', 'PHISHING', 'TROJAN', 'KEYLOGGER'],
  hard: ['ALGORITHM', 'BLOCKCHAIN', 'BIOMETRIC', 'EXPLOITATION', 'STEGANOGRAPHY', 'CRYPTOGRAPHY', 'AUTHENTICATION', 'VULNERABILITY', 'INFILTRATION', 'EXFILTRATION'],
  expert: ['QUANTUMCOMPUTING', 'MACHNELEARNING', 'PENETRATIONTESTING', 'ADVANCEDPERSISTENT', 'CROSSSITESCRIPTING', 'DENIALOFSERVICE', 'MANINTHEMIDDLE', 'ZERO_DAY_EXPLOIT', 'ROOTKIT_DETECTION', 'BACKDOOR_ACCESS']
};

const SHIFT_PATTERNS = {
  CAESAR: { name: 'CAESAR SHIFT', emoji: '🔤', desc: 'Each letter shifted by fixed amount' },
  REVERSE: { name: 'REVERSE CIPHER', emoji: '🔀', desc: 'Word reversed, then shifted' },
  MIRROR: { name: 'MIRROR FLIP', emoji: '🪞', desc: 'A↔Z, B↔Y, C↔X... Atbash style' },
  ROTATE: { name: 'ROTATION LOCK', emoji: '🔄', desc: 'Each letter shifted by position' }
};

// ================= DIFFICULTY =================
const DIFFICULTY = {
  NOVICE:     { name: 'NOVICE',     emoji: '🌱', time: 20, rounds: 3, base: 60,  mult: 1.0, wordSet: 'easy',    shifts: ['CAESAR'] },
  OPERATIVE:  { name: 'OPERATIVE',  emoji: '🔷', time: 18, rounds: 4, base: 120, mult: 1.5, wordSet: 'easy',    shifts: ['CAESAR', 'REVERSE'] },
  SPECIALIST: { name: 'SPECIALIST', emoji: '⚡', time: 15, rounds: 5, base: 200, mult: 2.0, wordSet: 'medium',  shifts: ['CAESAR', 'REVERSE', 'MIRROR'] },
  ELITE:      { name: 'ELITE',      emoji: '💎', time: 12, rounds: 6, base: 350, mult: 3.0, wordSet: 'medium',  shifts: ['CAESAR', 'REVERSE', 'MIRROR', 'ROTATE'] },
  ARCHITECT:  { name: 'ARCHITECT',  emoji: '👑', time: 10, rounds: 7, base: 500, mult: 5.0, wordSet: 'hard',    shifts: ['CAESAR', 'REVERSE', 'MIRROR', 'ROTATE'] },
  SUPREME:    { name: 'SUPREME',    emoji: '☠️', time: 8,  rounds: 8, base: 800, mult: 8.0, wordSet: 'expert',  shifts: ['CAESAR', 'REVERSE', 'MIRROR', 'ROTATE'] }
};

const DIFFICULTY_RANK = {
  NOVICE: 1, OPERATIVE: 2, SPECIALIST: 3, ELITE: 4, ARCHITECT: 5, SUPREME: 6
};

// ================= ACTIVE GAMES =================
const activeGames = new Map();

// ================= DB SETUP =================
function setupCipherDB(database) {
  try {
    database.prepare(`
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
      )
    `).run();

    database.prepare(`
      CREATE TABLE IF NOT EXISTS cipher_global (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        global_score INTEGER DEFAULT 0,
        global_wins INTEGER DEFAULT 0,
        ciphers_total INTEGER DEFAULT 0,
        rank_title TEXT DEFAULT 'Script Kiddie'
      )
    `).run();

    database.prepare(`CREATE INDEX IF NOT EXISTS idx_cipher_guild ON cipher_scores(guild_id)`).run();
    database.prepare(`CREATE INDEX IF NOT EXISTS idx_cipher_score ON cipher_scores(total_score DESC)`).run();
    console.log(`${C.green}[CIPHER]${C.reset} Database tables initialized`);
  } catch (e) {
    console.error(`${C.red}[CIPHER DB]${C.reset} ${e.message}`);
  }
}

// ================= CIPHER ALGORITHMS =================
function caesarShift(text, shift) {
  return text.split('').map(c => {
    if (!/[A-Z]/.test(c)) return c;
    return String.fromCharCode(((c.charCodeAt(0) - 65 + shift + 26) % 26) + 65);
  }).join('');
}

function reverseCipher(text, shift) {
  const reversed = text.split('').reverse().join('');
  return caesarShift(reversed, shift);
}

function mirrorCipher(text) {
  return text.split('').map(c => {
    if (!/[A-Z]/.test(c)) return c;
    return String.fromCharCode(90 - (c.charCodeAt(0) - 65));
  }).join('');
}

function rotateCipher(text, baseShift) {
  return text.split('').map((c, i) => {
    if (!/[A-Z]/.test(c)) return c;
    const shift = (baseShift + i) % 26;
    return String.fromCharCode(((c.charCodeAt(0) - 65 + shift + 26) % 26) + 65);
  }).join('');
}

function encryptWord(word, mode) {
  const shift = Math.floor(Math.random() * 25) + 1; // 1-25
  let encrypted, hint;

  switch (mode) {
    case 'CAESAR':
      encrypted = caesarShift(word, shift);
      hint = `Shift: ${shift}`;
      break;
    case 'REVERSE':
      encrypted = reverseCipher(word, shift);
      hint = `Reversed + Shift: ${shift}`;
      break;
    case 'MIRROR':
      encrypted = mirrorCipher(word);
      hint = 'A↔Z, B↔Y, C↔X...';
      break;
    case 'ROTATE':
      encrypted = rotateCipher(word, shift);
      hint = `Position-based shift (base: ${shift})`;
      break;
  }

  return { encrypted, hint, mode, shift, original: word };
}

// ================= GAME STATE =================
function createGame(userId, guildId, difficulty) {
  const diff = DIFFICULTY[difficulty];
  const words = WORD_BANK[diff.wordSet];
  const rounds = [];

  for (let i = 0; i < diff.rounds; i++) {
    const word = words[Math.floor(Math.random() * words.length)];
    const mode = diff.shifts[Math.floor(Math.random() * diff.shifts.length)];
    rounds.push(encryptWord(word, mode));
  }

  return {
    userId, guildId,
    difficulty: diff,
    round: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    rounds,
    startTime: Date.now(),
    status: 'playing',
    ciphersCracked: 0
  };
}

// ================= EMBED BUILDER =================
function buildCipherEmbed(game, phase, extra = {}) {
  const diff = game.difficulty;
  let color, title, description, footer;

  switch (phase) {
    case 'intro':
      color = '#00d4ff';
      title = `🦅 NEURAL CIPHER // ${diff.name} CLEARANCE`;
      description = 
        '```ansi\n' +
        `\u001b[1;36m╔══════════════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  \u001b[1;33mMISSION: DECRYPT NEURAL TRANSMISSIONS\u001b[0m  \u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m╠══════════════════════════════════════════╣\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  Difficulty: ${diff.emoji} ${diff.name.padEnd(16)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  Rounds:     ${String(diff.rounds).padEnd(23)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  Time/Round:  ${String(diff.time + 's').padEnd(21)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  Base Reward: ${String(diff.base + ' 🪙').padEnd(17)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  Cipher Set:  ${String(diff.shifts.length + ' methods').padEnd(16)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m╚══════════════════════════════════════════╝\u001b[0m\n` +
        '```\n\n' +
        '🎯 **OBJECTIVE:** Decrypt the intercepted transmissions.\n' +
        '🔥 **STREAK BONUS:** Consecutive correct decryptions multiply rewards!\n' +
        '💀 **FAILURE:** Wrong answer or timeout = neural link severed.';
      footer = 'ARCHITECT CG-223 • Neural Cipher Division • BAMAKO_223 🇲🇱';
      break;

    case 'round': {
      const current = game.rounds[game.round];
      const pattern = SHIFT_PATTERNS[current.mode];
      color = '#f39c12';
      title = `🔐 TRANSMISSION ${game.round + 1}/${diff.rounds} — ${pattern.emoji} ${pattern.name}`;
      description = 
        `**INTERCEPTED SIGNAL:**\n\n` +
        '```ansi\n' +
        `\u001b[1;33m╔══════════════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  \u001b[1;31m${current.encrypted.padEnd(36)}\u001b[0m  \u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m╠══════════════════════════════════════════╣\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  \u001b[1;36mHINT: ${current.hint.padEnd(29)}\u001b[0m  \u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  \u001b[1;36mTYPE: ${pattern.desc.padEnd(29)}\u001b[0m  \u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m╚══════════════════════════════════════════╝\u001b[0m\n` +
        '```\n\n' +
        `⏱️ **DECRYPT IN:** ${diff.time} seconds`;
      footer = `Streak: ${game.streak} | Score: ${game.score} | Ciphers: ${game.ciphersCracked}`;
      break;
    }

    case 'correct':
      color = '#2ecc71';
      title = `✅ SIGNAL DECRYPTED — ROUND ${game.round + 1}/${diff.rounds}`;
      description = 
        '```ansi\n' +
        `\u001b[1;32m╔══════════════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;32m║\u001b[0m  \u001b[1;33m✓ ACCESS GRANTED\u001b[0m                      \u001b[1;32m║\u001b[0m\n` +
        `\u001b[1;32m║\u001b[0m  Plaintext: ${extra.original.padEnd(26)}\u001b[1;32m║\u001b[0m\n` +
        `\u001b[1;32m║\u001b[0m  +${extra.points} 🪙 earned!\u001b[0m                        \u001b[1;32m║\u001b[0m\n` +
        `\u001b[1;32m║\u001b[0m  Streak: ${String(game.streak + 'x 🔥').padEnd(28)}\u001b[1;32m║\u001b[0m\n` +
        `\u001b[1;32m╚══════════════════════════════════════════╝\u001b[0m\n` +
        '```';
      footer = `Total: ${game.score + extra.points} 🪙 | Best Streak: ${Math.max(game.maxStreak, game.streak + 1)}`;
      break;

    case 'wrong':
      color = '#ff4757';
      title = '❌ DECRYPTION FAILED — BREACH DETECTED';
      description = 
        '```ansi\n' +
        `\u001b[1;31m╔══════════════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;31m║\u001b[0m  \u001b[1;33m✗ SIGNAL CORRUPTED\u001b[0m                    \u001b[1;31m║\u001b[0m\n` +
        `\u001b[1;31m║\u001b[0m  Expected: ${extra.original.padEnd(26)}\u001b[1;31m║\u001b[0m\n` +
        `\u001b[1;31m║\u001b[0m  You sent:  ${extra.guess.padEnd(26)}\u001b[1;31m║\u001b[0m\n` +
        `\u001b[1;31m╚══════════════════════════════════════════╝\u001b[0m\n` +
        '```';
      footer = `Mission aborted. Final score: ${game.score} 🪙 | Ciphers cracked: ${game.ciphersCracked}`;
      break;

    case 'timeout':
      color = '#ff4757';
      title = '⏱️ NEURAL LINK SEVERED — TIMEOUT';
      description = 
        '```ansi\n' +
        `\u001b[1;31m╔══════════════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;31m║\u001b[0m  \u001b[1;33m⚠ CONNECTION LOST\u001b[0m                     \u001b[1;31m║\u001b[0m\n` +
        `\u001b[1;31m║\u001b[0m  Signal decayed before decryption.\u001b[0m   \u001b[1;31m║\u001b[0m\n` +
        `\u001b[1;31m║\u001b[0m  Expected: ${extra.original.padEnd(26)}\u001b[1;31m║\u001b[0m\n` +
        `\u001b[1;31m╚══════════════════════════════════════════╝\u001b[0m\n` +
        '```';
      footer = `Mission aborted. Final score: ${game.score} 🪙`;
      break;

    case 'victory':
      color = '#ffd700';
      title = `🏆 ALL TRANSMISSIONS DECRYPTED — ${diff.name} CLEARED!`;
      description = 
        '```ansi\n' +
        `\u001b[1;33m╔══════════════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  \u001b[1;32m🦅 ARCHITECT-LEVEL PERFORMANCE\u001b[0m        \u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m╠══════════════════════════════════════════╣\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  Final Score: ${String(game.score).padEnd(24)} 🪙\u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  Ciphers:     ${String(game.ciphersCracked).padEnd(24)} 🔓\u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  Best Streak: ${String(game.maxStreak).padEnd(23)}x\u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  Difficulty:  ${String(diff.name).padEnd(24)}\u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  Time:        ${String(Math.floor((Date.now() - game.startTime) / 1000) + 's').padEnd(24)}\u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m╚══════════════════════════════════════════╝\u001b[0m\n` +
        '```\n\n' +
        (extra.bonus > 0 ? `💰 **PERFECT RUN BONUS:** +${extra.bonus} 🪙!\n` : '') +
        `🎖️ **RANK:** ${extra.rank}`;
      footer = 'ARCHITECT CG-223 • Neural Cipher Division • Mission Accomplished';
      break;
  }

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: title, iconURL: extra.client?.user?.displayAvatarURL() })
    .setDescription(description)
    .setFooter({ text: footer, iconURL: extra.client?.user?.displayAvatarURL() })
    .setTimestamp();
}

// ================= SCORE MANAGEMENT =================
function updateCipherScore(database, userId, guildId, username, score, won, difficulty, ciphersCracked) {
  try {
    const now = Date.now();
    const newRank = DIFFICULTY_RANK[difficulty] || 0;

    // Fetch current record to compare difficulty properly
    const current = database.prepare(`
      SELECT highest_difficulty, best_streak, total_score, games_played, games_won, ciphers_cracked
      FROM cipher_scores WHERE user_id = ? AND guild_id = ?
    `).get(userId, guildId);

    const oldRank = DIFFICULTY_RANK[current?.highest_difficulty] || 0;
    const highestDiff = newRank > oldRank ? difficulty : (current?.highest_difficulty || difficulty);
    const bestStreak = Math.max(current?.best_streak || 0, won ? (ciphersCracked || 1) : 0);

    database.prepare(`
      INSERT INTO cipher_scores (user_id, guild_id, username, total_score, games_played, games_won, best_streak, highest_difficulty, ciphers_cracked, last_played)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, guild_id) DO UPDATE SET
        total_score = total_score + ?,
        games_played = games_played + 1,
        games_won = games_won + ?,
        best_streak = CASE WHEN ? > best_streak THEN ? ELSE best_streak END,
        highest_difficulty = ?,
        ciphers_cracked = ciphers_cracked + ?,
        last_played = ?,
        username = ?
    `).run(userId, guildId, username, score, won ? 1 : 0, bestStreak, highestDiff, ciphersCracked, now,
      score, won ? 1 : 0, bestStreak, bestStreak, highestDiff, ciphersCracked, now, username);

    // Global rank
    const rankTitles = ['Script Kiddie', 'Code Breaker', 'Cryptanalyst', 'Ghost Operative', 'Cipher Architect', 'Supreme Decryptor'];
    const global = database.prepare(`SELECT global_score FROM cipher_global WHERE user_id = ?`).get(userId);
    const newGlobalScore = (global?.global_score || 0) + score;
    const rankIndex = Math.min(5, Math.floor(newGlobalScore / 2000));

    database.prepare(`
      INSERT INTO cipher_global (user_id, username, global_score, global_wins, ciphers_total, rank_title)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        global_score = global_score + ?,
        global_wins = global_wins + ?,
        ciphers_total = ciphers_total + ?,
        rank_title = CASE WHEN ? > global_score THEN ? ELSE rank_title END,
        username = ?
    `).run(userId, username, score, won ? 1 : 0, ciphersCracked, rankTitles[rankIndex],
      score, won ? 1 : 0, ciphersCracked, newGlobalScore, rankTitles[rankIndex], username);

  } catch (e) {
    console.error(`${C.red}[CIPHER SCORE]${C.reset} ${e.message}`);
  }
}

function getCipherLeaderboard(database, guildId, limit = 10) {
  try {
    return database.prepare(`
      SELECT username, total_score, games_played, games_won, best_streak, highest_difficulty, ciphers_cracked
      FROM cipher_scores
      WHERE guild_id = ?
      ORDER BY total_score DESC
      LIMIT ?
    `).all(guildId, limit);
  } catch (e) {
    return [];
  }
}

function getCipherGlobalLeaderboard(database, limit = 10) {
  try {
    return database.prepare(`
      SELECT username, global_score, global_wins, ciphers_total, rank_title
      FROM cipher_global
      ORDER BY global_score DESC
      LIMIT ?
    `).all(limit);
  } catch (e) {
    return [];
  }
}

function calculateCipherRank(score, streak, difficulty) {
  const diffMult = DIFFICULTY[difficulty]?.mult || 1;
  const total = score * diffMult * (1 + streak * 0.15);

  if (total >= 4000) return { title: '👑 SUPREME DECRYPTOR', color: '#ffd700', badge: 'LEGENDARY' };
  if (total >= 2500) return { title: '💎 GHOST OPERATIVE', color: '#9b59b6', badge: 'ELITE' };
  if (total >= 1200) return { title: '⚡ CIPHER ARCHITECT', color: '#00d4ff', badge: 'MASTER' };
  if (total >= 600)  return { title: '🔷 CRYPTANALYST', color: '#3498db', badge: 'EXPERT' };
  if (total >= 250)  return { title: '🌱 CODE BREAKER', color: '#2ecc71', badge: 'SKILLED' };
  return { title: '💻 SCRIPT KIDDIE', color: '#95a5a6', badge: 'NOVICE' };
}

// ================= GAME LOGIC =================
async function startCipherGame(interaction, database, difficulty) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (activeGames.has(userId)) {
    return interaction.reply({
      content: '❌ **MISSION IN PROGRESS** — You already have an active Neural Cipher session!',
      ephemeral: true
    });
  }

  const game = createGame(userId, guildId, difficulty);
  activeGames.set(userId, game);

  const introEmbed = buildCipherEmbed(game, 'intro', { client: interaction.client });
  await interaction.reply({ embeds: [introEmbed] });

  await new Promise(r => setTimeout(r, 3000));
  await playCipherRound(interaction, database, game);
}

async function playCipherRound(interaction, database, game) {
  if (game.status !== 'playing') return;

  const diff = game.difficulty;
  const current = game.rounds[game.round];

  const roundEmbed = buildCipherEmbed(game, 'round', { client: interaction.client });
  await interaction.editReply({ embeds: [roundEmbed] });

  // Create message filter for text input
  const filter = m => m.author.id === game.userId && m.channelId === interaction.channelId;
  const collector = interaction.channel.createMessageCollector({ filter, time: diff.time * 1000 });

  let answered = false;

  collector.on('collect', async message => {
    if (answered) return;
    answered = true;
    collector.stop();

    const guess = message.content.toUpperCase().trim();
    const correct = guess === current.original;

    if (correct) {
      game.streak++;
      if (game.streak > game.maxStreak) game.maxStreak = game.streak;
      game.ciphersCracked++;

      const streakBonus = Math.floor(game.streak * 0.3 * diff.base);
      const roundPoints = diff.base + streakBonus;
      game.score += roundPoints;

      const correctEmbed = buildCipherEmbed(game, 'correct', { 
        client: interaction.client, 
        points: roundPoints,
        original: current.original
      });
      await interaction.editReply({ embeds: [correctEmbed] });

      game.round++;

      if (game.round >= diff.rounds) {
        // VICTORY!
        game.status = 'victory';
        activeGames.delete(game.userId);

        const perfectBonus = game.streak >= diff.rounds ? Math.floor(diff.base * 3) : 0;
        game.score += perfectBonus;

        const rank = calculateCipherRank(game.score, game.maxStreak, game.difficulty.name);

        const victoryEmbed = buildCipherEmbed(game, 'victory', { 
          client: interaction.client, 
          bonus: perfectBonus,
          rank: rank.title
        });

        if (interaction.client.addCredits) {
          interaction.client.addCredits(game.userId, game.guildId, game.score);
        }

        await interaction.editReply({ embeds: [victoryEmbed] });
        updateCipherScore(database, game.userId, game.guildId, interaction.user.username, game.score, true, game.difficulty.name, game.ciphersCracked);

      } else {
        await new Promise(r => setTimeout(r, 2000));
        await playCipherRound(interaction, database, game);
      }

    } else {
      // WRONG!
      game.status = 'wrong';
      activeGames.delete(game.userId);

      const wrongEmbed = buildCipherEmbed(game, 'wrong', { 
        client: interaction.client,
        original: current.original,
        guess: guess
      });
      await interaction.editReply({ embeds: [wrongEmbed] });

      updateCipherScore(database, game.userId, game.guildId, interaction.user.username, game.score, false, game.difficulty.name, game.ciphersCracked);
    }
  });

  collector.on('end', async (collected, reason) => {
    if (game.status !== 'playing' || answered) return;

    // TIMEOUT
    game.status = 'timeout';
    activeGames.delete(game.userId);

    const timeoutEmbed = buildCipherEmbed(game, 'timeout', { 
      client: interaction.client,
      original: current.original
    });
    await interaction.editReply({ embeds: [timeoutEmbed] });

    updateCipherScore(database, game.userId, game.guildId, interaction.user.username, game.score, false, game.difficulty.name, game.ciphersCracked);
  });
}

// ================= LEADERBOARD EMBED =================
function buildCipherLeaderboardEmbed(database, guild, client, global = false) {
  const entries = global 
    ? getCipherGlobalLeaderboard(database, 10)
    : getCipherLeaderboard(database, guild.id, 10);

  const title = global ? '🌍 GLOBAL CIPHER NETWORK' : `🏛️ ${guild.name} OPERATIVES`;
  const color = global ? '#ffd700' : '#00d4ff';

  let description = '```ansi\n';

  if (entries.length === 0) {
    description += '\u001b[1;33m[ NO DATA AVAILABLE ]\u001b[0m\n\u001b[33mBe the first to crack a cipher!\u001b[0m\n';
  } else {
    description += '\u001b[1;36m╔════╦══════════════════════╦══════════╦═══════╦═══════╗\u001b[0m\n';
    description += '\u001b[1;36m║\u001b[0m RANK \u001b[1;36m║\u001b[0m OPERATIVE           \u001b[1;36m║\u001b[0m SCORE   \u001b[1;36m║\u001b[0m WINS  \u001b[1;36m║\u001b[0m CIPHER\u001b[1;36m║\u001b[0m\n';
    description += '\u001b[1;36m╠════╬══════════════════════╬══════════╬═══════╬═══════╣\u001b[0m\n';

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    entries.forEach((entry, idx) => {
      const rank = medals[idx] || `${idx + 1}`;
      const name = (entry.username || 'Unknown').substring(0, 18).padEnd(18);
      const score = String(entry.total_score || entry.global_score || 0).padStart(7);
      const wins = String(entry.games_won || entry.global_wins || 0).padStart(4);
      const ciphers = String(entry.ciphers_cracked || entry.ciphers_total || 0).padStart(4);
      description += `\u001b[1;36m║\u001b[0m ${rank}  \u001b[1;36m║\u001b[0m ${name} \u001b[1;36m║\u001b[0m ${score} \u001b[1;36m║\u001b[0m ${wins} \u001b[1;36m║\u001b[0m ${ciphers}\u001b[1;36m║\u001b[0m\n`;
    });

    description += '\u001b[1;36m╚════╩══════════════════════╩══════════╩═══════╩═══════╝\u001b[0m\n';
  }

  description += '```';

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `🦅 NEURAL CIPHER // ${title}`, iconURL: client.user?.displayAvatarURL() })
    .setDescription(description)
    .setFooter({ text: 'ARCHITECT CG-223 • Neural Cipher Division • BAMAKO_223 🇲🇱', iconURL: client.user?.displayAvatarURL() })
    .setTimestamp();
}

// ================= PROFILE =================
async function showCipherProfile(interaction, database) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  try {
    const serverStats = database.prepare(`
      SELECT * FROM cipher_scores WHERE user_id = ? AND guild_id = ?
    `).get(userId, guildId);

    const globalStats = database.prepare(`
      SELECT * FROM cipher_global WHERE user_id = ?
    `).get(userId);

    const rank = calculateCipherRank(
      globalStats?.global_score || 0, 
      serverStats?.best_streak || 0, 
      serverStats?.highest_difficulty || 'NOVICE'
    );

    const embed = new EmbedBuilder()
      .setColor(rank.color)
      .setAuthor({ 
        name: `🦅 ${interaction.user.username} // CIPHER OPERATIVE DOSSIER`, 
        iconURL: interaction.user.displayAvatarURL() 
      })
      .setDescription(
        '```ansi\n' +
        `\u001b[1;${rank.color === '#ffd700' ? '33' : rank.color === '#9b59b6' ? '35' : '36'}m╔══════════════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  \u001b[1;33mCLEARANCE: ${rank.title}\u001b[0m              \u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m╠══════════════════════════════════════════╣\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  🏆 Rank:        ${(globalStats?.rank_title || 'Script Kiddie').padEnd(24)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  💰 Global Score: ${String(globalStats?.global_score || 0).padEnd(21)} 🪙\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  🎮 Games:       ${String(globalStats?.global_wins || 0).padEnd(22)} won\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  🔓 Ciphers:     ${String(globalStats?.ciphers_total || 0).padEnd(22)} cracked\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  🔥 Best Streak:  ${String(serverStats?.best_streak || 0).padEnd(23)}x\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  🎯 Max Diff:    ${String(serverStats?.highest_difficulty || 'NOVICE').padEnd(21)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  📊 Server Score: ${String(serverStats?.total_score || 0).padEnd(21)} 🪙\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m╚══════════════════════════════════════════╝\u001b[0m\n` +
        '```'
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({ 
        text: 'ARCHITECT CG-223 • Neural Cipher Division • BAMAKO_223 🇲🇱', 
        iconURL: interaction.client.user?.displayAvatarURL() 
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (e) {
    console.error(`${C.red}[CIPHER PROFILE]${C.reset} ${e.message}`);
    await interaction.reply({ content: '❌ Failed to load operative dossier.', ephemeral: true });
  }
}

// ================= SLASH COMMAND — GUILD ONLY =================
const slashCommand = new SlashCommandBuilder()
  .setName('cipher')
  .setDescription('🦅 Neural Cipher — Decrypt intercepted transmissions')
  .addSubcommand(sub =>
    sub.setName('play')
      .setDescription('🔐 Start a new decryption mission')
      .addStringOption(opt =>
        opt.setName('difficulty')
          .setDescription('Select mission clearance level')
          .setRequired(true)
          .addChoices(
            { name: '🌱 NOVICE (Easy)', value: 'NOVICE' },
            { name: '🔷 OPERATIVE (Medium)', value: 'OPERATIVE' },
            { name: '⚡ SPECIALIST (Hard)', value: 'SPECIALIST' },
            { name: '💎 ELITE (Expert)', value: 'ELITE' },
            { name: '👑 ARCHITECT (Impossible)', value: 'ARCHITECT' },
            { name: '☠️ SUPREME (Legendary)', value: 'SUPREME' }
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('leaderboard')
      .setDescription('🏆 View server operative rankings')
  )
  .addSubcommand(sub =>
    sub.setName('global')
      .setDescription('🌍 View global cipher network')
  )
  .addSubcommand(sub =>
    sub.setName('profile')
      .setDescription('👤 View your operative dossier')
  );

// ================= COMMAND HANDLER =================
async function executeSlashCommand(interaction, client) {
  const database = client.db;
  if (!database) {
    return interaction.reply({ content: '❌ Database unavailable.', ephemeral: true });
  }

  setupCipherDB(database);

  const sub = interaction.options.getSubcommand();

  if (sub === 'play') {
    const difficulty = interaction.options.getString('difficulty');
    await startCipherGame(interaction, database, difficulty);

  } else if (sub === 'leaderboard') {
    const embed = buildCipherLeaderboardEmbed(database, interaction.guild, client, false);
    await interaction.reply({ embeds: [embed] });

  } else if (sub === 'global') {
    const embed = buildCipherLeaderboardEmbed(database, interaction.guild, client, true);
    await interaction.reply({ embeds: [embed] });

  } else if (sub === 'profile') {
    await showCipherProfile(interaction, database);
  }
}

// ================= PREFIX FALLBACK =================
async function run(client, message, args, db, usedCommand, serverSettings, lang) {
  const reply = lang === 'fr'
    ? `⚡ Cette commande est uniquement disponible en slash. Utilisez \`/cipher\`.`
    : `⚡ This command is only available as a slash command. Use \`/cipher\`.`;
  return message.reply(reply);
}

// ================= MODULE EXPORTS =================
module.exports = {
  name: 'cipher',
  aliases: ['neuralcipher', 'decrypt', 'codebreak'],
  description: '🦅 Neural Cipher — Decrypt intercepted transmissions with police/intel styling. Guild-only slash command for instant registration.',
  category: 'GAMING',
  cooldown: 10000,
  usage: '/cipher play <difficulty>',

  data: slashCommand,
  execute: executeSlashCommand,run,

  // DB exports for index.js
  setupCipherDB,

  // IMPORTANT: This is a GUILD-ONLY command
  // Register with: Routes.applicationGuildCommands(clientId, guildId)
  // NOT: Routes.applicationCommands(clientId) — avoids 1-hour global wait
};
