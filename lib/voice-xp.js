'use strict';
// ═══ ARCHON CG-223 — VOICE TIME ═══
// Every minute, each member talking in a voice channel gets a minute of voice time (users.voice_minutes, shown by
// /leaderboard type:voice). Voice gives NO XP: a channel left open all night used to farm levels and fill the chat with
// level-ups. A minute counts only when:
//   - leveling is on for the server (the dashboard switch), the member is not a bot;
//   - the channel is not the server's AFK channel and holds at least 2 people who are not bots;
//   - the member is not deafened (by themselves or by a moderator): a muted mic still counts, many players listen;
//   - they haven't reached 8 hours today (UTC).
// A few milestones (1 h, 5 h, 10 h, 25 h…) are announced once, quietly (no ping), in the voice channel's own chat.

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

// Total hours in voice worth a word in the chat: rare on purpose
const MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

async function announce(client, guild, channel, member, hours) {
    const { t } = require('./i18n');
    let lang = 'en';
    try { lang = require('./pick-lang').pickLang(client, guild.id, member.id); } catch { /* English */ }
    if (!['en', 'fr', 'zh', 'ar'].includes(lang)) lang = lang === 'bm' ? 'fr' : 'en';
    let icon = '🎙️';
    try { icon = require('./ui/icons').icon('voice', channel) || icon; } catch { /* plain emoji */ }
    const key = hours === 1 ? 'leveling.voice_milestone_one' : 'leveling.voice_milestone';
    await channel.send({ content: t(key, lang, { icon, user: `<@${member.id}>`, hours }), allowedMentions: { parse: [] } })
        .catch((e) => console.log(`[VOICE] milestone ${guild.id}/${channel.id}: ${e.message}`));
}

async function tick(client) {
    for (const guild of client.guilds.cache.values()) {
        let ss = {};
        try { ss = client.getServerSettings?.(guild.id) || {}; } catch { /* defaults */ }
        if (ss.leveling_enabled === 0) continue;

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

                const res = client.changeUser(member.id, guild.id, { add: { voice_minutes: 1 } }, member.user.username);
                if (!res?.ok) continue;
                const before = Number(res.previous?.voice_minutes) || 0, after = Number(res.user.voice_minutes) || 0;
                const hit = MILESTONES.find((h) => before < h * 60 && after >= h * 60);
                if (hit) await announce(client, guild, channel, member, hit);
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
