const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

// ================= ENGINE IMPORT =================
const voteSync = require('./votesync.js');

// ================= BILINGUAL =================
const T = {
    en: {
        title: '\u2b50 VOTE PORTAL', voteBtn: '\u2b50 VOTE ON TOP.GG', claimBtn: '\ud83d\udcb0 CLAIM REWARD',
        checkBtn: '\ud83d\udcca MY STATS', lbBtn: '\ud83c\udfc6 LEADERBOARD', footer: 'Architect CG-223',
        noVote: '\u274c You haven\'t voted yet!', voteFirst: 'Vote on [Top.gg]({link}), then click **Claim Reward**.',
        claimed: '\u2705 REWARD CLAIMED!', gotReward: '**+{reward}** credits | Streak: **{streak}** \ud83d\udd25',
        milestone7: '\ud83c\udfc6 7-Day Milestone! +2,000 bonus!', milestone30: '\ud83d\udc51 30-Day Legend! +5,000 bonus!',
        milestone100: '\ud83c\udf1f 100-Day Mythic! +10,000 bonus!', ready: '\u2705 Ready to vote!',
        nextIn: 'Next vote: {time}', streak: '\ud83d\udd25 Streak: **{days}** days', best: '\ud83c\udfc5 Best: **{days}**',
        total: '\ud83d\udcca Total: **{n}** votes', rewards: '\ud83d\udcb0 Earned: **{n}** credits',
        lbTitle: '\ud83c\udfc6 VOTING LEGENDS', rankEmoji: ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49', '\ud83d\udccc', '\ud83d\udccc', '\ud83d\udccc', '\ud83d\udccc', '\ud83d\udccc', '\ud83d\udccc', '\ud83d\udccc'],
        checkError: '\u274c Could not check vote status. Try again later.',
        adminTest: '\u2705 Admin test vote processed for {user}.',
        statusTitle: '\ud83d\udce3 VOTE SYSTEM STATUS', statusOnline: '\u2705 Online', statusOffline: '\u274c Offline',
        statusMode: '**Mode:** {mode}', statusWebhook: '**Webhook:** {status}', statusApi: '**Top.gg API:** {status}',
        modeWebhook: 'Webhook (instant)', modePoll: 'API Check (on claim)', modeFallback: 'Manual only',
        alreadyClaimed: '\u23f0 Already claimed! Next vote: {time}',
        progress: '\ud83d\udcc8 Progress to {milestone}-Day', progressBar: '**{bar}** {percent}% ({current}/{target})',
        nextReward: '\ud83d\udca1 Next reward: **{n}** credits at {milestone} days',
        voteLink: 'https://top.gg/bot/{botId}/vote',
        dmSuccess: '\ud83d\udce9 Check your DMs for a detailed reward breakdown!',
        cooldownTitle: '⏰ COOLDOWN REPORT',
        cooldownExact: 'Exact Remaining Time',
        cooldownLive: '*This countdown updates automatically in your Discord client.*',
        firstVoteBtn: '🌟 CAST FIRST VOTE',
        checkCooldownBtn: '⏰ CHECK COOLDOWN'
    },
    fr: {
        title: '\u2b50 PORTAIL DE VOTE', voteBtn: '\u2b50 VOTER SUR TOP.GG', claimBtn: '\ud83d\udcb0 R\u00c9CLAMER',
        checkBtn: '\ud83d\udcca MES STATS', lbBtn: '\ud83c\udfc6 CLASSEMENT', footer: 'Architect CG-223',
        noVote: '\u274c Vous n\'avez pas encore vot\u00e9 !', voteFirst: 'Votez sur [Top.gg]({link}), puis cliquez **R\u00e9clamer**.',
        claimed: '\u2705 R\u00c9COMPENSE R\u00c9CLAM\u00c9E !', gotReward: '**+{reward}** cr\u00e9dits | S\u00e9rie: **{streak}** \ud83d\udd25',
        milestone7: '\ud83c\udfc6 Objectif 7 jours ! +2 000 bonus !', milestone30: '\ud83d\udc51 L\u00e9gende 30 jours ! +5 000 bonus !',
        milestone100: '\ud83c\udf1f Mythique 100 jours ! +10 000 bonus !', ready: '\u2705 Pr\u00eat \u00e0 voter !',
        nextIn: 'Prochain vote: {time}', streak: '\ud83d\udd25 S\u00e9rie: **{days}** jours', best: '\ud83c\udfc5 Meilleure: **{days}**',
        total: '\ud83d\udcca Total: **{n}** votes', rewards: '\ud83d\udcb0 Gagn\u00e9s: **{n}** cr\u00e9dits',
        lbTitle: '\ud83c\udfc6 L\u00c9GENDES DU VOTE', rankEmoji: ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49', '\ud83d\udccc', '\ud83d\udccc', '\ud83d\udccc', '\ud83d\udccc', '\ud83d\udccc', '\ud83d\udccc', '\ud83d\udccc'],
        checkError: '\u274c Impossible de v\u00e9rifier le vote. R\u00e9essayez.',
        adminTest: '\u2705 Vote test admin pour {user}.',
        statusTitle: '\ud83d\udce3 \u00c9TAT DU SYST\u00c8ME DE VOTE', statusOnline: '\u2705 En ligne', statusOffline: '\u274c Hors ligne',
        statusMode: '**Mode:** {mode}', statusWebhook: '**Webhook:** {status}', statusApi: '**API Top.gg:** {status}',
        modeWebhook: 'Webhook (instantan\u00e9)', modePoll: 'V\u00e9rification API (au claim)', modeFallback: 'Manuel uniquement',
        alreadyClaimed: '\u23f0 D\u00e9j\u00e0 r\u00e9clam\u00e9 ! Prochain vote: {time}',
        progress: '\ud83d\udcc8 Progression vers {milestone} jours', progressBar: '**{bar}** {percent}% ({current}/{target})',
        nextReward: '\ud83d\udca1 Prochaine r\u00e9compense: **{n}** cr\u00e9dits \u00e0 {milestone} jours',
        voteLink: 'https://top.gg/bot/{botId}/vote',
        dmSuccess: '\ud83d\udce9 V\u00e9rifiez vos MPs pour un d\u00e9tail des r\u00e9compenses !',
        cooldownTitle: '⏰ RAPPORT DE COOLDOWN',
        cooldownExact: 'Temps restant exact',
        cooldownLive: '*Ce compte à rebours se met à jour automatiquement dans Discord.*',
        firstVoteBtn: '🌟 PREMIER VOTE',
        checkCooldownBtn: '⏰ VÉRIFIER COOLDOWN'
    }
};

