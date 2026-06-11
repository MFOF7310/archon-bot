const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

const C = { green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m' };

// ================= NEURAL CLASSES =================
const CLASSES = {
  GHOST:  { name: 'Ghost',  emoji: '🥷', hp: 85,  dmg: 28, crit: 35, dodge: 30, armor: 5,  special: 'smoke',    specialName: 'Smoke Bomb',    specialDesc: '100% dodge next attack', cooldown: 3 },
  TITAN:  { name: 'Titan',  emoji: '🛡️', hp: 150, dmg: 18, crit: 10, dodge: 5,  armor: 20, special: 'fortress', specialName: 'Fortress',      specialDesc: '-60% damage for 2 turns', cooldown: 4 },
  SNIPER: { name: 'Sniper', emoji: '🎯', hp: 95,  dmg: 32, crit: 45, dodge: 10, armor: 8,  special: 'headshot', specialName: 'Headshot',      specialDesc: 'Guaranteed crit, ignores dodge', cooldown: 3 },
  HACKER: { name: 'Hacker', emoji: '💻', hp: 105, dmg: 22, crit: 15, dodge: 15, armor: 12, special: 'crash',    specialName: 'System Crash',  specialDesc: 'Stun opponent for 1 turn', cooldown: 3 }
};

// ================= RANKS =================
const DUEL_RANKS = [
  { name: 'Street Rat',       emoji: '🐀', min: 0,    max: 99 },
  { name: 'Neural Initiate',  emoji: '🌱', min: 100,  max: 299 },
  { name: 'Cyber Mercenary',  emoji: '🔷', min: 300,  max: 599 },
  { name: 'Ghost Operative',  emoji: '👻', min: 600,  max: 999 },
  { name: 'Arena Veteran',    emoji: '⚔️', min: 1000, max: 1499 },
  { name: 'Warlord',          emoji: '💀', min: 1500, max: 2199 },
  { name: 'Neural Gladiator', emoji: '🏆', min: 2200, max: 2999 },
  { name: 'Supreme Architect',emoji: '👑', min: 3000, max: Infinity }
];

// ================= ACTIVE GAMES =================
const activeDuels = new Map(); // messageId -> duelState

// ================= DB SETUP =================
function setupDuelDB(database) {
  try {
    database.prepare(`CREATE TABLE IF NOT EXISTS duel_scores (
      user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
      duels_played INTEGER DEFAULT 0, duels_won INTEGER DEFAULT 0, duels_lost INTEGER DEFAULT 0,
      elo INTEGER DEFAULT 100, highest_streak INTEGER DEFAULT 0, current_streak INTEGER DEFAULT 0,
      total_damage INTEGER DEFAULT 0, total_kills INTEGER DEFAULT 0, favorite_class TEXT DEFAULT 'GHOST',
      PRIMARY KEY (user_id, guild_id)
    )`).run();
    database.prepare(`CREATE TABLE IF NOT EXISTS duel_global (
      user_id TEXT PRIMARY KEY, username TEXT, global_elo INTEGER DEFAULT 100,
      global_wins INTEGER DEFAULT 0, global_kills INTEGER DEFAULT 0, rank_title TEXT DEFAULT 'Street Rat'
    )`).run();
    console.log(`${C.green}[DUEL]${C.reset} Neural Arena DB initialized`);
  } catch (e) { console.error(`${C.red}[DUEL DB]${C.reset} ${e.message}`); }
}

// ================= HELPERS =================
function hpBar(current, max) {
  const blocks = 15;
  const filled = Math.max(0, Math.round((current / max) * blocks));
  const empty = blocks - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + `  ${current}/${max}`;
}

function getDuelRank(elo) {
  return DUEL_RANKS.find(r => elo >= r.min && elo <= r.max) || DUEL_RANKS[DUEL_RANKS.length - 1];
}

function calcDamage(attacker, defender, isCrit = false, isSpecial = false) {
  let base = attacker.class.dmg;
  let armor = defender.armorBuff ? defender.class.armor * 0.4 : defender.class.armor;
  let dmg = Math.max(1, Math.floor(base * (1 - (armor / 100))));
  if (isCrit) dmg = Math.floor(dmg * 1.8);
  if (isSpecial) dmg = Math.floor(dmg * 1.5);
  return dmg;
}

function updateDuelScore(db, client, userId, guildId, username, won, damage, kills) {
  try {
    const current = db.prepare(`SELECT * FROM duel_scores WHERE user_id = ? AND guild_id = ?`).get(userId, guildId) || {};
    const oldElo = current.elo || 100;
    const newElo = won ? oldElo + 25 : Math.max(0, oldElo - 15);
    const streak = won ? (current.current_streak || 0) + 1 : 0;
    const bestStreak = Math.max(current.highest_streak || 0, streak);

    db.prepare(`INSERT INTO duel_scores (user_id, guild_id, username, duels_played, duels_won, duels_lost, elo, current_streak, highest_streak, total_damage, total_kills)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, guild_id) DO UPDATE SET
        duels_played = duels_played + 1,
        duels_won = duels_won + ?,
        duels_lost = duels_lost + ?,
        elo = ?,
        current_streak = ?,
        highest_streak = ?,
        total_damage = total_damage + ?,
        total_kills = total_kills + ?,
        username = ?`)
      .run(userId, guildId, username, won ? 1 : 0, won ? 0 : 1, newElo, streak, bestStreak, damage, kills,
        won ? 1 : 0, won ? 0 : 1, newElo, streak, bestStreak, damage, kills, username);

    const rank = getDuelRank(newElo);
    db.prepare(`INSERT INTO duel_global (user_id, username, global_elo, global_wins, global_kills, rank_title)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        global_elo = global_elo + ?,
        global_wins = global_wins + ?,
        global_kills = global_kills + ?,
        rank_title = ?,
        username = ?`)
      .run(userId, username, newElo, won ? 1 : 0, kills, rank.name,
        won ? 25 : -15, won ? 1 : 0, kills, rank.name, username);

    if (client.queueUserUpdate) {
      const u = client.getUserData ? client.getUserData(userId, guildId) : {};
      client.queueUserUpdate(userId, guildId, { ...u, credits: (u?.credits || 0) + (won ? 0 : 0) });
    }
  } catch (e) { console.error(`${C.red}[DUEL SCORE]${C.reset} ${e.message}`); }
}

// ================= ARENA EMBED =================
function buildArenaEmbed(duel, phase = 'battle', extra = {}) {
  const { p1, p2, turn, round, bet } = duel;
  const current = turn === p1.id ? p1 : p2;
  const waiting = turn === p1.id ? p2 : p1;

  let color = '#00d4ff';
  let title = `⚔️ NEURAL ARENA // ROUND ${round}`;
  let desc = '';

  if (phase === 'select') {
    color = '#f39c12';
    title = `🎯 SELECT YOUR NEURAL CLASS`;
    desc = `${p1.user}: **Choosing...**\n${p2.user}: **Choosing...**`;
  } else if (phase === 'battle') {
    const p1Status = [
      p1.stunned ? '⚡ STUNNED' : '',
      p1.dodgeNext ? '🌫️ DODGE READY' : '',
      p1.armorBuff ? '🛡️ FORTIFIED' : '',
      p1.bleed > 0 ? `🩸 BLEED ${p1.bleed}` : ''
    ].filter(Boolean).join('  ') || 'STATUS: NORMAL';

    const p2Status = [
      p2.stunned ? '⚡ STUNNED' : '',
      p2.dodgeNext ? '🌫️ DODGE READY' : '',
      p2.armorBuff ? '🛡️ FORTIFIED' : '',
      p2.bleed > 0 ? `🩸 BLEED ${p2.bleed}` : ''
    ].filter(Boolean).join('  ') || 'STATUS: NORMAL';

    desc =
      `\`\`\`ansi\n` +
      `\u001b[1;31m╔══════════════════════════════════════════╗\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  \u001b[1;36m${p1.class.emoji} ${p1.user.username.padEnd(14)}\u001b[0m  \u001b[1;33mVS\u001b[0m  \u001b[1;36m${p2.user.username.padEnd(14)} ${p2.class.emoji}\u001b[0m  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m╠══════════════════════════════════════════╣\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  HP: ${hpBar(p1.hp, p1.maxHp)}  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  EN: ${'⚡'.repeat(Math.floor(p1.energy/25))+'░'.repeat(4-Math.floor(p1.energy/25))} ${p1.energy}%  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  ${p1Status.padEnd(36)}  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m╠══════════════════════════════════════════╣\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  HP: ${hpBar(p2.hp, p2.maxHp)}  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  EN: ${'⚡'.repeat(Math.floor(p2.energy/25))+'░'.repeat(4-Math.floor(p2.energy/25))} ${p2.energy}%  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  ${p2Status.padEnd(36)}  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m╚══════════════════════════════════════════╝\u001b[0m\n` +
      `\`\`\`\n` +
      `💰 **POT:** ${bet.toLocaleString()} 🪙 | 🎯 **TURN:** ${current.user.username}`;
  } else if (phase === 'victory') {
    const winner = extra.winner;
    color = '#ffd700';
    title = `🏆 NEURAL VICTORY — ${winner.user.username.toUpperCase()}`;
    desc =
      `\`\`\`ansi\n` +
      `\u001b[1;33m╔══════════════════════════════════════════╗\u001b[0m\n` +
      `\u001b[1;33m║\u001b[0m  \u001b[1;32m✓ ${winner.class.emoji} ${winner.user.username} ELIMINATED TARGET\u001b[0m  \u001b[1;33m║\u001b[0m\n` +
      `\u001b[1;33m╠══════════════════════════════════════════╣\u001b[0m\n` +
      `\u001b[1;33m║\u001b[0m  ELO: ${extra.elo} (${extra.eloChange > 0 ? '+' : ''}${extra.eloChange})  \u001b[1;33m║\u001b[0m\n` +
      `\u001b[1;33m║\u001b[0m  Streak: ${extra.streak} 🔥  \u001b[1;33m║\u001b[0m\n` +
      `\u001b[1;33m║\u001b[0m  Rank: ${extra.rank.emoji} ${extra.rank.name}  \u001b[1;33m║\u001b[0m\n` +
      `\u001b[1;33m╚══════════════════════════════════════════╝\u001b[0m\n` +
      `\`\`\``;
  }

  return new EmbedBuilder().setColor(color).setAuthor({ name: title, iconURL: extra.client?.user?.displayAvatarURL() }).setDescription(desc).setFooter({ text: 'ARCHITECT CG-223 • Neural Arena • BAMAKO_223 🇲🇱', iconURL: extra.client?.user?.displayAvatarURL() }).setTimestamp();
}

// ================= ACTION BUTTONS =================
function buildActionButtons(duel, playerId) {
  const p = duel.p1.id === playerId ? duel.p1 : duel.p2;
  const canSpecial = p.energy >= 75 && p.cooldown <= 0;
  const canHeal = p.heals > 0;

  const rows = [];
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('duel_attack').setLabel('⚔️ ATTACK').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('duel_defend').setLabel('🛡️ DEFEND').setStyle(ButtonStyle.Primary)
  );
  rows.push(row1);

  const row2 = new ActionRowBuilder();
  if (canHeal) row2.addComponents(new ButtonBuilder().setCustomId('duel_heal').setLabel('💉 HEAL').setStyle(ButtonStyle.Success));
  if (canSpecial) row2.addComponents(new ButtonBuilder().setCustomId('duel_special').setLabel(`⚡ ${p.class.specialName.toUpperCase()}`).setStyle(ButtonStyle.Secondary));
  if (row2.components.length > 0) rows.push(row2);

  return rows;
}

