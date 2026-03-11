const { translate } = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'trt',
    aliases: ['trans', 'translate'],
    description: 'Translate text between languages with auto-detection.',
    category: 'UTILITY',
    run: async (client, message, args, database) => {
        // Usage: .trt <target_lang> [text]  or reply to a message with .trt <target_lang>
        let targetLang = args[0]?.toLowerCase();
        let text = args.slice(1).join(' ');

        if (!targetLang) {
            return message.reply({
                content: `🛰️ **Usage:** \`${process.env.PREFIX || '.'}trt <lang> [text]\`\nExample: \`.trt fr Hello world\` or reply to a message with \`.trt es\``
            });
        }

        // If no text but reply exists, fetch replied message content
        if (!text && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                text = repliedMsg.content;
            } catch {
                return message.reply("❌ Could not fetch the replied message.");
            }
        }

        if (!text) {
            return message.reply("❌ Please provide text to translate or reply to a message.");
        }

        try {
            const res = await translate(text, { to: targetLang });
            const sourceLang = res.from.language.iso.toUpperCase();
            
            const embed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setAuthor({ name: '🌍 TRANSLATION UPLINK', iconURL: client.user.displayAvatarURL() })
                .addFields(
                    { name: `📥 Source [${sourceLang}]`, value: `\`\`\`${text.substring(0, 1024)}\`\`\`` },
                    { name: `📤 Target [${targetLang.toUpperCase()}]`, value: `\`\`\`${res.text.substring(0, 1024)}\`\`\`` }
                )
                .setFooter({ text: `Eagle Translation Engine • Auto-detected: ${sourceLang}` })
                .setTimestamp();

            // If text was longer than 1024, note truncation
            if (text.length > 1024 || res.text.length > 1024) {
                embed.setDescription("*Note: Translation truncated due to length.*");
            }

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error("Translation error:", error);
            message.reply("❌ **Translation failed.** Check the target language code or try again.");
        }
    }
};