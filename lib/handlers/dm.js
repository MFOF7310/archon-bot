// lib/handlers/dm.js — AFK, DM Streak, and DM Shop buttons
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { t } = require('../i18n');
const botPerms = require('../botPerms');
const em = (k, fb) => { try { return require('../../config/emojis')[k] || fb; } catch { return fb; } };

module.exports = async function(interaction, client, memberChoice, afkUsers) {
    // ================= AFK REMINDER BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('afk_remind_')) {
        const targetId = interaction.customId.replace('afk_remind_', '');
        const afkData = afkUsers.get(targetId);
        
        if (!afkData) {
            return interaction.reply({ content: 'This user is no longer AFK.', flags: MessageFlags.Ephemeral });
        }
        
        if (!afkData.reminders) afkData.reminders = [];
        afkData.reminders.push({
            from: interaction.user.id,
            fromName: interaction.user.username,
            timestamp: Date.now()
        });
        afkUsers.set(targetId, afkData);
        
        const _ssA = interaction.guild ? (client.getServerSettings?.(interaction.guild.id) || {}) : {};
        const lang = _ssA.language && _ssA.language !== 'auto' ? _ssA.language : (memberChoice(interaction.user.id, interaction.guildId || 'DM') || (interaction.locale?.startsWith('fr') ? 'fr' : 'en'));
        const replyMsg = t('index.afk_reminder', lang, { username: afkData.username });
        
        await interaction.reply({ content: replyMsg, flags: MessageFlags.Ephemeral });
        return;
    }

    // ================= DM STREAK INFO BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('dm_streak_info_')) {
        const rewardTiers = [
            '🌱 **3 Days:** +15 bonus credits',
            `${em('ic_streak', '🔥')} **7 Days:** +50% bonus + role unlock`,
            '⚔️ **30 Days:** Exclusive elite role',
            '💎 **100 Days:** Premium rewards tier',
            '👑 **365 Days:** Legendary status + custom role'
        ];
        
        await interaction.reply({ 
            content: `**${em('ic_streak', '🔥')} STREAK REWARDS:**\n${rewardTiers.join('\n')}\n\n*Use \`.daily\` every 24h to build your streak!*`,
            flags: MessageFlags.Ephemeral 
        });
        return;
    }

    // ================= DM SHOP SHIELD BUTTON (COMPOSITE KEY AWARE) =================
    if (interaction.isButton() && interaction.customId.startsWith('dm_shop_')) {
        const userId = interaction.customId.replace('dm_shop_', '');
        // Resolve guild context for composite key lookup
        const shopGuildId = interaction.guild?.id || 'DM';
        const userData = client.getUserData(userId, shopGuildId) || client.getUser(userId, shopGuildId);
        const credits = userData?.credits || 0;
        const canAfford = credits >= 2000;
        
        const shopEmbed = new EmbedBuilder()
            .setColor(canAfford ? '#2ecc71' : '#e74c3c')
            .setTitle(`${em('ic_shield', '🛡️')} Streak Protection Shield`)
            .setDescription(
                `**Price:** 2,000 🪙\n` +
                `**Your Balance:** ${credits.toLocaleString()} 🪙\n\n` +
                `*Protects your streak if you miss a daily claim.*`
            )
            .addFields({
                name: canAfford ? `${em('ic_ok', '✅')} You can afford this!` : em('ic_off', '❌') + ' ' + t('index.insufficient_credits', botPerms.langOf({ guild: interaction.guild, client }) || 'en'),
                value: canAfford 
                    ? 'Use `.buy streak_shield` in any server!'
                    : `Need ${(2000 - credits).toLocaleString()} more 🪙. Use \`.daily\` to earn!`
            });
        
        await interaction.reply({ embeds: [shopEmbed], flags: MessageFlags.Ephemeral });
        return;
    }


    return false;
};
