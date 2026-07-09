const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle
} = require('discord.js');

const COLORS = {
    cyan: 0x00f0ff, green: 0x00ff88, red: 0xff3333,
    gold: 0xf1c40f, purple: 0x9b59b6, orange: 0xe67e22,
    blue: 0x3498db, pink: 0xff69b4
};

const COLOR_NAMES = Object.keys(COLORS);

module.exports = {
    name: 'autoreply',
    aliases: ['ar', 'filter', 'autoresponse'],
    description: '🤖 Set up automatic keyword replies',
    category: 'UTILITY',
    cooldown: 1000,

    data: new SlashCommandBuilder()
        .setName('autoreply')
        .setDescription('🤖 Manage automatic keyword replies')
        .addSubcommand(s => s.setName('add').setDescription('Add a keyword auto-reply')
            .addStringOption(o => o.setName('keyword').setDescription('Trigger keyword or phrase').setRequired(true))
            .addStringOption(o => o.setName('response').setDescription('Bot response text').setRequired(true))
            .addStringOption(o => o.setName('title').setDescription('Embed title (optional)').setRequired(false))
            .addStringOption(o => o.setName('color').setDescription('Embed color').setRequired(false)
                .addChoices(
                    { name: '🔵 Cyan', value: 'cyan' },
                    { name: '🟢 Green', value: 'green' },
                    { name: '🔴 Red', value: 'red' },
                    { name: '🟡 Gold', value: 'gold' },
                    { name: '🟣 Purple', value: 'purple' },
                    { name: '🟠 Orange', value: 'orange' },
                    { name: '💙 Blue', value: 'blue' },
                    { name: '🩷 Pink', value: 'pink' },
                ))
            .addChannelOption(o => o.setName('channel').setDescription('Limit to specific channel (leave empty for all channels)').setRequired(false)))
        .addSubcommand(s => s.setName('remove').setDescription('Remove a keyword auto-reply')
            .addStringOption(o => o.setName('keyword').setDescription('Keyword to remove').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Specific channel (leave empty for guild-wide)').setRequired(false)))
        .addSubcommand(s => s.setName('list').setDescription('List all auto-replies for this server'))
        .addSubcommand(s => s.setName('clear').setDescription('Clear all auto-replies for this server')),

    execute: async (interaction, client) => {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild?.id;
        const db = client.db;

        // Permission check
        const isAdmin = interaction.member?.permissions?.has('ManageMessages') ||
            interaction.user.id === process.env.OWNER_ID;
        if (!isAdmin) return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xff3333).setDescription('```ansi\n\u001b[1;31m▸ ADMIN ONLY\u001b[0m\n\u001b[0;37mYou need Manage Messages permission.\u001b[0m\n```')],
            flags: 64
        });

        // ── ADD ──
        if (sub === 'add') {
            const keyword = interaction.options.getString('keyword').toLowerCase().trim();
            const response = interaction.options.getString('response');
            const title = interaction.options.getString('title') || null;
            const colorName = interaction.options.getString('color') || 'cyan';
            const channel = interaction.options.getChannel('channel');
            const channelId = channel?.id || null;
            const color = COLORS[colorName] || COLORS.cyan;

            try {
                db.prepare(`
                    INSERT OR REPLACE INTO auto_replies (guild_id, channel_id, keyword, response, embed_title, embed_color, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(guildId, channelId, keyword, response, title, String(color), interaction.user.id);

                const preview = new EmbedBuilder()
                    .setColor(color)
                    .setTitle(title || null)
                    .setDescription(response)
                    .setFooter({ text: 'BAMAKO_223 🇲🇱', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();

                const confirm = new EmbedBuilder()
                    .setColor(0x00ff88)
                    .setAuthor({ name: '// ARCHON AUTO-REPLY //', iconURL: client.user.displayAvatarURL() })
                    .setDescription(`\`\`\`ansi\n\u001b[1;32m▸ AUTO-REPLY CREATED\u001b[0m\n\`\`\``)
                    .addFields(
                        { name: '🔑 Keyword', value: `\`${keyword}\``, inline: true },
                        { name: '📍 Scope', value: channel ? `<#${channel.id}>` : 'All channels', inline: true },
                        { name: '🎨 Color', value: colorName, inline: true },
                    )
                    .setFooter({ text: `BAMAKO_223 🇲🇱 • Set by ${interaction.user.username}` });

                await interaction.reply({ embeds: [confirm] });
                // Show preview
                await interaction.followUp({ content: '**Preview of how it will look:**', embeds: [preview] });

            } catch(e) {
                await interaction.reply({
                    embeds: [new EmbedBuilder().setColor(0xff3333).setDescription(`\`\`\`ansi\n\u001b[1;31m▸ ERROR\u001b[0m\n\u001b[0;37m${e.message}\u001b[0m\n\`\`\``)],
                    flags: 64
                });
            }
            return;
        }

        // ── REMOVE ──
        if (sub === 'remove') {
            const keyword = interaction.options.getString('keyword').toLowerCase().trim();
            const channel = interaction.options.getChannel('channel');
            const channelId = channel?.id || null;

            const result = channelId
                ? db.prepare('DELETE FROM auto_replies WHERE guild_id = ? AND keyword = ? AND channel_id = ?').run(guildId, keyword, channelId)
                : db.prepare('DELETE FROM auto_replies WHERE guild_id = ? AND keyword = ?').run(guildId, keyword);

            if (result.changes === 0) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor(0xff3333).setDescription(`\`\`\`ansi\n\u001b[1;31m▸ NOT FOUND\u001b[0m\n\u001b[0;37mNo auto-reply found for keyword: ${keyword}\u001b[0m\n\`\`\``)],
                    flags: 64
                });
            }

            await interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x00ff88).setDescription(`\`\`\`ansi\n\u001b[1;32m▸ REMOVED\u001b[0m\n\u001b[0;37mAuto-reply for "${keyword}" deleted.\u001b[0m\n\`\`\``)]
            });
            return;
        }

        // ── LIST ──
        if (sub === 'list') {
            const replies = db.prepare('SELECT * FROM auto_replies WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);

            if (!replies.length) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('```ansi\n\u001b[1;33m▸ NO AUTO-REPLIES\u001b[0m\n\u001b[0;37mAdd one with /autoreply add\u001b[0m\n```')]
                });
            }

            const list = replies.map((r, i) => {
                const scope = r.channel_id ? `<#${r.channel_id}>` : 'All channels';
                const preview = r.response.substring(0, 40) + (r.response.length > 40 ? '...' : '');
                return `\`${(i+1).toString().padStart(2)}.\` **${r.keyword}** → ${preview}\n` +
                       `     📍 ${scope} • 🎯 ${r.trigger_count} triggers`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setColor(0x00f0ff)
                .setAuthor({ name: '// ARCHON AUTO-REPLY ENGINE //', iconURL: client.user.displayAvatarURL() })
                .setTitle(`🤖 Auto-Replies (${replies.length})`)
                .setDescription(list)
                .setFooter({ text: `BAMAKO_223 🇲🇱 • /autoreply add to create • /autoreply remove to delete` })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ── CLEAR ──
        if (sub === 'clear') {
            const count = db.prepare('SELECT COUNT(*) as c FROM auto_replies WHERE guild_id = ?').get(guildId)?.c || 0;
            if (count === 0) return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('```ansi\n\u001b[1;33m▸ NOTHING TO CLEAR\u001b[0m\n```')]
            });

            // Confirmation button
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ar_confirm_clear').setLabel(`Clear all ${count} replies`).setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
                new ButtonBuilder().setCustomId('ar_cancel_clear').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );

            const msg = await interaction.reply({
                embeds: [new EmbedBuilder().setColor(0xff3333)
                    .setDescription(`\`\`\`ansi\n\u001b[1;31m▸ CONFIRM CLEAR\u001b[0m\n\u001b[0;37mThis will delete all ${count} auto-replies permanently.\u001b[0m\n\`\`\``)],
                components: [row],
                fetchReply: true
            });

            const collector = msg.createMessageComponentCollector({ time: 15000 });
            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Not your button!', flags: 64 });
                if (i.customId === 'ar_confirm_clear') {
                    db.prepare('DELETE FROM auto_replies WHERE guild_id = ?').run(guildId);
                    await i.update({
                        embeds: [new EmbedBuilder().setColor(0x00ff88).setDescription(`\`\`\`ansi\n\u001b[1;32m▸ CLEARED\u001b[0m\n\u001b[0;37mAll ${count} auto-replies deleted.\u001b[0m\n\`\`\``)],
                        components: []
                    });
                } else {
                    await i.update({ embeds: [new EmbedBuilder().setColor(0x00f0ff).setDescription('```ansi\n\u001b[1;36m▸ CANCELLED\u001b[0m\n```')], components: [] });
                }
                collector.stop();
            });
            collector.on('end', () => { msg.edit?.({ components: [] }).catch(() => {}); });
        }
    },

    // Prefix run
    run: async (client, message, args) => {
        const sub = args[0]?.toLowerCase();
        const guildId = message.guild?.id;
        const db = client.db;

        const isAdmin = message.member?.permissions?.has('ManageMessages') ||
            message.author.id === process.env.OWNER_ID;
        if (!isAdmin) return message.reply('❌ You need Manage Messages permission.').catch(() => {});

        if (sub === 'list' || !sub) {
            const replies = db.prepare('SELECT * FROM auto_replies WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
            if (!replies.length) return message.reply('No auto-replies set. Use `/autoreply add` to create one.').catch(() => {});
            const list = replies.map((r, i) => `${i+1}. **${r.keyword}** → ${r.response.substring(0,50)}...`).join('\n');
            return message.reply({ embeds: [new EmbedBuilder().setColor(0x00f0ff).setTitle('🤖 Auto-Replies').setDescription(list)] }).catch(() => {});
        }

        return message.reply('Use `/autoreply` slash command for full features.').catch(() => {});
    }
};
