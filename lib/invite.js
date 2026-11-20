'use strict';
// ═══ ARCHON CG-223 — THE INVITE LINK, in one place ═══
// The permissions ARCHON asks for when a server adds it. The dashboard (src/lib/links.ts, api/routers/guild-router.ts)
// and the static pages in docs/ use the same number: change them together.
//   View Channel, Send Messages, Send Messages in Threads, Embed Links, Attach Files, Read Message History,
//   Use External Emojis, Add Reactions                       posting, cards, images, polls
//   Manage Roles                                             verification, automatic and level roles
//   Manage Channels                                          tickets
//   Manage Messages, Timeout Members, Kick, Ban, Manage Server   moderation and AutoMod
//   Connect, Speak                                           music
//   View Audit Log                                           who added ARCHON, so the welcome reaches that person
const PERMISSIONS = '2253174475189494';

// Links the bot posts go through the site (archon223.com/go/<source>): the add is counted on the owner's Arrivals page
// (instead of "unknown"), and Discord then brings the person back to the site's setup assistant.
// The site's /go/ route uses the same permissions (api/boot.ts). clientId is kept for the direct fallback.
const SITE = (process.env.DASHBOARD_URL || 'https://archon223.com').replace(/\/+$/, '');

function inviteUrl(clientId, { guildId = null, source = 'bot' } = {}) {
    const src = /^[a-z0-9-]{1,20}$/.test(source) ? source : 'bot';
    const guild = /^\d{15,25}$/.test(String(guildId || '')) ? `?guild=${guildId}` : '';
    return `${SITE}/go/${src}${guild}`;
}

// The plain Discord link, for the rare case the site itself is the subject (not used by the cards)
function directInviteUrl(clientId, { guildId = null } = {}) {
    return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${PERMISSIONS}&scope=bot%20applications.commands${guildId ? `&guild_id=${guildId}` : ''}`;
}

module.exports = { PERMISSIONS, inviteUrl, directInviteUrl };
