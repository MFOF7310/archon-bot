// plugins/setgame.js  (setgame v2)
//
//   .setgame                       your card if you have one, otherwise the guided steps
//   .setgame Valorant              guided steps, starting at the mode
//   .setgame Valorant | Competitive | Platinum     saved straight away
//   .setgame remove                removes your game profile
//   /setgame                       the same, private to you (optional: game, mode, rank)
//
// What is saved is the same JSON as before in users.gaming: { game, mode, rank, timestamp, lastUpdated }.
// Emojis come from config/emojis.js only. Texts come from lang/<language>/setgame.json (keys starting with g_).
const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder,
} = require('discord.js');
const E = require('../config/emojis');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');

const DEFAULT_COLOR = '#5865F2';
const IDLE_MS = 120000;      // the steps close after 2 minutes without a click
const TOTAL_MS = 600000;     // and after 10 minutes in all
const LIMITS = { game: 30, mode: 20, rank: 25 };
const OTHER = '__other';
const SKIP = '__skip';

// ================= GAMES =================
// The key is what is saved (it stays the same as before). `emoji` and `cardEmoji` are names in config/emojis.js.
const GAMES = {
    'CALL OF DUTY': {
        label: 'Call of Duty', emoji: 'gameCodm', color: '#5E8C31',
        keywords: ['cod', 'codm', 'cod mobile', 'call of duty', 'warzone', 'modern warfare', 'black ops'],
        modes: ['MP', 'BR', 'ZM', 'DMZ', 'Ranked'],
        ranks: ['Rookie', 'Veteran', 'Elite', 'Pro', 'Master', 'Grandmaster', 'Legendary'],
    },
    'VALORANT': {
        label: 'Valorant', emoji: 'gameValorant', color: '#FF4655',
        keywords: ['val', 'valo', 'valorant'],
        modes: ['Competitive', 'Unrated', 'Spike Rush', 'Deathmatch', 'Premier'],
        ranks: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'],
    },
    'APEX LEGENDS': {
        label: 'Apex Legends', emoji: 'gameApexCustom', cardEmoji: 'gameApex', color: '#DA292A',
        keywords: ['apex', 'apex legends'],
        modes: ['BR', 'Ranked', 'Mixtape'],
        ranks: ['Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Apex Predator'],
    },
    'FORTNITE': {
        label: 'Fortnite', emoji: 'gameFortniteCustom', cardEmoji: 'gameFortniteCard', color: '#7D4CDB',
        keywords: ['fn', 'fort', 'fortnite'],
        modes: ['Solo', 'Duo', 'Trio', 'Squad', 'Ranked', 'Zero Build'],
        ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Elite', 'Champion', 'Unreal'],
    },
    'CS:GO': {
        label: 'Counter-Strike 2', emoji: 'gameCs2', color: '#DE9B35',
        keywords: ['csgo', 'cs:go', 'cs go', 'cs2', 'counter strike'],
        modes: ['Competitive', 'Premier', 'Casual'],
        ranks: ['Silver', 'Gold Nova', 'Master Guardian', 'Legendary Eagle', 'Supreme', 'Global Elite'],
    },
    'LEAGUE OF LEGENDS': {
        label: 'League of Legends', emoji: 'gameLol', color: '#C8AA6E',
        keywords: ['lol', 'league', 'league of legends'],
        modes: ['Solo/Duo', 'Flex', 'ARAM'],
        ranks: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'],
    },
};

