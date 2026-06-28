const { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');

// ================= TRANSLATIONS =================
const t = {
    fr: {
        title: '🧙‍♂️ ASSISTANT DE CONFIGURATION',
        welcome: '👋 Bienvenue dans l\'assistant de configuration ARCHITECT CG-223 !\n\nJe vais vous guider à travers les **5 étapes essentielles** pour configurer votre serveur.\n\nCliquez sur **Démarrer** pour commencer.',
        step1_title: '📜 Étape 1/5 : Salon des Règles',
        step1_desc: 'Sélectionnez le salon où vos règles sont affichées.\nLes nouveaux membres verront un bouton pour y accéder.',
        step2_title: '👋 Étape 2/5 : Salon de Bienvenue',
        step2_desc: 'Sélectionnez le salon où les messages de bienvenue seront envoyés.',
        step3_title: '👤 Étape 3/5 : Rôle Membre',
        step3_desc: 'Sélectionnez le rôle attribué automatiquement aux nouveaux membres.',
        step4_title: '📊 Étape 4/5 : Salon de Logs',
        step4_desc: 'Sélectionnez le salon pour les rapports de sécurité et logs.',
        step5_title: '🎉 Étape 5/5 : Configuration Terminée !',
        step5_desc: (prefix) => `✅ **Votre serveur est configuré !**\n\nVoici un résumé :\n• Salon des règles : <#{rules}>\n• Salon de bienvenue : <#{welcome}>\n• Rôle membre : <@&{role}>\n• Salon de logs : <#{log}>\n\n💡 **Préfixe actuel :** \`${prefix}\`\n🔧 Utilisez \`/serversettings\` pour modifier ces paramètres.`,
        start: '🚀 Démarrer',
        skip: '⏭️ Passer',
        finish: '✅ Terminer',
        selectChannel: 'Sélectionnez un salon...',
        selectRole: 'Sélectionnez un rôle...',
        noChannels: 'Aucun salon disponible',
        noRoles: 'Aucun rôle disponible',
        timeout: '⏰ Temps écoulé. Configuration annulée.',
        cancelled: '❌ Configuration annulée.',
        error: '❌ Une erreur est survenue.',
        saved: '✅ Paramètre enregistré !',
        footer: 'ARCHITECT CG-223 • Assistant de Configuration'
    },
    en: {
        title: '🧙‍♂️ SETUP WIZARD',
        welcome: '👋 Welcome to the ARCHITECT CG-223 setup wizard!\n\nI\'ll guide you through the **5 essential steps** to configure your server.\n\nClick **Start** to begin.',
        step1_title: '📜 Step 1/5: Rules Channel',
        step1_desc: 'Select the channel where your rules are displayed.\nNew members will see a button to access them.',
        step2_title: '👋 Step 2/5: Welcome Channel',
        step2_desc: 'Select the channel where welcome messages will be sent.',
        step3_title: '👤 Step 3/5: Member Role',
        step3_desc: 'Select the role automatically given to new members.',
        step4_title: '📊 Step 4/5: Log Channel',
        step4_desc: 'Select the channel for security reports and logs.',
        step5_title: '🎉 Step 5/5: Setup Complete!',
        step5_desc: (prefix) => `✅ **Your server is configured!**\n\nHere's a summary:\n• Rules channel: <#{rules}>\n• Welcome channel: <#{welcome}>\n• Member role: <@&{role}>\n• Log channel: <#{log}>\n\n💡 **Current prefix:** \`${prefix}\`\n🔧 Use \`/serversettings\` to modify these settings.`,
        start: '🚀 Start',
        skip: '⏭️ Skip',
        finish: '✅ Finish',
        selectChannel: 'Select a channel...',
        selectRole: 'Select a role...',
        noChannels: 'No channels available',
        noRoles: 'No roles available',
        timeout: '⏰ Time expired. Setup cancelled.',
        cancelled: '❌ Setup cancelled.',
        error: '❌ An error occurred.',
        saved: '✅ Setting saved!',
        footer: 'ARCHITECT CG-223 • Setup Wizard'
    }
};

// ================= COLLECTOR TIMEOUT =================
const COLLECTOR_TIME = 120000;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    name: 'setup',
    category: 'ADMIN',
    aliases: ['wizard', 'config', 'configure'],
    description: '🧙‍♂️ Interactive setup wizard for new servers',
    usage: '.setup',
    permissions: ['Administrator'],

    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('🧙‍♂️ Launch the interactive server setup wizard')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescriptionLocalizations({ fr: '🧙‍♂️ Lancer l\'assistant de configuration interactif' }),

    // ================= SLASH EXECUTION =================
    async execute(interaction, client) {
        const isOwner = interaction.user.id === interaction.guild?.ownerId;
        const isAdmin = interaction.member?.permissions.has('Administrator');
        if (!isOwner && !isAdmin) {
            return interaction.reply({ content: '🔒 This command requires Administrator permissions.', flags: 1 << 6 }).catch(() => {});
        }
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        await module.exports.startWizard(interaction, client, lang, true);
    },

    // ================= PREFIX EXECUTION =================
    async run(client, message, args, db, serverSettings) {
        const isOwner = message.author.id === message.guild?.ownerId;
        const isAdmin = message.member?.permissions.has('Administrator');
        if (!isOwner && !isAdmin) {
            return message.reply('🔒 This command requires Administrator permissions.').catch(() => {});
        }
        const lang = client.detectLanguage ? client.detectLanguage('setup', 'en') : 'en';
        await module.exports.startWizard(message, client, lang, false);
    },

    // ================= START WIZARD =================
    async startWizard(context, client, lang, isSlash) {
        const translations = t[lang];
        const guild = context.guild;
        const userId = isSlash ? context.user.id : context.author.id;
        const settings = client.getServerSettings(guild.id);
        const prefix = settings.prefix || '.';

        const wizardState = { rules: null, welcome: null, memberRole: null, log: null, step: 0 };

        const reply = async (options) => {
            if (isSlash) {
                if (context.deferred || context.replied) return context.editReply(options).catch(() => {});
                return context.reply(options).catch(() => {});
            }
            return context.reply(options).catch(() => {});
        };

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setAuthor({ name: translations.title, iconURL: client.user.displayAvatarURL() })
            .setDescription(translations.welcome)
            .setFooter({ text: `${guild.name} • ${translations.footer}` })
            .setTimestamp();

        const startRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('setup_start').setLabel(translations.start).setStyle(ButtonStyle.Success).setEmoji('🚀'),
                new ButtonBuilder().setCustomId('setup_cancel').setLabel(translations.skip).setStyle(ButtonStyle.Secondary).setEmoji('❌')
            );

        const welcomeMsg = await reply({ embeds: [welcomeEmbed], components: [startRow], fetchReply: true });

        const filter = (i) => i.user.id === userId;
        const collector = welcomeMsg.createMessageComponentCollector({ filter, time: COLLECTOR_TIME });

        collector.on('collect', async (i) => {
            if (i.customId === 'setup_cancel') {
                collector.stop();
                await i.update({ content: translations.cancelled, embeds: [], components: [] }).catch(() => {});
                return;
            }
            if (i.customId === 'setup_start') {
                collector.stop();
                await module.exports.runStep1(i, client, guild, wizardState, translations, prefix, userId);
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time' && wizardState.step === 0) {
                await welcomeMsg.edit({ content: translations.timeout, embeds: [], components: [] }).catch(() => {});
            }
        });
    },

    // ================= STEP 1: RULES CHANNEL =================
