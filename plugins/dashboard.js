// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — /dashboard and .dashboard
// A small card with this server's numbers, and a button that opens THIS server's page on the website.
//   - the website asks people to sign in with Discord (that cannot be skipped from a bot, and a login hidden in a link would be unsafe)
//   - there are no buttons to listen to (a link button needs no collector), so nothing here can swallow a click meant for another message
//   - the bot's own system report (host, memory, load) is the owner-only .system command now
//   - every sentence lives in lang/<locale>/dashboard.json (English and French written, the rest fall back to English)
// ═══════════════════════════════════════════════════════
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const i18n = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');

const GOLD = 0xfcd116;
const T = (lang, key, vars) => i18n.t('dashboard.' + key, lang, vars);
const safeName = (s) => String(s || '').replace(/[*_~`|>\\]/g, '').slice(0, 80);

// The website address: DASHBOARD_URL in .env if set, otherwise the current domain. A move to another domain is one line.
const siteBase = () => (process.env.DASHBOARD_URL || 'https://bamako-steel-dev.xyz').replace(/\/+$/, '');
const guildUrl = (guildId) => (/^\d{15,25}$/.test(String(guildId || '')) ? `${siteBase()}/dashboard/${guildId}` : siteBase());

// This server's numbers. Any query that fails is left out of the card instead of breaking it.
function numbers(db, guild) {
    const n = { active: null, xp: null, avg: null, top: null };
    if (!db || !guild) return n;
    try { n.active = db.prepare('SELECT COUNT(*) AS c FROM users WHERE guild_id = ? AND last_xp_gain > ?').get(guild.id, Date.now() - 7 * 86400000)?.c ?? 0; } catch (e) { console.error('[DASHBOARD] active members failed:', e.message); }
    try { const a = db.prepare('SELECT SUM(xp) AS xp, AVG(level) AS avg FROM users WHERE guild_id = ?').get(guild.id); n.xp = a?.xp || 0; n.avg = a?.avg || 0; } catch (e) { console.error('[DASHBOARD] xp failed:', e.message); }
    try { n.top = db.prepare('SELECT username, level FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT 1').get(guild.id) || null; } catch (e) { console.error('[DASHBOARD] top member failed:', e.message); }
    return n;
}

function card(lang, guild, n) {
    const fmt = (v) => Number(v).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
    const lines = [T(lang, 'intro'), ''];
    lines.push(n.active === null ? T(lang, 'membersOnly', { members: fmt(guild.memberCount ?? 0) }) : T(lang, 'members', { members: fmt(guild.memberCount ?? 0), active: fmt(n.active) }));
    lines.push((guild.premiumTier || 0) === 0 && !guild.premiumSubscriptionCount ? T(lang, 'boostNone') : T(lang, 'boost', { tier: guild.premiumTier || 0, boosts: guild.premiumSubscriptionCount || 0 }));
    if (n.xp !== null) lines.push(T(lang, 'xp', { xp: fmt(n.xp), avg: Number(n.avg || 0).toFixed(1) }));
    if (n.xp !== null && n.top !== undefined) lines.push(n.top ? T(lang, 'top', { name: safeName(n.top.username), level: n.top.level }) : T(lang, 'topNone'));
    lines.push('', T(lang, 'hint'));
    const embed = new EmbedBuilder().setColor(GOLD).setTitle(safeName(guild.name) || 'ARCHON').setDescription(lines.join('\n'));
    const icon = guild.iconURL?.();
    if (icon) embed.setThumbnail(icon);
    return embed;
}

const buttonRow = (lang, url, key = 'button') => new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel(T(lang, key)).setStyle(ButtonStyle.Link).setURL(url));

module.exports = {
    name: 'dashboard',
    aliases: ['db', 'dash'],
    description: '🌐 Open this server\'s dashboard on the website, with a quick look at your server\'s numbers.',
    category: 'SYSTEM',
    cooldown: 5000,
    usage: '.dashboard',
    examples: ['.dashboard', '.dash'],

    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('🌐 Open this server\'s dashboard on the website')
        .setDescriptionLocalizations({ fr: '🌐 Ouvrir le tableau de bord de ce serveur sur le site' }),

    // ── slash command (private to whoever asked) ──
    async execute(interaction, client) {
        const lang = pickLang(client, interaction.guild?.id, interaction);
        try {
            if (!interaction.guild) return await interaction.reply({ content: T(lang, 'dmText'), components: [buttonRow(lang, siteBase(), 'dmButton')], flags: 1 << 6 });
            await interaction.reply({ embeds: [card(lang, interaction.guild, numbers(client.db, interaction.guild))], components: [buttonRow(lang, guildUrl(interaction.guild.id))], flags: 1 << 6 });
        } catch (e) {
            console.error('[DASHBOARD] failed:', e.message);
            if (!interaction.replied && !interaction.deferred) interaction.reply({ content: T(lang, 'error'), flags: 1 << 6 }).catch(() => {});
        }
    },

    // ── prefix command ──
    async run(client, message, args, db) {
        const lang = pickLang(client, message.guild?.id, null);
        try {
            if (!message.guild) return await message.reply({ content: T(lang, 'dmText'), components: [buttonRow(lang, siteBase(), 'dmButton')] });
            await message.reply({ embeds: [card(lang, message.guild, numbers(db || client.db, message.guild))], components: [buttonRow(lang, guildUrl(message.guild.id))] });
        } catch (e) {
            console.error('[DASHBOARD] failed:', e.message);
            message.reply(T(lang, 'error')).catch(() => {});
        }
    },

    // Used by the installer's self-test: builds the card and both buttons in one language with the real discord.js builders.
    _preview(lang) {
        const guild = { id: '1555131138366771253', name: 'Test Server', memberCount: 1234, premiumTier: 1, premiumSubscriptionCount: 3, iconURL: () => 'https://example.com/i.png' };
        const shots = [{ embeds: [card(lang, guild, { active: 12, xp: 98765, avg: 4.25, top: { username: 'someone', level: 9 } })], components: [buttonRow(lang, guildUrl(guild.id))] },
            { embeds: [card(lang, { ...guild, premiumTier: 0, premiumSubscriptionCount: 0 }, { active: null, xp: null, avg: null, top: null })], components: [buttonRow(lang, guildUrl(guild.id))] },
            { content: T(lang, 'dmText'), embeds: [], components: [buttonRow(lang, siteBase(), 'dmButton')] }];
        return shots.map((s) => JSON.stringify({ content: s.content, embeds: s.embeds.map((e) => e.toJSON()), components: s.components.map((c) => c.toJSON()) }));
    },
    _guildUrl: guildUrl
};
