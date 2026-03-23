const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['h', 'menu', 'list', 'commands'],
    description: 'Access the ARCHITECT Neural Directory and command database.',
    category: 'SYSTEM',
    run: async (client, message, args) => {
        const prefix = process.env.PREFIX || '.';
        const emojiMap = {
            SYSTEM: '📡', GAMING: '🎮', AI: '🧠', 
            PROFILE: '👤', OWNER: '👑', GENERAL: '📁'
        };

        // --- SUB-COMMAND LOGIC (Help <cmd>) ---
        if (args[0]) {
            const cmd = client.commands.get(args[0].toLowerCase()) || 
                        client.commands.find(c => c.aliases && c.aliases.includes(args[0].toLowerCase()));

            if (!cmd) return message.reply("❌ **SIGNAL LOST:** Command not found in local database.");

            const detailEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: 'COMMAND DATA_EXTRACT', iconURL: client.user.displayAvatarURL() })
                .setTitle(`◈ MODULE: ${cmd.name.toUpperCase()} ◈`)
                .setDescription(`\`\`\`fix\n${cmd.description || 'No description encrypted.'}\`\`\``)
                .addFields(
                    { name: '📂 CATEGORY', value: `\`${cmd.category || 'GENERAL'}\``, inline: true },
                    { name: '🔧 USAGE', value: `\`${prefix}${cmd.name} ${cmd.usage || ''}\``.trim(), inline: true },
                    { name: '🔀 ALIASES', value: `\`${cmd.aliases?.join(', ') || 'NONE'}\``, inline: true }
                )
                .setFooter({ text: 'ARCHITECT CG-223 | Bamako Node' })
                .setTimestamp();

            return message.reply({ embeds: [detailEmbed] });
        }

        // --- MAIN DIRECTORY LOGIC ---
        const categories = [...new Set(client.commands.map(cmd => cmd.category || 'GENERAL'))];
        
        const mainEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: 'ARCHITECT CG-223 | NEURAL DIRECTORY', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `**System Status:** \`🟢 ONLINE\`\n` +
                `**Node:** \`Bamako-223\`\n` +
                `**Core:** \`Groq LPU™ + Brave Search\`\n\n` +
                `Select a module category from the menu below to decrypt available commands.`
            )
            .addFields({ name: '📊 DATA LOAD', value: `\`${client.commands.size}\` Modules Active`, inline: true })
            .setFooter({ text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY' })
            .setTimestamp();

        // Create the Select Menu
        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_select')
            .setPlaceholder('Select a System Module...')
            .addOptions(categories.map(cat => ({
                label: cat.toUpperCase(),
                value: cat,
                description: `View all ${cat} commands`,
                emoji: emojiMap[cat.toUpperCase()] || '📁'
            })));

        const row = new ActionRowBuilder().addComponents(menu);

        const response = await message.reply({
            content: `> **Initializing Directory handshake...**`,
            embeds: [mainEmbed],
            components: [row]
        });

        // --- INTERACTION COLLECTOR ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 300000 // 5 Minutes
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return i.reply({ content: '⛔ Access Denied.', ephemeral: true });

            const category = i.values[0];
            const cmds = client.commands.filter(c => (c.category || 'GENERAL') === category);

            const catEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setTitle(`─ ${emojiMap[category.toUpperCase()] || '📁'} ${category.toUpperCase()} MODULES ─`)
                .setDescription(
                    cmds.map(c => `**${prefix}${c.name}**\n└─ \`${c.description}\``).join('\n\n')
                )
                .setFooter({ text: `Use ${prefix}help <command> for deep-scan details.` });

            await i.update({ embeds: [catEmbed] });
        });

        collector.on('end', () => {
            const disabled = new ActionRowBuilder().addComponents(menu.setDisabled(true));
            response.edit({ components: [disabled] }).catch(() => null);
        });
    }
};
