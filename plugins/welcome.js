// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 ARCHON CG-223 — WELCOME/GOODBYE PLUGIN v4.3                    ║
// ║  FIX: Single render path — removed duplicate canvas call           ║
// ║  FIX: index.js fallbackWelcome/fallbackGoodbye now DISABLED        ║
// ║       when this plugin is loaded (client.welcome is set)           ║
// ╚══════════════════════════════════════════════════════════════════════╝

const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SlashCommandBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} = require('discord.js');
const { t } = require('../lib/i18n');
const Style = require('./welcome-style.js');

// Card sends upload a file — the check must mirror the send (View/Send/Embed + Attach Files)
const _CARD_NEEDED = [
    ['View Channel', PermissionFlagsBits.ViewChannel],
    ['Send Messages', PermissionFlagsBits.SendMessages],
    ['Embed Links', PermissionFlagsBits.EmbedLinks],
    ['Attach Files', PermissionFlagsBits.AttachFiles],
];

// ================= JOIN-DATE PERSISTENCE =================
// guildMemberRemove carries no join date: members not in cache (e.g. bot
// restarted since they joined) arrive with joinedTimestamp = null, and the
// goodbye card fell back to '< 1 min'. Persist join dates in SQLite so
// "Stayed:" is always exact.
let _joinTableReady = false;
const _joinBackfilled = new Set();
function ensureJoinTable(db) {
    if (_joinTableReady || !db) return;
    try {
        db.prepare('CREATE TABLE IF NOT EXISTS member_joins (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, joined_at INTEGER NOT NULL, PRIMARY KEY (guild_id, user_id))').run();
        _joinTableReady = true;
    } catch (e) { console.error('[WELCOME] member_joins init failed:', e.message); }
}
function recordJoin(db, guildId, userId, ts) {
    if (!db || !ts) return;
    try { db.prepare('INSERT OR REPLACE INTO member_joins (guild_id, user_id, joined_at) VALUES (?, ?, ?)').run(String(guildId), String(userId), ts); } catch (e) {}
}
function lookupJoin(db, guildId, userId) {
    if (!db) return null;
    try { const r = db.prepare('SELECT joined_at FROM member_joins WHERE guild_id = ? AND user_id = ?').get(String(guildId), String(userId)); return r ? r.joined_at : null; } catch (e) { return null; }
}
async function backfillJoins(db, guild) {
    if (!db || !guild || _joinBackfilled.has(guild.id)) return;
    _joinBackfilled.add(guild.id);
    try {
        const all = await guild.members.fetch();
        const stmt = db.prepare('INSERT OR IGNORE INTO member_joins (guild_id, user_id, joined_at) VALUES (?, ?, ?)');
        for (const m of all.values()) if (m.joinedTimestamp) stmt.run(String(guild.id), String(m.id), m.joinedTimestamp);
    } catch (e) { console.error('[WELCOME] join backfill failed:', e.message); }
}

// ================= HELPERS =================
function applyOwnerEnvFallback(cfg, guildId) {
    if (guildId === process.env.GUILD_ID) {
        cfg.welcomeChannel = cfg.welcomeChannel || process.env.WELCOME_CHANNEL_ID;
        cfg.goodbyeChannel = cfg.goodbyeChannel || process.env.GOODBYE_CHANNEL_ID;
    }
    return cfg;
}

// Ensures canvas renderer always gets a full GuildMember object
// (slash interactions give InteractionGuildMember which lacks displayAvatarURL)
function createMemberProxy(member) {
    if (member && typeof member.displayAvatarURL === 'function') return member;
    if (member && member.user) {
        return new Proxy(member, {
            get(target, prop) {
                if (prop === 'displayAvatarURL') return target.user.displayAvatarURL.bind(target.user);
                if (prop === 'displayName')      return target.user.displayName || target.user.username;
                return target[prop];
            }
        });
    }
    return member;
}

