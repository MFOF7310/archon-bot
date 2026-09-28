const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

// ================= ENGINE IMPORTS =================
const voteSync = require('./votesync.js');
const { buildVoteLBCanvas } = require('./vote-lb-canvas.js');
const EMOJIS = require('../config/emojis');

// ================= QUADRILINGUAL (en/fr/zh/ar) =================
const T = {
 en: {
  title:'⭐ VOTE PORTAL', voteBtn:'Vote on Top.gg', claimBtn:'Claim Reward', checkBtn:'My Stats', lbBtn:'Leaderboard', footer:'Architect CG-223',
  noVote:'❌ You haven\'t voted yet!', voteFirst:'Vote on [Top.gg]({link}), then click **Claim Reward**.',
  claimed:'✅ REWARD CLAIMED!', gotReward:'**+{reward}** credits | Streak: **{streak}** 🔥',
  milestone7:'🏆 7-Day Milestone! +2,000 bonus!', milestone30:'👑 30-Day Legend! +5,000 bonus!', milestone100:'🌟 100-Day Mythic! +10,000 bonus!',
  nextIn:'Next vote: {time}', streak:'🔥 Streak: **{days}** days', best:'🏆 Best: **{days}**', total:'🗳️ Total: **{n}** votes', rewards:'💰 Earned: **{n}** credits',
  lbTitle:'🏆 Top Voters', rankEmoji:['🥇','🥈','🥉','📌','📌','📌','📌','📌','📌','📌'],
  checkError:'❌ Could not check vote status. Try again later.',
  statusTitle:'📣 Vote System', statusMode:'**Mode:** {mode}', statusWebhook:'**Webhook:**', statusApi:'**Top.gg API:**',
  modeWebhook:'Webhook (instant)', modePoll:'API Check (on claim)', modeFallback:'Manual only',
  alreadyClaimed:'⏰ Already claimed! Next vote: {time}',
  progress:'📈 Progress to {milestone}-Day', progressBar:'**{bar}** {percent}% ({current}/{target})',
  voteLink:'https://top.gg/bot/{botId}/vote',
  dmSuccess:'📩 Check your DMs for a detailed reward breakdown!',
  cooldownTitle:'⏰ Not Yet!', cooldownExact:'Exact Remaining Time', cooldownLive:'*This countdown updates automatically in your Discord client.*',
  firstVoteBtn:'Cast First Vote', checkCooldownBtn:'Check Cooldown',
  greetingMorning:'🌅 Good Morning, **{user}**', greetingAfternoon:'☀️ Good Afternoon, **{user}**', greetingEvening:'🌆 Good Evening, **{user}**', greetingNight:'🌙 Good Night, **{user}**',
  badgeFirst:'🔴 First vote pending', badgeReady:'🟢 Ready to vote!', badgeWait:'🟡 Come back soon',
  subtitleWelcome:'🌟 Welcome!', subtitleReady:'✅ You\'re all set!', subtitleWait:'⏰ Not yet, hang tight!',
  bodyFirst:'Your support powers the **ARCHON CG-223** ecosystem.\nCast your first vote to activate your operative record and begin earning credits.',
  bodyReady:'{streakMsg}\nMaintain your streak to unlock milestone bonuses. Every vote strengthens the network.',
  bodyWait:'You have already supported us today. Your operative record is updated.\nNext authorization window opens below.',
  streakActive:'Current streak: **{days} days** 🔥', noStreak:'No active streak',
  recordTitle:'Your Vote Record', progressTitle:'Milestone Progress', nextVoteOpens:'Next vote opens',
  keepGoing7:'Keep your streak alive! Reach **7 days** for a **+2,000** bonus.',
  keepGoing30:'7-day milestone achieved! Push to **30 days** for **+5,000**.',
  keepGoing100:'Legendary status! **100-day Mythic** awaits with **+10,000**.',
  notYours:'❌ Not yours.', serverOnly:'Server only.', adminOnly:'❌ Admin only.',
  processFail:'❌ Vote processing failed. Try again later.', lbFailMsg:'Could not generate leaderboard image.',
  cooldownWord:'⏰ Cooldown', rankLabel:'📊 Rank', unranked:'Unranked', votesUnit:'votes',
  cooldownGreeting:'**Operative {user},**', cooldownBody:'Your voting authorization is on cooldown.',
  cooldownVoteAgainAt:'You can vote again', cooldownFullAuth:'**Full Authorization:**'
 },
 fr: {
  title:'⭐ PORTAIL DE VOTE', voteBtn:'Voter sur Top.gg', claimBtn:'Réclamer', checkBtn:'Mes Stats', lbBtn:'Classement', footer:'Architect CG-223',
  noVote:'❌ Vous n\'avez pas encore voté !', voteFirst:'Votez sur [Top.gg]({link}), puis cliquez **Réclamer**.',
  claimed:'✅ RÉCOMPENSE RÉCLAMÉE !', gotReward:'**+{reward}** crédits | Série : **{streak}** 🔥',
  milestone7:'🏆 Objectif 7 jours ! +2 000 bonus !', milestone30:'👑 Légende 30 jours ! +5 000 bonus !', milestone100:'🌟 Mythique 100 jours ! +10 000 bonus !',
  nextIn:'Prochain vote : {time}', streak:'🔥 Série : **{days}** jours', best:'🏆 Meilleure : **{days}**', total:'🗳️ Total : **{n}** votes', rewards:'💰 Gagnés : **{n}** crédits',
  lbTitle:'🏆 LÉGENDES DU VOTE', rankEmoji:['🥇','🥈','🥉','📌','📌','📌','📌','📌','📌','📌'],
  checkError:'❌ Impossible de vérifier le vote. Réessayez.',
  statusTitle:'📣 Système de Vote', statusMode:'**Mode :** {mode}', statusWebhook:'**Webhook :**', statusApi:'**API Top.gg :**',
  modeWebhook:'Webhook (instantané)', modePoll:'Vérification API (au claim)', modeFallback:'Manuel uniquement',
  alreadyClaimed:'⏰ Déjà réclamé ! Prochain vote : {time}',
  progress:'📈 Progression vers {milestone} jours', progressBar:'**{bar}** {percent}% ({current}/{target})',
  voteLink:'https://top.gg/bot/{botId}/vote',
  dmSuccess:'📩 Vérifiez vos MPs pour un détail des récompenses !',
  cooldownTitle:'⏰ RAPPORT DE COOLDOWN', cooldownExact:'Temps restant exact', cooldownLive:'*Ce compte à rebours se met à jour automatiquement dans Discord.*',
  firstVoteBtn:'🌟 PREMIER VOTE', checkCooldownBtn:'⏰ VÉRIFIER COOLDOWN',
  greetingMorning:'🌅 Bonjour, **{user}**', greetingAfternoon:'☀️ Bon après-midi, **{user}**', greetingEvening:'🌆 Bonsoir, **{user}**', greetingNight:'🌙 Bonne nuit, **{user}**',
  badgeFirst:'🔴 Premier vote en attente', badgeReady:'🟢 Prêt à voter !', badgeWait:'🟡 Reviens bientôt',
  subtitleWelcome:'🌟 Bienvenue !', subtitleReady:'✅ Tu es prêt !', subtitleWait:'⏰ Pas encore, patience !',
  bodyFirst:'Votre soutien alimente l\'écosystème **ARCHON CG-223**.\nLancez votre premier vote pour activer votre dossier opérationnel et commencer à gagner des crédits.',
  bodyReady:'{streakMsg}\nMaintenez votre série pour débloquer des bonus de jalons. Chaque vote renforce le réseau.',
  bodyWait:'Vous avez déjà voté aujourd\'hui. Votre dossier est à jour.\nLa prochaine fenêtre d\'autorisation s\'ouvre ci-dessous.',
  streakActive:'Série actuelle : **{days} jours** 🔥', noStreak:'Aucune série active',
  recordTitle:'Ton Historique', progressTitle:'Progression', nextVoteOpens:'Prochain vote',
  keepGoing7:'Gardez votre série ! Atteignez **7 jours** pour **+2 000**.',
  keepGoing30:'Jalon 7 jours atteint ! Visez **30 jours** pour **+5 000**.',
  keepGoing100:'Statut légendaire ! Le **Mythique 100 jours** attend avec **+10 000**.',
  notYours:'❌ Pas à toi.', serverOnly:'Réservé aux serveurs.', adminOnly:'❌ Réservé aux admins.',
  processFail:'❌ Échec du traitement. Réessayez plus tard.', lbFailMsg:'Impossible de générer le classement.',
  cooldownWord:'⏰ Cooldown', rankLabel:'📊 Rang', unranked:'Non classé', votesUnit:'votes',
  cooldownGreeting:'**Opératif {user},**', cooldownBody:'Votre autorisation de vote est en cooldown.',
  cooldownVoteAgainAt:'Vous pourrez voter de nouveau', cooldownFullAuth:'**Autorisation complète :**'
 },
 zh: {
  title:'⭐ 投票传送门', voteBtn:'去 Top.gg 投票', claimBtn:'领取奖励', checkBtn:'我的统计', lbBtn:'排行榜', footer:'Architect CG-223',
  noVote:'❌ 你还没有投票！', voteFirst:'先到 [Top.gg]({link}) 投票，再点**领取奖励**。',
  claimed:'✅ 奖励已领取！', gotReward:'**+{reward}** 积分 | 连投：**{streak}** 🔥',
  milestone7:'🏆 7 天里程碑！+2,000 奖励！', milestone30:'👑 30 天传奇！+5,000 奖励！', milestone100:'🌟 100 天神话！+10,000 奖励！',
  nextIn:'下次可投：{time}', streak:'🔥 连投：**{days}** 天', best:'🏆 最高：**{days}**', total:'🗳️ 总计：**{n}** 次投票', rewards:'💰 已获得：**{n}** 积分',
  lbTitle:'🏆 投票传奇榜', rankEmoji:['🥇','🥈','🥉','📌','📌','📌','📌','📌','📌','📌'],
  checkError:'❌ 无法检查投票状态，请稍后再试。',
  statusTitle:'📣 投票系统', statusMode:'**模式：** {mode}', statusWebhook:'**Webhook：**', statusApi:'**Top.gg API：**',
  modeWebhook:'Webhook（即时）', modePoll:'API 检查（领取时）', modeFallback:'仅手动',
  alreadyClaimed:'⏰ 已领取！下次可投：{time}',
  progress:'📈 距离 {milestone} 天里程碑', progressBar:'**{bar}** {percent}%（{current}/{target}）',
  voteLink:'https://top.gg/bot/{botId}/vote',
  dmSuccess:'📩 私聊里有详细的奖励明细，快去查看！',
  cooldownTitle:'⏰ 还不能投！', cooldownExact:'精确剩余时间', cooldownLive:'*倒计时会在你的 Discord 客户端自动更新。*',
  firstVoteBtn:'投出第一票', checkCooldownBtn:'查看冷却',
  greetingMorning:'🌅 早上好，**{user}**', greetingAfternoon:'☀️ 下午好，**{user}**', greetingEvening:'🌆 晚上好，**{user}**', greetingNight:'🌙 夜深了，**{user}**',
  badgeFirst:'🔴 等待第一票', badgeReady:'🟢 可以投票了！', badgeWait:'🟡 稍后再来',
  subtitleWelcome:'🌟 欢迎！', subtitleReady:'✅ 一切就绪！', subtitleWait:'⏰ 还没到时候，别急！',
  bodyFirst:'你的支持是 **ARCHON CG-223** 生态的动力。\n投出第一票即可激活你的特工档案，开始赚积分！',
  bodyReady:'{streakMsg}\n保持连投解锁里程碑奖励，每一票都在壮大网络。',
  bodyWait:'你今天已经支持过我们了，档案已更新。\n下一个投票窗口见下方。',
  streakActive:'当前连投：**{days} 天** 🔥', noStreak:'暂无连投记录',
  recordTitle:'你的投票档案', progressTitle:'里程碑进度', nextVoteOpens:'下次可投',
  keepGoing7:'保持连投！到 **7 天** 拿 **+2,000** 奖励。',
  keepGoing30:'7 天里程碑达成！冲向 **30 天** 拿 **+5,000**。',
  keepGoing100:'已是传奇！**100 天神话** 等你，奖励 **+10,000**。',
  notYours:'❌ 这不是你的菜单。', serverOnly:'仅限服务器使用。', adminOnly:'❌ 仅限管理员。',
  processFail:'❌ 处理失败，请稍后再试。', lbFailMsg:'排行榜图片生成失败。',
  cooldownWord:'⏰ 冷却中', rankLabel:'📊 排名', unranked:'未上榜', votesUnit:'次投票',
  cooldownGreeting:'**特工 {user}，**', cooldownBody:'你的投票授权正在冷却中。',
  cooldownVoteAgainAt:'你可以再次投票', cooldownFullAuth:'**完整授权时间：**'
 },
 ar: {
  title:'⭐ بوابة التصويت', voteBtn:'صوّت بـ Top.gg', claimBtn:'استلم المكافأة', checkBtn:'إحصائياتي', lbBtn:'التصنيف', footer:'Architect CG-223',
  noVote:'❌ ما صوّيت بعد!', voteFirst:'صوّت أول بـ [Top.gg]({link})، ثم اضغط **استلم المكافأة**.',
  claimed:'✅ تم استلام المكافأة!', gotReward:'**+{reward}** رصيد | السلسلة: **{streak}** 🔥',
  milestone7:'🏆 محطة 7 أيام! +2,000 مكافأة!', milestone30:'👑 أسطورة 30 يومًا! +5,000 مكافأة!', milestone100:'🌟 أسطوري 100 يومًا! +10,000 مكافأة!',
  nextIn:'التصويت التالي: {time}', streak:'🔥 السلسلة: **{days}** يوم', best:'🏆 الأفضل: **{days}**', total:'🗳️ الإجمالي: **{n}** تصويت', rewards:'💰 المكتسب: **{n}** رصيد',
  lbTitle:'🏆 أساطير التصويت', rankEmoji:['🥇','🥈','🥉','📌','📌','📌','📌','📌','📌','📌'],
  checkError:'❌ ما قدرت أتحقق. حاول بعد لحظات.',
  statusTitle:'📣 نظام التصويت', statusMode:'**الوضع:** {mode}', statusWebhook:'**Webhook:**', statusApi:'**Top.gg API:**',
  modeWebhook:'Webhook (فوري)', modePoll:'فحص API (عند الاستلام)', modeFallback:'يدوي فقط',
  alreadyClaimed:'⏰ اناستلمت! التصويت التالي: {time}',
  progress:'📈 التقدم نحو {milestone} يوم', progressBar:'**{bar}** {percent}% ({current}/{target})',
  voteLink:'https://top.gg/bot/{botId}/vote',
  dmSuccess:'📩 شيك خاصك، فيه تفاصيل المكافأة كاملة!',
  cooldownTitle:'⏰ مو وقتها!', cooldownExact:'الوقت المتبقي بالضبط', cooldownLive:'*العداد يتحدث تلقائيًا بعميل ديسكورد.*',
  firstVoteBtn:'صوّت أول مرة', checkCooldownBtn:'شيك الكول داون',
  greetingMorning:'🌅 صباح الخير، **{user}**', greetingAfternoon:'☀️ مساء الخير، **{user}**', greetingEvening:'🌆 مساء النور، **{user}**', greetingNight:'🌙 ليلة سعيدة، **{user}**',
  badgeFirst:'🔴 بانتظار أول تصويت', badgeReady:'🟢 جاهز للتصويت!', badgeWait:'🟡 عُد قريبًا',
  subtitleWelcome:'🌟 أهلًا بك!', subtitleReady:'✅ كل شي جاهز!', subtitleWait:'⏰ ليس بعد، شوي صبر!',
  bodyFirst:'دعمك هو قوة نظام **أركون CG-223**.\nصوّت أول مرة لتفعيل ملفك وابدأ تجمع الرصيد!',
  bodyReady:'{streakMsg}\nحافظ على سلسلتك لفتح مكافآت المحطات. كل تصويت يقوي الشبكة.',
  bodyWait:'صوّتت اليوم بالفعل وملفك محدّث.\nنافذة التصويت الجاية تنفتح تحت.',
  streakActive:'السلسلة الحالية: **{days} يوم** 🔥', noStreak:'لا سلسلة نشطة',
  recordTitle:'سجل تصويتك', progressTitle:'تقدم المحطات', nextVoteOpens:'التصويت التالي',
  keepGoing7:'كمّل السلسلة! أوصل **7 أيام** وخذ **+2,000**.',
  keepGoing30:'محطة 7 أيام تمت! اقفز لـ **30 يومًا** وخذ **+5,000**.',
  keepGoing100:'مستوى أسطوري! **الأسطوري 100 يومًا** بانتظارك مع **+10,000**.',
  notYours:'❌ هالقائمة مو لك.', serverOnly:'للسيرفرات فقط.', adminOnly:'❌ للمشرفين فقط.',
  processFail:'❌ فشل المعالجة. حاول بعد لحظات.', lbFailMsg:'ما قدرنا نسوي صورة التصنيف.',
  cooldownWord:'⏰ كول داون', rankLabel:'📊 الترتيب', unranked:'غير مصنف', votesUnit:'تصويت',
  cooldownGreeting:'**وكيل {user}،**', cooldownBody:'تصريح تصويتك في فترة انتظار.',
  cooldownVoteAgainAt:'تقدر تصوّت مجددًا', cooldownFullAuth:'**وقت التصريح الكامل:**'
 }
};

