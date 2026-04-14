const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'telegram',
    aliases: ['tg', 'bridge'],
    description: '🌉 Control the Telegram Bridge v1.7.0',
    category: 'SYSTEM',
    usage: '<status|activate|deactivate|send>',
    cooldown: 2000,

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const action = args[0]?.toLowerCase();
        const isOwner = message.author.id === process.env.OWNER_ID;
        
        const embed = new EmbedBuilder()
            .setColor('#00fbff')
            .setFooter({ text: `ARCHITECT CG-223 • BAMAKO_223 🇲🇱` })
            .setTimestamp();
        
        // Status Command
        if (!action || action === 'status') {
            const status = client.telegramBridge.status();
            const info = client.telegramBridge.info();
            embed.setTitle('🌉 TELEGRAM BRIDGE STATUS')
                .setDescription(`\`\`\`yaml\nConfigured: ${status.configured ? '✅ Yes' : '❌ No'}\nEnabled: ${status.enabled ? '✅ Yes' : '❌ No'}\nVersion: ${status.version}\nChat ID: ${info.chatId}\`\`\``);
            return message.reply({ embeds: [embed] });
        }
        
        // Activate Command (Owner Only)
        if (action === 'activate') {
            if (!isOwner) {
                embed.setColor('#ED4245').setTitle('⛔ ACCESS DENIED').setDescription(lang === 'fr' ? 'Seul l\'Architecte peut activer le pont.' : 'Only the Architect can activate the bridge.');
                return message.reply({ embeds: [embed] });
            }
            const result = client.telegramBridge.activate();
            embed.setColor(result.success ? '#2ecc71' : '#ED4245')
                .setTitle(result.success ? '✅ BRIDGE ACTIVATED' : '❌ ACTIVATION FAILED')
                .setDescription(result.success ? (lang === 'fr' ? 'Le pont Telegram est maintenant ACTIF.' : 'Telegram Bridge is now ACTIVE.') : result.error);
            return message.reply({ embeds: [embed] });
        }
        
        // Deactivate Command (Owner Only)
        if (action === 'deactivate') {
            if (!isOwner) {
                embed.setColor('#ED4245').setTitle('⛔ ACCESS DENIED').setDescription(lang === 'fr' ? 'Seul l\'Architecte peut désactiver le pont.' : 'Only the Architect can deactivate the bridge.');
                return message.reply({ embeds: [embed] });
            }
            const result = client.telegramBridge.deactivate();
            embed.setColor('#f1c40f').setTitle('🔴 BRIDGE DEACTIVATED').setDescription(lang === 'fr' ? 'Le pont Telegram est maintenant INACTIF.' : 'Telegram Bridge is now INACTIVE.');
            return message.reply({ embeds: [embed] });
        }
        
        // Send Test Message
        if (action === 'send' || action === 'test') {
            const content = args.slice(1).join(' ');
            if (!content) {
                embed.setColor('#ED4245').setTitle('❌ ' + (lang === 'fr' ? 'Message manquant' : 'Missing message'))
                    .setDescription(lang === 'fr' ? 'Usage: `.telegram send <message>`' : 'Usage: `.telegram send <message>`');
                return message.reply({ embeds: [embed] });
            }

            // Indiquer que le bot travaille (réseau)
            await message.channel.sendTyping();

            // On envoie en HTML pour le formatage, le bridge gère l'échappement automatiquement
            const result = await client.telegramBridge.send(`<b>[Discord]</b> ${message.author.username}: ${content}`, { parse_mode: 'HTML' });
            
            embed.setColor(result.success ? '#2ecc71' : '#ED4245')
                .setTitle(result.success ? '✅ MESSAGE SENT' : '❌ SEND FAILED')
                .setDescription(result.success ? (lang === 'fr' ? 'Message envoyé à Telegram.' : 'Message delivered to Telegram.') : result.error);
            return message.reply({ embeds: [embed] });
        }
        
        // Unknown action
        embed.setColor('#ED4245').setTitle('❓ ' + (lang === 'fr' ? 'Action inconnue' : 'Unknown action'))
            .setDescription(lang === 'fr' ? 'Actions: `status`, `activate`, `deactivate`, `send`' : 'Actions: `status`, `activate`, `deactivate`, `send`');
        return message.reply({ embeds: [embed] });
    }
};