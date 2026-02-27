const { translate } = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'trt',
    description: 'Translate a reply or direct text.',
    category: 'Utility',
    async execute(message, args, client) {
        const targetLang = args[0];
        let textToTranslate = args.slice(1).join(' ');

        if (!targetLang) return message.reply('❌ Specify a language. Example: `,trt fr`');

        if (!textToTranslate && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            textToTranslate = repliedMsg.content;
        }

        if (!textToTranslate) return message.reply('💡 Reply to a message or type text after the language code.');

        try {
            const res = await translate(textToTranslate, { to: targetLang });
            const trtEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🌐 CLOUD GAMING 223 | TRANSLATOR')
                .addFields(
                    { name: `📥 Original (${res.from.language.iso})`, value: `\`\`\`${textToTranslate}\`\`\`` },
                    { name: `📤 Translated (${targetLang})`, value: `\`\`\`${res.text}\`\`\`` }
                )
                .setFooter({ text: 'AES Digital Sovereignty' });

            return message.reply({ embeds: [trtEmbed] });
        } catch (error) {
            return message.reply(`❌ Translation failed. Check language code: \`${targetLang}\``);
        }
    }
};