// ================= CORE SEND: WELCOME =================
// ── THIS IS THE ONLY PLACE a welcome card is rendered and sent ──
// index.js fallbackWelcome() is bypassed because client.welcome is set.
async function handleWelcome(member, client, db) {
    ensureJoinTable(db);
    await backfillJoins(db, member.guild);
    recordJoin(db, member.guild.id, member.id, member.joinedTimestamp || Date.now());
    const ssRaw = client.getServerSettings?.(member.guild.id) || {};
    let cfg = Style.normalizeWelcomeConfig(ssRaw);
    cfg = applyOwnerEnvFallback(cfg, member.guild.id);

    if (!cfg.welcomeEnabled || !cfg.welcomeChannel) return;

    const ch = member.guild.channels.cache.get(cfg.welcomeChannel);
    if (!ch) return;
    if (!require('../lib/canPost').log(member.guild, ch, member.guild.members.me, 'welcome', _CARD_NEEDED).ok) return;

    const count = member.guild.memberCount;
    const lang = (ssRaw.language && ssRaw.language !== 'auto') ? ssRaw.language : (client.detectLanguage ? client.detectLanguage('welcome', member.guild.id) : 'en');

    // Proxy ensures avatar URL works in all contexts
    const safeMember = createMemberProxy(member);

    // ── STATIC welcome banner (no canvas) ──
    const _fs = require('fs');
    const _path = require('path');
    const _bannerPath = _path.join(__dirname, '..', 'assets', 'welcome', 'welcome.png');
    if (!_fs.existsSync(_bannerPath)) {
        console.error('[WELCOME] welcome.png missing — aborting welcome card');
        return;
    }
    const attachment = new AttachmentBuilder(_fs.readFileSync(_bannerPath), { name: 'welcome.png' });

    // ── Compact content (Ephi style — 2 lignes) ──
    const EMOJIS = require('../config/emojis');
    cfg.lang = lang;
    const _topRole = member.roles?.highest;
    const _badge = (_topRole && _topRole.id !== member.guild.id) ? ` [${_topRole.name}]` : '';
    const _wave = EMOJIS.wave || '👋';
    let content = `${_wave} Bienvenue ${member.user}${_badge}\nTu es le **${Style.ordinal(count)}** membre de **${member.guild.name}**.`;
    if (cfg.welcomeMessage) {
        content = `${Style.formatTemplate(cfg.welcomeMessage, member, count)}\n${content}`;
    }

    // Embed uses attachment:// reference — NOT a base64 data URL
    // Hybrid accent: top role if readable, else neon green
    function _pickAccent(m, c) {
        if (c.welcomeAccent && /^#?[0-9a-fA-F]{6}$/.test(c.welcomeAccent)) return c.welcomeAccent.replace('#', '');
        const hex = m.roles?.highest?.hexColor || m.roles?.color?.hex;
        if (hex && hex !== '#000000') {
            const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
            const lum = (r*299 + g*587 + b*114)/1000;
            if (lum >= 40 && lum <= 220) return hex.replace('#','');
        }
        return '7FFF00';
    }
    const _accentHex = _pickAccent(member, cfg);

    // Build action buttons
    const rawDefs = Style.getWelcomeButtons(cfg, safeMember) || [];
    // Fix: The 'AI Assistant' button was mistakenly given the 'welcome_help' ID.
    // We rename it to 'welcome_ai_assistant' so it doesn't conflict with the new Help button.
    const buttonDefs = rawDefs.map(d => {
        if (d.customId === 'welcome_help' && d.label !== t('welcome.btn_help', lang)) {
            return { ...d, customId: 'welcome_ai_assistant' };
        }
        return d;
    });
    if (!buttonDefs.some((d) => d.customId === 'welcome_help')) {
        buttonDefs.push({ label: t('welcome.btn_help', lang), emoji: EMOJIS.hubInfo, style: 'Primary', customId: 'welcome_help' });
    }
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let btnCount = 0;

    for (const def of buttonDefs) {
        if (btnCount >= 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); btnCount = 0; }
        if (def.style === 'Link') {
            currentRow.addComponents(
                new ButtonBuilder().setLabel(def.label).setEmoji(def.emoji).setStyle(ButtonStyle.Link).setURL(def.url)
            );
        } else {
            currentRow.addComponents(
                new ButtonBuilder()
                    .setLabel(def.label).setEmoji(def.emoji)
                    .setStyle(def.style === 'Primary' ? ButtonStyle.Primary : ButtonStyle.Success)
                    .setCustomId(def.customId)
            );
        }
        btnCount++;
    }
    if (btnCount > 0) rows.push(currentRow);

    // ── Inviter detection (global cache) ──
    let _inviter = null;
    try { _inviter = await require('../lib/invite-tracker').detect(member.guild); } catch {}

    // ── Compact footer (no ping) ──
    const _months = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    const _now = new Date();
    const _dateStr = `${_now.getDate()} ${_months[_now.getMonth()]}`;
    let _footerLine = `-# Membre #${count} · ${_dateStr}`;
    if (_inviter?.code) {
        const _invName = _inviter.inviter?.username || (_inviter.inviter?.tag || '').split('#')[0];
        _footerLine += _invName ? ` · via ${_inviter.code} (${_invName})` : ` · via ${_inviter.code}`;
    } else {
        _footerLine += ` · Inviteur inconnu`;
    }

    // ── V2 container (compact Ephi style) ──
    const _container = new ContainerBuilder()
        .setAccentColor(parseInt(_accentHex, 16))
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL('attachment://welcome.png')
            )
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(content)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(_footerLine)
        );

    if (rows.length > 0) {
        _container.addActionRowComponents(...rows);
    }

    await ch.send({
        components: [_container],
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
    }).catch(err => console.error('[WELCOME] Send failed:', err.message));
}

