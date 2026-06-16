const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

// ================= CONFIG =================
const BROADCAST_COOLDOWN_MS = 6 * 3600000;  // 6 hours minimum between broadcasts
const SIGNIFICANT_CHANGE_THRESHOLD = 1;       // Need at least 1 meaningful change
const SNAPSHOT_FILE = path.join(__dirname, '..', 'data', 'broadcast-snapshot.json');
const LOG_FILE = path.join(__dirname, '..', 'data', 'broadcast-log.json');
const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

// Files to monitor for changes (ignore these for "significance")
const IGNORE_FILES = ['.env', 'package.json', 'package-lock.json', 'README.md', '.gitignore'];

// ================= LOG / SNAPSHOT =================
function loadLog() {
    try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); }
    catch { return { lastVersion: null, lastBroadcastTime: 0, lastStats: null, quietServers: [] }; }
}
function saveLog(log) { try { fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true }); fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2)); } catch {} }
function loadSnapshot() {
    try { return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')); }
    catch { return {}; }
}
function saveSnapshot(snap) { try { fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true }); fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snap, null, 2)); } catch {} }

// ================= VERSION =================
function getVersion(client) {
    if (client.version) return client.version;
    try {
        const vFile = path.join(__dirname, '..', 'version.txt');
        if (fs.existsSync(vFile)) return fs.readFileSync(vFile, 'utf8').trim();
    } catch {}
    return '2.0.0';
}

// Parse version into parts: v2.0.0 → { major: 2, minor: 0, patch: 0 }
function parseVersion(v) {
    const parts = v.replace(/^v/, '').split('.').map(Number);
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
}

// Only broadcast on major or minor changes, not patch
function isSignificantVersionChange(oldV, newV) {
    if (!oldV) return true; // First broadcast ever
    const o = parseVersion(oldV);
    const n = parseVersion(newV);
    return n.major > o.major || n.minor > o.minor;
}

// ================= FILE SNAPSHOT =================
function takeSnapshot() {
    const snap = {};
    if (!fs.existsSync(PLUGINS_DIR)) return snap;
    const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js') && !IGNORE_FILES.includes(f));
    for (const f of files) {
        try { snap[f] = { size: fs.statSync(path.join(PLUGINS_DIR, f)).size, mtime: fs.statSync(path.join(PLUGINS_DIR, f)).mtimeMs }; }
        catch {}
    }
    // Also snapshot index.js and package.json
    const rootFiles = ['index.js', 'package.json'];
    for (const f of rootFiles) {
        const fp = path.join(__dirname, '..', f);
        try { if (fs.existsSync(fp)) snap[f] = { size: fs.statSync(fp).size, mtime: fs.statSync(fp).mtimeMs }; }
        catch {}
    }
    return snap;
}

function detectChanges(current, previous) {
    const changes = { new: [], modified: [], removed: [] };
    // New files
    for (const f of Object.keys(current)) { if (!previous[f]) changes.new.push(f); }
    // Modified files
    for (const f of Object.keys(current)) { if (previous[f] && (current[f].size !== previous[f].size || current[f].mtime !== previous[f].mtime)) changes.modified.push(f); }
    // Removed files
    for (const f of Object.keys(previous)) { if (!current[f]) changes.removed.push(f); }
    return changes;
}

function humanName(file) { return file.replace('.js', '').replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

// ================= CHANNEL FINDER =================
async function findBestChannel(guild, client) {
    const tryNames = ['general', 'chat', 'main', 'lobby', 'community', 'discussion', 'talk'];
    for (const name of tryNames) {
        const ch = guild.channels.cache.find(c => c.type === 0 && c.name.toLowerCase().includes(name) && c.permissionsFor(client.user)?.has('SendMessages'));
        if (ch) return ch;
    }
    return guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(client.user)?.has('SendMessages')) || null;
}

