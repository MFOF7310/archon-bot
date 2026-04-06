const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['h', 'menu', 'docs'],
    description: 'Access the ARCHITECT Neural Directory and command database with advanced navigation.',
    category: 'SYSTEM',
    cooldown: 3000,
    
    run: async (client, message, args) => {
        const prefix = process.env.PREFIX || '.';
        
        // Enhanced emoji mapping with categories
        const emojiMap = {
            SYSTEM: '⚙️',
            GAMING: '🎮', 
            AI: '🧠', 
            PROFILE: '👤', 
            OWNER: '👑', 
            GENERAL: '📁',
            UTILITY: '🛠️',
            MODERATION: '🛡️',
            ECONOMY: '💰',
            FUN: '🎉'
        };
        
        // Color mapping for categories
        const colorMap = {
            SYSTEM: '#00fbff',
            GAMING: '#57F287',
            AI: '#9B59B6',
            PROFILE: '#FEE75C',
            OWNER: '#ED4245',
            GENERAL: '#5865F2',
            UTILITY: '#EB459E',
            MODERATION: '#E67E22',
            ECONOMY: '#F1C40F',
            FUN: '#3498DB'
        };
        
        // --- UPTIME CALCULATION ---
        const uptimeSec = process.uptime();
        const days = Math.floor(uptimeSec / 86400);
        const hours = Math.floor((uptimeSec % 86400) / 3600);
        const minutes = Math.floor((uptimeSec % 3600) / 60);
        
        // --- ACCURATE MEMBER COUNT ---
        const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const totalGuilds = client.guilds.cache.size;
        
        // Format uptime string
        let uptimeString = '';
        if (days > 0) uptimeString += `${days}d `;
        if (hours > 0) uptimeString += `${hours}h `;
        if (minutes > 0) uptimeString += `${minutes}m `;
        if (days === 0 && hours === 0 && minutes === 0) uptimeString += `${Math.floor(uptimeSec)}s`;
        else if (uptimeSec % 60 > 0 && days === 0 && hours === 0) uptimeString += `${Math.floor(uptimeSec % 60)}s`;
        
        uptimeString = uptimeString.trim() || '0s';
        
        // --- ENHANCED SUB-COMMAND LOGIC WITH CATEGORY AWARENESS ---
        if (args[0]) {
            const searchTerm = args[0].toLowerCase();
            
            // 1. Check if it's a Command
            const cmd = client.commands.get(searchTerm) || 
                        client.commands.find(c => c.aliases && c.aliases.includes(searchTerm));
            
            // 2. NEW: Check if it's a Category (This is what list.js sends!)
            const categories = [...new Set(client.commands.map(cmd => (cmd.category || 'GENERAL').toLowerCase()))];
            
            if (!cmd && categories.includes(searchTerm)) {
                // Find the original casing (e.g., 'GAMING')
                const originalCat = [...new Set(client.commands.map(cmd => cmd.category || 'GENERAL'))]
                    .find(c => c.toLowerCase() === searchTerm);
                
                if (originalCat) {
                    // This triggers your existing category display function
                    return showCategoryHelp(client, message, originalCat, prefix, emojiMap, colorMap);
                }
            }
            
            // 3. If it IS a command, show the detailed data extract
            if (cmd) {
                const category = cmd.category || 'GENERAL';
                const categoryColor = colorMap[category.toUpperCase()] || '#5865F2';
                const categoryEmoji = emojiMap[category.toUpperCase()] || '📁';

                const detailEmbed = new EmbedBuilder()
                    .setColor(categoryColor)
                    .setAuthor({ 
                        name: `${categoryEmoji} COMMAND DATA_EXTRACT`, 
                        iconURL: client.user.displayAvatarURL() 
                    })
                    .setTitle(`◈ MODULE: ${cmd.name.toUpperCase()} ◈`)
                    .setDescription(`\`\`\`prolog\n${cmd.description || 'No description encrypted. Use .help for module list.'}\`\`\``)
                    .addFields(
                        { name: '📂 CATEGORY', value: `\`${category}\``, inline: true },
                        { name: '🔧 USAGE', value: `\`${prefix}${cmd.name} ${cmd.usage || ''}\``.trim(), inline: true },
                        { name: '🔀 ALIASES', value: `\`${cmd.aliases?.join(', ') || 'NONE'}\``, inline: true },
                        { name: '🎯 EXAMPLES', value: cmd.examples ? `\`${cmd.examples.map(ex => `${prefix}${cmd.name} ${ex}`).join('`\n`')}\`` : '`No examples available`', inline: false }
                    )
                    .setFooter({ text: `ARCHITECT CG-223 • Bamako Node • ${client.commands.size} modules online • v${client.version || '1.1.0'}` })
                    .setTimestamp();

                if (cmd.cooldown) {
                    detailEmbed.addFields({ name: '⏱️ COOLDOWN', value: `\`${cmd.cooldown/1000} seconds\``, inline: true });
                }

                return message.reply({ embeds: [detailEmbed] });
            }

            // 4. If nothing found
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: '❌ SIGNAL LOST', iconURL: client.user.displayAvatarURL() })
                .setTitle('Command Not Found')
                .setDescription(`\`\`\`diff\n- Command or category "${args[0]}" not found in neural database\n- Use ${prefix}help to view all available modules\`\`\``)
                .setFooter({ text: 'ARCHITECT CG-223 • Check your spelling and try again' })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }

        // --- MAIN DIRECTORY LOGIC (No args) ---
        const categories = [...new Set(client.commands.map(cmd => cmd.category || 'GENERAL'))].sort();
        
        const totalCommands = client.commands.size;
        const totalAliases = client.aliases?.size || 0;
        const categoriesCount = categories.length;
        
        const mainEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ 
                name: '⚙️ ARCHITECT CG-223 | NEURAL DIRECTORY', 
                iconURL: client.user.displayAvatarURL({ dynamic: true, size: 1024 }) 
            })
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(
                `\`\`\`prolog\n` +
                `┌─ SYSTEM STATUS: 🟢 ONLINE\n` +
                `├─ NODE: BAMAKO-223\n` +
                `├─ CORE: Groq LPU™ + Brave Search\n` +
                `├─ UPTIME: ${uptimeString}\n` +
                `└─ VERSION: v${client.version || '1.1.0'}\`\`\``
            )
            .addFields(
                { 
                    name: '📊 MODULE STATISTICS', 
                    value: `\`\`\`yaml\nCommands: ${totalCommands}\nAliases: ${totalAliases}\nCategories: ${categoriesCount}\nAgents: ${totalMembers.toLocaleString()}\nGuilds: ${totalGuilds}\`\`\``, 
                    inline: true 
                },
                { 
                    name: '🎮 QUICK ACCESS', 
                    value: `\`\`\`fix\n${prefix}game menu\n${prefix}stats\n${prefix}rank\n${prefix}alive\`\`\``, 
                    inline: true 
                },
                { 
                    name: '🤖 AI ASSISTANT', 
                    value: `\`\`\`fix\nMention @Lydia or use ${prefix}ask\nReal-time web search enabled\`\`\``, 
                    inline: true 
                }
            )
            .setFooter({ 
                text: `EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • v${client.version || '1.1.0'} • Select a module below`, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Create the Select Menu
        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_select')
            .setPlaceholder('🔍 Select a System Module to Decrypt...')
            .addOptions(categories.map(cat => ({
                label: cat.toUpperCase(),
                value: cat,
                description: `View all ${cat.toLowerCase()} commands and utilities`,
                emoji: emojiMap[cat.toUpperCase()] || '📁'
            })));

        const row1 = new ActionRowBuilder().addComponents(menu);
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('🏠 MAIN MENU')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        const response = await message.reply({
            content: `> **🔍 Initializing Neural Directory handshake...**\n> *Accessing command database across ${totalGuilds} sectors...*`,
            embeds: [mainEmbed],
            components: [row1, row2]
        });

        let currentView = 'main';
        
        // Collector for interactions
        const collector = response.createMessageComponentCollector({ 
            time: 300000 // 5 minutes
        });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: '⛔ Access Denied. This directory is locked to the requesting agent.', ephemeral: true });
            }

            // Handle Back Button
            if (i.customId === 'back_to_main' && currentView !== 'main') {
                currentView = 'main';
                
                // Recalculate fresh data
                const freshUptimeSec = process.uptime();
                const freshDays = Math.floor(freshUptimeSec / 86400);
                const freshHours = Math.floor((freshUptimeSec % 86400) / 3600);
                const freshMinutes = Math.floor((freshUptimeSec % 3600) / 60);
                const freshTotalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
                const freshTotalGuilds = client.guilds.cache.size;
                
                let freshUptimeString = '';
                if (freshDays > 0) freshUptimeString += `${freshDays}d `;
                if (freshHours > 0) freshUptimeString += `${freshHours}h `;
                if (freshMinutes > 0) freshUptimeString += `${freshMinutes}m `;
                if (freshDays === 0 && freshHours === 0 && freshMinutes === 0) freshUptimeString += `${Math.floor(freshUptimeSec)}s`;
                else if (freshUptimeSec % 60 > 0 && freshDays === 0 && freshHours === 0) freshUptimeString += `${Math.floor(freshUptimeSec % 60)}s`;
                
                freshUptimeString = freshUptimeString.trim() || '0s';
                
                const freshMainEmbed = new EmbedBuilder()
                    .setColor('#00fbff')
                    .setAuthor({ 
                        name: '⚙️ ARCHITECT CG-223 | NEURAL DIRECTORY', 
                        iconURL: client.user.displayAvatarURL({ dynamic: true, size: 1024 }) 
                    })
                    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
                    .setDescription(
                        `\`\`\`prolog\n` +
                        `┌─ SYSTEM STATUS: 🟢 ONLINE\n` +
                        `├─ NODE: BAMAKO-223\n` +
                        `├─ CORE: Groq LPU™ + Brave Search\n` +
                        `├─ UPTIME: ${freshUptimeString}\n` +
                        `└─ VERSION: v${client.version || '1.1.0'}\`\`\``
                    )
                    .addFields(
                        { 
                            name: '📊 MODULE STATISTICS', 
                            value: `\`\`\`yaml\nCommands: ${totalCommands}\nAliases: ${totalAliases}\nCategories: ${categoriesCount}\nAgents: ${freshTotalMembers.toLocaleString()}\nGuilds: ${freshTotalGuilds}\`\`\``, 
                            inline: true 
                        },
                        { 
                            name: '🎮 QUICK ACCESS', 
                            value: `\`\`\`fix\n${prefix}game menu\n${prefix}stats\n${prefix}rank\n${prefix}alive\`\`\``, 
                            inline: true 
                        },
                        { 
                            name: '🤖 AI ASSISTANT', 
                            value: `\`\`\`fix\nMention @Lydia or use ${prefix}ask\nReal-time web search enabled\`\`\``, 
                            inline: true 
                        }
                    )
                    .setFooter({ 
                        text: `EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • v${client.version || '1.1.0'} • Select a module below`, 
                        iconURL: client.user.displayAvatarURL() 
                    })
                    .setTimestamp();
                
                const disabledRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_main')
                        .setLabel('🏠 MAIN MENU')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
                await i.update({ embeds: [freshMainEmbed], components: [row1, disabledRow2] });
                return;
            }
            
            // Handle Category Selection
            if (i.isStringSelectMenu() && i.customId === 'help_select') {
                const category = i.values[0];
                await showCategoryHelp(client, message, category, prefix, emojiMap, colorMap, i);
                currentView = 'category';
                
                const updatedRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_main')
                        .setLabel('🏠 MAIN MENU')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false)
                );
                await response.edit({ components: [row1, updatedRow2] });
            }
        });

        collector.on('end', () => {
            const disabled = new ActionRowBuilder().addComponents(menu.setDisabled(true));
            const disabledButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('🏠 MAIN MENU')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            response.edit({ components: [disabled, disabledButton] }).catch(() => null);
        });
    }
};

