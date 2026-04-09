const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

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

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '🎮 COMBAT REGISTRATION',
        success: '✅ NEURAL SPECIALIZATION LOCKED',
        error: '⚠️ INPUT ERROR: MODE_UNDEFINED',
        incomplete: '❌ INCOMPLETE COMBAT DATA',
        desc: 'Neural interface requires complete synchronization.',
        instruction: 'To register your specialization, define **Game**, **Mode**, and **Rank**.',
        supportedGames: '🎮 SUPPORTED GAMES',
        recognizedModes: '⚔️ RECOGNIZED MODES',
        exampleUsage: '📝 EXAMPLE USAGE',
        examples: [
            'Call of Duty | Ranked | Diamond II',
            'Valorant | Competitive | Platinum I',
            'Apex Legends | BR | Master',
            'Fortnite | Solo | Elite',
            'CS:GO | Premier | Global Elite'
        ],
        quickSetup: '🚀 QUICK SETUP',
        selectGame: 'Select a game...',
        selectMode: 'Select a mode...',
        enterRank: 'Enter your rank (e.g., Diamond II)',
        primarySector: '🎯 PRIMARY SECTOR',
        combatMode: '⚙️ COMBAT MODE',
        rankTier: '🏆 RANK / TIER',
        agentStatus: '📊 AGENT STATUS',
        lastSync: '⏱️ LAST SYNC',
        level: 'Level',
        xp: 'XP',
        messages: 'Messages',
        credits: 'Credits',
        rank: 'Rank',
        rankMessages: {
            bronze: '🌱 **Starting your journey. Keep grinding!**',
            silver: '⚡ **Silver tier achieved. Progressing steadily!**',
            gold: '✨ **Gold tier! You\'re becoming a formidable agent.**',
            platinum: '💎 **Platinum tier! Elite skills detected.**',
            diamond: '👑 **Diamond tier! A true warrior emerges.**',
            master: '🔥 **MASTER TIER! Legendary status achieved!**',
            grandmaster: '🏆 **GRANDMASTER! You stand among the elite!**',
            predator: '⚡ **APEX PREDATOR! The hunt never ends!**',
            radiant: '🌟 **RADIANT! You shine above all others!**',
            global: '🌍 **GLOBAL ELITE! World-class operator!**',
            default: '🎯 **Combat data synchronized. Ready for deployment!**'
        },
        footer: 'DIGITAL SOVEREIGNTY',
        quickButtons: { cod: '🎯 CoD', val: '🔫 Valorant', apex: '🦅 Apex', fortnite: '🏗️ Fortnite', csgo: '🔪 CS:GO', lol: '🏆 LoL' },
        modes: { mp: 'MP', br: 'BR', zm: 'ZM', dmz: 'DMZ', ranked: 'Ranked', competitive: 'Competitive', casual: 'Casual' },
        accessDenied: '❌ This menu is not yours.',
        manualFormat: 'MANUAL FORMAT',
        examples_title: 'EXAMPLES',
        interactiveSetup: 'INTERACTIVE SETUP',
        chooseGame: 'Choose your game, mode, and rank using the menus below.',
        selectedGame: (game) => `✅ **${game}** selected! Now enter your mode and rank:\n\`.setgame ${game} | [Mode] | [Rank]\``,
        registered: (user) => `**Agent ${user}** has been successfully registered into the combat matrix.`
    },
    fr: {
        title: '🎮 ENREGISTREMENT DE COMBAT',
        success: '✅ SPÉCIALISATION NEURALE VERROUILLÉE',
        error: '⚠️ ERREUR DE SAISIE: MODE_INDÉFINI',
        incomplete: '❌ DONNÉES DE COMBAT INCOMPLÈTES',
        desc: 'L\'interface neurale nécessite une synchronisation complète.',
        instruction: 'Pour enregistrer votre spécialisation, définissez **Jeu**, **Mode**, et **Rang**.',
        supportedGames: '🎮 JEUX SUPPORTÉS',
        recognizedModes: '⚔️ MODES RECONNUS',
        exampleUsage: '📝 EXEMPLE D\'UTILISATION',
        examples: [
            'Call of Duty | Classé | Diamant II',
            'Valorant | Compétitif | Platine I',
            'Apex Legends | BR | Maître',
            'Fortnite | Solo | Élite',
            'CS:GO | Premier | Élite Mondial'
        ],
        quickSetup: '🚀 CONFIGURATION RAPIDE',
        selectGame: 'Sélectionnez un jeu...',
        selectMode: 'Sélectionnez un mode...',
        enterRank: 'Entrez votre rang (ex: Diamant II)',
        primarySector: '🎯 SECTEUR PRINCIPAL',
        combatMode: '⚙️ MODE DE COMBAT',
        rankTier: '🏆 RANG / ÉCHELON',
        agentStatus: '📊 STATUT DE L\'AGENT',
        lastSync: '⏱️ DERNIÈRE SYNCHRO',
        level: 'Niveau',
        xp: 'XP',
        messages: 'Messages',
        credits: 'Crédits',
        rank: 'Rang',
        rankMessages: {
            bronze: '🌱 **Début de votre parcours. Continuez à progresser !**',
            silver: '⚡ **Niveau Argent atteint. Progression constante !**',
            gold: '✨ **Niveau Or ! Vous devenez un agent redoutable.**',
            platinum: '💎 **Niveau Platine ! Compétences d\'élite détectées.**',
            diamond: '👑 **Niveau Diamant ! Un véritable guerrier émerge.**',
            master: '🔥 **NIVEAU MAÎTRE ! Statut légendaire atteint !**',
            grandmaster: '🏆 **GRAND MAÎTRE ! Vous êtes parmi l\'élite !**',
            predator: '⚡ **PRÉDATEUR APEX ! La chasse ne s\'arrête jamais !**',
            radiant: '🌟 **RADIANT ! Vous brillez au-dessus des autres !**',
            global: '🌍 **ÉLITE MONDIALE ! Opérateur de classe mondiale !**',
            default: '🎯 **Données de combat synchronisées. Prêt pour le déploiement !**'
        },
        footer: 'SOUVERAINETÉ NUMÉRIQUE',
        quickButtons: { cod: '🎯 CoD', val: '🔫 Valorant', apex: '🦅 Apex', fortnite: '🏗️ Fortnite', csgo: '🔪 CS:GO', lol: '🏆 LoL' },
        modes: { mp: 'MJ', br: 'BR', zm: 'ZM', dmz: 'DMZ', ranked: 'Classé', competitive: 'Compétitif', casual: 'Occasionnel' },
        accessDenied: '❌ Ce menu ne vous appartient pas.',
        manualFormat: 'FORMAT MANUEL',
        examples_title: 'EXEMPLES',
        interactiveSetup: 'CONFIGURATION INTERACTIVE',
        chooseGame: 'Choisissez votre jeu, mode, et rang en utilisant les menus ci-dessous.',
        selectedGame: (game) => `✅ **${game}** sélectionné! Maintenant, entrez votre mode et rang:\n\`.setgame ${game} | [Mode] | [Rang]\``,
        registered: (user) => `**Agent ${user}** a été enregistré avec succès dans la matrice de combat.`
    }
};

