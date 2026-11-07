const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const EMOJIS = require('../config/emojis');
const { t } = require('../lib/i18n');

const OKL = ['en', 'fr', 'bm', 'zh', 'ar'];
const pl = (o) => OKL.includes(o?.language) ? o.language : 'en';
const pt = (k, lang, vars) => t('premium.' + k, lang, vars);

// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — PREMIUM SYSTEM v1.1 (i18n wired)
// Per-server subscription • $3.40/month
// ═══════════════════════════════════════════════════════

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

        if (sub === 'status') {
            const premium = isPremium(db, gid);
            const days = daysLeft(db, gid);

            const embed = new EmbedBuilder()
                .setColor(premium ? 0xffd700 : 0x2c2f33)
                .setAuthor({ name: `🦅 ARCHON CG-223 // PREMIUM GATE`, iconURL: client.user.displayAvatarURL() })
                .setTitle(premium ? pt('statusActive', lang, { emoji: '⭐' }) : pt('statusInactive', lang, { emoji: '🔒' }))
                .setDescription(premium ? pt('descActive', lang) : pt('descInactive', lang))
                .addFields(
                    { name: pt('fStatus', lang), value: premium ? pt('vActive', lang) : pt('vInactive', lang), inline: true },
                    { name: pt('fExpires', lang), value: days === null ? (premium ? pt('lifetime', lang) : '—') : pt('vDays', lang, { days }), inline: true },
                    { name: pt('fPrice', lang), value: '$3.40/month', inline: true }
                );

            if (!premium) {
                embed.addFields({ name: pt('featuresLabel', lang), value: pt('featuresList', lang), inline: false });
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel(pt('btnSubscribe', lang)).setStyle(ButtonStyle.Link).setURL('https://bamako-steel-dev.xyz/premium'),
                    new ButtonBuilder().setCustomId('premium_activate').setLabel(pt('btnHaveCode', lang)).setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({ embeds: [embed], components: [row2], flags: 64 });
            }
            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'features') {
            const premium = isPremium(db, gid);
            const features = require('../lib/premium-features');
            const embed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle(pt('featuresTitle', lang, { emoji: '✨' }))
                .setDescription(pt('planIncludes', lang))
                .addFields(features.map(f => ({ name: `${f.emoji} ${f.name}`, value: f.value, inline: true })))
                .setFooter({ text: pt('featuresFooter', lang, { status: premium ? pt('vActive', lang) : pt('vInactive', lang) }) });
            return interaction.reply({ embeds: [embed], flags: 64 });
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

            const daysTxt = codeRow.days === 0 ? pt('lifetime', lang) : pt('vDays', lang, { days: codeRow.days });
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle(pt('activatedTitle', lang))
                .setDescription(pt('activatedDesc', lang, { server: interaction.guild.name, days: daysTxt }))
                .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
            ], flags: 64 });
        }

        if (sub === 'code') {
            if (interaction.user.id !== process.env.OWNER_ID)
                return interaction.reply({ content: pt('ownerOnly', lang), flags: 64 });
            const days = interaction.options.getInteger('days');
            const amount = interaction.options.getInteger('amount') || 1;
            const codes = [];
            for (let i = 0; i < amount; i++) {
                const code = 'ARCHON-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
                db.prepare('INSERT OR IGNORE INTO premium_codes (code, days) VALUES (?,?)').run(code, days);
                codes.push(code);
            }
            const duration = days === 0 ? pt('lifetime', lang) : pt('vDays', lang, { days });
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle(pt('codesGenTitle', lang))
                .setDescription(pt('codesGenDesc', lang, { duration, codes: codes.join('\n') }))
                .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
            ], flags: 64 });
        }

        if (sub === 'codes') {
            if (interaction.user.id !== process.env.OWNER_ID)
                return interaction.reply({ content: pt('ownerOnly', lang), flags: 64 });
            const codes = db.prepare('SELECT * FROM premium_codes WHERE used = 0 ORDER BY created_at DESC LIMIT 20').all();
            if (!codes.length) return interaction.reply({ content: pt('codesNone', lang), flags: 64 });
            const list = codes.map(c => c.code + ' (' + (c.days === 0 ? pt('lifetime', lang) : c.days + 'd') + ')').join('\n');
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0x00aaff)
                .setTitle(pt('codesListTitle', lang, { count: codes.length }))
                .setDescription('```\n' + list + '\n```')
                .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
            ], flags: 64 });
        }

        if (sub === 'grant') {
            if (interaction.user.id !== process.env.OWNER_ID)
                return interaction.reply({ content: pt('ownerOnly', lang), flags: 64 });
            const targetGid = interaction.options.getString('guild');
            const days = interaction.options.getInteger('days');
            const expiresAt = days === 0 ? null : Math.floor(Date.now() / 1000) + (days * 86400);
            db.prepare('INSERT OR REPLACE INTO premium (guild_id, expires_at, plan, payment_method, activated_by) VALUES (?,?,?,?,?)')
                .run(targetGid, expiresAt, days === 0 ? 'lifetime' : 'monthly', 'manual', interaction.user.id);
            const daysTxt = days === 0 ? pt('lifetime', lang) : pt('vDays', lang, { days });
            return interaction.reply({ content: pt('granted', lang, { guild: targetGid, days: daysTxt }), flags: 64 });
        }
    },

    run: async (client, message, args, db) => {
        const gid = message.guild?.id ?? 'DM';
        const premium = isPremium(db, gid);
        const lang = pl(client.getServerSettings?.(gid) || {});
        return message.reply(premium ? pt('runActive', lang) : pt('runInactive', lang));
    },

    isPremium,
    daysLeft
};
