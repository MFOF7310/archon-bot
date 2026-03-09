const googleTTS = require('google-tts-api');

module.exports = {
    name: 'tts',
    description: 'Smart Bilingual TTS',
    run: async (client, message, args, database) => {
        let text = args.join(' ');
        if (!text && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            text = repliedMsg.content;
        }
        if (!text) return message.reply('💡 Usage: `,tts [text]`');

        const safeText = text.substring(0, 200);
        const isFrench = /[éàèêëîïôûùç]/i.test(safeText) || safeText.toLowerCase().includes('le');
        const url = googleTTS.getAudioUrl(safeText, { lang: isFrench ? 'fr-FR' : 'en-US' });

        return message.reply({
            content: `🎙️ **Voice Engine:** ${isFrench ? 'French 🇲🇱' : 'English 🇺🇸'}`,
            files: [{ attachment: url, name: `tts.mp3` }]
        });
    }
};
