const { sendTelegramMessage } = require('../bot');

module.exports = {
    name: 'broadcast',
    aliases: ['announce', 'bc'],
    handler: async (ctx) => {
        const args = ctx.args || [];
        const userId = ctx.userId.toString();
        const version = ctx.client.version || '1.7.0';
        
        const OWNER_ID = process.env.OWNER_ID;
        const DISCORD_CHANNEL_ID = process.env.BROADCAST_CHANNEL_ID || process.env.GENERAL_CHANNEL_ID;
        
        if (userId !== OWNER_ID) {
            await sendTelegramMessage(ctx.token, ctx.chatId, `⛔ <b>Access Denied</b>\n\nThis command is owner-only.`);
            return;
        }
        
        const message = args.join(' ');
        if (!message) {
            await sendTelegramMessage(ctx.token, ctx.chatId,
                `📢 <b>Broadcast Usage</b>\n\n` +
                `<code>/broadcast &lt;message&gt;</code>\n\n` +
                `Example: <code>/broadcast Hello everyone!</code>`
            );
            return;
        }
        
        try {
            const client = ctx.client;
            const channel = await client.channels.fetch(DISCORD_CHANNEL_ID).catch(() => null);
            
            if (!channel) {
                await sendTelegramMessage(ctx.token, ctx.chatId, `❌ Could not find broadcast channel. Check BROADCAST_CHANNEL_ID in .env`);
                return;
            }
            
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: '📢 TELEGRAM BROADCAST', iconURL: client.user.displayAvatarURL() })
                .setDescription(message)
                .setFooter({ text: `From: ${ctx.username} • BAMAKO_223 🇲🇱 • v${version}` })
                .setTimestamp();
            
            await channel.send({ embeds: [embed] });
            
            await sendTelegramMessage(ctx.token, ctx.chatId,
                `✅ <b>Broadcast Sent!</b>\n\n` +
                `📢 Message delivered to Discord.\n\n` +
                `"${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`
            );
            
        } catch (error) {
            console.error('[Broadcast] Error:', error);
            await sendTelegramMessage(ctx.token, ctx.chatId, `❌ Failed to send: ${error.message}`);
        }
    }
};