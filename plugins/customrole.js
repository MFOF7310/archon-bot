const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };

const T = {
    en: { title: '🎨 Custom Role Shop', balanceCheck: '💰 You need **{cost}** credits. Your balance: **{balance}**', purchased: '🎉 Role created and assigned!', removed: em('ic_off', em('ic_off', '❌')) + ' Role removed.', exists: em('ic_off', em('ic_off', '❌')) + ' You already have a custom role.', notFound: em('ic_off', em('ic_off', '❌')) + ' Role not found.', invalidColor: em('ic_off', em('ic_off', '❌')) + ' Unknown colour. Type a name like `gold` or `royal blue`, or a hex like `#FF5733`.', noPermission: em('ic_off', em('ic_off', '❌')) + ' Bot needs Manage Roles permission.', footer: 'Custom Role Shop • v{version}', availableColors: '🎨 Available Colors', presetColors: { red: '#FF0000', blue: '#0000FF', green: '#00FF00', purple: '#9B59B6', gold: '#FFD700', pink: '#FF69B4', cyan: '#00FFFF', orange: '#FFA500' }, cost: 5000 },
    fr: { title: '🎨 Boutique de Rôles Personnalisés', balanceCheck: '💰 Vous avez besoin de **{cost}** crédits. Votre solde : **{balance}**', purchased: '🎉 Rôle créé et attribué !', removed: em('ic_off', em('ic_off', '❌')) + ' Rôle supprimé.', exists: em('ic_off', em('ic_off', '❌')) + ' Vous avez déjà un rôle personnalisé.', notFound: em('ic_off', em('ic_off', '❌')) + ' Rôle introuvable.', invalidColor: em('ic_off', em('ic_off', '❌')) + ' Couleur inconnue. Tape un nom comme `or` ou `bleu royal`, ou un code comme `#FF5733`.', noPermission: em('ic_off', em('ic_off', '❌')) + ' Le bot a besoin de la permission Gérer les Rôles.', footer: 'Boutique de Rôles • v{version}', availableColors: '🎨 Couleurs Disponibles', presetColors: { red: '#FF0000', blue: '#0000FF', green: '#00FF00', purple: '#9B59B6', gold: '#FFD700', pink: '#FF69B4', cyan: '#00FFFF', orange: '#FFA500' }, cost: 5000 }
};

// Takes the price through the bot's safe path. false when the member can't pay.
function takeCost(client, db, userId, guildId, cost) {
    if (client.removeCredits) return !!client.removeCredits(userId, guildId, cost)?.ok;
    return db.prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ? AND credits >= ?').run(cost, userId, guildId, cost).changes > 0;
}
function giveBack(client, db, userId, guildId, cost) {
    if (client.addCredits) client.addCredits(userId, guildId, cost);
    else db.prepare('UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?').run(cost, userId, guildId);
}

