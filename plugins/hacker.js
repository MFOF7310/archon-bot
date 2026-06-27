const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

// ================= NEURAL HACKER v1.0 — GLOBAL SLASH ONLY =================
// A pattern-recognition, code-breaking mini-game with police/intel styling
// Per-server leaderboards, economy integration, dynamic difficulty

const C = {
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', blue: '\x1b[34m', reset: '\x1b[0m'
};

// ================= GAME CONFIG =================
const DIFFICULTY = {
  RECRUIT:    { name: 'RECRUIT',    emoji: '🌱', rounds: 3, time: 15, base: 50,  multiplier: 1.0, patternLen: 3, colors: 3 },
  AGENT:      { name: 'AGENT',      emoji: '🔷', rounds: 4, time: 12, base: 100, multiplier: 1.5, patternLen: 4, colors: 4 },
  OPERATIVE:  { name: 'OPERATIVE',  emoji: '⚡', rounds: 5, time: 10, base: 200, multiplier: 2.0, patternLen: 5, colors: 5 },
  SPECIALIST: { name: 'SPECIALIST', emoji: '💎', rounds: 6, time: 8,  base: 350, multiplier: 3.0, patternLen: 6, colors: 6 },
  ARCHITECT:  { name: 'ARCHITECT',  emoji: '👑', rounds: 7, time: 6,  base: 500, multiplier: 5.0, patternLen: 7, colors: 7 }
};

const DIFFICULTY_RANK = {
  RECRUIT: 1, AGENT: 2, OPERATIVE: 3, SPECIALIST: 4, ARCHITECT: 5
};

const COLOR_SYMBOLS = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚪'];
const COLOR_NAMES = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE', 'WHITE'];

// ================= ACTIVE GAMES =================
const activeGames = new Map(); // userId -> gameState

// ================= DB SETUP =================
function setupHackerDB(database) {
  try {
    database.prepare(`
      CREATE TABLE IF NOT EXISTS hacker_scores (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        username TEXT,
        total_score INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        highest_difficulty TEXT DEFAULT 'RECRUIT',
        last_played INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
      )
    `).run();

    database.prepare(`
      CREATE TABLE IF NOT EXISTS hacker_global (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        global_score INTEGER DEFAULT 0,
        global_wins INTEGER DEFAULT 0,
        rank_title TEXT DEFAULT 'Script Kiddie'
      )
    `).run();

    database.prepare(`CREATE INDEX IF NOT EXISTS idx_hacker_guild ON hacker_scores(guild_id)`).run();
    database.prepare(`CREATE INDEX IF NOT EXISTS idx_hacker_score ON hacker_scores(total_score DESC)`).run();
    console.log(`${C.green}[HACKER]${C.reset} Database tables initialized`);
  } catch (e) {
    console.error(`${C.red}[HACKER DB]${C.reset} ${e.message}`);
  }
}

// ================= PATTERN GENERATOR =================
function generatePattern(length, colorCount) {
  const pattern = [];
  for (let i = 0; i < length; i++) {
    pattern.push(Math.floor(Math.random() * colorCount));
  }
  return pattern;
}

function patternToEmoji(pattern) {
  return pattern.map(i => COLOR_SYMBOLS[i]).join(' ');
}

function patternToNames(pattern) {
  return pattern.map(i => COLOR_NAMES[i]).join(' → ');
}

// ================= GAME STATE =================
function createGame(userId, guildId, difficulty) {
  const diff = DIFFICULTY[difficulty];
  return {
    userId,
    guildId,
    difficulty: diff,
    round: 1,
    score: 0,
    streak: 0,
    maxStreak: 0,
    patterns: [],
    startTime: Date.now(),
    status: 'playing',
    currentPattern: null,
    revealTime: null
  };
}

// ================= POLICE/INTEL EMBED BUILDER =================
function buildHackerEmbed(game, phase, extra = {}) {
  const diff = game.difficulty;
  const progress = '█'.repeat(game.round) + '░'.repeat(diff.rounds - game.round);

  let color, title, description, footer;

  switch (phase) {
    case 'intro':
      color = '#00d4ff';
      title = `🦅 NEURAL HACKER // ${diff.name} CLEARANCE`;
      description = 
        '```ansi\n' +
        `\u001b[1;36m╔══════════════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  \u001b[1;33mMISSION BRIEFING\u001b[0m                      \u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m╠══════════════════════════════════════════╣\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  Difficulty: ${diff.emoji} ${diff.name.padEnd(18)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  Rounds:     ${String(diff.rounds).padEnd(23)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  Time Limit: ${String(diff.time + 's').padEnd(21)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  Pattern:    ${String(diff.patternLen + ' colors').padEnd(17)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  Base Reward: ${String(diff.base + ' 🪙').padEnd(17)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m╚══════════════════════════════════════════╝\u001b[0m\n` +
        '```\n\n' +
        '🎯 **OBJECTIVE:** Memorize the color sequence and reproduce it.\n' +
        '⚡ **STREAK BONUS:** Consecutive correct answers multiply rewards!\n' +
        '💀 **FAILURE:** Wrong sequence or timeout = mission aborted.';
      footer = 'ARCHITECT CG-223 • Neural Hacker Division • BAMAKO_223 🇲🇱';
      break;

    case 'reveal':
      color = '#f39c12';
      title = `🔒 ENCRYPTING... ROUND ${game.round}/${diff.rounds}`;
      description = 
        `**MEMORIZE THIS SEQUENCE:**\n\n` +
        `### ${patternToEmoji(game.currentPattern)}\n\n` +
        `\`\`\`ansi\n` +
        `\u001b[1;33m[ ${patternToNames(game.currentPattern)} ]\u001b[0m\n` +
        `\u001b[1;31m⏱️ ${diff.time} SECONDS TO MEMORIZE...\u001b[0m\n` +
        `\`\`\``;
      footer = `Streak: ${game.streak} | Score: ${game.score} | Progress: ${progress}`;
      break;

    case 'input':
      color = '#2ecc71';
      title = `🔓 DECRYPT SEQUENCE — ROUND ${game.round}/${diff.rounds}`;
      description = 
        '**REPRODUCE THE PATTERN:**\n\n' +
        `Use the color buttons below to input the sequence!\n` +
        `Pattern length: **${diff.patternLen}** colors`;
      footer = `Streak: ${game.streak} | Score: ${game.score} | Time: ${diff.time}s`;
      break;

    case 'correct':
      color = '#2ecc71';
      title = `✅ SEQUENCE VERIFIED — ROUND ${game.round}/${diff.rounds}`;
      description = 
        '```ansi\n' +
        `\u001b[1;32m╔════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;32m║\u001b[0m  \u001b[1;33m✓ ACCESS GRANTED\u001b[0m            \u001b[1;32m║\u001b[0m\n` +
        `\u001b[1;32m║\u001b[0m  +${extra.points} 🪙 earned!\u001b[0m              \u001b[1;32m║\u001b[0m\n` +
        `\u001b[1;32m║\u001b[0m  Streak: ${game.streak}x 🔥\u001b[0m          \u001b[1;32m║\u001b[0m\n` +
        `\u001b[1;32m╚════════════════════════════════╝\u001b[0m\n` +
        '```';
      footer = `Total: ${game.score} 🪙 | Best Streak: ${game.maxStreak}`;
      break;

    case 'wrong':
      color = '#ff4757';
      title = '❌ ACCESS DENIED — SEQUENCE MISMATCH';
      description = 
        '```ansi\n' +
        `\u001b[1;31m╔════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;31m║\u001b[0m  \u001b[1;33m✗ BREACH DETECTED\u001b[0m           \u001b[1;31m║\u001b[0m\n` +
        `\u001b[1;31m║\u001b[0m  Expected: ${patternToEmoji(extra.expected)}\u001b[0m\n` +
        `\u001b[1;31m║\u001b[0m  You sent:  ${patternToEmoji(extra.got)}\u001b[0m\n` +
        `\u001b[1;31m╚════════════════════════════════╝\u001b[0m\n` +
        '```';
      footer = `Mission aborted. Final score: ${game.score} 🪙`;
      break;

    case 'timeout':
      color = '#ff4757';
      title = '⏱️ CONNECTION LOST — TIMEOUT';
      description = 
        '```ansi\n' +
        `\u001b[1;31m╔════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;31m║\u001b[0m  \u001b[1;33m⚠ SESSION EXPIRED\u001b[0m          \u001b[1;31m║\u001b[0m\n` +
        `\u001b[1;31m║\u001b[0m  Neural link severed.\u001b[0m        \u001b[1;31m║\u001b[0m\n` +
        `\u001b[1;31m╚════════════════════════════════╝\u001b[0m\n` +
        '```';
      footer = `Mission aborted. Final score: ${game.score} 🪙`;
      break;

    case 'victory':
      color = '#ffd700';
      title = `🏆 MISSION COMPLETE — ${diff.name} CLEARED!`;
      description = 
        '```ansi\n' +
        `\u001b[1;33m╔══════════════════════════════════════════╗\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  \u001b[1;32m🦅 ARCHITECT-LEVEL PERFORMANCE\u001b[0m        \u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m╠══════════════════════════════════════════╣\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  Final Score: ${String(game.score).padEnd(24)} 🪙\u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  Best Streak: ${String(game.maxStreak).padEnd(24)}x\u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  Difficulty:  ${String(diff.name).padEnd(24)}\u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m║\u001b[0m  Time:        ${String(Math.floor((Date.now() - game.startTime) / 1000) + 's').padEnd(24)}\u001b[1;33m║\u001b[0m\n` +
        `\u001b[1;33m╚══════════════════════════════════════════╝\u001b[0m\n` +
        '```\n\n' +
        (extra.bonus > 0 ? `💰 **PERFECT RUN BONUS:** +${extra.bonus} 🪙!\n` : '') +
        `🎖️ **RANK:** ${extra.rank}`;
      footer = 'ARCHITECT CG-223 • Neural Hacker Division • Mission Accomplished';
      break;
  }

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: title, iconURL: extra.client?.user?.displayAvatarURL() })
    .setDescription(description)
    .setFooter({ text: footer, iconURL: extra.client?.user?.displayAvatarURL() })
    .setTimestamp();
}

