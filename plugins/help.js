const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['h', 'cmds', 'modules'],
    description: 'Displays the full list of Digital Engine modules.',
    category: 'System', 
    async execute(message, args, client) {
        const prefix = process.env.PREFIX || ',';
        
        // --- 1. PRECISION TIME LOGIC (BAMAKO NODE) ---
        const now = new Date();
        const preciseTime = now.toLocaleString('en-GB', { 
            timeZone: 'UTC', 
            weekday: 'short', 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
        }) + ' GMT';

        // --- CASE 1: MODULE DIAGNOSTICS (Specific Command) ---
        if (args[0]) {
            const cmdName = args[0].toLowerCase();
            const command = client.commands.get(cmdName) || client.commands.get(client.aliases.get(cmdName));
            
            if (!command) return message.reply("❌ **ERROR:** Specified module not found in the Digital Engine archives.");

            const detailEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setTitle(`🛠️ MODULE: ${command.name.toUpperCase()}`)
                .addFields(
                    { name: '📝 Description', value: `*${command.description || 'No description available.'}*` },
                    { name: '📂 Classification', value: `\`${command.category || 'General'}\``, inline: true },
                    { name: '⌨️ Execution', value: `\`${prefix}${command.name}\``, inline: true }
                )
                .setFooter({ text: 'ARCHITECT CG-223 | Module Intelligence' });

            if (command.aliases && command.aliases.length > 0) {
                detailEmbed.addFields({ name: '🔗 Shortcuts', value: command.aliases.map(a => `\`${a}\``).join(', '), inline: true });
            }

            return message.reply({ embeds: [detailEmbed] });
        }

        // --- CASE 2: SYSTEM MAINBOARD (General Help Menu) ---
        const helpEmbed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setAuthor({ 
                name: 'ARCHITECT CG-223 | DIGITAL ENGINE CONTROL', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle('🖥️ SYSTEM MAINBOARD INTERFACE')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `**Engine Status:** 🟢 OPERATIONAL (v${client.version})\n` +
                `**System Time:** \`${preciseTime}\
