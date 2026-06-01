const axios = require('axios');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * VoteSync Engine — The heart of the voting system.
 * 
 * Does ONE job well: process a vote claim from any source.
 * Called by: vote.js (buttons/slash/prefix), Top.gg webhook, or polling.
 * 
 * Handles: Top.gg API check → reward calc → DB write → DM delivery → public log
 */

// ================= BILINGUAL =================
const T = {
    en: {
        dmTitle: ['🌟 NEURAL GRID SYNCHRONIZED 🌟', '⚡ COSMIC ENERGY RECEIVED ⚡', '🦅 THE ARCHITECT SALUTES YOU 🦅'],
        dear: 'Dear Agent,', thanks: 'Your vote has been received.', support: 'Thank you for your support!',
        reward: '💰 REWARD', streak: '🔥 STREAK', best: 'BEST', lifetime: '👑 LIFETIME',
        nextVote: '⏳ NEXT VOTE', rewardFmt: '\u001b[1;33m+{n} Credits\u001b[0m',
        streakFmt: '\u001b[1;36mCurrent: {current}\nBest: {best}\u001b[0m',
        lifetimeFmt: '\u001b[1;35m{rewards} 🪙\n{votes} votes\u001b[0m',
        nextFmt: '{time} ({relative})',
        milestone7: '🏆 7-DAY MILESTONE! +2,000 BONUS!', milestone7desc: '```ansi\n\u001b[1;32m+2,000 BONUS CREDITS!\u001b[0m\n```',
        milestone30: '👑 30-DAY LEGENDARY! +5,000 BONUS!', milestone30desc: '```ansi\n\u001b[1;35m+5,000 BONUS CREDITS!\u001b[0m\n```',
        milestone100: '🌟 100-DAY MYTHIC! +10,000 BONUS!', milestone100desc: '```ansi\n\u001b[1;33m+10,000 BONUS + LEGENDARY TITLE!\u001b[0m\n```',
        footer: 'ARCHITECT CG-223 • Top.gg Certified',
        voteAgain: '⭐ Vote Again', noVote: '❌ You have not voted yet!',
        checkError: '❌ Could not check vote status. Try again later.',
        alreadyClaimed: '⏰ Already claimed! Next vote: {time}',
        publicTitle: '🗳️ VOTE RECEIVED', publicDesc: '**{user}** voted!\n💰 **Reward:** +{reward} Credits\n🔥 **Streak:** {streak} days\n📊 **Total:** {total} votes',
        publicFooter: 'ARCHITECT CG-223 • Top.gg Verified'
    },
    fr: {
        dmTitle: ['🌟 RÉSEAU NEURAL SYNCHRONISÉ 🌟', '⚡ ÉNERGIE COSMIQUE REÇUE ⚡', '🦅 L\'ARCHITECTE VOUS SALUE 🦅'],
        dear: 'Cher Agent,', thanks: 'Votre vote a été reçu.', support: 'Merci pour votre soutien!',
        reward: '💰 RÉCOMPENSE', streak: '🔥 SÉRIE', best: 'MEILLEURE', lifetime: '👑 TOTAL',
        nextVote: '⏳ PROCHAIN VOTE', rewardFmt: '\u001b[1;33m+{n} Crédits\u001b[0m',
        streakFmt: '\u001b[1;36mActuelle: {current}\nMeilleure: {best}\u001b[0m',
        lifetimeFmt: '\u001b[1;35m{rewards} 🪙\n{votes} votes\u001b[0m',
        nextFmt: '{time} ({relative})',
        milestone7: '🏆 OBJECTIF 7 JOURS! +2 000 BONUS!', milestone7desc: '```ansi\n\u001b[1;32m+2 000 CRÉDITS BONUS!\u001b[0m\n```',
        milestone30: '👑 LÉGENDAIRE 30 JOURS! +5 000 BONUS!', milestone30desc: '```ansi\n\u001b[1;35m+5 000 CRÉDITS BONUS!\u001b[0m\n```',
        milestone100: '🌟 MYTHIQUE 100 JOURS! +10 000 BONUS!', milestone100desc: '```ansi\n\u001b[1;33m+10 000 BONUS + TITRE LÉGENDAIRE!\u001b[0m\n```',
        footer: 'ARCHITECT CG-223 • Certifié Top.gg',
        voteAgain: '⭐ Voter à nouveau', noVote: '❌ Vous n\'avez pas encore voté!',
        checkError: '❌ Impossible de vérifier. Réessayez.',
        alreadyClaimed: '⏰ Déjà réclamé! Prochain vote: {time}',
        publicTitle: '🗳️ VOTE REÇU', publicDesc: '**{user}** a voté!\n💰 **Récompense:** +{reward} Crédits\n🔥 **Série:** {streak} jours\n📊 **Total:** {total} votes',
        publicFooter: 'ARCHITECT CG-223 • Top.gg Vérifié'
    }
};

