// lib/tasks/maintenance.js — Background maintenance tasks (batch writer, heartbeat, cache janitor).
module.exports = (client, db, flushUserUpdates, WRITE_STRATEGY, CACHE_CONFIG) => {
    const green = '\x1b[32m';
    const reset = '\x1b[0m';
    const yellow = '\x1b[33m';

function startBatchWriteInterval() {
    if (client.batchWriteInterval) clearInterval(client.batchWriteInterval);
    client.batchWriteInterval = setInterval(() => {
        if (client.pendingUserUpdates.size > 0) {
            flushUserUpdates(0);
        }
    }, WRITE_STRATEGY.MAX_WAIT_MS);
}

function startReminderHeartbeat() {
    if (client.reminderHeartbeatInterval) clearInterval(client.reminderHeartbeatInterval);
    
    // One delivery engine for every reminder (/remind and Lydia): plugins/reminder.js tick()
    client.reminderHeartbeatInterval = setInterval(() => {
        require('./plugins/reminder.js').tick(client, db).catch(e => console.error('[REMINDER] tick:', e.message));
    }, 30000);
    
    console.log(`${green}[REMINDER]${reset} Heartbeat started (30s interval)`);
}

// Cache janitor uses composite keys for consistency
function pruneUserCache() {
 const now = Date.now();
 const nowSec = Math.floor(now / 1000);
 let prunedCount = 0;
 let premiumEvicted = 0;

 for (const [compositeKey, userData] of client.userDataCache.entries()) {
 if (client.pendingUserUpdates.has(compositeKey)) continue;

 const lastAccess = userData._lastAccess || userData._cachedAt || 0;
 if (now - lastAccess > CACHE_CONFIG.MAX_AGE_MS) {
 client.userDataCache.delete(compositeKey);
 prunedCount++;
 }
 }

 // Evict expired premium guilds from any in-memory premium cache
 if (client.premiumCache instanceof Map) {
 for (const [guildId, entry] of client.premiumCache.entries()) {
 if (entry.expires_at && entry.expires_at < nowSec) {
 client.premiumCache.delete(guildId);
 premiumEvicted++;
 }
 }
 }

 // LRU cap: evict oldest entries if cache exceeds max size
 const MAX_CACHE_ENTRIES = 2000;
 if (client.userDataCache.size > MAX_CACHE_ENTRIES) {
 const sorted = [...client.userDataCache.entries()]
 .sort((a, b) => (a[1]._lastAccess || 0) - (b[1]._lastAccess || 0));
 const toEvict = sorted.slice(0, client.userDataCache.size - MAX_CACHE_ENTRIES);
 for (const [key] of toEvict) {
 client.userDataCache.delete(key);
 prunedCount++;
 }
 }

 if (prunedCount > 0 || premiumEvicted > 0) {
 console.log(
 `${yellow}[CACHE]${reset} Janitor: ${prunedCount} stale users` +
 (premiumEvicted > 0 ? `, ${premiumEvicted} expired premium` : '')
 );
 }
}

function startCacheJanitor() {
    if (client.cacheJanitorInterval) clearInterval(client.cacheJanitorInterval);
    client.cacheJanitorInterval = setInterval(() => pruneUserCache(), CACHE_CONFIG.CLEANUP_INTERVAL_MS);
    console.log(`${green}[CACHE]${reset} Janitor started (30min cleanup, 1h TTL)`);
}

client.invalidateGuildCache = (guildId) => {
 let evicted = 0;
 for (const [key] of client.userDataCache.entries()) {
 if (key.endsWith(`:${guildId}`)) {
 client.userDataCache.delete(key);
 evicted++;
 }
 }
 if (evicted > 0)
 console.log(`${yellow}[CACHE]${reset} Invalidated ${evicted} entries for guild ${guildId}`);
};

    // Démarrage des tâches
    startBatchWriteInterval();
    startReminderHeartbeat();
    startCacheJanitor();
};
