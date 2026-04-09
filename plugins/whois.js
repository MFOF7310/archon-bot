const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        scanning: (user) => `> **🔍 Initializing neural handshake... scanning ${user}.**`,
        neuralScan: (user) => `NEURAL SCAN: ${user.toUpperCase()}`,
        nodeIdentification: 'Node Identification',
        clearance: 'Clearance',
        syncTelemetry: '📊 SYNC TELEMETRY',
        level: 'Level',
        xp: 'XP',
        messages: 'Messages',
        credits: 'Credits',
        streak: 'Streak',
        temporalLogs: '📅 TEMPORAL LOGS',
        arrival: 'Arrival',
        account: 'Account',
        combatMatrix: '🎮 COMBAT MATRIX',
        sector: 'SECTOR',
        mode: 'MODE',
        rank: 'RANK',
        noData: 'STATUS: NO_DATA_DETECTED',
        setGameHint: 'Use .setgame to register your specialization.',
        authorizations: '📜 AUTHORIZATIONS (ROLES)',
        noRoles: 'No active authorizations.',
        ownerTelemetry: '🛠️ OWNER TELEMETRY',
        flags: 'Flags',
        bot: 'Bot',
        none: 'None',
        footer: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223',
        clearanceLevels: {
            owner: '👑 ARCHITECT-01',
            admin: '🔴 ADMINISTRATOR',
            moderator: '🟡 MODERATOR',
            agent: '🔹 AGENT'
        },
        gamesPlayed: 'Games Played',
        winRate: 'Win Rate',
        totalWinnings: 'Total Winnings'
    },
    fr: {
        scanning: (user) => `> **🔍 Initialisation de la poignée neurale... analyse de ${user}.**`,
        neuralScan: (user) => `ANALYSE NEURALE: ${user.toUpperCase()}`,
        nodeIdentification: 'Identification Nœud',
        clearance: 'Autorisation',
        syncTelemetry: '📊 TÉLÉMÉTRIE SYNC',
        level: 'Niveau',
        xp: 'XP',
        messages: 'Messages',
        credits: 'Crédits',
        streak: 'Série',
        temporalLogs: '📅 JOURNAUX TEMPORELS',
        arrival: 'Arrivée',
        account: 'Compte',
        combatMatrix: '🎮 MATRICE DE COMBAT',
        sector: 'SECTEUR',
        mode: 'MODE',
        rank: 'RANG',
        noData: 'STATUT: AUCUNE_DONNÉE',
        setGameHint: 'Utilisez .setgame pour enregistrer votre spécialisation.',
        authorizations: '📜 AUTORISATIONS (RÔLES)',
        noRoles: 'Aucune autorisation active.',
        ownerTelemetry: '🛠️ TÉLÉMÉTRIE PROPRIÉTAIRE',
        flags: 'Drapeaux',
        bot: 'Bot',
        none: 'Aucun',
        footer: 'EAGLE COMMUNITY • SOUVERAINETÉ NUMÉRIQUE • BKO-223',
        clearanceLevels: {
            owner: '👑 ARCHITECTE-01',
            admin: '🔴 ADMINISTRATEUR',
            moderator: '🟡 MODÉRATEUR',
            agent: '🔹 AGENT'
        },
        gamesPlayed: 'Parties Jouées',
        winRate: 'Taux Victoire',
        totalWinnings: 'Gains Totaux'
    }
};

// ================= AGENT RANKS =================
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

function getAgentRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1];
}

