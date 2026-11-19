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

        const ar = require('../../plugins/autoreply.js');
        for (const reply of replies) {
            // the keyword as a whole word or phrase ("hi" used to fire on "this" and "machine")
            if (!ar.matches(content, reply.keyword)) continue;

            // Cooldown check — 60s per keyword per channel
            const cdKey = `${channelId}:${String(reply.keyword).toLowerCase()}`;
            const last = client._arCooldowns.get(cdKey);
            if (last && Date.now() - last < 60000) continue;
            client._arCooldowns.set(cdKey, Date.now());
            if (client._arCooldowns.size > 5000) client._arCooldowns.clear();

            await message.reply({ ...ar.replyCard(reply), allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});

            // Update trigger count
            db.prepare('UPDATE auto_replies SET trigger_count = trigger_count + 1 WHERE id = ?').run(reply.id);
            break; // Only trigger first match
        }
    } catch(e) {}
});
};

