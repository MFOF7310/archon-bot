// ═══════════════════════════════════════════════════════════════════════════
// /autoreply add | list | remove | clear — ARCHON answers a keyword with a card you wrote
//   Matching (lib/handlers/message.js): the keyword as a whole word or phrase ("hi" no longer fires on "this"),
//   once a minute per keyword and channel, a channel's own replies before the server-wide ones.
//   The answer is a card (title optional, colour); mentions in it don't ping.
//   Buttons and the remove menu are global (ar:<action>:<uid>[:…]): nothing dies after 15 seconds.
// Admins: Manage Messages. Texts: lang/<l>/autoreply.json
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { t } = require('../lib/i18n');
const { icon } = require('../lib/ui/icons');
const v2 = require('../lib/games/v2');

const T = (lang, k, v) => t(`autoreply.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const COLORS = { cyan: 0x00F0FF, green: 0x2ECC71, red: 0xE24B4A, gold: 0xE6A817, purple: 0x7F77DD, orange: 0xE67E22, blue: 0x378ADD, pink: 0xD4537E };
const plain = (s, n) => String(s || '').replace(/`/g, "'").replace(/\s+/g, ' ').trim().slice(0, n);
const isAdmin = (member, uid) => member?.permissions?.has?.(PermissionFlagsBits.ManageMessages) || uid === process.env.OWNER_ID;
const EPH = MessageFlags.Ephemeral;

// The card ARCHON posts when a keyword is said (lib/handlers/message.js uses it too)
function replyCard(row) {
    const color = Number(row.embed_color) || parseInt(String(row.embed_color), 16) || COLORS.cyan;
    const items = [];
    if (row.embed_title) items.push({ text: `### ${String(row.embed_title).slice(0, 200)}` });
    items.push({ text: String(row.response).slice(0, 3800) });
    return v2.card(color, items);   // allowedMentions: none
}

// The keyword as a whole word or phrase, in any script
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reCache = new Map();
function matches(content, keyword) {
    const k = String(keyword).toLowerCase().trim();
    if (!k) return false;
    // Chinese, Japanese, Korean: no spaces between words, so the keyword anywhere
    if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(k)) return String(content).toLowerCase().includes(k);
    let re = reCache.get(k);
    if (!re) {
        re = new RegExp(`(^|[^\\p{L}\\p{N}_])${esc(k).replace(/\s+/g, '\\s+')}($|[^\\p{L}\\p{N}_])`, 'iu');
        if (reCache.size > 2000) reCache.clear();
        reCache.set(k, re);
    }
    return re.test(content);
}

