// /invest — place credits and get them back with interest: 2.5 % per 6 hours, up to +10 % after 24 hours.
// At most 10 000 credits placed at once per server. One card with the stakes, what a withdrawal pays now,
// and buttons: withdraw, place (a small form) and refresh. The card changes in place.
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { t } = require('../lib/i18n');
const { card } = require('../lib/games/v2');
let EMOJIS = {}; try { EMOJIS = require('../config/emojis'); } catch {}
const em = (k, fb) => EMOJIS[k] || fb;

const STEP = 0.025, CAP = 0.10, MAX_ACTIVE = 10000, MIN = 100;
// Stakes placed before these rules keep the return they were promised (8 % per 6 h, up to 48 %)
const NEW_RULES_AT = Date.parse('2026-11-11T19:45:00Z');

function calculateReturn(amount, investedAt) {
    const hours = Math.max(0, (Date.now() - investedAt) / 3600000);
    const old = investedAt < NEW_RULES_AT;
    const rate = Math.min((old ? 0.08 : STEP) * Math.floor(hours / 6), old ? 0.48 : CAP);
    const bonus = Math.floor(amount * rate);
    return { returnAmount: amount + bonus, profit: bonus, hoursHeld: Math.floor(hours), pct: Math.round(rate * 100), full: rate >= (old ? 0.48 : CAP) };
}

function ensureInvestTable(db) {
    db.prepare(`CREATE TABLE IF NOT EXISTS investments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, guild_id TEXT NOT NULL DEFAULT 'DM', amount INTEGER NOT NULL, invested_at INTEGER NOT NULL, claimed INTEGER DEFAULT 0, total_profit INTEGER DEFAULT 0, platform TEXT DEFAULT 'discord')`).run();
    try { db.prepare("ALTER TABLE investments ADD COLUMN guild_id TEXT NOT NULL DEFAULT 'DM'").run(); } catch {}
}