async runStep1(interaction, client, guild, state, t, prefix, userId) {
    state.step = 1;
    const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).first(25);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('setup_rules')
        .setPlaceholder(t.selectChannel)
        .addOptions(channels.map(c => ({ label: `#${c.name}`.slice(0, 25), value: c.id, emoji: '📜' })));

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const skipRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_skip').setLabel(t.skip).setStyle(ButtonStyle.Secondary).setEmoji('⏭️')
    );

    const embed = new EmbedBuilder().setColor('#3498db').setTitle(t.step1_title).setDescription(t.step1_desc)
        .setFooter({ text: `${guild.name} • ${t.footer} • Step 1/5` });

    // 🔥 Use editReply for subsequent steps, reply for first
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed], components: [row, skipRow] }).catch(() => {});
    } else {
        await interaction.update({ embeds: [embed], components: [row, skipRow] }).catch(() => {});
    }

    const filter = (i) => i.user.id === userId;
    const msg = await interaction.fetchReply().catch(() => null);
    if (!msg) return;
    const collector = msg.createMessageComponentCollector({ filter, time: COLLECTOR_TIME });

    collector.on('collect', async (i) => {
        // 🔥 DEFER FIRST — acknowledges immediately
        await i.deferUpdate().catch(() => {});
        
        if (i.customId === 'setup_skip') {
            collector.stop();
            return module.exports.runStep2(i, client, guild, state, t, prefix, userId);
        }
        if (i.customId === 'setup_rules') {
            state.rules = i.values[0];
            client.updateServerSetting(guild.id, 'rules', state.rules);
            collector.stop();
            return module.exports.runStep2(i, client, guild, state, t, prefix, userId);
        }
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') await msg.edit({ content: t.timeout, embeds: [], components: [] }).catch(() => {});
    });
},