// ================= GAME PATTERNS =================
const GAME_PATTERNS = {
    'CALL OF DUTY': { keywords: ['cod', 'call of duty', 'warzone', 'modern warfare', 'black ops'], modes: ['MP', 'BR', 'ZM', 'DMZ', 'Ranked'] },
    'VALORANT': { keywords: ['val', 'valorant', 'valo'], modes: ['Competitive', 'Unrated', 'Spike Rush', 'Deathmatch', 'Premier'] },
    'APEX LEGENDS': { keywords: ['apex', 'apex legends'], modes: ['BR', 'Ranked', 'Mixtape'] },
    'FORTNITE': { keywords: ['fortnite', 'fn', 'fort'], modes: ['Solo', 'Duo', 'Trio', 'Squad', 'Ranked', 'Zero Build'] },
    'CS:GO': { keywords: ['csgo', 'cs:go', 'cs2', 'counter strike'], modes: ['Competitive', 'Premier', 'Casual'] },
    'LEAGUE OF LEGENDS': { keywords: ['lol', 'league', 'league of legends'], modes: ['Solo/Duo', 'Flex', 'ARAM'] }
};

function detectGame(input) {
    const lowerInput = input.toLowerCase();
    for (const [gameName, data] of Object.entries(GAME_PATTERNS)) {
        if (data.keywords.some(k => lowerInput.includes(k))) return gameName;
    }
    return null;
}