// ================= HELPERS =================
const OKL = ['en', 'fr', 'bm', 'zh', 'ar'];
const pl = (o) => OKL.includes(o?.language) ? o.language : 'en';

function progressBar(current, target) {
    const pct = Math.min(100, Math.round((current / target) * 100));
    const filled = Math.round((pct / 100) * 10);
    return { bar: '█'.repeat(filled) + '░'.repeat(10 - filled), percent: pct };
}

// ================= REALTIME VOTE STATUS =================
async function getRealtimeStatus(client, uid, gid, db) {
    const stats = voteSync.getStats(db, uid, gid);
    const now = Math.floor(Date.now() / 1000);
    const lastVote = stats.last_vote_date || 0;
    const timeSince = now - lastVote;
    const cooldown = 43200;
    const nextVote = lastVote + cooldown;
    const canVote = timeSince >= cooldown;
    const isFirstTime = !lastVote || stats.total_votes === 0;

    let apiVerified = false;
    let apiVoted = false;
    try {
        if (voteSync.checkTopGGVote) {
            apiVoted = await voteSync.checkTopGGVote(uid, client);
            apiVerified = true;
        }
    } catch (e) {}

    const onCooldown = apiVerified ? apiVoted : !canVote;
    const readyToVote = apiVerified ? !apiVoted : canVote;

    return { stats, canVote: readyToVote, onCooldown, isFirstTime, nextVote, timeSince, lastVote, apiVerified, apiVoted };
}

