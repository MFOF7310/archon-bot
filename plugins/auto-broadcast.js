const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PLUGIN_DIR = path.join(__dirname, '..', 'plugins');
const SNAPSHOT_FILE = path.join(DATA_DIR, '.plugin_snapshot.json');
const LOG_FILE = path.join(DATA_DIR, '.broadcast_log.json');

// ================= GET CURRENT VERSION =================
function getVersion(client) {
    if (client?.version) return client.version;
    try {
        const vFile = path.join(process.cwd(), 'data', 'version.txt');
        if (fs.existsSync(vFile)) return fs.readFileSync(vFile, 'utf8').trim();
    } catch (e) {}
    try {
        const pkg = path.join(process.cwd(), 'package.json');
        if (fs.existsSync(pkg)) return JSON.parse(fs.readFileSync(pkg, 'utf8')).version || '2.0.0';
    } catch (e) {}
    return '2.0.0';
}

// ================= FILE SNAPSHOT =================
function takeSnapshot() {
    const snapshot = { files: {}, timestamp: Date.now() };
    if (!fs.existsSync(PLUGIN_DIR)) return snapshot;
    const files = fs.readdirSync(PLUGIN_DIR).filter(f => f.endsWith('.js'));
    for (const file of files) {
        try {
            const fp = path.join(PLUGIN_DIR, file);
            const stat = fs.statSync(fp);
            const content = fs.readFileSync(fp, 'utf8');
            const hash = crypto.createHash('md5').update(content).digest('hex');
            snapshot.files[file] = { size: stat.size, mtime: stat.mtimeMs, hash, lines: content.split('\n').length };
        } catch (e) { snapshot.files[file] = { size: 0, mtime: 0, hash: '', lines: 0 }; }
    }
    try {
        const idxPath = path.join(__dirname, '..', 'index.js');
        if (fs.existsSync(idxPath)) {
            const stat = fs.statSync(idxPath);
            const content = fs.readFileSync(idxPath, 'utf8');
            const hash = crypto.createHash('md5').update(content).digest('hex');
            snapshot.files['index.js'] = { size: stat.size, mtime: stat.mtimeMs, hash, lines: content.split('\n').length, isCore: true };
        }
    } catch (e) {}
    return snapshot;
}

function loadSnapshot() {
    try { if (fs.existsSync(SNAPSHOT_FILE)) return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')); } catch (e) {}
    return null;
}

function saveSnapshot(snapshot) {
    try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2)); } catch (e) {}
}

function resetSnapshots() {
    try { if (fs.existsSync(SNAPSHOT_FILE)) fs.unlinkSync(SNAPSHOT_FILE); if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE); return true; } catch (e) { return false; }
}

function loadLog() {
    try { if (fs.existsSync(LOG_FILE)) return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (e) {}
    return {};
}

function saveLog(log) {
    try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2)); } catch (e) {}
}

function detectRealChanges(current, previous) {
    const changes = { new: [], fixed: [], improved: [], updated: [], removed: [] };
    if (!previous || !previous.files) {
        for (const [file, data] of Object.entries(current.files)) changes.new.push({ file, ...data, desc: describeNewFile(file, data) });
        return changes;
    }
    for (const [file, data] of Object.entries(current.files)) {
        if (!previous.files[file]) changes.new.push({ file, ...data, desc: describeNewFile(file, data) });
    }
    for (const [file, data] of Object.entries(previous.files)) {
        if (!current.files[file]) changes.removed.push({ file, ...data, desc: `${file.replace('.js', '')}` });
    }
    for (const [file, cur] of Object.entries(current.files)) {
        const prev = previous.files[file];
        if (!prev) continue;
        if (cur.hash !== prev.hash) {
            const analysis = analyzeChange(file, prev, cur);
            changes[analysis.type === 'fix' ? 'fixed' : analysis.type === 'improve' ? 'improved' : 'updated'].push({ file, ...cur, desc: analysis.desc });
        }
    }
    return changes;
}

