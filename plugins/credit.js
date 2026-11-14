// /credit, .bal, .donate — balance, sending credits, leaderboard. /transfer and .pay (plugins/transfer.js) use the same flow.
//   Balance: one gold card with the amount, the place on the server, the last transfers, and buttons.
//   Sending: typed commands ask to confirm on one card that becomes the receipt; the Send button asks who (private
//   member menu) then how much (a form), and posts the receipt.
//   Money only moves through client.transferCredits(): both balances change together, in memory and in the database.
// Buttons, the member menu and the form use fixed ids (credit:...) routed from index.js, so they survive a restart.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, MessageFlags, UserSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const v2 = require('../lib/games/v2');
const i18n = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const { icon } = require('../lib/ui/icons');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };

const GOLD = 0xE6A817, GREEN = 0x3BA55D, GREY = 0x4E5058, BLURPLE = 0x5865F2;
const CONFIRM_TTL = 5 * 60 * 1000;      // a confirm card can be used for 5 minutes
const MAX_AMOUNT = 1_000_000_000;
const PRIVATE = MessageFlags.Ephemeral;

const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString('en-US').replace(/,/g, ' ');
const levelOf = (xp) => Math.floor(0.1 * Math.sqrt(xp || 0)) + 1;
const nameOf = (member, user) => member?.displayName || user?.globalName || user?.username || 'Unknown';

// Texts and the server's own currency (name and emoji set in the dashboard; "credits" otherwise)
function words(client, guildId, lang) {
    const t = (k, v) => i18n.t('credit.' + k, lang, v);
    const s = client.getServerSettings?.(guildId) || {};
    const unit = String(s.currencyName || '').trim().slice(0, 24) || t('unit');
    const coin = String(s.currencyEmoji || '').trim() || em('coins', '🪙');
    return { t, unit, coin, money: (n) => `${fmt(n)} ${unit}`, prefix: s.prefix || '.' };
}

// "500", "1 000", "1,000", "2.5k", "1m" → a whole number, or null
function parseAmount(raw) {
    const s = String(raw ?? '').trim().toLowerCase().replace(/[\s  _]/g, '');
    let n = null;
    if (/^\d+$/.test(s)) n = Number(s);
    else if (/^\d{1,3}([.,]\d{3})+$/.test(s)) n = Number(s.replace(/[.,]/g, ''));
    else if (/^\d+([.,]\d+)?[km]$/.test(s)) n = Math.round(parseFloat(s.replace(',', '.')) * (s.endsWith('m') ? 1e6 : 1e3));
    return Number.isSafeInteger(n) && n >= 1 && n <= MAX_AMOUNT ? n : null;
}

const note = (color, text, sub) => v2.card(color, [{ text: sub ? `${text}\n-# ${sub}` : text }]);