// ================= PROGRESS BAR =================
function progressBar(current, target) {
    const pct = Math.min(100, Math.round((current / target) * 100));
    const filled = Math.round((pct / 100) * 10);
    return { bar: '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled), percent: pct };
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
    } catch (e) {
        // Fallback to DB logic
    }

    const onCooldown = apiVerified ? apiVoted : !canVote;
    const readyToVote = apiVerified ? !apiVoted : canVote;

    return {
        stats,
        canVote: readyToVote,
        onCooldown,
        isFirstTime,
        nextVote,
        timeSince,
        lastVote,
        apiVerified,
        apiVoted
    };
}

// ================= GREETING ENGINE =================
function getGreeting(user) {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return `🌅 Good Morning, **${user.username}**`;
    if (hour >= 12 && hour < 17) return `☀️ Good Afternoon, **${user.username}**`;
    if (hour >= 17 && hour < 21) return `🌆 Good Evening, **${user.username}**`;
    return `🌙 Good Night, **${user.username}**`;
}

function getGreetingFR(user) {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return `🌅 Bonjour, **${user.username}**`;
    if (hour >= 12 && hour < 17) return `☀️ Bon après-midi, **${user.username}**`;
    if (hour >= 17 && hour < 21) return `🌆 Bonsoir, **${user.username}**`;
    return `🌙 Bonne nuit, **${user.username}**`;
}

