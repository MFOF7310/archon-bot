'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — APPEALS for the sanctions given with ARCHON's commands (ban, kick, timeout, warning)
// (AutoMod has its own appeals in plugins/automod.js.)
//   1. The member's DM about the sanction carries an Appeal button: attach(container, guildId, caseId, lang)
//   2. They answer two questions in a form (in their DMs)
//   3. The staff get a card in the moderation log (else the owner's DMs) with Accept / Refuse
//   4. Accept lifts what can be lifted: ban → unbanned, timeout → removed, warning → removed, kick → nothing to undo;
//      after a ban or a kick the member gets a lasting link back (lib/rejoin-invite, never a new invite each time)
//   5. The member gets the decision in DM
// Guard rails: one appeal per case, within 7 days of it, only by the sanctioned member; only staff who could have
// given that sanction (or the owner) can decide; a decided appeal can't be decided again.
// customIds (no session: an appeal can wait days): mapl:open:<guild>:<case> · mapl:form:<guild>:<case> · mapl:ok|no:<appeal>
// Texts: lang/<l>/appeals.json
// ═══════════════════════════════════════════════════════════════════════════
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, PermissionFlagsBits: P,
} = require('discord.js');
const { t } = require('./i18n');
const { icon } = require('./ui/icons');

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIONS = { ban: P.BanMembers, kick: P.KickMembers, mute: P.ModerateMembers, warn: P.ModerateMembers };
const COLOR = { open: 0x378ADD, ok: 0x2ECC71, no: 0xE74C3C, grey: 0x8D897F };
const L = (k, lang, v) => t(`appeals.${k}`, lang, v || {});
const EPH = MessageFlags.Ephemeral;
const clip = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const quote = (s) => clip(s, 900).split('\n').map((l) => `> ${l.replace(/[*_~`|>\\]/g, '')}`).join('\n');

let ready = null;
function ensure(db) {
    if (ready === db) return;
    db.prepare(`CREATE TABLE IF NOT EXISTS mod_appeals (
        id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, case_id INTEGER NOT NULL,
        action TEXT NOT NULL, what TEXT, why TEXT, status TEXT NOT NULL DEFAULT 'pending',
        channel_id TEXT, message_id TEXT, decided_by TEXT, created_at INTEGER, decided_at INTEGER,
        UNIQUE (guild_id, case_id))`).run();
    ready = db;
}
const langOf = (client, guildId, userId) => { try { return require('./pick-lang').pickLang(client, guildId, null, userId) || 'en'; } catch { return 'en'; } };
const caseOf = (db, guildId, caseId) => { try { return db.prepare('SELECT * FROM moderation_logs WHERE id = ? AND guild_id = ?').get(Number(caseId), String(guildId)); } catch { return null; } };

/** Adds the "Appeal" line and button to the DM card of a sanction. Returns the container. */
function attach(container, guildId, caseId, lang) {
    if (!caseId) return container;
    try {
        const { TextDisplayBuilder } = require('discord.js');
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${L('dmHint', lang)}`));
        container.addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mapl:open:${guildId}:${caseId}`).setLabel(L('btnAppeal', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('gavel'))));
    } catch (e) { console.error('[APPEALS] attach:', e.message); }
    return container;
}

// Can this case be appealed by this person right now? Returns { c, guild } or { error }
async function checkCase(client, guildId, caseId, userId) {
    const db = client.db;
    ensure(db);
    const c = caseOf(db, guildId, caseId);
    if (!c || c.user_id !== userId || !ACTIONS[c.action]) return { error: 'notYours' };
    if (Date.now() - Number(c.timestamp) * 1000 > WINDOW_MS) return { error: 'tooLate' };
    if (db.prepare('SELECT 1 FROM mod_appeals WHERE guild_id = ? AND case_id = ?').get(String(guildId), Number(caseId))) return { error: 'already' };
    const guild = client.guilds.cache.get(String(guildId));
    if (!guild) return { error: 'gone' };
    return { c, guild };
}

function staffCard(guild, a, user, lang, decided = null) {
    const { card } = require('./games/v2');
    const kind = L(`act_${a.action}`, lang);
    const head = `### ${icon('gavel')} ${L('staffTitle', lang, { id: a.id, user: user?.username || a.user_id })}\n-# ${kind} · ${L('case', lang, { id: a.case_id })} · <@${a.user_id}>`;
    const items = [
        user ? { thumbnail: [head, user.displayAvatarURL({ size: 128 })] } : { text: head },
        { rule: true },
        { text: `**${L('qWhat', lang)}**\n${quote(a.what)}` },
        { text: `**${L('qWhy', lang)}**\n${quote(a.why)}` },
    ];
    if (decided) items.push({ rule: true }, { text: `${icon(decided.ok ? 'ok' : 'no')} ${L(decided.ok ? 'decidedOk' : 'decidedNo', lang, { by: `<@${decided.by}>` })}${decided.note ? `\n-# ${decided.note}` : ''}` });
    else items.push({ row: new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`mapl:ok:${a.id}`).setLabel(L('btnAccept', lang)).setStyle(ButtonStyle.Success).setEmoji(icon('ok')),
        new ButtonBuilder().setCustomId(`mapl:no:${a.id}`).setLabel(L('btnRefuse', lang)).setStyle(ButtonStyle.Danger).setEmoji(icon('no'))) },
    { text: `-# ${L('staffHint', lang, { act: kind })}` });
    return { ...card(decided ? (decided.ok ? COLOR.ok : COLOR.no) : COLOR.open, items), allowedMentions: { parse: [] } };
}

