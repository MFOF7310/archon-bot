const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '😎 EMOJI INTELLIGENCE',
        name: 'Name',
        id: 'ID',
        animated: 'Animated',
        guild: 'Server',
        url: 'URL',
        unicode: 'Unicode',
        type: 'Type',
        customEmoji: 'Custom Emoji',
        standardEmoji: 'Standard Emoji',
        raw: 'Raw Format',
        footer: 'EAGLE COMMUNITY • Neural Intelligence',
        noEmoji: '❌ Please provide an emoji.',
        notFound: '❌ Emoji not found.',
        sizeNote: '🖼️ High Resolution',
        created: 'Added to Server',
        managed: 'Managed',
        requireColons: 'Requires Colons',
        available: 'Available',
        rolesAllowed: 'Roles Allowed',
        everyone: 'Everyone'
    },
    fr: {
        title: '😎 INTELLIGENCE EMOJI',
        name: 'Nom',
        id: 'ID',
        animated: 'Animé',
        guild: 'Serveur',
        url: 'URL',
        unicode: 'Unicode',
        type: 'Type',
        customEmoji: 'Emoji Personnalisé',
        standardEmoji: 'Emoji Standard',
        raw: 'Format Brut',
        footer: 'EAGLE COMMUNITY • Intelligence Neurale',
        noEmoji: '❌ Veuillez fournir un emoji.',
        notFound: '❌ Emoji introuvable.',
        sizeNote: '🖼️ Haute Résolution',
        created: 'Ajouté au Serveur',
        managed: 'Géré',
        requireColons: 'Nécessite :',
        available: 'Disponible',
        rolesAllowed: 'Rôles Autorisés',
        everyone: 'Tout le monde'
    }
};

