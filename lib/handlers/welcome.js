// lib/handlers/welcome.js — Welcome, Profile, and Birthday buttons
const { t } = require('../i18n');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
const em = (k, fb) => { try { return require('../../config/emojis')[k] || fb; } catch { return fb; } };

module.exports = async function(interaction, client, memberChoice, initializeUser, cacheUserData) {
    if (interaction.isButton() && interaction.customId === 'welcome_help') {
        const _ssH = interaction.guild ? (client.getServerSettings?.(interaction.guild.id) || {}) : {};
        const _langH = _ssH.language && _ssH.language !== 'auto'
            ? _ssH.language
            : (memberChoice(interaction.user.id, interaction.guildId || 'DM') || ['fr', 'zh', 'ar'].find((l) => String(interaction.locale || '').toLowerCase().startsWith(l)) || 'en');
        try {
            await interaction.reply(require('../welcome-help').buildWelcomeHelp({
                lang: _langH, prefix: _ssH.prefix || process.env.PREFIX || '.', guildName: interaction.guild?.name,
            }));
        } catch (e) { console.error('[WELCOME HELP]', e.message); }
        return;
    }

    // ================= AI ASSISTANT BUTTON HANDLER (COMPONENTS V2) =================
    if (interaction.isButton() && interaction.customId === 'welcome_ai_assistant') {
        try {
            const _ssA = interaction.guild ? (client.getServerSettings?.(interaction.guild.id) || {}) : {};
            const _l = require('../pick-lang').pickLang(client, interaction.guildId, interaction, interaction.user.id);
            const langA = ['en', 'fr', 'zh', 'ar'].includes(_l) ? _l : 'en';
            let activeChannels = [];
            if (client.lydiaChannels && interaction.guild) {
                activeChannels = Object.keys(client.lydiaChannels).filter(id => interaction.guild.channels.cache.has(id));
            }
            
            // Use custom emoji if available, fallback to default robot emoji
            const aiEmoji = require('../../config/emojis').ai_assistant || require('../../config/emojis').ai_assitant || '🤖';
            
            const card = new ContainerBuilder()
                .setAccentColor(0x9b59b6) // Purple accent
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${aiEmoji} ${t('welcome.ai_title', langA)}`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                );
                
            if (activeChannels.length > 0) {
                const channelMentions = activeChannels.map(id => `<#${id}>`).join(', ');
                card.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(t('welcome.ai_active', langA, { channels: channelMentions, bot: `<@${client.user.id}>` }))
                );
            } else {
                card.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(t('welcome.ai_none', langA))
                );
            }

            await interaction.reply({
                components: [card],
                flags: MessageFlags.IsComponentsV2 | 64 // Ephemeral
            });
        } catch (e) { console.error('[AI ASSISTANT BTN]', e.message); }
        return;
    }

    // ================= PROFILE BUTTON (welcome card) =================
    // The clicker's own profile, the same card as /profile, only for them
    if (interaction.isButton() && interaction.customId.startsWith('welcome_profile_')) {
        await require('../../plugins/profile').showOwn(interaction, client).catch((e) => console.error('[PROFILE BUTTON]', e.message));
        return;
    }
    
    // ================= BIRTHDAY CELEBRATION BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('bday_celebrate_')) {
        const userId = interaction.customId.replace('bday_celebrate_', '');
        const user = await client.users.fetch(userId).catch(() => null);
        
        if (!user) {
            return interaction.reply({ content: 'User not found!', flags: MessageFlags.Ephemeral });
        }
        
        const messages = {
            en: [
                `${em('party', '🎉')} **${interaction.user.username}** celebrates **${user.username}**'s birthday! ${em('cake', '🎂')}`,
                `${em('party', '🎈')} **${interaction.user.username}** sends birthday wishes to **${user.username}**! ${em('ic_gift', '🎁')}`,
                `${em('party', '🎊')} **${interaction.user.username}** joins the birthday celebration for **${user.username}**! ${em('party', '🎉')}`
            ],
            fr: [
                `${em('party', '🎉')} **${interaction.user.username}** célèbre l'anniversaire de **${user.username}** ! ${em('cake', '🎂')}`,
                `${em('party', '🎈')} **${interaction.user.username}** envoie ses vœux à **${user.username}** ! ${em('ic_gift', '🎁')}`,
                `${em('party', '🎊')} **${interaction.user.username}** se joint à la fête de **${user.username}** ! ${em('party', '🎉')}`
            ]
        };
        
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const randomMsg = messages[lang][Math.floor(Math.random() * messages[lang].length)];
        
        await interaction.reply({ content: randomMsg });
        return;
    }
    
    // ================= BIRTHDAY GIFT BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('bday_gift_')) {
        const userId = interaction.customId.replace('bday_gift_', '');
        const user = await client.users.fetch(userId).catch(() => null);
        
        if (!user) {
            return interaction.reply({ content: 'User not found!', flags: MessageFlags.Ephemeral });
        }
        
        const messages = {
            en: [
                `🎁 **${interaction.user.username}** sends a virtual gift to **${user.username}**! ${em('cake', '🎂')}`,
                `💝 **${interaction.user.username}** sends birthday love to **${user.username}**! 🎈`,
                `${em('star', '🌟')} **${interaction.user.username}** celebrates with **${user.username}**! Happy Birthday! ${em('party', '🎉')}`
            ],
            fr: [
                `🎁 **${interaction.user.username}** envoie un cadeau virtuel à **${user.username}** ! ${em('cake', '🎂')}`,
                `💝 **${interaction.user.username}** envoie plein d'amour à **${user.username}** ! 🎈`,
                `${em('star', '🌟')} **${interaction.user.username}** fait la fête avec **${user.username}** ! Joyeux anniversaire ! ${em('party', '🎉')}`
            ]
        };
        
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const randomMsg = messages[lang][Math.floor(Math.random() * messages[lang].length)];
        
        await interaction.reply({ content: randomMsg });
        return;
    }
    

    return false;
};