function getRankMessage(rank, lang) {
    const t = translations[lang];
    const lowerRank = rank.toLowerCase();
    if (lowerRank.includes('bronze')) return t.rankMessages.bronze;
    if (lowerRank.includes('silver')) return t.rankMessages.silver;
    if (lowerRank.includes('gold')) return t.rankMessages.gold;
    if (lowerRank.includes('platin')) return t.rankMessages.platinum;
    if (lowerRank.includes('diamond')) return t.rankMessages.diamond;
    if (lowerRank.includes('master') || lowerRank.includes('maître')) return t.rankMessages.master;
    if (lowerRank.includes('grandmaster')) return t.rankMessages.grandmaster;
    if (lowerRank.includes('predator')) return t.rankMessages.predator;
    if (lowerRank.includes('radiant')) return t.rankMessages.radiant;
    if (lowerRank.includes('global') || lowerRank.includes('élite')) return t.rankMessages.global;
    return t.rankMessages.default;
}

function createQuickSetupRow(lang) {
    const t = translations[lang];
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quick_cod').setLabel(t.quickButtons.cod).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('quick_val').setLabel(t.quickButtons.val).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('quick_apex').setLabel(t.quickButtons.apex).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('quick_fortnite').setLabel(t.quickButtons.fortnite).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('quick_csgo').setLabel(t.quickButtons.csgo).setStyle(ButtonStyle.Primary)
    );
}