// ================= BUTTON BUILDER =================
function buildColorButtons(difficulty, disabled = false) {
  const rows = [];
  const colors = difficulty.colors;

  // First row: colors 0-3
  const row1 = new ActionRowBuilder();
  for (let i = 0; i < Math.min(4, colors); i++) {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`hacker_color_${i}`)
        .setEmoji(COLOR_SYMBOLS[i])
        .setLabel(COLOR_NAMES[i])
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    );
  }
  rows.push(row1);

  // Second row: colors 4-6
  if (colors > 4) {
    const row2 = new ActionRowBuilder();
    for (let i = 4; i < colors; i++) {
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`hacker_color_${i}`)
          .setEmoji(COLOR_SYMBOLS[i])
          .setLabel(COLOR_NAMES[i])
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled)
      );
    }
    rows.push(row2);
  }

  return rows;
}

function buildDifficultyButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hacker_diff_RECRUIT').setEmoji('🌱').setLabel('RECRUIT').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('hacker_diff_AGENT').setEmoji('🔷').setLabel('AGENT').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('hacker_diff_OPERATIVE').setEmoji('⚡').setLabel('OPERATIVE').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('hacker_diff_SPECIALIST').setEmoji('💎').setLabel('SPECIALIST').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('hacker_diff_ARCHITECT').setEmoji('👑').setLabel('ARCHITECT').setStyle(ButtonStyle.Danger)
    )
  ];
}

