const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { iconObj } = require('../lib/ui/icons');
const v2 = require('../lib/games/v2');
const i18n = require('../lib/i18n');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };

const I18N_KEYS = ["author","title","description","tiktok","tiktokDesc","instagram","instagramDesc","facebook","facebookDesc","whatsapp","whatsappDesc","discord","discordDesc","github","githubDesc","footer","tip","tipText","nodeLocation","nodeStatus","quickStats","members","servers","commands","uptime","voteLink","voteDesc","inviteLink","inviteDesc"];
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`socials.${k}`, lang);
    return o;
}

module.exports = {
    name: 'socials',
    aliases: ['social', 'links', 'connect', 'contact', 'reseaux', 'sociaux'],
    description: '🔗 Display official social media links and community hubs.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.socials',
    examples: ['.socials', '.reseaux'],

    data: new SlashCommandBuilder()
        .setName('socials')
        .setDescription('🔗 Display official social media links / Afficher les liens sociaux'),
    
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const guildId = message.guild?.id ?? 'DM';
        lang = client.detectLanguage ? client.detectLanguage('socials', guildId) : 'en';
        const t = loadT(lang);
        const version = client.version || '1.8.0';
        const guildName = message.guild?.name?.toUpperCase() || 'ARCHON CG-223';
        const ping = Math.max(0, Math.round(client.ws.ping));

        const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const totalGuilds = (client.db ? (client.db.prepare("SELECT COUNT(DISTINCT guild_id) FROM users WHERE guild_id NOT IN ('DM','telegram')").get()["COUNT(DISTINCT guild_id)"] || client.guilds.cache.size) : client.guilds.cache.size);
        const totalCommands = client.commands?.size || 0;
        const uptimeStr = Math.floor(process.uptime() / 3600) + 'h';

        const socialLinks = {
            tiktok: 'https://www.tiktok.com/@cloudgaming223',
            facebook: 'https://www.facebook.com/share/17KysmJrtm/',
            instagram: 'https://www.instagram.com/mfof7310',
            whatsapp: 'https://wa.me/15485200518',
            discord: 'https://discord.gg/NFSMFJajp9',
            github: 'https://github.com/MFOF7310'
        };

        // Les boutons D'ABORD
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('TikTok').setURL(socialLinks.tiktok).setStyle(ButtonStyle.Link).setEmoji(iconObj('tiktok_logo', null, '🎬')),
            new ButtonBuilder().setLabel('Instagram').setURL(socialLinks.instagram).setStyle(ButtonStyle.Link).setEmoji(iconObj('instagram', null, '📸')),
            new ButtonBuilder().setLabel('Facebook').setURL(socialLinks.facebook).setStyle(ButtonStyle.Link).setEmoji(iconObj('facebook', null, '')),
            new ButtonBuilder().setLabel('GitHub').setURL(socialLinks.github).setStyle(ButtonStyle.Link).setEmoji(iconObj('developericon', null, '💻'))
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('WhatsApp').setURL(socialLinks.whatsapp).setStyle(ButtonStyle.Link).setEmoji(iconObj('whatsapp', null, '💬')),
            new ButtonBuilder().setLabel('Discord').setURL(socialLinks.discord).setStyle(ButtonStyle.Link).setEmoji(iconObj('discord', null, '🎮')),
            new ButtonBuilder().setCustomId('socials_stats').setLabel('📊 Stats').setStyle(ButtonStyle.Secondary).setEmoji(iconObj('charts', null, '📊')),
            new ButtonBuilder().setCustomId('socials_invite').setLabel('🔗 Invite').setStyle(ButtonStyle.Success).setEmoji(iconObj('website', null, '🔗'))
        );

        // Le contenu ENSUITE
        const items = [
            { text: `## ${em('eagle', '🦅')} ${em('website', '🔗')} ${(t.title || 'CONNECT WITH THE ARCHITECT').replace('🔗', '').trim()}\n*${t.description || 'Connect with the Architect'}*` },
            { text: `**MEDIA & STREAMS**\n` +
                    `${em('tiktok_logo', '🎬')} TikTok · Live Streams & Clips\n` +
                    `${em('instagram', '📸')} Instagram · Gameplay clips` },
            { text: `**COMMUNITY & SUPPORT**\n` +
                    `${em('discord', '🎮')} Discord · Join our Server\n` +
                    `${em('whatsapp', '💬')} WhatsApp · Direct Support\n` +
                    `${em('facebook', '🔵')} Facebook · Community Hub` },
            { text: `**OPEN SOURCE**\n` +
                    `${em('developericon', '💻')} GitHub · Source Code` },
            { rule: true },
            { text: `**${em('location', '📍')} NODE STATUS**\n` +
                    `**BAMAKO, MALI 🇲🇱**\n` +
                    `${em('ping_ok', '🟢')} Online · ${em('ic_satellite', '📡')} ${ping}ms\n` +
                    `${em('charts', '📊')} ${totalMembers.toLocaleString()} ${t.members} · ${totalGuilds} ${t.servers} · ${totalCommands} ${t.commands} · ${em('clock', '⏱️')} ${uptimeStr}` },
            { row: row1 },
            { row: row2 },
            { text: `-# ${guildName} • v${version}` }
        ];

        const reply = await message.reply({ ...v2.card(0x00acee, items) }).catch(() => {});
        if (!reply) return;

        const collector = reply.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: lang === 'fr' ? '❌ Ce menu ne vous appartient pas.' : '❌ This menu is not yours.', flags: 64 });
            }

            if (i.customId === 'socials_stats') {
                const freshPing = Math.max(0, Math.round(client.ws.ping));
                const freshUptimeStr = Math.floor(process.uptime() / 3600) + 'h';
                const statsItems = [
                    { text: `## 📊 LIVE SYSTEM STATS` },
                    { text: `🏠 Servers: ${totalGuilds}\n👥 Users: ${totalMembers.toLocaleString()}\n⚡ Ping: ${freshPing}ms\n⏱️ Uptime: ${freshUptimeStr}\n💾 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB` },
                    { text: `-# ARCHON CG-223 • v${version}` }
                ];
                await i.reply({ ...v2.card(0x2ecc71, statsItems), flags: 64 });
            }

            if (i.customId === 'socials_invite') {
                const inviteItems = [
                    { text: `## 🔗 INVITE ARCHON CG-223` },
                    { text: `**Add the bot to your server!**\n\n🔗 **Invite Link:**\n${require('../lib/invite').inviteUrl(client.user.id)}\n\n✨ **Features:**\n• AI Chat (Lydia)\n• Economy System\n• Moderation Tools\n• Gaming Commands\n• And much more!` },
                    { text: `-# ARCHON CG-223 • v${version}` }
                ];
                await i.reply({ ...v2.card(0x5865F2, inviteItems), flags: 64 });
            }
        });
    },

    execute: async (interaction, client) => {
        const lang = require('../lib/i18n').slashLang(interaction);
        const t = loadT(lang);
        const version = client.version || '1.8.0';

        await interaction.deferReply();

        const ping = Math.max(0, Math.round(client.ws.ping));
        const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const totalGuilds = (client.db ? (client.db.prepare("SELECT COUNT(DISTINCT guild_id) FROM users WHERE guild_id NOT IN ('DM','telegram')").get()["COUNT(DISTINCT guild_id)"] || client.guilds.cache.size) : client.guilds.cache.size);
        const totalCommands = client.commands?.size || 0;
        const uptimeStr = Math.floor(process.uptime() / 3600) + 'h';

        const socialLinks = {
            tiktok: 'https://www.tiktok.com/@cloudgaming223',
            facebook: 'https://www.facebook.com/share/17KysmJrtm/',
            instagram: 'https://www.instagram.com/mfof7310',
            whatsapp: 'https://wa.me/15485200518',
            discord: 'https://discord.gg/NFSMFJajp9',
            github: 'https://github.com/MFOF7310'
        };

        // Boutons D'ABORD
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('TikTok').setURL(socialLinks.tiktok).setStyle(ButtonStyle.Link).setEmoji(iconObj('tiktok_logo', null, '🎬')),
            new ButtonBuilder().setLabel('Instagram').setURL(socialLinks.instagram).setStyle(ButtonStyle.Link).setEmoji(iconObj('instagram', null, '📸')),
            new ButtonBuilder().setLabel('Facebook').setURL(socialLinks.facebook).setStyle(ButtonStyle.Link).setEmoji(iconObj('facebook', null, '')),
            new ButtonBuilder().setLabel('GitHub').setURL(socialLinks.github).setStyle(ButtonStyle.Link).setEmoji(iconObj('developericon', null, '💻'))
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('WhatsApp').setURL(socialLinks.whatsapp).setStyle(ButtonStyle.Link).setEmoji(iconObj('whatsapp', null, '💬')),
            new ButtonBuilder().setLabel('Discord').setURL(socialLinks.discord).setStyle(ButtonStyle.Link).setEmoji(iconObj('discord', null, '🎮'))
        );

        // Contenu ENSUITE
        const items = [
            { text: `## ${em('eagle', '🦅')} ${em('website', '🔗')} ${(t.title || 'CONNECT WITH THE ARCHITECT').replace('🔗', '').trim()}\n*${t.description || 'Connect with the Architect'}*` },
            { text: `**MEDIA & STREAMS**\n` +
                    `${em('tiktok_logo', '🎬')} TikTok · Live Streams & Clips\n` +
                    `${em('instagram', '📸')} Instagram · Gameplay clips` },
            { text: `**COMMUNITY & SUPPORT**\n` +
                    `${em('discord', '🎮')} Discord · Join our Server\n` +
                    `${em('whatsapp', '💬')} WhatsApp · Direct Support\n` +
                    `${em('facebook', '🔵')} Facebook · Community Hub` },
            { text: `**OPEN SOURCE**\n` +
                    `${em('developericon', '💻')} GitHub · Source Code` },
            { rule: true },
            { text: `**${em('location', '📍')} NODE STATUS**\n` +
                    `**BAMAKO, MALI 🇲🇱**\n` +
                    `${em('ping_ok', '🟢')} Online · ${em('ic_satellite', '📡')} ${ping}ms\n` +
                    `${em('charts', '📊')} ${totalMembers.toLocaleString()} ${t.members} · ${totalGuilds} ${t.servers} · ${totalCommands} ${t.commands} · ${em('clock', '⏱️')} ${uptimeStr}` },
            { row: row1 },
            { row: row2 },
            { text: `-# ${interaction.guild?.name?.toUpperCase() || 'ARCHON CG-223'} • v${version}` }
        ];

        await interaction.editReply({ ...v2.card(0x00acee, items) });
    }
};