// ================= STEP 2: WELCOME CHANNEL =================
async runStep2(interaction, client, guild, state, t, prefix, userId) {
    state.step = 2;
    const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).first(25);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('setup_welcome')
        .setPlaceholder(t.selectChannel)
        .addOptions(channels.map(c => ({ label: `#${c.name}`.slice(0, 25), value: c.id, emoji: '👋' })));

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const skipRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_skip').setLabel(t.skip).setStyle(ButtonStyle.Secondary).setEmoji('⏭️')
    );

    const embed = new EmbedBuilder().setColor('#2ecc71').setTitle(t.step2_title).setDescription(t.step2_desc)
        .setFooter({ text: `${guild.name} • ${t.footer} • Step 2/5` });

    await interaction.editReply({ embeds: [embed], components: [row, skipRow] }).catch(() => {});

    const filter = (i) => i.user.id === userId;
    const msg = await interaction.fetchReply().catch(() => null);
    if (!msg) return;
    const collector = msg.createMessageComponentCollector({ filter, time: COLLECTOR_TIME });

    collector.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});
        
        if (i.customId === 'setup_skip') {
    collector.stop();
    await sleep(100);  // ← ADD THIS
    return module.exports.runStep3(i, client, guild, state, t, prefix, userId);
}
if (i.customId === 'setup_welcome') {
    state.welcome = i.values[0];
    client.updateServerSetting(guild.id, 'welcome', state.welcome);
    client.updateServerSetting(guild.id, 'welcome_enabled', '1');
    collector.stop();
    await sleep(100);
    return module.exports.runStep3(i, client, guild, state, t, prefix, userId);
}
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') await msg.edit({ content: t.timeout, embeds: [], components: [] }).catch(() => {});
    });
},

