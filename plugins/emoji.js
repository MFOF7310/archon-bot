const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'emoji',
    aliases: ['emote', 'e', 'emojinfo'],
    description: '😎 Display information about an emoji.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.emoji <emoji>',
    examples: ['.emoji 😎', '.emoji :smile:', '.emoji <a:custom:123456789>'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        
        const t = {
            en: {
                title: '😎 EMOJI INFORMATION',
                name: 'Name',
                id: 'ID',
                animated: 'Animated',
                guild: 'Server',
                url: 'URL',
                unicode: 'Unicode',
                footer: 'ARCHITECT CG-223 • Neural Intelligence',
                noEmoji: '❌ Please provide an emoji.',
                notFound: '❌ Emoji not found.'
            },
            fr: {
                title: '😎 INFORMATIONS EMOJI',
                name: 'Nom',
                id: 'ID',
                animated: 'Animé',
                guild: 'Serveur',
                url: 'URL',
                unicode: 'Unicode',
                footer: 'ARCHITECT CG-223 • Intelligence Neurale',
                noEmoji: '❌ Veuillez fournir un emoji.',
                notFound: '❌ Emoji introuvable.'
            }
        }[lang];

        const input = args[0];
        if (!input) {
            return message.reply({ content: t.noEmoji, ephemeral: true }).catch(() => {});
        }

        // Parse custom emoji
        const customEmojiRegex = /<(a?):(\w+):(\d+)>/;
        const match = input.match(customEmojiRegex);

        let emojiInfo = {};

        if (match) {
            // Custom emoji
            const animated = match[1] === 'a';
            const name = match[2];
            const id = match[3];
            
            emojiInfo = {
                name: name,
                id: id,
                animated: animated,
                guild: message.guild?.name || 'Unknown',
                url: `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}`,
                unicode: 'N/A (Custom Emoji)'
            };
        } else {
            // Unicode emoji
            const codePoints = [...input].map(c => c.codePointAt(0).toString(16)).join('-');
            emojiInfo = {
                name: input,
                id: 'N/A',
                animated: false,
                guild: 'N/A',
                url: `https://twemoji.maxcdn.com/v/latest/72x72/${codePoints}.png`,
                unicode: codePoints.toUpperCase()
            };
        }

        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
            .setThumbnail(emojiInfo.url)
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.name}: ${emojiInfo.name}\n` +
                `${t.id}: ${emojiInfo.id}\n` +
                `${t.animated}: ${emojiInfo.animated ? '✅' : '❌'}\n` +
                `${t.guild}: ${emojiInfo.guild}\n` +
                `${t.unicode}: ${emojiInfo.unicode}\n` +
                `\`\`\``
            )
            .addFields({
                name: '🔗 URL',
                value: `[Click to open](${emojiInfo.url})`,
                inline: false
            })
            .setFooter({ text: t.footer })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    }
};