module.exports = {
    name: 'customrole', aliases: ['colorrole', 'myrole', 'buyrole'],
    description: '🎨 Buy a custom color role with credits — express yourself!',
    category: 'ECONOMY', cooldown: 10000, usage: '.customrole <color> <name>', examples: ['.customrole #FF5733 MyRole', '.customrole red VIP', '/customrole color:#3498db name:Elite'],
    data: new SlashCommandBuilder().setName('customrole').setDescription('🎨 Buy a custom color role').addStringOption(o => o.setName('color').setDescription('A colour name (red, gold, royal blue...) or #hex').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('name').setDescription('Role name').setRequired(true)),
    run: async (client, message, args, db, ss, used, lang) => {
        // The language was used here without being defined, so this command always failed ("lang is not defined")
        if (!lang) lang = require('../lib/pick-lang').pickLang(client, message?.guild?.id, message, message?.author?.id);

        const t = T[lang] || T.en, guild = message.guild, user = message.author;
        if (!guild) return message.reply(em('ic_off', em('ic_off', '❌')) + ' Server only.').catch(() => {});
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
        colorInput = t.presetColors[String(colorInput || '').toLowerCase()] || require('../lib/colors').resolve(colorInput) || '';   // names in en/fr/zh/ar, or a hex
        if (!colorInput.match(/^#[0-9A-Fa-f]{6}$/)) return message.reply(t.invalidColor).catch(() => {});

        const roleName = 'CR: ' + args.slice(1).join(' ').substring(0, 30);

        // The credits are taken first, through the bot's safe path, and given back if the role can't be created.
        // (Taking them after, straight in the database, could be undone by the next automatic save: a free role.)
        if (!takeCost(client, db, user.id, guildId, t.cost)) return message.reply(t.balanceCheck.replace('{cost}', t.cost.toLocaleString()).replace('{balance}', balance.toLocaleString())).catch(() => {});
        try {
            const role = await guild.roles.create({ name: roleName, colors: [colorInput], reason: `Custom role purchased by ${user.tag}`, position: guild.members.me.roles.highest.position - 1 });
            await guild.members.cache.get(user.id).roles.add(role);

            const embed = new EmbedBuilder().setColor(colorInput).setTitle(t.purchased).setDescription(
                `**Role:** <@&${role.id}>\n**Color:** \`${colorInput}\`\n**Cost:** ${t.cost.toLocaleString()} 🪙\n**New Balance:** ${(balance - t.cost).toLocaleString()} 🪙`
            ).setFooter({ text: t.footer.replace('{version}', client.version || '2.0') }).setTimestamp();
            message.reply({ embeds: [embed] }).catch(() => {});
        } catch (e) { giveBack(client, db, user.id, guildId, t.cost); message.reply(t.noPermission).catch(() => {}); }
    },
    // colour names in the member's language, or the hex they typed (lib/colors)
    autocomplete: async (interaction, client) => {
        const lang = require('../lib/pick-lang').pickLang(client, interaction.guildId, interaction, interaction.user.id);
        const q = (() => { try { return interaction.options.getFocused(); } catch { return ''; } })();
        return interaction.respond(require('../lib/colors').suggest(q, ['en', 'fr', 'zh', 'ar'].includes(lang) ? lang : 'en')).catch(() => {});
    },
    execute: async (interaction, client) => {
        const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr']);
        const t = T[lang] || T.en, guild = interaction.guild;
        if (!guild) return interaction.reply({ content: em('ic_off', em('ic_off', '❌')) + ' Server only.', flags: 64 });
        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: t.noPermission, flags: 64 });

        const colorInputRaw = interaction.options.getString('color');
        const roleNameInput = interaction.options.getString('name');
        await interaction.deferReply();

        const guildId = guild.id;
        let userData = client.getUserData ? client.getUserData(interaction.user.id, guildId) : null;
        if (!userData) userData = client.db?.prepare("SELECT credits FROM users WHERE id = ? AND guild_id = ?")?.get(interaction.user.id, guildId);
        const balance = userData?.credits || 0;
        if (balance < t.cost) return interaction.editReply(t.balanceCheck.replace('{cost}', t.cost.toLocaleString()).replace('{balance}', balance.toLocaleString()));

        let colorInput = colorInputRaw;
        colorInput = t.presetColors[String(colorInput || '').toLowerCase()] || require('../lib/colors').resolve(colorInput) || '';   // names in en/fr/zh/ar, or a hex
        if (!colorInput.match(/^#[0-9A-Fa-f]{6}$/)) return interaction.editReply(t.invalidColor);

        const roleName = 'CR: ' + roleNameInput.substring(0, 30);

        if (!takeCost(client, client.db, interaction.user.id, guildId, t.cost)) return interaction.editReply(t.balanceCheck.replace('{cost}', t.cost.toLocaleString()).replace('{balance}', balance.toLocaleString()));
        try {
            const role = await guild.roles.create({ name: roleName, colors: [colorInput], reason: `Custom role purchased by ${interaction.user.tag}`, position: guild.members.me.roles.highest.position - 1 });
            await guild.members.cache.get(interaction.user.id).roles.add(role);
            const embed = new EmbedBuilder().setColor(colorInput).setTitle(t.purchased).setDescription(`**Role:** <@&${role.id}>\n**Color:** \`${colorInput}\`\n**Cost:** ${t.cost.toLocaleString()} 🪙\n**New Balance:** ${(balance - t.cost).toLocaleString()} 🪙`).setFooter({ text: t.footer.replace('{version}', client.version || '2.0') }).setTimestamp();
            interaction.editReply({ embeds: [embed] });
        } catch (e) { giveBack(client, client.db, interaction.user.id, guildId, t.cost); interaction.editReply(t.noPermission); }
    }
};