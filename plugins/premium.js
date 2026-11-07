'use strict';
const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ContainerBuilder, TextDisplayBuilder, MessageFlags
} = require('discord.js');
const { t } = require('../lib/i18n');
const { icon, iconObj } = require('../lib/ui/icons');

const OKL = ['en', 'fr', 'bm', 'zh', 'ar'];
const pl = (o) => OKL.includes(o?.language) ? o.language : 'en';
const pt = (k, lang, vars) => t('premium.' + k, lang, vars || {});
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };

function isPremium(db, guildId) {
    const row = db.prepare('SELECT expires_at FROM premium WHERE guild_id = ?').get(guildId);
    if (!row) return false;
    if (!row.expires_at) return true;
    return Date.now() / 1000 < row.expires_at;
}

function daysLeft(db, guildId) {
    const row = db.prepare('SELECT expires_at FROM premium WHERE guild_id = ?').get(guildId);
    if (!row || !row.expires_at) return null;
    const diff = row.expires_at - Math.floor(Date.now() / 1000);
    return Math.max(0, Math.floor(diff / 86400));
}

function buildPremiumCard(client, premium, days, lang, guildName) {
    const statusEmoji = premium ? em('ping_ok', '🟢') : em('ping_bad', '🔴');
    const statusText = premium ? pt('statusActive', lang) : pt('statusInactive', lang);
    const statusValue = premium ? pt('statusActiveValue', lang) : pt('statusInactiveValue', lang);
    const expiry = days === null ? (premium ? pt('lifetime', lang) : '—') : `${days} ${pt('daysLabel', lang)}`;
    const customCheck = em('small_check', em('ic_ok', '✅'));

    const c = new ContainerBuilder().setAccentColor(premium ? 0xffd700 : 0x2c2f33);
    
    // Titre & Statut
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('eagle', '🦅')} ${pt('title', lang)}\n${statusEmoji} **${statusText}**`));
    
    // Infos (Prix & Expiration)
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`\n${em('ic_credit', '💎')} **${pt('price', lang)}:** $3.40/month ${em('dot_white', '·')} ${em('clock', '📅')} **${pt('expires', lang)}:** ${expiry}`));
    
    // Liste des features (avec l'émoji custom injecté)
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`\n### ${em('hubSparkle', '✨')} **${pt('includedFeatures', lang)}**\n${pt('featuresList', lang, { check: customCheck })}`));
    
    // Footer (corrigé sans doublon)
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`\n-# ${pt('featuresFooter', lang, { status: statusValue })} • ${guildName || 'ARCHON CG-223'}`));
    
    return c;
}