function createGameSelectMenu(lang) {
    const t = translations[lang];
    return new StringSelectMenuBuilder()
        .setCustomId('select_game')
        .setPlaceholder(t.selectGame)
        .addOptions([
            { label: 'Call of Duty', value: 'cod', emoji: '🎯', description: 'Warzone • MW • BO' },
            { label: 'Valorant', value: 'val', emoji: '🔫', description: 'Tactical shooter' },
            { label: 'Apex Legends', value: 'apex', emoji: '🦅', description: 'Battle Royale' },
            { label: 'Fortnite', value: 'fortnite', emoji: '🏗️', description: 'BR & Zero Build' },
            { label: 'CS:GO / CS2', value: 'csgo', emoji: '🔪', description: 'Counter-Strike 2' },
            { label: 'League of Legends', value: 'lol', emoji: '🏆', description: 'MOBA' }
        ]);
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'setgame',
    aliases: ['sg', 'spec', 'combat', 'jeu', 'specialisation', 'gameprofile'],
    description: '🎮 Register your primary combat sector, mode, and rank.',
    category: 'GAMING',
    cooldown: 3000,
    usage: '.setgame [Game] | [Mode] | [Rank]',
    examples: ['.setgame Call of Duty | Ranked | Diamond II', '.sg Valorant | Competitive | Platinum I'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = translations[lang];
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        
        const fullInput = args.join(' ');
        
        // Ensure gaming column exists
        try { db.prepare(`ALTER TABLE users ADD COLUMN gaming TEXT`).run(); } catch (e) {}
        
        // ================= INTERACTIVE MODE =================
        if (!fullInput) {
            const interactiveEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: `🎮 ${t.title} • ${message.author.username.toUpperCase()}`, iconURL: message.author.displayAvatarURL() })
                .setTitle(`═ ${t.interactiveSetup} ═`)
                .setDescription(t.chooseGame)
                .addFields(
                    { name: '📝 ' + t.manualFormat, value: `\`${prefix}setgame [Jeu] | [Mode] | [Rang]\``, inline: false },
                    { name: '💡 ' + t.examples_title, value: t.examples.map(ex => `\`${ex}\``).join('\n'), inline: false }
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            const gameMenu = createGameSelectMenu(lang);
            const quickRow = createQuickSetupRow(lang);
            const menuRow = new ActionRowBuilder().addComponents(gameMenu);
            
            const reply = await message.reply({ embeds: [interactiveEmbed], components: [quickRow, menuRow] }).catch(() => {});
            if (!reply) return;
            
            const collector = reply.createMessageComponentCollector({ time: 120000 });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                
                if (i.isButton()) {
                    const gameMap = { quick_cod: 'CALL OF DUTY', quick_val: 'VALORANT', quick_apex: 'APEX LEGENDS', quick_fortnite: 'FORTNITE', quick_csgo: 'CS:GO' };
                    const selectedGame = gameMap[i.customId];
                    if (selectedGame) await i.reply({ content: t.selectedGame(selectedGame), ephemeral: true }).catch(() => {});
                }
                
                if (i.isStringSelectMenu() && i.customId === 'select_game') {
                    const gameMap = { cod: 'CALL OF DUTY', val: 'VALORANT', apex: 'APEX LEGENDS', fortnite: 'FORTNITE', csgo: 'CS:GO', lol: 'LEAGUE OF LEGENDS' };
                    const selectedGame = gameMap[i.values[0]];
                    if (selectedGame) await i.reply({ content: t.selectedGame(selectedGame), ephemeral: true }).catch(() => {});
                }
            });
            return;
        }
        
        // ================= MANUAL PARSING =================
        const parts = fullInput.split('|').map(p => p.trim());
        let gameName = parts[0]?.toUpperCase() || '';
        const modeName = parts[1]?.toUpperCase() || '';
        const rankName = parts[2] || '';
        
        if (!gameName || !modeName || !rankName) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4757')
                .setAuthor({ name: t.error, iconURL: client.user.displayAvatarURL() })
                .setTitle(t.incomplete)
                .setDescription(`**${t.desc}**\n\n${t.instruction}\n\`\`\`yaml\n${prefix}setgame [Game] | [Mode] | [Rank]\`\`\``)
                .addFields(
                    { name: t.supportedGames, value: '`Call of Duty` • `Valorant` • `Apex Legends` • `Fortnite` • `CS:GO` • `LoL`', inline: false },
                    { name: t.recognizedModes, value: '`MP` • `BR` • `ZM` • `DMZ` • `Ranked` • `Competitive`', inline: true },
                    { name: t.exampleUsage, value: t.examples.map(ex => `\`${ex}\``).join('\n'), inline: true }
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
        
        // Auto-detect if game not recognized
        const detected = detectGame(gameName);
        if (detected) gameName = detected;
        
        const safeGame = gameName.slice(0, 30);
        const safeMode = modeName.slice(0, 20);
        const safeRank = rankName.slice(0, 25);
        
        const gamingData = JSON.stringify({ game: safeGame, mode: safeMode, rank: safeRank, timestamp: Date.now(), lastUpdated: new Date().toISOString() });
        
        // 🔥 BATCH UPDATE
        const userData = client.getUserData ? client.getUserData(message.author.id) : db.prepare(`SELECT * FROM users WHERE id = ?`).get(message.author.id);
        
        if (client.queueUserUpdate && userData) {
            client.queueUserUpdate(message.author.id, { ...userData, gaming: gamingData, username: message.author.username });
        } else {
            db.prepare(`UPDATE users SET gaming = ? WHERE id = ?`).run(gamingData, message.author.id);
        }
        
        const updatedUser = userData ? { ...userData, gaming: gamingData } : db.prepare(`SELECT * FROM users WHERE id = ?`).get(message.author.id);
        const level = updatedUser?.level || calculateLevel(updatedUser?.xp || 0);
        const agentRank = getAgentRank(level);
        
        const successEmbed = new EmbedBuilder()
            .setColor('#00ff9d')
            .setAuthor({ name: `🎮 COMBAT PROFILE: ${message.author.username.toUpperCase()}`, iconURL: message.author.displayAvatarURL() })
            .setTitle(t.success)
            .setDescription(t.registered(message.author.username))
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: t.primarySector, value: `\`\`\`yaml\n${safeGame}\`\`\``, inline: true },
                { name: t.combatMode, value: `\`\`\`yaml\n${safeMode}\`\`\``, inline: true },
                { name: t.rankTier, value: `\`\`\`yaml\n${safeRank}\`\`\``, inline: true }
            )
            .addFields(
                { name: t.agentStatus, value: `\`\`\`yaml\n${t.level}: ${level}\n${t.rank}: ${agentRank.emoji} ${agentRank.title[lang]}\n${t.xp}: ${(updatedUser?.xp || 0).toLocaleString()}\n${t.credits}: ${(updatedUser?.credits || 0).toLocaleString()} 🪙\`\`\``, inline: true },
                { name: t.lastSync, value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        const rankMessage = getRankMessage(safeRank, lang);
        
        await message.reply({ content: `> **${rankMessage}**`, embeds: [successEmbed] }).catch(() => {});
        console.log(`[SETGAME] ${message.author.tag} registered: ${safeGame} | ${safeMode} | ${safeRank} | Lang: ${lang}`);
    }
};