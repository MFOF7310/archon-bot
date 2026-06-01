const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const PLUGIN_DIR = path.join(__dirname);
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SNAPSHOT_FILE = path.join(DATA_DIR, '.changelog_snapshot.json');

// ================= GET VERSION =================
function getVersion() {
    try {
        const vFile = path.join(DATA_DIR, 'version.txt');
        if (fs.existsSync(vFile)) return fs.readFileSync(vFile, 'utf8').trim();
    } catch (e) {}
    try {
        const pkg = path.join(ROOT_DIR, 'package.json');
        if (fs.existsSync(pkg)) return JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
    } catch (e) {}
    return '2.0.0';
}

// ================= FILE SNAPSHOT =================
function takeSnapshot() {
    const snap = { files: {}, timestamp: Date.now() };
    const scanDir = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const file of fs.readdirSync(dir)) {
            if (!file.endsWith('.js')) continue;
            try {
                const fp = path.join(dir, file);
                const content = fs.readFileSync(fp, 'utf8');
                snap.files[file] = {
                    hash: crypto.createHash('md5').update(content).digest('hex'),
                    size: content.length,
                    lines: content.split('\n').length
                };
            } catch (e) {}
        }
    };
    scanDir(PLUGIN_DIR);
    try {
        const idx = path.join(ROOT_DIR, 'index.js');
        if (fs.existsSync(idx)) {
            const c = fs.readFileSync(idx, 'utf8');
            snap.files['index.js'] = {
                hash: crypto.createHash('md5').update(c).digest('hex'),
                size: c.length, lines: c.split('\n').length, isCore: true
            };
        }
    } catch (e) {}
    return snap;
}

function loadSnapshot() {
    try { if (fs.existsSync(SNAPSHOT_FILE)) return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')); }
    catch (e) {}
    return null;
}

function saveSnapshot(snap) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snap, null, 2));
    } catch (e) {}
}

// ================= DETECT CHANGES =================
function detectChanges(current, previous) {
    const changes = { new: [], fixed: [], improved: [], total: 0 };
    if (!previous || !previous.files) return changes;

    for (const [file, data] of Object.entries(current.files)) {
        const prev = previous.files[file];
        
        // New file (didn't exist before)
        if (!prev) {
            changes.new.push(file.replace(/\.js$/, ''));
            continue;
        }
        
        // Skip if no changes
        if (data.hash === prev.hash) continue;

        // File changed - determine type of change
        const diff = data.size - prev.size;
        try {
            const fp = path.join(data.isCore ? ROOT_DIR : PLUGIN_DIR, file);
            const content = fs.readFileSync(fp, 'utf8').toLowerCase();
            
            const fixKeywords = ['fix', 'bug', 'patch', 'repair', 'correct', 'resolve', 'error', 'broken', 'crash'];
            const improveKeywords = ['improve', 'enhance', 'upgrade', 'refactor', 'optimize', 'rebuild', 'rewrite'];
            
            const fixScore = fixKeywords.filter(k => content.includes(k)).length;
            const improveScore = improveKeywords.filter(k => content.includes(k)).length;

            // Classify the change
            if (fixScore > improveScore && fixScore > 0) {
                changes.fixed.push(file.replace(/\.js$/, ''));
            } else if (improveScore > 0 || diff > 100) {
                changes.improved.push(file.replace(/\.js$/, ''));
            } else {
                // Default to improved if we can't determine
                changes.improved.push(file.replace(/\.js$/, ''));
            }
        } catch (e) {
            // If we can't read the file, assume it's improved
            changes.improved.push(file.replace(/\.js$/, ''));
        }
    }
    
    changes.total = changes.new.length + changes.fixed.length + changes.improved.length;
    return changes;
}

// ================= LIVE SYSTEM STATS =================
function getLiveStats(client) {
    const uptimeSec = process.uptime();
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const wsPing = client.ws.ping || 0;
    const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const totalUsers = client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0);

    return {
        uptime: `${days}d ${hours}h ${mins}m`,
        ping: wsPing,
        pingEmoji: wsPing < 100 ? '🟢' : wsPing < 200 ? '🟡' : '🔴',
        memory: `${memMB} MB`,
        commands: client.commands?.size || 0,
        aliases: client.aliases?.size || 0,
        guilds: client.guilds.cache.size,
        users: totalUsers.toLocaleString(),
        version: getVersion(),
        node: process.version,
        platform: process.platform,
        plugins: Object.keys(takeSnapshot().files).length
    };
}

// ================= BUILD CHANGELOG =================
function buildChangelog(client) {
    const current = takeSnapshot();
    const previous = loadSnapshot();
    const changes = detectChanges(current, previous);
    const s = getLiveStats(client);

    // Save snapshot for next comparison
    saveSnapshot(current);

    let sections = [];

    // System stats section
    sections.push(
        `## 📊 System Status`,
        ``,
        `| Metric | Value | Status |`,
        `|--------|-------|--------|`,
        `| ⏱️ Uptime | ${s.uptime} | 🟢 |`,
        `| 📡 WebSocket Ping | ${s.ping}ms | ${s.pingEmoji} |`,
        `| 💾 Memory | ${s.memory} | 🟢 |`,
        `| ⚡ Commands | ${s.commands} | — |`,
        `| 🔀 Aliases | ${s.aliases} | — |`,
        `| 🌍 Servers | ${s.guilds} | — |`,
        `| 👥 Users | ${s.users} | — |`,
        `| 🔌 Plugins | ${s.plugins} | — |`,
        `| 🟢 Node.js | ${s.node} | — |`,
        ``
    );

    // Dynamic changes section
    if (changes.total > 0) {
        sections.push(`## 📝 Changes Since Last Version`);
        if (changes.new.length > 0) {
            sections.push(``, `### 🆕 New`, ...changes.new.map(n => `- **${n}** — Added`));
        }
        if (changes.fixed.length > 0) {
            sections.push(``, `### 🔧 Fixed`, ...changes.fixed.map(n => `- **${n}** — Bug fixes`));
        }
        if (changes.improved.length > 0) {
            sections.push(``, `### ⚡ Improved`, ...changes.improved.map(n => `- **${n}** — Enhancements`));
        }
    } else {
        sections.push(
            `## 📝 Changes`,
            ``,
            `_No file changes detected since last snapshot. All systems operational._`
        );
    }

    sections.push(
        ``,
        `---`,
        `*Generated dynamically • v${s.version} • ${new Date().toISOString().slice(0, 10)}*`
    );

    return { text: sections.join('\n'), stats: s, changes };
}

