const EMOJIS = require('../config/emojis');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { t } = require('../lib/i18n');

const C = { green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m' };
const OKL = ['en', 'fr', 'bm', 'zh', 'ar'];
const gl = (o) => OKL.includes(o?.language) ? o.language : 'en';

// ================= QUADRILINGUAL TONES =================
const T = {
 en: {
  selfDuel: `${EMOJIS.warning} You can't duel yourself — find a worthy opponent! 😄`,
  botDuel: `${EMOJIS.warning} Bots don't duel — they just win. Challenge a real player! 🤖`,
  noCreditsSelf: `${EMOJIS.warning} You don't have enough credits for this bet — you need **{n}** 🪙. Check your balance with \`/credit\`.`,
  noCreditsOpp: `${EMOJIS.warning} Your opponent doesn't have enough credits for this bet (**{n}** 🪙). Try a lower amount.`,
  challengeAuthor: '⚔️ NEURAL ARENA // CHALLENGE ISSUED',
  challengeDesc: '**{a}** challenges **{b}** to a Neural Duel!\n```yaml\nBet: {bet} 🪙\nMode: Class-based Combat\n```',
  accept: 'ACCEPT', decline: 'DECLINE',
  declinedMsg: `${EMOJIS.warning} **{u}** declined the challenge. Credits refunded. 👋`,
  timeoutMsg: '⏰ **{u}** didn\'t respond in time — challenge expired. Credits refunded.',
  selectTitle: '🎯 NEURAL ARENA // CLASS SELECTION',
  pick: 'Select your class', waiting: 'Waiting for opponent...',
  hp: 'HP', dmg: 'DMG', crit: 'Crit', dodge: 'Dodge', armor: 'Armor', special: 'Special',
  battleTitle: '⚔️ NEURAL ARENA // ROUND {n}',
  pot: '💰 **POT:** {bet} 🪙 | 🎯 **TURN:** {user}',
  stStunned: '⚡ STUNNED', stDodge: '🌫️ DODGE READY', stFortified: '🛡️ FORTIFIED', stBleed: '🩸 BLEED {n}', stNormal: 'STATUS: NORMAL',
  dodge: '🌫️ **{u}** dodged the attack!',
  hitCrit: '💥 **CRITICAL!** **{u}** dealt **{d}** damage!',
  hit: '⚔️ **{u}** dealt **{d}** damage!',
  defend: '🛡️ **{u}** fortified and recovered +8 HP!',
  heal: '💉 **{u}** healed **+{h}** HP!',
  smoke: '🌫️ **{u}** deployed **{s}**! Next attack will miss.',
  fortress: '🛡️ **{u}** activated **{s}**! Damage reduced 60%.',
  headshot: '🎯 **HEADSHOT!** **{u}** dealt **{d}** damage! (Ignores dodge)',
  crash: '💻 **SYSTEM CRASH!** **{u}** is stunned and bleeding!',
  btnAttack: '⚔️ ATTACK', btnDefend: '🛡️ DEFEND', btnHeal: '💉 HEAL',
  victoryTitle: '🏆 NEURAL VICTORY — {u}',
  eliminated: '✓ {cls} {u} ELIMINATED TARGET',
  eloLine: 'ELO: {elo} ({chg})', streakLine: 'Streak: {n} 🔥', rankLine: 'Rank: {r}',
  usage: '⚔️ **Neural Arena**\nUsage: `{p}duel @user [bet]`',
  minBet: 'Minimum bet is 10 🪙', maxBet: 'Maximum bet is 5,000 🪙',
  logFooter: 'Round {n} • NEURAL ARENA',
  notYourTurn: 'Not your turn — hold your fire!'
 },
 fr: {
  selfDuel: `${EMOJIS.warning} Tu ne peux pas te battre contre toi-même — trouve un adversaire digne ! 😄`,
  botDuel: `${EMOJIS.warning} Les bots ne duellent pas — ils gagnent tout seuls. Défie un vrai joueur ! 🤖`,
  noCreditsSelf: `${EMOJIS.warning} Pas assez de crédits pour ce pari — il te faut **{n}** 🪙. Vérifie ton solde avec \`/credit\`.`,
  noCreditsOpp: `${EMOJIS.warning} Ton adversaire n'a pas assez de crédits pour ce pari (**{n}** 🪙). Baisse la mise.`,
  challengeAuthor: '⚔️ ARÈNE NEURALE // DÉFI LANCÉ',
  challengeDesc: '**{a}** défie **{b}** en Duel Neural !\n```yaml\nPari : {bet} 🪙\nMode : Combat par classe\n```',
  accept: 'ACCEPTER', decline: 'REFUSER',
  declinedMsg: `${EMOJIS.warning} **{u}** a refusé le défi. Crédits remboursés. 👋`,
  timeoutMsg: '⏰ **{u}** n\'a pas répondu à temps — défi expiré. Crédits remboursés.',
  selectTitle: '🎯 ARÈNE NEURALE // CHOIX DE CLASSE',
  pick: 'Choisis ta classe', waiting: 'En attente de l\'adversaire...',
  hp: 'PV', dmg: 'DGT', crit: 'Crit', dodge: 'Esquive', armor: 'Armure', special: 'Spécial',
  battleTitle: '⚔️ ARÈNE NEURALE // MANCHE {n}',
  pot: '💰 **POT :** {bet} 🪙 | 🎯 **TOUR :** {user}',
  stStunned: '⚡ ÉTOURDI', stDodge: '🌫️ ESQUIVE PRÊTE', stFortified: '🛡️ FORTIFIÉ', stBleed: '🩸 SAIGNEMENT {n}', stNormal: 'STATUT : NORMAL',
  dodge: '🌫️ **{u}** a esquivé l\'attaque !',
  hitCrit: '💥 **CRITIQUE !** **{u}** inflige **{d}** dégâts !',
  hit: '⚔️ **{u}** inflige **{d}** dégâts !',
  defend: '🛡️ **{u}** se fortifie et récupère +8 PV !',
  heal: '💉 **{u}** récupère **+{h}** PV !',
  smoke: '🌫️ **{u}** déploie **{s}** ! La prochaine attaque ratera.',
  fortress: '🛡️ **{u}** active **{s}** ! Dégâts réduits de 60 %.',
  headshot: '🎯 **HEADSHOT !** **{u}** inflige **{d}** dégâts ! (Ignore l\'esquive)',
  crash: '💻 **PLANTAGE SYSTÈME !** **{u}** est étourdi et saigne !',
  btnAttack: '⚔️ ATTAQUER', btnDefend: '🛡️ DÉFENDRE', btnHeal: '💉 SOIGNER',
  victoryTitle: '🏆 VICTOIRE NEURALE — {u}',
  eliminated: '✓ {cls} {u} A ÉLIMINÉ LA CIBLE',
  eloLine: 'ELO : {elo} ({chg})', streakLine: 'Série : {n} 🔥', rankLine: 'Rang : {r}',
  usage: '⚔️ **Arène Neurale**\nUtilisation : `{p}duel @user [pari]`',
  minBet: 'Pari minimum : 10 🪙', maxBet: 'Pari maximum : 5 000 🪙',
  logFooter: 'Manche {n} • ARÈNE NEURALE',
  notYourTurn: 'Pas ton tour — retiens ton feu !'
 },
 zh: {
  selfDuel: `${EMOJIS.warning} 不能挑战自己 — 找个像样的对手吧！😄`,
  botDuel: `${EMOJIS.warning} 机器人不接挑战 — 它们只会赢。去找真人玩！🤖`,
  noCreditsSelf: `${EMOJIS.warning} 积分不够下注 — 你需要 **{n}** 🪙。用 \`/credit\` 查看余额。`,
  noCreditsOpp: `${EMOJIS.warning} 对方的积分不够这次下注（**{n}** 🪙）。降低点金额吧。`,
  challengeAuthor: '⚔️ 神经竞技场 // 挑战已发出',
  challengeDesc: '**{a}** 向 **{b}** 发起神经决斗！\n```yaml\n赌注：{bet} 🪙\n模式：职业战斗\n```',
  accept: '接受', decline: '拒绝',
  declinedMsg: `${EMOJIS.warning} **{u}** 拒绝了挑战。积分已退还。👋`,
  timeoutMsg: '⏰ **{u}** 没有及时回应 — 挑战过期。积分已退还。',
  selectTitle: '🎯 神经竞技场 // 选择职业',
  pick: '选择你的职业', waiting: '等待对手...',
  hp: '生命', dmg: '攻击', crit: '暴击', dodge: '闪避', armor: '护甲', special: '绝技',
  battleTitle: '⚔️ 神经竞技场 // 第 {n} 回合',
  pot: '💰 **奖池：** {bet} 🪙 | 🎯 **回合：** {user}',
  stStunned: '⚡ 眩晕中', stDodge: '🌫️ 闪避就绪', stFortified: '🛡️ 已加固', stBleed: '🩸 流血 {n}', stNormal: '状态：正常',
  dodge: '🌫️ **{u}** 闪过了攻击！',
  hitCrit: '💥 **暴击！** **{u}** 造成 **{d}** 点伤害！',
  hit: '⚔️ **{u}** 造成 **{d}** 点伤害！',
  defend: '🛡️ **{u}** 加固防御并回复 +8 生命！',
  heal: '💉 **{u}** 回复了 **{h}** 生命！',
  smoke: '🌫️ **{u}** 释放了 **{s}**！下次攻击将落空。',
  fortress: '🛡️ **{u}** 激活了 **{s}**！伤害降低 60%。',
  headshot: '🎯 **爆头！** **{u}** 造成 **{d}** 点伤害！（无视闪避）',
  crash: '💻 **系统崩溃！** **{u}** 陷入眩晕并流血！',
  btnAttack: '⚔️ 攻击', btnDefend: '🛡️ 防御', btnHeal: '💉 治疗',
  victoryTitle: '🏆 神经胜利 — {u}',
  eliminated: '✓ {cls} {u} 已消灭目标',
  eloLine: 'ELO：{elo}（{chg}）', streakLine: '连击：{n} 🔥', rankLine: '段位：{r}',
  usage: '⚔️ **神经竞技场**\n用法：`{p}duel @user [赌注]`',
  minBet: '最低赌注 10 🪙', maxBet: '最高赌注 5,000 🪙',
  logFooter: '第 {n} 回合 • 神经竞技场',
  notYourTurn: '还没轮到你 — 按住扳机！'
 },
 ar: {
  selfDuel: `${EMOJIS.warning} ما تقدر تحدّي نفسك — لاقِ خصم يستاهل! 😄`,
  botDuel: `${EMOJIS.warning} البوتات ما تقبل التحدي — بس تفوز. تحدَّ لاعب حقيقي! 🤖`,
  noCreditsSelf: `${EMOJIS.warning} رصيدك ما يكفي للرهان — تحتاج **{n}** 🪙. شيك رصيدك بـ \`/credit\`.`,
  noCreditsOpp: `${EMOJIS.warning} رصيد خصمك ما يكفي لهالرهان (**{n}** 🪙). قلل المبلغ شوي.`,
  challengeAuthor: '⚔️ الساحة العصبية // تم إطلاق التحدي',
  challengeDesc: '**{a}** يتحدى **{b}** لنزال عصبي!\n```yaml\nالرهان: {bet} 🪙\nالوضع: قتال بالأصناف\n```',
  accept: 'اقبل', decline: 'ارفض',
  declinedMsg: `${EMOJIS.warning} **{u}** رفض التحدي. رجعنا الرصيد. 👋`,
  timeoutMsg: '⏰ **{u}** ما رد على الوقت — التحدي انتهى. رجعنا الرصيد.',
  selectTitle: '🎯 الساحة العصبية // اختيار الصنف',
  pick: 'اختر صنفك', waiting: 'في انتظار الخصم...',
  hp: 'صحة', dmg: 'ضرر', crit: 'ضربة حرجة', dodge: 'مراوغة', armor: 'درع', special: 'قدرة خاصة',
  battleTitle: '⚔️ الساحة العصبية // الجولة {n}',
  pot: '💰 **الجائزة:** {bet} 🪙 | 🎯 **الدور:** {user}',
  stStunned: '⚡ مشلول', stDodge: '🌫️ جاهز للمراوغة', stFortified: '🛡️ محصّن', stBleed: '🩸 نزيف {n}', stNormal: 'الحالة: طبيعي',
  dodge: '🌫️ **{u}** مراوغ الهجوم!',
  hitCrit: '💥 **ضربة حرجة!** **{u}** سبب **{d}** ضرر!',
  hit: '⚔️ **{u}** سبب **{d}** ضرر!',
  defend: '🛡️ **{u}** تحصن واسترد +8 صحة!',
  heal: '💉 **{u}** استرد **{h}** صحة!',
  smoke: '🌫️ **{u}** استخدم **{s}**! الهجوم الجاي بيخطئ.',
  fortress: '🛡️ **{u}** فعّل **{s}**! الضرر انخفض 60%.',
  headshot: '🎯 **هيدشوت!** **{u}** سبب **{d}** ضرر! (يتجاهل المراوغة)',
  crash: '💻 **انهيار النظام!** **{u}** مشلول وينزف!',
  btnAttack: '⚔️ هجوم', btnDefend: '🛡️ دفاع', btnHeal: '💉 علاج',
  victoryTitle: '🏆 نصر عصبي — {u}',
  eliminated: '✓ {cls} {u} أزال الهدف',
  eloLine: 'ELO: {elo} ({chg})', streakLine: 'السلسلة: {n} 🔥', rankLine: 'الرتبة: {r}',
  usage: '⚔️ **الساحة العصبية**\nالاستخدام: `{p}duel @user [رهان]`',
  minBet: 'أقل رهان 10 🪙', maxBet: 'أعلى رهان 5,000 🪙',
  logFooter: 'الجولة {n} • الساحة العصبية',
  notYourTurn: 'مو دورك — ثبت يدك!'
 }
};

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

const activeDuels = new Map();

// ⏱️ Arena pacing (ms) — tune freely
const TIMING = { CHALLENGE: 120000, CLASS: 120000, TURN: 90000 };

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
  return '█'.repeat(filled) + '░'.repeat(blocks - filled) + `  ${current}/${max}`;
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
        duels_played = duels_played + 1, duels_won = duels_won + ?, duels_lost = duels_lost + ?,
        elo = ?, current_streak = ?, highest_streak = ?, total_damage = total_damage + ?, total_kills = total_kills + ?, username = ?`)
      .run(userId, guildId, username, won ? 1 : 0, won ? 0 : 1, newElo, streak, bestStreak, damage, kills,
        won ? 1 : 0, won ? 0 : 1, newElo, streak, bestStreak, damage, kills, username);

    const rank = getDuelRank(newElo);
    db.prepare(`INSERT INTO duel_global (user_id, username, global_elo, global_wins, global_kills, rank_title)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        global_elo = global_elo + ?, global_wins = global_wins + ?, global_kills = global_kills + ?, rank_title = ?, username = ?`)
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
  const t = T[duel.lang] || T.en;
  const current = turn === p1.id ? p1 : p2;

  let color = '#00d4ff';
  let title = t.battleTitle.replace('{n}', round);
  let desc = '';

  const stLine = (p) => [
    p.stunned ? t.stStunned : '',
    p.dodgeNext ? t.stDodge : '',
    p.armorBuff ? t.stFortified : '',
    p.bleed > 0 ? t.stBleed.replace('{n}', p.bleed) : ''
  ].filter(Boolean).join('  ') || t.stNormal;

  if (phase === 'select') {
    color = '#f39c12';
    title = t.selectTitle;
    desc = `${p1.user}: **${t.waiting}**\n${p2.user}: **${t.waiting}**`;
  } else if (phase === 'battle') {
    desc =
      `\`\`\`ansi\n` +
      `\u001b[1;31m╔══════════════════════════════════════════╗\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  \u001b[1;36m${p1.class.emoji} ${p1.user.username.padEnd(14)}\u001b[0m  \u001b[1;33mVS\u001b[0m  \u001b[1;36m${p2.user.username.padEnd(14)} ${p2.class.emoji}\u001b[0m  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m╠══════════════════════════════════════════╣\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  HP: ${hpBar(p1.hp, p1.maxHp)}  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  EN: ${'⚡'.repeat(Math.floor(p1.energy/25))+'░'.repeat(4-Math.floor(p1.energy/25))} ${p1.energy}%  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  ${stLine(p1).padEnd(36)}  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m╠══════════════════════════════════════════╣\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  HP: ${hpBar(p2.hp, p2.maxHp)}  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  EN: ${'⚡'.repeat(Math.floor(p2.energy/25))+'░'.repeat(4-Math.floor(p2.energy/25))} ${p2.energy}%  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m║\u001b[0m  ${stLine(p2).padEnd(36)}  \u001b[1;31m║\u001b[0m\n` +
      `\u001b[1;31m╚══════════════════════════════════════════╝\u001b[0m\n` +
      `\`\`\`\n` +
      t.pot.replace('{bet}', bet.toLocaleString()).replace('{user}', current.user.username);
  } else if (phase === 'victory') {
    const winner = extra.winner;
    color = '#ffd700';
    title = t.victoryTitle.replace('{u}', winner.user.username.toUpperCase());
    desc =
      `\`\`\`ansi\n` +
      `\u001b[1;33m╔══════════════════════════════════════════╗\u001b[0m\n` +
      `\u001b[1;33m║\u001b[0m  \u001b[1;32m✓ ${winner.class.emoji} ${t.eliminated.replace('{cls}', '').replace('{u}', winner.user.username)}\u001b[0m  \u001b[1;33m║\u001b[0m\n` +
      `\u001b[1;33m╠══════════════════════════════════════════╣\u001b[0m\n` +
      `\u001b[1;33m║\u001b[0m  ${t.eloLine.replace('{elo}', extra.elo).replace('{chg}', (extra.eloChange > 0 ? '+' : '') + extra.eloChange)}  \u001b[1;33m║\u001b[0m\n` +
      `\u001b[1;33m║\u001b[0m  ${t.streakLine.replace('{n}', extra.streak)}  \u001b[1;33m║\u001b[0m\n` +
      `\u001b[1;33m║\u001b[0m  ${t.rankLine.replace('{r}', extra.rank.emoji + ' ' + extra.rank.name)}  \u001b[1;33m║\u001b[0m\n` +
      `\u001b[1;33m╚══════════════════════════════════════════╝\u001b[0m\n` +
      `\`\`\``;
  }

  return new EmbedBuilder().setColor(color).setAuthor({ name: title, iconURL: extra.client?.user?.displayAvatarURL() }).setDescription(desc).setFooter({ text: 'ARCHON CG-223 • Neural Arena • BAMAKO_223 🇲🇱', iconURL: extra.client?.user?.displayAvatarURL() }).setTimestamp();
}

