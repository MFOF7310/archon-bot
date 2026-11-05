// ═══ ARCHON CG-223 — VOTE ═══
// .vote / /vote: the vote portal (vote on Top.gg, claim the reward, stats, leaderboard), as Components V2 cards.
// The reward, the 12-hour cooldown and the streak rules live in plugins/votesync.js; this file only shows them.
// Portal states:
//   first  never voted on this server: what voting brings, Vote + Claim
//   ready  can vote: streak, totals, progress to the next milestone, Vote + Claim + Stats + Leaderboard
//   claim  voted on Top.gg, reward not claimed yet: Claim first
//   wait   claimed less than 12 hours ago: when the next vote opens
// One icon per line (lib/icons: ARCHON's own emoji where it may use it), numbers in bold, buttons keep standard emojis.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AttachmentBuilder, escapeMarkdown } = require('discord.js');
const { toV2 } = require('../lib/v2convert');   // the admin repair report (classic embed → card)
const { card } = require('../lib/games/v2');
const { icon } = require('../lib/icons');

// ================= ENGINE IMPORTS =================
const voteSync = require('./votesync.js');
const { buildVoteLBCanvas } = require('./vote-lb-canvas.js');

// Same numbers as votesync.processVote / calculateReward
const COOLDOWN = 43200;          // 12 h between two claimed votes, counted over every server
const STREAK_WINDOW = 86400;     // a vote within 24 h of the last one keeps the streak
const BASE_REWARD = 1000;        // credits per vote
const MILESTONES = [[7, 2000], [30, 5000], [100, 10000]];   // streak → bonus credits
const COLOR = { ready: 0x2ecc71, claim: 0x2ecc71, wait: 0xf39c12, first: 0x5865f2, gold: 0xf1c40f, error: 0xe74c3c };

