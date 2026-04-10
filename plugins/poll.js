const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'poll',
    aliases: ['survey', 'vote', 'sondage'],
    description: '📊 Create a quick poll with reactions.',
    category: 'UTILITY',
    cooldown: 5000,
    usage: '.poll "Question" "Option1" "Option2" ...',
    examples: ['.poll "Quel jeu ?" "CODM" "Valorant" "Fortnite"'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        
        const t = {
            en: {
                title: '📊 POLL',
                createdBy: 'Created by',
                reactToVote: 'React with the corresponding emoji to vote!',
                invalid: '❌ Usage: `.poll "Question" "Option1" "Option2" ...`\nExample: `.poll "Favorite color?" "Red" "Blue" "Green"`',
                maxOptions: '❌ Maximum 9 options allowed.'
            },
            fr: {
                title: '📊 SONDAGE',
                createdBy: 'Créé par',
                reactToVote: 'Réagissez avec l\'emoji correspondant pour voter !',
                invalid: '❌ Utilisation: `.poll "Question" "Option1" "Option2" ...`\nExemple: `.poll "Couleur préférée ?" "Rouge" "Bleu" "Vert"`',
                maxOptions: '❌ Maximum 9 options autorisées.'
            }
        }[lang];

        // Parse arguments (support quoted strings)
        const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
        const parts = [];
        let match;
        while ((match = regex.exec(args.join(' '))) !== null) {
            parts.push(match[1] || match[2] || match[3]);
        }

        if (parts.length < 3) {
            return message.reply({ content: t.invalid, ephemeral: true }).catch(() => {});
        }

        const question = parts[0];
        const options = parts.slice(1);

        if (options.length > 9) {
            return message.reply({ content: t.maxOptions, ephemeral: true }).catch(() => {});
        }

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
        
        let description = `**${question}**\n\n`;
        options.forEach((opt, i) => {
            description += `${emojis[i]} **${opt}**\n`;
        });
        description += `\n📢 *${t.reactToVote}*`;

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(t.title)
            .setDescription(description)
            .setFooter({ text: `${t.createdBy}: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        const pollMsg = await message.channel.send({ embeds: [embed] }).catch(() => {});
        if (!pollMsg) return;

        // Add reactions
        for (let i = 0; i < options.length; i++) {
            await pollMsg.react(emojis[i]).catch(() => {});
        }

        // Delete command message for cleanliness
        await message.delete().catch(() => {});
    }
};