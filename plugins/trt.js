const { translate } = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'trt',
    aliases: ['t', 'trans'], // Shortcuts enabled by your new index.js
    description: 'Universal Translator. Use "cn" for Chinese and "bm" for Bambara.',
    category: 'Utility',
    async execute(message, args) {
        // 1. Setup Language & Shortcuts
        let targetLang = args[0]?.toLowerCase();
        let text = args.slice(1).join(' ');

        if (!targetLang) {
            return message.reply('🛰️ **AES TRANSLATOR**\nUsage: `,trt [lang] [text]`\nExample: `,trt cn Hello`');
        }

        // Mapping shortcuts to official ISO codes
        const shortcuts = {
            'cn': 'zh-CN',  // Your request
            'jp': 'ja',     // Japanese
            'kr': 'ko',     // Korean
            'bm': 'bm'      // Bambara (Mali 🇲🇱)
        };

        if (shortcuts[targetLang]) targetLang = shortcuts[targetLang];

        // 2. Handle Replies
        if (!text && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                text = repliedMsg.content;
            } catch (err) {
                return message.reply("⚠️ **System Error:** Cannot reach the target message.");
            }
        }

        if (!text) return message.reply('💡 **Logic Error:** Provide text or reply to a message.');

        try {
            await message.channel.sendTyping();
            
            const res = await translate(text, { to: targetLang });

            const trtEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: 'DIGITAL ENGINE TRANSLATION', iconURL: message.client.user.displayAvatarURL() })
                .addFields(
                    { 
                        name: `📥 Source [${res.from.language.iso.toUpperCase()}]`, 
                        value: `\`\`\`${text.substring(0, 500)}\`\`\`` 
                    },
                    { 
                        name: `📤 Target [${targetLang.toUpperCase()}]`, 
                        value: `\`\`\`${res.text.substring(0, 500)}\`\`\`` 
                    }
                )
                .setFooter({ text: 'Cloud Gaming-223 | AES-Link v2.6' });

            return message.reply({ embeds: [trtEmbed] });

        } catch (error) {
            return message.reply(`❌ **Invalid Node:** \`${targetLang}\` is not a valid language code.`);
        }
    }
};
