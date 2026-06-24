const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const T = {
    en: { title: '🎨 Custom Role Shop', balanceCheck: '💰 You need **{cost}** credits. Your balance: **{balance}**', purchased: '🎉 Role created and assigned!', removed: '❌ Role removed.', exists: '❌ You already have a custom role.', notFound: '❌ Role not found.', invalidColor: '❌ Invalid color. Use hex: `#FF5733`', noPermission: '❌ Bot needs Manage Roles permission.', footer: 'Custom Role Shop • v{version}', availableColors: '🎨 Available Colors', presetColors: { red: '#FF0000', blue: '#0000FF', green: '#00FF00', purple: '#9B59B6', gold: '#FFD700', pink: '#FF69B4', cyan: '#00FFFF', orange: '#FFA500' }, cost: 5000 },
    fr: { title: '🎨 Boutique de Rôles Personnalisés', balanceCheck: '💰 Vous avez besoin de **{cost}** crédits. Votre solde : **{balance}**', purchased: '🎉 Rôle créé et attribué !', removed: '❌ Rôle supprimé.', exists: '❌ Vous avez déjà un rôle personnalisé.', notFound: '❌ Rôle introuvable.', invalidColor: '❌ Couleur invalide. Utilisez un hex : `#FF5733`', noPermission: '❌ Le bot a besoin de la permission Gérer les Rôles.', footer: 'Boutique de Rôles • v{version}', availableColors: '🎨 Couleurs Disponibles', presetColors: { red: '#FF0000', blue: '#0000FF', green: '#00FF00', purple: '#9B59B6', gold: '#FFD700', pink: '#FF69B4', cyan: '#00FFFF', orange: '#FFA500' }, cost: 5000 }
};

module.exports = {
    name: 'customrole', aliases: ['role', 'colorrole', 'myrole', 'buyrole'],
    description: '🎨 Buy a custom color role with credits — express yourself!',
    category: 'ECONOMY', cooldown: 10000, usage: '.customrole <color> <name>', examples: ['.customrole #FF5733 MyRole', '.customrole red VIP', '/customrole color:#3498db name:Elite'],
    data: new SlashCommandBuilder().setName('customrole').setDescription('🎨 Buy a custom color role').addStringOption(o => o.setName('color').setDescription('Color hex or name (red, blue, green...)').setRequired(true)).addStringOption(o => o.setName('name').setDescription('Role name').setRequired(true)),
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang], guild = message.guild, user = message.author;
        if (!guild) return message.reply('❌ Server only.').catch(() => {});
        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply(t.noPermission).catch(() => {});

        if (args.length < 2) {
            const embed = new EmbedBuilder().setColor('#00fbff').setTitle(t.title).setDescription(
                `**Cost:** ${t.cost.toLocaleString()} 🪙\n\n**${t.availableColors}:**\n` +
                Object.entries(t.presetColors).map(([name, hex]) => `• \`${hex}\` ${name.charAt(0).toUpperCase() + name.slice(1)}`).join('\n') +
                `\n\n**Usage:** \`.customrole #FF5733 MyRole\` or \`.customrole red VIP\``
            ).setFooter({ text: t.footer.replace('{version}', client.version || '2.0') }).setTimestamp();
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // Check balance
        const guildId = guild.id;
        let userData = client.getUserData ? client.getUserData(user.id, guildId) : null;
        if (!userData) userData = db.prepare("SELECT credits FROM users WHERE id = ? AND guild_id = ?").get(user.id, guildId);
        const balance = userData?.credits || 0;
        if (balance < t.cost) return message.reply(t.balanceCheck.replace('{cost}', t.cost.toLocaleString()).replace('{balance}', balance.toLocaleString())).catch(() => {});

        // Check existing custom role
        const existingRole = guild.roles.cache.find(r => r.name.startsWith('CR:') && r.members?.has?.(user.id));
        if (existingRole) return message.reply(t.exists).catch(() => {});

        // Parse color
        let colorInput = args[0];
        const preset = t.presetColors[colorInput.toLowerCase()];
        if (preset) colorInput = preset;
        if (!colorInput.match(/^#[0-9A-Fa-f]{6}$/)) return message.reply(t.invalidColor).catch(() => {});

        const roleName = 'CR: ' + args.slice(1).join(' ').substring(0, 30);

        try {
            const role = await guild.roles.create({ name: roleName, colors: [colorInput], reason: `Custom role purchased by ${user.tag}`, position: guild.members.me.roles.highest.position - 1 });
            await guild.members.cache.get(user.id).roles.add(role);

            // Deduct credits
            db.prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ?").run(t.cost, user.id, guildId);
            if (client.queueUserUpdate) client.queueUserUpdate(user.id, guildId, { ...userData, credits: balance - t.cost });

            const embed = new EmbedBuilder().setColor(colorInput).setTitle(t.purchased).setDescription(
                `**Role:** <@&${role.id}>\n**Color:** \`${colorInput}\`\n**Cost:** ${t.cost.toLocaleString()} 🪙\n**New Balance:** ${(balance - t.cost).toLocaleString()} 🪙`
            ).setFooter({ text: t.footer.replace('{version}', client.version || '2.0') }).setTimestamp();
            message.reply({ embeds: [embed] }).catch(() => {});
        } catch (e) { message.reply(t.noPermission).catch(() => {}); }
    },
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang], guild = interaction.guild;
        if (!guild) return interaction.reply({ content: '❌ Server only.', ephemeral: true });
        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: t.noPermission, ephemeral: true });

        const colorInputRaw = interaction.options.getString('color');
        const roleNameInput = interaction.options.getString('name');
        await interaction.deferReply();

        const guildId = guild.id;
        let userData = client.getUserData ? client.getUserData(interaction.user.id, guildId) : null;
        if (!userData) userData = client.db?.prepare("SELECT credits FROM users WHERE id = ? AND guild_id = ?")?.get(interaction.user.id, guildId);
        const balance = userData?.credits || 0;
        if (balance < t.cost) return interaction.editReply(t.balanceCheck.replace('{cost}', t.cost.toLocaleString()).replace('{balance}', balance.toLocaleString()));

        let colorInput = colorInputRaw;
        const preset = t.presetColors[colorInput.toLowerCase()];
        if (preset) colorInput = preset;
        if (!colorInput.match(/^#[0-9A-Fa-f]{6}$/)) return interaction.editReply(t.invalidColor);

        const roleName = 'CR: ' + roleNameInput.substring(0, 30);

        try {
            const role = await guild.roles.create({ name: roleName, colors: [colorInput], reason: `Custom role purchased by ${interaction.user.tag}`, position: guild.members.me.roles.highest.position - 1 });
            await guild.members.cache.get(interaction.user.id).roles.add(role);
            if (client.db) client.db.prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ?").run(t.cost, interaction.user.id, guildId);
            const embed = new EmbedBuilder().setColor(colorInput).setTitle(t.purchased).setDescription(`**Role:** <@&${role.id}>\n**Color:** \`${colorInput}\`\n**Cost:** ${t.cost.toLocaleString()} 🪙\n**New Balance:** ${(balance - t.cost).toLocaleString()} 🪙`).setFooter({ text: t.footer.replace('{version}', client.version || '2.0') }).setTimestamp();
            interaction.editReply({ embeds: [embed] });
        } catch (e) { interaction.editReply(t.noPermission); }
    }
};