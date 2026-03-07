const { translate } = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'trt',
    description: 'Translate text. Support for "cn" (Chinese), "bm" (Bambara), and replies.',
    category: 'Utility',
    async execute(message, args) {
        // 1. Language Handling
        let targetLang = args[0]?.toLowerCase();
        let text = args.slice(1).join(' ');

        if (!targetLang) {
            return message.reply('❌ **Usage:** `,trt [lang] [text]` (Example: `,trt cn Hello`)');
        }

        // --- THE "CN" & SHORTCUTS FIX ---
        const map = { 'cn': 'zh-CN', 'jp': 'ja', 'kr': 'ko', 'bm': 'bm' };
        if (map[targetLang]) targetLang = map[targetLang];

        // 2. Reply Detection
        if (!text && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                text = repliedMsg.content;
            } catch (err) {
                return message.reply("⚠️ **Error:** Cannot fetch replied message.");
            }
        }

        if (!text) return message.reply('💡 **Notice:** Type text or reply to a message to translate.');

        try {
            await message.channel.sendTyping();

            // 3. Translation Engine
            const res = await translate(text, { to: targetLang });

            const trtEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🌐 DIGITAL TRANSLATOR')
                .addFields(
                    { 
                        name: `📥 Source (${res.from.language.iso.toUpperCase()})`, 
                        value: `\`\`\`${text.substring(0, 500)}\`\`\`` 
                    },
                    { 
                        name: `📤 Target (${targetLang.toUpperCase()})`, 
                        value: `\`\`\`${res.text.substring(0, 500)}\`\`\`` 
                    }
                )
                .setFooter({ text: 'Cloud Gaming-223 | AES Translation Node' });

            return message.reply({ embeds: [trtEmbed] });

        } catch (error) {
            return message.reply(`❌ **Module Error:** \`${targetLang}\` is not a valid language code.`);
        }
    }
};
