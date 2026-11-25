'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — CONFIRM: one "are you sure?" for every action that can't be undone (erase, replace, mass changes)
// lib/access.js says WHO may do something; this asks the one who started it to CONFIRM before it happens,
// and writes what was done in the moderation log. A command opts in with one definition and one card:
//
//   confirm.define('setup.reset', {
//       access: 'reset',                                  // checked again at the click (lib/access)
//       run: async (ix, client, data, lang) => ({ payload, notice }),   // does it; payload replaces the card
//       log: (lang, data, result) => 'Every ARCHON setting was erased',   // the mod-log line (plain sentence)
//   });
//   reply(confirm.card(client, { action: 'setup.reset', userId, guild, lang, where,
//       title, body, warn?, yes, danger?, data?, extra? }))     // extra: more buttons on the same row
//
// Only the person who opened it can press it (lib/components sessions); it expires after 10 minutes untouched,
// and survives a restart. Texts: lang/<l>/confirmation.json.
// ═══════════════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const components = require('./components');
const { t } = require('./i18n');
const { icon } = require('./ui/icons');

const IDLE_MS = 10 * 60 * 1000;
const AMBER = 0xF59E0B, RED = 0xE74C3C, GREY = 0x8D897F, GREEN = 0x14B53A;
const actions = new Map();
const L = (k, lang, v) => t(`confirmation.${k}`, lang, v || {});   // not 'confirm.': common.json already has a "confirm" word

function define(name, def) { actions.set(name, def); }

function card(client, { action, userId, guild, lang, where = null, title, body, warn = null, yes, danger = false, data = {}, extra = [] }) {
    const { card: v2 } = require('./games/v2');
    const sid = components.create(client.db, { kind: 'confirm', userId, guildId: guild?.id || null, idleMs: IDLE_MS, data: { action, lang, data } });
    const text = `## ${icon('warn', where)} ${title}\n${body}${warn ? `\n${icon('warn', where)} ${warn}` : ''}\n-# ${L('onlyYou', lang, { user: `<@${userId}>` })}`;
    return v2(danger ? RED : AMBER, [
        { text },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(components.id('confirm', sid, 'yes')).setLabel(yes).setStyle(danger ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji(icon('ok', where)),
            ...extra,
            new ButtonBuilder().setCustomId(components.id('confirm', sid, 'no')).setLabel(L('cancel', lang)).setStyle(ButtonStyle.Secondary)) },
    ]);
}

// The moderation log: who confirmed what, in one plain sentence
async function logIt(client, guild, user, line, lang) {
    try {
        if (!guild || !line) return;
        const ch = require('./modlog').resolveModLog(guild, client.db);
        if (!ch) return;
        const { card: v2 } = require('./games/v2');
        await require('./safeSend').safeSend('modlog', ch, v2(GREY, [
            { text: `### ${icon('shield_check', ch)} ${L('logTitle', lang)}\n${line}\n-# ${L('logBy', lang, { user: `<@${user.id}>` })} · <t:${Math.floor(Date.now() / 1000)}:R>` },
        ]));
    } catch (e) { console.error('[CONFIRM] log:', e.message); }
}

components.register('confirm', async (ix, client, { action: button, session, end }) => {
    const { action, lang, data } = session.data;
    const def = actions.get(action);
    const { card: v2 } = require('./games/v2');
    end();
    if (button !== 'yes' || !def) return ix.update(v2(GREY, [{ text: L('cancelled', lang) }])).catch(() => {});
    if (def.access) {   // rights can change in 10 minutes: checked again at the click
        const no = require('./access').deny(ix.member, def.access, lang);
        if (no) return ix.update(v2(GREY, [{ text: no }])).catch(() => {});
    }
    let result = {};
    try { result = (await def.run(ix, client, data, lang)) || {}; }
    catch (e) {
        console.error(`[CONFIRM] ${action}:`, e.message);
        return ix.update(v2(RED, [{ text: L('failed', lang) }])).catch(() => {});
    }
    console.log(`[CONFIRM] ${action} guild=${ix.guildId} by=${ix.user.id}`);
    if (def.log) logIt(client, ix.guild, ix.user, def.log(lang, data, result), lang);
    await ix.update(result.payload || v2(GREEN, [{ text: `${icon('ok', ix)} ${L('done', lang)}` }])).catch(() => {});
    if (result.notice) await ix.followUp({ content: result.notice, flags: 1 << 6, allowedMentions: { parse: [] } }).catch(() => {});
}, { command: 'setup' });

module.exports = { define, card };
