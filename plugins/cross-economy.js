const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

// ================= BILINGUAL =================
const T = {
    en: {
        title: '🌐 Global Economy',
        yourBalance: '💰 Your Balance',
        server: 'This Server',
        global: 'Global Network',
        total: 'Total',
        dailyClaimed: '✅ Daily Claimed!',
        dailyCooldown: '⏰ Already claimed! Next:',
        streak: 'Streak',
        transferSent: '✅ Transfer Sent',
        transferReceived: '✅ Transfer Received',
        transferError: '❌ Transfer Failed',
        leaderboard: '🏆 Global Leaderboard',
        network: '🌐 ARCHITECT Network',
        servers: 'Servers',
        users: 'Users',
        totalEconomy: 'Total Economy',
        richestUser: 'Richest Member',
        avgLevel: 'Avg Level',
        itemBought: '✅ Purchased',
        inventory: '🎒 Global Inventory',
        emptyInventory: '📭 Empty',
        shop: '🏪 Global Shop',
        footer: 'ARCHITECT CG-223 • Cross-Server Economy',
        noFunds: '❌ Insufficient credits',
        invalidAmount: '❌ Invalid amount',
        selfTransfer: '❌ Cannot send to yourself',
        tax: 'Network Tax (5%)',
        networkBonus: '🌐 Network Bonus',
        levelSync: '✅ Level synced to global network',
        firstTimeWelcome: '🎉 Welcome to the Global Economy! You\'ve been awarded **500** starter credits.'
    },
    fr: {
        title: '🌐 Économie Globale',
        yourBalance: '💰 Ton Solde',
        server: 'Ce Serveur',
        global: 'Réseau Global',
        total: 'Total',
        dailyClaimed: '✅ Quotidien Réclamé !',
        dailyCooldown: '⏰ Déjà réclamé ! Prochain :',
        streak: 'Série',
        transferSent: '✅ Transfert Envoyé',
        transferReceived: '✅ Transfert Reçu',
        transferError: '❌ Transfert Échoué',
        leaderboard: '🏆 Classement Global',
        network: '🌐 Réseau ARCHITECT',
        servers: 'Serveurs',
        users: 'Utilisateurs',
        totalEconomy: 'Économie Totale',
        richestUser: 'Membre le Plus Riche',
        avgLevel: 'Niveau Moyen',
        itemBought: '✅ Acheté',
        inventory: '🎒 Inventaire Global',
        emptyInventory: '📭 Vide',
        shop: '🏪 Boutique Globale',
        footer: 'ARCHITECT CG-223 • Économie Inter-Serveurs',
        noFunds: '❌ Crédits insuffisants',
        invalidAmount: '❌ Montant invalide',
        selfTransfer: '❌ Impossible de s\'envoyer à soi-même',
        tax: 'Taxe Réseau (5%)',
        networkBonus: '🌐 Bonus Réseau',
        levelSync: '✅ Niveau synchronisé au réseau global',
        firstTimeWelcome: '🎉 Bienvenue dans l\'Économie Globale ! Tu as reçu **500** crédits de départ.'
    }
};

// ================= DAILY REWARDS =================
function calculateDailyReward(streak) {
    let base = 250;
    if (streak >= 100) base = 1000;
    else if (streak >= 30) base = 700;
    else if (streak >= 7) base = 500;

    const bonusPercent = Math.min(Math.floor(streak / 7) * 5, 50); // +5% per week, max 50%
    const total = Math.floor(base * (1 + bonusPercent / 100));
    const bonus = total - base;
    return { base, bonus, total, streak };
}

