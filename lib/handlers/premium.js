// lib/handlers/premium.js — Premium Code Modal & Activation
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const i18n = require('../i18n');
const botPerms = require('../botPerms');
const em = (k, fb) => { try { return require('../../config/emojis')[k] || fb; } catch { return fb; } };

module.exports = async function(interaction, client) {
    const db = client.db;

    if (interaction.isButton() && interaction.customId === 'premium_activate') {
        if (!interaction.memberPermissions?.has('ManageGuild')) return interaction.reply({ content: em('ic_off', '❌') + ' ' + i18n.t('index.need_manage_guild', botPerms.langOf({ guild: interaction.guild, client }) || 'en'), flags: 64 });
        const modal = new ModalBuilder()
            .setCustomId('premium_code_modal')
            .setTitle('⭐ Activate Premium Code');
        const codeInput = new TextInputBuilder()
            .setCustomId('premium_code')
            .setLabel('Enter your premium code')
            .setPlaceholder('ARCHON-XXXX-XXXX')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(5)
            .setMaxLength(50);
        modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
        await interaction.showModal(modal);
        return true;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'premium_code_modal') {
        const code = interaction.fields.getTextInputValue('premium_code').trim().toUpperCase();
        const gid = interaction.guild?.id;
        const lang = botPerms.langOf({ guild: interaction.guild, client }) || 'en';

        if (!gid) return interaction.reply({ content: em('ic_off', '❌') + ' ' + i18n.t('index.inside_server', lang), flags: 64 });
        if (!interaction.memberPermissions?.has('ManageGuild')) return interaction.reply({ content: em('ic_off', '❌') + ' ' + i18n.t('index.need_manage_guild', lang), flags: 64 });

        const codeRow = db.prepare('SELECT * FROM premium_codes WHERE code = ? AND used = 0').get(code);
        if (!codeRow) {
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0xff3311)
                .setDescription(em('ic_off', '❌') + ' ' + i18n.t('index.invalid_code', lang))
            ], flags: 64 });
        }

        const nowS = Math.floor(Date.now()/1000);
        const cur = db.prepare('SELECT expires_at FROM premium WHERE guild_id = ?').get(String(gid));
        if (cur && cur.expires_at === null) return interaction.reply({ content: em('ic_off', '❌') + ' ' + i18n.t('index.lifetime_already', lang), flags: 64 });
        
        const baseS = cur && cur.expires_at > nowS ? cur.expires_at : nowS;
        const expiresAt = codeRow.days === 0 ? null : baseS + (codeRow.days * 86400);
        db.prepare('INSERT OR REPLACE INTO premium (guild_id, expires_at, plan, payment_method, transaction_id, activated_by) VALUES (?,?,?,?,?,?)').run(
            String(gid), expiresAt, 'code', 'code', code, interaction.user.id
        );
        db.prepare('UPDATE premium_codes SET used = 1, used_by = ?, used_at = ? WHERE code = ?').run(
            interaction.user.id, Math.floor(Date.now()/1000), code
        );

        const days = codeRow.days === 0 ? 'Lifetime' : (codeRow.days + ' days');
        return interaction.reply({ embeds: [new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('⭐ Premium Activated!')
            .setDescription('**' + (interaction.guild?.name || 'Server') + '** now has ARCHON Premium!\n\nDuration: **' + days + '**\n\nAll premium features are now unlocked! 🎉')
            .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
        ], flags: 64 });
    }

    return false;
};
