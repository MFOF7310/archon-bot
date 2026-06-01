/**
 * Bot Stats Engine — The bot earns XP, levels up, and has its own per-server stats.
 * Every command, Lydia chat, and button click = +XP for the bot.
 */

// ================= XP CONFIG =================
const BOT_XP_CONFIG = {
    commandXP: 5,        // XP per command processed
    slashXP: 8,          // XP per slash command (slightly more)
    lydiaChatXP: 3,      // XP per Lydia message
    buttonXP: 2,         // XP per button click
    levelUpMultiplier: 1.5,  // Each level requires 1.5x more XP
    baseXP: 100,         // XP needed for level 1
    maxLevel: 100,
};

// ================= DB SETUP =================
function setupBotStatsDB(database) {
    try {
        database.prepare(`
            CREATE TABLE IF NOT EXISTS bot_stats (
                guild_id TEXT PRIMARY KEY,
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                messages_handled INTEGER DEFAULT 0,
                commands_served INTEGER DEFAULT 0,
                slash_commands_served INTEGER DEFAULT 0,
                ai_chats INTEGER DEFAULT 0,
                buttons_clicked INTEGER DEFAULT 0,
                users_helped TEXT DEFAULT '{}',
                top_command TEXT DEFAULT '',
                top_command_count INTEGER DEFAULT 0,
                join_date INTEGER DEFAULT (strftime('%s', 'now')),
                last_active INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `).run();
        database.prepare(`CREATE INDEX IF NOT EXISTS idx_bot_stats_guild ON bot_stats(guild_id)`).run();
    } catch (e) {
        console.error('[BOT STATS DB] Setup failed:', e.message);
    }
}

// ================= GET OR CREATE BOT STATS =================
function getOrCreateBotStats(database, guildId) {
    try {
        let stats = database.prepare(`SELECT * FROM bot_stats WHERE guild_id = ?`).get(guildId);
        if (!stats) {
            database.prepare(`
                INSERT INTO bot_stats (guild_id, xp, level, messages_handled, commands_served, 
                    slash_commands_served, ai_chats, buttons_clicked, users_helped, join_date, last_active)
                VALUES (?, 0, 1, 0, 0, 0, 0, 0, '{}', strftime('%s', 'now'), strftime('%s', 'now'))
            `).run(guildId);
            stats = database.prepare(`SELECT * FROM bot_stats WHERE guild_id = ?`).get(guildId);
        }
        // Parse users_helped JSON
        try { stats.users_helped = JSON.parse(stats.users_helped || '{}'); } catch (e) { stats.users_helped = {}; }
        return stats;
    } catch (e) {
        console.error('[BOT STATS] Get failed:', e.message);
        return { guild_id: guildId, xp: 0, level: 1, messages_handled: 0, commands_served: 0, 
                 slash_commands_served: 0, ai_chats: 0, buttons_clicked: 0, users_helped: {}, 
                 top_command: '', top_command_count: 0, join_date: Math.floor(Date.now()/1000), last_active: Math.floor(Date.now()/1000) };
    }
}

// ================= XP NEEDED FOR LEVEL =================
function xpForLevel(level) {
    return Math.floor(BOT_XP_CONFIG.baseXP * Math.pow(BOT_XP_CONFIG.levelUpMultiplier, level - 1));
}

function xpToNextLevel(currentXP, currentLevel) {
    return xpForLevel(currentLevel + 1) - currentXP;
}

// ================= ADD XP TO BOT =================
function addBotXP(database, guildId, xpAmount, type = 'command') {
    try {
        const stats = getOrCreateBotStats(database, guildId);
        const newXP = stats.xp + xpAmount;
        let newLevel = stats.level;

        // Check for level up
        while (newXP >= xpForLevel(newLevel + 1) && newLevel < BOT_XP_CONFIG.maxLevel) {
            newLevel++;
        }

        const now = Math.floor(Date.now() / 1000);

        // Update stats
        database.prepare(`
            UPDATE bot_stats SET 
                xp = ?, level = ?, last_active = ?
            WHERE guild_id = ?
        `).run(newXP, newLevel, now, guildId);

        // If level up happened, log it
        if (newLevel > stats.level) {
            console.log(`[BOT LEVEL UP] Guild ${guildId} → Level ${newLevel} | XP: ${newXP}`);
        }

        return { leveledUp: newLevel > stats.level, oldLevel: stats.level, newLevel, newXP };
    } catch (e) {
        console.error('[BOT STATS] Add XP failed:', e.message);
        return { leveledUp: false, oldLevel: 1, newLevel: 1, newXP: 0 };
    }
}

// ================= INCREMENT STAT COUNTER =================
function incrementBotStat(database, guildId, statName, value = 1) {
    try {
        const validStats = ['messages_handled', 'commands_served', 'slash_commands_served', 'ai_chats', 'buttons_clicked'];
        if (!validStats.includes(statName)) return;

        getOrCreateBotStats(database, guildId); // Ensure row exists
        database.prepare(`UPDATE bot_stats SET ${statName} = ${statName} + ?, last_active = strftime('%s', 'now') WHERE guild_id = ?`)
            .run(value, guildId);
    } catch (e) {
        console.error(`[BOT STATS] Increment ${statName} failed:`, e.message);
    }
}

