const { translate } = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'trt',
    description: 'Translate text to a specific language',
    async execute(message, args) {
        // Usage: ,trt fr Hello world
        const targetLang = args[0];
        const textToTranslate = args.slice(1).join(' ');

        if (!targetLang || !textToTranslate) {
            return message.reply('❌ Usage: `,trt [language_code] [text]`\nExample: `,trt fr Hello friend`');
        }

        try {
            // Translate the text
            const res = await translate(textToTranslate, { to: targetLang });

            const trtEmbed = new EmbedBuilder()
                .setColor('#2ecc71') // AES Green
                .setTitle('🌐 CLOUD GAMING 223 | TRANSLATOR')
                .addFields(
                    { name: `📥 Original (${res.from.language.iso})`, value: `\`\`\`${textToTranslate}\`\`\`` },
                    { name: `📤 Translated (${targetLang})`, value: `\`\`\`${res.text}\`\`\`` }
                )
                .setFooter({ text: 'Powered by AES Digital Sovereignty' })
                .setTimestamp();

            return message.reply({ embeds: [trtEmbed] });

        } catch (error) {
            console.error('Translation Error:', error);
            // If the language code is wrong, Google might throw an error
            return message.reply(`❌ Could not translate. Make sure \`${targetLang}\` is a valid language code (e.g., fr, en, ar, zh).`);
        }
    }
};