// ================= SCORE MANAGEMENT =================
function updateScore(database, userId, guildId, username, score, won, difficulty) {
  try {
    const now = Date.now();
    const newRank = DIFFICULTY_RANK[difficulty] || 0;

    const current = database.prepare(`
      SELECT highest_difficulty, best_streak, total_score, games_played, games_won
      FROM hacker_scores WHERE user_id = ? AND guild_id = ?
    `).get(userId, guildId);

    const oldRank = DIFFICULTY_RANK[current?.highest_difficulty] || 0;
    const highestDiff = newRank > oldRank ? difficulty : (current?.highest_difficulty || difficulty);

    database.prepare(`
      INSERT INTO hacker_scores (user_id, guild_id, username, total_score, games_played, games_won, best_streak, highest_difficulty, last_played)
      VALUES (?, ?, ?, ?, 1, ?, 0, ?, ?)
      ON CONFLICT(user_id, guild_id) DO UPDATE SET
        total_score = total_score + ?,
        games_played = games_played + 1,
        games_won = games_won + ?,
        best_streak = CASE WHEN ? > best_streak THEN ? ELSE best_streak END,
        highest_difficulty = ?,
        last_played = ?,
        username = ?
    `).run(userId, guildId, username, score, won ? 1 : 0, highestDiff, now,
      score, won ? 1 : 0, score, score, highestDiff, now, username);

    const rankTitles = ['Script Kiddie', 'Neural Initiate', 'Cyber Agent', 'Ghost Operative', 'System Architect', 'Supreme Hacker'];
    const global = database.prepare(`SELECT global_score FROM hacker_global WHERE user_id = ?`).get(userId);
    const newGlobalScore = (global?.global_score || 0) + score;
    const rankIndex = Math.min(5, Math.floor(newGlobalScore / 2500));

    database.prepare(`
      INSERT INTO hacker_global (user_id, username, global_score, global_wins, rank_title)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        global_score = global_score + ?,
        global_wins = global_wins + ?,
        rank_title = CASE WHEN ? > global_score THEN ? ELSE rank_title END,
        username = ?
    `).run(userId, username, score, won ? 1 : 0, rankTitles[rankIndex],
      score, won ? 1 : 0, newGlobalScore, rankTitles[rankIndex], username);

  } catch (e) {
    console.error(`${C.red}[HACKER SCORE]${C.reset} ${e.message}`);
  }
}

