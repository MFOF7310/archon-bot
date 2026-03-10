const { translate } = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'trt',
    aliases: ['trans'],
    category: 'UTILITY',
    run: async (client, message, args, database) => {
        let targetLang = args[0]?.toLowerCase();
        let text = args.slice(1).join(' ');

        if (!targetLang) return message.reply('🛰️ Usage: `.trt [lang] [text]`');
        if (!text && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            text = repliedMsg.content;
        }

        try {
            const res = await translate(text, { to: targetLang });
            const embed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('📡 TRANSLATION UPLINK')
                .addFields(
                    { name: `Source [${res.from.language.iso.toUpperCase()}]`, value: `\`\`\`${text}\`\`\`` },
                    { name: `Target [${targetLang.toUpperCase()}]`, value: `\`\`\`${res.text}\`\`\`` }
                )
                .setFooter({ text: 'Eagle Translation Engine' });
            return message.reply({ embeds: [embed] });
        } catch (e) { return message.reply('❌ Translation failed.'); }
    }
};