// ================= PORTAL EMBED =================
function buildPortalEmbed(client, user, status, t, lang, guild) {
    const h = new Date().getHours();
    const gKey = h >= 5 && h < 12 ? 'greetingMorning' : h >= 12 && h < 17 ? 'greetingAfternoon' : h >= 17 && h < 21 ? 'greetingEvening' : 'greetingNight';
    const greeting = t[gKey].replace('{user}', user.username);

    let color, badge, subtitle, body;
    if (status.isFirstTime) {
        color = '#e74c3c';
        badge = t.badgeFirst;
        subtitle = t.subtitleWelcome;
        body = t.bodyFirst;
    } else if (status.canVote) {
        color = '#2ecc71';
        badge = t.badgeReady;
        const streakMsg = status.stats.current_streak > 0 ? t.streakActive.replace('{days}', status.stats.current_streak) : t.noStreak;
        subtitle = t.subtitleReady;
        body = t.bodyReady.replace('{streakMsg}', streakMsg);
    } else {
        color = '#f39c12';
        badge = t.badgeWait;
        subtitle = t.subtitleWait;
        body = t.bodyWait;
    }

    const target = status.stats.current_streak < 7 ? 7 : status.stats.current_streak < 30 ? 30 : 100;
    const { bar, percent } = progressBar(status.stats.current_streak, target);

    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .setTitle(greeting)
        .setDescription(`**${subtitle}**\n━━━━━━━━━━━━━━━━━━━━━━\n${body}\n\n**${badge}**`);

    const recordValue =
        `🔥 ${t.streak.replace('{days}', status.stats.current_streak)}\n` +
        `🏆 ${t.best.replace('{days}', status.stats.best_streak)}\n` +
        `🗳️ ${t.total.replace('{n}', status.stats.total_votes)}\n` +
        `💰 ${t.rewards.replace('{n}', status.stats.total_rewards.toLocaleString())}`;

    embed.addFields(
        { name: `${EMOJIS.vote} ${t.recordTitle}`, value: recordValue, inline: false },
        { name: `${EMOJIS.milestones} ${t.progressTitle}`, value:
            t.progress.replace('{milestone}', String(target)) + '\n' +
            t.progressBar.replace('{bar}', bar).replace('{percent}', percent).replace('{current}', status.stats.current_streak).replace('{target}', target),
            inline: false }
    );

    if (status.onCooldown && !status.isFirstTime) {
        embed.addFields({ name: `⏰ ${t.nextVoteOpens}`, value: `<t:${status.nextVote}:R>\n*(<t:${status.nextVote}:f>)*`, inline: false });
    }

    const cs = status.stats.current_streak;
    if (cs > 0 && cs < 7) embed.addFields({ name: `${EMOJIS.streak} ${t.streak.split('：')[0].replace('🔥 ', '')} !`, value: t.keepGoing7, inline: false });
    else if (cs >= 7 && cs < 30) embed.addFields({ name: `${EMOJIS.streak} ✨`, value: t.keepGoing30, inline: false });
    else if (cs >= 30) embed.addFields({ name: `${EMOJIS.streak} ✨`, value: t.keepGoing100, inline: false });

    embed.setFooter({ text: `${guild?.name || 'ARCHON CG-223'} • ${t.footer}`, iconURL: guild?.iconURL() || client.user.displayAvatarURL() }).setTimestamp();
    return embed;
}