function getLeaderboard(database, guildId, limit = 10) {
  try {
    return database.prepare(`
      SELECT username, total_score, games_played, games_won, best_streak, highest_difficulty
      FROM hacker_scores
      WHERE guild_id = ?
      ORDER BY total_score DESC
      LIMIT ?
    `).all(guildId, limit);
  } catch (e) {
    return [];
  }
}

function getGlobalLeaderboard(database, limit = 10) {
  try {
    return database.prepare(`
      SELECT username, global_score, global_wins, rank_title
      FROM hacker_global
      ORDER BY global_score DESC
      LIMIT ?
    `).all(limit);
  } catch (e) {
    return [];
  }
}

// ================= RANK CALCULATOR =================
function calculateRank(score, streak, difficulty) {
  const diffMult = DIFFICULTY[difficulty]?.multiplier || 1;
  const total = score * diffMult * (1 + streak * 0.1);

  if (total >= 5000) return { title: '👑 SUPREME HACKER', color: '#ffd700', badge: 'LEGENDARY' };
  if (total >= 3000) return { title: '💎 GHOST OPERATIVE', color: '#9b59b6', badge: 'ELITE' };
  if (total >= 1500) return { title: '⚡ SYSTEM ARCHITECT', color: '#00d4ff', badge: 'MASTER' };
  if (total >= 800)  return { title: '🔷 CYBER AGENT', color: '#3498db', badge: 'EXPERT' };
  if (total >= 400)  return { title: '🌱 NEURAL INITIATE', color: '#2ecc71', badge: 'SKILLED' };
  return { title: '💻 SCRIPT KIDDIE', color: '#95a5a6', badge: 'NOVICE' };
}