// --- CATEGORY HELP DISPLAY FUNCTION ---
async function showCategoryHelp(client, message, category, prefix, emojiMap, colorMap, interaction = null) {
    const cmds = client.commands.filter(c => (c.category || 'GENERAL') === category);
    const categoryColor = colorMap[category.toUpperCase()] || '#5865F2';
    const categoryEmoji = emojiMap[category.toUpperCase()] || '📁';
    
    const sortedCmds = [...cmds.values()].sort((a, b) => a.name.localeCompare(b.name));
    
    const commandList = sortedCmds.map(cmd => {
        const aliasesText = cmd.aliases?.length ? ` (${cmd.aliases.slice(0, 3).join(', ')})` : '';
        const examples = cmd.examples?.length ? `\n└─ 📝 Example: \`${prefix}${cmd.name} ${cmd.examples[0]}\`` : '';
        return `**\`${prefix}${cmd.name}\`**${aliasesText}\n└─ *${cmd.description || 'No description'}*${examples}`;
    }).join('\n\n');
    
    const maxLength = 4000;
    if (commandList.length > maxLength) {
        const chunks = [];
        let currentChunk = '';
        for (const cmd of sortedCmds) {
            const cmdText = `**\`${prefix}${cmd.name}\`**\n└─ *${cmd.description || 'No description'}*\n\n`;
            if ((currentChunk + cmdText).length > maxLength) {
                chunks.push(currentChunk);
                currentChunk = cmdText;
            } else {
                currentChunk += cmdText;
            }
        }
        if (currentChunk) chunks.push(currentChunk);
        
        const catEmbed = new EmbedBuilder()
            .setColor(categoryColor)
            .setAuthor({ 
                name: `${categoryEmoji} ${category.toUpperCase()} MODULES (1/${chunks.length})`, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle('═ NEURAL COMMAND DATABASE ═')
            .setDescription(chunks[0])
            .setFooter({ text: `Use ${prefix}help <command> for details • Page 1/${chunks.length} • v${client.version || '1.1.0'}` });
        
        if (interaction) {
            await interaction.update({ embeds: [catEmbed] });
        } else {
            await message.reply({ embeds: [catEmbed] });
        }
        
        for (let idx = 1; idx < chunks.length; idx++) {
            const chunkEmbed = new EmbedBuilder()
                .setColor(categoryColor)
                .setAuthor({ 
                    name: `${categoryEmoji} ${category.toUpperCase()} MODULES (${idx+1}/${chunks.length})`, 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setDescription(chunks[idx])
                .setFooter({ text: `Page ${idx+1}/${chunks.length} • Use ${prefix}help <command> for details • v${client.version || '1.1.0'}` });
            
            await message.channel.send({ embeds: [chunkEmbed] });
        }
        return;
    }
    
    const catEmbed = new EmbedBuilder()
        .setColor(categoryColor)
        .setAuthor({ 
            name: `${categoryEmoji} ${category.toUpperCase()} MODULES`, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setTitle('═ NEURAL COMMAND DATABASE ═')
        .setDescription(commandList)
        .addFields(
            { 
                name: '📊 MODULE STATS', 
                value: `\`\`\`yaml\nTotal Commands: ${cmds.size}\nAliases Registered: ${cmds.reduce((sum, cmd) => sum + (cmd.aliases?.length || 0), 0)}\`\`\``, 
                inline: false 
            }
        )
        .setFooter({ 
            text: `Use ${prefix}help <command> for details • ${cmds.size} commands available • v${client.version || '1.1.0'}`, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setTimestamp();
    
    if (interaction) {
        await interaction.update({ embeds: [catEmbed] });
    } else {
        await message.reply({ embeds: [catEmbed] });
    }
}