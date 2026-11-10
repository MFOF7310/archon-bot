// lib/core/database.js — Schema auto-repair
module.exports = (db, colors) => {
    const { green, reset, yellow } = colors;

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


function ensureTableColumns(db, tableName, expectedColumns) {
    // ✅ SECURE: Validate table name against whitelist
    if (!ALLOWED_TABLES.includes(tableName)) {
        console.error(`[AUTO-REPAIR] Rejected invalid table: ${tableName}`);
        return 0;
    }
    
    // ✅ SECURE: Validate table name format (defense in depth)
    if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) {
        console.error(`[AUTO-REPAIR] Invalid table name pattern: ${tableName}`);
        return 0;
    }
    
    try {
        const existing = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
        let added = 0;
        
        for (const col of expectedColumns) {
            // ✅ SECURE: Validate column name format
            if (!col.name || !/^[a-z_][a-z0-9_]*$/.test(col.name)) {
                console.error(`[AUTO-REPAIR] Invalid column name: ${col.name}`);
                continue;
            }
            
            // ✅ SECURE: Validate column type (whitelist common SQLite types)
            const ALLOWED_TYPES = ['TEXT', 'INTEGER', 'REAL', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATETIME', 'JSON'];
            const baseType = col.type.split(' ')[0].toUpperCase();
            if (!ALLOWED_TYPES.includes(baseType)) {
                console.error(`[AUTO-REPAIR] Invalid column type: ${col.type}`);
                continue;
            }
            
            if (!existing.includes(col.name)) {
                const defaultClause = col.default !== undefined ? ` DEFAULT ${col.default}` : '';
                // ✅ SECURE: All identifiers validated before interpolation
                const alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}${defaultClause}`;
                let didAdd = false;
                try { db.exec(alterSQL); didAdd = true; } catch(e) {
                    if (!e.message.includes('duplicate column')) throw e;
                }
                if (didAdd) {
                    console.log(`${green}[AUTO-REPAIR]${reset} Added ${tableName}.${col.name}${defaultClause ? ` (default: ${col.default})` : ''}`);
                    added++;
                }
            }
        }
        return added;
    } catch (err) {
        console.log(`${yellow}[AUTO-REPAIR]${reset} Failed on ${tableName}: ${err.message}`);
        return 0;
    }
}

let totalAdded = 0;
for (const [tableName, columns] of Object.entries(TABLE_SCHEMAS)) {
    totalAdded += ensureTableColumns(db, tableName, columns);
}

if (totalAdded > 0) {
    console.log(`${green}[AUTO-REPAIR]${reset} Added ${totalAdded} missing columns across ${Object.keys(TABLE_SCHEMAS).length} tables`);
} else {
    console.log(`${green}[AUTO-REPAIR]${reset} All schemas are up to date – no columns missing`);
}

};