// ================= BUILD PORTAL EMBED (POLICE/DOSSIER STYLE) =================
function buildPortalEmbed(client, user, status, t, lang, guild) {
    const link = t.voteLink.replace('{botId}', client.user.id);
    const greeting = lang === 'fr' ? getGreetingFR(user) : getGreeting(user);

    let color, badge, subtitle, body;
    if (status.isFirstTime) {
        color = '#e74c3c';
        badge = '🔴 AWAITING FIRST VOTE';
        subtitle = lang === 'fr' ? '🌟 **BIENVENUE AU PORTAIL DE VOTE**' : '🌟 **WELCOME TO THE VOTE PORTAL**';
        body = lang === 'fr'
            ? `Votre soutien alimente l'écosystème **ARCHITECT CG-223**.\nLancez votre premier vote pour activer votre dossier opérationnel et commencer à gagner des crédits.`
            : `Your support powers the **ARCHITECT CG-223** ecosystem.\nCast your first vote to activate your operative record and begin earning credits.`;
    } else if (status.canVote) {
        color = '#2ecc71';
        badge = lang === 'fr' ? '🟢 AUTORISÉ — ACCÈS PERMI' : '🟢 VOTE AUTHORIZED — CLEARANCE GRANTED';
        const streakMsg = status.stats.current_streak > 0
            ? (lang === 'fr' ? `Série actuelle: **${status.stats.current_streak} jours** 🔥` : `Current streak: **${status.stats.current_streak} days** 🔥`)
            : (lang === 'fr' ? 'Aucune série active' : 'No active streak');
        subtitle = lang === 'fr' ? '✅ **VOUS ÊTES ÉLIGIBLE**' : '✅ **YOU ARE ELIGIBLE TO VOTE**';
        body = lang === 'fr'
            ? `${streakMsg}\nMaintenez votre série pour débloquer des bonus de jalons. Chaque vote renforce le réseau.`
            : `${streakMsg}\nMaintain your streak to unlock milestone bonuses. Every vote strengthens the network.`;
    } else {
        color = '#f39c12';
        badge = lang === 'fr' ? '🟡 COOLDOWN ACTIF — ATTENTE' : '🟡 COOLDOWN ACTIVE — STAND BY';
        subtitle = lang === 'fr' ? '⏰ **PATIENCE, OPÉRATIF**' : '⏰ **PATIENCE, OPERATIVE**';
        body = lang === 'fr'
            ? `Vous avez déjà voté aujourd'hui. Votre dossier est à jour.\nLa prochaine fenêtre d'autorisation s'ouvre ci-dessous.`
            : `You have already supported us today. Your operative record is updated.\nNext authorization window opens below.`;
    }

    const { bar, percent } = progressBar(status.stats.current_streak, status.stats.current_streak < 7 ? 7 : status.stats.current_streak < 30 ? 30 : 100);

    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: lang === 'fr' ? `OPÉRATIF: ${user.username}` : `OPERATIVE: ${user.username}`, iconURL: user.displayAvatarURL() })
        .setTitle(greeting)
        .setDescription(
            `**${subtitle}**\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${body}\n\n` +
            `**${badge}**`
        );

    const recordValue =
        `🔥 ${t.streak.replace('{days}', status.stats.current_streak)}\n` +
        `🏆 ${t.best.replace('{days}', status.stats.best_streak)}\n` +
        `🗳️ ${t.total.replace('{n}', status.stats.total_votes)}\n` +
        `💰 ${t.rewards.replace('{n}', status.stats.total_rewards.toLocaleString())}`;

    embed.addFields(
        { name: lang === 'fr' ? '📋 DOSSIER OPÉRATIONNEL' : '📋 OPERATIVE RECORD', value: recordValue, inline: false },
        { name: lang === 'fr' ? '📊 SUIVI DE JALON' : '📊 MILESTONE TRACKER', value:
            t.progress.replace('{milestone}', status.stats.current_streak < 7 ? '7' : status.stats.current_streak < 30 ? '30' : '100') + '\n' +
            t.progressBar.replace('{bar}', bar).replace('{percent}', percent).replace('{current}', status.stats.current_streak).replace('{target}', status.stats.current_streak < 7 ? '7' : status.stats.current_streak < 30 ? '30' : '100'),
            inline: false }
    );

    if (status.onCooldown && !status.isFirstTime) {
        embed.addFields({
            name: lang === 'fr' ? '⏰ PROCHAINE AUTORISATION' : '⏰ NEXT AUTHORIZATION',
            value: `<t:${status.nextVote}:R>\n*(<<t:${status.nextVote}:f>)*`,
            inline: false
        });
    }

    // Dynamic briefing based on streak
    if (status.stats.current_streak > 0 && status.stats.current_streak < 7) {
        embed.addFields({
            name: lang === 'fr' ? '💡 BRIEFING OPÉRATIONNEL' : '💡 OPERATIVE BRIEFING',
            value: lang === 'fr'
                ? `Maintenez votre série! Atteignez **7 jours** pour un bonus de **+2 000**.`
                : `Keep your streak alive! Reach **7 days** for a **+2,000** bonus.`,
            inline: false
        });
    } else if (status.stats.current_streak >= 7 && status.stats.current_streak < 30) {
        embed.addFields({
            name: lang === 'fr' ? '💡 BRIEFING OPÉRATIONNEL' : '💡 OPERATIVE BRIEFING',
            value: lang === 'fr'
                ? `Jalon de 7 jours atteint! Poussez vers **30 jours** pour **+5 000**.`
                : `7-day milestone achieved! Push to **30 days** for **+5,000**.`,
            inline: false
        });
    } else if (status.stats.current_streak >= 30) {
        embed.addFields({
            name: lang === 'fr' ? '💡 BRIEFING OPÉRATIONNEL' : '💡 OPERATIVE BRIEFING',
            value: lang === 'fr'
                ? `Statut légendaire! Le **Mythique 100 jours** attend avec **+10 000**.`
                : `Legendary status! **100-day Mythic** awaits with **+10,000**.`,
            inline: false
        });
    }

    embed.setFooter({
        text: `${guild?.name || 'ARCHITECT CG-223'} • ${t.footer}`,
        iconURL: guild?.iconURL() || client.user.displayAvatarURL()
    }).setTimestamp();

    return embed;
}

