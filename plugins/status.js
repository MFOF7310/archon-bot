const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'status',
    description: 'Check the Digital Engine system health and uptime.',
    category: 'System',
    async execute(message, args, client, model, lydiaChannels, database) {
        // --- 1. UPTIME CALCULATION ---
        const uptimeVal = process.uptime();
        const d = Math.floor(uptimeVal / 86400);
        const h = Math.floor((uptimeVal % 86400) / 3600);
        const m = Math.floor((uptimeVal % 3600) / 60);
        const s = Math.floor(uptimeVal % 60);

        // --- 2. MEMORY USAGE ---
        const usedMemory = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

        // --- 3. DATABASE SCAN ---
        // Counts how many unique User IDs are in your database
        const totalUsers = Object.keys(database).length;

        // --- 4. BUILD THE EMBED ---
        const statusEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setTitle('🖥️ ENGINE OPERATIONAL STATUS')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { 
                    name: '🛰️ Connection', 
                    value: '`Starlink (Bamako Node)`', 
                    inline: true 
                },
                { 
                    name: '⚙️ Engine', 
                    value: '`v2.6 AES Edition`', 
                    inline: true 
                },
                { 
                    name: '📡 Ping', 
                    value: `\`${client.ws.ping}ms\``, 
                    inline: true 
                },
                { 
                    name: '⏱️ Uptime', 
                    value: `\`${d}d ${h}h ${m}m ${s}s\``, 
                    inline: false 
                },
                { 
                    name: '🧠 RAM Usage', 
                    value: `\`${usedMemory} MB\``, 
                    inline: true 
                },
                { 
                    name: '👥 Registered Agents', 
                    value: `\`${totalUsers} Users\``, 
                    inline: true 
                }
            )
            .setFooter({ text: 'CLOUD GAMING-223 | DIGITAL ENGINE' })
            .setTimestamp();

        return message.reply({ embeds: [statusEmbed] });
    },
};
