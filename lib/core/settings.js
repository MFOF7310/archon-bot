// lib/core/settings.js — Server Settings Management
module.exports = (client, db, DEFAULT_SETTINGS) => {

function getServerSettings(guildId) {
    if (client.settings.has(guildId)) return client.settings.get(guildId);
    
    try {
        let settings = db.prepare(`SELECT * FROM server_settings WHERE guild_id = ?`).get(guildId);
        if (!settings) {
            // only a real server gets a row: a direct message ("DM"), a language code or nothing at all must never create one
            if (/^[0-9]{15,25}$/.test(String(guildId))) db.prepare(`INSERT INTO server_settings (guild_id, prefix) VALUES (?, ?)`).run(guildId, DEFAULT_SETTINGS.prefix);
            settings = { guild_id: guildId, prefix: DEFAULT_SETTINGS.prefix };
        }
        
        // Env var fallback helpers — ONLY for owner server, never leak credentials to other guilds
        const isOwnerServer = guildId === process.env.GUILD_ID;
        const env = (dbCol, envKey) => {
            if (settings[dbCol] !== null && settings[dbCol] !== undefined) return settings[dbCol];
            // Only read env vars for the owner's server — prevents credential leakage to other guilds
            if (isOwnerServer) return process.env[envKey] || null;
            return null;
        };
        const envNum = (dbCol, envKey, fallback) => {
            if (settings[dbCol] !== null && settings[dbCol] !== undefined) return settings[dbCol];
            // Only read env vars for the owner's server — prevents credential leakage to other guilds
            if (isOwnerServer) {
                const v = process.env[envKey];
                return v ? parseInt(v) : fallback;
            }
            return fallback;
        };

        const result = {
            prefix: settings.prefix || DEFAULT_SETTINGS.prefix,
            language: settings.language || 'auto',
            timezone: settings.timezone || 'UTC',
            
            welcomeChannel: settings.welcome_channel,
            logChannel: settings.log_channel,
            dailyChannel: settings.daily_channel,
            shopChannel: env('shop_channel', 'SHOP_CHANNEL_ID'),
            marketChannel: settings.market_channel || null,
            rulesChannel: settings.rules_channel,
            generalChannel: settings.general_channel,
            goodbyeChannel: settings.goodbye_channel,
            levelChannel: settings.level_channel,
            updatesChannel: settings.updates_channel || env('updates_channel', 'UPDATES_CHANNEL_ID'),
            modLogChannel: settings.mod_log_channel,
            autoModLogChannel: settings.automod_log_channel || null,
            
            welcomeMessage: settings.welcome_message,
            goodbyeMessage: settings.goodbye_message,
            levelUpMessage: settings.levelup_message,
            levelupMessage: settings.levelup_message,   // the level-up code and the dashboard read this spelling
            levelupChannel: settings.levelup_channel,   // and this one: it was missing, so a saved level-up channel was never used
            
            memberRole: settings.member_role,
            // One auto-role: join_role_id (what joining members get). auto_role_id is the old column, read only if the new one is empty
            autoRoleId: settings.join_role_id || settings.auto_role_id,
            muteRoleId: settings.mute_role_id,
            joinRoleId: settings.join_role_id,
            investorRoleId: settings.investor_role,
            gamerRoleId: settings.gamer_role,
            quizMasterRoleId: settings.quiz_master_role,
            duelistRoleId: settings.duelist_role,
            
            // Ticket system — with env var fallback
            ticketCategory: env('ticket_category', 'TICKET_CATEGORY_ID'),
            ticketStaffRole: env('ticket_staff_role', 'TICKET_STAFF_ROLE_ID'),
            ticketTranscriptChannel: env('ticket_transcript_channel', 'TICKET_TRANSCRIPT_CHANNEL_ID'),
            ticketPanelChannel: env('ticket_panel_channel', 'TICKET_PANEL_CHANNEL_ID'),
            ticketLogChannel: env('ticket_log_channel', 'TICKET_LOG_CHANNEL_ID'),
            ticketAutoCloseHours: envNum('ticket_auto_close_hours', 'TICKET_AUTO_CLOSE_HOURS', 24),
            ticketCategoriesConfig: parseJSONSafe(settings.ticket_categories_config, null),
            ticketLimitPerUser: envNum('ticket_limit_per_user', 'TICKET_LIMIT_PER_USER', 1),
            dailyInitiateRoleId: settings.daily_initiate_role,
            dailyWarriorRoleId: settings.daily_warrior_role,
            dailyChampionRoleId: settings.daily_champion_role,
            dailyLegendRoleId: settings.daily_legend_role,
            
            welcomeEnabled: settings.welcome_enabled !== 0,
            goodbyeEnabled: settings.goodbye_enabled !== 0,
            afkEnabled: settings.afk_enabled !== 0,

            // Currency name and emoji. The Economy page needs these to show what is saved:
            // without them it always started from "credits" / the default emoji, and Save replaced your choice.
            currencyName: settings.currency_name || null,
            currencyEmoji: settings.currency_emoji || null,

            // Raid protection and Advanced AutoMod. The dashboard needs these to show what is saved:
            // without them its switches always started from the defaults, and Save could overwrite your choices.
            // The fallbacks are what the raid engine itself uses when nothing is stored.
            raidEnabled: settings.raid_enabled === 1 || settings.raid_enabled === '1',
            raidThreshold: settings.raid_threshold ?? 5,
            raidWindow: settings.raid_window ?? 30,
            raidAction: settings.raid_action || 'alert',
            raidMinAgeDays: settings.raid_min_age_days ?? 0,
            advancedAutomod: settings.advanced_automod === 1 || settings.advanced_automod === '1',
            marketEnabled: settings.market_enabled !== 0,
            economy_enabled: settings.economy_enabled !== 0 ? 1 : 0,
            leveling_enabled: settings.leveling_enabled !== 0 ? 1 : 0,
            music_enabled: settings.music_enabled !== 0 ? 1 : 0,
            tickets_enabled: settings.tickets_enabled !== 0 ? 1 : 0,
            moderation_enabled: settings.moderation_enabled !== 0 ? 1 : 0,
            codm_enabled: settings.codm_enabled !== 0 ? 1 : 0,
            ai_enabled: settings.ai_enabled !== 0 ? 1 : 0,
            aiEnabled: settings.ai_enabled !== 0,
            autoModEnabled: settings.automod_enabled === 1,
            autoModWhitelist: settings.automod_whitelist || null,
            autoModSensitivity: settings.automod_sensitivity || 'medium',
            autoModDomains: settings.automod_domains || null,
            autoModLogChannel: settings.automod_log_channel || null,
            linkFilterEnabled: settings.link_filter_enabled === 1,
            inviteFilterEnabled: settings.invite_filter_enabled === 1,
            
            xpMultiplier: settings.xp_multiplier || 1.0,
            xpCooldown: settings.xp_cooldown || 60,
            xpMinGain: settings.xp_min_gain || 15,
            xpMaxGain: settings.xp_max_gain || 35,
            
            startingBalance: settings.starting_balance || 0,
            dailyBonus: settings.daily_bonus || 200,
            maxDailyStreak: settings.max_daily_streak || 365,
            
            automodChannels: settings.automod_channels,
            automod_whitelist: settings.automod_whitelist || null,
            automod_log_channel: settings.automod_log_channel || null,
            autoModSensitivity: settings.automod_sensitivity || 'medium',
            spamThreshold: settings.spam_threshold || 5,
            spamWindow: settings.spam_window || 5,
            mentionLimit: settings.mention_limit || 10,
            maxWarnings: settings.max_warnings || 3,
            warningAction: settings.warning_action || 'mute',
            
            disabledCommands: parseJSONSafe(settings.disabled_commands, []),
            disabledCategories: parseJSONSafe(settings.disabled_categories, []),
            customCategories: parseJSONSafe(settings.custom_categories, {}),
            
            lydia_model: settings.lydia_model || 'auto',
            lydiaModel: settings.lydia_model || 'auto',
            openrouter: settings.lydia_model || 'auto',
        };
        
        client.settings.set(guildId, result);
        return result;
    } catch (err) {
        console.error(`[SETTINGS] Error for ${guildId}:`, err.message);
        return { ...DEFAULT_SETTINGS };
    }
}

function parseJSONSafe(str, fallback) {
    // ✅ SECURE: Length check to prevent memory exhaustion
    const MAX_JSON_LENGTH = 100000; // 100KB max
    
    if (!str) return fallback;
    if (typeof str !== 'string') return fallback;
    if (str.length > MAX_JSON_LENGTH) {
        console.error(`[SECURITY] JSON string too long: ${str.length} chars (max ${MAX_JSON_LENGTH})`);
        return fallback;
    }
    
    // ✅ SECURE: Check for prototype pollution patterns
    if (str.includes('__proto__') || str.includes('constructor') || str.includes('prototype')) {
        console.error(`[SECURITY] Blocked JSON with prototype pollution pattern`);
        return fallback;
    }
    
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
}

function updateServerSetting(guildId, setting, value) {
    // Handle null/undefined — store as NULL in SQLite
    if (value === null || value === undefined || value === 'null' || value === 'undefined') {
        value = null;
    }

    if (setting === 'xpboost' && value !== null) {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0.1 || num > 10.0) {
            value = '1.0';
        }
    }

    // Ensure row exists (upsert) before updating
    try {
        const exists = db.prepare('SELECT 1 FROM server_settings WHERE guild_id = ?').get(guildId);
        if (!exists && /^[0-9]{15,25}$/.test(String(guildId))) {
            db.prepare('INSERT OR IGNORE INTO server_settings (guild_id, prefix) VALUES (?, ?)').run(guildId, '.');
        }
    } catch (e) {}
    
    const columnMap = { 
        prefix: 'prefix', 
        welcome: 'welcome_channel', 
        log: 'log_channel', 
        daily: 'daily_channel', 
        shop: 'shop_channel',
        rules: 'rules_channel',
        general: 'general_channel',
        member: 'member_role',
        message: 'welcome_message',
        goodbye: 'goodbye_channel',
        goodbyemsg: 'goodbye_message',
        welcomeChannel: 'welcome_channel',
        goodbyeChannel: 'goodbye_channel',
        updates: 'updates_channel',
        updatesChannel: 'updates_channel',
        updates_channel: 'updates_channel',
        logChannel: 'log_channel',
        modLogChannel: 'mod_log_channel',
        dailyChannel: 'daily_channel',
        shopChannel: 'shop_channel',
        marketChannel: 'market_channel',
        rulesChannel: 'rules_channel',
        generalChannel: 'general_channel',
        levelupChannel: 'levelup_channel',
        levelChannel: 'level_channel',
        ticketTranscriptChannel: 'ticket_transcript_channel',
        welcomeMessage: 'welcome_message',
        welcomeEnabled: 'welcome_enabled',
        goodbyeChannel: 'goodbye_channel',
        goodbyeMessage: 'goodbye_message',
        goodbyeEnabled: 'goodbye_enabled',
        autoRoleId: 'join_role_id',
        joinRoleId: 'join_role_id',
        muteRoleId: 'mute_role_id',
        memberRole: 'member_role',
        automodEnabled: 'automod_enabled',
        automodSensitivity: 'automod_sensitivity',
        spamThreshold: 'spam_threshold',
        mentionLimit: 'mention_limit',
        maxWarnings: 'max_warnings',
        warningAction: 'warning_action',
        linkFilterEnabled: 'link_filter_enabled',
        inviteFilterEnabled: 'invite_filter_enabled',
        currencyName: 'currency_name',
        currencyEmoji: 'currency_emoji',
        dailyBonus: 'daily_bonus',
        startingBalance: 'starting_balance',
        transferTax: 'transfer_tax',
        xpMultiplier: 'xp_multiplier',
        xpCooldown: 'xp_cooldown',
        xpMinGain: 'xp_min_gain',
        xpMaxGain: 'xp_max_gain',
        aiEnabled: 'ai_enabled',
        afkEnabled: 'afk_enabled',
        marketEnabled: 'market_enabled',
        economy_enabled: 'economy_enabled',
        leveling_enabled: 'leveling_enabled',
        music_enabled: 'music_enabled',
        tickets_enabled: 'tickets_enabled',
        moderation_enabled: 'moderation_enabled',
        codm_enabled: 'codm_enabled',
        ai_enabled: 'ai_enabled',
        muterole: 'mute_role_id',
        modlog: 'mod_log_channel',
        autorole: 'join_role_id',
        xpboost: 'xp_multiplier',
        levelchan: 'level_channel',
        levelupchan: 'levelup_channel',
        afk: 'afk_enabled',
        market: 'market_channel',
        marketenabled: 'market_enabled',
        ai: 'ai_enabled',
        automod: 'automod_enabled',
        automodsensitivity: 'automod_sensitivity',
        automodwhitelist: 'automod_whitelist',
        automodchannels: 'automod_channels',
        automodlog: 'automod_log_channel',
        language: 'language',
        // snake_case passthrough — channels.js uses full column names
        welcome_channel: 'welcome_channel',
        goodbye_channel: 'goodbye_channel',
        log_channel: 'log_channel',
        mod_log_channel: 'mod_log_channel',
        daily_channel: 'daily_channel',
        shop_channel: 'shop_channel',
        market_channel: 'market_channel',
        rules_channel: 'rules_channel',
        general_channel: 'general_channel',
        levelup_channel: 'levelup_channel',
        level_channel: 'level_channel',
        ticket_transcript_channel: 'ticket_transcript_channel',
        // role keys — roles.js
        investorRoleId: 'investor_role',
        gamerRoleId: 'gamer_role',
        quizMasterRoleId: 'quiz_master_role',
        duelistRoleId: 'duelist_role',
        ticketStaffRole: 'ticket_staff_role',
        dailyInitiateRoleId: 'daily_initiate_role',
        dailyWarriorRoleId: 'daily_warrior_role',
        dailyChampionRoleId: 'daily_champion_role',
        dailyLegendRoleId: 'daily_legend_role',
        timezone: 'timezone',
        welcome_enabled: 'welcome_enabled',
        goodbye_enabled: 'goodbye_enabled',
        xp_multiplier: 'xp_multiplier',
        lydia_model: 'lydia_model',
        raid_enabled: 'raid_enabled',
        raid_threshold: 'raid_threshold',
        raid_window: 'raid_window',
        raid_action: 'raid_action',
        raid_min_age_days: 'raid_min_age_days',
        advanced_automod: 'advanced_automod',
        raidEnabled: 'raid_enabled',
        raidThreshold: 'raid_threshold',
        raidWindow: 'raid_window',
        raidAction: 'raid_action',
        raidMinAgeDays: 'raid_min_age_days',
        advancedAutomod: 'advanced_automod',
        lydiaModel: 'lydia_model',
        openrouter: 'lydia_model',
        daily_bonus: 'daily_bonus',
        link_filter_enabled: 'link_filter_enabled',
        invite_filter_enabled: 'invite_filter_enabled',
        market_enabled: 'market_enabled',
        ai_enabled: 'ai_enabled',
        xp_cooldown: 'xp_cooldown',
        xp_min_gain: 'xp_min_gain',
        xp_max_gain: 'xp_max_gain',
        starting_balance: 'starting_balance',
        max_daily_streak: 'max_daily_streak',
        levelup_message: 'levelup_message',
        join_role_id: 'join_role_id',
        disabled_commands: 'disabled_commands',
        disabled_categories: 'disabled_categories',
        spam_threshold: 'spam_threshold',
        spam_window: 'spam_window',
        link_filter: 'link_filter_enabled',
        invite_filter: 'invite_filter_enabled',
        mention_limit: 'mention_limit',
        max_warnings: 'max_warnings',
        warning_action: 'warning_action',
        investorrole: 'investor_role',
        gamerrole: 'gamer_role',
        quizmasterrole: 'quiz_master_role',
        duelistrole: 'duelist_role',
        dailyinitiaterole: 'daily_initiate_role',
        dailywarriorrole: 'daily_warrior_role',
        dailychampionrole: 'daily_champion_role',
        dailylegendrole: 'daily_legend_role',
        xpMinGain: 'xp_min_gain',
        xpMaxGain: 'xp_max_gain',
        startingBalance: 'starting_balance',
        modLogChannel: 'mod_log_channel',
        logChannel: 'log_channel',
        dailyChannel: 'daily_channel',
        shopChannel: 'shop_channel',
        levelupMessage: 'levelup_message',
        levelupChannel: 'levelup_channel',
        automodLogChannel: 'automod_log_channel',
        automodWhitelist: 'automod_whitelist',
        spamWindow: 'spam_window',
        levelChannel: 'level_channel',
        currencyEmoji: 'currency_emoji',
        ticketCategory: 'ticket_category',
        ticketStaffRole: 'ticket_staff_role',
        ticketTranscriptChannel: 'ticket_transcript_channel',
        ticketPanelChannel: 'ticket_panel_channel',
        ticketPanelChannelName: 'ticket_panel_channel_name',
        ticketLogChannel: 'ticket_log_channel',
        ticketAutoCloseHours: 'ticket_auto_close_hours',
        ticketCategoriesConfig: 'ticket_categories_config',
        ticketLimitPerUser: 'ticket_limit_per_user',
        ticketcategory: 'ticket_category',
        ticketstaffrole: 'ticket_staff_role',
        tickettranscriptchannel: 'ticket_transcript_channel',
        ticketpanelchannel: 'ticket_panel_channel',
        ticketlogchannel: 'ticket_log_channel',
        ticketautoclose: 'ticket_auto_close_hours',
        ticketcategories: 'ticket_categories_config',
        ticketlimit: 'ticket_limit_per_user',
        // ── AutoMod + Raid (lowercase + snake_case aliases) ──
        automoddomains:      'automod_domains',
        automod_domains:     'automod_domains',
        automodwhitelist:    'automod_whitelist',
        automod_whitelist:   'automod_whitelist',
        automodsensitivity:  'automod_sensitivity',
        automod_sensitivity: 'automod_sensitivity',
        automodchannels:     'automod_channels',
        automod_channels:    'automod_channels',
        automodlog:          'automod_log_channel',
        automod_log_channel: 'automod_log_channel',
        automodenabled:      'automod_enabled',
        advancedautomod:     'advanced_automod',
        linkfilterenabled:   'link_filter_enabled',
        invitefilterenabled: 'invite_filter_enabled',
        raidenabled:         'raid_enabled',
        raidthreshold:       'raid_threshold',
        raidwindow:          'raid_window',
        raidaction:          'raid_action',
        raidminagedays:      'raid_min_age_days',
    };
    
    // ✅ SECURE: Strict whitelist validation
    if (!columnMap.hasOwnProperty(setting)) {
        console.error(`[SETTINGS] Rejected invalid setting: ${setting}`);
        return false;
    }
    
    const column = columnMap[setting];
    
    // ✅ SECURE: Additional column name sanitization (defense in depth)
    if (!column || !/^[a-z_][a-z0-9_]*$/.test(column)) {
        console.error(`[SETTINGS] Invalid column name pattern: ${column}`);
        return false;
    }
    
    try {
        db.prepare(`UPDATE server_settings SET ${column} = ?, updated_at = strftime('%s', 'now') WHERE guild_id = ?`).run(value, guildId);
        client.settings.delete(guildId);
        return true;
    } catch (err) {
        console.error(`[SETTINGS] Update error:`, err.message);
        return false;
    }
}

client.getServerSettings = getServerSettings;
client.updateServerSetting = updateServerSetting;



    return { getServerSettings, updateServerSetting };
};
