const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const PLUGIN_DIR = path.join(__dirname);
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SNAPSHOT_FILE = path.join(DATA_DIR, '.changelog_snapshot.json');

// ================= POLICE/INTEL COLOR ENGINE — DYNAMIC PER TRIGGER =================
const COLOR_THEMES = [
  { name: 'NEURAL BLUE',   hex: '#00d4ff', emoji: '🔵', style: 'Cyber Intelligence' },
  { name: 'TACTICAL AMBER', hex: '#f39c12', emoji: '🟠', style: 'Field Operations' },
  { name: 'STEALTH PURPLE', hex: '#9b59b6', emoji: '🟣', style: 'Covert Ops' },
  { name: 'ALERT CRIMSON',  hex: '#e74c3c', emoji: '🔴', style: 'Threat Response' },
  { name: 'GUARDIAN GREEN', hex: '#2ecc71', emoji: '🟢', style: 'Security Protocol' },
  { name: 'DEEP SPACE',     hex: '#1a1a2e', emoji: '⚫', style: 'Dark Operations' },
  { name: 'GOLDEN EYE',     hex: '#ffd700', emoji: '🟡', style: 'Surveillance' },
  { name: 'FROST WHITE',    hex: '#ecf0f1', emoji: '⚪', style: 'Arctic Protocol' }
];

let lastThemeIndex = -1;

function getRandomTheme() {
  let idx;
  do { idx = Math.floor(Math.random() * COLOR_THEMES.length); }
  while (idx === lastThemeIndex && COLOR_THEMES.length > 1);
  lastThemeIndex = idx;
  return COLOR_THEMES[idx];
}