// ================= DB SETUP =================
function setupDB(db) {
    db.prepare(`CREATE TABLE IF NOT EXISTS global_credits (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        total_credits INTEGER DEFAULT 0,
        earned_all_time INTEGER DEFAULT 0,
        spent_all_time INTEGER DEFAULT 0,
        last_daily INTEGER DEFAULT 0,
        daily_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT 0
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS global_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user TEXT,
        to_user TEXT,
        amount INTEGER,
        type TEXT,
        guild_id TEXT,
        guild_name TEXT,
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS global_inventory (
        user_id TEXT,
        item_key TEXT,
        item_name TEXT,
        quantity INTEGER DEFAULT 1,
        purchased_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (user_id, item_key)
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS global_leaderboard (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        total_xp INTEGER DEFAULT 0,
        highest_level INTEGER DEFAULT 0,
        total_credits INTEGER DEFAULT 0,
        servers_count INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS global_server_stats (
        guild_id TEXT PRIMARY KEY,
        guild_name TEXT,
        total_members INTEGER DEFAULT 0,
        total_xp INTEGER DEFAULT 0,
        total_credits INTEGER DEFAULT 0,
        joined_at INTEGER DEFAULT (strftime('%s', 'now')),
        last_active INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();
}

// ================= GET/SET CREDITS =================
function getGlobalCredits(db, userId) {
    return db.prepare('SELECT * FROM global_credits WHERE user_id = ?').get(userId) || {
        user_id: userId, username: 'Unknown', total_credits: 0, earned_all_time: 0,
        spent_all_time: 0, last_daily: 0, daily_streak: 0, best_streak: 0
    };
}

function addGlobalCredits(db, userId, username, amount, type = 'earn', guildId, guildName) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`INSERT INTO global_credits (user_id, username, total_credits, earned_all_time, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
        total_credits = total_credits + excluded.total_credits,
        earned_all_time = earned_all_time + excluded.earned_all_time,
        username = excluded.username,
        updated_at = excluded.updated_at`).run(userId, username, amount, amount, now);

    if (type) {
        db.prepare('INSERT INTO global_transactions (from_user, to_user, amount, type, guild_id, guild_name, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            type === 'daily' || type === 'levelup' ? 'system' : userId,
            userId, amount, type, guildId || '0', guildName || 'Global', now
        );
    }
}

function deductGlobalCredits(db, userId, amount) {
    const row = db.prepare('SELECT total_credits FROM global_credits WHERE user_id = ?').get(userId);
    if (!row || row.total_credits < amount) return false;
    db.prepare('UPDATE global_credits SET total_credits = total_credits - ?, spent_all_time = spent_all_time + ? WHERE user_id = ?').run(amount, amount, userId);
    return true;
}

// ================= DAILY CLAIM =================
function claimDaily(db, userId, username) {
    const now = Math.floor(Date.now() / 1000);
    const row = getGlobalCredits(db, userId);

    // Check cooldown (24h)
    if (row.last_daily && (now - row.last_daily) < 86400) {
        const nextClaim = row.last_daily + 86400;
        return { success: false, nextClaim, streak: row.daily_streak };
    }

    // Calculate streak
    let newStreak = 1;
    if (row.last_daily && (now - row.last_daily) < 172800) {
        newStreak = (row.daily_streak || 0) + 1;
    }
    const best = Math.max(newStreak, row.best_streak || 0);

    const reward = calculateDailyReward(newStreak);
    addGlobalCredits(db, userId, username, reward.total, 'daily');

    db.prepare('UPDATE global_credits SET last_daily = ?, daily_streak = ?, best_streak = ? WHERE user_id = ?').run(now, newStreak, best, userId);

    return { success: true, ...reward, nextClaim: now + 86400 };
}

// ================= SYNC LEVEL-UP TO GLOBAL =================
function syncLevelUp(db, userId, username, level, xp) {
    const row = db.prepare('SELECT * FROM global_leaderboard WHERE user_id = ?').get(userId);
    if (row) {
        db.prepare(`UPDATE global_leaderboard SET
            username = ?,
            total_xp = total_xp + ?,
            highest_level = MAX(highest_level, ?),
            updated_at = strftime('%s', 'now')
            WHERE user_id = ?`).run(username, xp, level, userId);
    } else {
        db.prepare(`INSERT INTO global_leaderboard (user_id, username, total_xp, highest_level, updated_at)
            VALUES (?, ?, ?, ?, strftime('%s', 'now'))`).run(userId, username, xp, level);
    }
}

// ================= SYNC SERVER STATS =================
function syncServerStats(db, guildId, guildName, memberCount, totalCredits) {
    db.prepare(`INSERT INTO global_server_stats (guild_id, guild_name, total_members, total_credits, last_active)
        VALUES (?, ?, ?, ?, strftime('%s', 'now'))
        ON CONFLICT(guild_id) DO UPDATE SET
        guild_name = excluded.guild_name,
        total_members = excluded.total_members,
        total_credits = excluded.total_credits,
        last_active = strftime('%s', 'now')`).run(guildId, guildName, memberCount, totalCredits);
}

// ================= CROSS-SERVER TRANSFER =================
function transferGlobal(db, fromUser, toUser, amount) {
    const row = db.prepare('SELECT total_credits FROM global_credits WHERE user_id = ?').get(fromUser);
    if (!row || row.total_credits < amount) return { success: false, error: 'NO_FUNDS' };

    const tax = Math.floor(amount * 0.05); // 5% network tax
    const net = amount - tax;

    db.prepare('UPDATE global_credits SET total_credits = total_credits - ? WHERE user_id = ?').run(amount, fromUser);
    db.prepare(`INSERT INTO global_credits (user_id, total_credits, earned_all_time)
        VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET
        total_credits = total_credits + excluded.total_credits,
        earned_all_time = earned_all_time + excluded.earned_all_time`).run(toUser, net, net);

    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT INTO global_transactions (from_user, to_user, amount, type, guild_id, guild_name, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        fromUser, toUser, net, 'transfer', 'global', 'Cross-Server', now
    );

    return { success: true, amount: net, tax };
}

// ================= GLOBAL LEADERBOARD (FIXED) =================
function getGlobalLeaderboard(db, limit = 10) {
    return db.prepare(`SELECT 
        gc.user_id,
        gc.username,
        gc.total_credits,
        COALESCE(lb.highest_level, 0) as highest_level
        FROM global_credits gc
        LEFT JOIN global_leaderboard lb ON gc.user_id = lb.user_id
        WHERE gc.total_credits > 0
        ORDER BY gc.total_credits DESC, highest_level DESC
        LIMIT ?`).all(limit);
}

// ================= NETWORK STATS =================
function getNetworkStats(db) {
    const servers = db.prepare('SELECT COUNT(*) as count FROM global_server_stats').get();
    const users = db.prepare('SELECT COUNT(*) as count FROM global_credits WHERE total_credits > 0').get();
    const economy = db.prepare('SELECT SUM(total_credits) as total FROM global_credits').get();
    const richest = db.prepare(`SELECT gc.user_id, gc.username, gc.total_credits
        FROM global_credits gc ORDER BY gc.total_credits DESC LIMIT 1`).get();
    const avgLevel = db.prepare('SELECT AVG(highest_level) as avg FROM global_leaderboard').get();
    return {
        servers: servers?.count || 0,
        users: users?.count || 0,
        economy: economy?.total || 0,
        richest,
        avgLevel: Math.round(avgLevel?.avg || 0)
    };
}

// ================= BUILD EMBEDS =================
function buildBalanceEmbed(db, userId, username, avatar, serverBalance, client, t) {
    const global = getGlobalCredits(db, userId);
    const total = (serverBalance || 0) + global.total_credits;
    const serverPercentage = total > 0 ? Math.round(((serverBalance || 0) / total) * 100) : 0;
    const globalPercentage = total > 0 ? Math.round((global.total_credits / total) * 100) : 0;
    
    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setAuthor({ 
            name: `💰 ${username}'s Portfolio`, 
            iconURL: avatar,
            url: 'https://discord.gg/architect'
        })
        .setDescription(
            '```ansi\n' +
            '\x1b[1;32m╔════ GLOBAL ECONOMY DASHBOARD ════╗\x1b[0m\n' +
            '```'
        )
        .addFields(
            { 
                name: '💎 Total Wealth', 
                value: '```ansi\n' +
                    `\x1b[1;33m    ${total.toLocaleString().padStart(12, ' ')} credits\x1b[0m\n` +
                    '```',
                inline: false 
            },
            { 
                name: `📍 ${t.server}`, 
                value: '```ansi\n' +
                    `\x1b[1;37m  ${(serverBalance || 0).toLocaleString().padStart(10, ' ')} credits\x1b[0m\n` +
                    `\x1b[0;37m  ${createProgressBar(serverPercentage)} ${serverPercentage}%\x1b[0m\n` +
                    '```',
                inline: true 
            },
            { 
                name: `🌐 ${t.global}`, 
                value: '```ansi\n' +
                    `\x1b[1;36m  ${global.total_credits.toLocaleString().padStart(10, ' ')} credits\x1b[0m\n` +
                    `\x1b[0;37m  ${createProgressBar(globalPercentage)} ${globalPercentage}%\x1b[0m\n` +
                    '```',
                inline: true 
            }
        );

    // Daily reset countdown
    if (global.last_daily) {
        const nextDaily = global.last_daily + 86400;
        embed.addFields({ 
            name: '⏰ Daily Bonus', 
            value: `> Next claim <t:${nextDaily}:R>`,
            inline: true 
        });
    }

    // Streak info with enhanced display
    if (global.daily_streak > 0) {
        const nextMilestone = getNextStreakMilestone(global.daily_streak);
        embed.addFields({ 
            name: '🔥 Daily Streak', 
            value: [
                '```ansi',
                `\x1b[1;33m  ${global.daily_streak} days active\x1b[0m`,
                `\x1b[0;37m  🏆 Best: ${global.best_streak || global.daily_streak} days\x1b[0m`,
                nextMilestone ? `\x1b[0;32m  🎯 Next: ${nextMilestone} days\x1b[0m` : '\x1b[0;33m  👑 MAX Bonus!\x1b[0m',
                '```'
            ].join('\n'),
            inline: false 
        });
    }

    // Financial stats
    if (global.earned_all_time > 0 || global.spent_all_time > 0) {
        const netWorth = global.earned_all_time - global.spent_all_time;
        const netEmoji = netWorth >= 0 ? '📈' : '📉';
        embed.addFields({ 
            name: '📊 Financial History', 
            value: [
                `> 📥 Earned: **${global.earned_all_time.toLocaleString()}**`,
                `> 📤 Spent: **${global.spent_all_time.toLocaleString()}**`,
                `> ${netEmoji} Net: **${netWorth.toLocaleString()}** credits`
            ].join('\n'),
            inline: false 
        });
    }

    embed.setFooter({ 
        text: `${t.footer} • Portfolio Overview`, 
        iconURL: client.user?.displayAvatarURL() 
    })
    .setTimestamp();

    return embed;
}