// ================= CORE SEND: GOODBYE =================
// ── ONLY place a goodbye card is rendered and sent ──
async function handleGoodbye(member, client, db) {
    const ssRaw = client.getServerSettings?.(member.guild.id) || {};
    let cfg = Style.normalizeWelcomeConfig(ssRaw);
    cfg = applyOwnerEnvFallback(cfg, member.guild.id);

    if (!cfg.goodbyeEnabled || !cfg.goodbyeChannel) return;

    const ch = member.guild.channels.cache.get(cfg.goodbyeChannel);
    if (!ch) return;
    if (!require('../lib/canPost').log(member.guild, ch, member.guild.members.me, 'goodbye', _CARD_NEEDED).ok) return;

    ensureJoinTable(db);
    await backfillJoins(db, member.guild);
    const joinedAt  = member.joinedTimestamp || lookupJoin(db, member.guild.id, member.id);
    const duration  = joinedAt ? Style.fmtDur(Date.now() - joinedAt) : '< 1 min';
    const roles     = [...member.roles.cache.values()].filter(r => r.id !== member.guild.id);
    const safeMember = createMemberProxy(member);

    // ── SINGLE canvas render ──
    const png = await Style.renderGoodbyeCard(safeMember, duration, roles.length);
    const attachment = new AttachmentBuilder(png, { name: 'goodbye-card.png' });

    const ssRawGoodbye = client.getServerSettings?.(member.guild.id) || {};
    const goodbyeLang = (ssRawGoodbye.language && ssRawGoodbye.language !== 'auto') ? ssRawGoodbye.language : (client.detectLanguage ? client.detectLanguage('welcome', member.guild.id) : 'en');
    let content = Style.goodbyeText(safeMember, duration, roles.length, goodbyeLang);

    if (cfg.goodbyeMessage) {
        content = `${Style.formatTemplate(cfg.goodbyeMessage, safeMember, member.guild.memberCount)}\n${content}`;
    }


    // v7: Components V2 container (goodbye)
    const _gbContainer = new ContainerBuilder()
        .setAccentColor(0xff4757)
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL('attachment://goodbye-card.png')
            )
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(content)
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                t('welcome.goodbye_footer', goodbyeLang, { guild: member.guild.name })
            )
        );

    await ch.send({
        components: [_gbContainer],
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
    }).catch(err => console.error('[GOODBYE] Send failed:', err.message));
}

