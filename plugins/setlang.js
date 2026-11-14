// plugins/setlang.js
// /setlang and .setlang open one panel: the server's language, what it means for members, and a menu to change it.
// Picking a language saves it and the card redraws in that language. .setlang fr still works as a shortcut.
// Texts: lang/{en,fr,zh,ar}/setlang.json (Bambara is offered, marked "soon": its texts are not written yet, so it reads English).
const {
    SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} = require('discord.js');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const mention = require('../lib/mentions');

const LANGUAGES = {
    en: { native: 'English', flag: '🇬🇧' },
    fr: { native: 'Français', flag: '🇫🇷' },
    zh: { native: '中文', flag: '🇨🇳' },
    ar: { native: 'العربية', flag: '🇸🇦' },
    bm: { native: 'Bamanankan', flag: '🇲🇱', soon: true },
};
const TEXT_LANGS = ['en', 'fr', 'zh', 'ar'];
const textLang = (l) => (TEXT_LANGS.includes(l) ? l : 'en');
const SL = (k, lang, v) => t(`setlang.${k}`, textLang(lang), v || {});
const canManage = (member) => !!member?.permissions?.has(PermissionFlagsBits.ManageGuild);
const cleanCode = (s) => String(s || '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 12);
const flagOf = (code) => { try { return require('../config/emojis')[`flag_${code}`] || LANGUAGES[code].flag; } catch { return LANGUAGES[code].flag; } };

function serverLang(client, gid) {
    try { const l = client.getServerSettings?.(gid)?.language; return LANGUAGES[l] ? l : 'auto'; } catch { return 'auto'; }
}
// The server's language as set on Discord, when ARCHON speaks it (null otherwise)
function discordLocale(guild) {
    const loc = String(guild?.preferredLocale || '').split('-')[0].toLowerCase();
    return LANGUAGES[loc] && !LANGUAGES[loc].soon ? loc : null;
}
// The language the panel is written in: the fixed one, else the reader's own
function panelLang(client, gid, where, uid) {
    try { return textLang(pickLang(client, gid, where, uid)); } catch { return 'en'; }
}

function save(client, gid, code) {
    try {
        client.db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(gid);
        client.db.prepare('UPDATE server_settings SET language = ? WHERE guild_id = ?').run(code, gid);
        try { client.settings?.delete?.(gid); } catch { /* reloads on next read */ }
        try { client.invalidateGuildCache?.(gid); } catch { /* same */ }
        console.log(`[LANG] ${gid} → ${code}`);
        return true;
    } catch (e) { console.error('[LANG] save:', e.message); return false; }
}

// where = the interaction or message the panel is shown in, so custom icons are used only where they display
function panel(client, guild, ownerId, lang, notice, where = guild) {
    const { icon } = require('../lib/ui/icons');
    const ic = (k) => icon(k, where);
    const asEmoji = (e) => { const m = /^<(a?):(\w+):(\d+)>$/.exec(e || ''); return m ? { id: m[3], name: m[2], animated: m[1] === 'a' } : { name: e }; };
    const cur = serverLang(client, guild.id);
    const mylang = mention(client, 'mylang');
    const c = new ContainerBuilder().setAccentColor(0x1D9E75);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `-# ARCHON · ${SL('panel_title', lang)}\n## ${ic('language')} ${SL('heading', lang, { guild: guild.name })}`));
    if (notice) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(notice));

    let state;
    if (cur === 'auto') {
        const loc = discordLocale(guild);
        state = `${SL('mode_auto', lang)}\n-# ${loc
            ? SL('auto_how', lang, { mylang, locale: `${flagOf(loc)} ${LANGUAGES[loc].native}` })
            : SL('auto_how_nolocale', lang, { mylang })}`;
        let mine = null;
        try { mine = require('../lib/member-lang').get(ownerId, guild.id); } catch { /* no member choices */ }
        const you = LANGUAGES[mine] ? mine : (loc || null);
        if (you) state += `\n-# ${ic('user')} ${SL(LANGUAGES[mine] ? 'you_mylang' : 'you_locale', lang, { name: `${flagOf(you)} ${LANGUAGES[you].native}`, mylang })}`;
    } else {
        state = `${SL('mode_fixed', lang, { name: `${flagOf(cur)} ${LANGUAGES[cur].native}` })}\n-# ${SL('fixed_how', lang, { mylang })}`;
        if (LANGUAGES[cur].soon) state += `\n-# ${ic('warn')} ${SL('bm_note', lang)}`;
    }
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(state));

    const opts = [{ label: SL('opt_auto', lang), value: 'auto', description: SL('opt_auto_desc', lang), emoji: ic('world'), default: cur === 'auto' }];
    for (const [code, x] of Object.entries(LANGUAGES)) {
        opts.push({
            label: x.native, value: code, emoji: flagOf(code), default: cur === code,
            description: (x.soon ? SL('opt_soon_desc', lang) : SL('opt_fixed_desc', lang, { name: x.native })).slice(0, 100),
        });
    }
    const menu = new StringSelectMenuBuilder().setCustomId(`lang:pick:${ownerId}`).setPlaceholder(SL('select_ph', lang).slice(0, 150));
    // emoji objects for custom flags, plain strings for the standard ones
    menu.addOptions(opts.map((o) => ({ ...o, emoji: asEmoji(o.emoji) })));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(menu));

    if (cur === 'auto') c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${ic('warn')} ${SL('warn_fixed', lang, { mylang })}`));
    const buttons = new ActionRowBuilder();
    if (cur === 'auto') buttons.addComponents(new ButtonBuilder().setCustomId(`lang:mine:${ownerId}`).setLabel(SL('btn_mine', lang)).setStyle(ButtonStyle.Secondary).setEmoji(asEmoji(ic('user'))));
    else buttons.addComponents(new ButtonBuilder().setCustomId(`lang:auto:${ownerId}`).setLabel(SL('btn_auto', lang)).setStyle(ButtonStyle.Secondary).setEmoji(asEmoji(ic('refresh'))));
    c.addActionRowComponents(buttons);
    return { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

async function handleComponent(ix, client) {
    const guild = ix.guild;
    if (!guild) return;
    const [, action, ownerId] = ix.customId.split(':');
    const lang = panelLang(client, guild.id, ix, ix.user.id);
    const say = (content) => ix.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});

    // "My language" is for whoever presses it: their own private /mylang card
    if (action === 'mine') {
        const card = require('./mylang.js').buildCard(client, ix.user.id, guild.id, ix);
        return ix.reply({ ...card, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch((e) => console.error('[LANG] mine:', e.message));
    }
    if (!/^\d{17,20}$/.test(String(ownerId || ''))) return say(SL('expired', lang));
    if (ix.user.id !== ownerId) return say(SL('not_yours', lang, { cmd: mention(client, 'setlang') }));
    if (!canManage(ix.member)) return say(SL('need', lang));

    const code = action === 'auto' ? 'auto' : action === 'pick' ? String(ix.values?.[0] || '') : '';
    if (code !== 'auto' && !LANGUAGES[code]) return say(SL('expired', lang));
    if (code === serverLang(client, guild.id)) return ix.update(panel(client, guild, ownerId, lang, null, ix)).catch(() => {});
    if (!save(client, guild.id, code)) return say(SL('saveFailed', lang));
    // redrawn in the language members will now see
    const now = panelLang(client, guild.id, ix, ix.user.id);
    const notice = `> ${code === 'auto' ? SL('saved_auto', now) : SL('saved', now, { name: `${flagOf(code)} ${LANGUAGES[code].native}` })}`;
    return ix.update(panel(client, guild, ownerId, now, notice, ix)).catch((e) => console.error('[LANG] panel:', e.message));
}

module.exports = {
    name: 'setlang',
    aliases: ['setlanguage', 'language', 'lang'],
    description: 'Set the bot language for this server.',
    category: 'CONFIG',
    cooldown: 3000,
    usage: '.setlang [auto|en|fr|zh|ar|bm]',
    handleComponent,
    panel,

    data: new SlashCommandBuilder()
        .setName('setlang')
        .setDescription('The language ARCHON speaks on this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async run(client, message, args) {
        const lang = panelLang(client, message.guild?.id, message, message.author.id);
        if (!message.guild) return message.reply({ content: SL('guildOnly', lang) }).catch(() => {});
        if (!canManage(message.member)) return message.reply({ content: SL('need', lang) }).catch(() => {});

        // .setlang fr : the shortcut still saves straight away
        const typed = String(args?.[0] || '').toLowerCase();
        let notice = null, L = lang;
        if (typed) {
            if (typed !== 'auto' && !LANGUAGES[typed]) notice = `> ${SL('unknown', lang, { code: cleanCode(typed) || '?' })}`;
            else if (typed === serverLang(client, message.guild.id)) notice = null;
            else if (!save(client, message.guild.id, typed)) notice = `> ${SL('saveFailed', lang)}`;
            else {
                L = panelLang(client, message.guild.id, message, message.author.id);
                notice = `> ${typed === 'auto' ? SL('saved_auto', L) : SL('saved', L, { name: `${flagOf(typed)} ${LANGUAGES[typed].native}` })}`;
            }
        }
        return message.reply(panel(client, message.guild, message.author.id, L, notice, message)).catch((e) => console.error('[LANG] panel:', e.message));
    },

    async execute(ix, client) {
        const lang = panelLang(client, ix.guildId, ix, ix.user.id);
        if (!ix.guild) return ix.reply({ content: SL('guildOnly', lang), flags: MessageFlags.Ephemeral });
        if (!canManage(ix.member)) return ix.reply({ content: SL('need', lang), flags: MessageFlags.Ephemeral });
        const view = panel(client, ix.guild, ix.user.id, lang, null, ix);
        return ix.reply({ ...view, flags: view.flags | MessageFlags.Ephemeral });
    },
};