// Helper function for streak milestones
function getNextStreakMilestone(currentStreak) {
    const milestones = [7, 30, 100, 365];
    for (const milestone of milestones) {
        if (currentStreak < milestone) return milestone;
    }
    return null;
}

// Progress bar helper
function createProgressBar(percentage, length = 10) {
    const filled = Math.round(percentage / (100 / length));
    const empty = length - filled;
    return '▰'.repeat(Math.max(0, filled)) + '▱'.repeat(Math.max(0, empty));
}

// Achievement badges
function getAchievementBadge(rank, credits, level) {
    const badges = [];
    if (rank === 1) badges.push('👑');
    if (credits >= 100000) badges.push('💎');
    if (level >= 50) badges.push('⭐');
    if (credits >= 10000) badges.push('🏅');
    return badges.length > 0 ? ' ' + badges.join('') : '';
}

function buildNetworkEmbed(db, client, t) {
    const stats = getNetworkStats(db);
    
    // Calculate additional metrics
    const avgCreditsPerUser = stats.users > 0 ? Math.round(stats.economy / stats.users) : 0;
    const avgCreditsPerServer = stats.servers > 0 ? Math.round(stats.economy / stats.servers) : 0;
    const economyHealth = getEconomyHealth(stats.economy, stats.users, stats.servers);
    
    // Get top servers
    const topServers = db.prepare(`
        SELECT guild_name, total_members, total_credits 
        FROM global_server_stats 
        ORDER BY total_credits DESC 
        LIMIT 3
    `).all();
    
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setAuthor({ 
            name: '🌐 ARCHITECT Global Network', 
            iconURL: client.user?.displayAvatarURL(),
            url: 'https://discord.gg/architect'
        })
        .setDescription(
            '```ansi\n' +
            '\x1b[1;35m╔══════════════════════════════════════╗\x1b[0m\n' +
            '\x1b[1;35m║\x1b[0m  \x1b[1;33m🇲🇱  CG-223 GLOBAL ECONOMIC GRID  🇲🇱\x1b[0m  \x1b[1;35m║\x1b[0m\n' +
            '\x1b[1;35m║\x1b[0m  \x1b[0;36mBridging Bamako to the World Grid\x1b[0m    \x1b[1;35m║\x1b[0m\n' +
            '\x1b[1;35m╚══════════════════════════════════════╝\x1b[0m\n' +
            '```'
        )
        .addFields(
            { 
                name: '🌍 • NETWORK INFRASTRUCTURE', 
                value: [
                    '```ansi',
                    '\x1b[1;37m┌─────────────────────────────────┐\x1b[0m',
                    `\x1b[1;37m│\x1b[0m 🖥️  \x1b[1;33mActive Servers\x1b[0m    \x1b[1;37m${String(stats.servers).padStart(6, ' ')}\x1b[0m  \x1b[1;37m│\x1b[0m`,
                    `\x1b[1;37m│\x1b[0m 👥 \x1b[1;33mTotal Users\x1b[0m       \x1b[1;37m${String(stats.users).padStart(6, ' ')}\x1b[0m  \x1b[1;37m│\x1b[0m`,
                    `\x1b[1;37m│\x1b[0m 💎 \x1b[1;33mNetwork Value\x1b[0m     \x1b[1;37m${stats.economy.toLocaleString().padStart(6, ' ')}\x1b[0m  \x1b[1;37m│\x1b[0m`,
                    '\x1b[1;37m└─────────────────────────────────┘\x1b[0m',
                    '```'
                ].join('\n'),
                inline: false 
            },
            { 
                name: '📊 • ECONOMIC INDICATORS', 
                value: [
                    '```ansi',
                    '\x1b[1;37m┌─────────────────────────────────┐\x1b[0m',
                    `\x1b[1;37m│\x1b[0m 💰 \x1b[1;36mAvg per User\x1b[0m     \x1b[1;37m${avgCreditsPerUser.toLocaleString().padStart(6, ' ')}\x1b[0m  \x1b[1;37m│\x1b[0m`,
                    `\x1b[1;37m│\x1b[0m 🏦 \x1b[1;36mAvg per Server\x1b[0m   \x1b[1;37m${avgCreditsPerServer.toLocaleString().padStart(6, ' ')}\x1b[0m  \x1b[1;37m│\x1b[0m`,
                    `\x1b[1;37m│\x1b[0m 📈 \x1b[1;36mAvg Level\x1b[0m        \x1b[1;37m${String(stats.avgLevel).padStart(6, ' ')}\x1b[0m  \x1b[1;37m│\x1b[0m`,
                    '\x1b[1;37m└─────────────────────────────────┘\x1b[0m',
                    '```'
                ].join('\n'),
                inline: false 
            },
            { 
                name: `${economyHealth.emoji} • ECONOMY STATUS: ${economyHealth.status.toUpperCase()}`, 
                value: economyHealth.description,
                inline: false 
            }
        );
    
    // Top servers section
    if (topServers && topServers.length > 0) {
        let topServersText = '```ansi\n\x1b[1;37m┌─────────────────────────────────┐\x1b[0m\n';
        topServers.forEach((server, index) => {
            const icons = ['🥇', '🥈', '🥉'];
            const name = (server.guild_name || 'Unknown').substring(0, 20).padEnd(20, ' ');
            topServersText += `\x1b[1;37m│\x1b[0m ${icons[index]} \x1b[1;33m${name}\x1b[0m \x1b[1;37m│\x1b[0m\n`;
        });
        topServersText += '\x1b[1;37m└─────────────────────────────────┘\x1b[0m\n```';
        
        embed.addFields({ 
            name: '🏆 • TOP NETWORK SERVERS', 
            value: topServersText,
            inline: false 
        });
    }
    
    // Wealth Elite section
    if (stats.richest) {
        embed.addFields({ 
            name: '👑 • WEALTH ELITE', 
            value: [
                '```ansi',
                '\x1b[1;37m┌─────────────────────────────────┐\x1b[0m',
                `\x1b[1;37m│\x1b[0m                                     \x1b[1;37m│\x1b[0m`,
                `\x1b[1;37m│\x1b[0m   \x1b[1;33m👑 ${stats.richest.username.padEnd(22, ' ')}\x1b[0m\x1b[1;37m│\x1b[0m`,
                `\x1b[1;37m│\x1b[0m   \x1b[0;36m💎 ${stats.richest.total_credits.toLocaleString().padEnd(20, ' ')} credits\x1b[0m\x1b[1;37m│\x1b[0m`,
                `\x1b[1;37m│\x1b[0m   \x1b[0;33m🌟 Network's Wealthiest Member\x1b[0m     \x1b[1;37m│\x1b[0m`,
                `\x1b[1;37m│\x1b[0m                                     \x1b[1;37m│\x1b[0m`,
                '\x1b[1;37m└─────────────────────────────────┘\x1b[0m',
                '```'
            ].join('\n'),
            inline: false 
        });
    }
    
    embed.setFooter({ 
        text: `${t.footer} • v${client.version || '3.0'} • Real-time Network Metrics`, 
        iconURL: client.user?.displayAvatarURL() 
    })
    .setTimestamp();
    
    return embed;
}

