// /transfer and .pay — send credits to another member.
// The flow lives in plugins/credit.js, so /transfer, .pay and /credit pay show the same cards and move the
// money the same safe way. A Telegram ID linked to a Discord account (/link on Telegram) pays that account.
const { SlashCommandBuilder } = require('discord.js');
const credit = require('./credit');

module.exports = {
    name: 'transfer',
    aliases: ['send', 'pay', 'envoyer', 'payer', 'virement'],
    description: '💸 Send credits to another member.',
    category: 'ECONOMY',
    usage: '<@member> <amount>',
    cooldown: 5000,
    examples: ['.pay @member 500', '.pay 500 @member', '.transfer 5076150691 1000'],

    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('💸 Send credits to another member')
        .addIntegerOption((o) => o.setName('amount').setDescription('How many credits').setRequired(true).setMinValue(1).setMaxValue(1_000_000_000))
        .addUserOption((o) => o.setName('user').setDescription('Who receives them').setRequired(false))
        .addStringOption((o) => o.setName('telegram_id').setDescription('Or the Telegram ID of a linked account').setRequired(false)),

    run: (client, message, args) => credit.payFromMessage(client, message, args).catch((e) => console.error('[TRANSFER]', e.message)),

    execute: async (interaction, client) => {
        const where = credit.fromInteraction(client, interaction);
        const w = credit.words(client, interaction.guildId, where.lang);
        try {
            let to = interaction.options.getUser('user');
            const telegramId = (interaction.options.getString('telegram_id') || '').trim();
            if (!to && telegramId) {
                to = /^\d{3,20}$/.test(telegramId) ? await credit.fromTelegram(client, telegramId) : null;
                if (!to) return where.reply({ content: w.t('errTelegram') }, true);
            }
            if (!to) return where.reply({ content: w.t('errPick') }, true);
            return await credit.askToPay(client, where, to, interaction.options.getInteger('amount'));
        } catch (e) {
            console.error('[TRANSFER]', e.message);
            if (!interaction.replied && !interaction.deferred) where.reply({ content: w.t('errFailed') }, true);
        }
    },
};
