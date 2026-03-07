const { translate } = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'trt',
    description: 'Translate text. Use "cn" for Chinese, "fr" for French, etc.',
    category: 'Utility',
    async execute(message, args) {
        let targetLang = args[0]?.toLowerCase();
        let text = args.slice(1).join(' ');

        if (!targetLang) return message.reply('❌ **Format:** `,trt [lang] [text]`');

        // --- THE "CN" FIX ---
        // If the user types 'cn', the engine automatically switches it to 'zh-CN'
        if (targetLang === 'cn') targetLang = 'zh-CN';
        if (targetLang === 'jp') targetLang = 'ja'; // Bonus: 'jp' to 'ja' for Japanese

        // Reply Logic
        if (!text && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                text = repliedMsg.content;
            } catch (err) { return message.reply("⚠️ Message not found."); }
        }

        if (!text) return message.reply('💡 Type text or reply to a message.');

        try {
            await message.channel.sendTyping();
            const res = await translate(text, { to: targetLang });

            const trtEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🌐 DIGITAL TRANSLATOR')
                .addFields(
                    { name: `📥 From: ${res.from.language.iso.toUpperCase()}`, value: `\`\`\`${text.substring(0, 500)}\`\`\`` },
                    { name: `📤 To: ${targetLang.toUpperCase()}`, value: `\`\`\`${res.text.substring(0, 500)}\`\`\`` }
                )
                .setFooter({ text: 'Cloud Gaming-223 | Engine v2.6' });

            return message.reply({ embeds: [trtEmbed] });
        } catch (error) {
            return message.reply(`❌ **Invalid Language:** Use \`fr\`, \`en\`, \`cn\`, etc.`);
        }
    }
};