module.exports = {
    name: 'premium',
    description: 'ARCHON Premium subscription',
    category: 'SYSTEM',
    aliases: ['upgrade', 'sub'],

    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('⭐ ARCHON Premium — unlock all features')
        .addSubcommand(s => s.setName('status').setDescription('📊 Check premium status'))
        .addSubcommand(s => s.setName('activate').setDescription('🔑 Activate a premium code')
            .addStringOption(o => o.setName('code').setDescription('Your premium code').setRequired(true)))
        .addSubcommand(s => s.setName('features').setDescription('✨ View premium features'))
        .addSubcommand(s => s.setName('code').setDescription('🔑 Generate premium code [Owner only]')
            .addIntegerOption(o => o.setName('days').setDescription('Days (0 = lifetime)').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('How many codes to generate (default 1)').setRequired(false).setMinValue(1).setMaxValue(10)))
        .addSubcommand(s => s.setName('codes').setDescription('📋 List all active codes [Owner only]'))
        .addSubcommand(s => s.setName('grant').setDescription('👑 Grant premium [Owner only]')
            .addStringOption(o => o.setName('guild').setDescription('Guild ID').setRequired(true))
            .addIntegerOption(o => o.setName('days').setDescription('Days (0 = lifetime)').setRequired(true))),

    execute: async (interaction, client) => {
        const db = client.db;
        const gid = interaction.guild?.id;
        const sub = interaction.options.getSubcommand();
        const lang = pl(client.getServerSettings?.(gid) || {});
        const guildName = interaction.guild?.name?.toUpperCase() || 'ARCHON CG-223';

        if (sub === 'status') {
            const premium = isPremium(db, gid);
            const card = buildPremiumCard(client, premium, daysLeft(db, gid), lang, guildName);

            if (!premium) {
                card.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel(pt('btnSubscribe', lang)).setStyle(ButtonStyle.Link).setURL('https://bamako-steel-dev.xyz/premium').setEmoji(iconObj('ic_credit', null, '💎')),
                    new ButtonBuilder().setCustomId('premium_activate').setLabel(pt('btnActivate', lang)).setStyle(ButtonStyle.Secondary).setEmoji(iconObj('ic_key', null, '🔑'))
                ));
            } else {
                card.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel(pt('btnManage', lang)).setStyle(ButtonStyle.Link).setURL('https://bamako-steel-dev.xyz/premium').setEmoji(iconObj('ic_settings', null, '⚙️'))
                ));
            }
            return interaction.reply({ components: [card], flags: MessageFlags.IsComponentsV2 | 64 });
        }

        if (sub === 'features') {
            const premium = isPremium(db, gid);
            const card = buildPremiumCard(client, premium, daysLeft(db, gid), lang, guildName);
            card.setAccentColor(0xffd700);
            return interaction.reply({ components: [card], flags: MessageFlags.IsComponentsV2 | 64 });
        }

        if (sub === 'activate') {
            const code = interaction.options.getString('code').trim().toUpperCase();
            const codeRow = db.prepare('SELECT * FROM premium_codes WHERE code = ? AND used = 0').get(code);
            if (!codeRow) return interaction.reply({ content: pt('invalidCode', lang), flags: 64 });

            const expiresAt = codeRow.days === 0 ? null : Math.floor(Date.now() / 1000) + (codeRow.days * 86400);
            db.prepare('INSERT OR REPLACE INTO premium (guild_id, expires_at, plan, payment_method, transaction_id, activated_by) VALUES (?,?,?,?,?,?)')
                .run(gid, expiresAt, 'code', 'code', code, interaction.user.id);
            db.prepare('UPDATE premium_codes SET used = 1, used_by = ?, used_at = ? WHERE code = ?')
                .run(interaction.user.id, Math.floor(Date.now() / 1000), code);

            const daysTxt = codeRow.days === 0 ? pt('lifetime', lang) : `${codeRow.days} ${pt('daysLabel', lang)}`;
            const c = new ContainerBuilder().setAccentColor(0x2ecc71);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_ok', '✅')} ${pt('activatedTitle', lang)}\n\n${pt('activateDesc', lang, { server: interaction.guild.name, days: daysTxt })}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ARCHON CG-223 • BAMAKO_223 🇲🇱`));
            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
        }

        if (sub === 'code') {
            if (interaction.user.id !== process.env.OWNER_ID) return interaction.reply({ content: pt('ownerOnly', lang), flags: 64 });
            const days = interaction.options.getInteger('days');
            const amount = interaction.options.getInteger('amount') || 1;
            const codes = [];
            for (let i = 0; i < amount; i++) {
                const code = 'ARCHON-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
                db.prepare('INSERT OR IGNORE INTO premium_codes (code, days) VALUES (?,?)').run(code, days);
                codes.push(code);
            }
            const duration = days === 0 ? pt('lifetime', lang) : `${days} ${pt('daysLabel', lang)}`;
            const c = new ContainerBuilder().setAccentColor(0xffd700);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_key', '🔑')} ${pt('codesGenTitle', lang)}\n\n${pt('codesGenDesc', lang, { duration, codes: codes.join('\n') })}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ARCHON CG-223 • BAMAKO_223 🇲🇱`));
            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
        }

        if (sub === 'codes') {
            if (interaction.user.id !== process.env.OWNER_ID) return interaction.reply({ content: pt('ownerOnly', lang), flags: 64 });
            const codes = db.prepare('SELECT * FROM premium_codes WHERE used = 0 ORDER BY created_at DESC LIMIT 20').all();
            if (!codes.length) return interaction.reply({ content: pt('codesNone', lang), flags: 64 });
            const list = codes.map(c => c.code + ' (' + (c.days === 0 ? pt('lifetime', lang) : c.days + 'd') + ')').join('\n');
            const c = new ContainerBuilder().setAccentColor(0x00aaff);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_list', '📋')} ${pt('codesListTitle', lang, { count: codes.length })}\n\n\`\`\`\n${list}\n\`\`\``));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ARCHON CG-223 • BAMAKO_223 🇲🇱`));
            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
        }

        if (sub === 'grant') {
            if (interaction.user.id !== process.env.OWNER_ID) return interaction.reply({ content: pt('ownerOnly', lang), flags: 64 });
            const targetGid = interaction.options.getString('guild');
            const days = interaction.options.getInteger('days');
            const expiresAt = days === 0 ? null : Math.floor(Date.now() / 1000) + (days * 86400);
            db.prepare('INSERT OR REPLACE INTO premium (guild_id, expires_at, plan, payment_method, activated_by) VALUES (?,?,?,?,?)')
                .run(targetGid, expiresAt, days === 0 ? 'lifetime' : 'monthly', 'manual', interaction.user.id);
            const daysTxt = days === 0 ? pt('lifetime', lang) : `${days} ${pt('daysLabel', lang)}`;
            const c = new ContainerBuilder().setAccentColor(0x2ecc71);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_ok', '✅')} ${pt('grantedTitle', lang)}\n\n${pt('granted', lang, { guild: targetGid, days: daysTxt })}`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ARCHON CG-223 • BAMAKO_223 🇲🇱`));
            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
        }
    },

    run: async (client, message, args, db) => {
        const gid = message.guild?.id ?? 'DM';
        const lang = pl(client.getServerSettings?.(gid) || {});
        return message.reply(isPremium(db, gid) ? pt('runActive', lang) : pt('runInactive', lang));
    },

    isPremium,
    daysLeft
};