// ================= CLASS SELECTION =================
async function classSelection(ctx, client, db, duel) {
  const lang = ctx.isInteraction ? (ctx.source.locale?.startsWith('fr') ? 'fr' : 'en') : 'en';
  const t = {
    en: { pick: 'Select your class', waiting: 'Waiting for opponent...' },
    fr: { pick: 'Choisissez votre classe', waiting: 'En attente de l\'adversaire...' }
  }[lang];

  const classEmbed = new EmbedBuilder().setColor('#f39c12')
    .setAuthor({ name: `🎯 NEURAL ARENA // CLASS SELECTION`, iconURL: client.user.displayAvatarURL() })
    .setDescription(`\`\`\`ansi\n\u001b[1;33m╔══════════════════════════════════════════╗\u001b[0m\n\u001b[1;33m║\u001b[0m  \u001b[1;36m${t.pick}\u001b[0m                        \u001b[1;33m║\u001b[0m\n\u001b[1;33m╚══════════════════════════════════════════╝\u001b[0m\n\`\`\``)
    .addFields(
      { name: '🥷 Ghost', value: `HP: 85 | DMG: 28 | Crit: 35% | Dodge: 30%\nSpecial: Smoke Bomb`, inline: true },
      { name: '🛡️ Titan', value: `HP: 150 | DMG: 18 | Crit: 10% | Armor: 20%\nSpecial: Fortress`, inline: true },
      { name: '🎯 Sniper', value: `HP: 95 | DMG: 32 | Crit: 45% | Dodge: 10%\nSpecial: Headshot`, inline: true },
      { name: '💻 Hacker', value: `HP: 105 | DMG: 22 | Crit: 15% | Dodge: 15%\nSpecial: System Crash`, inline: true }
    )
    .setFooter({ text: 'ARCHITECT CG-223 • Neural Arena', iconURL: client.user.displayAvatarURL() });

  const classRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('duel_class_GHOST').setLabel('Ghost').setStyle(ButtonStyle.Primary).setEmoji('🥷'),
    new ButtonBuilder().setCustomId('duel_class_TITAN').setLabel('Titan').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
    new ButtonBuilder().setCustomId('duel_class_SNIPER').setLabel('Sniper').setStyle(ButtonStyle.Primary).setEmoji('🎯'),
    new ButtonBuilder().setCustomId('duel_class_HACKER').setLabel('Hacker').setStyle(ButtonStyle.Primary).setEmoji('💻')
  );

  const msg = await ctx.reply({ embeds: [classEmbed], components: [classRow] });

  const selections = new Map();
  const players = [duel.p1.user, duel.p2.user];

  for (const player of players) {
    try {
      const res = await msg.channel.awaitMessageComponent({
        filter: i => i.message.id === msg.id && i.user.id === player.id && i.customId.startsWith('duel_class_'),
        time: 60000
      });
      await res.deferUpdate().catch(() => {});
      const clsKey = res.customId.replace('duel_class_', '');
      selections.set(player.id, CLASSES[clsKey]);
    } catch (e) {
      // Timeout: auto-assign Ghost
      selections.set(player.id, CLASSES.GHOST);
    }
  }

  duel.p1.class = selections.get(duel.p1.user.id);
  duel.p2.class = selections.get(duel.p2.user.id);
  duel.p1.maxHp = duel.p1.class.hp; duel.p1.hp = duel.p1.class.hp;
  duel.p2.maxHp = duel.p2.class.hp; duel.p2.hp = duel.p2.class.hp;
  duel.p1.energy = 50; duel.p2.energy = 50;
  duel.p1.heals = 2; duel.p2.heals = 2;
  duel.p1.cooldown = 0; duel.p2.cooldown = 0;

  return msg;
}

