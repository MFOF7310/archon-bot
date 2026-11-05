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

function inviteUrl(clientId, { guildId = null } = {}) {
    return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${PERMISSIONS}&scope=bot%20applications.commands${guildId ? `&guild_id=${guildId}` : ''}`;
}

module.exports = { PERMISSIONS, inviteUrl };