// ================= GAME LOGIC =================
async function startGame(interaction, database, difficulty) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Check if already playing
  if (activeGames.has(userId)) {
    return interaction.reply({
      content: '❌ **MISSION IN PROGRESS** — You already have an active Neural Hacker session!',
      flags: 64
    });
  }

  const game = createGame(userId, guildId, difficulty);
  activeGames.set(userId, game);

  // Show intro
  const introEmbed = buildHackerEmbed(game, 'intro', { client: interaction.client });
  await interaction.reply({ embeds: [introEmbed], components: [], ephemeral: false });

  // Wait 3 seconds then start first round
  await new Promise(r => setTimeout(r, 3000));
  await playRound(interaction, database, game);
}

async function playRound(interaction, database, game) {
  if (game.status !== 'playing') return;

  const diff = game.difficulty;

  // Generate pattern
  game.currentPattern = generatePattern(diff.patternLen, diff.colors);
  game.patterns.push(game.currentPattern);

  // REVEAL PHASE
  const revealEmbed = buildHackerEmbed(game, 'reveal', { client: interaction.client });
  const msg = await interaction.editReply({ embeds: [revealEmbed], components: [] });

  // Wait for reveal time
  await new Promise(r => setTimeout(r, diff.time * 1000));

  if (game.status !== 'playing') return;

  // INPUT PHASE
  const inputEmbed = buildHackerEmbed(game, 'input', { client: interaction.client });
  const buttons = buildColorButtons(diff);

  await interaction.editReply({ embeds: [inputEmbed], components: buttons });

  // Set up collector
  const collector = interaction.channel.createMessageComponentCollector({
    filter: i => i.user.id === game.userId && i.customId.startsWith('hacker_color_'),
    time: diff.time * 1000
  });

  const playerInput = [];

  collector.on('collect', async i => {
    const colorIdx = parseInt(i.customId.replace('hacker_color_', ''));
    playerInput.push(colorIdx);

    await i.deferUpdate();

    // Check if complete
    if (playerInput.length >= diff.patternLen) {
      collector.stop('complete');
    }
  });

  collector.on('end', async (collected, reason) => {
    if (game.status !== 'playing') return;

    if (reason === 'time') {
      // TIMEOUT
      game.status = 'timeout';
      activeGames.delete(game.userId);

      const timeoutEmbed = buildHackerEmbed(game, 'timeout', { client: interaction.client });
      await interaction.editReply({ embeds: [timeoutEmbed], components: [] });

      updateScore(database, game.userId, game.guildId, interaction.user.username, game.score, false, game.difficulty.name);
      return;
    }

    // Check correctness
    const correct = playerInput.every((val, idx) => val === game.currentPattern[idx]) && 
                    playerInput.length === game.currentPattern.length;

    if (correct) {
      // CORRECT!
      game.streak++;
      if (game.streak > game.maxStreak) game.maxStreak = game.streak;

      const streakBonus = Math.floor(game.streak * 0.5 * diff.base);
      const roundPoints = diff.base + streakBonus;
      game.score += roundPoints;

      const correctEmbed = buildHackerEmbed(game, 'correct', { 
        client: interaction.client, 
        points: roundPoints 
      });
      await interaction.editReply({ embeds: [correctEmbed], components: [] });

      game.round++;

      if (game.round > diff.rounds) {
        // VICTORY!
        game.status = 'victory';
        activeGames.delete(game.userId);

        const perfectBonus = game.streak >= diff.rounds ? Math.floor(diff.base * 2) : 0;
        game.score += perfectBonus;

        const rank = calculateRank(game.score, game.maxStreak, game.difficulty.name);

        const victoryEmbed = buildHackerEmbed(game, 'victory', { 
          client: interaction.client, 
          bonus: perfectBonus,
          rank: rank.title
        });

        // Add credits to user
        if (interaction.client.addCredits) {
          interaction.client.addCredits(game.userId, game.guildId, game.score);
        }

        await interaction.editReply({ embeds: [victoryEmbed], components: [] });
        updateScore(database, game.userId, game.guildId, interaction.user.username, game.score, true, game.difficulty.name);

      } else {
        // Next round
        await new Promise(r => setTimeout(r, 1500));
        await playRound(interaction, database, game);
      }

    } else {
      // WRONG!
      game.status = 'wrong';
      activeGames.delete(game.userId);

      const wrongEmbed = buildHackerEmbed(game, 'wrong', { 
        client: interaction.client,
        expected: game.currentPattern,
        got: playerInput
      });
      await interaction.editReply({ embeds: [wrongEmbed], components: [] });

      updateScore(database, game.userId, game.guildId, interaction.user.username, game.score, false, game.difficulty.name);
    }
  });
}

