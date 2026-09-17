// Per-server mod-log resolution. The .env channel only resolves inside the guild that owns it.
function resolveModLog(guild, db) {
    if (!guild) return null;
    const row = db.prepare('SELECT mod_log_channel FROM server_settings WHERE guild_id = ?').get(guild.id);
    const own = row?.mod_log_channel ? guild.channels.cache.get(String(row.mod_log_channel)) : null;
    if (own?.isTextBased?.()) return own;
    const envId = process.env.MOD_LOG_CHANNEL_ID;
    const envCh = envId ? guild.channels.cache.get(envId) : null; // null for every other guild
    return envCh?.isTextBased?.() ? envCh : null;
}
module.exports = { resolveModLog };