// ================= BUILD DYNAMIC BUTTON ROW =================
function buildPortalRow(client, status, t, isSlash = false) {
    const link = t.voteLink.replace('{botId}', client.user.id);
    const row = new ActionRowBuilder();
    const suffix = isSlash ? '_slash' : '';

    if (status.canVote) {
        row.addComponents(
            new ButtonBuilder()
                .setLabel(t.voteBtn)
                .setStyle(ButtonStyle.Link)
                .setURL(link)
                .setEmoji('⭐')
        );
    } else if (status.isFirstTime) {
        row.addComponents(
            new ButtonBuilder()
                .setLabel(t.firstVoteBtn)
                .setStyle(ButtonStyle.Link)
                .setURL(link)
                .setEmoji('🌟')
        );
    } else {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`vote_check_status${suffix}`)
                .setLabel(t.checkCooldownBtn)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏰')
        );
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
    if (result.milestone === '7') embed.addFields({ name: '\u200b', value: t.milestone7 });
    if (result.milestone === '30') embed.addFields({ name: '\u200b', value: t.milestone30 });
    if (result.milestone === '100') embed.addFields({ name: '\u200b', value: t.milestone100 });
    embed.addFields({ name: '\u200b', value: t.nextIn.replace('{time}', `<t:${nextTimestamp}:R>`) });
    return embed;
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'vote',
    aliases: ['voter', 'upvote', 'topgg'],
    description: '\u2b50 Vote on Top.gg and claim legendary rewards with streaks and milestones.',
    category: 'ECONOMY',
    usage: '.vote | .vote claim | .vote stats | .vote lb | .vote test @user | .vote status',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('vote').setDescription('\u2b50 Vote on Top.gg and claim rewards')
        .addSubcommand(s => s.setName('claim').setDescription('Claim your vote reward after voting on Top.gg'))
        .addSubcommand(s => s.setName('stats').setDescription('View your voting stats'))
        .addSubcommand(s => s.setName('leaderboard').setDescription('View top voters'))
        .addSubcommand(s => s.setName('portal').setDescription('Open the vote portal'))
        .addSubcommand(s => s.setName('status').setDescription('View vote system status (admin)')),

    // ================= PREFIX =================
    run: async (client, message, args, db, ss, used) => {
        if (!message.guild) return message.reply('Server only.').catch(() => {});
        voteSync.setupDB(db);
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang] || T.en;
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const gid = message.guild.id;
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);

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
                if (result.error === 'COOLDOWN') return message.reply({ embeds: [new EmbedBuilder().setColor('#e67e22').setTitle('\u23f0 Cooldown').setDescription(t.alreadyClaimed.replace('{time}', `<t:${result.nextVote}:R>`))] }).catch(() => {});
                return message.reply({ content: '\u274c Vote processing failed. Try again later.', allowedMentions: { parse: [] } }).catch(() => {});
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
                .setTitle(`\ud83d\udcca ${t.title}`)
                .addFields(
                    { name: t.streak.replace('{days}', stats.current_streak), value: t.best.replace('{days}', stats.best_streak), inline: true },
                    { name: t.total.replace('{n}', stats.total_votes), value: t.rewards.replace('{n}', stats.total_rewards.toLocaleString()), inline: true },
                    { name: '\ud83d\udcca Rank', value: rank >= 0 ? `#${rank + 1}` : 'Unranked', inline: true }
                ).setFooter({ text: t.footer }).setTimestamp();
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // ---- LEADERBOARD ----
        if (sub === 'lb' || sub === 'leaderboard' || sub === 'top') {
            const lb = db.prepare(`SELECT user_id, total_votes, current_streak, best_streak, total_rewards FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC LIMIT 10`).all(gid);
            let desc = '```yaml\n';
            for (let i = 0; i < lb.length; i++) {
                let name; try { name = (await client.users.fetch(lb[i].user_id)).username; } catch { name = 'Unknown'; }
                desc += `${t.rankEmoji[i] || '\ud83d\udccc'} ${name.padEnd(18)} ${lb[i].total_votes} votes\n`;
            }
            desc += '```';
            const embed = new EmbedBuilder().setColor('#ffd700').setTitle(t.lbTitle).setDescription(desc)
                .setFooter({ text: t.footer }).setTimestamp();
            return message.reply({ embeds: [embed] }).catch(() => {});
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
            const hasWebhook = !!process.env.TOPGG_WEBHOOK_AUTH;
            const mode = hasWebhook ? t.modeWebhook : hasApi ? t.modePoll : t.modeFallback;
            const embed = new EmbedBuilder().setColor(hasApi ? '#2ecc71' : '#e74c3c').setTitle(t.statusTitle)
                .addFields(
                    { name: t.statusMode.replace('{mode}', ''), value: mode, inline: false },
                    { name: t.statusApi.replace('{status}', ''), value: hasApi ? '\u2705 Configured' : '\u274c Missing TOPGG_API_TOKEN', inline: true },
                    { name: t.statusWebhook.replace('{status}', ''), value: hasWebhook ? '\u2705 Configured' : '\u274c Not configured', inline: true }
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
            if (i.user.id !== uid) return i.reply({ content: '\u274c Not yours.', flags: MessageFlags.Ephemeral }).catch(() => {});
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
                        `**${lang === 'fr' ? 'Opératif' : 'Operative'} ${i.user.username},**\n\n` +
                        `${lang === 'fr' ? 'Votre autorisation de vote est en cooldown.' : 'Your voting authorization is on cooldown.'}\n\n` +
                        `**${t.cooldownExact}:**\n` +
                        `\`\`\`yaml\n${h}h ${m}m ${s}s\n\`\`\`\n` +
                        `${lang === 'fr' ? 'Vous pourrez voter de nouveau' : 'You can vote again'} <t:${nextVote}:R>.\n` +
                        `**${lang === 'fr' ? 'Autorisation complète' : 'Full Authorization'}:** <t:${nextVote}:F>\n\n` +
                        t.cooldownLive
                    )
                    .setFooter({ text: 'ARCHITECT CG-223 • Vote Command' });

                i.followUp({ embeds: [ce], flags: MessageFlags.Ephemeral }).catch(() => {});
                return;
            }

            if (i.customId === 'vote_claim') {
                const result = await voteSync.processVote(uid, gid, client);
                if (!result.success) {
                    if (result.error === 'NOT_VOTED') return i.followUp({ content: t.noVote + ' ' + t.voteFirst.replace('{link}', t.voteLink.replace('{botId}', client.user.id)), flags: MessageFlags.Ephemeral }).catch(() => {});
                    if (result.error === 'CHECK_FAILED') return i.followUp({ content: t.checkError, flags: MessageFlags.Ephemeral }).catch(() => {});
                    if (result.error === 'COOLDOWN') return i.followUp({ embeds: [new EmbedBuilder().setColor('#e67e22').setDescription(t.alreadyClaimed.replace('{time}', `<t:${result.nextVote}:R>`))], flags: MessageFlags.Ephemeral }).catch(() => {});
                    return i.followUp({ content: '\u274c Processing failed. Try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
                }
                const ce = buildClaimEmbed(t, result, result.nextVote);
                i.followUp({ embeds: [ce], flags: MessageFlags.Ephemeral }).catch(() => {});
                await sent.delete().catch(() => {});
            } else if (i.customId === 'vote_stats') {
                const s = voteSync.getStats(db, uid, gid);
                const all = db.prepare(`SELECT user_id FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC`).all(gid);
                const r = all.findIndex(u => u.user_id === uid);
                const se = new EmbedBuilder().setColor('#ffd700').setTitle(`\ud83d\udcca ${t.title}`)
                    .addFields(
                        { name: t.streak.replace('{days}', s.current_streak), value: t.best.replace('{days}', s.best_streak), inline: true },
                        { name: t.total.replace('{n}', s.total_votes), value: t.rewards.replace('{n}', s.total_rewards.toLocaleString()), inline: true },
                        { name: '\ud83d\udcca Rank', value: r >= 0 ? `#${r + 1}` : 'Unranked', inline: true }
                    ).setFooter({ text: t.footer }).setTimestamp();
                i.followUp({ embeds: [se], flags: MessageFlags.Ephemeral }).catch(() => {});
            } else if (i.customId === 'vote_lb') {
                const lb = db.prepare(`SELECT user_id, total_votes, current_streak, best_streak, total_rewards FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC LIMIT 10`).all(gid);
                let desc = '```yaml\n';
                for (let j = 0; j < lb.length; j++) { let n; try { n = (await client.users.fetch(lb[j].user_id)).username; } catch { n = 'Unknown'; } desc += `${t.rankEmoji[j] || '\ud83d\udccc'} ${n.padEnd(18)} ${lb[j].total_votes} votes\n`; }
                desc += '```';
                const le = new EmbedBuilder().setColor('#ffd700').setTitle(t.lbTitle).setDescription(desc).setFooter({ text: t.footer }).setTimestamp();
                i.followUp({ embeds: [le], flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        });
    },

    // ================= SLASH =================
    execute: async (interaction, client) => {
        if (!interaction.guild) return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        voteSync.setupDB(client.db);
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
        const uid = interaction.user.id;
        const gid = interaction.guildId;
        const sub = interaction.options.getSubcommand();

        // ---- CLAIM (delegated to engine) ----
        if (sub === 'claim') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const result = await voteSync.processVote(uid, gid, client);
            if (!result.success) {
                if (result.error === 'NOT_VOTED') return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setTitle(t.noVote).setDescription(t.voteFirst.replace('{link}', t.voteLink.replace('{botId}', client.user.id)))] });
                if (result.error === 'CHECK_FAILED') return interaction.editReply({ content: t.checkError });
                if (result.error === 'COOLDOWN') return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e67e22').setDescription(t.alreadyClaimed.replace('{time}', `<t:${result.nextVote}:R>`))] });
                return interaction.editReply({ content: '\u274c Processing failed. Try again later.' });
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
            const embed = new EmbedBuilder().setColor('#ffd700').setTitle(`\ud83d\udcca ${t.title}`)
                .addFields(
                    { name: t.streak.replace('{days}', stats.current_streak), value: t.best.replace('{days}', stats.best_streak), inline: true },
                    { name: t.total.replace('{n}', stats.total_votes), value: t.rewards.replace('{n}', stats.total_rewards.toLocaleString()), inline: true },
                    { name: '\ud83d\udcca Rank', value: rank >= 0 ? `#${rank + 1}` : 'Unranked', inline: true }
                ).setFooter({ text: t.footer }).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // ---- LEADERBOARD ----
        if (sub === 'leaderboard') {
            await interaction.deferReply();
            const lb = client.db.prepare(`SELECT user_id, total_votes, current_streak, best_streak, total_rewards FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC LIMIT 10`).all(gid);
            let desc = '```yaml\n';
            for (let i = 0; i < lb.length; i++) { let n; try { n = (await client.users.fetch(lb[i].user_id)).username; } catch { n = 'Unknown'; } desc += `${t.rankEmoji[i] || '\ud83d\udccc'} ${n.padEnd(18)} ${lb[i].total_votes} votes\n`; }
            desc += '```';
            const embed = new EmbedBuilder().setColor('#ffd700').setTitle(t.lbTitle).setDescription(desc).setFooter({ text: t.footer }).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // ---- STATUS (admin) ----
        if (sub === 'status') {
            if (!interaction.member.permissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '\u274c Admin only.', flags: MessageFlags.Ephemeral });
            }
            const hasApi = !!process.env.TOPGG_API_TOKEN;
            const hasWebhook = !!process.env.TOPGG_WEBHOOK_AUTH;
            const mode = hasWebhook ? t.modeWebhook : hasApi ? t.modePoll : t.modeFallback;
            const embed = new EmbedBuilder().setColor(hasApi ? '#2ecc71' : '#e74c3c').setTitle(t.statusTitle)
                .addFields(
                    { name: t.statusMode.replace('{mode}', ''), value: mode, inline: false },
                    { name: t.statusApi.replace('{status}', ''), value: hasApi ? '\u2705 Configured' : '\u274c Missing TOPGG_API_TOKEN', inline: true },
                    { name: t.statusWebhook.replace('{status}', ''), value: hasWebhook ? '\u2705 Configured' : '\u274c Not configured', inline: true }
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

    // ================= BUTTON HANDLER (for slash portal buttons) =================
    async handleSlashButton(interaction, client) {
        voteSync.setupDB(client.db);
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
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
                    `**${lang === 'fr' ? 'Opératif' : 'Operative'} ${interaction.user.username},**\n\n` +
                    `${lang === 'fr' ? 'Votre autorisation de vote est en cooldown.' : 'Your voting authorization is on cooldown.'}\n\n` +
                    `**${t.cooldownExact}:**\n` +
                    `\`\`\`yaml\n${h}h ${m}m ${s}s\n\`\`\`\n` +
                    `${lang === 'fr' ? 'Vous pourrez voter de nouveau' : 'You can vote again'} <t:${nextVote}:R>.\n` +
                    `**${lang === 'fr' ? 'Autorisation complète' : 'Full Authorization'}:** <t:${nextVote}:F>\n\n` +
                    t.cooldownLive
                )
                .setFooter({ text: 'ARCHITECT CG-223 • Vote Command' });

            return interaction.editReply({ embeds: [ce] });
        }

        // ---- CLAIM (delegated to engine) ----
        if (id === 'vote_claim_slash') {
            const result = await voteSync.processVote(uid, gid, client);
            if (!result.success) {
                if (result.error === 'NOT_VOTED') return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setTitle(t.noVote).setDescription(t.voteFirst.replace('{link}', t.voteLink.replace('{botId}', client.user.id)))] });
                if (result.error === 'CHECK_FAILED') return interaction.editReply({ content: t.checkError });
                if (result.error === 'COOLDOWN') return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e67e22').setDescription(t.alreadyClaimed.replace('{time}', `<t:${result.nextVote}:R>`))] });
                return interaction.editReply({ content: '\u274c Processing failed. Try again later.' });
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
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ffd700').setTitle(`\ud83d\udcca ${t.title}`).addFields(
                { name: t.streak.replace('{days}', stats.current_streak), value: t.best.replace('{days}', stats.best_streak), inline: true },
                { name: t.total.replace('{n}', stats.total_votes), value: t.rewards.replace('{n}', stats.total_rewards.toLocaleString()), inline: true },
                { name: '\ud83d\udcca Rank', value: rank >= 0 ? `#${rank + 1}` : 'Unranked', inline: true }
            ).setFooter({ text: t.footer }).setTimestamp()] });
        }

        // ---- LEADERBOARD ----
        if (id === 'vote_lb_slash') {
            const lb = client.db.prepare(`SELECT user_id, total_votes, current_streak, best_streak, total_rewards FROM user_votes WHERE guild_id = ? ORDER BY total_votes DESC LIMIT 10`).all(gid);
            let desc = '```yaml\n';
            for (let i = 0; i < lb.length; i++) { let n; try { n = (await client.users.fetch(lb[i].user_id)).username; } catch { n = 'Unknown'; } desc += `${t.rankEmoji[i] || '\ud83d\udccc'} ${n.padEnd(18)} ${lb[i].total_votes} votes\n`; }
            desc += '```';
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ffd700').setTitle(t.lbTitle).setDescription(desc).setFooter({ text: t.footer }).setTimestamp()] });
        }
    },

    // ================= EXPORTS FOR EXTERNAL USE =================
    processVote: voteSync.processVote,
    getStats: voteSync.getStats,
    checkTopGGVote: voteSync.checkTopGGVote,
    setupDB: voteSync.setupDB,
    T
};
