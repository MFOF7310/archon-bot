const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'whois',
    aliases: ['userinfo', 'scan'],
    description: "Pull a friendly compact profile scan for any server member",
    async run(client, message, args) {
        // Grab target user, fallback to message author if no mention
        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;

        // --------------------------
        // Replace this block with YOUR database / backend fetch logic
        const profileData = {
            nodeId: "1284944736620253296",
            lastActive: "56 mins ago",
            clearance: "ARCHITECT-01 ROOT",
            title: "Cyber Specialist • Legend",
            legacyRank: "Ancient Founding Legend",
            level: 26,
            rank: "#1 / 44",
            totalXp: 67285,
            totalMessages: 617,
            credits: 233402,
            loginStreak: 3,
            activityEfficiency: 61,
            xpToNext: 315,
            progressPercent: 93.8,
            serverJoin: "September 28, 2024",
            accountCreate: "September 15, 2024",
            accountDays: 685,
            codmMatches: 52,
            winRate: 92,
            gamePayouts: 443,
            badges: ["Pro Player", "Tycoon Magnate", "Cyber Specialist", "Active Operator", "Elite Investor"],
            roleGroups: {
                rootAdmin: ["@CR: The Architect", "@Eagle-One", "Supreme Architect"],
                premium: ["@Server Booster", "@Premium", "Seigneur Synapse", "@Tier: Neural/Synapse", "Neural Knight"],
                milestones: ["Daily Warrior", "Lord (Lvl15)", "@Level_20", "Quest Champion"],
                staffGame: ["Ticket Staff", "Quiz Master", "Duelist", "Voter", "Investor"]
            }
        };
        // --------------------------

        const scanEmbed = new EmbedBuilder()
            .setTitle(`Neural User Scan — ${target.user.tag}`)
            .setDescription(`Node ID: ${profileData.nodeId} | Last seen active ${profileData.lastActive}`)
            .setColor("#f7b733")
            .addFields(
                {
                    name: "🔐 Member Standing",
                    value: `${profileData.legacyRank}\nFull ${profileData.clearance} server access\nTitle: ${profileData.title}`
                },
                {
                    name: "🛡️ Quick Account Note",
                    value: `• Regular human account (not a bot)\n• ⚠️ API limitation: We can't read your real TFA status here, this field doesn't reflect your actual security setup\n• No public email linked to profile\n• No active Discord Nitro subscription`
                },
                {
                    name: "📈 Community Activity Snapshot",
                    value: `Level ${profileData.level} | Rank ${profileData.rank}\nTotal XP: ${profileData.totalXp} | Messages sent: ${profileData.totalMessages}\nServer Credits: ${profileData.credits} (Legend tier)\n${profileData.loginStreak}-day login streak | Activity score: ${profileData.activityEfficiency}%\n${profileData.progressPercent}% to Level 27 — only ${profileData.xpToNext} XP left!`
                },
                {
                    name: "📅 User Timeline",
                    value: `Joined our server: ${profileData.serverJoin}\nDiscord account created: ${profileData.accountCreate}\n${profileData.accountDays} days as our veteran member`
                },
                {
                    name: "🎮 CODM Game Stats",
                    value: `${profileData.codmMatches} total matches, fantastic ${profileData.winRate}% win rate\nTotal match reward coins: ${profileData.gamePayouts}`
                },
                {
                    name: "🏅 Unlocked Badges",
                    value: profileData.badges.join(", ")
                },
                {
                    name: "📜 All Active Roles (19 total)",
                    value: `**Root Admin:** ${profileData.roleGroups.rootAdmin.join(", ")}\n**Premium Tiers:** ${profileData.roleGroups.premium.join(", ")}\n**Milestone Ranks:** ${profileData.roleGroups.milestones.join(", ")}\n**Staff & Game Roles:** ${profileData.roleGroups.staffGame.join(", ")}`
                }
            )
            .setFooter({ text: "Eagle Community • ARCHON CG-223 | BKO-223 Mine Node v2.0.2" });

        return message.reply({ embeds: [scanEmbed] });
    }
}

