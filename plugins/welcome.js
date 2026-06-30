// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 ARCHON CG-223 — WELCOME/GOODBYE PLUGIN v4.3                    ║
// ║  FIX: Single render path — removed duplicate canvas call           ║
// ║  FIX: index.js fallbackWelcome/fallbackGoodbye now DISABLED        ║
// ║       when this plugin is loaded (client.welcome is set)           ║
// ╚══════════════════════════════════════════════════════════════════════╝

const {
    EmbedBuilder, AttachmentBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits
} = require('discord.js');
const Style = require('./welcome-style.js');

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
    const ssRaw = client.getServerSettings?.(member.guild.id) || {};
    let cfg = Style.normalizeWelcomeConfig(ssRaw);
    cfg = applyOwnerEnvFallback(cfg, member.guild.id);

    if (!cfg.welcomeEnabled) return;

    const ch = cfg.welcomeChannel
        ? member.guild.channels.cache.get(cfg.welcomeChannel)
        : member.guild.systemChannel;
    if (!ch) return;

    const count = member.guild.memberCount;
    const lang  = member.guild.preferredLocale === 'fr' ? 'fr' : 'en';

    // Proxy ensures avatar URL works in all contexts
    const safeMember = createMemberProxy(member);

    // ── SINGLE canvas render ──
    const png = await Style.renderWelcomeCard(safeMember, count, cfg);
    const attachment = new AttachmentBuilder(png, { name: 'welcome-card.png' });

    // Welcome text (greeting + member count + account age)
    let content = Style.warmWelcomeText(safeMember, count, cfg);

    // Prepend custom server message if set
    if (cfg.welcomeMessage) {
        content = `${Style.formatTemplate(cfg.welcomeMessage, safeMember, count)}\n${content}`;
    }

    // 3–5 random pro-tips
    const tips = Style.buildRandomTips(cfg, lang);
    const tipLabel = lang === 'fr' ? '💡 **Commandes essentielles :**' : '💡 **Essential commands :**';
    content += `\n> ${tipLabel}\n${tips.map(t => `> • ${t}`).join('\n')}`;

    // Embed uses attachment:// reference — NOT a base64 data URL
    const embed = new EmbedBuilder()
        .setColor(0x00fbff)
        .setImage('attachment://welcome-card.png')
        .setFooter({ text: `ARCHON CG-223 | ${member.guild.name} | Member #${count}` })
        .setTimestamp();

    // Build action buttons
    const buttonDefs = Style.getWelcomeButtons(cfg, safeMember);
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

    await ch.send({
        content,
        embeds: [embed],
        components: rows.length > 0 ? rows : undefined,
        files: [attachment]
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

    const joinedAt  = member.joinedTimestamp;
    const duration  = joinedAt ? Style.fmtDur(Date.now() - joinedAt) : '< 1 min';
    const roles     = [...member.roles.cache.values()].filter(r => r.id !== member.guild.id);
    const safeMember = createMemberProxy(member);

    // ── SINGLE canvas render ──
    const png = await Style.renderGoodbyeCard(safeMember, duration, roles.length);
    const attachment = new AttachmentBuilder(png, { name: 'goodbye-card.png' });

    let content = Style.goodbyeText(safeMember, duration, roles.length);

    if (cfg.goodbyeMessage) {
        content = `${Style.formatTemplate(cfg.goodbyeMessage, safeMember, member.guild.memberCount)}\n${content}`;
    }

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setImage('attachment://goodbye-card.png')
        .setFooter({ text: `ARCHON CG-223 | ${member.guild.name} | Departure Log` })
        .setTimestamp();

    await ch.send({
        content,
        embeds: [embed],
        files: [attachment]
    }).catch(err => console.error('[GOODBYE] Send failed:', err.message));
}

// ================= MODULE =================
module.exports = {
    name: 'welcome',
    category: 'SYSTEM',
    aliases: ['goodbye', 'leave', 'join', 'welcomecard'],
    description: 'Neural-grid welcome/goodbye cards with warm welcome, random pro-tips, and real account age.',
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
                embeds: [new EmbedBuilder().setColor(0x00fbff).setDescription('**Sending test welcome...**').setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
            await handleWelcome(message.member, client, db);
            return;
        }

        if (sub === 'message' || sub === 'msg') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
                return message.reply('🔒 Admin only.').catch(() => {});

            const customMsg = args.slice(1).join(' ');
            if (!customMsg) {
                return message.reply(
                    `⚠️ **Usage:** \`${prefix}welcome message <text>\`\n` +
                    `Placeholders: \`{user}\` \`{server}\` \`{count}\` \`{age}\``
                ).catch(() => {});
            }
            client.updateServerSetting(message.guild.id, 'welcome_message', customMsg);
            client.settings.delete(message.guild.id);

            const preview = Style.formatTemplate(customMsg, message.member, message.guild.memberCount);
            return message.reply({
                embeds: [new EmbedBuilder().setColor(0x00fbff).setTitle('✅ Welcome Message Updated')
                    .addFields(
                        { name: 'Template Saved', value: `\`${customMsg}\``, inline: false },
                        { name: 'Preview', value: preview, inline: false }
                    ).setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        if (sub === 'goodbyemsg' || sub === 'goodbye' || sub === 'leavemsg') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
                return message.reply('🔒 Admin only.').catch(() => {});

            const customMsg = args.slice(1).join(' ');
            if (!customMsg) {
                return message.reply(
                    `⚠️ **Usage:** \`${prefix}welcome goodbyemsg <text>\`\n` +
                    `Placeholders: \`{user}\` \`{server}\` \`{count}\` \`{age}\``
                ).catch(() => {});
            }
            client.updateServerSetting(message.guild.id, 'goodbye_message', customMsg);
            client.settings.delete(message.guild.id);

            const preview = Style.formatTemplate(customMsg, message.member, message.guild.memberCount);
            return message.reply({
                embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('✅ Goodbye Message Updated')
                    .addFields(
                        { name: 'Template Saved', value: `\`${customMsg}\``, inline: false },
                        { name: 'Preview', value: preview, inline: false }
                    ).setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        // Default: config display
        const wCh  = cfg.welcomeChannel;
        const gCh  = cfg.goodbyeChannel;
        const wMsg = cfg.welcomeMessage || 'Welcome {user} to {server}! You are member #{count}.';
        const gMsg = cfg.goodbyeMessage || 'Goodbye {user}, thanks for being part of {server}!';

        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x00fbff)
                .setAuthor({ name: 'Welcome System', iconURL: client.user.displayAvatarURL() })
                .addFields(
                    { name: 'Welcome Channel', value: wCh ? `<#${wCh}>` : '*Not set*', inline: true },
                    { name: 'Goodbye Channel', value: gCh ? `<#${gCh}>` : '*Not set*', inline: true },
                    { name: 'Welcome Message', value: `\`${wMsg}\``, inline: false },
                    { name: 'Goodbye Message', value: `\`${gMsg}\``, inline: false },
                    { name: 'Setup', value:
                        `\`${prefix}welcome message <text>\` — Set welcome text\n` +
                        `\`${prefix}welcome goodbyemsg <text>\` — Set goodbye text\n` +
                        `\`${prefix}/channels set type:Welcome_channel #channel\`\n` +
                        `\`${prefix}serversettings set goodbye_channel #channel\``, inline: false },
                    { name: 'Test', value: `\`${prefix}welcome test\` — Simulate welcome`, inline: false }
                )
                .setFooter({ text: 'ARCHON CG-223' })
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

        if (sc === 'config') {
            return ix.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00fbff)
                    .setAuthor({ name: 'Welcome System', iconURL: client.user.displayAvatarURL() })
                    .addFields(
                        { name: 'Welcome Channel', value: cfg.welcomeChannel ? `<#${cfg.welcomeChannel}>` : '*Not set*', inline: true },
                        { name: 'Goodbye Channel', value: cfg.goodbyeChannel ? `<#${cfg.goodbyeChannel}>` : '*Not set*', inline: true },
                        { name: 'Welcome Message', value: `\`${cfg.welcomeMessage || 'Default'}\``, inline: false },
                        { name: 'Goodbye Message', value: `\`${cfg.goodbyeMessage || 'Default'}\``, inline: false },
                        { name: 'Setup', value: '`/welcome message` · `/welcome goodbyemsg`', inline: false }
                    ).setFooter({ text: 'ARCHON CG-223' }).setTimestamp()],
                flags: 1 << 6
            });
        }

        if (sc === 'test') {
            if (!ix.member.permissions.has(PermissionFlagsBits.Administrator))
                return ix.reply({ content: '🔒 Admin only.', flags: 1 << 6 });

            await ix.reply({ content: 'Sending test welcome...', flags: 1 << 6 });
            // Fetch real GuildMember so canvas gets full properties
            const realMember = await ix.guild.members.fetch(ix.user.id).catch(() => ix.member);
            await handleWelcome(realMember, client, db);
            return;
        }

        if (sc === 'message') {
            if (!ix.member.permissions.has(PermissionFlagsBits.Administrator))
                return ix.reply({ content: '🔒 Admin only.', flags: 1 << 6 });

            const customMsg = ix.options.getString('text');
            client.updateServerSetting(ix.guild.id, 'welcome_message', customMsg);
            client.settings.delete(ix.guild.id);
            const preview = Style.formatTemplate(customMsg, ix.member, ix.guild.memberCount);
            return ix.reply({
                embeds: [new EmbedBuilder().setColor(0x00fbff).setTitle('✅ Welcome Message Updated')
                    .addFields(
                        { name: 'Template Saved', value: `\`${customMsg}\``, inline: false },
                        { name: 'Preview', value: preview, inline: false }
                    ).setFooter({ text: 'ARCHON CG-223' })],
                flags: 1 << 6
            });
        }

        if (sc === 'goodbyemsg') {
            if (!ix.member.permissions.has(PermissionFlagsBits.Administrator))
                return ix.reply({ content: '🔒 Admin only.', flags: 1 << 6 });

            const customMsg = ix.options.getString('text');
            client.updateServerSetting(ix.guild.id, 'goodbye_message', customMsg);
            client.settings.delete(ix.guild.id);
            const preview = Style.formatTemplate(customMsg, ix.member, ix.guild.memberCount);
            return ix.reply({
                embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('✅ Goodbye Message Updated')
                    .addFields(
                        { name: 'Template Saved', value: `\`${customMsg}\``, inline: false },
                        { name: 'Preview', value: preview, inline: false }
                    ).setFooter({ text: 'ARCHON CG-223' })],
                flags: 1 << 6
            });
        }
    }
};