// ================= LEADERBOARD EMBED =================
function buildLeaderboardEmbed(database, guild, client, global = false) {
  const entries = global 
    ? getGlobalLeaderboard(database, 10)
    : getLeaderboard(database, guild.id, 10);

  const title = global ? '🌍 GLOBAL HACKER NETWORK' : `🏛️ ${guild.name} OPERATIVES`;
  const color = global ? '#ffd700' : '#00d4ff';

  let description = '```ansi\n';

  if (entries.length === 0) {
    description += '\u001b[1;33m[ NO DATA AVAILABLE ]\u001b[0m\n\u001b[33mBe the first to complete a mission!\u001b[0m\n';
  } else {
    description += '\u001b[1;36m╔════╦══════════════════════╦══════════╦═══════╗\u001b[0m\n';
    description += '\u001b[1;36m║\u001b[0m RANK \u001b[1;36m║\u001b[0m OPERATIVE           \u001b[1;36m║\u001b[0m SCORE   \u001b[1;36m║\u001b[0m WINS  \u001b[1;36m║\u001b[0m\n';
    description += '\u001b[1;36m╠════╬══════════════════════╬══════════╬═══════╣\u001b[0m\n';

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    entries.forEach((entry, idx) => {
      const rank = medals[idx] || `${idx + 1}`;
      const name = (entry.username || 'Unknown').substring(0, 18).padEnd(18);
      const score = String(entry.total_score || entry.global_score || 0).padStart(7);
      const wins = String(entry.games_won || entry.global_wins || 0).padStart(4);
      description += `\u001b[1;36m║\u001b[0m ${rank}  \u001b[1;36m║\u001b[0m ${name} \u001b[1;36m║\u001b[0m ${score} \u001b[1;36m║\u001b[0m ${wins} \u001b[1;36m║\u001b[0m\n`;
    });

    description += '\u001b[1;36m╚════╩══════════════════════╩══════════╩═══════╝\u001b[0m\n';
  }

  description += '```';

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `🦅 NEURAL HACKER // ${title}`, iconURL: client.user?.displayAvatarURL() })
    .setDescription(description)
    .setFooter({ text: 'ARCHITECT CG-223 • Neural Hacker Division • BAMAKO_223 🇲🇱', iconURL: client.user?.displayAvatarURL() })
    .setTimestamp();
}

