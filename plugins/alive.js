const { EmbedBuilder, version: discordVersion, SlashCommandBuilder } = require('discord.js');
const os = require('os');
const { ns } = require('../lib/lang');

// ================= BILINGUAL TRANSLATIONS =================

// ================= LANG SYSTEM =================
// Translations now loaded from lib/lang/*.json
// Usage: const t = ns('alive', lang);


module.exports = {
    name: 'alive',
    aliases: ['ping', 'status', 'health', 'uptime', 'version', 'enligne', 'etat', 'sante'],
    description: '📡 Check if the bot is alive and get system statistics',
    category: 'SYSTEM',
    usage: '.alive',
    cooldown: 3000,
    examples: ['.alive', '.ping', '.status', '.enligne'],

// ================= SLASH COMMAND DATA =================
data: new SlashCommandBuilder()
    .setName('alive')
    .setDescription('📡 Check if the bot is alive and get system statistics'),

// 🔥 NEW SIGNATURE: 6 parameters with usedCommand
run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        const guildId = message.guild?.id ?? 'DM';
        const startTime = Date.now();
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        lang = client.detectLanguage ? client.detectLanguage('alive', guildId) : 'en';
        
        const t = ns('alive', lang);
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        // ================= BOT UPTIME =================
        const uptime = client.uptime;
        const days = Math.floor(uptime / 86400000);
        const hours = Math.floor(uptime / 3600000) % 24;
        const minutes = Math.floor(uptime / 60000) % 60;
        const seconds = Math.floor(uptime / 1000) % 60;
        const uptimeString = `${days}j ${hours}h ${minutes}m ${seconds}s`;
        
        // ================= MEMORY USAGE =================
        const memoryUsage = process.memoryUsage();
        const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        const rss = (memoryUsage.rss / 1024 / 1024).toFixed(2);
        
        // ================= SYSTEM INFO =================
        const platform = os.platform();
        const arch = os.arch();
        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model.split('@')[0].trim() || 'Unknown';
        const cpuCores = cpus.length;
        const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        
        // ================= SERVER STATS =================
        const serverCount = (client.db ? (client.db.prepare("SELECT COUNT(DISTINCT guild_id) FROM users WHERE guild_id NOT IN ('DM','telegram')").get()["COUNT(DISTINCT guild_id)"] || client.guilds.cache.size) : client.guilds.cache.size);
        const userCount = dbUserCount;
        const channelCount = client.channels.cache.size;
        const dbUserCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
        const totalCommands = client.commands.size;
        
        // ================= CACHE STATS =================
        const cacheSize = client.userDataCache?.size || 0;
        const pendingWrites = client.pendingUserUpdates?.size || 0;
        
        // ================= LATENCY =================
        const apiLatency = Date.now() - startTime;
        const wsPing = Math.round(client.ws.ping);
        
        // ================= SYSTEM HEALTH =================
        let systemHealth = t.healthy;
        let healthColor = '#2ecc71';
        if (wsPing > 400) {
            systemHealth = t.critical;
            healthColor = '#e74c3c';
        } else if (wsPing > 200) {
            systemHealth = t.degraded;
            healthColor = '#f1c40f';
        }
        
        // ================= STATUS EMOJIS =================
        const statusEmojis = { online: '🟢', idle: '🟡', dnd: '🔴', offline: '⚫' };
        const botStatus = statusEmojis[client.presence?.status] || '🟢';
        const botStatusText = client.presence?.status?.toUpperCase() || t.online;
        
        // ================= BUILD EMBED =================
        const aliveEmbed = new EmbedBuilder()
            .setColor(healthColor)
            .setAuthor({ 
                name: t.author, 
                iconURL: client.user.displayAvatarURL()
            })
            .setTitle(t.title)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { 
                    name: t.botInfo, 
                    value: `\`\`\`yaml\n${t.name}: ${client.user.tag}\n${t.id}: ${client.user.id}\n${t.version}: v${version}\n${t.uptime}: ${uptimeString}\n${t.latency}: ${apiLatency}ms\n${t.apiPing}: ${wsPing}ms\`\`\``,
                    inline: false
                },
                { 
                    name: t.systemResources, 
                    value: `\`\`\`yaml\n${t.platform}: ${platform} (${arch})\n${t.cpu}: ${cpuModel}\n${t.cores}: ${cpuCores}\n${t.memory}: ${heapUsed}/${heapTotal} MB (RSS: ${rss} MB)\n${t.systemRam}: ${freeMem}/${totalMem} GB\`\`\``,
                    inline: true
                },
                { 
                    name: t.statistics, 
                    value: `\`\`\`yaml\n${t.servers}: ${serverCount}\n${t.users}: ${userCount}\n${t.channels}: ${channelCount}\n${t.dbUsers}: ${dbUserCount}\n${t.commands}: ${totalCommands}\nCache: ${cacheSize} | Pending: ${pendingWrites}\`\`\``,
                    inline: true
                },
                { 
                    name: t.status, 
                    value: `\`\`\`yaml\n${botStatus} ${t.botStatus}: ${botStatusText}\n${t.discordVersion}: v${discordVersion}\n${t.system}: ${systemHealth}\n${t.node}: ${process.version}\`\`\``,
                    inline: false
                }
            )
            .setFooter({ 
                text: `${guildName} • ARCHON CG-223 • v${version}`,
                iconURL: guildIcon
            })
            .setTimestamp();

        // Send initial embed
        const replyMsg = await message.reply({ embeds: [aliveEmbed] }).catch(() => {});
        if (!replyMsg) return;
        
        // Calculate message latency
        const messageLatency = replyMsg.createdTimestamp - message.createdTimestamp;
        
        // Update with latency details
        const updatedEmbed = EmbedBuilder.from(aliveEmbed).addFields({
            name: t.latencyDetails,
            value: `\`\`\`yaml\n${t.apiResponse}: ${apiLatency}ms\n${t.webSocket}: ${wsPing}ms\n${t.message}: ${messageLatency}ms\`\`\``,
            inline: false
        });
        
        await replyMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
        
                console.log(`[ALIVE] ${message.author.tag} | Servers: ${serverCount} | Ping: ${wsPing}ms | Cache: ${cacheSize} | Lang: ${lang}`);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        // Simulate message object
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            createdTimestamp: interaction.createdTimestamp,
            reply: async (options) => {
                if (interaction.deferred) return interaction.editReply(options);
                return interaction.reply(options);
            },
            react: () => Promise.resolve()
        };
        
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        
        await module.exports.run(client, fakeMessage, [], client.db, serverSettings, 'alive');
    }
};