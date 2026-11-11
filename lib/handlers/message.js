// lib/handlers/message.js — Message Create Event
const { Events } = require('discord.js');

module.exports = (client, db) => {
    client.on(Events.MessageCreate, async (message) => {
    if (message.channel.isDMBased() && !message.author.bot) {
        try {
            const verifyPlugin = require('../../plugins/verify.js');
            if (verifyPlugin.handleDM && await verifyPlugin.handleDM(message, client, db)) return;
        } catch (e) { console.error('[VERIFY DM CRASH]', e); }
    }

        // ── Ticket activity reset ──
        const ticketMod = client.commands.get('ticket');
        if (ticketMod?.onMessageActivity && message.guild) {
            const ss = client.getServerSettings?.(message.guild.id) || {};
            ticketMod.onMessageActivity(message, client, ss);
        }
    try {
        if (message.author.bot) return;
        if (!message.guild) return;

        const guildId = message.guild.id;
        const channelId = message.channel.id;
        const content = message.content.toLowerCase();

        // Fetch matching autoreply — channel-specific first, then guild-wide
        const replies = db.prepare(`
            SELECT * FROM auto_replies
            WHERE guild_id = ?
            AND (channel_id = ? OR channel_id IS NULL)
            ORDER BY channel_id DESC
        `).all(guildId, channelId);

        if (!replies.length) return;

        // Check cooldowns
        if (!client._arCooldowns) client._arCooldowns = new Map();

        for (const reply of replies) {
            const keyword = reply.keyword.toLowerCase();
            // Smart match — keyword found anywhere in message
            if (!content.includes(keyword)) continue;

            // Cooldown check — 60s per keyword per channel
            const cdKey = `${channelId}:${keyword}`;
            const last = client._arCooldowns.get(cdKey);
            if (last && Date.now() - last < 60000) continue;
            client._arCooldowns.set(cdKey, Date.now());

            // Build response
            const { EmbedBuilder } = require('discord.js');
            const color = parseInt(reply.embed_color) || 0x00f0ff;

            let embed;
            if (reply.embed_title) {
                embed = new EmbedBuilder()
                    .setColor(color)
                    .setTitle(reply.embed_title)
                    .setDescription(reply.response)
                    .setFooter({ text: 'BAMAKO_223 🇲🇱', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();
            } else {
                embed = new EmbedBuilder()
                    .setColor(color)
                    .setDescription(reply.response)
                    .setFooter({ text: 'BAMAKO_223 🇲🇱', iconURL: client.user.displayAvatarURL() });
            }
            await message.reply({ embeds: [embed] }).catch(() => {});

            // Update trigger count
            db.prepare('UPDATE auto_replies SET trigger_count = trigger_count + 1 WHERE id = ?').run(reply.id);
            break; // Only trigger first match
        }
    } catch(e) {}
});
};