// ================= SLASH COMMAND =================
const slashCommand = new SlashCommandBuilder()
  .setName('hacker')
  .setDescription('🦅 Neural Hacker — Pattern recognition mini-game')
  .addSubcommand(sub =>
    sub.setName('play')
      .setDescription('🎮 Start a new Neural Hacker mission')
      .addStringOption(opt =>
        opt.setName('difficulty')
          .setDescription('Select mission difficulty')
          .setRequired(true)
          .addChoices(
            { name: '🌱 RECRUIT (Easy)', value: 'RECRUIT' },
            { name: '🔷 AGENT (Medium)', value: 'AGENT' },
            { name: '⚡ OPERATIVE (Hard)', value: 'OPERATIVE' },
            { name: '💎 SPECIALIST (Expert)', value: 'SPECIALIST' },
            { name: '👑 ARCHITECT (Impossible)', value: 'ARCHITECT' }
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('leaderboard')
      .setDescription('🏆 View server leaderboard')
  )
  .addSubcommand(sub =>
    sub.setName('global')
      .setDescription('🌍 View global hacker network')
  )
  .addSubcommand(sub =>
    sub.setName('profile')
      .setDescription('👤 View your hacker profile')
  );

// ================= COMMAND HANDLER =================
async function executeSlashCommand(interaction, client) {
  const database = client.db;
  if (!database) {
    return interaction.reply({ content: '❌ Database unavailable.', flags: 64 });
  }

  setupHackerDB(database);

  const sub = interaction.options.getSubcommand();

  if (sub === 'play') {
    const difficulty = interaction.options.getString('difficulty');
    await startGame(interaction, database, difficulty);

  } else if (sub === 'leaderboard') {
    const embed = buildLeaderboardEmbed(database, interaction.guild, client, false);
    await interaction.reply({ embeds: [embed] });

  } else if (sub === 'global') {
    const embed = buildLeaderboardEmbed(database, interaction.guild, client, true);
    await interaction.reply({ embeds: [embed] });

  } else if (sub === 'profile') {
    await showProfile(interaction, database);
  }
}

async function showProfile(interaction, database) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  try {
    const serverStats = database.prepare(`
      SELECT * FROM hacker_scores WHERE user_id = ? AND guild_id = ?
    `).get(userId, guildId);

    const globalStats = database.prepare(`
      SELECT * FROM hacker_global WHERE user_id = ?
    `).get(userId);

    const rank = calculateRank(
      globalStats?.global_score || 0, 
      serverStats?.best_streak || 0, 
      serverStats?.highest_difficulty || 'RECRUIT'
    );

    const embed = new EmbedBuilder()
      .setColor(rank.color)
      .setAuthor({ 
        name: `🦅 ${interaction.user.username} // OPERATIVE DOSSIER`, 
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
        `\u001b[1;36m║\u001b[0m  🔥 Best Streak:  ${String(serverStats?.best_streak || 0).padEnd(23)}x\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  🎯 Max Diff:    ${String(serverStats?.highest_difficulty || 'RECRUIT').padEnd(21)}\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  📊 Server Score: ${String(serverStats?.total_score || 0).padEnd(21)} 🪙\u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m╚══════════════════════════════════════════╝\u001b[0m\n` +
        '```'
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({ 
        text: 'ARCHITECT CG-223 • Neural Hacker Division • BAMAKO_223 🇲🇱', 
        iconURL: client.user?.displayAvatarURL() 
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (e) {
    console.error(`${C.red}[HACKER PROFILE]${C.reset} ${e.message}`);
    await interaction.reply({ content: '❌ Failed to load profile.', flags: 64 });
  }
}

// ================= PREFIX FALLBACK =================
async function run(client, message, args, db, usedCommand, serverSettings, lang) {
  const reply = lang === 'fr'
    ? `⚡ Cette commande est uniquement disponible en slash. Utilisez \`/hacker\`.`
    : `⚡ This command is only available as a slash command. Use \`/hacker\`.`;
  return message.reply(reply);
}

// ================= MODULE EXPORTS =================
module.exports = {
  name: 'hacker',
  aliases: ['neuralhacker', 'hack', 'pattern'],
  description: '🦅 Neural Hacker — Pattern recognition mini-game with police/intel styling, per-server leaderboards, and economy rewards',
  category: 'GAMING',
  cooldown: 10000,
  usage: '/hacker play <difficulty>',

  data: slashCommand,
  execute: executeSlashCommand,run,

  // DB exports for index.js
  setupHackerDB
};