// Lifts what the sanction did. Returns a short note for the staff card (or null).
async function lift(client, guild, a, staff, lang) {
    const reason = `Appeal #${a.id} accepted by ${staff.username} (${staff.id})`.slice(0, 512);
    if (a.action === 'ban') {
        const ok = await guild.bans.remove(a.user_id, reason).then(() => true).catch(() => false);
        return ok ? L('liftBan', lang) : L('liftBanFail', lang);
    }
    if (a.action === 'mute') {
        const m = await guild.members.fetch(a.user_id).catch(() => null);
        if (!m) return L('liftMuteGone', lang);
        const ok = await m.timeout(null, reason).then(() => true).catch(() => false);
        return ok ? L('liftMute', lang) : L('liftMuteFail', lang);
    }
    if (a.action === 'warn') {
        const c = caseOf(client.db, guild.id, a.case_id);
        if (c?.warning_id) { try { client.db.prepare('UPDATE warnings SET active = 0 WHERE id = ? AND guild_id = ?').run(c.warning_id, guild.id); } catch { /* table gone */ } }
        return L('liftWarn', lang);
    }
    return L('liftKick', lang);
}

// ── clicks and the form ──
async function handle(ix, client) {
    const db = client.db;
    ensure(db);
    const parts = String(ix.customId).split(':');
    const step = parts[1];

    // 1. the member opens the form (in their DMs)
    if (step === 'open' && ix.isButton()) {
        const [, , guildId, caseId] = parts;
        const lang = langOf(client, guildId, ix.user.id);
        const r = await checkCase(client, guildId, caseId, ix.user.id);
        if (r.error) return ix.reply({ content: L(`err_${r.error}`, lang), flags: EPH }).catch(() => {});
        const modal = new ModalBuilder().setCustomId(`mapl:form:${guildId}:${caseId}`).setTitle(L('formTitle', lang, { server: clip(r.guild.name, 30) }).slice(0, 45));
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('what').setLabel(L('qWhat', lang).slice(0, 45)).setStyle(TextInputStyle.Paragraph).setMinLength(10).setMaxLength(800).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('why').setLabel(L('qWhy', lang).slice(0, 45)).setStyle(TextInputStyle.Paragraph).setMinLength(10).setMaxLength(800).setRequired(true)));
        return ix.showModal(modal).catch(() => {});
    }

    // 2. the form comes back: saved once, then sent to the staff
    if (step === 'form' && ix.isModalSubmit()) {
        const [, , guildId, caseId] = parts;
        const lang = langOf(client, guildId, ix.user.id);
        const r = await checkCase(client, guildId, caseId, ix.user.id);
        if (r.error) return ix.reply({ content: L(`err_${r.error}`, lang), flags: EPH }).catch(() => {});
        await ix.deferReply({ flags: EPH }).catch(() => {});
        let id;
        try {
            id = Number(db.prepare('INSERT INTO mod_appeals (guild_id, user_id, case_id, action, what, why, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(guildId, ix.user.id, Number(caseId), r.c.action, clip(ix.fields.getTextInputValue('what'), 800), clip(ix.fields.getTextInputValue('why'), 800), Date.now()).lastInsertRowid);
        } catch { return ix.editReply({ content: L('err_already', lang) }).catch(() => {}); }
        const a = db.prepare('SELECT * FROM mod_appeals WHERE id = ?').get(id);
        const slang = langOf(client, guildId);
        const payload = staffCard(r.guild, a, ix.user, slang);
        let msg = null;
        const ch = require('./modlog').resolveModLog(r.guild, db);
        if (ch) msg = await require('./safeSend').safeSend('modlog', ch, payload);
        if (!msg) { const owner = await r.guild.fetchOwner().catch(() => null); if (owner) msg = await owner.send(payload).catch(() => null); }
        if (msg) db.prepare('UPDATE mod_appeals SET channel_id = ?, message_id = ? WHERE id = ?').run(msg.channelId, msg.id, id);
        console.log(`[APPEALS] #${id} guild=${guildId} user=${ix.user.id} case=${caseId} ${r.c.action} → ${msg ? 'staff' : 'nobody (no log channel, closed DMs)'}`);
        return ix.editReply({ content: L(msg ? 'sent' : 'sentNobody', lang, { server: r.guild.name }) }).catch(() => {});
    }

    // 3. the staff decide
    if ((step === 'ok' || step === 'no') && ix.isButton()) {
        const a = db.prepare('SELECT * FROM mod_appeals WHERE id = ?').get(Number(parts[2]));
        const lang = langOf(client, a?.guild_id, ix.user.id);
        if (!a) return ix.reply({ content: L('err_notFound', lang), flags: EPH }).catch(() => {});
        if (a.status !== 'pending') return ix.reply({ content: L('err_decided', lang), flags: EPH }).catch(() => {});
        const guild = client.guilds.cache.get(a.guild_id);
        if (!guild) return ix.reply({ content: L('err_gone', lang), flags: EPH }).catch(() => {});
        const member = ix.guildId === guild.id ? ix.member : await guild.members.fetch(ix.user.id).catch(() => null);
        const allowed = ix.user.id === guild.ownerId || member?.permissions?.has?.(ACTIONS[a.action]);
        if (!allowed) return ix.reply({ content: L('err_staffOnly', lang, { act: L(`act_${a.action}`, lang) }), flags: EPH }).catch(() => {});
        // claimed first, so two staff pressing at once can't both decide
        const claimed = db.prepare("UPDATE mod_appeals SET status = ?, decided_by = ?, decided_at = ? WHERE id = ? AND status = 'pending'").run(step === 'ok' ? 'accepted' : 'refused', ix.user.id, Date.now(), a.id);
        if (!claimed.changes) return ix.reply({ content: L('err_decided', lang), flags: EPH }).catch(() => {});
        await ix.deferUpdate().catch(() => {});
        const slang = langOf(client, guild.id);
        const note = step === 'ok' ? await lift(client, guild, a, ix.user, slang) : null;
        try { require('./mod-core').record(db, { guildId: guild.id, userId: a.user_id, moderatorId: ix.user.id, action: step === 'ok' ? 'appeal_accepted' : 'appeal_refused', reason: `Appeal #${a.id} (case #${a.case_id})` }); } catch { /* journal only */ }
        const user = await client.users.fetch(a.user_id).catch(() => null);
        await ix.editReply(staffCard(guild, a, user, slang, { ok: step === 'ok', by: ix.user.id, note })).catch(() => {});
        // the member hears the decision; after a ban or a kick, with the way back in
        if (user) {
            const mlang = langOf(client, guild.id, user.id);
            const { card } = require('./games/v2');
            const items = [{ text: `### ${icon(step === 'ok' ? 'ok' : 'no')} ${L(step === 'ok' ? 'dmOkTitle' : 'dmNoTitle', mlang, { server: guild.name })}\n${L(step === 'ok' ? `dmOk_${a.action}` : 'dmNo', mlang)}` }];
            if (step === 'ok' && (a.action === 'ban' || a.action === 'kick')) {
                const url = await require('./rejoin-invite').rejoinUrl(db, guild);
                if (url) items.push({ row: new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(L('btnRejoin', mlang)).setEmoji(icon('ch_welcome'))) });
            }
            await user.send(card(step === 'ok' ? COLOR.ok : COLOR.grey, items)).catch(() => {});
        }
        console.log(`[APPEALS] #${a.id} ${step === 'ok' ? 'accepted' : 'refused'} by=${ix.user.id}`);
        return;
    }
    return ix.deferUpdate?.().catch(() => {});
}

module.exports = { attach, handle };