// Economy health calculator - ADD THIS HELPER
function getEconomyHealth(totalCredits, totalUsers, totalServers) {
    const avgPerUser = totalUsers > 0 ? totalCredits / totalUsers : 0;
    
    if (avgPerUser > 10000) return { 
        emoji: '🟢', 
        status: 'Thriving',
        description: [
            '```ansi',
            '\x1b[1;37m┌─────────────────────────────────┐\x1b[0m',
            '\x1b[1;37m│\x1b[0m  \x1b[1;32m● Economy is flourishing\x1b[0m          \x1b[1;37m│\x1b[0m',
            '\x1b[1;37m│\x1b[0m  \x1b[0;32mHigh liquidity & strong growth\x1b[0m   \x1b[1;37m│\x1b[0m',
            '\x1b[1;37m└─────────────────────────────────┘\x1b[0m',
            '```'
        ].join('\n')
    };
    if (avgPerUser > 5000) return { 
        emoji: '🟡', 
        status: 'Growing',
        description: [
            '```ansi',
            '\x1b[1;37m┌─────────────────────────────────┐\x1b[0m',
            '\x1b[1;37m│\x1b[0m  \x1b[1;33m● Steady economic expansion\x1b[0m       \x1b[1;37m│\x1b[0m',
            '\x1b[1;37m│\x1b[0m  \x1b[0;33mConsistent user activity\x1b[0m          \x1b[1;37m│\x1b[0m',
            '\x1b[1;37m└─────────────────────────────────┘\x1b[0m',
            '```'
        ].join('\n')
    };
    if (avgPerUser > 1000) return { 
        emoji: '🟠', 
        status: 'Developing',
        description: [
            '```ansi',
            '\x1b[1;37m┌─────────────────────────────────┐\x1b[0m',
            '\x1b[1;37m│\x1b[0m  \x1b[1;38;5;208m● Building economic foundation\x1b[0m     \x1b[1;37m│\x1b[0m',
            '\x1b[1;37m│\x1b[0m  \x1b[0;38;5;208mMore activity needed for growth\x1b[0m   \x1b[1;37m│\x1b[0m',
            '\x1b[1;37m└─────────────────────────────────┘\x1b[0m',
            '```'
        ].join('\n')
    };
    return { 
        emoji: '🔴', 
        status: 'Emerging',
        description: [
            '```ansi',
            '\x1b[1;37m┌─────────────────────────────────┐\x1b[0m',
            '\x1b[1;37m│\x1b[0m  \x1b[1;31m● Early stage development\x1b[0m         \x1b[1;37m│\x1b[0m',
            '\x1b[1;37m│\x1b[0m  \x1b[0;31mEncourage users to earn & trade\x1b[0m  \x1b[1;37m│\x1b[0m',
            '\x1b[1;37m└─────────────────────────────────┘\x1b[0m',
            '```'
        ].join('\n')
    };
}

