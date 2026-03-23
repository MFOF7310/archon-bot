const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'server',
    aliases: ['si', 'sector', 'guild'],
    description: 'Execute a deep-scan of the current Sector intelligence and age.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        const { guild } = message;
        const icon = guild.iconURL({ dynamic: true, size: 512 }) || client.user.displayAvatarURL();

        // --- TEMPORAL ANNIVERSARY LOGIC ---
        const now = new Date();
        const created = new Date(guild.createdTimestamp);
        const isAnniversary = now.getMonth() === created.getMonth() && now.getDate() === created.getDate();
        const sectorAge = now.getFullYear() - created.getFullYear();

        // --- TELEMETRY CALCULATIONS ---
        const boostCount = guild.premiumSubscriptionCount || 0;
        const boostTier = guild.premiumTier;
        const voiceAgents = guild.members.cache.filter(m => m.voice.channel).size;
        
        const tierRequirements = { 0: 2, 1: 7, 2: 14, 3: "MAX" };
        const nextReq = tierRequirements[boostTier];
        const boostBar = (c, t) => t === "MAX" ? "◈ \u001b[1;35mMAX_LEVEL\u001b[0m ◈" : "▰".repeat(Math.min(Math.round((10 * c) / t), 10)).padEnd(10, '▱') + ` ${c}/${t}`;

        // --- DYNAMIC THEMING ---
        // Switch to Gold if it's the Anniversary!
        const systemColor = isAnniversary ? '#f1c40f' : '#00fbff';
        const systemTitle = isAnniversary 
            ? `🎊 SECTOR ANNIVERSARY: ${sectorAge} YEARS 🎊` 
            : `─ ARCHITECT GUILD TELEMETRY ─`;

        const serverEmbed = new EmbedBuilder()
            .setColor(systemColor)
            .setAuthor({ name: `SECTOR DATA_SCAN: ${guild.name.toUpperCase()}`, iconURL: icon })
            .setTitle(systemTitle)
            .setThumbnail(icon)
            .setDescription(
                `**Commander:** <@${guild.ownerId}>\n` +
                `**Established:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)\n` +
                `**Sector ID:** \`${guild.id}\``
            )
            .addFields(
                { 
                    name: '📊 POPULATION METRICS', 
                    value: `\`\`\`ansi\n\u001b[1;32m▣\u001b[0m Total: ${guild.memberCount}\n\u001b[1;34m▣\u001b[0m Voice: ${voiceAgents} Active\n\u001b[1;36m▣\u001b[0m Roles: ${guild.roles.cache.size}\`\`\``, 
                    inline: true 
                },
                { 
                    name: '🛰️ NETWORK GRID', 
                    value: `\`\`\`ansi\n\u001b[1;35m▣\u001b[0m Tier: LEVEL_${boostTier}\n\u001b[1;35m▣\u001b[0m Node: Bamako-223\n\u001b[1;35m▣\u001b[0m Uptime: STABLE\`\`\``, 
                    inline: true 
                }
            );

        // Anniversary Special Field
        if (isAnniversary) {
            serverEmbed.addFields({ 
                name: '🎂 ANNIVERSARY PROTOCOL', 
                value: `\`\`\`fix\nCELEBRATION_MODE: ACTIVE\nObjective: Maintain Eagle Community sovereignty for another year.\`\`\`` 
            });
        }

        serverEmbed.addFields(
            { 
                name: '🚀 NITRO BOOST SYNCHRONIZATION', 
                value: `\`\`\`ansi\n\u001b[1;35m${boostBar(boostCount, nextReq)}\u001b[0m\`\`\``, 
                inline: false 
            },
            { 
                name: '🛡️ SECURITY PROTOCOLS', 
                value: `\`\`\`prolog\nVerification: ${guild.verificationLevel}\nIntegrity: SYNCHRONIZED\`\`\``, 
                inline: false 
            }
        )
        .setFooter({ text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223' })
        .setTimestamp();

        message.reply({ 
            content: isAnniversary ? `🎊 **ALERT: ANNIVERSARY SIGNAL DETECTED!** 🎊` : `> **Synchronizing sector telemetry...**`,
            embeds: [serverEmbed] 
        });
    }
};
