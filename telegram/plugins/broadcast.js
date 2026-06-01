// ═══════════════════════════════════════════
//  TG COMMAND: Broadcast to Discord
// ═══════════════════════════════════════════

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = {
    name: 'broadcast',
    description: 'Send announcement to Discord (owner only)',
    category: 'System',
    usage: '/broadcast <message>',
    aliases: ['announce', 'bc', 'say'],
    ownerOnly: true,

    handler: async (ctx) => {
        const message = ctx.args.join(' ');
        const channelId = process.env.BROADCAST_CHANNEL_ID;

        if (!message) return ctx.replyHTML(`📢 <b>Broadcast</b>\n\n<code>/broadcast Hello everyone!</code>`);
        if (!channelId) return ctx.replyHTML(`❌ BROADCAST_CHANNEL_ID not set.`);

        try {
            const channel = await ctx.client.channels.fetch(channelId).catch(() => null);
            if (!channel) return ctx.replyHTML(`❌ Channel not found.`);

            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor('#00d4ff')
                .setAuthor({ name: '📢 TELEGRAM BROADCAST', iconURL: ctx.client.user.displayAvatarURL() })
                .setDescription(message)
                .setFooter({ text: `From: ${ctx.username} · BAMAKO_223 🇲🇱` })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            ctx.replyHTML(`✅ <b>Sent!</b>\n\n"${escapeHTML(message.substring(0, 100))}${message.length > 100 ? '...' : ''}"`);
        } catch (err) {
            ctx.replyHTML(`❌ Failed: ${err.message}`);
        }
    }
};
