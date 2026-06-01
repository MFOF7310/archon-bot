const { EmbedBuilder, MessageFlags } = require('discord.js');

function voiceDisabledEmbed(lang = 'en') {
    return new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🎙️ Voice Features')
        .setDescription(
            lang === 'fr'
                ? '🚧 **Fonctionnalité vocale temporairement indisponible.**\n\nUtilise Lydia en texte : `@Lydia bonjour`\n\n_Requiert un hébergement VPS — prévu pour une future mise à jour._'
                : '🚧 **Voice features are currently unavailable.**\n\nChat with Lydia via text: `@Lydia hello`\n\n_Requires VPS hosting — coming in a future update._'
        )
        .setFooter({ text: 'ARCHITECT CG-223' });
}

async function voiceDisabledReply(interaction) {
    const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
    await interaction.reply({ embeds: [voiceDisabledEmbed(lang)], flags: MessageFlags.Ephemeral });
}

// All voice commands — disabled (requires VPS for FFmpeg + voice UDP)
const joinVoice = voiceDisabledReply;
const leaveVoice = voiceDisabledReply;
const sayCommand = voiceDisabledReply;
const playCommand = voiceDisabledReply;
const showQueue = voiceDisabledReply;
const skipTrack = voiceDisabledReply;
const stopPlayback = voiceDisabledReply;
const showLyrics = voiceDisabledReply;
const handleButton = voiceDisabledReply;

// Placeholder for future voice system
const announceLevelUp = async () => {}; // No-op
const speakInVoice = async () => false; // No-op

module.exports = {
    name: 'lydia-voice',
    description: '🎙️ Voice features (requires VPS)',
    category: 'SYSTEM',
    hidden: true,
    joinVoice, leaveVoice, sayCommand, playCommand, showQueue,
    skipTrack, stopPlayback, showLyrics, handleButton,
    announceLevelUp, speakInVoice
};
