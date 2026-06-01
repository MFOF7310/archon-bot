const { exec } = require('child_process');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'reboot',
    aliases: ['restart', 'reload', 'update', 'pull'],
    category: 'OWNER',
    description: '🔄 Restart the bot via PM2 or pull latest updates',
    cooldown: 5000,
    usage: '.reboot [update]',
    examples: ['.reboot', '.reboot update', '.restart'],

    data: new SlashCommandBuilder()
        .setName('reboot')
        .setDescription('🔄 Restart the neural engine (Owner only)')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Restart mode')
                .setRequired(false)
                .addChoices(
                    { name: '🔄 Normal Restart', value: 'restart' },
                    { name: '📦 Update & Restart (git pull)', value: 'update' }
                )
        ),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        // Only bot owner
        if (message.author.id !== process.env.OWNER_ID) {
            return message.reply({
                content: '```yaml\n🔒 ACCESS DENIED\nThis command is restricted to the Architect.\nNode: BAMAKO_223 🇲🇱\n```'
            });
        }

        const mode = args[0]?.toLowerCase();
        const isUpdate = mode === 'update' || usedCommand === 'update' || usedCommand === 'pull';
        const lang = message.content?.match(/reboot|restart|update|pull|reload/) ? 'en' : 'en';

        const prepEmbed = new EmbedBuilder()
            .setColor('#f39c12')
            .setAuthor({ name: '🦅 NEURAL ENGINE • MAINTENANCE MODE', iconURL: client.user.displayAvatarURL() })
            .setTitle(isUpdate ? '📦 UPDATE & RESTART INITIATED' : '🔄 NEURAL RESET INITIATED')
            .setDescription(
                '```ansi\n' +
                '\u001b[1;33m═══════════════════════════════\u001b[0m\n' +
                `\u001b[1;36mAction:\u001b[0m ${isUpdate ? 'Git Pull + PM2 Restart' : 'PM2 Process Restart'}\n` +
                `\u001b[1;36mProcess:\u001b[0m Architect-CG223\n` +
                `\u001b[1;36mNode:\u001b[0m BAMAKO_223 🇲🇱\n` +
                `\u001b[1;36mPID:\u001b[0m ${process.pid}\n` +
                '\u001b[1;33m═══════════════════════════════\u001b[0m\n' +
                '```'
            )
            .addFields({
                name: '⏳ Status',
                value: isUpdate 
                    ? '```yaml\n📥 Pulling latest commits...\n💾 Flushing database...\n🔄 Restarting engine...\n```'
                    : '```yaml\n💾 Flushing database...\n🔄 Restarting engine...\n```',
                inline: false
            })
            .setFooter({ text: 'ARCHITECT CG-223 • Neural Engine • Maintenance Protocol' })
            .setTimestamp();

        const reply = await message.reply({ embeds: [prepEmbed] }).catch(() => {});

        // Flush pending database writes
        if (client.flushUserUpdates) {
            try {
                await client.flushUserUpdates(0);
                console.log('[REBOOT] Database flushed successfully');
            } catch (err) {
                console.error('[REBOOT] Database flush error:', err.message);
            }
        }

        // Final update before restart
        if (reply) {
            const finalEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setAuthor({ name: '🦅 NEURAL ENGINE • SHUTTING DOWN', iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    '```ansi\n' +
                    '\u001b[1;31m═══════════════════════════════\u001b[0m\n' +
                    '\u001b[1;33mAll systems saved.\u001b[0m\n' +
                    '\u001b[1;33mResyncing neural links...\u001b[0m\n' +
                    '\u001b[1;31m═══════════════════════════════\u001b[0m\n' +
                    '```'
                )
                .setFooter({ text: 'ARCHITECT CG-223 • Engine restarting in 2 seconds...' })
                .setTimestamp();

            await reply.edit({ embeds: [finalEmbed] }).catch(() => {});
        }

        // Execute restart
        setTimeout(() => {
            const command = isUpdate 
                ? 'git pull && pm2 restart Architect-CG223'
                : 'pm2 restart Architect-CG223';

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('[REBOOT] PM2 command failed:', error.message);
                    console.log('[REBOOT] Falling back to process.exit...');
                    process.exit(1);
                }
                console.log('[REBOOT] PM2:', stdout || 'Restart signal sent');
                if (stderr) console.error('[REBOOT] PM2 stderr:', stderr);
            });
        }, 2000);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        // Only bot owner
        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({
                content: '```yaml\n🔒 ACCESS DENIED\nThis command is restricted to the Architect.\nNode: BAMAKO_223 🇲🇱\n```',
                ephemeral: true
            });
        }

        const mode = interaction.options.getString('mode') || 'restart';
        const isUpdate = mode === 'update';
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';

        await interaction.deferReply();

        const prepEmbed = new EmbedBuilder()
            .setColor('#f39c12')
            .setAuthor({ name: '🦅 NEURAL ENGINE • MAINTENANCE MODE', iconURL: client.user.displayAvatarURL() })
            .setTitle(isUpdate ? '📦 UPDATE & RESTART INITIATED' : '🔄 NEURAL RESET INITIATED')
            .setDescription(
                '```ansi\n' +
                '\u001b[1;33m═══════════════════════════════\u001b[0m\n' +
                `\u001b[1;36mAction:\u001b[0m ${isUpdate ? 'Git Pull + PM2 Restart' : 'PM2 Process Restart'}\n` +
                `\u001b[1;36mProcess:\u001b[0m Architect-CG223\n` +
                `\u001b[1;36mNode:\u001b[0m BAMAKO_223 🇲🇱\n` +
                '\u001b[1;33m═══════════════════════════════\u001b[0m\n' +
                '```'
            )
            .setFooter({ text: 'ARCHITECT CG-223 • Neural Engine • Maintenance Protocol' })
            .setTimestamp();

        await interaction.editReply({ embeds: [prepEmbed] });

        // Flush database
        if (client.flushUserUpdates) {
            try {
                await client.flushUserUpdates(0);
            } catch (err) {
                console.error('[REBOOT] Flush error:', err.message);
            }
        }

        // Final message
        const finalEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setAuthor({ name: '🦅 NEURAL ENGINE • SHUTTING DOWN', iconURL: client.user.displayAvatarURL() })
            .setDescription(
                '```ansi\n' +
                '\u001b[1;31m═══════════════════════════════\u001b[0m\n' +
                '\u001b[1;33mAll systems saved.\u001b[0m\n' +
                '\u001b[1;33mResyncing neural links...\u001b[0m\n' +
                '\u001b[1;31m═══════════════════════════════\u001b[0m\n' +
                '```'
            )
            .setFooter({ text: 'ARCHITECT CG-223 • Engine restarting...' })
            .setTimestamp();

        await interaction.editReply({ embeds: [finalEmbed] }).catch(() => {});

        // Execute restart
        setTimeout(() => {
            const command = isUpdate 
                ? 'git pull && pm2 restart Architect-CG223'
                : 'pm2 restart Architect-CG223';

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('[REBOOT] PM2 failed:', error.message);
                    process.exit(1);
                }
                console.log('[REBOOT] PM2:', stdout || 'Restart signal sent');
            });
        }, 2000);
    }
};