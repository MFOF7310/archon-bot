// ╔══════════════════════════════════════════════════════════════════════╗
// ║  🦅 ARCHON CG-223 — WELCOME/GOODBYE PLUGIN v4.0                     ║
// ║  Single canvas output | Warm welcome | Random pro-tips | Real age   ║
// ╚══════════════════════════════════════════════════════════════════════╝

const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Style = require('./welcome-style.js');

// ================= HANDLERS =================
async function handleWelcome(member, client, db) {
    const ssRaw = client.getServerSettings?.(member.guild.id) || {};
    const cfg = Style.normalizeWelcomeConfig(ssRaw);

    if (!cfg.welcomeEnabled) return;

    const ch = cfg.welcomeChannel 
        ? member.guild.channels.cache.get(cfg.welcomeChannel) 
        : member.guild.systemChannel;
    if (!ch) return;

    const count = member.guild.memberCount;
    const lang = member.guild.preferredLocale === 'fr' ? 'fr' : 'en';

        // SINGLE canvas render — no duplicates
    const png = await Style.renderWelcomeCard(member, count, cfg);

    // Convert canvas buffer to base64 data URL (no duplicate attachment)
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;

    // Warm welcome text (no ANSI block)
    let content = Style.warmWelcomeText(member, count, cfg);

    // Custom message support — prepended if set
    const customTemplate = cfg.welcomeMessage;
    if (customTemplate) {
        content = `${Style.formatTemplate(customTemplate, member, count)}\n${content}`;
    }

    // Random pro-tips (3-5 tips, feature-gated)
    const tips = Style.buildRandomTips(cfg, lang);
    const tipBlock = lang === 'fr' 
        ? `\n> 💡 **Commandes essentielles :**\n${tips.map(t => `> • ${t}`).join('\n')}`
        : `\n> 💡 **Essential commands :**\n${tips.map(t => `> • ${t}`).join('\n')}`;

    content += tipBlock;

    // Build embed with single image attachment
    const embed = new EmbedBuilder()
        .setColor(0x00fbff)
        .setImage(dataUrl)
        .setFooter({ text: `ARCHON CG-223 | ${member.guild.name} | Member #${count}` })
        .setTimestamp();

    // Build buttons — suppress rules/general if channels are configured
    const buttonDefs = Style.getWelcomeButtons(cfg, member);
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let btnCount = 0;

    for (const def of buttonDefs) {
        if (btnCount >= 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
            btnCount = 0;
        }

        if (def.style === 'Link') {
            currentRow.addComponents(
                new ButtonBuilder()
                    .setLabel(def.label)
                    .setEmoji(def.emoji)
                    .setStyle(ButtonStyle.Link)
                    .setURL(def.url)
            );
        } else {
            currentRow.addComponents(
                new ButtonBuilder()
                    .setLabel(def.label)
                    .setEmoji(def.emoji)
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
        components: rows.length > 0 ? rows : undefined
    }).catch(() => {});
}

async function handleGoodbye(member, client, db) {
    const ssRaw = client.getServerSettings?.(member.guild.id) || {};
    const cfg = Style.normalizeWelcomeConfig(ssRaw);

    if (!cfg.goodbyeEnabled || !cfg.goodbyeChannel) return;

    const ch = member.guild.channels.cache.get(cfg.goodbyeChannel);
    if (!ch) return;

    const joinedAt = member.joinedTimestamp;
    const duration = joinedAt ? Style.fmtDur(Date.now() - joinedAt) : null;
    const roles = [...member.roles.cache.values()].filter(r => r.id !== member.guild.id);

        // SINGLE canvas render
    const png = await Style.renderGoodbyeCard(member, duration, roles.length);

    // Convert canvas buffer to base64 data URL (no duplicate attachment)
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;

    let content = Style.goodbyeText(member, duration, roles.length);

    // Custom goodbye message support
    const customTemplate = cfg.goodbyeMessage;
    if (customTemplate) {
        content = `${Style.formatTemplate(customTemplate, member, member.guild.memberCount)}\n${content}`;
    }

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setImage(dataUrl)
        .setFooter({ text: `ARCHON CG-223 | ${member.guild.name} | Departure Log` })
        .setTimestamp();

    await ch.send({
        content,
        embeds: [embed],
    }).catch(() => {});
}

// ================= MODULE =================
module.exports = {
    name: 'welcome',
    category: 'SYSTEM',
    aliases: ['goodbye', 'leave', 'join', 'welcomecard'],
    description: 'Neural-grid welcome/goodbye cards with warm welcome, random pro-tips, and real account age.',
    usage: '.welcome config | .welcome test | .welcome message <text> | .welcome goodbyemsg <text>',
    cooldown: 1000,

    async onMemberAdd(member, client, db) {
        await handleWelcome(member, client, db);
    },

    async onMemberRemove(member, client, db) {
        await handleGoodbye(member, client, db);
    },

    run: async (client, message, args, db, usedCommand, serverSettings, lang) => {
        const sub = args[0]?.toLowerCase() || 'config';
        const prefix = serverSettings?.prefix || '.';
        const cfg = Style.normalizeWelcomeConfig(serverSettings);

        if (sub === 'test') {
            const embed = new EmbedBuilder()
                .setColor(0x00fbff)
                .setDescription('**Sending test welcome...**')
                .setFooter({ text: 'ARCHON CG-223' });
            await message.reply({ embeds: [embed] }).catch(() => {});
            await handleWelcome(message.member, client, db);
            return;
        }

        if (sub === 'message' || sub === 'msg') {
            const adm = message.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!adm) return message.reply('🔒 Admin only.').catch(() => {});

            const customMsg = args.slice(1).join(' ');
            if (!customMsg) {
                return message.reply(
                    `⚠️ **Usage:** \`${prefix}welcome message <text>\`\n` +
                    `Placeholders: \`{user}\` \`{server}\` \`{count}\` \`{age}\`\n` +
                    `Example: \`${prefix}welcome message Welcome {user} to {server}! You are member #{count}.\``
                ).catch(() => {});
            }

            client.updateServerSetting(message.guild.id, 'welcome_message', customMsg);
            client.settings.delete(message.guild.id);

            const preview = Style.formatTemplate(customMsg, message.member, message.guild.memberCount);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00fbff)
                    .setTitle('✅ Welcome Message Updated')
                    .addFields(
                        { name: 'Template Saved', value: `\`${customMsg}\``, inline: false },
                        { name: 'Preview', value: preview, inline: false }
                    )
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        if (sub === 'goodbyemsg' || sub === 'goodbye' || sub === 'leavemsg') {
            const adm = message.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!adm) return message.reply('🔒 Admin only.').catch(() => {});

            const customMsg = args.slice(1).join(' ');
            if (!customMsg) {
                return message.reply(
                    `⚠️ **Usage:** \`${prefix}welcome goodbyemsg <text>\`\n` +
                    `Placeholders: \`{user}\` \`{server}\` \`{count}\` \`{age}\`\n` +
                    `Example: \`${prefix}welcome goodbyemsg Goodbye {user}, thanks for being part of {server}!\``
                ).catch(() => {});
            }

            client.updateServerSetting(message.guild.id, 'goodbye_message', customMsg);
            client.settings.delete(message.guild.id);

            const preview = Style.formatTemplate(customMsg, message.member, message.guild.memberCount);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('✅ Goodbye Message Updated')
                    .addFields(
                        { name: 'Template Saved', value: `\`${customMsg}\``, inline: false },
                        { name: 'Preview', value: preview, inline: false }
                    )
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        // Default: config display
        const wCh = cfg.welcomeChannel;
        const gCh = cfg.goodbyeChannel;
        const wMsg = cfg.welcomeMessage || 'Welcome {user} to {server}! You are member #{count}.';
        const gMsg = cfg.goodbyeMessage || 'Goodbye {user}, thanks for being part of {server}!';

        const embed = new EmbedBuilder()
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
                    `\`${prefix}serversettings set welcome_channel #channel\`\n` +
                    `\`${prefix}serversettings set goodbye_channel #channel\``, inline: false },
                { name: 'Test', value: `\`${prefix}welcome test\` — Simulate welcome`, inline: false }
            )
            .setFooter({ text: 'ARCHON CG-223' })
            .setTimestamp();

        message.reply({ embeds: [embed] }).catch(() => {});
    },

    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Welcome/goodbye system configuration')
        .addSubcommand(s => s.setName('config').setDescription('View welcome/goodbye configuration'))
        .addSubcommand(s => s.setName('test').setDescription('Test welcome banner (admin only)'))
        .addSubcommand(s => s.setName('message').setDescription('Set a custom welcome message (admin only)')
            .addStringOption(o => o.setName('text').setDescription('Use {user}, {server}, {count}, {age} as placeholders').setRequired(true)))
        .addSubcommand(s => s.setName('goodbyemsg').setDescription('Set a custom goodbye message (admin only)')
            .addStringOption(o => o.setName('text').setDescription('Use {user}, {server}, {count}, {age} as placeholders').setRequired(true))),

    execute: async (ix, client) => {
        const sc = ix.options.getSubcommand();
        const db = client.db;
        const ssRaw = client.getServerSettings?.(ix.guild.id) || {};
        const cfg = Style.normalizeWelcomeConfig(ssRaw);

        if (sc === 'config') {
            const embed = new EmbedBuilder()
                .setColor(0x00fbff)
                .setAuthor({ name: 'Welcome System', iconURL: client.user.displayAvatarURL() })
                .addFields(
                    { name: 'Welcome Channel', value: cfg.welcomeChannel ? `<#${cfg.welcomeChannel}>` : '*Not set*', inline: true },
                    { name: 'Goodbye Channel', value: cfg.goodbyeChannel ? `<#${cfg.goodbyeChannel}>` : '*Not set*', inline: true },
                    { name: 'Welcome Message', value: `\`${cfg.welcomeMessage || 'Default'}\``, inline: false },
                    { name: 'Goodbye Message', value: `\`${cfg.goodbyeMessage || 'Default'}\``, inline: false },
                    { name: 'Setup', value: '`/welcome message` · `/welcome goodbyemsg` · `/serversettings` for channels', inline: false }
                )
                .setFooter({ text: 'ARCHON CG-223' })
                .setTimestamp();
            return ix.reply({ embeds: [embed], flags: 1 << 6 });
        }

        if (sc === 'test') {
            const adm = ix.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!adm) return ix.reply({ content: '🔒 Admin only.', flags: 1 << 6 });
            await ix.reply({ content: 'Sending test welcome...', flags: 1 << 6 });
            await handleWelcome(ix.member, client, db);
            return;
        }

        if (sc === 'message') {
            const adm = ix.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!adm) return ix.reply({ content: '🔒 Admin only.', flags: 1 << 6 });

            const customMsg = ix.options.getString('text');
            client.updateServerSetting(ix.guild.id, 'welcome_message', customMsg);
            client.settings.delete(ix.guild.id);

            const preview = Style.formatTemplate(customMsg, ix.member, ix.guild.memberCount);
            return ix.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00fbff)
                    .setTitle('✅ Welcome Message Updated')
                    .addFields(
                        { name: 'Template Saved', value: `\`${customMsg}\``, inline: false },
                        { name: 'Preview', value: preview, inline: false }
                    )
                    .setFooter({ text: 'ARCHON CG-223' })],
                flags: 1 << 6
            });
        }

        if (sc === 'goodbyemsg') {
            const adm = ix.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!adm) return ix.reply({ content: '🔒 Admin only.', flags: 1 << 6 });

            const customMsg = ix.options.getString('text');
            client.updateServerSetting(ix.guild.id, 'goodbye_message', customMsg);
            client.settings.delete(ix.guild.id);

            const preview = Style.formatTemplate(customMsg, ix.member, ix.guild.memberCount);
            return ix.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('✅ Goodbye Message Updated')
                    .addFields(
                        { name: 'Template Saved', value: `\`${customMsg}\``, inline: false },
                        { name: 'Preview', value: preview, inline: false }
                    )
                    .setFooter({ text: 'ARCHON CG-223' })],
                flags: 1 << 6
            });
        }
    }
};