// ─── balance ───
function balanceCard(client, guild, viewer, target, targetMember, lang) {
    const w = words(client, guild.id, lang);
    const own = viewer.id === target.id;
    // Looking at someone never creates their account; your own is created with the server's starting balance
    const row = own ? (client.getUserData?.(target.id, guild.id) || client.getOrCreateUser?.(target.id, guild.id, target.username)) : client.getUserData?.(target.id, guild.id);
    const credits = row ? client.liveCredits(target.id, guild.id) : 0;
    const level = row ? Math.max(Number(row.level) || 1, levelOf(row.xp)) : 1;
    let place = null;
    if (credits > 0) {
        try { place = client.db.prepare('SELECT COUNT(*) AS n FROM users WHERE guild_id = ? AND credits > ?').get(guild.id, credits).n + 1; } catch { place = null; }
    }
    const name = nameOf(targetMember, target);
    const head = `-# ${w.t('balOf', { name })}\n## ${w.coin} ${fmt(credits)} ${w.unit}\n-# ${place ? w.t('balLine', { rank: place, server: guild.name, level }) : w.t('balLineNoRank', { level })}`;
    const items = [{ thumbnail: [head, target.displayAvatarURL({ extension: 'png', size: 128 })] }];

    if (own) {
        let moves = [];
        try {
            moves = client.db.prepare('SELECT sender_id, receiver_id, amount, timestamp FROM transfers WHERE guild_id = ? AND (sender_id = ? OR receiver_id = ?) ORDER BY timestamp DESC LIMIT 2')
                .all(guild.id, target.id, target.id);
        } catch { moves = []; }
        if (moves.length) {
            items.push({ rule: true });
            items.push({ text: `-# ${w.t('moves')}\n` + moves.map((m) => {
                const out = m.sender_id === target.id;
                return w.t(out ? 'moveOut' : 'moveIn', { amount: w.money(m.amount), user: `<@${out ? m.receiver_id : m.sender_id}>`, when: `<t:${Math.floor(m.timestamp / 1000)}:R>` });
            }).join('\n') });
        }
        items.push({ row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('credit:send').setLabel(w.t('btnSend')).setEmoji(icon('send')).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('credit:lb').setLabel(w.t('btnBoard')).setEmoji(icon('trophy')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('credit:shop').setLabel(w.t('btnShop')).setEmoji(icon('shop')).setStyle(ButtonStyle.Secondary),
        ) });
    } else {
        items.push({ row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`credit:to:${target.id}`).setLabel(w.t('btnSendTo', { name: name.slice(0, 40) }).slice(0, 80)).setEmoji(icon('send')).setStyle(ButtonStyle.Primary),
        ) });
    }
    return v2.card(GOLD, items);
}

// ─── sending ───
// Every reason a transfer can't start, as a text; null when it can
function refusal(client, guild, from, to, amount, w) {
    if (!guild) return w.t('errServer');
    if (!to) return w.t('errNoUser');
    if (to.id === from.id) return w.t('errSelf');
    if (to.bot) return w.t('errBot');
    if (!amount) return w.t('errAmount');
    const have = client.liveCredits(from.id, guild.id);
    if (have < amount) return w.t('errPoor', { have: w.money(have), need: w.money(amount) });
    return null;
}

// Moves the credits and builds the public receipt. { ok, payload } or { ok: false, text }
async function send(client, guild, from, fromMember, to, amount, lang) {
    const w = words(client, guild?.id, lang);
    const no = refusal(client, guild, from, to, amount, w);
    if (no) return { ok: false, text: no };
    const wait = client.rateWait?.(`credit-send:${from.id}`, 5, 60000) || 0;   // 5 transfers a minute per member
    if (wait) return { ok: false, text: w.t('errFast', { s: wait }) };

    const r = client.transferCredits(from.id, to.id, guild.id, amount, { from: from.username, to: to.username });
    if (!r.ok) {
        if (r.error === 'INSUFFICIENT_FUNDS') return { ok: false, text: w.t('errPoor', { have: w.money(r.previous), need: w.money(amount) }) };
        return { ok: false, text: w.t('errFailed') };
    }
    console.log(`[CREDIT] ${from.username} sent ${amount} to ${to.username} in ${guild.name}`);

    // The recipient is told once, in a DM, in their own language. Closed DMs: the receipt in the channel is enough.
    const wl = words(client, guild.id, pickLang(client, guild.id, null, to.id));
    to.send(v2.card(GREEN, [
        { text: `### ${wl.coin} ${wl.t('dmTitle', { amount: wl.money(amount), from: nameOf(fromMember, from) })}` },
        { text: `-# ${wl.t('dmSub', { server: guild.name, balance: wl.money(r.to.current) })}` },
    ])).catch(() => {});

    const name = nameOf(fromMember, from);
    return { ok: true, payload: v2.card(GREEN, [
        { text: `### ${em('ic_ok', '✅')} ${w.t('sentTitle', { from: name, amount: w.money(amount), user: `<@${to.id}>` })}` },
        { text: `-# ${w.t('sentSub', { from: name, left: w.money(r.from.current) })}` },
    ]) };
}