// ================= INTELLIGENCE CLASSIFICATION ENGINE =================
function classifyChange(fileName, content = '') {
  const lower = content.toLowerCase();
  const name = fileName.toLowerCase();

  const classifications = {
    CRITICAL: {
      keywords: ['crash', 'fatal', 'security', 'breach', 'exploit', 'leak', 'token', 'password', 'secret'],
      emoji: '🔴', badge: 'CRITICAL', color: '#ff4757'
    },
    SECURITY: {
      keywords: ['auth', 'permission', 'admin', 'moderator', 'ban', 'kick', 'mute', 'warn', 'automod', 'shield'],
      emoji: '🛡️', badge: 'SECURITY', color: '#e74c3c'
    },
    PERFORMANCE: {
      keywords: ['optimize', 'cache', 'speed', 'fast', 'slow', 'memory', 'leak', 'batch', 'flush'],
      emoji: '⚡', badge: 'PERFORMANCE', color: '#f39c12'
    },
    FEATURE: {
      keywords: ['new', 'add', 'create', 'implement', 'introduce', 'launch', 'deploy'],
      emoji: '✨', badge: 'FEATURE', color: '#2ecc71'
    },
    FIX: {
      keywords: ['fix', 'bug', 'patch', 'repair', 'correct', 'resolve', 'error', 'broken'],
      emoji: '🔧', badge: 'PATCH', color: '#3498db'
    },
    REFACTOR: {
      keywords: ['refactor', 'rewrite', 'rebuild', 'restructure', 'clean', 'improve', 'enhance', 'upgrade'],
      emoji: '🔄', badge: 'REFACTOR', color: '#9b59b6'
    },
    UI: {
      keywords: ['embed', 'color', 'style', 'layout', 'design', 'ui', 'ux', 'interface', 'visual', 'banner'],
      emoji: '🎨', badge: 'UI/UX', color: '#e91e63'
    },
    DATABASE: {
      keywords: ['sql', 'db', 'database', 'table', 'column', 'schema', 'migration', 'sqlite', 'query'],
      emoji: '💾', badge: 'DATABASE', color: '#00bcd4'
    },
    AI: {
      keywords: ['lydia', 'ai', 'neural', 'model', 'gpt', 'llm', 'openrouter', 'prompt', 'memory'],
      emoji: '🧠', badge: 'NEURAL', color: '#9b59b6'
    }
  };

  for (const [type, data] of Object.entries(classifications)) {
    if (data.keywords.some(k => lower.includes(k) || name.includes(k))) {
      return { type, ...data };
    }
  }
  return { type: 'GENERAL', emoji: '📦', badge: 'GENERAL', color: '#95a5a6' };
}

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
    const changes = { new: [], fixed: [], improved: [], critical: [], security: [], ai: [], database: [], ui: [], total: 0 };
    if (!previous || !previous.files) return changes;

    for (const [file, data] of Object.entries(current.files)) {
        const prev = previous.files[file];

        if (!prev) {
            const classification = classifyChange(file, '');
            changes.new.push({ file: file.replace(/\.js$/, ''), classification });
            continue;
        }

        if (data.hash === prev.hash) continue;

        const diff = data.size - prev.size;
        try {
            const fp = path.join(data.isCore ? ROOT_DIR : PLUGIN_DIR, file);
            const content = fs.readFileSync(fp, 'utf8').toLowerCase();
            const classification = classifyChange(file, content);

            if (classification.type === 'CRITICAL') changes.critical.push({ file: file.replace(/\.js$/, ''), classification, diff });
            else if (classification.type === 'SECURITY') changes.security.push({ file: file.replace(/\.js$/, ''), classification, diff });
            else if (classification.type === 'AI') changes.ai.push({ file: file.replace(/\.js$/, ''), classification, diff });
            else if (classification.type === 'DATABASE') changes.database.push({ file: file.replace(/\.js$/, ''), classification, diff });
            else if (classification.type === 'UI') changes.ui.push({ file: file.replace(/\.js$/, ''), classification, diff });
            else if (classification.type === 'FIX') changes.fixed.push({ file: file.replace(/\.js$/, ''), classification, diff });
            else changes.improved.push({ file: file.replace(/\.js$/, ''), classification, diff });

        } catch (e) {
            changes.improved.push({ file: file.replace(/\.js$/, ''), classification: classifyChange(file, ''), diff });
        }
    }

    changes.total = Object.values(changes).filter(v => Array.isArray(v)).reduce((a, b) => a + b.length, 0);
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
        uptimeRaw: uptimeSec,
        ping: wsPing,
        pingEmoji: wsPing < 100 ? '🟢' : wsPing < 200 ? '🟡' : '🔴',
        pingStatus: wsPing < 100 ? 'OPTIMAL' : wsPing < 200 ? 'ACCEPTABLE' : 'DEGRADED',
        memory: `${memMB} MB`,
        memoryStatus: parseFloat(memMB) < 100 ? 'HEALTHY' : parseFloat(memMB) < 300 ? 'ELEVATED' : 'CRITICAL',
        commands: client.commands?.size || 0,
        aliases: client.aliases?.size || 0,
        guilds: client.guilds.cache.size,
        users: totalUsers.toLocaleString(),
        version: getVersion(),
        node: process.version,
        platform: process.platform,
        plugins: Object.keys(takeSnapshot().files).length,
        timestamp: Date.now()
    };
}

