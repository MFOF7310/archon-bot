const { translate } = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'trt',
    description: 'Levanter-style: Translate a reply or direct text.',
    async execute(message, args) {
        const targetLang = args[0];
        let textToTranslate = args.slice(1).join(' ');

        // 1. Language check
        if (!targetLang) {
            return message.reply('❌ Please specify a language code. Example: `,trt fr`');
        }

        // 2. The Levanter Logic: Check if you are replying to a message
        if (!textToTranslate && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            textToTranslate = repliedMsg.content;
        }

        // 3. If no text AND no reply, show a helpful hint
        if (!textToTranslate) {
            return message.reply('💡 **How to use:**\n1. Reply to a message and type `,trt fr`\n2. Or type `,trt fr [your text]`');
        }

        try {
            const res = await translate(textToTranslate, { to: targetLang });

            const trtEmbed = new EmbedBuilder()
                .setColor('#2ecc71') // AES Green
                .setTitle('🌐 CLOUD GAMING 223 | TRANSLATOR')
                .addFields(
                    { name: `📥 Original (${res.from.language.iso})`, value: `\`\`\`${textToTranslate}\`\`\`` },
                    { name: `📤 Translated (${targetLang})`, value: `\`\`\`${res.text}\`\`\`` }
                )
                .setFooter({ text: 'AES Digital Sovereignty • Steve' })
                .setTimestamp();

            return message.reply({ embeds: [trtEmbed] });

        } catch (error) {
            return message.reply(`❌ Could not translate. Is \`${targetLang}\` a valid code?`);
        }
    }
};