// Typed commands (/credit pay, .pay, /transfer): one card asks to confirm, then becomes the receipt
function confirmCard(client, guild, from, to, amount, lang) {
    const w = words(client, guild.id, lang);
    const left = client.liveCredits(from.id, guild.id) - amount;
    return v2.card(BLURPLE, [
        { text: `### ${w.t('confirmTitle', { amount: w.money(amount), user: `<@${to.id}>` })}\n-# ${w.t('confirmSub', { left: w.money(left) })}` },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`credit:ok:${from.id}:${to.id}:${amount}:${Math.floor(Date.now() / 1000)}`)
                .setLabel(w.t('btnConfirm', { amount: w.money(amount) }).slice(0, 80)).setEmoji(icon('send')).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`credit:no:${from.id}`).setLabel(w.t('btnCancel')).setStyle(ButtonStyle.Secondary),
        ) },
    ]);
}

// where: { guild, user, member, lang, reply(payload, isPrivate) }
async function askToPay(client, where, to, amount) {
    const w = words(client, where.guild?.id, where.lang);
    const no = refusal(client, where.guild, where.user, to, amount, w);
    if (no) return where.reply({ content: no }, true);
    return where.reply(confirmCard(client, where.guild, where.user, to, amount, where.lang), false);
}

function amountModal(w, to, toName) {
    return new ModalBuilder().setCustomId(`credit:amt:${to.id}`).setTitle(w.t('modalTitle', { name: toName }).slice(0, 45))
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount')
            .setLabel(w.t('modalLabel', { unit: w.unit }).slice(0, 45)).setPlaceholder('500').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(15)));
}