// ================= ACTION BUTTONS =================
function buildActionButtons(duel, playerId) {
  const t = T[duel.lang] || T.en;
  const p = duel.p1.id === playerId ? duel.p1 : duel.p2;
  const canSpecial = p.energy >= 75 && p.cooldown <= 0;
  const canHeal = p.heals > 0;

  const rows = [];
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('duel_attack').setLabel(t.btnAttack).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('duel_defend').setLabel(t.btnDefend).setStyle(ButtonStyle.Primary)
  );
  rows.push(row1);

  const row2 = new ActionRowBuilder();
  if (canHeal) row2.addComponents(new ButtonBuilder().setCustomId('duel_heal').setLabel(t.btnHeal).setStyle(ButtonStyle.Success));
  if (canSpecial) row2.addComponents(new ButtonBuilder().setCustomId('duel_special').setLabel(`⚡ ${p.class.specialName.toUpperCase()}`).setStyle(ButtonStyle.Secondary));
  if (row2.components.length > 0) rows.push(row2);

  return rows;
}

// ================= CLASS SELECTION =================
async function classSelection(ctx, client, db, duel) {
  const t = T[duel.lang] || T.en;
  const cstat = (cls) => {
    const parts = [`${t.hp}: ${cls.hp}`, `${t.dmg}: ${cls.dmg}`, `${t.crit}: ${cls.crit}%`];
    if (cls.dodge >= 20) parts.push(`${t.dodge}: ${cls.dodge}%`);
    if (cls.armor >= 15) parts.push(`${t.armor}: ${cls.armor}%`);
    return parts.join(' | ') + `\n${t.special}: ${cls.specialName}`;
  };

  const classEmbed = new EmbedBuilder().setColor('#f39c12')
    .setAuthor({ name: t.selectTitle, iconURL: client.user.displayAvatarURL() })
    .setDescription(`\`\`\`ansi\n\u001b[1;33m╔══════════════════════════════════════════╗\u001b[0m\n\u001b[1;33m║\u001b[0m  \u001b[1;36m${t.pick}\u001b[0m                        \u001b[1;33m║\u001b[0m\n\u001b[1;33m╚══════════════════════════════════════════╝\u001b[0m\n\`\`\``)
    .addFields(
      { name: '🥷 Ghost', value: cstat(CLASSES.GHOST), inline: true },
      { name: '🛡️ Titan', value: cstat(CLASSES.TITAN), inline: true },
      { name: '🎯 Sniper', value: cstat(CLASSES.SNIPER), inline: true },
      { name: '💻 Hacker', value: cstat(CLASSES.HACKER), inline: true }
    )
    .setFooter({ text: 'ARCHON CG-223 • Neural Arena • BAMAKO_223 🇲🇱', iconURL: client.user.displayAvatarURL() });

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
        time: TIMING.CLASS
      });
      await res.deferUpdate().catch(() => {});
      const clsKey = res.customId.replace('duel_class_', '');
      selections.set(player.id, CLASSES[clsKey]);
    } catch (e) {
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
  const t = T[duel.lang] || T.en;
  const { p1, p2, bet } = duel;
  let round = 1;
  let turn = Math.random() > 0.5 ? p1.id : p2.id;

  // Acknowledge out-of-turn clicks so Discord doesn't show "interaction failed"
  const ackCollector = msg.createMessageComponentCollector({
    filter: i => i.message.id === msg.id && i.customId.startsWith('duel_'),
    time: 10 * 60 * 1000
  });
  ackCollector.on('collect', async (i) => {
    if (i.user.id !== duel.turn) {
      await i.reply({ content: t.notYourTurn, flags: 64 }).catch(() => {});
    }
  });

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
        time: TIMING.TURN
      });
      await res.deferUpdate().catch(() => {});
      action = res.customId;
    } catch (e) {
      current.hp = 0;
      break;
    }

    let log = '';
    const isCrit = Math.random() * 100 < current.class.crit;
    const isDodged = opponent.dodgeNext || (Math.random() * 100 < opponent.class.dodge);

    if (action === 'duel_attack') {
      if (isDodged) {
        log = t.dodge.replace('{u}', opponent.user.username);
      } else {
        const dmg = calcDamage(current, opponent, isCrit, false);
        opponent.hp -= dmg;
        log = (isCrit ? t.hitCrit : t.hit).replace('{u}', current.user.username).replace('{d}', dmg);
      }
    } else if (action === 'duel_defend') {
      current.armorBuff = 2;
      current.hp = Math.min(current.maxHp, current.hp + 8);
      current.energy = Math.min(100, current.energy + 10);
      log = t.defend.replace('{u}', current.user.username);
    } else if (action === 'duel_heal') {
      current.heals--;
      const heal = 25;
      current.hp = Math.min(current.maxHp, current.hp + heal);
      log = t.heal.replace('{u}', current.user.username).replace('{h}', heal);
    } else if (action === 'duel_special') {
      current.energy -= 75;
      current.cooldown = current.class.cooldown;
      if (current.class.special === 'smoke') {
        current.dodgeNext = true;
        log = t.smoke.replace('{u}', current.user.username).replace('{s}', current.class.specialName);
      } else if (current.class.special === 'fortress') {
        current.armorBuff = 2;
        log = t.fortress.replace('{u}', current.user.username).replace('{s}', current.class.specialName);
      } else if (current.class.special === 'headshot') {
        const dmg = calcDamage(current, opponent, true, true);
        opponent.hp -= dmg;
        log = t.headshot.replace('{u}', current.user.username).replace('{d}', dmg);
      } else if (current.class.special === 'crash') {
        opponent.stunned = true;
        opponent.bleed = 5;
        log = t.crash.replace('{u}', opponent.user.username);
      }
    }

    if (opponent.hp <= 0) break;

    processTurnEnd(current);
    turn = opponent.id;
    round++;

    const logEmbed = new EmbedBuilder().setColor('#2c3e50').setDescription(`> ${log}`).setFooter({ text: t.logFooter.replace('{n}', round) });
    await msg.edit({ embeds: [buildArenaEmbed(duel, 'battle', { client }), logEmbed], components: [] }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
  }

  const winner = p1.hp > 0 ? p1 : p2;
  const loser = p1.hp > 0 ? p2 : p1;
  const guildId = duel.guildId;

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
  ackCollector.stop();
  activeDuels.delete(msg.id);
}

