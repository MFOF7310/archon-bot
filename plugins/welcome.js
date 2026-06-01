const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const T = {
    en: {
        previewTitle: '👋 Welcome Message Preview',
        previewDesc: 'This is how new members will see the welcome message.',
        noWelcomeChannel: '⚠️ No welcome channel configured. Set one with `.serversettings set welcomeChannel <channel-id>`.',
        testSent: '✅ Test welcome message sent to',
        noWelcomeConfig: '❌ Welcome system not configured. Set welcomeChannel in server settings.',
        noPermission: '❌ You need Manage Server permission.',
        footer: (guild) => `${guild} • Welcome System`,
    },
    fr: {
        previewTitle: '👋 Aperçu du Message de Bienvenue',
        previewDesc: 'Voici comment les nouveaux membres verront le message de bienvenue.',
        noWelcomeChannel: '⚠️ Aucun canal de bienvenue configuré. Définissez-en un avec `.serversettings set welcomeChannel <channel-id>`.',
        testSent: '✅ Message de test envoyé à',
        noWelcomeConfig: '❌ Système de bienvenue non configuré. Définissez welcomeChannel dans les paramètres.',
        noPermission: '❌ Vous avez besoin de la permission Gérer le Serveur.',
        footer: (guild) => `${guild} • Système de Bienvenue`,
    }
};

module.exports = {
    name: 'welcome',
    aliases: ['welcometest', 'testwelcome'],
    description: '👋 Preview your server\'s welcome message configuration.',
    category: 'ADMIN',
    cooldown: 5000,
    usage: '.welcome',
    examples: ['.welcome', '.welcometest'],

    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('👋 Preview welcome message')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = T[lang];
        const guild = message.guild;

        if (!guild) return message.reply('❌ Server only.').catch(() => {});
        if (!message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply(t.noPermission).catch(() => {});
        }

        const welcomeChannelId = serverSettings?.welcomeChannel;
        if (!welcomeChannelId) return message.reply(t.noWelcomeChannel).catch(() => {});

        const channel = guild.channels.cache.get(welcomeChannelId);
        if (!channel) return message.reply(t.noWelcomeChannel).catch(() => {});

        // Build preview embed simulating actual welcome
        const embed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: t.previewTitle, iconURL: guild.iconURL() })
            .setDescription(t.previewDesc)
            .addFields(
                { name: '📍 Channel', value: `<#${welcomeChannelId}>`, inline: true },
                { name: '🎨 Color', value: serverSettings?.welcomeColor || 'Default (#00fbff)', inline: true },
                { name: '🔔 Welcome Enabled', value: serverSettings?.welcomeEnabled ? '✅ Yes' : '❌ No', inline: true }
            )
            .setFooter({ text: t.footer(guild.name) })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});

        // Send actual test to welcome channel
        const testEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: `⚡ NEURAL GATEWAY ACCESS: GRANTED`, iconURL: guild.iconURL() })
            .setDescription(
                `### 🦅 NEW SYNAPSE DETECTED\n` +
                `**${message.author.username.toUpperCase()}** has joined the neural grid.\n\n` +
                `*(This is a test welcome message — sent by ${message.author.username})*`
            )
            .setThumbnail(message.author.displayAvatarURL({ size: 512 }))
            .setFooter({ text: t.footer(guild.name) })
            .setTimestamp();

        try {
            await channel.send({ content: `<@${message.author.id}>`, embeds: [testEmbed] });
            await message.channel.send(`${t.testSent} <#${welcomeChannelId}>`).catch(() => {});
        } catch (e) {
            message.reply('❌ Failed to send test. Check bot permissions in welcome channel.').catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang];
        const guild = interaction.guild;

        if (!guild) return interaction.reply({ content: '❌ Server only.', ephemeral: true });

        const serverSettings = client.getServerSettings ? client.getServerSettings(guild.id) : {};
        const welcomeChannelId = serverSettings?.welcomeChannel;

        if (!welcomeChannelId) return interaction.reply({ content: t.noWelcomeChannel, ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: t.previewTitle, iconURL: guild.iconURL() })
            .setDescription(t.previewDesc)
            .addFields(
                { name: '📍 Channel', value: `<#${welcomeChannelId}>`, inline: true },
                { name: '🎨 Color', value: serverSettings?.welcomeColor || 'Default (#00fbff)', inline: true },
                { name: '🔔 Enabled', value: serverSettings?.welcomeEnabled ? '✅ Yes' : '❌ No', inline: true }
            )
            .setFooter({ text: t.footer(guild.name) })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};