function describeNewFile(file, data) {
    const name = file.replace('.js', '');
    try { const content = fs.readFileSync(path.join(PLUGIN_DIR, file), 'utf8'); const descMatch = content.match(/description:\s*['"](.+?)['"]/); if (descMatch) return descMatch[1]; } catch (e) {}
    return `${name} — New command added`;
}

function analyzeChange(file, prev, cur) {
    const name = file.replace('.js', '');
    const sizeDiff = cur.size - prev.size;
    const lineDiff = cur.lines - prev.lines;
    let diffContent = '';
    try {
        const fp = path.join(file === 'index.js' ? path.join(__dirname, '..') : PLUGIN_DIR, file);
        if (fs.existsSync(fp)) diffContent = fs.readFileSync(fp, 'utf8').substring(0, 5000).toLowerCase();
    } catch (e) {}
    const fixKeywords = ['fix', 'bug', 'patch', 'repair', 'correct', 'resolve', 'error', 'broken', 'crash', 'issue'];
    const improveKeywords = ['improve', 'enhance', 'upgrade', 'refactor', 'optimize', 'better', 'faster', 'redesign', 'rebuild', 'rewrite'];
    const fixScore = fixKeywords.filter(k => diffContent.includes(k)).length;
    const improveScore = improveKeywords.filter(k => diffContent.includes(k)).length;
    if (fixScore > improveScore) return { type: 'fix', desc: extractDesc(diffContent, name) || `${name} — Bug fix` };
    if (improveScore >= fixScore) return { type: 'improve', desc: extractDesc(diffContent, name) || `${name} — Improved` };
    if (sizeDiff > 200) return { type: 'improve', desc: `${name} — Added new features (+${lineDiff > 0 ? lineDiff : 0} lines)` };
    if (sizeDiff < -50) return { type: 'fix', desc: `${name} — Code cleanup and fixes (${lineDiff} lines)` };
    return { type: 'update', desc: `${name} — Updated` };
}

function extractDesc(content, name) {
    const descMatch = content.match(/description:\s*['"](.+?)['"]/);
    if (descMatch) return descMatch[1];
    return null;
}

function humanName(file) { return file.replace('.js', '').replace(/-/g, ' ').replace(/_/g, ' '); }

// ================= FIND BEST CHANNEL (FIXED PERMISSIONS) =================
async function findBestChannel(guild, client) {
    if (!guild) return null;
    let botMember = guild.members.me;
    if (!botMember && client?.user) botMember = guild.members.cache.get(client.user.id);
    if (!botMember && client?.user) {
        try { botMember = await guild.members.fetch(client.user.id); } catch (e) { console.log(`[AUTO-BROADCAST] ${guild.name}: Failed to fetch bot member — ${e.message}`); return null; }
    }
    if (!botMember) { console.log(`[AUTO-BROADCAST] ${guild.name}: Bot member not found`); return null; }

    // FIXED: Use PermissionsBitField.Flags instead of string literals
    const canSend = (c) => {
        try {
            const perms = c.permissionsFor(botMember);
            return perms && perms.has(PermissionsBitField.Flags.ViewChannel) && perms.has(PermissionsBitField.Flags.SendMessages) && perms.has(PermissionsBitField.Flags.EmbedLinks);
        } catch (e) { return false; }
    };

    const textChannels = guild.channels.cache.filter(c => c.type === 0 && canSend(c));
    if (textChannels.size === 0) { console.log(`[AUTO-BROADCAST] ${guild.name}: No text channels with SendMessages+EmbedLinks permission`); return null; }

    const named = textChannels.find(c => /^(general|général|main|chat|discussion|talk|updates|news|bot|cmd|command)/i.test(c.name));
    if (named) return named;
    if (guild.systemChannel && canSend(guild.systemChannel)) return guild.systemChannel;
    const active = textChannels.sort((a, b) => (b.lastMessageId ? BigInt(b.lastMessageId) : 0n) - (a.lastMessageId ? BigInt(a.lastMessageId) : 0n)).first();
    if (active) return active;
    return textChannels.first();
}

// ================= TRANSLATIONS =================
const T = {
    en: {
        newPlugin: (n, d) => `**${n}** — ${d}`, fixedPlugin: (n, d) => `**${n}** — ${d}`, improvedPlugin: (n, d) => `**${n}** — ${d}`, updatedPlugin: (n, d) => `**${n}** — ${d}`, removedPlugin: (n) => `**${n}** — Removed`,
        newHeader: '🆕 New', fixedHeader: '🔧 Fixed', improvedHeader: '⚡ Improved', updatedHeader: '📝 Updated', removedHeader: '🗑️ Removed',
        greeting: (g) => `Hey **${g}**! 👋`, intro: (v) => `Just updated to **v${v}** — here's what changed:\n`,
        noChanges: (v) => `Updated to **v${v}**. All systems running smooth. 🎯`, closing: ["That's the update. Happy to be here! 🚀", "All caught up. Let me know if anything feels off! 🎯", "That's everything. Thanks for having me around! 🦅"],
        footer: (v) => `Architect CG-223 v${v} • .changelog for details`, dmTitle: '📬 Broadcast Complete', dmBody: (s, f, t) => `Sent to **${s}**/${t} servers.${f > 0 ? `\n⚠️ ${f} failed (missing permissions).` : ''}`, coreChange: 'Core engine updated',
    },
    fr: {
        newPlugin: (n, d) => `**${n}** — ${d}`, fixedPlugin: (n, d) => `**${n}** — ${d}`, improvedPlugin: (n, d) => `**${n}** — ${d}`, updatedPlugin: (n, d) => `**${n}** — ${d}`, removedPlugin: (n) => `**${n}** — Supprimé`,
        newHeader: '🆕 Nouveautés', fixedHeader: '🔧 Corrections', improvedHeader: '⚡ Améliorations', updatedHeader: '📝 Mises à jour', removedHeader: '🗑️ Suppressions',
        greeting: (g) => `Salut **${g}**! 👋`, intro: (v) => `Mis à jour en **v${v}** — voici les changements :\n`,
        noChanges: (v) => `Mis à jour en **v${v}**. Tout fonctionne correctement. 🎯`, closing: ["C'est tout pour cette mise à jour. Content d'être là! 🚀", "À jour. Dites-moi si quelque chose ne va pas! 🎯", "C'est tout. Merci de m'avoir à vos côtés! 🦅"],
        footer: (v) => `Architect CG-223 v${v} • .changelog pour les détails`, dmTitle: '📬 Diffusion Terminée', dmBody: (s, f, t) => `Envoyé à **${s}**/${t} serveurs.${f > 0 ? `\n⚠️ ${f} échec (permissions manquantes).` : ''}`, coreChange: 'Moteur principal mis à jour',
    }
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ================= BUILD EMBED =================
function buildEmbed(changes, lang, guild, version) {
    const t = T[lang];
    const lines = [];
    const hasChanges = changes.new.length + changes.fixed.length + changes.improved.length + changes.updated.length + changes.removed.length > 0;
    lines.push(`${t.greeting(guild.name)}\n${t.intro(version)}`);
    if (!hasChanges) { lines.push(t.noChanges(version)); }
    else {
        if (changes.new.length > 0) { lines.push(`**${t.newHeader}**`); changes.new.forEach(c => { const label = c.isCore ? 'Core Engine' : humanName(c.file); lines.push(`• ${t.newPlugin(label, c.desc)}`); }); lines.push(''); }
        if (changes.fixed.length > 0) { lines.push(`**${t.fixedHeader}**`); changes.fixed.forEach(c => { const label = c.isCore ? 'Core Engine' : humanName(c.file); lines.push(`• ${t.fixedPlugin(label, c.desc)}`); }); lines.push(''); }
        if (changes.improved.length > 0) { lines.push(`**${t.improvedHeader}**`); changes.improved.forEach(c => { const label = c.isCore ? 'Core Engine' : humanName(c.file); lines.push(`• ${t.improvedPlugin(label, c.desc)}`); }); lines.push(''); }
        if (changes.updated.length > 0 && changes.new.length + changes.fixed.length + changes.improved.length === 0) { lines.push(`**${t.updatedHeader}**`); changes.updated.forEach(c => { const label = c.isCore ? 'Core Engine' : humanName(c.file); lines.push(`• ${t.updatedPlugin(label, c.desc)}`); }); lines.push(''); }
        if (changes.removed.length > 0) { lines.push(`**${t.removedHeader}**`); changes.removed.forEach(c => { lines.push(`• ${t.removedPlugin(humanName(c.file))}`); }); lines.push(''); }
    }
    lines.push(pick(t.closing));
    const color = changes.new.length > 0 ? '#00fbff' : changes.fixed.length > 0 ? '#2ecc71' : changes.improved.length > 0 ? '#e67e22' : '#95a5a6';
    return new EmbedBuilder().setColor(color).setAuthor({ name: `🦅 Architect CG-223 • v${version}`, iconURL: guild.client?.user?.displayAvatarURL() || undefined }).setDescription(lines.join('\n')).setFooter({ text: t.footer(version) }).setTimestamp();
}

// ================= MAIN BROADCAST (FIXED ERROR LOGGING) =================
async function autoBroadcast(client) {
    try {
        const version = getVersion(client);
        const log = loadLog();
        if (log.lastVersion === version) { console.log(`[AUTO-BROADCAST] v${version} already broadcast — skipping`); return; }
        const previous = loadSnapshot();
        const current = takeSnapshot();
        const changes = detectRealChanges(current, previous);
        const totalChanges = changes.new.length + changes.fixed.length + changes.improved.length + changes.updated.length + changes.removed.length;
        if (totalChanges === 0) console.log(`[AUTO-BROADCAST] v${version}: No file changes detected — still broadcasting version update`);

        console.log(`[AUTO-BROADCAST] ═══════════════════════════════════════`);
        console.log(`[AUTO-BROADCAST] 🚀 v${version} broadcast starting`);
        console.log(`[AUTO-BROADCAST] Changes: ${changes.new.length} new | ${changes.fixed.length} fixed | ${changes.improved.length} improved | ${changes.updated.length} updated | ${changes.removed.length} removed`);
        console.log(`[AUTO-BROADCAST] Servers: ${client.guilds.cache.size}`);
        console.log(`[AUTO-BROADCAST] ═══════════════════════════════════════`);

        let success = 0, fail = 0;
        const guilds = Array.from(client.guilds.cache.values());

        for (let i = 0; i < guilds.length; i++) {
            const guild = guilds[i];
            try {
                const lang = guild.preferredLocale === 'fr' ? 'fr' : 'en';
                const channel = await findBestChannel(guild, client);
                if (!channel) { console.log(`[AUTO-BROADCAST] ❌ ${guild.name}: No suitable channel found`); fail++; continue; }
                console.log(`[AUTO-BROADCAST] 📡 ${guild.name} → #${channel.name}`);

                const embed = buildEmbed(changes, lang, guild, version);
                await channel.send({ embeds: [embed] });
                success++;

                if ((i + 1) % 10 === 0 || i === guilds.length - 1) console.log(`[AUTO-BROADCAST] Progress: ${i + 1}/${guilds.length} (${success} ok, ${fail} fail)`);
                await new Promise(r => setTimeout(r, 300));
                if ((i + 1) % 10 === 0) await new Promise(r => setTimeout(r, 1500));
            } catch (err) {
                // FIXED: Log the actual error so we know WHY it failed
                console.error(`[AUTO-BROADCAST] ❌ ${guild.name}: ${err.message}`);
                fail++;
            }
        }

        saveSnapshot(current);
        log.lastVersion = version;
        log.lastBroadcastTime = Date.now();
        log.lastStats = { success, fail, total: guilds.length };
        log.lastChanges = { new: changes.new.map(c => humanName(c.file)), fixed: changes.fixed.map(c => humanName(c.file)), improved: changes.improved.map(c => humanName(c.file)) };
        saveLog(log);

        console.log(`[AUTO-BROADCAST] ✅ Complete: ${success} sent, ${fail} failed`);

        try {
            if (process.env.OWNER_ID) {
                const owner = await client.users.fetch(process.env.OWNER_ID).catch(() => null);
                if (owner) {
                    const t = T['en'];
                    const report = new EmbedBuilder().setColor('#2ecc71').setTitle(t.dmTitle).setDescription(t.dmBody(success, fail, guilds.length)).setFooter({ text: `v${version}` }).setTimestamp();
                    await owner.send({ embeds: [report] });
                }
            }
        } catch (e) {}
    } catch (err) { console.error(`[AUTO-BROADCAST] FATAL: ${err.message}`); }
}

async function manualBroadcast(client, targetChannelId = null) {
    try {
        const version = getVersion(client);
        const previous = loadSnapshot();
        const current = takeSnapshot();
        const changes = detectRealChanges(current, previous);
        if (targetChannelId) {
            const channel = await client.channels.fetch(targetChannelId).catch(() => null);
            if (channel) { const embed = buildEmbed(changes, 'en', channel.guild || { name: 'Test' }, version); await channel.send({ embeds: [embed] }); console.log(`[AUTO-BROADCAST] Manual broadcast sent to ${targetChannelId}`); }
        } else {
            const guilds = Array.from(client.guilds.cache.values());
            let success = 0;
            for (const guild of guilds) {
                try {
                    const lang = guild.preferredLocale === 'fr' ? 'fr' : 'en';
                    const channel = await findBestChannel(guild, client);
                    if (channel) { const embed = buildEmbed(changes, lang, guild, version); await channel.send({ embeds: [embed] }); success++; }
                    await new Promise(r => setTimeout(r, 300));
                } catch (e) {}
            }
            console.log(`[AUTO-BROADCAST] Manual broadcast: ${success} servers`);
        }
    } catch (err) { console.error(`[AUTO-BROADCAST] Manual failed: ${err.message}`); }
}

module.exports = { autoBroadcast, manualBroadcast, resetSnapshots, T, findBestChannel, buildEmbed, detectRealChanges, takeSnapshot, getVersion };
