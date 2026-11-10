// lib/handlers/message.js — Message Create Event
const { Events } = require('discord.js');

module.exports = (client, db) => {
    client.on(Events.MessageCreate, async (message) => {
    if (message.channel.isDMBased() && !message.author.bot) {
        try {
            const verifyPlugin = require('./plugins/verify.js');
            if (verifyPlugin.handleDM && await verifyPlugin.handleDM(message, client, db)) return;
        } catch (e) { console.error('[VERIFY DM CRASH]', e); }
    }

        // ── Ticket activity reset ──
        const ticketMod = client.commands.get('ticket');
        if (ticketMod?.onMessageActivity && message.guild) {
            const ss = client.getServerSettings?.(message.guild.id) || {};
            ticketMod.onMessageActivity(message, client, ss);
        }
    try {
        if (message.author.bot) return;
        if (!message.guild) return;

        const guildId = message.guild.id;
        const channelId = message.channel.id;
        const content = message.content.toLowerCase();

        // Fetch matching autoreply — channel-specific first, then guild-wide
        const replies = db.prepare(`
            SELECT * FROM auto_replies
            WHERE guild_id = ?
            AND (channel_id = ? OR channel_id IS NULL)
            ORDER BY channel_id DESC
        `).all(guildId, channelId);

        if (!replies.length) return;

        // Check cooldowns
        if (!client._arCooldowns) client._arCooldowns = new Map();

        for (const reply of replies) {
            const keyword = reply.keyword.toLowerCase();
            // Smart match — keyword found anywhere in message
            if (!content.includes(keyword)) continue;

            // Cooldown check — 60s per keyword per channel
            const cdKey = `${channelId}:${keyword}`;
            const last = client._arCooldowns.get(cdKey);
            if (last && Date.now() - last < 60000) continue;
            client._arCooldowns.set(cdKey, Date.now());

            // Build response
            const { EmbedBuilder } = require('discord.js');
            const color = parseInt(reply.embed_color) || 0x00f0ff;

            let embed;
            if (reply.embed_title) {
                embed = new EmbedBuilder()
                    .setColor(color)
                    .setTitle(reply.embed_title)
                    .setDescription(reply.response)
                    .setFooter({ text: 'BAMAKO_223 🇲🇱', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();
            } else {
                embed = new EmbedBuilder()
                    .setColor(color)
                    .setDescription(reply.response)
                    .setFooter({ text: 'BAMAKO_223 🇲🇱', iconURL: client.user.displayAvatarURL() });
            }

            await message.reply({ embeds: [embed] }).catch(() => {});

            // Update trigger count
            db.prepare('UPDATE auto_replies SET trigger_count = trigger_count + 1 WHERE id = ?').run(reply.id);
            break; // Only trigger first match
        }
    } catch(e) {}
});

// ================= PERFORMANCE INDEXES =================
const performanceIndexes = [
    "CREATE INDEX IF NOT EXISTS idx_lydia_timestamp ON lydia_conversations(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_moderation_timestamp ON moderation_logs(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status)",
    "CREATE INDEX IF NOT EXISTS idx_reminders_execute ON reminders(execute_at)",
    "CREATE INDEX IF NOT EXISTS idx_warnings_active ON warnings(active, guild_id)",
    "CREATE INDEX IF NOT EXISTS idx_users_guild ON users(guild_id)",
    "CREATE INDEX IF NOT EXISTS idx_transfers_timestamp ON transfers(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id, claimed)",
    "CREATE INDEX IF NOT EXISTS idx_lydia_guild ON lydia_conversations(guild_id)"
];

console.log(`${cyan}[INDEX]${reset} Creating performance indexes...`);
let indexesCreated = 0;
for (const indexSQL of performanceIndexes) {
    try {
        db.exec(indexSQL);
        indexesCreated++;
    } catch (err) {
        console.log(`${yellow}[INDEX]${reset} Skipped: ${err.message}`);
    }
}
console.log(`${green}[INDEX]${reset} ${indexesCreated} indexes verified`);

// ================= MIGRATE: Add ALL missing columns =================
console.log(`${cyan}[MIGRATION]${reset} Checking database schema...`);
try {
    const existingColumns = db.prepare("PRAGMA table_info(server_settings)").all().map(c => c.name);
    
    const allColumns = [
        { name: 'gift_channel', type: 'TEXT' },
        { name: 'prefix', type: "TEXT DEFAULT '.'" },
        { name: 'welcome_channel', type: 'TEXT' },
        { name: 'log_channel', type: 'TEXT' },
        { name: 'daily_channel', type: 'TEXT' },
        { name: 'shop_channel', type: 'TEXT' },
        { name: 'rules_channel', type: 'TEXT' },
        { name: 'general_channel', type: 'TEXT' },
        { name: 'member_role', type: 'TEXT' },
        { name: 'welcome_message', type: 'TEXT' },
        { name: 'updated_at', type: "INTEGER DEFAULT (strftime('%s', 'now'))" },
        { name: 'goodbye_channel', type: 'TEXT' },
        { name: 'goodbye_message', type: 'TEXT' },
        { name: 'mute_role_id', type: 'TEXT' },
        { name: 'mod_log_channel', type: 'TEXT' },
        { name: 'auto_role_id', type: 'TEXT' },
        { name: 'xp_multiplier', type: 'REAL DEFAULT 1.0' },
        { name: 'level_channel', type: 'TEXT' },
        { name: 'afk_enabled', type: 'INTEGER DEFAULT 1' },
        { name: 'market_enabled', type: 'INTEGER DEFAULT 1' },
        { name: 'daily_initiate_role', type: 'TEXT' },
        { name: 'daily_warrior_role', type: 'TEXT' },
        { name: 'daily_champion_role', type: 'TEXT' },
        { name: 'daily_legend_role', type: 'TEXT' },
        { name: 'market_channel', type: 'TEXT' },
        { name: 'ai_enabled', type: 'INTEGER DEFAULT 1' },
        { name: 'automod_enabled', type: 'INTEGER DEFAULT 0' },
        { name: 'automod_whitelist', type: 'TEXT' },
        { name: 'automod_sensitivity', type: "TEXT DEFAULT 'medium'" },
        { name: 'automod_log_channel', type: 'TEXT' },
        { name: 'language', type: "TEXT DEFAULT 'auto'" },
        { name: 'welcome_enabled', type: 'INTEGER DEFAULT 1' },
        { name: 'goodbye_enabled', type: 'INTEGER DEFAULT 1' },
        { name: 'levelup_channel', type: 'TEXT' },
        { name: 'xp_cooldown', type: 'INTEGER DEFAULT 60' },
        { name: 'xp_min_gain', type: 'INTEGER DEFAULT 15' },
        { name: 'xp_max_gain', type: 'INTEGER DEFAULT 35' },
        { name: 'starting_balance', type: 'INTEGER DEFAULT 0' },
        { name: 'max_daily_streak', type: 'INTEGER DEFAULT 365' },
        { name: 'levelup_message', type: 'TEXT' },
        { name: 'join_role_id', type: 'TEXT' },
        { name: 'disabled_commands', type: 'TEXT' },
        { name: 'disabled_categories', type: 'TEXT' },
        { name: 'spam_threshold', type: 'INTEGER DEFAULT 5' },
        { name: 'spam_window', type: 'INTEGER DEFAULT 5' },
        { name: 'link_filter_enabled', type: 'INTEGER DEFAULT 0' },
        { name: 'invite_filter_enabled', type: 'INTEGER DEFAULT 0' },
        { name: 'mention_limit', type: 'INTEGER DEFAULT 10' },
        { name: 'max_warnings', type: 'INTEGER DEFAULT 3' },
        { name: 'warning_action', type: "TEXT DEFAULT 'mute'" },
        { name: 'timezone', type: "TEXT DEFAULT 'UTC'" },
        { name: 'custom_categories', type: 'TEXT' },
        { name: 'investor_role', type: 'TEXT' },
        { name: 'gamer_role', type: 'TEXT' },
        { name: 'quiz_master_role', type: 'TEXT' },
        { name: 'duelist_role', type: 'TEXT' },
        { name: 'ticket_category', type: 'TEXT' },
        { name: 'ticket_staff_role', type: 'TEXT' },
        { name: 'ticket_transcript_channel', type: 'TEXT' },
        { name: 'ticket_panel_channel', type: 'TEXT' },
        { name: 'ticket_log_channel', type: 'TEXT' },
        { name: 'ticket_auto_close_hours', type: 'INTEGER DEFAULT 24' },
        { name: 'ticket_categories_config', type: 'TEXT' },
        { name: 'ticket_limit_per_user', type: 'INTEGER DEFAULT 1' },
        { name: 'ticket_panel_message_id', type: 'TEXT' },
        { name: 'automod_channels', type: 'TEXT' },
    ];
    
    let addedCount = 0;
    for (const col of allColumns) {
        if (!existingColumns.includes(col.name)) {
            db.exec(`ALTER TABLE server_settings ADD COLUMN ${col.name} ${col.type}`);
            console.log(`${green}[MIGRATION]${reset} Added: ${col.name}`);
            addedCount++;
        }
    }
    
    if (addedCount === 0) {
        console.log(`${green}[MIGRATION]${reset} All columns present — no migration needed`);
    } else {
        console.log(`${green}[MIGRATION]${reset} Added ${addedCount} missing columns`);
    }
} catch (err) {
    console.log(`${red}[MIGRATION]${reset} ${err.message}`);
}

// ================= MIGRATE: lydia_conversations.guild_id (Privacy Isolation) =================
console.log(`${cyan}[MIGRATION]${reset} Checking lydia_conversations schema...`);
try {
    const lydiaCols = db.prepare("PRAGMA table_info(lydia_conversations)").all().map(c => c.name);
    if (!lydiaCols.includes('guild_id')) {
        db.exec("ALTER TABLE lydia_conversations ADD COLUMN guild_id TEXT");
        console.log(`${green}[MIGRATION]${reset} Added lydia_conversations.guild_id for per-server AI privacy isolation`);
    } else {
        console.log(`${green}[MIGRATION]${reset} lydia_conversations.guild_id already present`);
    }
} catch (err) {
    console.log(`${yellow}[MIGRATION]${reset} lydia_conversations check: ${err.message}`);
}

// ================= AUTO-REPAIR: Fix invalid XP multipliers =================
try {
    const brokenRows = db.prepare(
        "SELECT guild_id, xp_multiplier FROM server_settings WHERE xp_multiplier IS NOT NULL"
    ).all();
    
    let fixed = 0;
    for (const row of brokenRows) {
        const num = parseFloat(row.xp_multiplier);
        if (isNaN(num) || num < 0.1 || num > 10.0) {
            db.prepare("UPDATE server_settings SET xp_multiplier = '1.0' WHERE guild_id = ?").run(row.guild_id);
            fixed++;
        }
    }
    if (fixed > 0) console.log(`${green}[REPAIR XP]${reset} Repaired ${fixed} invalid XP multipliers`);
} catch(e) {}

// ================= UNIVERSAL AUTO-REPAIR: Auto-add missing columns to ALL tables =================
console.log(`${cyan}[AUTO-REPAIR]${reset} Scanning all tables for missing columns...`);

// Define expected columns for each table (name, type, default)
const TABLE_SCHEMAS = {
    bot_state: [
        { name: 'value', type: 'TEXT', default: 'NULL' },
        { name: 'updated_at', type: 'INTEGER', default: "(strftime('%s', 'now'))" }
    ],
    users: [
        { name: 'last_reminder', type: 'INTEGER', default: '0' },
        { name: 'streak_protections', type: 'INTEGER', default: '0' },
        { name: 'highest_streak', type: 'INTEGER', default: '0' },
        { name: 'total_dailies', type: 'INTEGER', default: '0' },
        { name: 'last_daily', type: 'INTEGER', default: '0' },
        { name: 'gaming', type: 'TEXT', default: "'{\"game\":\"CODM\",\"rank\":\"Unranked\"}'" },
        { name: 'credits', type: 'INTEGER', default: '0' },
        { name: 'streak_days', type: 'INTEGER', default: '0' },
        { name: 'total_messages', type: 'INTEGER', default: '0' },
        { name: 'last_xp_gain', type: 'INTEGER', default: '0' }
    ],
    member_builds: [
        { name: 'image_path', type: 'TEXT', default: 'NULL' }
    ],
    server_settings: [
        { name: 'prefix', type: 'TEXT', default: "'.'" },
        { name: 'language', type: 'TEXT', default: "'auto'" },
        { name: 'timezone', type: 'TEXT', default: "'UTC'" },
        { name: 'welcome_enabled', type: 'INTEGER', default: '1' },
        { name: 'goodbye_enabled', type: 'INTEGER', default: '1' },
        { name: 'xp_multiplier', type: 'REAL', default: '1.0' },
        { name: 'xp_cooldown', type: 'INTEGER', default: '60' },
        { name: 'xp_min_gain', type: 'INTEGER', default: '15' },
        { name: 'xp_max_gain', type: 'INTEGER', default: '35' },
        { name: 'starting_balance', type: 'INTEGER', default: '0' },
        { name: 'max_daily_streak', type: 'INTEGER', default: '365' },
        { name: 'automod_enabled', type: 'INTEGER', default: '0' },
        { name: 'automod_sensitivity', type: 'TEXT', default: "'medium'" },
        { name: 'spam_threshold', type: 'INTEGER', default: '5' },
        { name: 'spam_window', type: 'INTEGER', default: '5' },
        { name: 'mention_limit', type: 'INTEGER', default: '10' },
        { name: 'max_warnings', type: 'INTEGER', default: '3' },
        { name: 'warning_action', type: 'TEXT', default: "'mute'" },
        { name: 'economy_enabled', type: 'INTEGER', default: '1' },
        { name: 'leveling_enabled', type: 'INTEGER', default: '1' },
        { name: 'music_enabled', type: 'INTEGER', default: '1' },
        { name: 'tickets_enabled', type: 'INTEGER', default: '1' },
        { name: 'moderation_enabled', type: 'INTEGER', default: '1' },
        { name: 'codm_enabled', type: 'INTEGER', default: '1' }
    ],
    lydia_conversations: [
        { name: 'guild_id', type: 'TEXT', default: 'NULL' }
    ],
    reminders: [
        { name: 'status', type: 'TEXT', default: "'pending'" },
        { name: 'delivered', type: 'INTEGER', default: '0' }
    ],
    user_premium: [
        { name: 'notified', type: 'INTEGER', default: '0' }
    ]
    // Add more tables as needed
};

// ✅ SECURE: Whitelist of allowed table names
const ALLOWED_TABLES = ['bot_state', 'users', 'shop_items', 'server_settings', 
    'lydia_memory', 'lydia_agents', 'user_inventory', 'lydia_introductions',
    'lydia_conversations', 'reminders', 'tiktok_notifications', 'warnings',
    'moderation_logs', 'server_backups', 'auto_backup_settings', 'user_links',
    'investments', 'birthdays', 'transfers', 'server_command_settings', 'scrims', 'scrim_signups', 'member_builds', 'clan_wars',
    'server_economy_settings', 'bot_roles', 'user_premium'];


};