// ================= TEXTS (en/fr/zh/ar; Bambara falls back to English) =================
// {days}, {best}, {votes}, {credits}, {base}, {bonus}, {next} and {n} in claimTitle come with their unit ("5 days").
const T = {
 en: {
  hello: 'Hello, {user}', helloBack: 'Welcome back, {user}', helloFirst: 'Welcome to voting, {user}', thanks: 'Thanks for your vote, {user}',
  subReady: 'You can vote now', subReadyStreak: 'You can vote now · streak of {days}', subWait: 'Your next vote opens {when}',
  subFirst: 'Your first vote is waiting', subClaim: 'Your vote came in: your reward is waiting',
  streak: 'Streak {days} · best {best}', streakEnded: 'Your streak of {days} ended · best {best}', totals: '{votes} · {credits} earned',
  voteAt: 'You can vote at {time}', nextMilestone: 'Next milestone: {days} (+{bonus})', toGo: '**{n}** more for the bonus',
  allMilestones: 'Every milestone reached. Keep the streak going!',
  firstBody: 'Vote for ARCHON on Top.gg, then press **{claim}**: every vote earns **{base}**, and voting several days in a row unlocks bonuses.',
  bonuses: 'Bonuses at **7**, **30** and **100** days in a row',
  btnVote: 'Vote on Top.gg', btnClaim: 'Claim', btnStats: 'My stats', btnTop: 'Leaderboard', btnWait: 'Time left',
  claimTitle: 'Reward received: +{n}', claimMilestone: 'Milestone of {days} reached: **+{bonus}** bonus included',
  claimStreak: 'Streak {days} · **{left}** more to reach {next}', claimStreakTop: 'Streak {days} · every milestone reached',
  nextVote: 'Next vote {when}', claimDm: 'The details are in your DMs.',
  notVotedTitle: "You haven't voted yet", notVotedBody: 'Vote on Top.gg, then press **{claim}** again.',
  alreadyTitle: 'Already claimed', alreadyBody: 'The reward for this vote is already yours. Next vote {when}.',
  checkFail: "I can't check your vote right now. Try again in a moment.", processFail: "Your vote couldn't be saved. Try again later.",
  statsTitle: 'Vote stats', votesMonth: '{votes} · {month} this month', credits: '{n} earned',
  rank: 'Rank **#{n}** on this server', unranked: 'Not ranked yet',
  topTitle: 'Top voters', topEmpty: 'Nobody has voted here yet.',
  waitTitle: 'Your next vote opens {when}', waitLeft: 'Time left: **{left}**', waitAt: 'You can vote again on {full}.',
  waitLive: 'The countdown updates by itself in Discord.', hm: '{h} h {m} min', mOnly: '{m} min', readyNow: 'You can vote now',
  statusTitle: 'Vote system', statusMode: 'Mode: **{mode}**',
  modeWebhook: 'webhook (instant)', modePoll: 'Top.gg check when claiming', modeFallback: 'manual only',
  apiOk: 'Top.gg API configured', apiMissing: 'Top.gg API missing: set TOPGG_API_TOKEN', hookOk: 'Webhook configured', hookMissing: 'Webhook not configured',
  notYours: "This menu isn't yours.", serverOnly: 'Servers only.', adminOnly: 'Admins only.',
  units: { day: ['day', 'days'], vote: ['vote', 'votes'], credit: ['credit', 'credits'] },
 },
 fr: {
  hello: 'Bonjour, {user}', helloBack: 'Bon retour, {user}', helloFirst: 'Bienvenue au vote, {user}', thanks: 'Merci pour ton vote, {user}',
  subReady: 'Tu peux voter maintenant', subReadyStreak: 'Tu peux voter maintenant · série de {days}', subWait: 'Ton prochain vote ouvre {when}',
  subFirst: "Ton premier vote t'attend", subClaim: "Ton vote est bien arrivé : ta récompense t'attend",
  streak: 'Série {days} · record {best}', streakEnded: "Ta série de {days} s'est arrêtée · record {best}", totals: '{votes} · {credits} gagnés',
  voteAt: 'Vote possible à {time}', nextMilestone: 'Prochain palier : {days} (+{bonus})', toGo: 'encore **{n}** pour le bonus',
  allMilestones: 'Tous les paliers sont atteints. Garde ta série !',
  firstBody: 'Vote pour ARCHON sur Top.gg, puis appuie sur **{claim}** : chaque vote rapporte **{base}**, et voter plusieurs jours de suite débloque des bonus.',
  bonuses: 'Bonus à **7**, **30** et **100** jours de série',
  btnVote: 'Voter sur Top.gg', btnClaim: 'Récupérer', btnStats: 'Mes stats', btnTop: 'Classement', btnWait: 'Voir le délai',
  claimTitle: 'Récompense reçue : +{n}', claimMilestone: 'Palier des {days} atteint : **+{bonus}** de bonus inclus',
  claimStreak: 'Série {days} · encore **{left}** pour le bonus des {next}', claimStreakTop: 'Série {days} · tous les paliers sont atteints',
  nextVote: 'Prochain vote {when}', claimDm: 'Le détail est dans tes messages privés.',
  notVotedTitle: "Tu n'as pas encore voté", notVotedBody: 'Vote sur Top.gg, puis appuie de nouveau sur **{claim}**.',
  alreadyTitle: 'Déjà récupérée', alreadyBody: 'La récompense de ce vote est déjà à toi. Prochain vote {when}.',
  checkFail: "Je n'arrive pas à vérifier ton vote pour l'instant. Réessaie dans un moment.", processFail: "Ton vote n'a pas pu être enregistré. Réessaie plus tard.",
  statsTitle: 'Statistiques de vote', votesMonth: '{votes} · {month} ce mois-ci', credits: '{n} gagnés',
  rank: 'Rang **#{n}** sur ce serveur', unranked: 'Pas encore classé',
  topTitle: 'Meilleurs votants', topEmpty: "Personne n'a encore voté ici.",
  waitTitle: 'Ton prochain vote ouvre {when}', waitLeft: 'Temps restant : **{left}**', waitAt: 'Tu pourras voter de nouveau : {full}.',
  waitLive: 'Le compte à rebours se met à jour tout seul dans Discord.', hm: '{h} h {m} min', mOnly: '{m} min', readyNow: 'Tu peux voter maintenant',
  statusTitle: 'Système de vote', statusMode: 'Mode : **{mode}**',
  modeWebhook: 'webhook (instantané)', modePoll: 'vérification Top.gg à la récupération', modeFallback: 'manuel uniquement',
  apiOk: 'API Top.gg configurée', apiMissing: 'API Top.gg manquante : renseigne TOPGG_API_TOKEN', hookOk: 'Webhook configuré', hookMissing: 'Webhook non configuré',
  notYours: "Ce menu n'est pas à toi.", serverOnly: 'Réservé aux serveurs.', adminOnly: 'Réservé aux admins.',
  units: { day: ['jour', 'jours'], vote: ['vote', 'votes'], credit: ['crédit', 'crédits'] },
 },
 zh: {
  hello: '你好，{user}', helloBack: '欢迎回来，{user}', helloFirst: '欢迎参与投票，{user}', thanks: '感谢你的投票，{user}',
  subReady: '现在就可以投票', subReadyStreak: '现在就可以投票 · 已连投 {days}', subWait: '下次投票：{when}',
  subFirst: '你的第一票正等着你', subClaim: '投票已收到，奖励等你领取',
  streak: '连投 {days} · 最高 {best}', streakEnded: '{days}的连投已中断 · 最高 {best}', totals: '{votes} · 已获得 {credits}',
  voteAt: '{time} 起可以投票', nextMilestone: '下一个里程碑：{days}（+{bonus}）', toGo: '再投 **{n}** 次拿奖励',
  allMilestones: '所有里程碑都已达成，继续保持！',
  firstBody: '在 Top.gg 为 ARCHON 投票，然后点击**{claim}**：每票可得 **{base}**，连续投票还能解锁额外奖励。',
  bonuses: '连投 **7**、**30**、**100** 天可获额外奖励',
  btnVote: '去 Top.gg 投票', btnClaim: '领取', btnStats: '我的统计', btnTop: '排行榜', btnWait: '剩余时间',
  claimTitle: '奖励已到账：+{n}', claimMilestone: '达成连投 {days}的里程碑：已含 **+{bonus}** 奖励',
  claimStreak: '连投 {days} · 再投 **{left}** 次达到 {next}', claimStreakTop: '连投 {days} · 所有里程碑都已达成',
  nextVote: '下次投票：{when}', claimDm: '详细信息已私信发给你。',
  notVotedTitle: '你还没有投票', notVotedBody: '先去 Top.gg 投票，然后再点**{claim}**。',
  alreadyTitle: '已经领取过了', alreadyBody: '这次投票的奖励已经到账。下次投票：{when}。',
  checkFail: '暂时无法检查你的投票，请稍后再试。', processFail: '投票没能保存，请稍后再试。',
  statsTitle: '投票统计', votesMonth: '{votes} · 本月 {month} 次', credits: '已获得 {n}',
  rank: '本服务器排名 **#{n}**', unranked: '暂未上榜',
  topTitle: '投票排行榜', topEmpty: '这里还没有人投票。',
  waitTitle: '下次投票：{when}', waitLeft: '剩余时间：**{left}**', waitAt: '可再次投票的时间：{full}。',
  waitLive: '倒计时会在 Discord 中自动更新。', hm: '{h} 小时 {m} 分钟', mOnly: '{m} 分钟', readyNow: '现在就可以投票',
  statusTitle: '投票系统', statusMode: '模式：**{mode}**',
  modeWebhook: 'Webhook（即时）', modePoll: '领取时检查 Top.gg', modeFallback: '仅手动',
  apiOk: 'Top.gg API 已配置', apiMissing: '缺少 Top.gg API：请设置 TOPGG_API_TOKEN', hookOk: 'Webhook 已配置', hookMissing: 'Webhook 未配置',
  notYours: '这不是你的菜单。', serverOnly: '仅限服务器使用。', adminOnly: '仅限管理员。',
  units: { day: ['天', '天'], vote: ['次投票', '次投票'], credit: ['积分', '积分'] },
 },
 ar: {
  hello: 'مرحبًا، {user}', helloBack: 'أهلًا بعودتك، {user}', helloFirst: 'أهلًا بك في التصويت، {user}', thanks: 'شكرًا على تصويتك، {user}',
  subReady: 'يمكنك التصويت الآن', subReadyStreak: 'يمكنك التصويت الآن · السلسلة {days}', subWait: 'تصويتك التالي {when}',
  subFirst: 'تصويتك الأول بانتظارك', subClaim: 'وصل تصويتك، ومكافأتك بانتظارك',
  streak: 'السلسلة {days} · الأفضل {best}', streakEnded: 'انتهت سلسلتك ({days}) · الأفضل {best}', totals: '{votes} · {credits} مكتسب',
  voteAt: 'يمكنك التصويت عند {time}', nextMilestone: 'المحطة التالية: {days} (+{bonus})', toGo: 'باقي **{n}** للمكافأة',
  allMilestones: 'وصلت إلى كل المحطات. حافظ على سلسلتك!',
  firstBody: 'صوّت لـ ARCHON على Top.gg ثم اضغط **{claim}**: كل تصويت يمنحك **{base}**، والتصويت عدة أيام متتالية يفتح مكافآت إضافية.',
  bonuses: 'مكافآت عند **7** و**30** و**100** يوم متتالية',
  btnVote: 'صوّت على Top.gg', btnClaim: 'استلام', btnStats: 'إحصائياتي', btnTop: 'التصنيف', btnWait: 'الوقت المتبقي',
  claimTitle: 'وصلتك المكافأة: +{n}', claimMilestone: 'وصلت إلى محطة {days}: تشمل **+{bonus}** إضافية',
  claimStreak: 'السلسلة {days} · باقي **{left}** للوصول إلى {next}', claimStreakTop: 'السلسلة {days} · وصلت إلى كل المحطات',
  nextVote: 'التصويت التالي {when}', claimDm: 'التفاصيل في رسائلك الخاصة.',
  notVotedTitle: 'لم تصوّت بعد', notVotedBody: 'صوّت على Top.gg، ثم اضغط **{claim}** مرة أخرى.',
  alreadyTitle: 'تم الاستلام مسبقًا', alreadyBody: 'مكافأة هذا التصويت وصلتك بالفعل. التصويت التالي {when}.',
  checkFail: 'لا أستطيع التحقق من تصويتك الآن. حاول بعد قليل.', processFail: 'تعذّر حفظ تصويتك. حاول لاحقًا.',
  statsTitle: 'إحصائيات التصويت', votesMonth: '{votes} · {month} هذا الشهر', credits: '{n} مكتسب',
  rank: 'الترتيب **#{n}** في هذا السيرفر', unranked: 'غير مصنف بعد',
  topTitle: 'أكثر المصوّتين', topEmpty: 'لم يصوّت أحد هنا بعد.',
  waitTitle: 'تصويتك التالي {when}', waitLeft: 'الوقت المتبقي: **{left}**', waitAt: 'يمكنك التصويت مجددًا: {full}.',
  waitLive: 'العداد يتحدّث تلقائيًا في ديسكورد.', hm: '{h} س {m} د', mOnly: '{m} د', readyNow: 'يمكنك التصويت الآن',
  statusTitle: 'نظام التصويت', statusMode: 'الوضع: **{mode}**',
  modeWebhook: 'Webhook (فوري)', modePoll: 'فحص Top.gg عند الاستلام', modeFallback: 'يدوي فقط',
  apiOk: 'Top.gg API مُعدّة', apiMissing: 'Top.gg API غير مُعدّة: أضف TOPGG_API_TOKEN', hookOk: 'Webhook مُعدّ', hookMissing: 'Webhook غير مُعدّ',
  notYours: 'هذه القائمة ليست لك.', serverOnly: 'للسيرفرات فقط.', adminOnly: 'للمشرفين فقط.',
  units: { day: ['يوم', 'يوم'], vote: ['تصويت', 'تصويت'], credit: ['رصيد', 'رصيد'] },
 },
};

