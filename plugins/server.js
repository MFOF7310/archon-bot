const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["scanning", "author", "commander", "established", "sectorId", "populationMetrics", "total", "voice", "active", "roles", "networkGrid", "tier", "node", "uptime", "stable", "boostSync", "securityProtocols", "verification", "integrity", "synchronized", "anniversaryTitle", "anniversaryAlert", "anniversaryProtocol", "anniversaryDesc", "maxLevel", "channels", "text", "category", "emojis", "stickers", "footer"];
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`server.${k}`, lang);
    return o;
}

// ================= HELPER FUNCTIONS =================
function getVerificationLevel(level) {
    const levels = {
        0: 'NONE',
        1: 'LOW',
        2: 'MEDIUM',
        3: 'HIGH',
        4: 'VERY_HIGH'
    };
    return levels[level] || 'UNKNOWN';
}

function createBoostBar(current, target, t) {
    if (target === 'MAX') return `◈ \u001b[1;35m${t.maxLevel}\u001b[0m ◈`;
    const filled = Math.min(Math.round((10 * current) / target), 10);
    return '▰'.repeat(filled) + '▱'.repeat(10 - filled) + ` ${current}/${target}`;
}

module.exports = {
    name: 'server',
    aliases: ['si', 'sector', 'guild', 'serveur', 'info', 'infos'],
    description: '📊 Execute a deep-scan of the current Sector intelligence and age.',
    category: 'SYSTEM',
    cooldown: 5000,
    usage: '.server',
    examples: ['.server', '.serveur', '.sector'],

// ================= SLASH COMMAND DATA =================
data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('📊 Execute a deep-scan of the current Sector intelligence / Analyser le secteur actuel'),

// 🔥 NEW SIGNATURE: 6 parameters with usedCommand
run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
    const guildId = message.guild?.id ?? 'DM';
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        lang = (client.detectLanguage ? client.detectLanguage('server', guildId) : 'en') || 'en';
        
        
        const t = loadT(lang);
        const version = client.version || '1.6.0';
        const { guild } = message;
        const icon = guild.iconURL({ dynamic: true, size: 512 }) || client.user.displayAvatarURL();

        // ================= TEMPORAL ANNIVERSARY LOGIC =================
        const now = new Date();
        const created = new Date(guild.createdTimestamp);
        const isAnniversary = now.getMonth() === created.getMonth() && now.getDate() === created.getDate();
        const sectorAge = now.getFullYear() - created.getFullYear();

        // ================= TELEMETRY CALCULATIONS =================
        const boostCount = guild.premiumSubscriptionCount || 0;
        const boostTier = guild.premiumTier;
        const voiceAgents = guild.members.cache.filter(m => m.voice.channel).size;
        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;
        const emojiCount = guild.emojis.cache.size;
        const stickerCount = guild.stickers.cache.size;
        
        const tierRequirements = { 0: 2, 1: 7, 2: 14, 3: 'MAX' };
        const nextReq = tierRequirements[boostTier];
        const boostBar = createBoostBar(boostCount, nextReq, t);

        // ================= DYNAMIC THEMING =================
        const systemColor = isAnniversary ? '#f1c40f' : '#00fbff';
        const systemTitle = isAnniversary 
            ? i18n.t('server.anniversaryTitle', lang, { years: sectorAge })
            : `─ ARCHITECT GUILD TELEMETRY ─`;

        // ================= MAIN EMBED =================
        const serverEmbed = new EmbedBuilder()
            .setColor(systemColor)
            .setAuthor({ name: i18n.t('server.author', lang, { name: guild.name.toUpperCase() }), iconURL: icon })
            .setTitle(systemTitle)
            .setThumbnail(icon)
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.commander}: ${guild.members.cache.get(guild.ownerId)?.user.username || 'Unknown'}\n` +
                `${t.established}: ${new Date(guild.createdTimestamp).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}\n` +
                `${t.sectorId}: ${guild.id}\n` +
                `\`\`\``
            )
            .addFields(
                { 
                    name: t.populationMetrics, 
                    value: `\`\`\`yaml\n` +
                           `${t.total}: ${guild.memberCount.toLocaleString()}\n` +
                           `${t.voice}: ${voiceAgents} ${t.active}\n` +
                           `${t.roles}: ${guild.roles.cache.size}\n` +
                           `${t.channels}: ${textChannels + voiceChannels}\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.networkGrid, 
                    value: `\`\`\`yaml\n` +
                           `${t.tier}: LEVEL_${boostTier}\n` +
                           `${t.node}: BAMAKO-223\n` +
                           `${t.uptime}: ${t.stable}\n` +
                           `Core: Groq LPU™ 70B\`\`\``, 
                    inline: true 
                }
            )
            .addFields({
                name: `📁 ${t.channels}`,
                value: `\`\`\`yaml\n${t.text}: ${textChannels}\n${t.voice}: ${voiceChannels}\n${t.category}: ${categories}\`\`\``,
                inline: true
            });

        // ================= ANNIVERSARY FIELD =================
        if (isAnniversary) {
            serverEmbed.addFields({ 
                name: t.anniversaryProtocol, 
                value: `\`\`\`fix\n${t.anniversaryDesc}\`\`\``,
                inline: false
            });
        }

        // ================= BOOST & SECURITY =================
        serverEmbed.addFields(
            { 
                name: t.boostSync, 
                value: `\`\`\`ansi\n\u001b[1;35m${boostBar}\u001b[0m\`\`\``, 
                inline: false 
            },
            { 
                name: t.securityProtocols, 
                value: `\`\`\`yaml\n${t.verification}: ${getVerificationLevel(guild.verificationLevel)}\n${t.integrity}: ${t.synchronized}\`\`\``, 
                inline: false 
            }
        );

        // ================= EMOJI & STICKER STATS =================
        if (emojiCount > 0 || stickerCount > 0) {
            serverEmbed.addFields({
                name: '🎨 MEDIA ASSETS',
                value: `\`\`\`yaml\n${t.emojis}: ${emojiCount}\n${t.stickers}: ${stickerCount}\`\`\``,
                inline: false
            });
        }

        serverEmbed
            .setFooter({ 
                text: `${guild.name.toUpperCase()} • ${t.footer} • v${version}`, 
                iconURL: icon 
            })
            .setTimestamp();

    // ================= SEND RESPONSE =================
    const content = isAnniversary 
        ? i18n.t('server.anniversaryAlert', lang, { years: sectorAge })
        : t.scanning;

    await message.reply({ 
        content: content,
        embeds: [serverEmbed] 
    }).catch(() => {});
    
    console.log(`[SERVER] ${message.author.tag} scanned ${guild.name} | Lang: ${lang}`);
},  // ← THIS COMMA IS CRITICAL!

// ================= SLASH COMMAND EXECUTION =================
execute: async (interaction, client) => {
        
        // DM Fallback
        if (!interaction.guild) {
            const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
            const t = loadT(lang);
            return interaction.reply({ 
                content: lang === 'fr' 
                    ? '❌ Cette commande ne peut être utilisée que dans un serveur.' 
                    : '❌ This command can only be used in a server.', 
                flags: 64 
            });
        }
        
        await interaction.deferReply();
        
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const usedCommand = lang === 'fr' ? 'serveur' : 'server';
        
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (options) => interaction.editReply(options),
            react: () => Promise.resolve()
        };
        
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        
                await module.exports.run(client, fakeMessage, [], null, serverSettings, usedCommand);
        
        console.log(`[SERVER] ${interaction.user.tag} scanned ${interaction.guild.name} | Lang: ${lang}`);
    }

};