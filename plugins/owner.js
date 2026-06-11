const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '🛰️ ARCHITECT CG-223 | EXECUTIVE HUB',
        description: 'Community management and support frequency active.',
        facebook: 'Facebook',
        facebookDesc: 'Community Hub',
        tiktok: 'TikTok',
        tiktokDesc: 'Live Streams & Clips',
        instagram: 'Instagram',
        instagramDesc: 'Gameplay Intel',
        discord: 'Discord',
        discordDesc: 'Join our Server',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Direct Support',
        github: 'GitHub',
        githubDesc: 'Open Source',
        node: 'Node',
        status: 'Status',
        active: 'ACTIVE',
        footer: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY',
        securityBreach: '⛔ **SECURITY BREACH:** Executive Hub restricted to system Owner.',
        accessGranted: '🔓 **ACCESS GRANTED:** Welcome, Architect.',
        quickLinks: 'QUICK LINKS',
        socialLinks: 'SOCIAL LINKS',
        systemControls: '⚙️ SYSTEM CONTROLS',
        sysStatus: 'System Status',
        sysRestart: 'Restart Engine',
        sysBackup: 'Database Backup',
        sysLogs: 'View Logs',
        restarting: '🔄 Restarting engine...',
        backupRunning: '💾 Running database backup...',
        backupDone: '✅ Backup completed',
        backupFailed: '❌ Backup failed'
    },
    fr: {
        title: '🛰️ ARCHITECT CG-223 | HUB EXÉCUTIF',
        description: 'Gestion communautaire et fréquence de support active.',
        facebook: 'Facebook',
        facebookDesc: 'Hub Communautaire',
        tiktok: 'TikTok',
        tiktokDesc: 'Streams & Clips',
        instagram: 'Instagram',
        instagramDesc: 'Intel Gameplay',
        discord: 'Discord',
        discordDesc: 'Rejoindre le Serveur',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Support Direct',
        github: 'GitHub',
        githubDesc: 'Open Source',
        node: 'Nœud',
        status: 'Statut',
        active: 'ACTIF',
        footer: 'EAGLE COMMUNITY • SOUVERAINETÉ NUMÉRIQUE',
        securityBreach: '⛔ **VIOLATION DE SÉCURITÉ:** Hub Exécutif réservé au Propriétaire.',
        accessGranted: '🔓 **ACCÈS AUTORISÉ:** Bienvenue, Architecte.',
        quickLinks: 'LIENS RAPIDES',
        socialLinks: 'LIENS SOCIAUX',
        systemControls: '⚙️ CONTRÔLES SYSTÈME',
        sysStatus: 'Statut Système',
        sysRestart: 'Redémarrer',
        sysBackup: 'Sauvegarde DB',
        sysLogs: 'Voir Logs',
        restarting: '🔄 Redémarrage...',
        backupRunning: '💾 Sauvegarde en cours...',
        backupDone: '✅ Sauvegarde terminée',
        backupFailed: '❌ Échec sauvegarde'
    }
};

// ================= SUBCOMMAND ROUTER =================
async function handleSystemCommand(client, interaction, subcommand, args, lang) {
    const t = translations[lang];
    const ARCHITECT_ID = process.env.OWNER_ID;
    const userId = interaction?.user?.id || interaction?.author?.id;

    // ── STATUS ──
    if (subcommand === 'status') {
        const uptime = process.uptime();
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const s = Math.floor(uptime % 60);

        const embed = new EmbedBuilder()
            .setTitle(`🦅 ${t.sysStatus}`)
            .setColor('#06b6d4')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '⏱️ Uptime', value: `${h}h ${m}m ${s}s`, inline: true },
                { name: '📊 Servers', value: `${client.guilds.cache.size}`, inline: true },
                { name: '👥 Users', value: `${client.users.cache.size}`, inline: true },
                { name: '🏓 Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
                { name: '💾 Memory', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`, inline: true },
                { name: '🖥️ System', value: `${os.platform()} | Node ${process.version}`, inline: true },
                { name: '🔐 Database', value: client.db ? '✅ Connected' : '❌ Disconnected', inline: true },
                { name: '🌐 Dashboard', value: 'Port 3000', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Archon Engine • Bamako, Mali 🇲🇱' });

        return { embeds: [embed] };
    }

    // ── RESTART ──
    if (subcommand === 'restart') {
        console.log(`\x1b[33m[OWNER]\x1b[0m Restart initiated by user ${userId}`);
        setTimeout(() => process.exit(0), 1000);
        return { content: t.restarting };
    }

    // ── BACKUP ──
    if (subcommand === 'backup') {
        return new Promise((resolve) => {
            exec('node scripts/backup.js', { cwd: process.cwd() }, (error, stdout, stderr) => {
                if (error) {
                    resolve({ content: `${t.backupFailed}:\n\`\`\`${error.message.slice(0, 500)}\`\`\`` });
                } else {
                    const output = stdout || stderr;
                    resolve({ content: `${t.backupDone}:\n\`\`\`${output.slice(-1500)}\`\`\`` });
                }
            });
        });
    }

    // ── LOGS ──
    if (subcommand === 'logs') {
        const lines = Math.min(args || 20, 100);
        const logDir = path.join(process.cwd(), 'logs');
        let logOutput = 'No log files found.';

        if (fs.existsSync(logDir)) {
            const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
            if (files.length > 0) {
                const latest = files.sort().reverse()[0];
                try {
                    const content = fs.readFileSync(path.join(logDir, latest), 'utf8');
                    logOutput = content.split('\n').slice(-lines).join('\n') || 'Empty log.';
                } catch (err) {
                    logOutput = `Error: ${err.message}`;
                }
            }
        }

        return { content: `📋 Last ${lines} lines:\n\`\`\`${logOutput.slice(-1900)}\`\`\``, ephemeral: true };
    }

    return null;
}

