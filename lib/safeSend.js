'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — SAFE SEND, for the messages ARCHON posts on its own (welcome, level-up, logs, alerts…)
//   safeSend(feature, channel, payload, opts) → the message, or null. Never throws, unless opts.throwOnError.
//     Checks only what this message really needs (lib/canPost needsOf), sends, and keeps the failure journal
//     (lib/postProblems) up to date: a refusal is recorded and the admins are told, the next success clears it.
//   canSend(feature, channel, needs, opts) → true/false. The same check, before expensive work such as rendering a card.
// opts:
//   guild, channelId   who and which channel to record when the channel object is missing (deleted)
//   quiet              check and send, but record nothing: a fallback channel nobody chose
//   reply              the message is a reply (needs Read Message History)
//   throwOnError       the caller keeps its own error handling: the error is thrown after the journal is updated
// ═══════════════════════════════════════════════════════════════════════════
const canPost = require('./canPost');
const problems = require('./postProblems');

// 50001 Missing Access · 50013 Missing Permissions · 10003 Unknown Channel · 50083 archived thread
// 160002 reply without Read Message History · 160005 locked thread
const REFUSED = new Set([50001, 50013, 10003, 50083, 160002, 160005]);

// A refusal found before sending, worded like Discord's own errors so existing error handling keeps working.
function preError(d) {
    const e = new Error(`${d.reason === 'gone' ? 'Unknown Channel' : 'Missing Permissions'} (checked before sending: ${d.reason})`);
    e.code = 'PRECHECK';
    e.diagnosis = d;
    return e;
}

function canSend(feature, channel, needs, opts = {}) {
    const guild = channel?.guild || opts.guild;
    if (!guild) return false;
    const d = canPost.diagnose(guild, channel, guild.members?.me, needs);
    if (!d.ok) problems.failed(guild, feature, channel?.id || opts.channelId || null, d, null, opts);
    return d.ok;
}

async function safeSend(feature, channel, payload, opts = {}) {
    const guild = channel?.guild || opts.guild;
    if (!guild) {
        if (opts.throwOnError) throw preError({ reason: 'gone' });
        return null;
    }
    const chId = channel?.id || opts.channelId || null;
    const needs = canPost.needsOf(payload, opts);
    const d = canPost.diagnose(guild, channel, guild.members?.me, needs);
    if (!d.ok) {
        problems.failed(guild, feature, chId, d, null, opts);
        if (opts.throwOnError) throw preError(d);
        return null;
    }
    try {
        const msg = await channel.send(payload);
        if (!opts.quiet) problems.sent(guild, feature);
        return msg;
    } catch (e) {
        const code = e?.code ?? e?.rawError?.code;
        if (REFUSED.has(code)) {
            // the cache may be behind Discord: check again, and when it still looks fine, say Discord refused
            let d2 = canPost.diagnose(guild, channel, guild.members?.me, needs);
            if (d2.ok) d2 = { ok: false, reason: code === 10003 ? 'gone' : 'refused', missing: [], role: null };
            problems.failed(guild, feature, chId, d2, code, opts);
        } else {
            console.error(`[safeSend] ${feature} guild=${guild.id}:`, e?.message || e);
        }
        if (opts.throwOnError) throw e;
        return null;
    }
}

module.exports = { safeSend, canSend, REFUSED };