// ================= INTELLIGENCE REPORT BUILDER =================
function buildIntelligenceReport(client, theme) {
    const current = takeSnapshot();
    const previous = loadSnapshot();
    const changes = detectChanges(current, previous);
    const stats = getLiveStats(client);

    saveSnapshot(current);

    const embed = new EmbedBuilder()
        .setColor(theme.hex)
        .setAuthor({
            name: theme.emoji + ' ARCHITECT CG-223 // INTELLIGENCE DIVISION',
            iconURL: client.user?.displayAvatarURL()
        })
        .setTitle('🦅 SYSTEM BRIEFING — ' + theme.style.toUpperCase())
        .setDescription(
            '```ansi\n' +
            '\u001b[1;36m╔══════════════════════════════════════════╗\u001b[0m\n' +
            '\u001b[1;36m║\u001b[0m  \u001b[1;33mCLASSIFICATION: ' + theme.name + '\u001b[0m              \u001b[1;36m║\u001b[0m\n' +
            '\u001b[1;36m║\u001b[0m  \u001b[1;32mCLEARANCE: ARCHITECT-LEVEL\u001b[0m             \u001b[1;36m║\u001b[0m\n' +
            '\u001b[1;36m║\u001b[0m  \u001b[1;35mORIGIN: BAMAKO_223 NODE 🇲🇱\u001b[0m           \u001b[1;36m║\u001b[0m\n' +
            '\u001b[1;36m╚══════════════════════════════════════════╝\u001b[0m\n' +
            '```'
        )
        .setThumbnail(client.user?.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({
            text: 'ARCHITECT CG-223 • v' + stats.version + ' • ' + theme.style + ' • ' + new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Bamako', hour12: false }) + ' UTC',
            iconURL: client.user?.displayAvatarURL()
        })
        .setTimestamp();

    // === OPERATIONAL STATUS ===
    embed.addFields(
        { name: '⏱️ UPTIME', value: '```\n' + stats.uptime + '\n```', inline: true },
        { name: '📡 PING ' + stats.pingEmoji, value: '```' + stats.ping + 'ms — ' + stats.pingStatus + '\n```', inline: true },
        { name: '💾 MEMORY', value: '```' + stats.memory + ' — ' + stats.memoryStatus + '\n```', inline: true },
        { name: '🌍 SERVERS', value: '```\n' + stats.guilds + '\n```', inline: true },
        { name: '👥 USERS', value: '```\n' + stats.users + '\n```', inline: true },
        { name: '🔌 PLUGINS', value: '```\n' + stats.plugins + '\n```', inline: true }
    );

    // === COMMAND MATRIX ===
    embed.addFields({
        name: '⚡ COMMAND MATRIX',
        value: '```yaml\n' +
               'Commands:    ' + stats.commands.toString().padStart(3) + '\n' +
               'Aliases:     ' + stats.aliases.toString().padStart(3) + '\n' +
               'Node:        ' + stats.node + '\n' +
               'Platform:    ' + stats.platform + '\n' +
               '```',
        inline: false
    });

    // === THREAT/CHANGE ANALYSIS ===
    if (changes.total > 0) {
        const sections = [];

        if (changes.critical.length > 0) {
            sections.push('🔴 **CRITICAL (' + changes.critical.length + ')**');
            changes.critical.forEach(c => {
                sections.push('  ' + c.classification.emoji + ' `' + c.file + '` — ' + c.classification.badge);
            });
        }

        if (changes.security.length > 0) {
            sections.push('🛡️ **SECURITY (' + changes.security.length + ')**');
            changes.security.forEach(c => {
                sections.push('  ' + c.classification.emoji + ' `' + c.file + '` — ' + c.classification.badge);
            });
        }

        if (changes.ai.length > 0) {
            sections.push('🧠 **NEURAL (' + changes.ai.length + ')**');
            changes.ai.forEach(c => {
                sections.push('  ' + c.classification.emoji + ' `' + c.file + '` — ' + c.classification.badge);
            });
        }

        if (changes.database.length > 0) {
            sections.push('💾 **DATABASE (' + changes.database.length + ')**');
            changes.database.forEach(c => {
                sections.push('  ' + c.classification.emoji + ' `' + c.file + '` — ' + c.classification.badge);
            });
        }

        if (changes.ui.length > 0) {
            sections.push('🎨 **UI/UX (' + changes.ui.length + ')**');
            changes.ui.forEach(c => {
                sections.push('  ' + c.classification.emoji + ' `' + c.file + '` — ' + c.classification.badge);
            });
        }

        if (changes.fixed.length > 0) {
            sections.push('🔧 **PATCHED (' + changes.fixed.length + ')**');
            changes.fixed.forEach(c => {
                sections.push('  ' + c.classification.emoji + ' `' + c.file + '` — ' + c.classification.badge + (c.diff > 0 ? ' +' + c.diff + 'b' : ''));
            });
        }

        if (changes.improved.length > 0) {
            sections.push('⚡ **ENHANCED (' + changes.improved.length + ')**');
            changes.improved.forEach(c => {
                sections.push('  ' + c.classification.emoji + ' `' + c.file + '` — ' + c.classification.badge + (c.diff > 0 ? ' +' + c.diff + 'b' : ''));
            });
        }

        if (changes.new.length > 0) {
            sections.push('✨ **NEW ASSETS (' + changes.new.length + ')**');
            changes.new.forEach(c => {
                sections.push('  ' + c.classification.emoji + ' `' + c.file + '` — ' + c.classification.badge);
            });
        }

        embed.addFields({
            name: '📊 THREAT ANALYSIS — ' + changes.total + ' DETECTED',
            value: sections.join('\n'),
            inline: false
        });
    } else {
        embed.addFields({
            name: '📊 THREAT ANALYSIS',
            value: '```ansi\n\u001b[1;32m[ ALL CLEAR ]\u001b[0m\n\u001b[32mNo file changes detected.\nSystems operating at nominal capacity.\u001b[0m\n```',
            inline: false
        });
    }

    // === QUICK ACCESS ===
    embed.addFields({
        name: '🎯 QUICK ACCESS',
        value: '`.help` • `.changelog` • `.lydia` • `.ticket` • `.profile` • `.market`',
        inline: false
    });

    return { embed, stats, changes, theme };
}

// ================= TRANSLATIONS =================
const T = {
    en: {
        title: '📋 Intelligence Briefing',
        stats: '📊 Operational Status',
        changes: '📝 Change Analysis',
        newCmds: '🆕 Command Access',
        footer: 'Dynamically generated • .changelog',
        noChanges: 'No changes detected. All systems nominal.',
        version: 'Version',
        uptime: 'Uptime',
        ping: 'Ping',
        memory: 'Memory',
        servers: 'Servers',
        users: 'Users',
        plugins: 'Plugins',
        updated: 'Briefing updated'
    },
    fr: {
        title: '📋 Briefing Intelligence',
        stats: '📊 Statut Opérationnel',
        changes: '📝 Analyse des Changements',
        newCmds: '🆕 Accès Commandes',
        footer: 'Généré dynamiquement • .changelog',
        noChanges: 'Aucun changement détecté. Tous les systèmes nominaux.',
        version: 'Version',
        uptime: 'Disponibilité',
        ping: 'Latence',
        memory: 'Mémoire',
        servers: 'Serveurs',
        users: 'Utilisateurs',
        plugins: 'Plugins',
        updated: 'Briefing mis à jour'
    }
};

// ================= MODULE =================
module.exports = {
    name: 'changelog',
    aliases: ['changes', 'updates', 'version', 'patch', 'misesajour', 'maj', 'briefing', 'intel'],
    description: '📋 Auto-generated intelligence briefing with dynamic police styling — random color per trigger, smart classification',
    category: 'SYSTEM',
    usage: '.changelog',
    cooldown: 5000,

    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('📋 View live intelligence briefing'),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = T[lang] || T['en'];
        const prefix = serverSettings?.prefix || '.';
        const guildName = message.guild?.name || 'DM';
        const guildIcon = message.guild?.iconURL() || client.user?.displayAvatarURL();

        // 🎨 RANDOM THEME PER TRIGGER
        const theme = getRandomTheme();

        const { embed, stats, changes } = buildIntelligenceReport(client, theme);

        // Dynamic alert override
        if (changes.critical.length > 0) {
            embed.setTitle('🚨 CRITICAL ALERT — ' + theme.style.toUpperCase());
            embed.setColor('#ff4757');
        } else if (changes.security.length > 0) {
            embed.setTitle('🛡️ SECURITY BRIEFING — ' + theme.style.toUpperCase());
            embed.setColor('#e74c3c');
        }

        return message.reply({ embeds: [embed] });
    },

    execute: async (interaction, client) => {
        await interaction.deferReply();

        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';

        // 🎨 RANDOM THEME PER TRIGGER
        const theme = getRandomTheme();

        const { embed, stats, changes } = buildIntelligenceReport(client, theme);

        if (changes.critical.length > 0) {
            embed.setTitle('🚨 CRITICAL ALERT — ' + theme.style.toUpperCase());
            embed.setColor('#ff4757');
        } else if (changes.security.length > 0) {
            embed.setTitle('🛡️ SECURITY BRIEFING — ' + theme.style.toUpperCase());
            embed.setColor('#e74c3c');
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
