'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — REPLIES THAT STILL ARRIVE
// A reply quotes the member's message, and Discord refuses it when ARCHON may not read the channel's history
// ("Read Message History"). Every prefix command there then stayed silent. guard(message) makes message.reply
// fall back to a plain message in that one case, so the answer still arrives. Where replies work, nothing changes:
// the fallback only runs after Discord has refused, and only when the history permission is really missing.
// Installed once per message, before every other listener (index.js).
// ═══════════════════════════════════════════════════════════════════════════
const { PermissionFlagsBits: F } = require('discord.js');

const CODES = new Set([50013, 160002]); // Missing Permissions · Cannot reply without permission to read message history

function withoutReply(opts) {
    if (typeof opts === 'string') return { content: opts };
    if (!opts || typeof opts !== 'object') return opts;
    const out = { ...opts };
    delete out.reply;
    delete out.failIfNotExists;
    if (out.allowedMentions && typeof out.allowedMentions === 'object' && 'repliedUser' in out.allowedMentions) {
        out.allowedMentions = { ...out.allowedMentions };
        delete out.allowedMentions.repliedUser;
    }
    return out;
}

function guard(message) {
    if (!message?.guild || typeof message.reply !== 'function' || message._archonReplyGuard) return message;
    const original = message.reply.bind(message);
    message.reply = async (opts) => {
        try {
            return await original(opts);
        } catch (e) {
            const code = e?.code ?? e?.rawError?.code;
            if (!CODES.has(code)) throw e;
            if (opts && typeof opts === 'object' && opts.constructor && opts.constructor !== Object) throw e; // a prepared MessagePayload: leave it
            const perms = message.channel?.permissionsFor?.(message.guild.members?.me);
            if (!perms || perms.has(F.ReadMessageHistory) || typeof message.channel?.send !== 'function') throw e;
            return message.channel.send(withoutReply(opts));
        }
    };
    message._archonReplyGuard = true;
    return message;
}

module.exports = { guard, withoutReply };
