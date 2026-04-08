// plugins/alive.js
const { EmbedBuilder, version: discordVersion } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'alive',
    aliases: ['ping', 'status', 'health', 'uptime', 'version'],
    description: 'Check if the bot is alive and get system statistics',
    usage: '.alive',
    cooldown: 3000,

    run: async (client, message, args, database, serverSettings) => {
        const startTime = Date.now();
        
        // ✅ Use server language for future expansion
        const lang = serverSettings?.language || 'en';
        const version = client.version || '1.5.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        // Calculate bot uptime
        const uptime = client.uptime;
        const days = Math.floor(uptime / 86400000);
        const hours = Math.floor(uptime / 3600000) % 24;
        const minutes = Math.floor(uptime / 60000) % 60;
        const seconds = Math.floor(uptime / 1000) % 60;
        
        const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        
        // Get memory usage
        const memoryUsage = process.memoryUsage();
        const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        const rss = (memoryUsage.rss / 1024 / 1024).toFixed(2);
        
        // Get system info
        const platform = os.platform();
        const arch = os.arch();
        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model || 'Unknown';
        const cpuCores = cpus.length;
        const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        
        // Calculate server stats
        const serverCount = client.guilds.cache.size;
        const userCount = client.users.cache.size;
        const channelCount = client.channels.cache.size;
        
        // Get actual count from SQLite database
        const dbUserCount = database.prepare("SELECT COUNT(*) as count FROM users").get().count;
        
        // Calculate API latency
        const apiLatency = Date.now() - startTime;
        
        // Create the main embed
        const aliveEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ 
                name: '🟢 ARCHITECT CG-223 // SYSTEM ONLINE', 
                iconURL: client.user.displayAvatarURL()
            })
            .setTitle('🚀 SYSTEM STATUS REPORT')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .addFields(
                { 
                    name: '📡 BOT INFORMATION', 
                    value: `\`\`\`yaml\nName: ${client.user.tag}\nID: ${client.user.id}\nVersion: v${version}\nUptime: ${uptimeString}\nLatency: ${apiLatency}ms\nAPI Ping: ${Math.round(client.ws.ping)}ms\`\`\``,
                    inline: false
                },
                { 
                    name: '💾 SYSTEM RESOURCES', 
                    value: `\`\`\`prolog\nPlatform: ${platform} (${arch})\nCPU: ${cpuModel}\nCores: ${cpuCores}\nMemory: ${heapUsed}/${heapTotal} MB\nSystem RAM: ${freeMem}/${totalMem} GB\`\`\``,
                    inline: true
                },
                { 
                    name: '📊 STATISTICS', 
                    value: `\`\`\`fix\nServers: ${serverCount}\nUsers: ${userCount}\nChannels: ${channelCount}\nDatabase Users: ${dbUserCount}\nCommands: ${client.commands.size}\`\`\``,
                    inline: true
                }
            )
            .setFooter({ 
                text: `${guildName} • Node: ${process.version} • Discord.js: v${discordVersion}`,
                iconURL: guildIcon
            })
            .setTimestamp();

        // Add status indicators
        const statusEmojis = {
            online: '🟢',
            idle: '🟡',
            dnd: '🔴',
            offline: '⚫'
        };
        
        const botStatus = statusEmojis[client.presence?.status] || '🟢';
        
        aliveEmbed.addFields({
            name: '🎮 STATUS',
            value: `${botStatus} **Bot Status:** ${client.presence?.status?.toUpperCase() || 'ONLINE'}\n🤖 **Discord.js:** v${discordVersion}\n🟢 **System:** Operational`,
            inline: false
        });

        // Send the embed
        const replyMsg = await message.reply({ embeds: [aliveEmbed] });
        
        // Optionally, update with message latency
        const messageLatency = replyMsg.createdTimestamp - message.createdTimestamp;
        
        // Edit to add message latency
        const updatedEmbed = EmbedBuilder.from(aliveEmbed);
        updatedEmbed.addFields({
            name: '⏱️ LATENCY DETAILS',
            value: `\`\`\`\nAPI Response: ${apiLatency}ms\nWebSocket: ${Math.round(client.ws.ping)}ms\nMessage: ${messageLatency}ms\`\`\``,
            inline: false
        });
        
        await replyMsg.edit({ embeds: [updatedEmbed] });
        
        console.log(`[ALIVE] Checked by ${message.author.tag} | Servers: ${serverCount} | Users: ${userCount} | DB Users: ${dbUserCount} | Version: v${version}`);
    }
};