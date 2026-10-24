function resolveModLog(guild, db) {
    if (!guild) return null;
    try {
        const cols = db.prepare('PRAGMA table_info(server_settings)').all().map(r => r.name);
        // Find any column that looks like a modlog channel
        const logCol = cols.find(n => /mod.?log/i.test(n) && /chan/i.test(n)) || cols.find(n => /mod.?log/i.test(n));
        
        if (logCol) {
            const row = db.prepare(`SELECT ${logCol} AS log_id FROM server_settings WHERE guild_id = ?`).get(guild.id);
            const own = row?.log_id ? guild.channels.cache.get(String(row.log_id)) : null;
            if (own?.isTextBased?.()) return own;
        }
    } catch (e) {
        console.error('[MODLOG] DB error:', e.message);
    }
    const envId = process.env.MOD_LOG_CHANNEL_ID;
    const envCh = envId ? guild.channels.cache.get(envId) : null;
    return envCh?.isTextBased?.() ? envCh : null;
}
module.exports = { resolveModLog };