// ================= TRANSLATIONS =================
const T = {
    en: {
        greeting: name => `Update deployed to **${name}**`,
        intro: v => `ARCHON CG-223 v${v}`,
        newHeader: 'What\'s New',
        improvedHeader: 'Improved',
        modifiedHeader: 'Updated',
        footer: v => `ARCHON CG-223 v${v}`,
        dmTitle: 'Broadcast Complete',
        dmBody: (s, f, t) => `Sent to **${s}** servers (${f} failed)`,
        noChanges: 'System restart with no significant changes.',
        changeCount: (n, m, r) => `${n ? n + ' new · ' : ''}${m ? m + ' updated · ' : ''}${r ? r + ' removed' : ''}`.replace(/ · $/, ''),
    },
    fr: {
        greeting: name => `Mise à jour déployée sur **${name}**`,
        intro: v => `ARCHON CG-223 v${v}`,
        newHeader: 'Nouveautés',
        improvedHeader: 'Améliorations',
        modifiedHeader: 'Mises à jour',
        footer: v => `ARCHON CG-223 v${v}`,
        dmTitle: 'Diffusion terminée',
        dmBody: (s, f, t) => `Envoyé à **${s}** serveurs (${f} échoués)`,
        noChanges: 'Redémarrage système sans changements significatifs.',
        changeCount: (n, m, r) => `${n ? n + ' nouveaux · ' : ''}${m ? m + ' mis à jour · ' : ''}${r ? r + ' supprimés' : ''}`.replace(/ · $/, ''),
    }
};

// ================= EMBED BUILDER =================
function buildCompactEmbed(changes, lang, guild, version) {
    const t = T[lang] || T.en;
    const totalNew = changes.new.length;
    const totalMod = changes.modified.length;
    const totalRem = changes.removed.length;
    const hasChanges = totalNew + totalMod + totalRem > 0;

    const lines = [];
    lines.push(`${t.intro(version)}`);

    if (hasChanges) {
        const changeText = t.changeCount(totalNew, totalMod, totalRem);
        if (changeText) lines.push(`\`${changeText}\``);

        if (totalNew > 0) {
            lines.push('');
            lines.push(`**${t.newHeader}**`);
            changes.new.slice(0, 5).forEach(f => lines.push(`• ${humanName(f)}`));
            if (totalNew > 5) lines.push(`• +${totalNew - 5} more`);
        }
        if (totalMod > 0) {
            lines.push('');
            lines.push(`**${t.modifiedHeader}**`);
            changes.modified.slice(0, 5).forEach(f => lines.push(`• ${humanName(f)}`));
            if (totalMod > 5) lines.push(`• +${totalMod - 5} more`);
        }
        if (totalRem > 0) {
            lines.push('');
            lines.push(`Removed`);
            changes.removed.slice(0, 3).forEach(f => lines.push(`• ~~${humanName(f)}~~`));
        }
    } else {
        lines.push(t.noChanges);
    }

    const color = totalNew > 0 ? '#00fbff' : totalMod > 0 ? '#5865f2' : totalRem > 0 ? '#e74c3c' : '#3ba55d';
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `🦅 ARCHON CG-223`, iconURL: guild.client?.user?.displayAvatarURL() })
        .setDescription(lines.join('\n'))
        .setFooter({ text: t.footer(version) })
        .setTimestamp();
}