// ================= PORTAL BUTTON ROW =================
function buildPortalRow(client, status, t, isSlash = false) {
    const link = t.voteLink.replace('{botId}', client.user.id);
    const row = new ActionRowBuilder();
    const suffix = isSlash ? '_slash' : '';

    if (status.canVote) {
        row.addComponents(new ButtonBuilder().setLabel(t.voteBtn).setStyle(ButtonStyle.Link).setURL(link).setEmoji(EMOJIS.vote || '⭐'));
    } else if (status.isFirstTime) {
        row.addComponents(new ButtonBuilder().setLabel(t.firstVoteBtn).setStyle(ButtonStyle.Link).setURL(link).setEmoji('🌟'));
    } else {
        row.addComponents(new ButtonBuilder().setCustomId(`vote_check_status${suffix}`).setLabel(t.checkCooldownBtn).setStyle(ButtonStyle.Secondary).setEmoji('⏰'));
    }

    row.addComponents(
        new ButtonBuilder().setCustomId(`vote_claim${suffix}`).setLabel(t.claimBtn).setStyle(ButtonStyle.Success).setEmoji('💰'),
        new ButtonBuilder().setCustomId(`vote_stats${suffix}`).setLabel(t.checkBtn).setStyle(ButtonStyle.Secondary).setEmoji('📊'),
        new ButtonBuilder().setCustomId(`vote_lb${suffix}`).setLabel(t.lbBtn).setStyle(ButtonStyle.Secondary).setEmoji('🏆')
    );
    return row;
}