// ================= HELPERS =================
const OKL = ['en', 'fr', 'bm', 'zh', 'ar'];
const pl = (o) => OKL.includes(o?.language) ? o.language : 'en';
const L = (lang) => T[lang] || T.en;
const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
const num = (n, lang) => Number(n || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
const bold = (s) => `**${s}**`;
const esc = (s) => (typeof escapeMarkdown === 'function' ? escapeMarkdown(String(s)) : String(s));
const eph = (p) => ({ ...p, flags: (p.flags || 0) | MessageFlags.Ephemeral });
const voteUrl = (client) => `https://top.gg/bot/${client.user.id}/vote`;
const nextMilestone = (streak) => MILESTONES.find(([d]) => streak < d) || null;

// "5 days", "1 vote", in the card's language
function amount(n, unit, lang) {
    const [one, many] = L(lang).units[unit];
    return `${num(n, lang)} ${Number(n) === 1 ? one : many}`;
}

// The member as the card names them: server nickname, else display name, else username (markdown escaped)
function whoOf(user, member) {
    const name = member?.displayName || user?.globalName || user?.username || '?';
    const holder = typeof member?.displayAvatarURL === 'function' ? member : user;
    let avatar = null;
    try { avatar = holder?.displayAvatarURL?.({ size: 128 }) || null; } catch { avatar = null; }
    return { name: esc(name), avatar };
}

// When the next vote opens: 12 h after the last claimed vote, on any server (as votesync.processVote counts it)
function nextVoteOf(db, uid, gid) {
    const s = voteSync.getStats(db, uid, gid);
    let last = s.last_vote_date || 0;
    try { last = Math.max(last, db.prepare('SELECT MAX(last_vote_date) AS t FROM user_votes WHERE user_id = ?').get(uid)?.t || 0); } catch { /* the per-server date is enough */ }
    return { stats: s, last, nextVote: last + COOLDOWN };
}

function rankOf(db, gid, uid) {
    try { return db.prepare('SELECT user_id FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC').all(gid).findIndex((u) => u.user_id === uid); } catch { return -1; }
}

function topRows(db, gid) {
    try { return db.prepare('SELECT user_id, total_votes, current_streak, best_streak, total_rewards FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC LIMIT 10').all(gid); } catch { return []; }
}

async function nameOf(client, id, display = true) {
    try { const u = await client.users.fetch(id); return (display && u.globalName) || u.username || 'Unknown'; } catch { return 'Unknown'; }
}

// ================= REALTIME VOTE STATUS =================
async function getRealtimeStatus(client, uid, gid, db) {
    const { stats, last, nextVote } = nextVoteOf(db, uid, gid);
    const now = Math.floor(Date.now() / 1000);
    // Top.gg: true (voted in the last 12 h), false, or null when it cannot be asked (no token, Top.gg down)
    let topgg = null;
    try {
        const v = await voteSync.checkTopGGVote(uid);
        if (v === true || v === false) topgg = v;
    } catch { topgg = null; }
    const isFirstTime = !(stats.total_votes > 0);
    const alive = stats.current_streak > 0 && now - (stats.last_vote_date || 0) <= STREAK_WINDOW;
    let state = 'ready';
    if (last && now < nextVote) state = 'wait';
    else if (topgg === true) state = 'claim';
    else if (isFirstTime) state = 'first';
    return { stats, state, nextVote, alive, topgg, isFirstTime };
}

// ================= CARDS =================
function recordLines(s, alive, lang, I) {
    const t = L(lang), out = [];
    if (s.current_streak > 0) {
        const v = { days: bold(amount(s.current_streak, 'day', lang)), best: bold(amount(Math.max(s.best_streak || 0, s.current_streak), 'day', lang)) };
        out.push(`${I('streak')} ${fill(alive ? t.streak : t.streakEnded, v)}`);
    }
    if (s.total_votes > 0) out.push(`${I('votes')} ${fill(t.totals, { votes: bold(amount(s.total_votes, 'vote', lang)), credits: bold(amount(s.total_rewards, 'credit', lang)) })}`);
    return out;
}

// The next milestone and how far the streak is, as a 10-step bar
function progressText(streak, lang, I) {
    const t = L(lang), m = nextMilestone(streak);
    if (!m) return `${I('milestone')} ${t.allMilestones}`;
    const [days, bonus] = m;
    const pct = Math.min(100, Math.round((streak / days) * 100));
    const filled = Math.round(pct / 10);
    const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
    const pctText = lang === 'fr' ? `${pct} %` : `${pct}%`;
    return `${I('milestone')} ${fill(t.nextMilestone, { days: bold(amount(days, 'day', lang)), bonus: amount(bonus, 'credit', lang) })}\n${bar} ${pctText} · ${fill(t.toGo, { n: days - streak })}`;
}

function voteButton(client, t, where) {
    return new ButtonBuilder().setLabel(t.btnVote).setStyle(ButtonStyle.Link).setURL(voteUrl(client)).setEmoji(icon('star', where));
}

function portalRow(client, state, t, sfx, where) {
    const row = new ActionRowBuilder();
    if (state === 'ready' || state === 'first') row.addComponents(voteButton(client, t, where));
    if (state !== 'wait') row.addComponents(new ButtonBuilder().setCustomId(`vote_claim${sfx}`).setLabel(t.btnClaim).setStyle(ButtonStyle.Success).setEmoji(icon('coins', where)));
    else row.addComponents(new ButtonBuilder().setCustomId(`vote_check_status${sfx}`).setLabel(t.btnWait).setStyle(ButtonStyle.Secondary).setEmoji(icon('clock', where)));
    if (state !== 'first') row.addComponents(
        new ButtonBuilder().setCustomId(`vote_stats${sfx}`).setLabel(t.btnStats).setStyle(ButtonStyle.Secondary).setEmoji(icon('stats', where)),
        new ButtonBuilder().setCustomId(`vote_lb${sfx}`).setLabel(t.btnTop).setStyle(ButtonStyle.Secondary).setEmoji(icon('trophy', where)),
    );
    return row;
}

function portalCard(client, who, status, lang, where, guildName, isSlash = false) {
    const t = L(lang), I = (k) => icon(k, where), s = status.stats;
    const vars = { user: who.name };
    let title, sub;
    if (status.state === 'first') { title = fill(t.helloFirst, vars); sub = t.subFirst; }
    else if (status.state === 'wait') { title = fill(t.helloBack, vars); sub = fill(t.subWait, { when: `<t:${status.nextVote}:R>` }); }
    else if (status.state === 'claim') { title = fill(t.thanks, vars); sub = t.subClaim; }
    else { title = fill(t.hello, vars); sub = status.alive ? fill(t.subReadyStreak, { days: amount(s.current_streak, 'day', lang) }) : t.subReady; }

    const head = `### ${title}\n-# ${sub}`;
    /** @type {any[]} */
    const items = [who.avatar ? { thumbnail: [head, who.avatar] } : { text: head }, { rule: true }];
    if (status.state === 'first') {
        items.push({ text: `${fill(t.firstBody, { claim: t.btnClaim, base: amount(BASE_REWARD, 'credit', lang) })}\n${I('gift')} ${t.bonuses}` });
    } else {
        const lines = [];
        if (status.state === 'wait') lines.push(`${I('clock')} ${fill(t.voteAt, { time: `<t:${status.nextVote}:t>` })}`);
        lines.push(...recordLines(s, status.alive, lang, I));
        if (lines.length) items.push({ text: lines.join('\n') });
        if (status.state !== 'wait') items.push({ rule: true }, { text: progressText(status.alive ? s.current_streak : 0, lang, I) });
    }
    items.push({ row: portalRow(client, status.state, t, isSlash ? '_slash' : '', where) });
    if (guildName) items.push({ text: `-# ${esc(guildName)}` });
    return card(COLOR[status.state] ?? COLOR.ready, items);
}

// What a claim answers: the reward, or why there is none (with the way forward)
function claimReply(client, result, lang, where, who) {
    const t = L(lang), I = (k) => icon(k, where);
    if (result?.success) {
        const lines = [];
        if (result.milestone) lines.push(`${I('trophy')} ${fill(t.claimMilestone, { days: amount(Number(result.milestone), 'day', lang), bonus: amount(result.bonus || 0, 'credit', lang) })}`);
        const m = nextMilestone(result.streak);
        const days = bold(amount(result.streak, 'day', lang));
        lines.push(`${I('streak')} ${m ? fill(t.claimStreak, { days, left: m[0] - result.streak, next: amount(m[0], 'day', lang) }) : fill(t.claimStreakTop, { days })}`);
        lines.push(`${I('clock')} ${fill(t.nextVote, { when: `<t:${result.nextVote}:R>` })}`);
        /** @type {any[]} */
        const items = [
            { text: `### ${fill(t.claimTitle, { n: amount(result.total, 'credit', lang) })}\n-# ${fill(t.thanks, { user: who.name })}` },
            { rule: true },
            { text: lines.join('\n') },
        ];
        if (result.dmSent) items.push({ text: `-# ${t.claimDm}` });
        return card(COLOR.ready, items);
    }
    if (result?.error === 'NOT_VOTED') return card(COLOR.error, [
        { text: `### ${I('no')} ${t.notVotedTitle}\n${fill(t.notVotedBody, { claim: t.btnClaim })}` },
        { row: new ActionRowBuilder().addComponents(voteButton(client, t)) },
    ]);
    if (result?.error === 'COOLDOWN') return card(COLOR.wait, [{ text: `### ${I('clock')} ${t.alreadyTitle}\n${fill(t.alreadyBody, { when: `<t:${result.nextVote}:R>` })}` }]);
    return { content: `${I('no')} ${result?.error === 'CHECK_FAILED' ? t.checkFail : t.processFail}`, allowedMentions: { parse: [] } };
}

function statsCard(s, rank, lang, where, who, guildName) {
    const t = L(lang), I = (k) => icon(k, where);
    const alive = s.current_streak > 0 && Math.floor(Date.now() / 1000) - (s.last_vote_date || 0) <= STREAK_WINDOW;
    const lines = [];
    if (s.current_streak > 0) lines.push(`${I('streak')} ${fill(alive ? t.streak : t.streakEnded, { days: bold(amount(s.current_streak, 'day', lang)), best: bold(amount(Math.max(s.best_streak || 0, s.current_streak), 'day', lang)) })}`);
    lines.push(`${I('votes')} ${fill(t.votesMonth, { votes: bold(amount(s.total_votes, 'vote', lang)), month: bold(num(s.votes_this_month, lang)) })}`);
    lines.push(`${I('coins')} ${fill(t.credits, { n: bold(amount(s.total_rewards, 'credit', lang)) })}`);
    lines.push(`${I('trophy')} ${rank >= 0 ? fill(t.rank, { n: rank + 1 }) : t.unranked}`);
    const head = `### ${t.statsTitle}\n-# ${who.name}${guildName ? ` · ${esc(guildName)}` : ''}`;
    return card(COLOR.gold, [who.avatar ? { thumbnail: [head, who.avatar] } : { text: head }, { rule: true }, { text: lines.join('\n') }]);
}

// The leaderboard as text (the image is the canvas below; this is its stand-in and the answer of the slash portal button)
async function topCard(client, db, gid, lang, where, guildName) {
    const t = L(lang), I = (k) => icon(k, where);
    const rows = topRows(db, gid);
    const medals = ['🥇', '🥈', '🥉'];
    const lines = [];
    for (let i = 0; i < rows.length; i++) {
        lines.push(`${medals[i] || `\`#${i + 1}\``} **${esc(await nameOf(client, rows[i].user_id))}** · ${amount(rows[i].total_votes, 'vote', lang)}`);
    }
    return card(COLOR.gold, [
        { text: `### ${I('trophy')} ${t.topTitle}${guildName ? `\n-# ${esc(guildName)}` : ''}` },
        { rule: true },
        { text: lines.length ? lines.join('\n') : t.topEmpty },
    ]);
}

