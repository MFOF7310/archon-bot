const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'setgiftchannel',
    aliases: ['setgc', 'giftchannel'],
    description: '🎁 Set the channel where giveaway winners will be announced (per‑server).',
    category: 'CONFIG',
    cooldown: 3000,
    userPermissions: ['ManageGuild'],
    usage: '.setgiftchannel #channel',
    examples: ['.setgiftchannel #winners', '.setgc #giveaway-logs'],

    // ================= SLASH COMMAND (optional) =================
    data: {
        name: 'setgiftchannel',
        description: 'Set the channel for giveaway winner announcements',
        options: [
            {
                name: 'channel',
                description: 'The text channel to use',
                type: 7, // CHANNEL
                required: true,
                channelTypes: [0] // GUILD_TEXT
            }
        ]
    },

    async execute(interaction, client) {
        // Handle slash command
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;

        // Permission check
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
                content: '❌ You need **Manage Server** permission to use this command.',
                ephemeral: true
            });
        }

        // Save to database
        const db = client.db;
        const existing = db.prepare('SELECT guild_id FROM server_config WHERE guild_id = ?').get(guildId);
        
        if (existing) {
            db.prepare('UPDATE server_config SET gift_channel = ? WHERE guild_id = ?').run(channel.id, guildId);
        } else {
            db.prepare('INSERT INTO server_config (guild_id, gift_channel) VALUES (?, ?)').run(guildId, channel.id);
        }

        // Clear any cached settings
        if (client.serverConfigCache) client.serverConfigCache.delete(guildId);

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: '🎁 GIFT CHANNEL SET', iconURL: client.user.displayAvatarURL() })
            .setDescription(`✅ Giveaway winners will now be announced in ${channel}.`)
            .addFields(
                { name: 'Channel', value: `${channel}`, inline: true },
                { name: 'Server', value: interaction.guild.name, inline: true }
            )
            .setFooter({ text: `Set by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async run(client, message, args, db) {
        // Handle prefix command
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ You need **Manage Server** permission.');
        }

        const channel = message.mentions.channels.first();
        if (!channel) {
            return message.reply('❌ Please mention a text channel.\nExample: `.setgiftchannel #announcements`');
        }

        if (!channel.isTextBased()) {
            return message.reply('❌ That channel is not a text channel.');
        }

        const guildId = message.guild.id;

        // Upsert into server_config
        const existing = db.prepare('SELECT guild_id FROM server_config WHERE guild_id = ?').get(guildId);
        if (existing) {
            db.prepare('UPDATE server_config SET gift_channel = ? WHERE guild_id = ?').run(channel.id, guildId);
        } else {
            db.prepare('INSERT INTO server_config (guild_id, gift_channel) VALUES (?, ?)').run(guildId, channel.id);
        }

        // Clear cache if any
        if (client.serverConfigCache) client.serverConfigCache.delete(guildId);

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: '🎁 GIFT CHANNEL SET', iconURL: client.user.displayAvatarURL() })
            .setDescription(`✅ Giveaway winners will now be announced in ${channel}.`)
            .addFields(
                { name: 'Channel', value: `${channel}`, inline: true },
                { name: 'Server', value: message.guild.name, inline: true }
            )
            .setFooter({ text: `Set by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};