// ================= CLAIM EMBED =================
function buildClaimEmbed(t, result, nextTimestamp) {
    const embed = new EmbedBuilder().setColor('#2ecc71')
        .setTitle(t.claimed)
        .setDescription(t.gotReward.replace('{reward}', result.total.toLocaleString()).replace('{streak}', result.streak));
    if (result.milestone === '7') embed.addFields({ name: '', value: t.milestone7 });
    if (result.milestone === '30') embed.addFields({ name: '', value: t.milestone30 });
    if (result.milestone === '100') embed.addFields({ name: '', value: t.milestone100 });
    embed.addFields({ name: '', value: t.nextIn.replace('{time}', `<t:${nextTimestamp}:R>`) });
    return embed;
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'vote',
    aliases: ['voter', 'upvote', 'topgg'],
    description: '⭐ Vote on Top.gg and claim legendary rewards with streaks and milestones.',
    category: 'ECONOMY',
    usage: '.vote | .vote claim | .vote stats | .vote lb | .vote test @user | .vote status',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('vote').setDescription('⭐ Vote on Top.gg and claim rewards')
        .addSubcommand(s => s.setName('claim').setDescription('Claim your vote reward after voting on Top.gg'))
        .addSubcommand(s => s.setName('stats').setDescription('View your voting stats'))
        .addSubcommand(s => s.setName('leaderboard').setDescription('View top voters'))
        .addSubcommand(s => s.setName('portal').setDescription('Open the vote portal'))
        .addSubcommand(s => s.setName('status').setDescription('View vote system status (admin)')),

    // ================= PREFIX =================
    run: async (client, message, args, db, ss, used) => {
        const guildId = message.guild?.id ?? 'DM';
        if (!message.guild) return message.reply(tServerOnlySafe()).catch(() => {});
        voteSync.setupDB(db);
        const lang = pl(ss);
        const t = T[lang] || T.en;
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const gid = message.guild.id;
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);

        function tServerOnlySafe() { return (T[pl(ss)] || T.en).serverOnly; }

        // ---- CLAIM (delegated to engine) ----
        if (sub === 'claim') {
            const result = await voteSync.processVote(uid, gid, client);
            if (!result.success) {
                if (result.error === 'NOT_VOTED') {
                    const embed = new EmbedBuilder().setColor('#e74c3c').setTitle(t.noVote)
                        .setDescription(t.voteFirst.replace('{link}', t.voteLink.replace('{botId}', client.user.id)));
                    return message.reply({ embeds: [embed] }).catch(() => {});
                }
                if (result.error === 'CHECK_FAILED') return message.reply({ content: t.checkError, allowedMentions: { parse: [] } }).catch(() => {});
                if (result.error === 'COOLDOWN') return message.reply({ embeds: [new EmbedBuilder().setColor('#e67e22').setTitle(t.cooldownWord).setDescription(t.alreadyClaimed.replace('{time}', `<t:${result.nextVote}:R>`))] }).catch(() => {});
                return message.reply({ content: t.processFail, allowedMentions: { parse: [] } }).catch(() => {});
            }
            const embed = buildClaimEmbed(t, result, result.nextVote);
            message.reply({ embeds: [embed] }).catch(() => {});
            if (result.dmSent !== false) message.reply({ content: t.dmSuccess, allowedMentions: { parse: [] } }).catch(() => {});
            return;
        }

        // ---- STATS ----
        if (sub === 'stats' || sub === 'info') {
            const stats = voteSync.getStats(db, uid, gid);
            const all = db.prepare(`SELECT user_id FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC`).all(gid);
            const rank = all.findIndex(u => u.user_id === uid);
            const embed = new EmbedBuilder().setColor('#ffd700')
                .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
                .setTitle(`📊 ${t.title}`)
                .addFields(
                    { name: t.streak.replace('{days}', stats.current_streak), value: t.best.replace('{days}', stats.best_streak), inline: true },
                    { name: t.total.replace('{n}', stats.total_votes), value: t.rewards.replace('{n}', stats.total_rewards.toLocaleString()), inline: true },
                    { name: t.rankLabel, value: rank >= 0 ? `#${rank + 1}` : t.unranked, inline: true }
                ).setFooter({ text: t.footer }).setTimestamp();
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // ---- LEADERBOARD ----
        if (sub === 'lb' || sub === 'leaderboard' || sub === 'top') {
            const lb = db.prepare(`SELECT user_id, total_votes, current_streak, best_streak, total_rewards FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC LIMIT 10`).all(gid);
            const entries = await Promise.all(lb.map(async row => {
                let username; try { username = (await client.users.fetch(row.user_id)).username; } catch { username = 'Unknown'; }
                return { ...row, username };
            }));
            try {
                const img = await buildVoteLBCanvas(entries, message.guild?.name || 'ARCHON', client.user.displayAvatarURL({ size: 128 }));
                const { AttachmentBuilder } = require('discord.js');
                const att = new AttachmentBuilder(img, { name: 'vote-leaderboard.png' });
                return message.reply({ files: [att] }).catch(() => {});
            } catch(e) {
                console.error('[VOTE LB CANVAS]', e.message);
                return message.reply(t.lbFailMsg).catch(() => {});
            }
        }

        // ---- ADMIN RAW BAL ----
        if (sub === 'rawbal' && isAdmin) {
            const targetId = args[1]?.replace(/[<@!>]/g, '') || uid;
            const raw = db.prepare("SELECT credits FROM users WHERE id = ? AND guild_id = ?").get(targetId, gid);
            return message.reply(`🔍 RAW DB: credits=${raw?.credits ?? 'NOT FOUND'}`).catch(() => {});
        }

        // ---- ADMIN FIX VOTES ----
        if (sub === 'fixvotes' && isAdmin) {
            const alreadyRan = db.prepare(`SELECT value FROM bot_meta WHERE key = 'fixvotes_ran'`).get();
            if (alreadyRan) {
                return message.reply(`❌ fixvotes was already executed on ${alreadyRan.value}. Cannot run again to prevent duplicate credits.`).catch(() => {});
            }
            const voteRewards = db.prepare(`SELECT user_id, guild_id, SUM(reward) as total FROM vote_claims GROUP BY user_id, guild_id`).all();
            if (voteRewards.length === 0) {
                return message.reply('❌ No vote history found.').catch(() => {});
            }
            let report = '';
            let totalFixed = 0;
            const repair = db.transaction(() => {
                for (const row of voteRewards) {
                    const profile = db.prepare(`SELECT credits FROM users WHERE id = ? AND guild_id = ?`).get(row.user_id, row.guild_id);
                    if (profile) {
                        const before = profile.credits || 0;
                        const after = before + row.total;
                        db.prepare(`UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?`).run(after, row.user_id, row.guild_id);
                        const check = db.prepare(`SELECT credits FROM users WHERE id = ? AND guild_id = ?`).get(row.user_id, row.guild_id);
                        report += `- <@${row.user_id}> Server ${row.guild_id}: ${before} → ${check.credits} (+${row.total})\n`;
                        totalFixed++;
                    } else {
                        db.prepare(`INSERT INTO users (id, guild_id, credits, xp, level, streak_days, last_daily, total_dailies, highest_streak) VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0)`).run(row.user_id, row.guild_id, row.total);
                        report += `- <@${row.user_id}> Server ${row.guild_id}: NEW → ${row.total}\n`;
                        totalFixed++;
                    }
                }
            });
            repair();
            db.prepare(`CREATE TABLE IF NOT EXISTS bot_meta (key TEXT PRIMARY KEY, value TEXT)`).run();
            db.prepare(`INSERT OR REPLACE INTO bot_meta (key, value) VALUES ('fixvotes_ran', ?)`).run(new Date().toISOString());
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🔧 VOTE REPAIR COMPLETE')
                .setDescription(report.substring(0, 2000) || '✅ Done')
                .setFooter({ text: `${totalFixed} entries fixed • Locked permanently` });
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // ---- ADMIN DIAGNOSTIC ----
        if (sub === 'diag' && isAdmin) {
            const targetId = args[1]?.replace(/[<@!>]/g, '') || uid;
            const voteHistory = db.prepare(`SELECT guild_id, total_votes, total_rewards FROM user_votes WHERE user_id = ?`).all(targetId);
            const profiles = db.prepare(`SELECT guild_id, credits, xp, level FROM users WHERE id = ?`).all(targetId);
            let msg = `## 🩺 Diagnostic pour <@${targetId}>\n\n`;
            msg += `### 📊 Historique de votes :\n`;
            if (voteHistory.length === 0) {
                msg += `❌ Aucun historique\n`;
            } else {
                for (const v of voteHistory) {
                    msg += `- Serveur **${v.guild_id}** : ${v.total_votes} votes, ${v.total_rewards} crédits gagnés\n`;
                }
            }
            msg += `\n### 👤 Profils utilisateur :\n`;
            if (profiles.length === 0) {
                msg += `❌ Aucun profil trouvé\n`;
            } else {
                for (const p of profiles) {
                    msg += `- Serveur **${p.guild_id}** : ${p.credits.toLocaleString()} crédits, Niv.${p.level}, ${p.xp} XP\n`;
                }
            }
            msg += `\n### 🔍 Serveur actuel : **${gid}**`;
            return message.reply({ content: msg, allowedMentions: { parse: [] } }).catch(() => {});
        }

        // ---- ADMIN STATUS ----
        if (sub === 'status' && isAdmin) {
            const hasApi = !!process.env.TOPGG_API_TOKEN;
            const hasWebhook = !!(process.env.TOPGG_WEBHOOK_SECRET || process.env.TOPGG_WEBHOOK_AUTH);
            const mode = hasWebhook ? t.modeWebhook : hasApi ? t.modePoll : t.modeFallback;
            const embed = new EmbedBuilder().setColor(hasApi ? '#2ecc71' : '#e74c3c').setTitle(t.statusTitle)
                .addFields(
                    { name: t.statusMode.replace('{mode}', ''), value: mode, inline: false },
                    { name: t.statusApi, value: hasApi ? '✅ Configured' : '❌ Missing TOPGG_API_TOKEN', inline: true },
                    { name: t.statusWebhook, value: hasWebhook ? '✅ Configured' : '❌ Not configured', inline: true }
                ).setFooter({ text: t.footer }).setTimestamp();
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // ---- PORTAL (default) ----
        const status = await getRealtimeStatus(client, uid, gid, db);
        const embed = buildPortalEmbed(client, message.author, status, t, lang, message.guild);
        const row = buildPortalRow(client, status, t, false);
        const sent = await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
        if (!sent) return;

        const collector = sent.createMessageComponentCollector({ time: 120000 });
        collector.on('collect', async i => {
            if (i.user.id !== uid) return i.reply({ content: t.notYours, flags: MessageFlags.Ephemeral }).catch(() => {});
            await i.deferUpdate().catch(() => {});

            if (i.customId === 'vote_check_status') {
                const stats = voteSync.getStats(db, uid, gid);
                const now = Math.floor(Date.now() / 1000);
                const nextVote = (stats.last_vote_date || 0) + 43200;
                const remaining = Math.max(0, nextVote - now);
                const h = Math.floor(remaining / 3600);
                const m = Math.floor((remaining % 3600) / 60);
                const s = remaining % 60;

                const ce = new EmbedBuilder()
                    .setColor('#f39c12')
                    .setTitle(t.cooldownTitle)
                    .setDescription(
                        `${t.cooldownGreeting.replace('{user}', i.user.username)}\n\n` +
                        `${t.cooldownBody}\n\n` +
                        `**${t.cooldownExact}:**\n` +
                        `\`\`\`yaml\n${h}h ${m}m ${s}s\n\`\`\`\n` +
                        `${t.cooldownVoteAgainAt} <t:${nextVote}:R>.\n` +
                        `${t.cooldownFullAuth} <t:${nextVote}:F>\n\n` +
                        t.cooldownLive
                    )
                    .setFooter({ text: 'ARCHON CG-223 • Vote Command' });

                i.followUp({ embeds: [ce], flags: MessageFlags.Ephemeral }).catch(() => {});
                return;
            }

            if (i.customId === 'vote_claim') {
                const result = await voteSync.processVote(uid, gid, client);
                if (!result.success) {
                    if (result.error === 'NOT_VOTED') return i.followUp({ content: t.noVote + ' ' + t.voteFirst.replace('{link}', t.voteLink.replace('{botId}', client.user.id)), flags: MessageFlags.Ephemeral }).catch(() => {});
                    if (result.error === 'CHECK_FAILED') return i.followUp({ content: t.checkError, flags: MessageFlags.Ephemeral }).catch(() => {});
                    if (result.error === 'COOLDOWN') return i.followUp({ embeds: [new EmbedBuilder().setColor('#e67e22').setDescription(t.alreadyClaimed.replace('{time}', `<t:${result.nextVote}:R>`))], flags: MessageFlags.Ephemeral }).catch(() => {});
                    return i.followUp({ content: t.processFail, flags: MessageFlags.Ephemeral }).catch(() => {});
                }
                const ce = buildClaimEmbed(t, result, result.nextVote);
                i.followUp({ embeds: [ce], flags: MessageFlags.Ephemeral }).catch(() => {});
                await sent.delete().catch(() => {});
            } else if (i.customId === 'vote_stats') {
                const s = voteSync.getStats(db, uid, gid);
                const all = db.prepare(`SELECT user_id FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC`).all(gid);
                const r = all.findIndex(u => u.user_id === uid);
                const se = new EmbedBuilder().setColor('#ffd700').setTitle(`📊 ${t.title}`)
                    .addFields(
                        { name: t.streak.replace('{days}', s.current_streak), value: t.best.replace('{days}', s.best_streak), inline: true },
                        { name: t.total.replace('{n}', s.total_votes), value: t.rewards.replace('{n}', s.total_rewards.toLocaleString()), inline: true },
                        { name: t.rankLabel, value: r >= 0 ? `#${r + 1}` : t.unranked, inline: true }
                    ).setFooter({ text: t.footer }).setTimestamp();
                i.followUp({ embeds: [se], flags: MessageFlags.Ephemeral }).catch(() => {});
            } else if (i.customId === 'vote_lb') {
                const lb = db.prepare(`SELECT user_id, total_votes, current_streak, best_streak, total_rewards FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC LIMIT 10`).all(gid);
                const entries = await Promise.all(lb.map(async row => {
                    let username; try { username = (await client.users.fetch(row.user_id)).username; } catch { username = 'Unknown'; }
                    return { ...row, username };
                }));
                try {
                    const img = await buildVoteLBCanvas(entries, message.guild?.name || 'ARCHON', i.client.user.displayAvatarURL({ size: 128 }));
                    const { AttachmentBuilder } = require('discord.js');
                    const att = new AttachmentBuilder(img, { name: 'vote-leaderboard.png' });
                    i.followUp({ files: [att], flags: MessageFlags.Ephemeral }).catch(() => {});
                } catch(e) {
                    console.error('[VOTE LB CANVAS]', e.message);
                    i.followUp({ content: t.lbFailMsg, flags: MessageFlags.Ephemeral }).catch(() => {});
                }
            }
        });
    },

    // ================= SLASH =================
    execute: async (interaction, client) => {
        if (!interaction.guild) return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        voteSync.setupDB(client.db);
        const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr', 'zh', 'ar']);
        const t = T[lang] || T.en;
        const uid = interaction.user.id;
        const gid = interaction.guildId;
        const sub = interaction.options.getSubcommand();

        // ---- CLAIM ----
        if (sub === 'claim') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const result = await voteSync.processVote(uid, gid, client);
            if (!result.success) {
                if (result.error === 'NOT_VOTED') return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setTitle(t.noVote).setDescription(t.voteFirst.replace('{link}', t.voteLink.replace('{botId}', client.user.id)))] });
                if (result.error === 'CHECK_FAILED') return interaction.editReply({ content: t.checkError });
                if (result.error === 'COOLDOWN') return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e67e22').setDescription(t.alreadyClaimed.replace('{time}', `<t:${result.nextVote}:R>`))] });
                return interaction.editReply({ content: t.processFail });
            }
            await interaction.editReply({ embeds: [buildClaimEmbed(t, result, result.nextVote)] });
            if (result.dmSent !== false) {
                await interaction.followUp({ content: t.dmSuccess, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
            return;
        }

        // ---- STATS ----
        if (sub === 'stats') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const stats = voteSync.getStats(client.db, uid, gid);
            const all = client.db.prepare(`SELECT user_id FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC`).all(gid);
            const rank = all.findIndex(u => u.user_id === uid);
            const embed = new EmbedBuilder().setColor('#ffd700').setTitle(`📊 ${t.title}`)
                .addFields(
                    { name: t.streak.replace('{days}', stats.current_streak), value: t.best.replace('{days}', stats.best_streak), inline: true },
                    { name: t.total.replace('{n}', stats.total_votes), value: t.rewards.replace('{n}', stats.total_rewards.toLocaleString()), inline: true },
                    { name: t.rankLabel, value: rank >= 0 ? `#${rank + 1}` : t.unranked, inline: true }
                ).setFooter({ text: t.footer }).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // ---- LEADERBOARD ----
        if (sub === 'leaderboard') {
            await interaction.deferReply();
            const lb = client.db.prepare(`SELECT user_id, total_votes, current_streak, best_streak, total_rewards FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC LIMIT 10`).all(gid);
            const entries = await Promise.all(lb.map(async row => {
                let username; try { username = (await client.users.fetch(row.user_id)).username; } catch { username = 'Unknown'; }
                return { ...row, username };
            }));
            try {
                const img = await buildVoteLBCanvas(entries, interaction.guild?.name || 'ARCHON', interaction.client.user.displayAvatarURL({ size: 128 }));
                const { AttachmentBuilder } = require('discord.js');
                const att = new AttachmentBuilder(img, { name: 'vote-leaderboard.png' });
                return interaction.editReply({ files: [att] });
            } catch(e) {
                console.error('[VOTE LB CANVAS]', e.message);
                return interaction.editReply({ content: t.lbFailMsg });
            }
        }

        // ---- STATUS (admin) ----
        if (sub === 'status') {
            if (!interaction.member.permissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: t.adminOnly, flags: MessageFlags.Ephemeral });
            }
            const hasApi = !!process.env.TOPGG_API_TOKEN;
            const hasWebhook = !!(process.env.TOPGG_WEBHOOK_SECRET || process.env.TOPGG_WEBHOOK_AUTH);
            const mode = hasWebhook ? t.modeWebhook : hasApi ? t.modePoll : t.modeFallback;
            const embed = new EmbedBuilder().setColor(hasApi ? '#2ecc71' : '#e74c3c').setTitle(t.statusTitle)
                .addFields(
                    { name: t.statusMode.replace('{mode}', ''), value: mode, inline: false },
                    { name: t.statusApi, value: hasApi ? '✅ Configured' : '❌ Missing TOPGG_API_TOKEN', inline: true },
                    { name: t.statusWebhook, value: hasWebhook ? '✅ Configured' : '❌ Not configured', inline: true }
                ).setFooter({ text: t.footer }).setTimestamp();
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // ---- PORTAL (default) ----
        await interaction.deferReply();
        const status = await getRealtimeStatus(client, uid, gid, client.db);
        const embed = buildPortalEmbed(client, interaction.user, status, t, lang, interaction.guild);
        const row = buildPortalRow(client, status, t, true);
        interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
    },

    // ================= BUTTON HANDLER (slash portal) =================
    async handleSlashButton(interaction, client) {
        voteSync.setupDB(client.db);
        const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr', 'zh', 'ar']);
        const t = T[lang] || T.en;
        const uid = interaction.user.id;
        const gid = interaction.guildId;
        const id = interaction.customId;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // ---- CHECK COOLDOWN ----
        if (id === 'vote_check_status_slash') {
            const stats = voteSync.getStats(client.db, uid, gid);
            const now = Math.floor(Date.now() / 1000);
            const nextVote = (stats.last_vote_date || 0) + 43200;
            const remaining = Math.max(0, nextVote - now);
            const h = Math.floor(remaining / 3600);
            const m = Math.floor((remaining % 3600) / 60);
            const s = remaining % 60;

            const ce = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle(t.cooldownTitle)
                .setDescription(
                    `${t.cooldownGreeting.replace('{user}', interaction.user.username)}\n\n` +
                    `${t.cooldownBody}\n\n` +
                    `**${t.cooldownExact}:**\n` +
                    `\`\`\`yaml\n${h}h ${m}m ${s}s\n\`\`\`\n` +
                    `${t.cooldownVoteAgainAt} <t:${nextVote}:R>.\n` +
                    `${t.cooldownFullAuth} <t:${nextVote}:F>\n\n` +
                    t.cooldownLive
                )
                .setFooter({ text: 'ARCHON CG-223 • Vote Command' });

            return interaction.editReply({ embeds: [ce] });
        }

        // ---- CLAIM ----
        if (id === 'vote_claim_slash') {
            const result = await voteSync.processVote(uid, gid, client);
            if (!result.success) {
                if (result.error === 'NOT_VOTED') return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setTitle(t.noVote).setDescription(t.voteFirst.replace('{link}', t.voteLink.replace('{botId}', client.user.id)))] });
                if (result.error === 'CHECK_FAILED') return interaction.editReply({ content: t.checkError });
                if (result.error === 'COOLDOWN') return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e67e22').setDescription(t.alreadyClaimed.replace('{time}', `<t:${result.nextVote}:R>`))] });
                return interaction.editReply({ content: t.processFail });
            }
            await interaction.editReply({ embeds: [buildClaimEmbed(t, result, result.nextVote)] });
            if (result.dmSent !== false) {
                await interaction.followUp({ content: t.dmSuccess, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
            return;
        }

        // ---- STATS ----
        if (id === 'vote_stats_slash') {
            const stats = voteSync.getStats(client.db, uid, gid);
            const all = client.db.prepare(`SELECT user_id FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC`).all(gid);
            const rank = all.findIndex(u => u.user_id === uid);
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ffd700').setTitle(`📊 ${t.title}`).addFields(
                { name: t.streak.replace('{days}', stats.current_streak), value: t.best.replace('{days}', stats.best_streak), inline: true },
                { name: t.total.replace('{n}', stats.total_votes), value: t.rewards.replace('{n}', stats.total_rewards.toLocaleString()), inline: true },
                { name: t.rankLabel, value: rank >= 0 ? `#${rank + 1}` : t.unranked, inline: true }
            ).setFooter({ text: t.footer }).setTimestamp()] });
        }

        // ---- LEADERBOARD ----
        if (id === 'vote_lb_slash') {
            const lb = client.db.prepare(`SELECT user_id, total_votes, current_streak, best_streak, total_rewards FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC LIMIT 10`).all(gid);
            let desc = '```yaml\n';
            for (let i = 0; i < lb.length; i++) { let n; try { n = (await client.users.fetch(lb[i].user_id)).username; } catch { n = 'Unknown'; } desc += `${t.rankEmoji[i] || '📌'} ${n.padEnd(18)} ${lb[i].total_votes} ${t.votesUnit}\n`; }
            desc += '```';
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ffd700').setTitle(t.lbTitle).setDescription(desc).setFooter({ text: t.footer }).setTimestamp()] });
        }
    },

    // ================= EXPORTS =================
    processVote: voteSync.processVote,
    getStats: voteSync.getStats,
    checkTopGGVote: voteSync.checkTopGGVote,
    setupDB: voteSync.setupDB,
    T
};
