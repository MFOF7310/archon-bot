const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } = require('discord.js');

module.exports = {
    name: 'refreshxp',
    aliases: ['wipe', 'resetxp', 'nuclear'],
    description: '⚠️ CRITICAL: Wipe all neural synchronization data (XP/Levels) from the database.',
    category: 'OWNER',
    run: async (client, message, args, database) => {
        
        // 1. DYNAMIC SECURITY CHECK (Detects the current deployer's ID)
        const ARCHITECT_ID = process.env.OWNER_ID;
        
        if (message.author.id !== ARCHITECT_ID) {
            return message.reply({ 
                content: "⛔ **SECURITY BREACH:** Master Node access restricted to the system Owner. This incident has been logged.", 
                ephemeral: true 
            });
        }

        // 2. CONFIRMATION UI
        const confirmEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setAuthor({ name: 'SYSTEM OVERRIDE: NEURAL WIPE', iconURL: client.user.displayAvatarURL() })
            .setTitle('◈ CONFIRM GLOBAL DATA PURGE ◈')
            .setDescription(
                "**WARNING:** You are about to initiate a total reset of all Agent XP and Levels.\n\n" +
                "• All Agent XP will be set to **0**.\n" +
                "• All Synchronization Levels will return to **1**.\n" +
                "• A backup will be sent to your DMs automatically."
            )
            .setFooter({ text: 'Status: Awaiting Owner Authorization' });

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_wipe').setLabel('CONFIRM PURGE').setStyle(ButtonStyle.Danger).setEmoji('☢️'),
            new ButtonBuilder().setCustomId('cancel_wipe').setLabel('ABORT MISSION').setStyle(ButtonStyle.Secondary)
        );

        const response = await message.reply({
            embeds: [confirmEmbed],
            components: [buttons]
        });

        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return i.reply({ content: '⛔ Security lock active.', ephemeral: true });

            if (i.customId === 'cancel_wipe') {
                return i.update({ content: '✅ **Purge aborted.** Database integrity maintained.', embeds: [], components: [] });
            }

            if (i.customId === 'confirm_wipe') {
                // 3. AUTOMATIC BACKUP (Safety First)
                try {
                    const backupData = JSON.stringify(database, null, 2);
                    const buffer = Buffer.from(backupData, 'utf-8');
                    const attachment = new AttachmentBuilder(buffer, { name: 'database_backup_pre_wipe.json' });
                    
                    await message.author.send({ 
                        content: "📡 **ARCHITECT BACKUP:** Here is the database state prior to the wipe.", 
                        files: [attachment] 
                    });
                } catch (err) {
                    console.log("Could not DM backup to owner. Proceeding with wipe...");
                }

                // 4. THE WIPE EXECUTION
                let affectedAgents = 0;
                for (const userId in database) {
                    if (isNaN(userId)) continue; 

                    database[userId].xp = 0;
                    database[userId].level = 1;
                    affectedAgents++;
                }

                if (typeof client.saveDatabase === 'function') {
                    await client.saveDatabase();
                }

                const successEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🚀 DATABASE PURGE SUCCESSFUL')
                    .setDescription(`\`\`\`fix\nSUCCESS: ${affectedAgents} Agent dossiers synchronized to zero.\nSTATUS: Backup sent to Owner DMs.\`\`\``)
                    .setTimestamp();

                await i.update({ content: null, embeds: [successEmbed], components: [] });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                response.edit({ content: '⚠️ **Auth handshake timed out.** Command revoked.', embeds: [], components: [] }).catch(() => null);
            }
        });
    }
};
