const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'whois',
    aliases: ['scan', 'user', 'dossier'],
    description: 'Execute a deep-scan on a specific agent and decrypt their metadata.',
    category: 'UTILITY',
    run: async (client, message, args, database) => {
        const member = message.mentions.members.first() || message.member;
        const { user } = member;
        const userData = database[user.id] || { xp: 0, level: 1 };

        // 1. CLEARANCE LEVEL (Permissions)
        let clearance = "🔹 AGENT";
        if (member.permissions.has('Administrator')) clearance = "🔴 ADMINISTRATOR";
        else if (member.permissions.has('ManageMessages')) clearance = "🟡 MODERATOR";
        if (user.id === process.env.OWNER_ID) clearance = "👑 ARCHITECT-01";

        // 2. ROLE FILTERING (Ignore @everyone)
        const roles = member.roles.cache
            .filter(r => r.id !== message.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => r.name)
            .join(', ') || 'No active authorizations.';

        // 3. THE ARCHITECT DOSSIER EMBED
        const whoisEmbed = new EmbedBuilder()
            .setColor(member.displayHexColor || '#00fbff')
            .setAuthor({ 
                name: `NEURAL SCAN: ${user.username.toUpperCase()}`, 
                iconURL: user.displayAvatarURL({ dynamic: true }) 
            })
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(`**Node Identification:** \`${user.id}\`\n**Current Status:** \`🟢 SYNCHRONIZED\``)
            .addFields(
                { 
                    name: '📊 AGENT METADATA', 
                    value: `\`\`\`ansi\n\u001b[1;36m▣\u001b[0m Sync Level: ${userData.level}\n\u001b[1;34m▣\u001b[0m Clearance:  ${clearance.split(' ')[1]}\`\`\``, 
                    inline: false 
                },
                { 
                    name: '📅 TEMPORAL LOGS', 
                    value: `**Arrival:** <t:${Math.floor(member.joinedTimestamp / 1000)}:f>\n**Initialized:** <t:${Math.floor(user.createdTimestamp / 1000)}:f>`, 
                    inline: false 
                },
                { 
                    name: '📜 AUTHORIZATIONS (ROLES)', 
                    value: `\`\`\`fix\n${roles.length > 100 ? roles.substring(0, 100) + '...' : roles}\`\`\``, 
                    inline: false 
                }
            )
            .setFooter({ text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223' })
            .setTimestamp();

        // 4. ADD OWNER-ONLY TELEMETRY
        if (message.author.id === process.env.OWNER_ID) {
            whoisEmbed.addFields({ 
                name: '🛠️ OWNER TELEMETRY', 
                value: `**Flags:** \`${user.flags.toArray().join(', ') || 'None'}\`\n**Bot:** \`${user.bot ? 'YES' : 'NO'}\`` 
            });
        }

        message.reply({ 
            content: `> **Initializing neural handshake... scanning ${user.username}.**`,
            embeds: [whoisEmbed] 
        });
    }
};