// ================= CHALLENGE FLOW =================
async function startDuel(ctx, client, db, opponent, bet) {
  const userId = ctx.user.id;
  const guildId = ctx.guild?.id || 'DM';
  const lang = gl(client.getServerSettings?.(guildId) || {});
  const t = T[lang] || T.en;

  if (opponent.id === userId) return ctx.reply({ content: t.selfDuel, flags: 64 });
  if (opponent.bot) return ctx.reply({ content: t.botDuel, flags: 64 });

  const userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare(`SELECT credits FROM users WHERE id = ? AND guild_id = ?`).get(userId, guildId);
  const oppData = client.getUserData ? client.getUserData(opponent.id, guildId) : db.prepare(`SELECT credits FROM users WHERE id = ? AND guild_id = ?`).get(opponent.id, guildId);
  if ((userData?.credits || 0) < bet) return ctx.reply({ content: t.noCreditsSelf.replace('{n}', bet.toLocaleString()), flags: 64 });
  if ((oppData?.credits || 0) < bet) return ctx.reply({ content: t.noCreditsOpp.replace('{n}', bet.toLocaleString()), flags: 64 });

  if (client.removeCredits) {
    client.removeCredits(userId, guildId, bet);
    client.removeCredits(opponent.id, guildId, bet);
  } else {
    db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ?`).run(bet, userId, guildId);
    db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ?`).run(bet, opponent.id, guildId);
  }

  const challengeEmbed = new EmbedBuilder().setColor('#e74c3c')
    .setAuthor({ name: t.challengeAuthor, iconURL: client.user.displayAvatarURL() })
    .setDescription(t.challengeDesc.replace('{a}', ctx.user.username).replace('{b}', opponent.username).replace('{bet}', bet.toLocaleString()))
    .setFooter({ text: 'ARCHON CG-223 • Neural Arena • BAMAKO_223 🇲🇱', iconURL: client.user.displayAvatarURL() });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('duel_accept').setLabel(t.accept).setStyle(ButtonStyle.Success).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId('duel_decline').setLabel(t.decline).setStyle(ButtonStyle.Danger).setEmoji('❌')
  );

  const msg = await ctx.reply({ content: `<@${opponent.id}>`, embeds: [challengeEmbed], components: [row] });

  try {
    const res = await msg.channel.awaitMessageComponent({
      filter: i => i.message.id === msg.id && i.user.id === opponent.id,
      time: TIMING.CHALLENGE
    });

    if (res.customId === 'duel_decline') {
      if (client.addCredits) { client.addCredits(userId, guildId, bet); client.addCredits(opponent.id, guildId, bet); }
      else { db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`).run(bet, userId, guildId); db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`).run(bet, opponent.id, guildId); }
      return msg.edit({ content: t.declinedMsg.replace('{u}', opponent.username), embeds: [], components: [] }).catch(() => {});
    }

    await res.deferUpdate().catch(() => {});
    const duel = {
      p1: { id: userId, user: ctx.user, hp: 0, maxHp: 0, energy: 0, heals: 2, cooldown: 0, stunned: false, dodgeNext: false, armorBuff: 0, bleed: 0 },
      p2: { id: opponent.id, user: opponent, hp: 0, maxHp: 0, energy: 0, heals: 2, cooldown: 0, stunned: false, dodgeNext: false, armorBuff: 0, bleed: 0 },
      bet, guildId, turn: null, round: 1, lang
    };

    await classSelection({ reply: async (o) => msg.edit(o) }, client, db, duel);
    await runBattle(msg, client, db, duel);

  } catch (e) {
    if (client.addCredits) { client.addCredits(userId, guildId, bet); client.addCredits(opponent.id, guildId, bet); }
    else { db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`).run(bet, userId, guildId); db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`).run(bet, opponent.id, guildId); }
    msg.edit({ content: t.timeoutMsg.replace('{u}', opponent.username), embeds: [], components: [] }).catch(() => {});
  }
}