// ================= MODULE =================
module.exports = {
    name: 'welcome',
    category: 'SYSTEM',
    aliases: ['goodbye', 'leave', 'join', 'welcomecard'],
    description: 'Neural-grid welcome/goodbye cards with warm greetings, character art, and real account age.',
    usage: '.welcome config | .welcome test | .welcome message <text> | .welcome goodbyemsg <text>',
    cooldown: 1000,

    // ── These two hooks are called by index.js GuildMemberAdd/Remove ──
    // index.js checks: if (client.welcome?.onMemberAdd) → calls this
    // This means index.js fallbackWelcome() is SKIPPED automatically ✅
    async onMemberAdd(member, client, db) {
        await handleWelcome(member, client, db);
    },

    async onMemberRemove(member, client, db) {
        await handleGoodbye(member, client, db);
    },

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, usedCommand, serverSettings, lang) => {
        const sub = args[0]?.toLowerCase() || 'config';
        const prefix = serverSettings?.prefix || '.';
        let cfg = Style.normalizeWelcomeConfig(serverSettings);
        cfg = applyOwnerEnvFallback(cfg, message.guild.id);

        if (sub === 'test') {
            await message.reply({
                embeds: [new EmbedBuilder().setColor(0x00fbff).setDescription(`**${t('welcome.test_sending', lang)}**`).setFooter({ text: t('welcome.footer', lang) })]
            }).catch(() => {});
            await handleWelcome(message.member, client, db);
            return;
        }

        if (sub === 'message' || sub === 'msg') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
                return message.reply(t('welcome.admin_only', lang)).catch(() => {});

            const customMsg = args.slice(1).join(' ');
            if (!customMsg) {
                return message.reply(t('welcome.usage_message', lang, { prefix })).catch(() => {});
            }
            client.updateServerSetting(message.guild.id, 'welcome_message', customMsg);
            client.settings.delete(message.guild.id);

            const preview = Style.formatTemplate(customMsg, message.member, message.guild.memberCount);
            return message.reply({
                embeds: [new EmbedBuilder().setColor(0x00fbff).setTitle(t('welcome.welcome_updated', lang))
                    .addFields(
                        { name: t('welcome.field_template', lang), value: `\`${customMsg}\``, inline: false },
                        { name: t('welcome.field_preview', lang), value: preview, inline: false }
                    ).setFooter({ text: t('welcome.footer', lang) })]
            }).catch(() => {});
        }

        if (sub === 'goodbyemsg' || sub === 'goodbye' || sub === 'leavemsg') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
                return message.reply(t('welcome.admin_only', lang)).catch(() => {});

            const customMsg = args.slice(1).join(' ');
            if (!customMsg) {
                return message.reply(t('welcome.usage_goodbyemsg', lang, { prefix })).catch(() => {});
            }
            client.updateServerSetting(message.guild.id, 'goodbye_message', customMsg);
            client.settings.delete(message.guild.id);

            const preview = Style.formatTemplate(customMsg, message.member, message.guild.memberCount);
            return message.reply({
                embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle(t('welcome.goodbye_updated', lang))
                    .addFields(
                        { name: t('welcome.field_template', lang), value: `\`${customMsg}\``, inline: false },
                        { name: t('welcome.field_preview', lang), value: preview, inline: false }
                    ).setFooter({ text: t('welcome.footer', lang) })]
            }).catch(() => {});
        }

        // Default: config display
        const wCh  = cfg.welcomeChannel;
        const gCh  = cfg.goodbyeChannel;
        const wMsg = cfg.welcomeMessage || t('welcome.default_welcome_msg', lang);
        const gMsg = cfg.goodbyeMessage || t('welcome.default_goodbye_msg', lang);

        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x00fbff)
                .setAuthor({ name: t('welcome.author', lang), iconURL: client.user.displayAvatarURL() })
                .addFields(
                    { name: t('welcome.field_welcome_channel', lang), value: wCh ? `<#${wCh}>` : t('welcome.not_set', lang), inline: true },
                    { name: t('welcome.field_goodbye_channel', lang), value: gCh ? `<#${gCh}>` : t('welcome.not_set', lang), inline: true },
                    { name: t('welcome.field_welcome_message', lang), value: `\`${wMsg}\``, inline: false },
                    { name: t('welcome.field_goodbye_message', lang), value: `\`${gMsg}\``, inline: false },
                    { name: t('welcome.field_setup', lang), value: t('welcome.setup_value', lang, { prefix }), inline: false },
                    { name: t('welcome.field_test', lang), value: t('welcome.test_value', lang, { prefix }), inline: false }
                )
                .setFooter({ text: t('welcome.footer', lang) })
                .setTimestamp()]
        }).catch(() => {});
    },

    // ================= SLASH COMMAND =================
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Welcome/goodbye system configuration')
        .addSubcommand(s => s.setName('config').setDescription('View welcome/goodbye configuration'))
        .addSubcommand(s => s.setName('test').setDescription('Test welcome banner (admin only)'))
        .addSubcommand(s => s.setName('message').setDescription('Set a custom welcome message')
            .addStringOption(o => o.setName('text').setDescription('Use {user}, {server}, {count}, {age}').setRequired(true)))
        .addSubcommand(s => s.setName('goodbyemsg').setDescription('Set a custom goodbye message')
            .addStringOption(o => o.setName('text').setDescription('Use {user}, {server}, {count}, {age}').setRequired(true))),

    execute: async (ix, client) => {
        const sc   = ix.options.getSubcommand();
        const db   = client.db;
        let cfg = Style.normalizeWelcomeConfig(client.getServerSettings?.(ix.guild.id) || {});
        cfg = applyOwnerEnvFallback(cfg, ix.guild.id);
        const _ssW = client.getServerSettings?.(ix.guild?.id) || {};
        const lang = _ssW.language && _ssW.language !== 'auto' ? _ssW.language : (ix.locale?.startsWith('fr') ? 'fr' : 'en');

        if (sc === 'config') {
            return ix.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00fbff)
                    .setAuthor({ name: t('welcome.author', lang), iconURL: client.user.displayAvatarURL() })
                    .addFields(
                        { name: t('welcome.field_welcome_channel', lang), value: cfg.welcomeChannel ? `<#${cfg.welcomeChannel}>` : t('welcome.not_set', lang), inline: true },
                        { name: t('welcome.field_goodbye_channel', lang), value: cfg.goodbyeChannel ? `<#${cfg.goodbyeChannel}>` : t('welcome.not_set', lang), inline: true },
                        { name: t('welcome.field_welcome_message', lang), value: `\`${cfg.welcomeMessage || t('welcome.default_label', lang)}\``, inline: false },
                        { name: t('welcome.field_goodbye_message', lang), value: `\`${cfg.goodbyeMessage || t('welcome.default_label', lang)}\``, inline: false },
                        { name: t('welcome.field_setup', lang), value: t('welcome.setup_slash', lang), inline: false }
                    ).setFooter({ text: t('welcome.footer', lang) }).setTimestamp()],
                flags: 1 << 6
            });
        }

        if (sc === 'test') {
            if (!ix.member.permissions.has(PermissionFlagsBits.Administrator))
                return ix.reply({ content: t('welcome.admin_only', lang), flags: 1 << 6 });

            await ix.reply({ content: t('welcome.test_sending', lang), flags: 1 << 6 });
            // Fetch real GuildMember so canvas gets full properties
            const realMember = await ix.guild.members.fetch(ix.user.id).catch(() => ix.member);
            await handleWelcome(realMember, client, db);
            return;
        }

        if (sc === 'message') {
            if (!ix.member.permissions.has(PermissionFlagsBits.Administrator))
                return ix.reply({ content: t('welcome.admin_only', lang), flags: 1 << 6 });

            const customMsg = ix.options.getString('text');
            client.updateServerSetting(ix.guild.id, 'welcome_message', customMsg);
            client.settings.delete(ix.guild.id);
            const preview = Style.formatTemplate(customMsg, ix.member, ix.guild.memberCount);
            return ix.reply({
                embeds: [new EmbedBuilder().setColor(0x00fbff).setTitle(t('welcome.welcome_updated', lang))
                    .addFields(
                        { name: t('welcome.field_template', lang), value: `\`${customMsg}\``, inline: false },
                        { name: t('welcome.field_preview', lang), value: preview, inline: false }
                    ).setFooter({ text: t('welcome.footer', lang) })],
                flags: 1 << 6
            });
        }

        if (sc === 'goodbyemsg') {
            if (!ix.member.permissions.has(PermissionFlagsBits.Administrator))
                return ix.reply({ content: t('welcome.admin_only', lang), flags: 1 << 6 });

            const customMsg = ix.options.getString('text');
            client.updateServerSetting(ix.guild.id, 'goodbye_message', customMsg);
            client.settings.delete(ix.guild.id);
            const preview = Style.formatTemplate(customMsg, ix.member, ix.guild.memberCount);
            return ix.reply({
                embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle(t('welcome.goodbye_updated', lang))
                    .addFields(
                        { name: t('welcome.field_template', lang), value: `\`${customMsg}\``, inline: false },
                        { name: t('welcome.field_preview', lang), value: preview, inline: false }
                    ).setFooter({ text: t('welcome.footer', lang) })],
                flags: 1 << 6
            });
        }
    }
};