async function lbImage(client, db, gid, guildName) {
    try {
        const rows = topRows(db, gid);
        const entries = await Promise.all(rows.map(async (row) => ({ ...row, username: await nameOf(client, row.user_id, false) })));
        const img = await buildVoteLBCanvas(entries, guildName || 'ARCHON', client.user.displayAvatarURL({ size: 128 }));
        return new AttachmentBuilder(img, { name: 'vote-leaderboard.png' });
    } catch (e) {
        console.error('[VOTE LB CANVAS]', e.message);
        return null;
    }
}

// How long until the next vote (the portal's "Time left" button)
function waitCard(client, nextVote, lang, where) {
    const t = L(lang), I = (k) => icon(k, where);
    const left = nextVote - Math.floor(Date.now() / 1000);
    if (left <= 0) return card(COLOR.ready, [{ text: `### ${t.readyNow}` }, { row: new ActionRowBuilder().addComponents(voteButton(client, t, where)) }]);
    const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
    return card(COLOR.wait, [
        { text: `### ${I('clock')} ${fill(t.waitTitle, { when: `<t:${nextVote}:R>` })}` },
        { rule: true },
        { text: `${fill(t.waitLeft, { left: h > 0 ? fill(t.hm, { h, m }) : fill(t.mOnly, { m }) })}\n${fill(t.waitAt, { full: `<t:${nextVote}:F>` })}\n-# ${t.waitLive}` },
    ]);
}

