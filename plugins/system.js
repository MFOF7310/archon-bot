// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — .system  (owner only, prefix only: no slash command, so it is not in anyone's picker)
// The bot's own health in plain sentences. It replaces the old public "system report" of /dashboard.
//   - it only answers the owner (OWNER_ID in .env); everyone else gets one polite line and sees nothing
//   - no host name, no CPU model, no power level: only what helps you decide whether something is wrong
//   - the verdict comes from the real numbers (connection speed with the same 200/400 ms limits as /alive, and available memory), not a fixed "OPERATIONAL"
//   - memory is ARCHON's own use next to what the machine really has available (MemAvailable), and load is per core
// ═══════════════════════════════════════════════════════
const os = require('os');
const fs = require('fs');
const { EmbedBuilder, version: DJS_VERSION } = require('discord.js');
const i18n = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');

const GREEN = 0x14b53a, AMBER = 0xf59e0b, RED = 0xce1126;
const T = (lang, key, vars) => i18n.t('system.' + key, lang, vars);

function availableMemoryMb() {
    try { const m = /MemAvailable:\s+(\d+) kB/.exec(fs.readFileSync('/proc/meminfo', 'utf8')); if (m) return Math.round(Number(m[1]) / 1024); } catch { /* not Linux, or not readable */ }
    return Math.round(os.freemem() / 1048576);
}

// What we measure, as plain numbers (kept apart from the wording so it can be tested without a bot).
function snapshot(client, db) {
    const cores = Math.max(1, (os.cpus() || []).length);
    let records = null;
    try { records = db?.prepare('SELECT COUNT(*) AS c FROM users').get()?.c ?? null; } catch { /* the line is left out */ }
    const ping = Number.isFinite(client.ws?.ping) ? Math.round(client.ws.ping) : -1;
    return {
        version: client.version || '?', uptime: process.uptime(), ping,
        rss: Math.round(process.memoryUsage().rss / 1048576), total: Math.round(os.totalmem() / 1048576), avail: availableMemoryMb(),
        load: os.loadavg()[0] / cores, cores,
        servers: client.guilds?.cache?.size ?? 0, channels: client.channels?.cache?.size ?? 0, commands: client.commands?.size ?? 0,
        records, node: process.versions.node, djs: DJS_VERSION
    };
}

function verdict(s) {
    if (s.ping >= 400) return { key: 'verySlow', color: RED };
    if (s.ping >= 200) return { key: 'slow', color: AMBER };
    if (s.avail < 150 || s.avail / Math.max(1, s.total) < 0.08) return { key: 'memLow', color: AMBER };
    if (s.ping < 0) return { key: 'pingUnknown', color: GREEN };
    return { key: 'healthy', color: GREEN };
}

function report(lang, s) {
    const v = verdict(s);
    const d = Math.floor(s.uptime / 86400), h = Math.floor((s.uptime % 86400) / 3600), m = Math.floor((s.uptime % 3600) / 60);
    const lines = [
        T(lang, `verdict.${v.key}`, { ping: s.ping, avail: s.avail }), '',
        T(lang, 'line.version', { version: s.version }),
        T(lang, 'line.uptime', { uptime: T(lang, 'uptimeFmt', { d, h, m }) }),
        s.ping < 0 ? T(lang, 'line.pingNone') : T(lang, 'line.ping', { ping: s.ping }),
        T(lang, 'line.memory', { rss: s.rss, avail: s.avail, total: s.total }),
        T(lang, 'line.load', { load: s.load.toFixed(2), cores: s.cores }) + (s.load >= 1 ? ` · ${T(lang, 'busy')}` : ''),
        T(lang, 'line.servers', { servers: s.servers, channels: s.channels }),
        T(lang, 'line.commands', { commands: s.commands })
    ];
    if (s.records !== null) lines.push(T(lang, 'line.records', { records: s.records.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') }));
    lines.push(T(lang, 'line.runtime', { node: s.node, djs: s.djs }));
    return new EmbedBuilder().setColor(v.color).setTitle(T(lang, 'title')).setDescription(lines.join('\n')).setTimestamp();
}

module.exports = {
    name: 'system',
    aliases: ['engine', 'statusboard'],
    description: 'The bot\'s own health in plain sentences (owner only).',
    category: 'OWNER',
    cooldown: 5000,
    usage: '.system',
    examples: ['.system'],

    async run(client, message, args, db) {
        const lang = pickLang(client, message.guild?.id, null);
        if (!process.env.OWNER_ID || message.author.id !== process.env.OWNER_ID) return message.reply(T(lang, 'ownerOnly')).catch(() => {});
        try {
            await message.reply({ embeds: [report(lang, snapshot(client, db || client.db))] });
        } catch (e) {
            console.error('[SYSTEM] report failed:', e.message);
            message.reply(T(lang, 'error')).catch(() => {});
        }
    },

    // Used by the installer's self-test and the tests.
    _report: report, _verdict: verdict,
    _preview(lang) {
        const base = { version: '3.1.1', uptime: 93784, ping: 119, rss: 180, total: 3814, avail: 2900, load: 0.12, cores: 2, servers: 23, channels: 378, commands: 119, records: 170, node: '22.23.3', djs: '14.26.5' };
        return [base, { ...base, ping: 250, load: 1.4 }, { ...base, ping: 450 }, { ...base, ping: -1, records: null }, { ...base, avail: 100 }].map((s) => JSON.stringify(report(lang, s).toJSON()));
    }
};