function buildLeaderboardEmbed(db, client, t) {
    const rows = getGlobalLeaderboard(db, 10);
    
    if (!rows || rows.length === 0) {
        return new EmbedBuilder()
            .setColor('#1a1a2e')
            .setTitle('🏆 ' + t.leaderboard)
            .setDescription(
                '```ansi\n' +
                '\x1b[1;33m🌐 THE GLOBAL ECONOMY AWAITS\x1b[0m\n' +
                '\x1b[1;37mBe the first pioneer to make history!\x1b[0m\n' +
                '```\n' +
                '💡 **Quick Start:**\n' +
                '• `/global daily` — Claim daily rewards\n' +
                '• **Chat & Level Up** — Earn through activity\n' +
                '• **Trade** — Exchange with members\n\n' +
                '🚀 *Your name could be here!*'
            )
            .setFooter({ text: t.footer, iconURL: client.user?.displayAvatarURL() })
            .setTimestamp();
    }

    const fields = [];
    
    // Championship Podium
    let podiumText = '';
    for (let i = 0; i < Math.min(3, rows.length); i++) {
        const row = rows[i];
        const medals = ['🥇', '🥈', '🥉'];
        const badges = getAchievementBadge(i + 1, row.total_credits, row.highest_level);
        
        podiumText += 
            `${medals[i]} **${escapeFormatting(row.username || 'Unknown')}**${badges}\n` +
            `> 💰 **${(row.total_credits || 0).toLocaleString()}** credits • Lv.**${row.highest_level || 0}**\n`;
    }
    fields.push({ name: '🏅 Championship Podium', value: podiumText, inline: false });
    
    // Rankings 4-10
    if (rows.length > 3) {
        let rankingText = '';
        for (let i = 3; i < rows.length; i++) {
            const row = rows[i];
            const position = String(i + 1).padStart(2, '0');
            
            rankingText += 
                `\`#${position}\` **${escapeFormatting(row.username || 'Unknown')}**\n` +
                `> 💰 **${(row.total_credits || 0).toLocaleString()}** • Lv.**${row.highest_level || 0}**\n`;
        }
        fields.push({ name: '📈 Global Rankings', value: rankingText, inline: false });
    }
    
    // Analytics
    const totalCredits = rows.reduce((sum, r) => sum + (r.total_credits || 0), 0);
    const avgLevel = Math.round(rows.reduce((sum, r) => sum + (r.highest_level || 0), 0) / rows.length);
    const avgCredits = Math.round(totalCredits / rows.length);
    
    fields.push({
        name: '📊 Top 10 Analytics',
        value: [
            `> 💎 **Combined Wealth:** ${totalCredits.toLocaleString()}`,
            `> 📈 **Avg Level:** ${avgLevel}`,
            `> 💰 **Avg Credits:** ${avgCredits.toLocaleString()}`,
            `> 👥 **Participants:** ${rows.length}`
        ].join('\n'),
        inline: false
    });
    
    return new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle('🏆 ' + t.leaderboard)
        .setDescription('*Elite Performers Across the ARCHITECT Network*')
        .addFields(fields)
        .setFooter({ 
            text: `${t.footer} • Rankings update in real-time`, 
            iconURL: client.user?.displayAvatarURL() 
        })
        .setTimestamp();
}

