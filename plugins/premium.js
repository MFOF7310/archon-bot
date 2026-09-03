const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');

// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — PREMIUM SYSTEM v1.0
// Per-server subscription • $1.99/month
// ═══════════════════════════════════════════════════════

function isPremium(db, guildId) {
    const row = db.prepare('SELECT expires_at FROM premium WHERE guild_id = ?').get(guildId);
    if (!row) return false;
    if (!row.expires_at) return true; // lifetime
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
            .addIntegerOption(o => o.setName('amount').setDescription('How many codes to generate (default 1)').setRequired(false).setMinValue(1).setMaxValue(10))).
        addSubcommand(s => s.setName('codes').setDescription('📋 List all active codes [Owner only]')).
        addSubcommand(s => s.setName('grant').setDescription('👑 Grant premium [Owner only]')
            .addStringOption(o => o.setName('guild').setDescription('Guild ID').setRequired(true))
            .addIntegerOption(o => o.setName('days').setDescription('Days (0 = lifetime)').setRequired(true))),

    execute: async (interaction, client) => {
        const db = client.db;
        const gid = interaction.guild?.id;
        const sub = interaction.options.getSubcommand();

        if (sub === 'status') {
            const premium = isPremium(db, gid);
            const days = daysLeft(db, gid);
            const row = db.prepare('SELECT * FROM premium WHERE guild_id = ?').get(gid);

            const embed = new EmbedBuilder()
                .setColor(premium ? 0xffd700 : 0x888888)
                .setTitle(premium ? '⭐ ARCHON Premium — ACTIVE' : '🔒 ARCHON Premium — Not Active')
                .setDescription(premium
                    ? 'This server has full access to all premium features!'
                    : 'Upgrade to unlock AI, raid detection, image captcha, advanced automod and more!')
                .addFields(
                    { name: '📊 Status', value: premium ? '🟢 Active' : '🔴 Inactive', inline: true },
                    { name: '⏰ Expires', value: days === null ? (premium ? '♾️ Lifetime' : 'N/A') : `${days} days`, inline: true },
                    { name: '💰 Price', value: '$1.99/month', inline: true }
                );

            if (!premium) {
                embed.addFields({
                    name: '✨ Premium Features',
                    value: '🤖 Lydia AI unlimited\n🛡️ Raid detection\n🖼️ Image captcha\n📊 Advanced automod\n🎵 Music\n📈 Dashboard access\n⭐ Priority support',
                    inline: false
                });
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('💳 Subscribe — $1.99/mo')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://bamako-steel-dev.xyz/premium'),
                    new ButtonBuilder()
                        .setCustomId('premium_activate')
                        .setLabel('🔑 I have a code')
                        .setStyle(ButtonStyle.Secondary)
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
                .setTitle('⭐ ARCHON Premium Features')
                .setDescription('Everything included in the $1.99/server plan:')
                .addFields(features.map(f => ({ name: `${f.emoji} ${f.name}`, value: f.value, inline: true })))
                .setFooter({ text: `Status: ${premium ? '✅ Active on this server' : '❌ Not active'} • ARCHON CG-223 • bamako-steel-dev.xyz/premium` });
            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'activate') {
            const code = interaction.options.getString('code').trim().toUpperCase();
            // Check code in DB
            const codeRow = db.prepare('SELECT * FROM premium_codes WHERE code = ? AND used = 0').get(code);
            if (!codeRow) {
                return interaction.reply({ content: '❌ Invalid or already used code.', flags: 64 });
            }
            // Activate
            const expiresAt = codeRow.days === 0 ? null : Math.floor(Date.now()/1000) + (codeRow.days * 86400);
            db.prepare('INSERT OR REPLACE INTO premium (guild_id, expires_at, plan, payment_method, transaction_id, activated_by) VALUES (?,?,?,?,?,?)').run(
                gid, expiresAt, 'code', 'code', code, interaction.user.id
            );
            db.prepare('UPDATE premium_codes SET used = 1, used_by = ?, used_at = ? WHERE code = ?').run(
                interaction.user.id, Math.floor(Date.now()/1000), code
            );
            const days = codeRow.days === 0 ? 'Lifetime' : `${codeRow.days} days`;
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle('⭐ Premium Activated!')
                .setDescription(`**${interaction.guild.name}** now has ARCHON Premium!\n\nDuration: **${days}**\n\nAll premium features are now unlocked! 🎉`)
                .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
            ], flags: 64 });
        }

        if (sub === 'code') {
            if (interaction.user.id !== process.env.OWNER_ID)
                return interaction.reply({ content: '⛔ Bot owner only.', flags: 64 });
            const days = interaction.options.getInteger('days');
            const amount = interaction.options.getInteger('amount') || 1;
            const codes = [];
            for (let i = 0; i < amount; i++) {
                const code = 'ARCHON-' + Math.random().toString(36).slice(2,6).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
                db.prepare('INSERT OR IGNORE INTO premium_codes (code, days) VALUES (?,?)').run(code, days);
                codes.push(code);
            }
            const duration = days === 0 ? 'Lifetime' : days + ' days';
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle('🔑 Premium Codes Generated')
                .setDescription('Duration: **' + duration + '**\n\n```\n' + codes.join('\n') + '\n```\n\nShare these with users — they activate with `/premium activate`')
                .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
            ], flags: 64 });
        }

        if (sub === 'codes') {
            if (interaction.user.id !== process.env.OWNER_ID)
                return interaction.reply({ content: '⛔ Bot owner only.', flags: 64 });
            const codes = db.prepare('SELECT * FROM premium_codes WHERE used = 0 ORDER BY created_at DESC LIMIT 20').all();
            if (!codes.length) return interaction.reply({ content: '📋 No active unused codes.', flags: 64 });
            const list = codes.map(c => c.code + ' (' + (c.days === 0 ? 'Lifetime' : c.days + 'd') + ')').join('\n');
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0x00aaff)
                .setTitle('📋 Active Premium Codes (' + codes.length + ')')
                .setDescription('```\n' + list + '\n```')
                .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
            ], flags: 64 });
        }

        if (sub === 'grant') {
            // Owner only
            if (interaction.user.id !== process.env.OWNER_ID) {
                return interaction.reply({ content: '⛔ Bot owner only.', flags: 64 });
            }
            const targetGid = interaction.options.getString('guild');
            const days = interaction.options.getInteger('days');
            const expiresAt = days === 0 ? null : Math.floor(Date.now()/1000) + (days * 86400);
            db.prepare('INSERT OR REPLACE INTO premium (guild_id, expires_at, plan, payment_method, activated_by) VALUES (?,?,?,?,?)').run(
                targetGid, expiresAt, days === 0 ? 'lifetime' : 'monthly', 'manual', interaction.user.id
            );
            return interaction.reply({ content: `✅ Premium granted to \`${targetGid}\` for ${days === 0 ? 'lifetime' : days + ' days'}`, flags: 64 });
        }
    },

    run: async (client, message, args, db) => {
    const guildId = message.guild?.id ?? interaction?.guildId ?? 'DM';
        const premium = isPremium(db, message.guild?.id);
        return message.reply(premium ? '⭐ This server has ARCHON Premium!' : '🔒 No premium. Use `/premium status` to upgrade.');
    },

    isPremium,
    daysLeft
};