function statusCard(lang, where) {
    const t = L(lang), I = (k) => icon(k, where);
    const hasApi = !!process.env.TOPGG_API_TOKEN;
    const hasWebhook = !!(process.env.TOPGG_WEBHOOK_SECRET || process.env.TOPGG_WEBHOOK_AUTH);
    const mode = hasWebhook ? t.modeWebhook : hasApi ? t.modePoll : t.modeFallback;
    return card(hasApi ? COLOR.ready : COLOR.error, [
        { text: `### ${t.statusTitle}\n${fill(t.statusMode, { mode })}` },
        { rule: true },
        { text: `${I(hasApi ? 'ok' : 'no')} ${hasApi ? t.apiOk : t.apiMissing}\n${I(hasWebhook ? 'ok' : 'no')} ${hasWebhook ? t.hookOk : t.hookMissing}` },
    ]);
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
    run: async (client, message, args, db, ss) => {
        if (!message.guild) return message.reply(L(pl(ss)).serverOnly).catch(() => {});
        voteSync.setupDB(db);
        const lang = pl(ss);
        const t = L(lang);
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const gid = message.guild.id;
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
        const who = whoOf(message.author, message.member);

        // ---- CLAIM (delegated to engine) ----
        if (sub === 'claim') {
            const result = await voteSync.processVote(uid, gid, client);
            return message.reply(claimReply(client, result, lang, message, who)).catch(() => {});
        }

        // ---- STATS ----
        if (sub === 'stats' || sub === 'info') {
            return message.reply(statsCard(voteSync.getStats(db, uid, gid), rankOf(db, gid, uid), lang, message, who, message.guild.name)).catch(() => {});
        }

        // ---- LEADERBOARD (the image, or the same list as text when the image cannot be drawn) ----
        if (sub === 'lb' || sub === 'leaderboard' || sub === 'top') {
            const file = await lbImage(client, db, gid, message.guild.name);
            return message.reply(file ? { files: [file] } : await topCard(client, db, gid, lang, message, message.guild.name)).catch(() => {});
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
            return message.reply(toV2({ embeds: [embed] })).catch(() => {});
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
        if (sub === 'status' && isAdmin) return message.reply(statusCard(lang, message)).catch(() => {});

        // ---- PORTAL (default) ----
        const status = await getRealtimeStatus(client, uid, gid, db);
        const sent = await message.reply(portalCard(client, who, status, lang, message, message.guild.name, false)).catch(() => null);
        if (!sent) return;

        const collector = sent.createMessageComponentCollector({ time: 120000 });
        collector.on('collect', async i => {
            if (i.user.id !== uid) return i.reply({ content: t.notYours, flags: MessageFlags.Ephemeral }).catch(() => {});
            await i.deferUpdate().catch(() => {});

            if (i.customId === 'vote_check_status') {
                return i.followUp(eph(waitCard(client, nextVoteOf(db, uid, gid).nextVote, lang, i))).catch(() => {});
            }
            if (i.customId === 'vote_claim') {
                const result = await voteSync.processVote(uid, gid, client);
                await i.followUp(eph(claimReply(client, result, lang, i, who))).catch(() => {});
                if (result.success) await sent.delete().catch(() => {});
                return;
            }
            if (i.customId === 'vote_stats') {
                return i.followUp(eph(statsCard(voteSync.getStats(db, uid, gid), rankOf(db, gid, uid), lang, i, who, message.guild.name))).catch(() => {});
            }
            if (i.customId === 'vote_lb') {
                const file = await lbImage(client, db, gid, message.guild.name);
                return i.followUp(file ? { files: [file], flags: MessageFlags.Ephemeral } : eph(await topCard(client, db, gid, lang, i, message.guild.name))).catch(() => {});
            }
        });
    },

    // ================= SLASH =================
    execute: async (interaction, client) => {
        if (!interaction.guild) return interaction.reply({ content: T.en.serverOnly, flags: MessageFlags.Ephemeral });
        voteSync.setupDB(client.db);
        const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr', 'zh', 'ar']);
        const t = L(lang);
        const db = client.db;
        const uid = interaction.user.id;
        const gid = interaction.guildId;
        const sub = interaction.options.getSubcommand();
        const who = whoOf(interaction.user, interaction.member);

        // ---- CLAIM ----
        if (sub === 'claim') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const result = await voteSync.processVote(uid, gid, client);
            return interaction.editReply(claimReply(client, result, lang, interaction, who));
        }

        // ---- STATS ----
        if (sub === 'stats') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            return interaction.editReply(statsCard(voteSync.getStats(db, uid, gid), rankOf(db, gid, uid), lang, interaction, who, interaction.guild.name));
        }

        // ---- LEADERBOARD ----
        if (sub === 'leaderboard') {
            await interaction.deferReply();
            const file = await lbImage(client, db, gid, interaction.guild.name);
            return interaction.editReply(file ? { files: [file] } : await topCard(client, db, gid, lang, interaction, interaction.guild.name));
        }

        // ---- STATUS (admin) ----
        if (sub === 'status') {
            if (!interaction.member.permissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: `${icon('no', interaction)} ${t.adminOnly}`, flags: MessageFlags.Ephemeral });
            }
            return interaction.reply(eph(statusCard(lang, interaction)));
        }

        // ---- PORTAL (default) ----
        await interaction.deferReply();
        const status = await getRealtimeStatus(client, uid, gid, db);
        return interaction.editReply(portalCard(client, who, status, lang, interaction, interaction.guild.name, true)).catch(() => {});
    },

    // ================= BUTTON HANDLER (slash portal: anyone can press, each gets a private answer) =================
    async handleSlashButton(interaction, client) {
        voteSync.setupDB(client.db);
        const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr', 'zh', 'ar']);
        const db = client.db;
        const uid = interaction.user.id;
        const gid = interaction.guildId;
        const id = interaction.customId;
        const who = whoOf(interaction.user, interaction.member);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (id === 'vote_check_status_slash') return interaction.editReply(waitCard(client, nextVoteOf(db, uid, gid).nextVote, lang, interaction));
        if (id === 'vote_claim_slash') {
            const result = await voteSync.processVote(uid, gid, client);
            return interaction.editReply(claimReply(client, result, lang, interaction, who));
        }
        if (id === 'vote_stats_slash') return interaction.editReply(statsCard(voteSync.getStats(db, uid, gid), rankOf(db, gid, uid), lang, interaction, who, interaction.guild?.name));
        if (id === 'vote_lb_slash') return interaction.editReply(await topCard(client, db, gid, lang, interaction, interaction.guild?.name));
    },

    // ================= EXPORTS =================
    processVote: voteSync.processVote,
    getStats: voteSync.getStats,
    checkTopGGVote: voteSync.checkTopGGVote,
    setupDB: voteSync.setupDB,
    T,
    _cards: { portalCard, claimReply, statsCard, topCard, waitCard, statusCard, getRealtimeStatus, whoOf },
};