// ================= DB =================
function setupDB(db) {
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 10000');
    db.pragma('synchronous = NORMAL');
    // ====================================
    
    // Migration: recreate user_votes if guild_id column is missing (old schema without per-server partitioning)
    const userVotesInfo = db.prepare(`PRAGMA table_info(user_votes)`).all();
    if (userVotesInfo.length > 0 && !userVotesInfo.find(c => c.name === 'guild_id')) {
        console.log(`[VOTESYNC] Migrating user_votes table to per-server partitioning schema...`);
        db.prepare(`ALTER TABLE user_votes RENAME TO user_votes_old`).run();
        db.prepare(`CREATE TABLE user_votes (
            user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
            total_votes INTEGER DEFAULT 0, current_streak INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0, last_vote_date INTEGER DEFAULT 0,
            total_rewards INTEGER DEFAULT 0, votes_this_month INTEGER DEFAULT 0,
            last_month_reset INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id)
        )`).run();
        // Best-effort migration: assign '0' as guild_id for legacy data
        try {
            db.prepare(`INSERT INTO user_votes (user_id, guild_id, total_votes, current_streak, best_streak, last_vote_date, total_rewards, votes_this_month, last_month_reset)
                SELECT user_id, '0', total_votes, current_streak, best_streak, last_vote_date, total_rewards, votes_this_month, last_month_reset FROM user_votes_old`).run();
            db.prepare(`DROP TABLE user_votes_old`).run();
            console.log(`[VOTESYNC] user_votes migration complete.`);
        } catch (e) {
            console.log(`[VOTESYNC] Migration data copy failed: ${e.message}`);
        }
    }

    // Migration: recreate vote_claims if guild_id column is missing
    const voteClaimsInfo = db.prepare(`PRAGMA table_info(vote_claims)`).all();
    if (voteClaimsInfo.length > 0 && !voteClaimsInfo.find(c => c.name === 'guild_id')) {
        console.log(`[VOTESYNC] Migrating vote_claims table to per-server partitioning schema...`);
        db.prepare(`ALTER TABLE vote_claims RENAME TO vote_claims_old`).run();
        db.prepare(`CREATE TABLE vote_claims (
            user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
            claim_date INTEGER, reward INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id, claim_date)
        )`).run();
        try {
            db.prepare(`INSERT INTO vote_claims (user_id, guild_id, claim_date, reward)
                SELECT user_id, '0', claim_date, reward FROM vote_claims_old`).run();
            db.prepare(`DROP TABLE vote_claims_old`).run();
            console.log(`[VOTESYNC] vote_claims migration complete.`);
        } catch (e) {
            console.log(`[VOTESYNC] vote_claims migration data copy failed: ${e.message}`);
        }
    }

    db.prepare(`CREATE TABLE IF NOT EXISTS user_votes (
        user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
        total_votes INTEGER DEFAULT 0, current_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0, last_vote_date INTEGER DEFAULT 0,
        total_rewards INTEGER DEFAULT 0, votes_this_month INTEGER DEFAULT 0,
        last_month_reset INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id)
    )`).run();
    db.prepare(`CREATE TABLE IF NOT EXISTS vote_claims (
        user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
        claim_date INTEGER, reward INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id, claim_date)
    )`).run();
}

function getStats(db, userId, guildId) {
    let s = db.prepare(`SELECT * FROM user_votes WHERE user_id = ? AND guild_id = ?`).get(userId, guildId);
    if (!s) s = { user_id: userId, guild_id: guildId, total_votes: 0, current_streak: 0, best_streak: 0, last_vote_date: 0, total_rewards: 0, votes_this_month: 0, last_month_reset: 0 };
    const now = Math.floor(Date.now() / 1000), month = new Date().getMonth();
    const lastMonth = s.last_month_reset ? new Date(s.last_month_reset * 1000).getMonth() : -1;
    if (month !== lastMonth) {
        s.votes_this_month = 0; s.last_month_reset = now;
        db.prepare(`UPDATE user_votes SET votes_this_month = 0, last_month_reset = ? WHERE user_id = ? AND guild_id = ?`).run(now, userId, guildId);
    }
    return s;
}

// ================= TOP.GG API =================
async function checkTopGGVote(userId) {
    const token = process.env.TOPGG_API_TOKEN;
    if (!token) return null;
    try {
        const res = await axios.get(`https://top.gg/api/bots/1472707869257367676/check?userId=${userId}`, {
            headers: { Authorization: token }, timeout: 5000
        });
        return res.data?.voted === 1;
    } catch (e) { return null; }
}

