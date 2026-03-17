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

        // Language mapping for display and input normalization
        const langMap = {
            // Map common variants to standard codes
            'cn': 'zh',      // User types 'cn' -> use 'zh' for translation
            'zh': 'zh',      // Keep as is
            'en': 'en',
            'es': 'es',
            'fr': 'fr',
            'de': 'de',
            'it': 'it',
            'pt': 'pt',
            'ru': 'ru',
            'ja': 'ja',
            'ko': 'ko',
            'ar': 'ar',
            'hi': 'hi',
            // Add more as needed
        };

        // Friendly language names for display
        const langNames = {
            'zh': '🇨🇳 Chinese (Simplified)',
            'en': '🇬🇧 English',
            'es': '🇪🇸 Spanish',
            'fr': '🇫🇷 French',
            'de': '🇩🇪 German',
            'it': '🇮🇹 Italian',
            'pt': '🇵🇹 Portuguese',
            'ru': '🇷🇺 Russian',
            'ja': '🇯🇵 Japanese',
            'ko': '🇰🇷 Korean',
            'ar': '🇸🇦 Arabic',
            'hi': '🇮🇳 Hindi',
            // Default fallback
            'default': '🌐 Unknown'
        };

        if (!targetLang) {
            return message.reply({
                content: `🛰️ **Translation Usage:**\n\`${process.env.PREFIX || '.'}trt <lang> [text]\`\n` +
                         `Example: \`${process.env.PREFIX || '.'}trt fr Hello world\`\n` +
                         `Or reply to a message with \`${process.env.PREFIX || '.'}trt es\`\n` +
                         `**Common codes:** en, es, fr, de, zh (Chinese), ja, ko, etc.`
            });
        }

        // Normalize target language: map 'cn' -> 'zh', keep others as is
        targetLang = langMap[targetLang] || targetLang;

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
            
            // Get source language code and display name
            const sourceCode = res.from.language.iso;
            const sourceDisplay = langNames[sourceCode] || `🌐 ${sourceCode.toUpperCase()}`;
            
            // Get target language display name
            const targetDisplay = langNames[targetLang] || `🌐 ${targetLang.toUpperCase()}`;

            // Prepare embed fields with proper truncation
            const sourceField = {
                name: `📥 Source (${sourceDisplay})`,
                value: text.length > 1024 ? text.substring(0, 1021) + '...' : text,
                inline: false
            };
            
            const targetField = {
                name: `📤 Target (${targetDisplay})`,
                value: res.text.length > 1024 ? res.text.substring(0, 1021) + '...' : res.text,
                inline: false
            };

            const embed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('🌍 Translation Gateway')
                .setDescription('Your message has been successfully translated!')
                .addFields(sourceField, targetField)
                .setFooter({ 
                    text: `Auto-detected source language • Requested by ${message.author.tag}`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setTimestamp();

            // If any field was truncated, add a note
            if (text.length > 1024 || res.text.length > 1024) {
                embed.setDescription('*Note: Translation truncated due to length limits.*');
            }

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error("Translation error:", error);
            message.reply("❌ **Translation failed.** The language code may be invalid or the service is temporarily unavailable.");
        }
    }
};