module.exports = {
    name: 'owner',
    aliases: ['exec', 'admin', 'architect', 'hub', 'proprietaire', 'adminhub'],
    description: '👑 Executive links and system hub (restricted to owner).',
    category: 'OWNER',
    cooldown: 3000,
    usage: '.owner [status|restart|backup|logs]',
    examples: ['.owner', '.owner status', '.owner restart', '.owner backup', '.owner logs 30'],

    // ================= SLASH COMMAND DATA (ENHANCED) =================
    data: new SlashCommandBuilder()
        .setName('owner')
        .setDescription('👑 Executive hub & system controls (owner only)')
        .addSubcommand(sub => sub.setName('hub').setDescription('Social links & community hub'))
        .addSubcommand(sub => sub.setName('status').setDescription('System health & performance'))
        .addSubcommand(sub => sub.setName('restart').setDescription('Restart the engine (auto-recovers)'))
        .addSubcommand(sub => sub.setName('backup').setDescription('Run database backup'))
        .addSubcommand(sub => 
            sub.setName('logs')
               .setDescription('View recent console logs')
               .addIntegerOption(opt => opt.setName('lines').setDescription('Lines (default: 20)').setRequired(false))),

    // ================= PREFIX HANDLER =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const ARCHITECT_ID = process.env.OWNER_ID;

        // Security
        if (message.author.id !== ARCHITECT_ID) {
            console.log(`[SECURITY] Unauthorized by ${message.author.tag}`);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.securityBreach)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }

        const subcommand = args[0]?.toLowerCase();

        // ── SYSTEM SUBCOMMANDS ──
        if (['status', 'restart', 'backup', 'logs'].includes(subcommand)) {
            const logLines = subcommand === 'logs' ? parseInt(args[1]) || 20 : undefined;
            const result = await handleSystemCommand(client, message, subcommand, logLines, lang);
            return message.reply(result).catch(() => {});
        }

        // ── DEFAULT: SOCIAL HUB ──
        const socialLinks = {
            facebook: 'https://www.facebook.com/share/17KysmJrtm/',
            tiktok: 'https://www.tiktok.com/@cloudgaming223',
            instagram: 'https://www.instagram.com/mfof7310',
            discord: 'https://discord.gg/NFSMFJajp9',
            whatsapp: 'https://wa.me/15485200518',
            github: 'https://github.com/MFOF7310'
        };

        const ownerEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
            .setTitle(`👑 ${t.accessGranted}`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(
                `\`\`\`yaml\n${t.node}: BAMAKO-223\n${t.status}: ${t.active}\nCore: Groq LPU™ 70B\n\`\`\`\n*${t.description}*\n\n` +
                `**${t.systemControls}:** \`.owner status\` • \`.owner restart\` • \`.owner backup\` • \`.owner logs\``
            )
            .addFields(
                { name: `🔵 ${t.facebook}`, value: `\`${t.facebookDesc}\``, inline: true },
                { name: `🎬 ${t.tiktok}`, value: `\`${t.tiktokDesc}\``, inline: true },
                { name: `📸 ${t.instagram}`, value: `\`${t.instagramDesc}\``, inline: true },
                { name: `🎮 ${t.discord}`, value: `\`${t.discordDesc}\``, inline: true },
                { name: `💬 ${t.whatsapp}`, value: `\`${t.whatsappDesc}\``, inline: true },
                { name: `💻 ${t.github}`, value: `\`${t.githubDesc}\``, inline: true }
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel(t.facebook).setURL(socialLinks.facebook).setStyle(ButtonStyle.Link).setEmoji('🔵'),
            new ButtonBuilder().setLabel(t.tiktok).setURL(socialLinks.tiktok).setStyle(ButtonStyle.Link).setEmoji('🎬'),
            new ButtonBuilder().setLabel(t.instagram).setURL(socialLinks.instagram).setStyle(ButtonStyle.Link).setEmoji('📸')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel(t.discord).setURL(socialLinks.discord).setStyle(ButtonStyle.Link).setEmoji('🎮'),
            new ButtonBuilder().setLabel(t.whatsapp).setURL(socialLinks.whatsapp).setStyle(ButtonStyle.Link).setEmoji('💬'),
            new ButtonBuilder().setLabel(t.github).setURL(socialLinks.github).setStyle(ButtonStyle.Link).setEmoji('💻')
        );

        await message.reply({ embeds: [ownerEmbed], components: [row1, row2] }).catch(() => {});
        console.log(`[OWNER] ${message.author.tag} accessed hub | Lang: ${lang}`);
    },

    // ================= SLASH HANDLER =================
    execute: async (interaction, client) => {
        const ARCHITECT_ID = process.env.OWNER_ID;
        const lang = client.detectLanguage ? client.detectLanguage('owner', 'en') : 'en';
        const t = translations[lang];

        if (interaction.user.id !== ARCHITECT_ID) {
            return interaction.reply({ content: t.securityBreach, ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        // System subcommands
        if (['status', 'restart', 'backup', 'logs'].includes(subcommand)) {
            const logLines = subcommand === 'logs' ? interaction.options.getInteger('lines') || 20 : undefined;
            const result = await handleSystemCommand(client, interaction, subcommand, logLines, lang);
            if (interaction.deferred) return interaction.editReply(result);
            return interaction.reply(result);
        }

        // Default: Hub
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (options) => {
                if (interaction.deferred) return interaction.editReply(options);
                return interaction.reply(options);
            }
        };

        await module.exports.run(client, fakeMessage, [], client.db, { prefix: '.' }, 'owner');
    }
};