// ================= CALCULATE REWARD =================
function calculateReward(stats) {
    const now = Math.floor(Date.now() / 1000);
    const consecutive = (now - (stats.last_vote_date || 0)) <= 86400;
    const streak = consecutive ? stats.current_streak + 1 : 1;
    let bonus = 0, milestone = null;
    if (streak === 7) { bonus = 2000; milestone = '7'; }
    else if (streak === 30) { bonus = 5000; milestone = '30'; }
    else if (streak === 100) { bonus = 10000; milestone = '100'; }
    return { streak, bonus, total: 1000 + bonus, best: Math.max(streak, stats.best_streak), milestone };
}

// ================= UPDATE DB =================
function updateDB(db, userId, guildId, result, stats) {
    const now = Math.floor(Date.now() / 1000);
    const newTotalVotes = (stats.total_votes || 0) + 1;
    const newTotalRewards = (stats.total_rewards || 0) + result.total;
    const newVotesThisMonth = (stats.votes_this_month || 0) + 1;
    
    // Update vote tracking tables
    db.prepare(`INSERT OR REPLACE INTO user_votes (user_id, guild_id, total_votes, current_streak, best_streak, last_vote_date, total_rewards, votes_this_month, last_month_reset)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, guildId, newTotalVotes, result.streak, result.best, now, newTotalRewards, newVotesThisMonth, stats.last_month_reset || now);
    
    db.prepare(`INSERT OR IGNORE INTO vote_claims (user_id, guild_id, claim_date, reward) VALUES (?, ?, ?, ?)`).run(userId, guildId, now, result.total);
    
    // =================================================================
    // DISTRIBUTION GLOBALE DES CRÉDITS DE VOTE (WAL FIX)
    // =================================================================
    try {
        const allUserRecords = db.prepare(`SELECT guild_id, credits FROM users WHERE id = ?`).all(userId);
        
        if (allUserRecords.length > 0) {
            // Use transaction for atomic updates
            const updateMany = db.transaction((records, amount) => {
                const stmt = db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`);
                for (const record of records) {
                    const result = stmt.run(amount, userId, record.guild_id);
                    if (result.changes === 0) {
                        console.warn(`[VOTESYNC] No rows updated for ${userId}@${record.guild_id}`);
                    }
                }
            });
            
            updateMany(allUserRecords, result.total);
            
            // CRITICAL: Force WAL to flush to disk
            db.pragma('wal_checkpoint(TRUNCATE)');
            
            console.log(`[VOTESYNC] Credits added to ${allUserRecords.length} servers for ${userId}: +${result.total}`);
        } else {
            // No profile found - create new one
            const targetGuild = guildId || '0';
            db.prepare(`INSERT INTO users (id, guild_id, credits, xp, level, streak_days, last_daily, total_dailies, highest_streak) 
                VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0)`)
              .run(userId, targetGuild, result.total);
            db.pragma('wal_checkpoint(TRUNCATE)');
            console.log(`[VOTESYNC] New profile created for ${userId} with ${result.total} credits`);
        }
        
        // Verify the update actually worked
        const verify = db.prepare(`SELECT credits FROM users WHERE id = ?`).all(userId);
        const totalCredits = verify.reduce((sum, r) => sum + (r.credits || 0), 0);
        console.log(`[VOTESYNC] Verification: User ${userId} now has ${totalCredits} total credits across ${verify.length} profiles`);
        
    } catch (e) {
        console.error(`[VOTESYNC ERROR] Failed to add credits for ${userId}:`, e.message);
        // Rollback on error
        try {
            db.exec('ROLLBACK');
        } catch (rollbackErr) {
            console.error(`[VOTESYNC] Rollback failed:`, rollbackErr.message);
        }
    }
    
    return { newTotalVotes, newTotalRewards };
}