// ================= SLASH COMMAND =================
const slashCommand = new SlashCommandBuilder()
  .setName('duel').setDescription('⚔️ Neural Arena — Challenge another agent to combat')
  .addUserOption(o => o.setName('opponent').setDescription('Agent to challenge').setRequired(true))
  .addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(5000));

async function executeSlashCommand(interaction, client) {
  const db = client.db;
  if (!db) return interaction.reply({ content: '❌ DB unavailable.', flags: 64 });
  setupDuelDB(db);

  const opponent = interaction.options.getUser('opponent');
  const bet = interaction.options.getInteger('bet') || 100;
  // fetchReply() returns a REAL Message — InteractionResponse lacks .channel and would
  // make awaitMessageComponent throw instantly (fake instant-timeout bug)
  const reply = async (o) => {
    await interaction.reply({ ...o });
    return await interaction.fetchReply().catch(() => null);
  };
  await startDuel({ reply, user: interaction.user, guild: interaction.guild }, client, db, opponent, bet);
}

async function run(client, message, args, db, serverSettings, usedCommand) {
  const prefix = serverSettings?.prefix || '.';
  const t = T[gl(serverSettings || {})] || T.en;
  const opponent = message.mentions.users.first();
  const bet = parseInt(args[1]) || 100;

  if (!opponent) return message.reply(t.usage.replace('{p}', prefix)).catch(() => {});
  if (bet < 10) return message.reply(t.minBet).catch(() => {});
  if (bet > 5000) return message.reply(t.maxBet).catch(() => {});

  await startDuel({ reply: async (o) => message.reply(o), user: message.author, guild: message.guild }, client, db, opponent, bet);
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
