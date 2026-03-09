const { translate } = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'trt',
    aliases: ['t', 'trans'],
    run: async (client, message, args, database) => {
        let targetLang = args[0]?.toLowerCase();
        let text = args.slice(1).join(' ');

        if (!targetLang) return message.reply('🛰️ Usage: `,trt [lang] [text]`');
        if (!text && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            text = repliedMsg.content;
        }
        if (!text) return message.reply('💡 Provide text or reply to a message.');

        try {
            await message.channel.sendTyping();
            const res = await translate(text, { to: targetLang });
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('TRANSLATION SUCCESS')
                .addFields(
                    { name: `Source [${res.from.language.iso.toUpperCase()}]`, value: `\`\`\`${text}\`\`\`` },
                    { name: `Target [${targetLang.toUpperCase()}]`, value: `\`\`\`${res.text}\`\`\`` }
                );
            return message.reply({ embeds: [embed] });
        } catch (e) { return message.reply('❌ Translation failed.'); }
    }
};