// ================= BATTLE LOOP =================
async function runBattle(msg, client, db, duel) {
  const { p1, p2, bet } = duel;
  let round = 1;
  let turn = Math.random() > 0.5 ? p1.id : p2.id;

  const processTurnEnd = (player) => {
    if (player.bleed > 0) { player.hp -= player.bleed; player.bleed--; }
    player.energy = Math.min(100, player.energy + 15);
    if (player.cooldown > 0) player.cooldown--;
    if (player.armorBuff > 0) { player.armorBuff--; if (player.armorBuff === 0) player.armorBuff = false; }
    if (player.dodgeNext) player.dodgeNext = false;
  };

  while (p1.hp > 0 && p2.hp > 0) {
    duel.turn = turn;
    duel.round = round;
    const current = turn === p1.id ? p1 : p2;
    const opponent = turn === p1.id ? p2 : p1;

    // Check stun
    if (current.stunned) {
      current.stunned = false;
      processTurnEnd(current);
      turn = opponent.id;
      round++;
      continue;
    }

    const embed = buildArenaEmbed(duel, 'battle', { client });
    const buttons = buildActionButtons(duel, current.id);
    await msg.edit({ embeds: [embed], components: buttons }).catch(() => {});

    let action;
    try {
      const res = await msg.channel.awaitMessageComponent({
        filter: i => i.message.id === msg.id && i.user.id === current.id && i.customId.startsWith('duel_'),
        time: 45000
      });
      await res.deferUpdate().catch(() => {});
      action = res.customId;
    } catch (e) {
      // Forfeit
      current.hp = 0;
      break;
    }

    let log = '';
    const isCrit = Math.random() * 100 < current.class.crit;
    const isDodged = opponent.dodgeNext || (Math.random() * 100 < opponent.class.dodge);

    if (action === 'duel_attack') {
      if (isDodged) {
        log = `🌫️ **${opponent.user.username}** dodged the attack!`;
      } else {
        const dmg = calcDamage(current, opponent, isCrit, false);
        opponent.hp -= dmg;
        log = `${isCrit ? '💥 **CRITICAL**' : '⚔️'} **${current.user.username}** dealt **${dmg}** damage!`;
      }
    } else if (action === 'duel_defend') {
      current.armorBuff = 2; // lasts through opponent turn
      current.hp = Math.min(current.maxHp, current.hp + 8);
      current.energy = Math.min(100, current.energy + 10);
      log = `🛡️ **${current.user.username}** fortified and recovered +8 HP!`;
    } else if (action === 'duel_heal') {
      current.heals--;
      const heal = 25;
      current.hp = Math.min(current.maxHp, current.hp + heal);
      log = `💉 **${current.user.username}** healed **+${heal}** HP!`;
    } else if (action === 'duel_special') {
      current.energy -= 75;
      current.cooldown = current.class.cooldown;
      if (current.class.special === 'smoke') {
        current.dodgeNext = true;
        log = `🌫️ **${current.user.username}** deployed **Smoke Bomb**! Next attack will miss.`;
      } else if (current.class.special === 'fortress') {
        current.armorBuff = 2;
        log = `🛡️ **${current.user.username}** activated **Fortress**! Damage reduced 60%.`;
      } else if (current.class.special === 'headshot') {
        const dmg = calcDamage(current, opponent, true, true);
        opponent.hp -= dmg;
        log = `🎯 **HEADSHOT!** **${current.user.username}** dealt **${dmg}** damage! (Ignores dodge)`;
      } else if (current.class.special === 'crash') {
        opponent.stunned = true;
        opponent.bleed = 5;
        log = `💻 **SYSTEM CRASH!** **${opponent.user.username}** is stunned and bleeding!`;
      }
    }

    // Bleed check
    if (opponent.hp <= 0) break;

    processTurnEnd(current);
    turn = opponent.id;
    round++;

    // Log embed update
    const logEmbed = new EmbedBuilder().setColor('#2c3e50').setDescription(`> ${log}`).setFooter({ text: `Round ${round} • NEURAL ARENA` });
    await msg.edit({ embeds: [buildArenaEmbed(duel, 'battle', { client }), logEmbed], components: [] }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
  }

  // Determine winner
  const winner = p1.hp > 0 ? p1 : p2;
  const loser = p1.hp > 0 ? p2 : p1;
  const guildId = duel.guildId;

  // Transfer bet
  if (bet > 0) {
    if (client.addCredits) client.addCredits(winner.id, guildId, bet * 2);
    else db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`).run(bet * 2, winner.id, guildId);
  }

  updateDuelScore(db, client, winner.id, guildId, winner.user.username, true, winner.class.dmg * 5, 1);
  updateDuelScore(db, client, loser.id, guildId, loser.user.username, false, 0, 0);

  const wData = db.prepare(`SELECT elo, current_streak FROM duel_scores WHERE user_id = ? AND guild_id = ?`).get(winner.id, guildId) || { elo: 100, current_streak: 0 };
  const rank = getDuelRank(wData.elo);

  const vicEmbed = buildArenaEmbed(duel, 'victory', {
    client, winner,
    elo: wData.elo,
    eloChange: +25,
    streak: wData.current_streak,
    rank
  });

  await msg.edit({ embeds: [vicEmbed], components: [] }).catch(() => {});
  activeDuels.delete(msg.id);
}

// ================= CHALLENGE FLOW =================
async function startDuel(ctx, client, db, opponent, bet) {
  const userId = ctx.user.id;
  const guildId = ctx.guild?.id || 'DM';
  const lang = ctx.isInteraction ? (ctx.source.locale?.startsWith('fr') ? 'fr' : 'en') : 'en';

  if (opponent.id === userId) {
    return ctx.reply({ content: '❌ You cannot challenge yourself!', ephemeral: true });
  }
  if (opponent.bot) {
    return ctx.reply({ content: '❌ Cannot challenge a bot!', ephemeral: true });
  }

  const userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare(`SELECT credits FROM users WHERE id = ? AND guild_id = ?`).get(userId, guildId);
  const oppData = client.getUserData ? client.getUserData(opponent.id, guildId) : db.prepare(`SELECT credits FROM users WHERE id = ? AND guild_id = ?`).get(opponent.id, guildId);
  if ((userData?.credits || 0) < bet) return ctx.reply({ content: `❌ You need ${bet} 🪙!`, ephemeral: true });
  if ((oppData?.credits || 0) < bet) return ctx.reply({ content: `❌ Opponent doesn't have ${bet} 🪙!`, ephemeral: true });

  // Deduct bets
  if (client.removeCredits) {
    client.removeCredits(userId, guildId, bet);
    client.removeCredits(opponent.id, guildId, bet);
  } else {
    db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ?`).run(bet, userId, guildId);
    db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ?`).run(bet, opponent.id, guildId);
  }

  const challengeEmbed = new EmbedBuilder().setColor('#e74c3c')
    .setAuthor({ name: '⚔️ NEURAL ARENA // CHALLENGE ISSUED', iconURL: client.user.displayAvatarURL() })
    .setDescription(`**${ctx.user.username}** challenges **${opponent.username}** to a Neural Duel!\n\`\`\`yaml\nBet: ${bet.toLocaleString()} 🪙\nMode: Class-based Combat\n\`\`\``)
    .setFooter({ text: 'ARCHITECT CG-223 • Neural Arena', iconURL: client.user.displayAvatarURL() });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('duel_accept').setLabel('ACCEPT').setStyle(ButtonStyle.Success).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId('duel_decline').setLabel('DECLINE').setStyle(ButtonStyle.Danger).setEmoji('❌')
  );

  const msg = await ctx.reply({ content: `<@${opponent.id}>`, embeds: [challengeEmbed], components: [row] });

  try {
    const res = await msg.channel.awaitMessageComponent({
      filter: i => i.message.id === msg.id && i.user.id === opponent.id,
      time: 30000
    });

    if (res.customId === 'duel_decline') {
      // Refund
      if (client.addCredits) { client.addCredits(userId, guildId, bet); client.addCredits(opponent.id, guildId, bet); }
      else { db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`).run(bet, userId, guildId); db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`).run(bet, opponent.id, guildId); }
      return msg.edit({ content: '❌ Challenge declined.', embeds: [], components: [] }).catch(() => {});
    }

    await res.deferUpdate().catch(() => {});
    const duel = {
      p1: { id: userId, user: ctx.user, hp: 0, maxHp: 0, energy: 0, heals: 2, cooldown: 0, stunned: false, dodgeNext: false, armorBuff: 0, bleed: 0 },
      p2: { id: opponent.id, user: opponent, hp: 0, maxHp: 0, energy: 0, heals: 2, cooldown: 0, stunned: false, dodgeNext: false, armorBuff: 0, bleed: 0 },
      bet, guildId, turn: null, round: 1
    };

    await classSelection({ reply: async (o) => msg.edit(o), isInteraction: true, source: { user: ctx.user, guild: ctx.guild, channel: msg.channel } }, client, db, duel);
    await runBattle(msg, client, db, duel);

  } catch (e) {
    // Refund on timeout
    if (client.addCredits) { client.addCredits(userId, guildId, bet); client.addCredits(opponent.id, guildId, bet); }
    else { db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`).run(bet, userId, guildId); db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`).run(bet, opponent.id, guildId); }
    msg.edit({ content: '⏰ Challenge timed out.', embeds: [], components: [] }).catch(() => {});
  }
}