module.exports = {
    name: 'emoji',
    aliases: ['emote', 'e', 'emojinfo', 'emojiinfo'],
    description: '😎 Display detailed information about any emoji.',
    category: 'UTILITY',
    cooldown: 3,
    usage: '.emoji <emoji>',
    examples: ['.emoji 😎', '.emoji :smile:', '.emoji <a:custom:123456789>'],

    // ================= SLASH COMMAND =================
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Get detailed information about an emoji')
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('The emoji to inspect (paste it directly)')
                .setRequired(true)),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const t = translations[lang];

        const input = args[0];
        if (!input) {
            return message.reply({ content: t.noEmoji, ephemeral: true }).catch(() => {});
        }

        const embed = await buildEmojiEmbed(input, t, client, message.guild);
        if (!embed) {
            return message.reply({ content: t.notFound, ephemeral: true }).catch(() => {});
        }

        await message.reply({ embeds: [embed] }).catch(() => {});
    },

    // ================= SLASH EXECUTE =================
    execute: async (interaction) => {
        await interaction.deferReply();
        
        const input = interaction.options.getString('emoji');
        const lang = interaction.client.detectLanguage?.('/emoji', 'en') || 'en';
        const t = translations[lang];

        const embed = await buildEmojiEmbed(input, t, interaction.client, interaction.guild);
        if (!embed) {
            return interaction.editReply({ content: t.notFound });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};

// ================= BUILD EMBED FUNCTION =================
async function buildEmojiEmbed(input, t, client, guild) {
    const customEmojiRegex = /<(a?):(\w+):(\d+)>/;
    const match = input.match(customEmojiRegex);

    let emojiData = {};

    if (match) {
        // ================= CUSTOM EMOJI =================
        const animated = match[1] === 'a';
        const name = match[2];
        const id = match[3];
        const extension = animated ? 'gif' : 'png';
        
        // Try to fetch from guild if available
        let guildEmoji = null;
        if (guild) {
            guildEmoji = await guild.emojis.fetch(id).catch(() => null);
        }

        emojiData = {
            name: name,
            id: id,
            animated: animated,
            type: t.customEmoji,
            guild: guildEmoji?.guild?.name || 'External Server',
            url: `https://cdn.discordapp.com/emojis/${id}.${extension}`,
            raw: `<${match[1]}:${name}:${id}>`,
            created: guildEmoji?.createdAt 
                ? `<t:${Math.floor(guildEmoji.createdAt.getTime() / 1000)}:D>` 
                : 'Unknown',
            managed: guildEmoji?.managed ? '✅' : '❌',
            requireColons: guildEmoji?.requiresColons ? '✅' : '❌',
            available: guildEmoji?.available ? '✅' : '❌',
            roles: guildEmoji?.roles?.cache?.size > 0 
                ? guildEmoji.roles.cache.map(r => r.name).join(', ') 
                : t.everyone
        };
    } else {
        // ================= STANDARD EMOJI =================
        const codePoints = [...input].map(c => c.codePointAt(0).toString(16)).join('-');
        
        emojiData = {
            name: input,
            id: 'N/A',
            animated: false,
            type: t.standardEmoji,
            guild: 'Discord Standard',
            url: `https://twemoji.maxcdn.com/v/latest/72x72/${codePoints}.png`,
            raw: input,
            unicode: `U+${codePoints.toUpperCase()}`,
            created: 'N/A',
            managed: 'N/A',
            requireColons: 'N/A',
            available: 'N/A',
            roles: t.everyone
        };
    }

    // Color based on emoji type
    const color = emojiData.animated ? 0x9B59B6 : 0xF1C40F;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ 
            name: t.title, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setThumbnail(emojiData.url)
        .setImage(emojiData.url)
        .setDescription(
            `### 📋 **${emojiData.name}**\n` +
            `*${emojiData.type}*\n`
        )
        .addFields(
            {
                name: '📌 **Identifiers**',
                value: [
                    `\`\`\`yaml`,
                    `${t.name.padEnd(14)}: ${emojiData.name}`,
                    `${t.id.padEnd(14)}: ${emojiData.id}`,
                    `${t.animated.padEnd(14)}: ${emojiData.animated ? '✅ Yes' : '❌ No'}`,
                    `${t.type.padEnd(14)}: ${emojiData.type}`,
                    `\`\`\``
                ].join('\n'),
                inline: false
            },
            {
                name: '🏠 **Origin**',
                value: [
                    `\`\`\`yaml`,
                    `${t.guild.padEnd(14)}: ${emojiData.guild}`,
                    `${t.created.padEnd(14)}: ${emojiData.created}`,
                    `${t.available.padEnd(14)}: ${emojiData.available}`,
                    `\`\`\``
                ].join('\n'),
                inline: true
            },
            {
                name: '⚙️ **Properties**',
                value: [
                    `\`\`\`yaml`,
                    `${t.managed.padEnd(14)}: ${emojiData.managed}`,
                    `${t.requireColons.padEnd(14)}: ${emojiData.requireColons}`,
                    `\`\`\``
                ].join('\n'),
                inline: true
            }
        );

    // Add roles field only for custom emojis with restrictions
    if (emojiData.roles && emojiData.roles !== t.everyone) {
        embed.addFields({
            name: '🔒 **Role Access**',
            value: emojiData.roles,
            inline: false
        });
    }

    // Add raw format
    embed.addFields({
        name: '📋 **Raw Format**',
        value: `\`${emojiData.raw}\``,
        inline: false
    });

    // Add URL field
    embed.addFields({
        name: '🔗 **Direct Link**',
        value: `[${t.sizeNote}](${emojiData.url})`,
        inline: false
    });

    // Unicode for standard emojis
    if (emojiData.unicode) {
        embed.addFields({
            name: '🔢 **Unicode**',
            value: `\`${emojiData.unicode}\``,
            inline: false
        });
    }

    embed.setFooter({ 
        text: `${t.footer} • Requested by ${client.user?.username || 'User'}`,
        iconURL: guild?.iconURL() || client.user.displayAvatarURL()
    });
    embed.setTimestamp();

    return embed;
}