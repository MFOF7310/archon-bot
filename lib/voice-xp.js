'use strict';
// ═══ ARCHON CG-223 — VOICE XP ═══
// Every minute, each member talking in a voice channel earns XP and a minute of voice time (users.voice_minutes,
// shown by /leaderboard type:voice). A minute counts only when:
//   - leveling is on for the server (the dashboard switch), the member is not a bot;
//   - the channel is not the server's AFK channel and holds at least 2 people who are not bots;
//   - the member is not deafened (by themselves or by a moderator): a muted mic still counts, many players listen;
//   - they haven't reached 8 hours today (UTC): a channel left open all night doesn't farm levels.
// XP per minute: 40 % of the average message XP of the server (15–35 → 10), with its multiplier. Level-ups are
// announced as for messages (level-up channel, or the voice channel's own chat), and level roles are given.

const DAILY_MINUTES = 8 * 60;
const today = () => Math.floor(Date.now() / 86400000);
const minutesToday = new Map();   // `${guild}:${user}` → { day, n }   (memory only: a restart forgets at most a day's count)

function ensureColumn(db) {
    try { db.prepare('ALTER TABLE users ADD COLUMN voice_minutes INTEGER DEFAULT 0').run(); } catch { /* already there */ }
}

function eligible(member, channel) {
    if (!member || member.user.bot) return false;
    const vs = member.voice;
    if (!vs || vs.channelId !== channel.id) return false;
    if (vs.selfDeaf || vs.serverDeaf) return false;
    return true;
}

async function tick(client) {
    const db = client.db;
    for (const guild of client.guilds.cache.values()) {
        let ss = {};
        try { ss = client.getServerSettings?.(guild.id) || {}; } catch { /* defaults */ }
        if (ss.leveling_enabled === 0) continue;
        const minGain = Number(ss.xpMinGain) || 15, maxGain = Number(ss.xpMaxGain) || 35;
        const mult = parseFloat(ss.xpMultiplier) || 1;
        const perMinute = Math.max(1, Math.round(((minGain + maxGain) / 2) * 0.4 * mult));

        for (const channel of guild.channels.cache.values()) {
            if (!channel.isVoiceBased?.() || channel.id === guild.afkChannelId) continue;
            const people = channel.members?.filter((m) => !m.user.bot);
            if (!people || people.size < 2) continue;
            for (const member of people.values()) {
                if (!eligible(member, channel)) continue;
                const key = `${guild.id}:${member.id}`;
                const day = today();
                const c = minutesToday.get(key);
                const n = c && c.day === day ? c.n : 0;
                if (n >= DAILY_MINUTES) continue;
                minutesToday.set(key, { day, n: n + 1 });

                const res = client.changeUser(member.id, guild.id, {
                    add: { xp: perMinute, voice_minutes: 1 },
                    // compared with the SAVED level (as for messages): XP from elsewhere may have passed a level silently
                    set: { level: (u) => Math.max(Number(u.level) || 1, Math.floor(0.1 * Math.sqrt(Number(u.xp) || 0)) + 1) },
                }, member.user.username);
                if (!res?.ok) continue;
                const oldLevel = Number(res.previous?.level) || 1, newLevel = Number(res.user.level) || 1;
                if (newLevel > oldLevel && client.leveling?.onLevelUp) {
                    const xp = Number(res.user.xp) || 0;
                    const xpCur = xp - Math.pow((newLevel - 1) / 0.1, 2);
                    const xpNeed = Math.pow(newLevel / 0.1, 2) - Math.pow((newLevel - 1) / 0.1, 2);
                    await client.leveling.onLevelUp(member, newLevel, Math.floor(xpCur), Math.floor(xpNeed), client, db,
                        { channel, template: ss.levelupMessage, xp }).catch((e) => console.log(`[VOICE XP] level-up: ${e.message}`));
                }
            }
        }
    }
    // forget yesterday's counters
    if (minutesToday.size > 5000) { const d = today(); for (const [k, v] of minutesToday) if (v.day !== d) minutesToday.delete(k); }
}

function start(client) {
    ensureColumn(client.db);
    clearInterval(client._voiceXpTimer);
    let running = false;
    client._voiceXpTimer = setInterval(() => {
        if (running || !client.isReady()) return;
        running = true;
        tick(client).catch((e) => console.error('[VOICE XP]', e.message)).finally(() => { running = false; });
    }, 60 * 1000);
}

module.exports = { start, tick, DAILY_MINUTES };