// ================= TRANSLATIONS =================
const T = {
    en: {
        title: '📋 System Changelog',
        stats: '📊 Live Stats',
        changes: '📝 Recent Changes',
        newCmds: '🆕 Commands',
        footer: 'Dynamically generated • .changelog',
        noChanges: 'No changes detected since last version. All systems operational.',
        version: 'Version',
        uptime: 'Uptime',
        ping: 'Ping',
        memory: 'Memory',
        servers: 'Servers',
        users: 'Users',
        plugins: 'Plugins',
        updated: 'Updated just now'
    },
    fr: {
        title: '📋 Journal Système',
        stats: '📊 Statistiques',
        changes: '📝 Changements Récents',
        newCmds: '🆕 Commandes',
        footer: 'Généré dynamiquement • .changelog',
        noChanges: 'Aucun changement détecté depuis la dernière version. Tous les systèmes opérationnels.',
        version: 'Version',
        uptime: 'Disponibilité',
        ping: 'Latence',
        memory: 'Mémoire',
        servers: 'Serveurs',
        users: 'Utilisateurs',
        plugins: 'Plugins',
        updated: 'Mis à jour à l\'instant'
    }
};

// ================= MODULE =================
module.exports = {
    name: 'changelog',
    aliases: ['changes', 'updates', 'version', 'patch', 'misesajour', 'maj'],
    description: '📋 Auto-generated changelog with live system stats — no hardcoded values',
    category: 'SYSTEM',
    usage: '.changelog',
    cooldown: 5000,

    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('📋 View live system changelog'),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = T[lang] || T['en'];
        const prefix = serverSettings?.prefix || '.';
        const guildName = message.guild?.name || 'DM';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();

        // Build dynamic changelog
        const { stats, changes } = buildChangelog(client);

        const embed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
            .setTitle(`🦅 ARCHITECT CG-223 • v${stats.version}`)
            .setURL('https://kimi-repo-fixes.pages.dev/')
            .setDescription(t.updated)
            .addFields(
                {
                    name: `⏱️ ${t.uptime}`,
                    value: `\`\`\`\n${stats.uptime}\n\`\`\``,
                    inline: true
                },
                {
                    name: `📡 ${t.ping}`,
                    value: `${stats.pingEmoji} \`${stats.ping}ms\``,
                    inline: true
                },
                {
                    name: `💾 ${t.memory}`,
                    value: `\`${stats.memory}\``,
                    inline: true
                },
                {
                    name: `🌍 ${t.servers}`,
                    value: `\`${stats.guilds}\``,
                    inline: true
                },
                {
                    name: `👥 ${t.users}`,
                    value: `\`${stats.users}\``,
                    inline: true
                },
                {
                    name: `🔌 ${t.plugins}`,
                    value: `\`${stats.plugins}\``,
                    inline: true
                }
            )
            .setFooter({
                text: `${guildName} • ${t.footer} • v${stats.version}`,
                iconURL: guildIcon
            })
            .setTimestamp();

        // Changes section
        if (changes.total > 0) {
            if (changes.new.length > 0) {
                embed.addFields({
                    name: `🆕 New (${changes.new.length})`,
                    value: changes.new.map(c => `• \`${c}\``).join('\n') || '—',
                    inline: false
                });
            }
            if (changes.fixed.length > 0) {
                embed.addFields({
                    name: `🔧 Fixed (${changes.fixed.length})`,
                    value: changes.fixed.map(c => `• \`${c}\``).join('\n') || '—',
                    inline: false
                });
            }
            if (changes.improved.length > 0) {
                embed.addFields({
                    name: `⚡ Improved (${changes.improved.length})`,
                    value: changes.improved.map(c => `• \`${c}\``).join('\n') || '—',
                    inline: false
                });
            }
        } else {
            embed.addFields({
                name: t.changes,
                value: t.noChanges,
                inline: false
            });
        }

        // Quick commands
        embed.addFields({
            name: t.newCmds,
            value: `\`${prefix}help\` • \`${prefix}changelog\` • \`${prefix}lydia\` • \`${prefix}ticket\``,
            inline: false
        });

        return message.reply({ embeds: [embed] });
    },

    execute: async (interaction, client) => {
    // FIXED: Defer reply immediately to prevent "Unknown Integration" errors
    await interaction.deferReply();
    
    const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
    const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';

    const fakeMessage = {
        author: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel,
        reply: async (options) => {
            // Always use editReply since we deferred
            return interaction.editReply(options);
        },
        react: () => Promise.resolve()
    };

    await module.exports.run(client, fakeMessage, [], client.db, serverSettings, lang === 'fr' ? 'misesajour' : 'changelog');
  }
};