// ================= SMALL HELPERS =================
const calculateLevel = (xp) => Math.floor(0.1 * Math.sqrt(xp)) + 1;
const agentIndex = (level) => (level >= 51 ? 5 : level >= 31 ? 4 : level >= 16 ? 3 : level >= 6 ? 2 : 1);
const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// Text typed by a member: no markdown or mention characters, one line, cut to the limit.
const clean = (s, max) => String(s || '').replace(/[<>`*_~|\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

// A typed game name is a known game only when it is the whole name ("val", "cs:go", "cod mobile"),
// or when it starts with a long keyword ("Valorant Mobile"). So "Valheim", "Rocket League" and "Fort Solis" stay as typed.
function detectGame(input) {
    const w = words(input);
    if (!w.length) return null;
    for (const [name, game] of Object.entries(GAMES)) {
        for (const keyword of game.keywords) {
            const k = words(keyword);
            const same = w.length === k.length && k.every((x, i) => w[i] === x);
            const starts = w.length > k.length && k.join('').length >= 6 && k.every((x, i) => w[i] === x);
            if (same || starts) return name;
        }
    }
    return null;
}

const resolveGame = (text) => (GAMES[text] ? text : (detectGame(text) || clean(text, LIMITS.game)));
const canon = (list, text) => list.find((x) => x.toLowerCase() === String(text || '').trim().toLowerCase()) || clean(text, 25);

// "<:name:id>" or "<a:name:id>" -> the object Discord wants in menus and buttons; a plain emoji -> { name }
function toEmoji(value) {
    if (!value) return undefined;
    const m = /^<(a?):(\w+):(\d+)>$/.exec(value);
    return m ? { id: m[3], name: m[2], animated: m[1] === 'a' } : { name: value };
}

function readSaved(row) {
    try {
        const g = row && row.gaming ? JSON.parse(row.gaming) : null;
        return g && g.game ? { game: String(g.game), mode: String(g.mode || ''), rank: String(g.rank || '') } : null;
    } catch (e) { return null; }
}

// ================= DATABASE =================
let columnChecked = false;
function ensureColumn(db) {
    if (columnChecked || !db) return;
    try { db.prepare('ALTER TABLE users ADD COLUMN gaming TEXT').run(); } catch (e) { /* already there */ }
    columnChecked = true;
}

function getUser(client, db, guildId, userId) {
    try {
        if (client.getUserData) return client.getUserData(userId, guildId) || null;
        if (db) return db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId) || null;
    } catch (e) { console.error('[SETGAME] read failed:', e.message); }
    return null;
}

// value: a JSON text to save, or null to remove. Returns 'ok', 'noRow' (the member has no row on this server yet) or 'error'.
function writeGaming(client, db, guildId, userId, username, value) {
    try {
        const row = getUser(client, db, guildId, userId);
        if (!row) return 'noRow';
        if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...row, gaming: value, username });
        else if (db) db.prepare('UPDATE users SET gaming = ? WHERE id = ? AND guild_id = ?').run(value, userId, guildId);
        else return 'error';
        return 'ok';
    } catch (e) { console.error('[SETGAME] save failed:', e.message); return 'error'; }
}

// ================= THE FLOW =================
// One flow for the prefix command and the slash command. `env` tells it how to read, save, send and edit.
async function start(env, input) {
    const tr = (key, vars) => t('setgame.' + key, env.lang, vars);
    const state = { game: '', mode: '', rank: '' };
    let saved = readSaved(env.getUser());
    let view = 'game';
    let justSaved = false;
    let failure = 'g_error';

    const info = (name) => GAMES[name] || null;
    const niceGame = (name) => (info(name) ? info(name).label : name);
    const emojiOf = (name, card) => {
        const g = info(name);
        return E[g ? ((card && g.cardEmoji) || g.emoji) : 'gamer'] || '';
    };

    function persist(game, mode, rank) {
        const json = JSON.stringify({ game, mode, rank, timestamp: Date.now(), lastUpdated: new Date().toISOString() });
        const result = env.write(json);
        if (result === 'ok') { saved = { game, mode, rank }; return true; }
        failure = result === 'noRow' ? 'g_noProfile' : 'g_error';
        return false;
    }
    function drop() {
        const result = env.write(null);
        if (result === 'ok') { saved = null; return true; }
        failure = result === 'noRow' ? 'g_noProfile' : 'g_error';
        return false;
    }

    // ----- pieces -----
    const row = (...parts) => new ActionRowBuilder().addComponents(...parts);
    const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
    const menu = (id, placeholder, options) => new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).addOptions(options);
    const option = (label, value, emoji) => {
        const o = { label: String(label).slice(0, 100), value };
        const e = toEmoji(emoji);
        if (e) o.emoji = e;
        return o;
    };
    const nav = (back) => row(...(back ? [button('sg:back', tr('g_back'))] : []), button('sg:cancel', tr('g_cancel')));
    const plain = (text, withSetup) => ({
        content: '',
        embeds: [new EmbedBuilder().setColor(DEFAULT_COLOR).setDescription(text)],
        components: withSetup ? [row(button('sg:setup', tr('g_setup')))] : [],
    });

    function savedCard() {
        const user = env.getUser();
        const xp = Number(user && user.xp) || 0;
        const level = Number(user && user.level) || calculateLevel(xp);
        const embed = new EmbedBuilder()
            .setColor((info(saved.game) && info(saved.game).color) || DEFAULT_COLOR)
            .setTitle(`${emojiOf(saved.game, true)} ${niceGame(saved.game)} · ${env.user.name}`.trim())
            .setDescription(tr('g_progress', { lvl: level, agentTitle: tr('g_agent' + agentIndex(level)), pts: xp.toLocaleString('en-US') }))
            .addFields(
                { name: tr('g_mode'), value: saved.mode || tr('g_notSet'), inline: true },
                { name: tr('g_rank'), value: saved.rank || tr('g_notSet'), inline: true },
            )
            .setTimestamp();
        if (env.user.avatar) embed.setThumbnail(env.user.avatar);
        if (env.guildName) embed.setFooter({ text: env.guildName });
        return {
            content: justSaved ? `${E.gameSaved || ''} ${tr('g_saved')}`.trim() : '',
            embeds: [embed],
            components: [row(button('sg:change', tr('g_change')), button('sg:remove', tr('g_remove'), ButtonStyle.Danger))],
        };
    }

    function render() {
        const g = info(state.game);
        const head = `${E.gameController || ''} ${tr('g_title')}`.trim();
        const embed = new EmbedBuilder().setColor((g && g.color) || DEFAULT_COLOR).setTitle(head);
        const gameField = { name: tr('g_game'), value: `${emojiOf(state.game, true)} ${niceGame(state.game)}`.trim(), inline: true };

        if (view === 'game') {
            embed.setDescription(`${tr('g_pickGame')}\n${tr('g_quick', { cmd: env.cmd })}`).setFooter({ text: tr('g_step', { n: 1 }) });
            const options = Object.entries(GAMES).map(([key, game]) => option(game.label, key, E[game.emoji]));
            options.push(option(tr('g_other'), OTHER, E.gamer));
            return { content: '', embeds: [embed], components: [row(menu('sg:game', tr('g_phGame'), options)), nav(false)] };
        }
        if (view === 'mode') {
            embed.setDescription(tr('g_pickMode')).addFields(gameField, { name: tr('g_mode'), value: tr('g_chooseBelow'), inline: true })
                .setFooter({ text: tr('g_step', { n: 2 }) });
            const options = [...(g ? g.modes : []).map((m) => option(m, m)), option(tr('g_otherMode'), OTHER), option(tr('g_skip'), SKIP)];
            return { content: '', embeds: [embed], components: [row(menu('sg:mode', tr('g_phMode'), options)), nav(true)] };
        }
        if (view === 'rank') {
            embed.setDescription(tr('g_pickRank')).addFields(
                gameField,
                { name: tr('g_mode'), value: state.mode || tr('g_notSet'), inline: true },
                { name: tr('g_rank'), value: tr('g_chooseBelow'), inline: true },
            ).setFooter({ text: tr('g_step', { n: 3 }) });
            const options = [...(g ? g.ranks : []).map((r) => option(r, r)), option(tr('g_otherRank'), OTHER), option(tr('g_skip'), SKIP)];
            return { content: '', embeds: [embed], components: [row(menu('sg:rank', tr('g_phRank'), options)), nav(true)] };
        }
        if (view === 'saved') return savedCard();
        if (view === 'removed') return plain(tr('g_removed'), true);
        if (view === 'none') return plain(tr('g_nothing', { cmd: env.cmd }), true);
        if (view === 'cancelled') return plain(tr('g_cancelled'), false);
        return plain(tr(failure), false);
    }

    // A small form for a typed game, mode or rank. Returns { modal, text } or null if the member closed it.
    async function ask(i, kind) {
        const customId = 'sg:modal:' + kind;
        const title = { game: 'g_modalGame', mode: 'g_modalMode', rank: 'g_modalRank' }[kind];
        const label = { game: 'g_modalGameLabel', mode: 'g_modalModeLabel', rank: 'g_modalRankLabel' }[kind];
        const modal = new ModalBuilder().setCustomId(customId).setTitle(tr(title)).addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('text').setLabel(tr(label)).setStyle(TextInputStyle.Short)
                    .setMaxLength(LIMITS[kind]).setRequired(true),
            ),
        );
        await i.showModal(modal);
        const submitted = await i.awaitModalSubmit({ time: IDLE_MS, filter: (x) => x.customId === customId && x.user.id === i.user.id }).catch(() => null);
        return submitted ? { modal: submitted, text: submitted.fields.getTextInputValue('text') } : null;
    }

    // ----- where we start -----
    if (input.remove) {
        if (!saved) view = 'none';
        else view = drop() ? 'removed' : 'error';
    } else if (input.game) {
        const game = resolveGame(input.game);
        if (!game) view = 'game';
        else if (input.direct) {
            state.game = game;
            state.mode = info(game) ? canon(info(game).modes, input.mode) : clean(input.mode, LIMITS.mode);
            state.rank = info(game) ? canon(info(game).ranks, input.rank) : clean(input.rank, LIMITS.rank);
            if (persist(state.game, state.mode, state.rank)) { view = 'saved'; justSaved = true; } else view = 'error';
        } else { state.game = game; view = 'mode'; }
    } else if (saved) view = 'saved';

    const message = await env.send(render());
    if (view === 'error' || view === 'cancelled') return;

    const collector = message.createMessageComponentCollector({ filter: (i) => String(i.customId).startsWith('sg:'), idle: IDLE_MS, time: TOTAL_MS });
    collector.on('collect', async (i) => {
        if (i.user.id !== env.user.id) {
            return i.reply({ content: tr('g_notYours', { cmd: env.cmd }), flags: 64 }).catch(() => {});
        }
        let responder = i;
        try {
            const id = i.customId;
            const value = i.values ? i.values[0] : null;
            justSaved = false;
            if (id === 'sg:game') {
                let name = value;
                if (value === OTHER) { const r = await ask(i, 'game'); if (!r) return; responder = r.modal; name = r.text; }
                const game = resolveGame(name);
                if (!game) return await responder.reply({ content: tr('g_needGame'), flags: 64 });
                if (game !== state.game) { state.mode = ''; state.rank = ''; }
                state.game = game;
                view = 'mode';
            } else if (id === 'sg:mode') {
                if (value === OTHER) { const r = await ask(i, 'mode'); if (!r) return; responder = r.modal; state.mode = clean(r.text, LIMITS.mode); }
                else state.mode = value === SKIP ? '' : value;
                view = 'rank';
            } else if (id === 'sg:rank') {
                if (value === OTHER) { const r = await ask(i, 'rank'); if (!r) return; responder = r.modal; state.rank = clean(r.text, LIMITS.rank); }
                else state.rank = value === SKIP ? '' : value;
                if (persist(state.game, state.mode, state.rank)) { view = 'saved'; justSaved = true; } else view = 'error';
            } else if (id === 'sg:back') {
                view = view === 'rank' ? 'mode' : 'game';
            } else if (id === 'sg:cancel') {
                view = 'cancelled';
            } else if (id === 'sg:change' || id === 'sg:setup') {
                state.game = ''; state.mode = ''; state.rank = '';
                view = 'game';
            } else if (id === 'sg:remove') {
                view = drop() ? 'removed' : 'error';
            } else return;
            await responder.update(render());
            if (view === 'cancelled' || view === 'error') collector.stop('done');
        } catch (e) {
            console.error('[SETGAME] flow error:', e.message);
            try { await responder.reply({ content: tr('g_error'), flags: 64 }); } catch (e2) { /* already answered */ }
        }
    });
    collector.on('end', (_collected, reason) => {
        if (reason === 'done') return;
        Promise.resolve(env.edit({ components: [] })).catch(() => {});
    });
}

// ================= THE COMMAND =================
module.exports = {
    name: 'setgame',
    aliases: ['sg', 'spec', 'combat', 'jeu', 'specialisation', 'gameprofile'],
    description: 'Set your game profile: game, mode and rank.',
    category: 'GAMING',
    cooldown: 3000,
    usage: '.setgame [Game] | [Mode] | [Rank]',

    data: new SlashCommandBuilder()
        .setName('setgame')
        .setDescription('Set your game profile: game, mode and rank')
        .addStringOption((o) => o.setName('game').setDescription('Your game (leave empty for the guided steps)').setMaxLength(LIMITS.game).setRequired(false))
        .addStringOption((o) => o.setName('mode').setDescription('Your mode').setMaxLength(LIMITS.mode).setRequired(false))
        .addStringOption((o) => o.setName('rank').setDescription('Your rank').setMaxLength(LIMITS.rank).setRequired(false)),

    async run(client, message, args, db, serverSettings, usedCommand, lang) {
        const raw = (args || []).join(' ').trim();
        const prefix = (serverSettings && serverSettings.prefix) || process.env.PREFIX || '.';
        const guildId = message.guild ? message.guild.id : 'DM';
        let input = {};
        if (/^(remove|delete|clear|reset|off)$/i.test(raw)) input = { remove: true };
        else if (raw.includes('|')) { const [game, mode, rank] = raw.split('|').map((x) => x.trim()); input = { game, mode, rank, direct: true }; }
        else if (raw) input = { game: raw };

        let sent;
        const env = {
            lang, cmd: `${prefix}setgame`,
            user: { id: message.author.id, name: message.author.username, avatar: message.author.displayAvatarURL ? message.author.displayAvatarURL() : '' },
            guildName: message.guild ? message.guild.name : '',
            getUser: () => getUser(client, db, guildId, message.author.id),
            write: (value) => writeGaming(client, db, guildId, message.author.id, message.author.username, value),
            send: async (payload) => { sent = await message.reply({ ...payload, allowedMentions: { repliedUser: false } }); return sent; },
            edit: (payload) => sent.edit(payload),
        };
        try {
            ensureColumn(db);
            await start(env, input);
        } catch (e) {
            console.error('[SETGAME] failed:', e.message);
            await message.reply({ content: t('setgame.g_error', lang) }).catch(() => {});
        }
    },

    async execute(interaction, client) {
        const lang = pickLang(client, interaction.guildId, interaction);
        const guildId = interaction.guildId || 'DM';
        const user = interaction.user;
        const game = interaction.options ? interaction.options.getString('game') : null;
        const mode = interaction.options ? interaction.options.getString('mode') : null;
        const rank = interaction.options ? interaction.options.getString('rank') : null;
        const input = game ? { game, mode, rank, direct: Boolean(mode || rank) } : {};

        const env = {
            lang, cmd: '/setgame',
            user: { id: user.id, name: user.username, avatar: user.displayAvatarURL ? user.displayAvatarURL() : '' },
            guildName: interaction.guild ? interaction.guild.name : '',
            getUser: () => getUser(client, null, guildId, user.id),
            write: (value) => writeGaming(client, null, guildId, user.id, user.username, value),
            send: async (payload) => { await interaction.reply({ ...payload, flags: 64 }); return interaction.fetchReply(); },
            edit: (payload) => interaction.editReply(payload),
        };
        try {
            await start(env, input);
        } catch (e) {
            console.error('[SETGAME] slash failed:', e.message);
            const body = { content: t('setgame.g_error', lang), flags: 64 };
            if (interaction.replied || interaction.deferred) await interaction.followUp(body).catch(() => {});
            else await interaction.reply(body).catch(() => {});
        }
    },

    _internal: { detectGame, clean, toEmoji, agentIndex, GAMES },
};
