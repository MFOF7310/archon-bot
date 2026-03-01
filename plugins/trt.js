const { translate } = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'trt',
    description: 'Translate text to any language.',
    category: 'Utility',
    async execute(message, args) {
        const targetLang = args[0]?.toLowerCase();
        let text = args.slice(1).join(' ');

        if (!targetLang) return message.reply('❌ **Usage:** `,trt [lang] [text]` (e.g., `,trt fr Hello`)');

        if (!text && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            text = repliedMsg.content;
        }

        if (!text) return message.reply('💡 Reply to a message or type text after the language code.');

        try {
            const res = await translate(text, { to: targetLang });
            const trtEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🌐 DIGITAL TRANSLATOR')
                .addFields(
                    { name: `📥 From: ${res.from.language.iso.toUpperCase()}`, value: `\`\`\`${text.substring(0, 500)}\`\`\`` },
                    { name: `📤 To: ${targetLang.toUpperCase()}`, value: `\`\`\`${res.text.substring(0, 500)}\`\`\`` }
                )
                .setFooter({ text: 'Cloud Gaming-223 | AES Translation Node' });

            return message.reply({ embeds: [trtEmbed] });
        } catch (error) {
            return message.reply(`❌ **Translation Failed:** Check if \`${targetLang}\` is a valid language code.`);
        }
    }
};