// ================= TRACK USER HELPED =================
function trackUserHelped(database, guildId, userId, commandName) {
    try {
        const stats = getOrCreateBotStats(database, guildId);
        const usersHelped = stats.users_helped || {};
        
        // Increment user count
        usersHelped[userId] = (usersHelped[userId] || 0) + 1;
        
        // Update top command
        const cmdCounts = stats._cmdCounts || {};
        cmdCounts[commandName] = (cmdCounts[commandName] || 0) + 1;
        
        let topCmd = stats.top_command;
        let topCount = stats.top_command_count;
        if (cmdCounts[commandName] > topCount) {
            topCmd = commandName;
            topCount = cmdCounts[commandName];
        }

        database.prepare(`
            UPDATE bot_stats SET 
                users_helped = ?, top_command = ?, top_command_count = ?, last_active = strftime('%s', 'now')
            WHERE guild_id = ?
        `).run(JSON.stringify(usersHelped), topCmd, topCount, guildId);
    } catch (e) {
        console.error('[BOT STATS] Track user failed:', e.message);
    }
}

// ================= PROGRESS BAR =================
function buildProgressBar(currentXP, currentLevel) {
    const xpNeeded = xpForLevel(currentLevel + 1);
    const xpCurrentLevel = xpForLevel(currentLevel);
    const xpInLevel = currentXP - xpCurrentLevel;
    const xpTotalForLevel = xpNeeded - xpCurrentLevel;
    const progress = Math.min(1, Math.max(0, xpInLevel / xpTotalForLevel));
    
    const filled = Math.round(progress * 10);
    const empty = 10 - filled;
    
    return {
        bar: '\u2588'.repeat(filled) + '\u2591'.repeat(empty),
        percent: Math.round(progress * 100),
        current: xpInLevel,
        needed: xpTotalForLevel,
        toNext: xpNeeded - currentXP
    };
}

// ================= GET BOT RANK IN SERVER =================
function getBotRank(database, guildId) {
    try {
        // Get all users sorted by XP
        const allUsers = database.prepare(`
            SELECT id, xp, guild_id FROM users WHERE guild_id = ? ORDER BY xp DESC
        `).all(guildId);
        
        // Get bot stats
        const botStats = getOrCreateBotStats(database, guildId);
        
        // Find where bot XP would rank
        let botRank = allUsers.length + 1;
        for (let i = 0; i < allUsers.length; i++) {
            if (botStats.xp >= allUsers[i].xp) {
                botRank = i + 1;
                break;
            }
        }
        
        return { rank: botRank, total: allUsers.length + 1 };
    } catch (e) {
        return { rank: 1, total: 1 };
    }
}

// ================= FORMAT UPTIME =================
function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

// ================= MODULE EXPORTS =================
module.exports = {
    name: 'botstats',
    description: 'Internal bot stats engine — not a user command',
    category: 'SYSTEM',
    hidden: true,

    // Core functions
    setupBotStatsDB,
    getOrCreateBotStats,
    addBotXP,
    incrementBotStat,
    trackUserHelped,
    buildProgressBar,
    getBotRank,
    xpForLevel,
    xpToNextLevel,
    formatUptime,

    // Config
    BOT_XP_CONFIG,

    // Convenience hooks
    onCommandProcessed(database, guildId, userId, commandName, isSlash = false) {
        if (!database || !guildId) return;
        const xp = isSlash ? BOT_XP_CONFIG.slashXP : BOT_XP_CONFIG.commandXP;
        addBotXP(database, guildId, xp, isSlash ? 'slash' : 'command');
        incrementBotStat(database, guildId, isSlash ? 'slash_commands_served' : 'commands_served');
        incrementBotStat(database, guildId, 'messages_handled');
        trackUserHelped(database, guildId, userId, commandName);
    },

    onLydiaChatProcessed(database, guildId) {
        if (!database || !guildId) return;
        addBotXP(database, guildId, BOT_XP_CONFIG.lydiaChatXP, 'lydia');
        incrementBotStat(database, guildId, 'ai_chats');
        incrementBotStat(database, guildId, 'messages_handled');
    },

    onButtonClicked(database, guildId) {
        if (!database || !guildId) return;
        addBotXP(database, guildId, BOT_XP_CONFIG.buttonXP, 'button');
        incrementBotStat(database, guildId, 'buttons_clicked');
    },

    // Bot autorole per server
    async applyBotAutoRole(guild, settings) {
        try {
            const botMember = guild.members.me;
            if (!botMember) return false;

            // Check if bot should get an auto role
            const autoRoleId = settings?.autoRoleId || settings?.autoRole;
            if (autoRoleId && guild.roles.cache.has(autoRoleId)) {
                const autoRole = guild.roles.cache.get(autoRoleId);
                if (autoRole && !botMember.roles.cache.has(autoRoleId)) {
                    await botMember.roles.add(autoRole, 'Bot auto-role assignment');
                    console.log(`[BOT AUTOROLE] Applied ${autoRole.name} to bot in ${guild.name}`);
                    return true;
                }
            }

            // Also try bot-specific role
            const botRoleName = settings?.botRoleName || 'Bot';
            const botRole = guild.roles.cache.find(r => r.name.toLowerCase() === botRoleName.toLowerCase());
            if (botRole && !botMember.roles.cache.has(botRole.id)) {
                await botMember.roles.add(botRole, 'Bot role assignment');
                console.log(`[BOT AUTOROLE] Applied ${botRole.name} to bot in ${guild.name}`);
                return true;
            }

            return false;
        } catch (e) {
            console.error(`[BOT AUTOROLE] Failed in ${guild.name}:`, e.message);
            return false;
        }
    }
};