// ─── buttons, member menu and form ───
async function handleComponent(interaction, client) {
    const guild = interaction.guild;
    const lang = pickLang(client, interaction.guildId, interaction, interaction.user.id);
    const w = words(client, interaction.guildId, lang);
    const [, what, a, b, c, d] = interaction.customId.split(':');
    const say = (text) => interaction.reply({ content: text, flags: PRIVATE }).catch(() => {});
    if (!guild) return say(w.t('errServer'));

    if (what === 'send') {
        const have = client.liveCredits(interaction.user.id, guild.id);
        return interaction.reply({ ...v2.card(BLURPLE, [
            { text: `### ${w.t('pickTitle')}` },
            { row: new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('credit:pick').setPlaceholder(w.t('pickPlaceholder')).setMinValues(1).setMaxValues(1)) },
            { text: `-# ${w.t('pickHint', { amount: w.money(have) })}` },
        ]), flags: MessageFlags.IsComponentsV2 | PRIVATE }).catch(() => {});
    }

    if (what === 'pick' || what === 'to') {
        const to = what === 'pick' ? interaction.users?.first() : await client.users.fetch(a).catch(() => null);
        if (!to) return say(w.t('errNoUser'));
        if (to.id === interaction.user.id) return say(w.t('errSelf'));
        if (to.bot) return say(w.t('errBot'));
        const member = what === 'pick' ? interaction.members?.first() : guild.members.cache.get(to.id);
        return interaction.showModal(amountModal(w, to, nameOf(member, to))).catch(() => {});
    }

    if (what === 'amt') {
        const to = await client.users.fetch(a).catch(() => null);
        const amount = parseAmount(interaction.fields.getTextInputValue('amount'));
        const r = await send(client, guild, interaction.user, interaction.member, to, amount, lang);
        if (!r.ok) return say(r.text);
        // From the private member menu: that card closes and the receipt goes to the channel
        if (interaction.isFromMessage?.() && interaction.message?.flags?.has?.(PRIVATE)) {
            await interaction.update({ ...note(GREY, w.t('sentPrivate')), flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            return interaction.followUp(r.payload).catch(() => {});
        }
        return interaction.reply(r.payload).catch(() => {});
    }

    if (what === 'ok' || what === 'no') {
        if (interaction.user.id !== a) return say(w.t('errNotYours', { user: `<@${a}>` }));
        const done = (card) => interaction.update({ ...card, flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        if (what === 'no') return done(note(GREY, w.t('cancelled')));
        if (Date.now() - Number(d) * 1000 > CONFIRM_TTL) return done(note(GREY, w.t('expired')));
        const to = await client.users.fetch(b).catch(() => null);
        const r = await send(client, guild, interaction.user, interaction.member, to, parseAmount(c), lang);
        return done(r.ok ? r.payload : note(GREY, r.text));
    }

    if (what === 'lb') {
        const card = await require('./leaderboard').cardFor(client, guild, interaction.user.id, 'credits', lang, interaction).catch(() => null);
        if (!card) return say(w.t('noBoard'));
        return interaction.reply({ ...card, flags: MessageFlags.IsComponentsV2 | PRIVATE, allowedMentions: { parse: [] } }).catch(() => {});
    }

    if (what === 'shop') {
        const shop = client.commands.get('shop');
        if (!shop?.execute) return say(w.t('shopGone'));
        return shop.execute(interaction, client, { private: true }).catch((e) => console.error('[CREDIT] shop button:', e.message));
    }
}

// ─── commands ───
const PAY_WORDS = ['pay', 'transfer', 'donate', 'send', 'envoyer', 'payer', 'transférer', 'virement'];

// ".pay @member 500", ".pay 500 @member", ".pay <discord id> 500", ".transfer <telegram id> 500"
async function readPayArgs(client, message, args) {
    const mention = message.mentions?.users?.filter?.((u) => u.id !== message.mentions?.repliedUser?.id)?.first?.() || message.mentions?.users?.first?.() || null;
    const rest = args.filter((x) => !/^<@!?\d+>$/.test(x));
    if (mention) return { to: mention, amount: parseAmount(rest[0]) };
    if (rest.length < 2 || !/^\d+$/.test(rest[0])) return { to: null, amount: null, usage: true };
    let to = null;
    if (/^\d{17,20}$/.test(rest[0])) to = await client.users.fetch(rest[0]).catch(() => null);
    if (!to) to = await fromTelegram(client, rest[0]);
    return { to, amount: parseAmount(rest[1]) };
}

// A Telegram ID linked to a Discord account (/link on Telegram) pays that Discord account
async function fromTelegram(client, telegramId) {
    try {
        const row = client.db.prepare('SELECT discord_id FROM user_links WHERE telegram_id = ?').get(String(telegramId));
        return row?.discord_id ? await client.users.fetch(row.discord_id).catch(() => null) : null;
    } catch { return null; }
}

const fromMessage = (client, message) => ({
    guild: message.guild, user: message.author, member: message.member,
    lang: pickLang(client, message.guild?.id, null, message.author.id),
    reply: async (payload, isPrivate) => {
        const sent = await message.reply({ ...payload, allowedMentions: { parse: [], repliedUser: false } }).catch(() => null);
        if (isPrivate && sent) setTimeout(() => sent.delete().catch(() => {}), 15000);   // a prefix reply can't be private: it removes itself
    },
});
const fromInteraction = (client, interaction) => ({
    guild: interaction.guild, user: interaction.user, member: interaction.member,
    lang: pickLang(client, interaction.guildId, interaction, interaction.user.id),
    reply: (payload, isPrivate) => interaction.reply({ ...payload, flags: (payload.flags || 0) | (isPrivate ? PRIVATE : 0), allowedMentions: { parse: [] } }).catch(() => {}),
});

async function payFromMessage(client, message, args) {
    const where = fromMessage(client, message);
    const w = words(client, message.guild?.id, where.lang);
    if (!message.guild) return where.reply({ content: w.t('errServer') }, true);
    const { to, amount, usage } = await readPayArgs(client, message, args);
    if (usage || (!to && !amount)) return where.reply({ content: w.t('errUsage', { prefix: w.prefix }) }, true);
    return askToPay(client, where, to, amount);
}

async function showBalance(client, where, target, targetMember) {
    const w = words(client, where.guild?.id, where.lang);
    if (!where.guild) return where.reply({ content: w.t('errServer') }, true);
    if (target.bot) return where.reply({ content: w.t('errBot') }, true);
    return where.reply(balanceCard(client, where.guild, where.user, target, targetMember, where.lang), false);
}

async function showBoard(client, where, context) {
    const w = words(client, where.guild?.id, where.lang);
    if (!where.guild) return where.reply({ content: w.t('errServer') }, true);
    const card = await require('./leaderboard').cardFor(client, where.guild, where.user.id, 'credits', where.lang, context).catch(() => null);
    return card ? where.reply(card, false) : where.reply({ content: w.t('noBoard') }, true);
}

module.exports = {
    name: 'credit',
    aliases: ['credits', 'bal', 'balance', 'crédits', 'solde', 'donate'],
    description: '💰 Check a balance, send credits and see the leaderboard.',
    category: 'ECONOMY',
    usage: '.bal [@member] | .pay @member <amount>',
    examples: ['.bal', '.bal @member', '.pay @member 500'],
    cooldown: 2000,

    data: new SlashCommandBuilder()
        .setName('credit')
        .setDescription('💰 Your balance, sending credits and the leaderboard')
        .addSubcommand((sub) => sub.setName('balance').setDescription('See a balance').addUserOption((o) => o.setName('user').setDescription('Whose balance (yours when empty)').setRequired(false)))
        .addSubcommand((sub) => sub.setName('pay').setDescription('Send credits to a member').addUserOption((o) => o.setName('recipient').setDescription('Who receives them').setRequired(true)).addIntegerOption((o) => o.setName('amount').setDescription('How many').setRequired(true).setMinValue(1).setMaxValue(MAX_AMOUNT)))
        .addSubcommand((sub) => sub.setName('leaderboard').setDescription('The richest members of this server')),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        try {
            if (PAY_WORDS.includes(String(usedCommand || '').toLowerCase())) return await payFromMessage(client, message, args);
            const where = fromMessage(client, message);
            let target = message.mentions?.users?.filter?.((u) => u.id !== message.mentions?.repliedUser?.id)?.first?.() || null;
            if (!target && /^\d{17,20}$/.test(args[0] || '')) target = await client.users.fetch(args[0]).catch(() => null);
            target = target || message.author;
            return await showBalance(client, where, target, message.guild?.members.cache.get(target.id) || (target.id === message.author.id ? message.member : null));
        } catch (e) { console.error('[CREDIT]', e.message); }
    },

    execute: async (interaction, client) => {
        const where = fromInteraction(client, interaction);
        try {
            const sub = interaction.options.getSubcommand();
            if (sub === 'pay') return await askToPay(client, where, interaction.options.getUser('recipient'), interaction.options.getInteger('amount'));
            if (sub === 'leaderboard') return await showBoard(client, where, interaction);
            const target = interaction.options.getUser('user') || interaction.user;
            return await showBalance(client, where, target, interaction.options.getMember('user') || (target.id === interaction.user.id ? interaction.member : null));
        } catch (e) {
            console.error('[CREDIT]', e.message);
            const w = words(client, interaction.guildId, where.lang);
            if (!interaction.replied && !interaction.deferred) interaction.reply({ content: w.t('errFailed'), flags: PRIVATE }).catch(() => {});
        }
    },

    handleComponent,
    // for plugins/transfer.js
    payFromMessage, askToPay, fromInteraction, fromTelegram, words,
    send,   // for plugins/birthday.js (birthday gifts): the same checks, transfer and DM as /credit pay
    _parseAmount: parseAmount,
};