const L = (lang) => (k, v) => t('invest.' + k, lang, v || {});
const num = (n, lang) => Number(n || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
const bar = (pct, cap) => { const f = Math.round(Math.min(1, pct / cap) * 10); return '▰'.repeat(f) + '▱'.repeat(10 - f); };

function balance(client, db, uid, gid) {
    if (client.liveCredits) return client.liveCredits(uid, gid);
    const u = client.getUserData ? client.getUserData(uid, gid) : db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(uid, gid);
    return Number(u?.credits || 0);
}
// Sets the new balance through the bot's safe path: memory, the waiting save and the database all get it
function setBalance(client, db, uid, gid, credits) {
    if (client.addCredits && client.removeCredits && client.liveCredits) {
        const now = client.liveCredits(uid, gid);
        if (credits > now) client.addCredits(uid, gid, credits - now);
        else if (credits < now) client.removeCredits(uid, gid, now - credits);
        return;
    }
    db.prepare('UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?').run(credits, uid, gid);
    if (client.queueUserUpdate) client.queueUserUpdate(uid, gid, { credits });
    const c = client.userDataCache?.get?.(`${uid}:${gid}`); if (c) c.credits = credits;
}
const active = (db, uid, gid) => db.prepare('SELECT * FROM investments WHERE user_id = ? AND guild_id = ? AND claimed = 0 ORDER BY invested_at ASC').all(uid, gid);

// The card. note: a line on top after an action (placed, withdrawn, an error)
function view(client, db, uid, gid, lang, note = '') {
    const _ = L(lang);
    const list = active(db, uid, gid);
    const items = [{ text: `## ${em('invest', '📈')} ${_('title')}\n-# ${_('rule', { step: lang === 'fr' ? '2,5' : '2.5', cap: 10 })}` }];
    if (note) items.push({ text: note });
    items.push({ rule: true });
    let total = 0, back = 0;
    if (list.length) {
        const lines = list.slice(0, 6).map((i) => {
            const r = calculateReturn(i.amount, i.invested_at);
            total += i.amount; back += r.returnAmount;
            const old = i.invested_at < NEW_RULES_AT;
            return `**${num(i.amount, lang)}** ${em('coins', '🪙')} · ${_('ago', { h: r.hoursHeld })}\n\`${bar(r.pct, old ? 48 : 10)}\` +${r.pct} %${r.full ? ` · ${_('full')}` : ''}`;
        });
        for (const i of list.slice(6)) { const r = calculateReturn(i.amount, i.invested_at); total += i.amount; back += r.returnAmount; }
        if (list.length > 6) lines.push(`-# ${_('more', { n: list.length - 6 })}`);
        items.push({ text: lines.join('\n') }, { rule: true });
        items.push({ text: `${_('now', { back: num(back, lang), profit: num(back - total, lang) })}\n-# ${_('bal', { bal: num(balance(client, db, uid, gid), lang), room: num(Math.max(0, MAX_ACTIVE - total), lang) })}` });
    } else {
        items.push({ text: `${_('empty')}\n-# ${_('bal', { bal: num(balance(client, db, uid, gid), lang), room: num(MAX_ACTIVE, lang) })}` });
    }
    const b = (id, label, emoji, style = ButtonStyle.Secondary, disabled = false) => {
        const x = new ButtonBuilder().setCustomId(`inv:${id}:${uid}`).setStyle(style).setDisabled(disabled);
        if (label) x.setLabel(label); if (emoji) x.setEmoji(emoji); return x;
    };
    items.push({ row: new ActionRowBuilder().addComponents(
        b('claim', _('b_claim'), em('ic_ok', '💰'), ButtonStyle.Success, !list.length),
        b('add', _('b_add'), em('ic_add', '➕'), ButtonStyle.Secondary, total >= MAX_ACTIVE),
        b('ref', null, em('ic_refresh', '🔄')),
    ) });
    return card(0x1d9e75, items);
}

// Placing: checks, takes the credits, records the stake. Returns the line shown on the card.
function place(client, db, uid, gid, amount, lang, settings, member) {
    const _ = L(lang);
    if (!Number.isInteger(amount) || amount < MIN) return `${em('ic_warn', '⚠️')} ${_('min', { min: MIN })}`;
    const placed = active(db, uid, gid).reduce((s, i) => s + i.amount, 0);
    if (placed + amount > MAX_ACTIVE) return `${em('ic_warn', '⚠️')} ${_('max', { max: num(MAX_ACTIVE, lang), room: num(Math.max(0, MAX_ACTIVE - placed), lang) })}`;
    const have = balance(client, db, uid, gid);
    if (have < amount) return `${em('ic_warn', '⚠️')} ${_('poor', { bal: num(have, lang) })}`;
    setBalance(client, db, uid, gid, have - amount);
    db.prepare("INSERT INTO investments (id, user_id, guild_id, amount, invested_at, claimed, platform) VALUES (?, ?, ?, ?, ?, 0, 'discord')").run(`${uid}_${gid}_${Date.now()}`, uid, gid, amount, Date.now());
    // The investor role, when the server has one
    try {
        const rid = settings?.investorRoleId || process.env.INVESTOR_ROLE_ID;
        const role = rid && member?.guild?.roles.cache.get(rid);
        if (role && !member.roles.cache.has(rid)) member.roles.add(role, 'Investment placed').catch(() => {});
    } catch {}
    return `${em('ic_ok', '✅')} ${_('placed', { amount: num(amount, lang) })}`;
}

function claim(client, db, uid, gid, lang) {
    const _ = L(lang);
    const list = active(db, uid, gid);
    if (!list.length) return `${em('ic_warn', '⚠️')} ${_('nothing')}`;
    let inv = 0, back = 0;
    const mark = db.prepare('UPDATE investments SET claimed = 1, total_profit = ? WHERE id = ? AND claimed = 0');
    db.transaction(() => { for (const i of list) { const r = calculateReturn(i.amount, i.invested_at); if (mark.run(r.profit, i.id).changes) { inv += i.amount; back += r.returnAmount; } } })();
    if (!back) return `${em('ic_warn', '⚠️')} ${_('nothing')}`;
    setBalance(client, db, uid, gid, balance(client, db, uid, gid) + back);
    return `${em('ic_ok', '✅')} ${_('claimed', { back: num(back, lang), profit: num(back - inv, lang) })}`;
}

const pickLang = (client, gid, x, uid) => require('../lib/pick-lang').pickLang(client, gid, x, uid);

module.exports = {
    name: 'invest',
    aliases: ['stake', 'investir', 'miser'],
    description: 'Place credits and get them back with interest (up to +10 % after 24 h)',
    category: 'ECONOMY',
    cooldown: 3000,
    calculateReturn,

    data: new SlashCommandBuilder().setName('invest').setDescription('📈 Place credits and get them back with interest')
        .addSubcommand((s) => s.setName('status').setDescription('Your stakes and what a withdrawal pays now'))
        .addSubcommand((s) => s.setName('stake').setDescription('Place credits').addIntegerOption((o) => o.setName('amount').setDescription(`Credits (${MIN} to ${MAX_ACTIVE})`).setRequired(true).setMinValue(MIN).setMaxValue(MAX_ACTIVE)))
        .addSubcommand((s) => s.setName('claim').setDescription('Withdraw everything with the interest earned')),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        ensureInvestTable(db);
        const uid = message.author.id, gid = message.guild?.id || 'DM';
        lang = lang || pickLang(client, message.guild?.id, message, uid);
        const a = String(args[0] || '').toLowerCase();
        let note = '';
        if (['claim', 'réclamer', 'reclamer', 'retirer'].includes(a)) note = claim(client, db, uid, gid, lang);
        else if (a && !['status', 'statut'].includes(a)) note = place(client, db, uid, gid, parseInt(a, 10), lang, serverSettings, message.member);
        return message.reply({ ...view(client, db, uid, gid, lang, note), allowedMentions: { repliedUser: false } }).catch(() => {});
    },

    execute: async (interaction, client) => {
        const db = client.db; ensureInvestTable(db);
        const uid = interaction.user.id, gid = interaction.guild?.id || 'DM';
        const lang = pickLang(client, interaction.guildId, interaction, uid);
        const sub = interaction.options.getSubcommand();
        let note = '';
        if (sub === 'claim') note = claim(client, db, uid, gid, lang);
        if (sub === 'stake') note = place(client, db, uid, gid, interaction.options.getInteger('amount'), lang, client.getServerSettings?.(gid), interaction.member);
        return interaction.reply(view(client, db, uid, gid, lang, note)).catch(() => {});
    },

    // Buttons and the "place" form. Someone else's buttons answer with that person's own private card.
    handleComponent: async (interaction, client) => {
        const db = client.db; ensureInvestTable(db);
        const [, act, owner] = interaction.customId.split(':');
        const uid = interaction.user.id, gid = interaction.guild?.id || 'DM';
        const lang = pickLang(client, interaction.guildId, interaction, uid);
        const _ = L(lang);
        if (uid !== owner) return interaction.reply({ ...view(client, db, uid, gid, lang), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});

        if (interaction.isButton() && act === 'add') {
            const room = Math.max(0, MAX_ACTIVE - active(db, uid, gid).reduce((s, i) => s + i.amount, 0));
            const modal = new ModalBuilder().setCustomId(`inv:modal:${uid}`).setTitle(_('form_title').slice(0, 45)).addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel(_('form_label', { room: num(room, lang) }).slice(0, 45))
                    .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(6).setPlaceholder(String(Math.min(room, 1000)))));
            return interaction.showModal(modal).catch(() => {});
        }
        let note = '';
        if (interaction.isModalSubmit() && act === 'modal') note = place(client, db, uid, gid, parseInt(String(interaction.fields.getTextInputValue('amount')).replace(/\D/g, ''), 10), lang, client.getServerSettings?.(gid), interaction.member);
        if (interaction.isButton() && act === 'claim') note = claim(client, db, uid, gid, lang);
        const v = view(client, db, uid, gid, lang, note);
        if (interaction.isModalSubmit() && !interaction.message) return interaction.reply(v).catch(() => {});
        return interaction.update(v).catch(() => {});
    },
};