// ================= SLASH COMMAND =================
const slashCommand = new SlashCommandBuilder()
  .setName('duel').setDescription('⚔️ Neural Arena — Challenge another agent to combat')
  .addUserOption(o => o.setName('opponent').setDescription('Agent to challenge').setRequired(true))
  .addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(5000));

async function executeSlashCommand(interaction, client) {
  const db = client.db;
  if (!db) return interaction.reply({ content: '❌ DB unavailable.', ephemeral: true });
  setupDuelDB(db);

  const opponent = interaction.options.getUser('opponent');
  const bet = interaction.options.getInteger('bet') || 100;
  await startDuel({ reply: async (o) => interaction.reply({ ...o, fetchReply: true }), user: interaction.user, guild: interaction.guild, isInteraction: true, source: interaction }, client, db, opponent, bet);
}

async function run(client, message, args, db, serverSettings, usedCommand) {
  const lang = client.detectLanguage ? client.detectLanguage(usedCommand) : 'en';
  const prefix = serverSettings?.prefix || '.';
  const opponent = message.mentions.users.first();
  const bet = parseInt(args[1]) || 100;

  if (!opponent) return message.reply(`⚔️ **Neural Arena**\nUsage: \`${prefix}duel @user [bet]\``).catch(() => {});
  if (bet < 10) return message.reply('Minimum bet is 10 🪙').catch(() => {});
  if (bet > 5000) return message.reply('Maximum bet is 5,000 🪙').catch(() => {});

  await startDuel({ reply: async (o) => message.reply(o), user: message.author, guild: message.guild, isInteraction: false, source: message }, client, db, opponent, bet);
}

module.exports = {
  name: 'duel',
  aliases: ['fight', 'arena', 'pvp', 'combat'],
  description: '⚔️ Neural Arena — Class-based PvP combat with betting, ELO, and special abilities',
  category: 'GAMING',
  cooldown: 10000,
  usage: '/duel @user [bet]',
  data: slashCommand,
  execute: executeSlashCommand,
  run,
  setupDuelDB
};