module.exports = {
    name: 'whois',
    aliases: ['scan', 'user', 'dossier', 'info', 'qui', 'userinfo', 'ui'],
    description: '🔍 Execute a deep-scan on a specific agent and decrypt their metadata.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.whois [@user]',
    examples: ['.whois', '.whois @user', '.scan', '.dossier'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        const member = message.mentions.members.first() || message.member;
        const { user } = member;
        
        // ================= GET USER DATA =================
        let userData = client.getUserData 
            ? client.getUserData(user.id) 
            : db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
        
        if (!userData) {
            userData = { xp: 0, level: 1, credits: 0, total_messages: 0, streak_days: 0, games_played: 0, games_won: 0, total_winnings: 0, gaming: null };
        }
        
        const level = userData.level || calculateLevel(userData.xp || 0);
        const agentRank = getAgentRank(level);
        const gameData = userData.gaming ? JSON.parse(userData.gaming) : null;
        
        // ================= CLEARANCE LEVEL =================
        let clearance = t.clearanceLevels.agent;
        if (user.id === process.env.OWNER_ID) clearance = t.clearanceLevels.owner;
        else if (member.permissions.has('Administrator')) clearance = t.clearanceLevels.admin;
        else if (member.permissions.has('ManageMessages')) clearance = t.clearanceLevels.moderator;
        
        // ================= ROLE FILTERING =================
        const roles = member.roles.cache
            .filter(r => r.id !== message.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => r.name)
            .join(', ') || t.noRoles;
        
        // ================= BUILD EMBED =================
        const whoisEmbed = new EmbedBuilder()
            .setColor(member.displayHexColor || agentRank.color)
            .setAuthor({ 
                name: t.neuralScan(user.username), 
                iconURL: user.displayAvatarURL({ dynamic: true }) 
            })
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.nodeIdentification}: ${user.id}\n` +
                `${t.clearance}: ${clearance}\n` +
                `${agentRank.emoji} ${agentRank.title[lang]}\`\`\``
            )
            .addFields(
                { 
                    name: t.syncTelemetry, 
                    value: `\`\`\`yaml\n` +
                           `${t.level}: ${level}\n` +
                           `${t.xp}: ${(userData.xp || 0).toLocaleString()}\n` +
                           `${t.messages}: ${(userData.total_messages || 0).toLocaleString()}\n` +
                           `${t.credits}: ${(userData.credits || 0).toLocaleString()} 🪙\n` +
                           `${t.streak}: ${userData.streak_days || 0} ${lang === 'fr' ? 'jours' : 'days'}\`\`\``, 
                    inline: true 
                },
                { 
                    name: t.temporalLogs, 
                    value: `\`\`\`yaml\n` +
                           `${t.arrival}: <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n` +
                           `${t.account}: <t:${Math.floor(user.createdTimestamp / 1000)}:R>\`\`\``, 
                    inline: true 
                }
            );
        
        // ================= COMBAT MATRIX =================
        if (gameData && gameData.game) {
            whoisEmbed.addFields({ 
                name: t.combatMatrix, 
                value: `\`\`\`yaml\n` +
                       `${t.sector}: ${gameData.game}\n` +
                       `${t.mode}: ${gameData.mode || 'N/A'}\n` +
                       `${t.rank}: ${gameData.rank || 'UNRANKED'}\n` +
                       `${t.gamesPlayed}: ${userData.games_played || 0}\n` +
                       `${t.winRate}: ${userData.games_played > 0 ? Math.round((userData.games_won / userData.games_played) * 100) : 0}%\`\`\``, 
                inline: false 
            });
        } else {
            whoisEmbed.addFields({ 
                name: t.combatMatrix, 
                value: `\`\`\`yaml\n${t.noData}\n${t.setGameHint}\`\`\``, 
                inline: false 
            });
        }
        
        // ================= ROLES =================
        whoisEmbed.addFields({ 
            name: t.authorizations, 
            value: `\`\`\`\n${roles.length > 100 ? roles.substring(0, 100) + '...' : roles}\`\`\``, 
            inline: false 
        });
        
        // ================= OWNER TELEMETRY =================
        if (message.author.id === process.env.OWNER_ID) {
            const flags = user.flags?.toArray().join(', ') || t.none;
            whoisEmbed.addFields({ 
                name: t.ownerTelemetry, 
                value: `\`\`\`yaml\n${t.flags}: ${flags}\n${t.bot}: ${user.bot ? '✅' : '❌'}\`\`\``,
                inline: false
            });
        }
        
        whoisEmbed
            .setFooter({ 
                text: `${guildName} • ${t.footer} • v${version}`, 
                iconURL: guildIcon 
            })
            .setTimestamp();

        await message.reply({ 
            content: t.scanning(user.username),
            embeds: [whoisEmbed] 
        }).catch(() => {});
        
        console.log(`[WHOIS] ${message.author.tag} scanned ${user.tag} | Lang: ${lang}`);
    }
};