// Helper function to escape markdown formatting
function escapeFormatting(text) {
    return text.replace(/[_*~`|\\<>]/g, '\\$&');
}

// ================= MODULE =================
module.exports = {
    name: 'global',
    aliases: ['network', 'cross', 'globale'],
    description: '🌐 Cross-server economy — credits work across all servers',
    category: 'ECONOMY',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('global').setDescription('🌐 Cross-server economy')
        .addSubcommand(s => s.setName('balance').setDescription('💰 View your global balance'))
        .addSubcommand(s => s.setName('daily').setDescription('📅 Claim global daily reward'))
        .addSubcommand(s => s.setName('leaderboard').setDescription('🏆 Global credit leaderboard'))
        .addSubcommand(s => s.setName('network').setDescription('🌐 View ARCHITECT network stats'))
        .addSubcommand(s => s.setName('transfer').setDescription('💸 Send credits to another user')
            .addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('Amount to send').setRequired(true).setMinValue(1))),

    // ================= PREFIX =================
    run: async (client, message, args, db, ss, used) => {
        setupDB(db);
        
        // SYNC SERVER STATS
        syncServerStats(db, message.guild.id, message.guild.name, message.guild.memberCount, 0);
        
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang] || T.en;
        const uid = message.author.id;
        const gid = message.guild.id;
        const sub = args[0]?.toLowerCase();

        // --- BALANCE ---
        if (!sub || sub === 'balance' || sub === 'bal') {
            const serverBal = getServerBalance(db, uid, gid);
            const embed = buildBalanceEmbed(db, uid, message.author.username, message.author.displayAvatarURL(), serverBal, client, t);
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // --- DAILY ---
        if (sub === 'daily' || sub === 'claim') {
            const result = claimDaily(db, uid, message.author.username);
            if (!result.success) {
                return message.reply({ embeds: [new EmbedBuilder().setColor('#e67e22').setDescription(`${t.dailyCooldown} <t:${result.nextClaim}:R>`)] }).catch(() => {});
            }
            const embed = new EmbedBuilder().setColor('#2ecc71').setTitle(t.dailyClaimed)
                .setDescription(`**+${result.total.toLocaleString()}** credits (${result.base} base + ${result.bonus} bonus)\n🔥 ${t.streak}: **${result.streak}** days`)
                .addFields({ name: t.dailyCooldown, value: `<t:${result.nextClaim}:R>`, inline: false })
                .setFooter({ text: t.footer }).setTimestamp();
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // --- TRANSFER ---
        if (sub === 'transfer' || sub === 'send') {
            const target = args[1]?.replace(/[<@!>]/g, '');
            const amount = parseInt(args[2]);
            if (!target) return message.reply('Mention a user: `.global transfer @user 1000`').catch(() => {});
            if (!amount || amount < 1) return message.reply(t.invalidAmount).catch(() => {});
            if (target === uid) return message.reply(t.selfTransfer).catch(() => {});
            const result = transferGlobal(db, uid, target, amount);
            if (!result.success) return message.reply(t.noFunds).catch(() => {});
            const embed = new EmbedBuilder().setColor('#2ecc71').setTitle(t.transferSent)
                .setDescription(`**${result.amount.toLocaleString()}** credits to <@${target}>\n${t.tax}: ${result.tax}`)
                .setFooter({ text: t.footer }).setTimestamp();
            message.reply({ embeds: [embed] }).catch(() => {});
            // Notify recipient
            client.users.fetch(target).then(u => {
                u.send({ embeds: [new EmbedBuilder().setColor('#2ecc71').setTitle(t.transferReceived).setDescription(`**+${result.amount.toLocaleString()}** credits from ${message.author.username}\nUse \`.global balance\` to check`).setFooter({ text: t.footer })] }).catch(() => {});
            }).catch(() => {});
            return;
        }

        // --- LEADERBOARD ---
        if (sub === 'lb' || sub === 'top' || sub === 'leaderboard') {
            const embed = buildLeaderboardEmbed(db, client, t);
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // --- NETWORK ---
        if (sub === 'network' || sub === 'stats') {
            const embed = buildNetworkEmbed(db, client, t);
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // Default: balance
        const serverBal = getServerBalance(db, uid, gid);
        const embed = buildBalanceEmbed(db, uid, message.author.username, message.author.displayAvatarURL(), serverBal, client, t);
        return message.reply({ embeds: [embed] }).catch(() => {});
    },

    // ================= SLASH =================
    execute: async (interaction, client) => {
        setupDB(client.db);
        
        // SYNC SERVER STATS
        syncServerStats(client.db, interaction.guildId, interaction.guild.name, interaction.guild.memberCount, 0);
        
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
        const uid = interaction.user.id;
        const gid = interaction.guildId;
        const sub = interaction.options.getSubcommand();

        // --- BALANCE ---
        if (sub === 'balance') {
            await interaction.deferReply();
            const serverBal = getServerBalance(client.db, uid, gid);
            const embed = buildBalanceEmbed(client.db, uid, interaction.user.username, interaction.user.displayAvatarURL(), serverBal, client, t);
            return interaction.editReply({ embeds: [embed] });
        }

        // --- DAILY ---
        if (sub === 'daily') {
            await interaction.deferReply();
            const result = claimDaily(client.db, uid, interaction.user.username);
            if (!result.success) {
                return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e67e22').setDescription(`${t.dailyCooldown} <t:${result.nextClaim}:R>`)] });
            }
            const embed = new EmbedBuilder().setColor('#2ecc71').setTitle(t.dailyClaimed)
                .setDescription(`**+${result.total.toLocaleString()}** credits (${result.base} base + ${result.bonus} bonus)\n🔥 ${t.streak}: **${result.streak}** days`)
                .addFields({ name: t.dailyCooldown, value: `<t:${result.nextClaim}:R>`, inline: false })
                .setFooter({ text: t.footer }).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // --- TRANSFER ---
        if (sub === 'transfer') {
            await interaction.deferReply({ flags: 64 });
            const target = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            if (!target || !amount || amount < 1) return interaction.editReply(t.invalidAmount);
            if (target.id === uid) return interaction.editReply(t.selfTransfer);
            const result = transferGlobal(client.db, uid, target.id, amount);
            if (!result.success) return interaction.editReply(t.noFunds);
            const embed = new EmbedBuilder().setColor('#2ecc71').setTitle(t.transferSent)
                .setDescription(`**${result.amount.toLocaleString()}** credits to **${target.username}**\n${t.tax}: ${result.tax}`)
                .setFooter({ text: t.footer }).setTimestamp();
            interaction.editReply({ embeds: [embed] });
            // DM recipient
            target.send({ embeds: [new EmbedBuilder().setColor('#2ecc71').setTitle(t.transferReceived).setDescription(`**+${result.amount.toLocaleString()}** credits from ${interaction.user.username}\nUse \`/global balance\` to check`).setFooter({ text: t.footer })] }).catch(() => {});
            return;
        }

        // --- LEADERBOARD ---
        if (sub === 'leaderboard') {
            await interaction.deferReply();
            const embed = buildLeaderboardEmbed(client.db, client, t);
            return interaction.editReply({ embeds: [embed] });
        }

        // --- NETWORK ---
        if (sub === 'network') {
            await interaction.deferReply();
            const embed = buildNetworkEmbed(client.db, client, t);
            return interaction.editReply({ embeds: [embed] });
        }
    },

    // ================= ENGINE EXPORTS =================
    setupDB,
    syncLevelUp,
    syncServerStats,
    getGlobalCredits,
    addGlobalCredits,
    deductGlobalCredits,
    claimDaily,
    transferGlobal,
    getNetworkStats,
    getGlobalLeaderboard,
    calculateDailyReward
};

// ================= SERVER BALANCE HELPER =================
function getServerBalance(db, userId, guildId) {
    try {
        const row = db.prepare('SELECT credits FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
        return row?.credits || 0;
    } catch { return 0; }
}