// ================= STEP 3: MEMBER ROLE =================
async runStep3(interaction, client, guild, state, t, prefix, userId) {
    state.step = 3;
    const roles = guild.roles.cache.filter(r => r.name !== '@everyone' && !r.managed).first(25);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('setup_member_role')
        .setPlaceholder(t.selectRole)
        .addOptions(roles.map(r => ({ label: r.name.slice(0, 25), value: r.id, emoji: '👤' })));

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const skipRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_skip').setLabel(t.skip).setStyle(ButtonStyle.Secondary).setEmoji('⏭️')
    );

    const embed = new EmbedBuilder().setColor('#e91e63').setTitle(t.step3_title).setDescription(t.step3_desc)
        .setFooter({ text: `${guild.name} • ${t.footer} • Step 3/5` });

    await interaction.editReply({ embeds: [embed], components: [row, skipRow] }).catch(() => {});

    const filter = (i) => i.user.id === userId;
    const msg = await interaction.fetchReply().catch(() => null);
    if (!msg) return;
    const collector = msg.createMessageComponentCollector({ filter, time: COLLECTOR_TIME });

    collector.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});
        
        if (i.customId === 'setup_skip') {
            collector.stop();
            return module.exports.runStep4(i, client, guild, state, t, prefix, userId);
        }
        if (i.customId === 'setup_member_role') {
            state.memberRole = i.values[0];
            client.updateServerSetting(guild.id, 'member', state.memberRole);
            collector.stop();
            return module.exports.runStep4(i, client, guild, state, t, prefix, userId);
        }
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') await msg.edit({ content: t.timeout, embeds: [], components: [] }).catch(() => {});
    });
},

// ================= STEP 4: LOG CHANNEL =================
async runStep4(interaction, client, guild, state, t, prefix, userId) {
    state.step = 4;
    const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).first(25);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('setup_log')
        .setPlaceholder(t.selectChannel)
        .addOptions(channels.map(c => ({ label: `#${c.name}`.slice(0, 25), value: c.id, emoji: '📊' })));

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const skipRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_skip').setLabel(t.skip).setStyle(ButtonStyle.Secondary).setEmoji('⏭️')
    );

    const embed = new EmbedBuilder().setColor('#e67e22').setTitle(t.step4_title).setDescription(t.step4_desc)
        .setFooter({ text: `${guild.name} • ${t.footer} • Step 4/5` });

    await interaction.editReply({ embeds: [embed], components: [row, skipRow] }).catch(() => {});

    const filter = (i) => i.user.id === userId;
    const msg = await interaction.fetchReply().catch(() => null);
    if (!msg) return;
    const collector = msg.createMessageComponentCollector({ filter, time: COLLECTOR_TIME });

    collector.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});
        
        if (i.customId === 'setup_skip') {
            collector.stop();
            return module.exports.runStep5(i, client, guild, state, t, prefix, userId);
        }
        if (i.customId === 'setup_log') {
            state.log = i.values[0];
            client.updateServerSetting(guild.id, 'log', state.log);
            collector.stop();
            return module.exports.runStep5(i, client, guild, state, t, prefix, userId);
        }
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') await msg.edit({ content: t.timeout, embeds: [], components: [] }).catch(() => {});
    });
},

// ================= STEP 5: SUMMARY =================
async runStep5(interaction, client, guild, state, t, prefix, userId) {
    state.step = 5;

    const desc = t.step5_desc(prefix)
        .replace('{rules}', state.rules || '❌')
        .replace('{welcome}', state.welcome || '❌')
        .replace('{role}', state.memberRole || '❌')
        .replace('{log}', state.log || '❌');

    const embed = new EmbedBuilder().setColor('#ffd700').setTitle(t.step5_title).setDescription(desc)
        .setFooter({ text: `${guild.name} • ${t.footer}` }).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_finish').setLabel(t.finish).setStyle(ButtonStyle.Success).setEmoji('✅')
    );

    await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});

    const filter = (i) => i.user.id === userId;
    const msg = await interaction.fetchReply().catch(() => null);
    if (!msg) return;
    const collector = msg.createMessageComponentCollector({ filter, time: 30000 });

    collector.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});
        if (i.customId === 'setup_finish') {
            collector.stop();
            await i.editReply({ content: '✅ **Setup complete!** Use `/serversettings view`, `/channels view` and `/roles view` to review.', embeds: [], components: [] }).catch(() => {});
            }
        });
    }
};