// ================= BUILD DM EMBED =================
function buildDMEmbed(client, user, result, stats, t, lang) {
    const nextTs = Math.floor(Date.now() / 1000) + 43200;
    const titles = t.dmTitle;
    const title = titles[Math.floor(Math.random() * titles.length)];

    const embed = new EmbedBuilder().setColor('#ffd700')
        .setAuthor({ name: 'ARCHITECT CG-223 • TOP.GG VERIFIED', iconURL: client.user.displayAvatarURL() })
        .setTitle(title)
        .setDescription(`\`\`\`ansi\n\u001b[1;33m${t.dear}\u001b[0m\n\n\u001b[1;37m${t.thanks}\u001b[0m\n\u001b[1;36m${t.support}\u001b[0m\n\`\`\``)
        .addFields(
            { name: t.reward, value: `\`\`\`ansi\n${t.rewardFmt.replace('{n}', result.total.toLocaleString())}\n\`\`\``, inline: false },
            { name: t.streak, value: `\`\`\`ansi\n${t.streakFmt.replace('{current}', result.streak).replace('{best}', result.best)}\n\`\`\``, inline: true },
            { name: t.lifetime, value: `\`\`\`ansi\n${t.lifetimeFmt.replace('{rewards}', ((stats.total_rewards || 0) + result.total).toLocaleString()).replace('{votes}', (stats.total_votes || 0) + 1)}\n\`\`\``, inline: true },
            { name: t.nextVote, value: `<t:${nextTs}:F> (<t:${nextTs}:R>)`, inline: false }
        )
        .setFooter({ text: t.footer, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    if (result.milestone === '7') embed.addFields({ name: '\u200b', value: t.milestone7desc, inline: false });
    if (result.milestone === '30') embed.addFields({ name: '\u200b', value: t.milestone30desc, inline: false });
    if (result.milestone === '100') embed.addFields({ name: '\u200b', value: t.milestone100desc, inline: false });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t.voteAgain).setStyle(ButtonStyle.Link).setURL(`https://top.gg/bot/${client.user.id}/vote`).setEmoji('⭐')
    );

    return { embed, components: [row], nextVote: nextTs };
}

// ================= SEND PUBLIC LOG =================
async function sendPublicLog(client, user, result, stats) {
    const logId = process.env.LOG_CHANNEL_ID;
    if (!logId) return;
    try {
        const ch = await client.channels.fetch(logId).catch(() => null);
        if (!ch) return;
        const t = T.en;
        const embed = new EmbedBuilder().setColor('#ffd700')
            .setAuthor({ name: t.publicTitle, iconURL: user.displayAvatarURL() })
            .setDescription(t.publicDesc.replace('{user}', user.username).replace('{reward}', result.total.toLocaleString()).replace('{streak}', result.streak).replace('{total}', (stats.total_votes || 0) + 1))
            .setFooter({ text: t.publicFooter }).setTimestamp();
        await ch.send({ embeds: [embed] }).catch(() => {});
    } catch (e) {}
}

// ================= PROCESS VOTE (Main Entry Point) =================
async function processVote(userId, guildId, client) {
    const db = client.db;
    if (!db) return { success: false, error: 'NO_DB' };
    setupDB(db);

    // 1. Check Top.gg
    const voted = await checkTopGGVote(userId);
    if (voted === false) return { success: false, error: 'NOT_VOTED' };
    if (voted === null) return { success: false, error: 'CHECK_FAILED' };

    // 2. Check cooldown
    const stats = getStats(db, userId, guildId);
    const now = Math.floor(Date.now() / 1000);
    const cooldown = (stats.last_vote_date || 0) + 43200;
    if (now < cooldown) return { success: false, error: 'COOLDOWN', nextVote: cooldown };

    // 3. Calculate reward
    const result = calculateReward(stats);

    // 4. Update DB
    const { newTotalVotes, newTotalRewards } = updateDB(db, userId, guildId, result, stats);

    // 5. Fetch user
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return { success: false, error: 'USER_NOT_FOUND' };

    // 6. Detect language
    let lang = 'en';
    try {
        const g = client.guilds.cache.find(g => g.members.cache.has(userId));
        if (g?.preferredLocale?.startsWith('fr')) lang = 'fr';
    } catch {}
    const t = T[lang] || T.en;

    // 7. Send DM
    let dmSent = false;
    const { embed, components, nextVote } = buildDMEmbed(client, user, result, stats, t, lang);
    await user.send({ embeds: [embed], components }).then(() => { dmSent = true; }).catch(err => {
        console.log(`[VOTESYNC] DM failed for ${userId}: ${err.message}`);
    });

    // 8. Public log
    await sendPublicLog(client, user, result, stats);

    console.log(`[VOTESYNC] ✅ ${user.username} | +${result.total} | Streak: ${result.streak} | DM: ${dmSent ? 'sent' : 'failed'}`);
    return { success: true, ...result, nextVote, lang, dmSent, total_votes: newTotalVotes, total_rewards: newTotalRewards };
}

// ================= MODULE =================
module.exports = {
    name: 'votesync',
    description: 'Internal vote processing engine — called by vote.js',
    category: 'SYSTEM',
    hidden: true,
    processVote,
    checkTopGGVote,
    setupDB,
    getStats,
    calculateReward,
    T
};