function listCard(client, guildId, uid, lang, where) {
    const rows = client.db.prepare('SELECT * FROM auto_replies WHERE guild_id = ? ORDER BY trigger_count DESC, created_at DESC').all(guildId);
    if (!rows.length) return v2.card(0xEF9F27, [{ text: `### ${icon('bot', where)} ${T(lang, 'title')}\n${T(lang, 'empty')}` }]);
    const lines = rows.slice(0, 20).map((r) => `**${plain(r.keyword, 40)}** → ${plain(r.response, 60)}${r.response.length > 60 ? '…' : ''}\n-# ${r.channel_id ? `<#${r.channel_id}>` : T(lang, 'everywhere')} · ${T(lang, 'fired', { n: r.trigger_count || 0 })}`);
    const items = [
        { text: `### ${icon('bot', where)} ${T(lang, 'title')} · ${rows.length}` },
        { rule: true },
        { text: lines.join('\n') + (rows.length > 20 ? `\n-# ${T(lang, 'more', { n: rows.length - 20 })}` : '') },
        { row: new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`ar:rm:${uid}`).setPlaceholder(T(lang, 'removePick'))
            .addOptions(rows.slice(0, 25).map((r) => ({ label: plain(r.keyword, 90) || '—', description: (r.channel_id ? `#${where?.guild?.channels?.cache?.get(r.channel_id)?.name || r.channel_id}` : T(lang, 'everywhere')).slice(0, 100), value: String(r.id) })))) },
        { row: new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ar:clear:${uid}`).setLabel(T(lang, 'clearAll')).setStyle(ButtonStyle.Danger)) },
    ];
    return v2.card(0x00F0FF, items);
}

// ar:<rm|clear|clearyes|clearno>:<uid>
async function handleComponent(ix, client) {
    const [, action, uid] = ix.customId.split(':');
    const lang = langOf(client, ix.guildId, ix, ix.user.id);
    if (ix.user.id !== uid || !isAdmin(ix.member, ix.user.id)) return ix.reply({ content: T(lang, 'notYours'), flags: EPH }).catch(() => {});
    const db = client.db, gid = ix.guildId;
    if (action === 'rm') {
        const row = db.prepare('SELECT keyword FROM auto_replies WHERE id = ? AND guild_id = ?').get(Number(ix.values?.[0]), gid);
        if (row) db.prepare('DELETE FROM auto_replies WHERE id = ? AND guild_id = ?').run(Number(ix.values[0]), gid);
        const card = listCard(client, gid, uid, lang, ix);
        if (row) card.components[0].addTextDisplayComponents(new (require('discord.js').TextDisplayBuilder)().setContent(`-# ${icon('ok', ix)} ${T(lang, 'removed', { k: plain(row.keyword, 60) })}`));
        return ix.update(card).catch(() => {});
    }
    if (action === 'clear') {
        const n = db.prepare('SELECT COUNT(*) AS c FROM auto_replies WHERE guild_id = ?').get(gid)?.c || 0;
        return ix.update(v2.card(0xE24B4A, [
            { text: `### ${icon('warn', ix)} ${T(lang, 'clearAsk', { n })}` },
            { row: new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ar:clearyes:${uid}`).setLabel(T(lang, 'clearYes', { n })).setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`ar:clearno:${uid}`).setLabel(T(lang, 'cancel')).setStyle(ButtonStyle.Secondary)) },
        ])).catch(() => {});
    }
    if (action === 'clearyes') {
        const r = db.prepare('DELETE FROM auto_replies WHERE guild_id = ?').run(gid);
        return ix.update(v2.card(0x2ECC71, [{ text: `${icon('ok', ix)} ${T(lang, 'cleared', { n: r.changes })}` }])).catch(() => {});
    }
    if (action === 'clearno') return ix.update(listCard(client, gid, uid, lang, ix)).catch(() => {});
    return ix.deferUpdate().catch(() => {});
}

module.exports = {
    name: 'autoreply',
    aliases: ['ar', 'autoresponse'],
    description: 'Automatic replies to keywords',
    category: 'UTILITY',
    cooldown: 1000,
    replyCard, matches, handleComponent,

    data: new SlashCommandBuilder().setName('autoreply').setDescription('Automatic replies to keywords')
        .setDescriptionLocalizations({ fr: 'Réponses automatiques à des mots-clés' })
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand((s) => s.setName('add').setDescription('Add or change a reply')
            .addStringOption((o) => o.setName('keyword').setDescription('Word or phrase that triggers it').setRequired(true).setMaxLength(100))
            .addStringOption((o) => o.setName('response').setDescription('What ARCHON answers (\\n for a new line)').setRequired(true).setMaxLength(2000))
            .addStringOption((o) => o.setName('title').setDescription('A title above the answer').setRequired(false).setMaxLength(200))
            .addStringOption((o) => o.setName('color').setDescription('Card colour').setRequired(false)
                .addChoices(...Object.keys(COLORS).map((c) => ({ name: c.charAt(0).toUpperCase() + c.slice(1), value: c }))))
            .addChannelOption((o) => o.setName('channel').setDescription('Only in this channel (empty: everywhere)').setRequired(false).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
        .addSubcommand((s) => s.setName('list').setDescription('See, remove or clear the replies'))
        .addSubcommand((s) => s.setName('remove').setDescription('Remove a reply')
            .addStringOption((o) => o.setName('keyword').setDescription('The keyword').setRequired(true).setAutocomplete(true))),

    autocomplete: async (interaction, client) => {
        const q = String(interaction.options.getFocused() || '').toLowerCase();
        const rows = client.db.prepare('SELECT DISTINCT keyword FROM auto_replies WHERE guild_id = ?').all(interaction.guildId);
        return interaction.respond(rows.filter((r) => r.keyword.toLowerCase().includes(q)).slice(0, 25).map((r) => ({ name: r.keyword.slice(0, 100), value: r.keyword.slice(0, 100) }))).catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        if (!interaction.guild) return interaction.reply({ content: T(lang, 'serverOnly'), flags: EPH });
        if (!isAdmin(interaction.member, interaction.user.id)) return interaction.reply({ content: T(lang, 'adminOnly'), flags: EPH });
        const db = client.db, gid = interaction.guild.id, sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const keyword = interaction.options.getString('keyword').toLowerCase().trim();
            const response = interaction.options.getString('response').replace(/\\n/g, '\n');
            const title = interaction.options.getString('title') || null;
            const colorName = interaction.options.getString('color') || 'cyan';
            const channelId = interaction.options.getChannel('channel')?.id || null;
            // one reply per keyword and place: SQLite's UNIQUE doesn't catch a repeat when the channel is empty,
            // so adding the same server-wide keyword twice used to keep both
            db.prepare('DELETE FROM auto_replies WHERE guild_id = ? AND keyword = ? AND channel_id IS ?').run(gid, keyword, channelId);
            db.prepare('INSERT INTO auto_replies (guild_id, channel_id, keyword, response, embed_title, embed_color, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(gid, channelId, keyword, response, title, String(COLORS[colorName] || COLORS.cyan), interaction.user.id);
            const preview = replyCard({ response, embed_title: title, embed_color: COLORS[colorName] });
            preview.components.unshift(v2.card(0x2ECC71, [{ text: `${icon('ok', interaction)} ${T(lang, 'added', { k: plain(keyword, 60), where: channelId ? `<#${channelId}>` : T(lang, 'everywhere') })}\n-# ${T(lang, 'preview')}` }]).components[0]);
            return interaction.reply({ ...preview, flags: preview.flags | EPH });
        }
        if (sub === 'remove') {
            const keyword = interaction.options.getString('keyword').toLowerCase().trim();
            const r = db.prepare('DELETE FROM auto_replies WHERE guild_id = ? AND keyword = ?').run(gid, keyword);
            return interaction.reply({ content: r.changes ? `${icon('ok', interaction)} ${T(lang, 'removed', { k: plain(keyword, 60) })}` : T(lang, 'notFound', { k: plain(keyword, 60) }), flags: EPH });
        }
        const card = listCard(client, gid, interaction.user.id, lang, interaction);
        return interaction.reply({ ...card, flags: card.flags | EPH });
    },

    run: async (client, message) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        if (!message.guild) return;
        if (!isAdmin(message.member, message.author.id)) return message.reply(T(lang, 'adminOnly')).catch(() => {});
        return message.reply(listCard(client, message.guild.id, message.author.id, lang, message)).catch(() => {});
    },
};