// ================= MAIN BROADCAST =================
async function autoBroadcast(client) {
    try {
        const version = getVersion(client);
        const log = loadLog();
        const now = Date.now();

        // === GATE 1: Cooldown check ===
        const timeSinceLast = now - (log.lastBroadcastTime || 0);
        if (timeSinceLast < BROADCAST_COOLDOWN_MS) {
            const remaining = Math.ceil((BROADCAST_COOLDOWN_MS - timeSinceLast) / 60000);
            console.log(`[BROADCAST] ⏳ On cooldown. ${remaining}m remaining since last broadcast.`);
            return;
        }

        // === GATE 2: Significant version change ===
        if (!isSignificantVersionChange(log.lastVersion, version)) {
            console.log(`[BROADCAST] ⏭️ Patch change only (${log.lastVersion} → ${version}). Skipping auto-broadcast. Use .broadcast to force.`);
            return;
        }

        const previous = loadSnapshot();
        const current = takeSnapshot();
        const changes = detectChanges(current, previous);
        const totalChanges = changes.new.length + changes.modified.length + changes.removed.length;

        console.log(`[BROADCAST] ════════════════════════════════`);
        console.log(`[BROADCAST] 🚀 v${version} (${log.lastVersion || 'none'} → ${version})`);
        console.log(`[BROADCAST] New: ${changes.new.length} | Modified: ${changes.modified.length} | Removed: ${changes.removed.length}`);
        console.log(`[BROADCAST] Servers: ${client.guilds.cache.size} | Cooldown: passed`);
        console.log(`[BROADCAST] ════════════════════════════════`);

        // If zero changes but version bump, still broadcast (version update)
        if (totalChanges === 0 && log.lastVersion === version) {
            console.log(`[BROADCAST] ⏭️ No changes & same version. Skipping.`);
            return;
        }

        let success = 0, fail = 0;
        const guilds = Array.from(client.guilds.cache.values());
        const quietServers = new Set(log.quietServers || []);

        for (let i = 0; i < guilds.length; i++) {
            const guild = guilds[i];

            // Per-server opt-out check
            if (quietServers.has(guild.id)) { continue; }

            try {
                const lang = guild.preferredLocale === 'fr' ? 'fr' : 'en';
                const channel = await findBestChannel(guild, client);
                if (!channel) { fail++; continue; }

                const embed = buildCompactEmbed(changes, lang, guild, version);
                await channel.send({ embeds: [embed] });
                success++;

                if ((i + 1) % 10 === 0 || i === guilds.length - 1) {
                    console.log(`[BROADCAST] Progress: ${i + 1}/${guilds.length} (${success} ok, ${fail} fail)`);
                }

                await new Promise(r => setTimeout(r, 300));
                if ((i + 1) % 10 === 0) await new Promise(r => setTimeout(r, 1500));
            } catch (err) {
                fail++;
            }
        }

        saveSnapshot(current);
        log.lastVersion = version;
        log.lastBroadcastTime = now;
        log.lastStats = { success, fail, total: guilds.length };
        saveLog(log);

        console.log(`[BROADCAST] ✅ Complete: ${success} sent, ${fail} failed`);

        // DM owner
        try {
            if (process.env.OWNER_ID) {
                const owner = await client.users.fetch(process.env.OWNER_ID).catch(() => null);
                if (owner) {
                    const report = new EmbedBuilder().setColor('#2ecc71').setTitle(T.en.dmTitle).setDescription(T.en.dmBody(success, fail, guilds.length)).setFooter({ text: `v${version}` }).setTimestamp();
                    await owner.send({ embeds: [report] });
                }
            }
        } catch {}
    } catch (err) { console.error(`[BROADCAST] FATAL: ${err.message}`); }
}

// ================= MANUAL BROADCAST =================
async function manualBroadcast(client, targetChannelId = null) {
    try {
        const version = getVersion(client);
        const previous = loadSnapshot();
        const current = takeSnapshot();
        const changes = detectChanges(current, previous);

        if (targetChannelId) {
            const channel = await client.channels.fetch(targetChannelId).catch(() => null);
            if (channel) {
                const embed = buildCompactEmbed(changes, 'en', channel.guild || { name: 'Test', client }, version);
                await channel.send({ embeds: [embed] });
            }
        } else {
            const guilds = Array.from(client.guilds.cache.values());
            let s = 0;
            for (const guild of guilds) {
                try {
                    const ch = await findBestChannel(guild, client);
                    if (ch) { const embed = buildCompactEmbed(changes, 'en', guild, version); await ch.send({ embeds: [embed] }); s++; }
                    await new Promise(r => setTimeout(r, 300));
                } catch {}
            }
            console.log(`[BROADCAST] Manual: ${s} servers`);
        }
    } catch (err) { console.error(`[BROADCAST] Manual failed: ${err.message}`); }
}

// ================= TOGGLE QUIET MODE =================
function toggleQuiet(guildId, quiet) {
    const log = loadLog();
    const qs = new Set(log.quietServers || []);
    if (quiet) qs.add(guildId); else qs.delete(guildId);
    log.quietServers = [...qs];
    saveLog(log);
    return quiet;
}
function isQuiet(guildId) {
    const log = loadLog();
    return (log.quietServers || []).includes(guildId);
}

// ================= RESET =================
function resetSnapshots() {
    try { if (fs.existsSync(SNAPSHOT_FILE)) fs.unlinkSync(SNAPSHOT_FILE); } catch {}
    try { if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE); } catch {}
    console.log('[BROADCAST] Snapshots reset');
}

module.exports = { autoBroadcast, manualBroadcast, resetSnapshots, toggleQuiet, isQuiet, T, buildCompactEmbed };
