const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

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
        footer: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223',
        quickButtons: {
            cod: '🎯 CoD',
            val: '🔫 Valorant',
            apex: '🦅 Apex',
            fortnite: '🏗️ Fortnite',
            csgo: '🔪 CS:GO',
            lol: '🏆 LoL'
        },
        modes: {
            mp: 'MP (Multiplayer)',
            br: 'BR (Battle Royale)',
            zm: 'ZM (Zombies)',
            dmz: 'DMZ',
            ranked: 'Ranked',
            competitive: 'Competitive',
            casual: 'Casual',
            premier: 'Premier',
            solo: 'Solo',
            duo: 'Duo',
            trio: 'Trio',
            squad: 'Squad'
        }
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
        footer: 'EAGLE COMMUNITY • SOUVERAINETÉ NUMÉRIQUE • BKO-223',
        quickButtons: {
            cod: '🎯 CoD',
            val: '🔫 Valorant',
            apex: '🦅 Apex',
            fortnite: '🏗️ Fortnite',
            csgo: '🔪 CS:GO',
            lol: '🏆 LoL'
        },
        modes: {
            mp: 'MJ (Multijoueur)',
            br: 'BR (Battle Royale)',
            zm: 'ZM (Zombies)',
            dmz: 'DMZ',
            ranked: 'Classé',
            competitive: 'Compétitif',
            casual: 'Occasionnel',
            premier: 'Premier',
            solo: 'Solo',
            duo: 'Duo',
            trio: 'Trio',
            squad: 'Escouade'
        }
    }
};

// ================= GAME PATTERNS & AUTO-DETECTION =================
const GAME_PATTERNS = {
    'CALL OF DUTY': {
        keywords: ['cod', 'call of duty', 'warzone', 'modern warfare', 'black ops', 'mw', 'bo'],
        modes: ['MP', 'BR', 'ZM', 'DMZ', 'Ranked', 'Casual'],
        ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Crimson', 'Iridescent', 'Top 250']
    },
    'VALORANT': {
        keywords: ['val', 'valorant', 'valo'],
        modes: ['Competitive', 'Unrated', 'Spike Rush', 'Deathmatch', 'Premier'],
        ranks: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant']
    },
    'APEX LEGENDS': {
        keywords: ['apex', 'apex legends', 'apexlegends'],
        modes: ['BR', 'Ranked', 'Mixtape', 'Control', 'Gun Run'],
        ranks: ['Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Apex Predator']
    },
    'FORTNITE': {
        keywords: ['fortnite', 'fn', 'fort'],
        modes: ['Solo', 'Duo', 'Trio', 'Squad', 'Ranked', 'Zero Build'],
        ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Elite', 'Champion', 'Unreal']
    },
    'CS:GO': {
        keywords: ['csgo', 'cs:go', 'cs2', 'counter strike', 'counter-strike'],
        modes: ['Competitive', 'Premier', 'Casual', 'Deathmatch', 'Wingman'],
        ranks: ['Silver I', 'Silver II', 'Silver III', 'Silver IV', 'Silver Elite', 'Silver Elite Master', 'Gold Nova I', 'Gold Nova II', 'Gold Nova III', 'Gold Nova Master', 'Master Guardian I', 'Master Guardian II', 'Master Guardian Elite', 'Distinguished Master Guardian', 'Legendary Eagle', 'Legendary Eagle Master', 'Supreme Master First Class', 'Global Elite']
    },
    'LEAGUE OF LEGENDS': {
        keywords: ['lol', 'league', 'league of legends'],
        modes: ['Solo/Duo', 'Flex', 'ARAM', 'Clash'],
        ranks: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger']
    }
};

// ================= AUTO-DETECT GAME =================
function detectGame(input) {
    const lowerInput = input.toLowerCase();
    for (const [gameName, data] of Object.entries(GAME_PATTERNS)) {
        if (data.keywords.some(keyword => lowerInput.includes(keyword))) {
            return gameName;
        }
    }
    return null;
}

// ================= GET RANK MESSAGE =================
function getRankMessage(rank, lang) {
    const t = translations[lang];
    const lowerRank = rank.toLowerCase();
    
    if (lowerRank.includes('bronze')) return t.rankMessages.bronze;
    if (lowerRank.includes('silver')) return t.rankMessages.silver;
    if (lowerRank.includes('gold')) return t.rankMessages.gold;
    if (lowerRank.includes('platin')) return t.rankMessages.platinum;
    if (lowerRank.includes('diamond')) return t.rankMessages.diamond;
    if (lowerRank.includes('master') || lowerRank.includes('maître')) return t.rankMessages.master;
    if (lowerRank.includes('grandmaster') || lowerRank.includes('grand maître')) return t.rankMessages.grandmaster;
    if (lowerRank.includes('predator') || lowerRank.includes('prédateur')) return t.rankMessages.predator;
    if (lowerRank.includes('radiant')) return t.rankMessages.radiant;
    if (lowerRank.includes('global') || lowerRank.includes('élite')) return t.rankMessages.global;
    
    return t.rankMessages.default;
}

// ================= CREATE QUICK SETUP BUTTONS =================
function createQuickSetupRow(lang, prefix) {
    const t = translations[lang];
    
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quick_cod').setLabel(t.quickButtons.cod).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('quick_val').setLabel(t.quickButtons.val).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('quick_apex').setLabel(t.quickButtons.apex).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('quick_fortnite').setLabel(t.quickButtons.fortnite).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('quick_csgo').setLabel(t.quickButtons.csgo).setStyle(ButtonStyle.Primary)
    );
}

// ================= CREATE GAME SELECT MENU =================
function createGameSelectMenu(lang) {
    const t = translations[lang];
    
    return new StringSelectMenuBuilder()
        .setCustomId('select_game')
        .setPlaceholder(t.selectGame)
        .addOptions([
            { label: 'Call of Duty', value: 'cod', emoji: '🎯', description: 'Warzone • Modern Warfare • Black Ops' },
            { label: 'Valorant', value: 'val', emoji: '🔫', description: 'Tactical shooter by Riot Games' },
            { label: 'Apex Legends', value: 'apex', emoji: '🦅', description: 'Battle Royale with Legends' },
            { label: 'Fortnite', value: 'fortnite', emoji: '🏗️', description: 'Battle Royale & Zero Build' },
            { label: 'CS:GO / CS2', value: 'csgo', emoji: '🔪', description: 'Counter-Strike 2' },
            { label: 'League of Legends', value: 'lol', emoji: '🏆', description: 'MOBA by Riot Games' }
        ]);
}

// ================= CREATE MODE SELECT MENU =================
function createModeSelectMenu(game, lang) {
    const t = translations[lang];
    const gameData = GAME_PATTERNS[game];
    
    if (!gameData) return null;
    
    const options = gameData.modes.slice(0, 25).map(mode => ({
        label: mode,
        value: mode.toLowerCase().replace(/\s+/g, '_'),
        description: `${t.modes[mode.toLowerCase()] || mode} mode`
    }));
    
    return new StringSelectMenuBuilder()
        .setCustomId('select_mode')
        .setPlaceholder(t.selectMode)
        .addOptions(options);
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'setgame',
    aliases: ['sg', 'spec', 'combat', 'jeu', 'specialisation'],
    description: '🎮 Register your primary combat sector, mode, and rank into the neural network.',
    category: 'GAMING',
    cooldown: 3000,
    usage: '.setgame [Game] | [Mode] | [Rank]',
    examples: [
        '.setgame Call of Duty | Ranked | Diamond II',
        '.setgame Valorant | Competitive | Platinum I',
        '.sg Apex Legends | BR | Master'
    ],

    run: async (client, message, args, userData) => {
        
        // ================= LANGUAGE DETECTION =================
        let lang = 'en';
        const guildSettings = client.settings?.get(message.guild?.id);
        if (guildSettings?.language) {
            lang = guildSettings.language;
        } else {
            const frenchKeywords = ['jeu', 'specialisation', 'spécialisation'];
            const content = message.content.toLowerCase();
            if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                lang = 'fr';
            }
        }
        const t = translations[lang];
        const prefix = process.env.PREFIX || '.';
        
        const fullInput = args.join(' ');
        const db = require('better-sqlite3')('database.sqlite');
        
        // Ensure gaming column exists
        try {
            db.prepare(`ALTER TABLE users ADD COLUMN gaming TEXT`).run();
        } catch (e) {}
        
        // ================= INTERACTIVE MODE (No args) =================
        if (!fullInput) {
            const interactiveEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ 
                    name: `🎮 ${t.title} • ${message.author.username.toUpperCase()}`, 
                    iconURL: message.author.displayAvatarURL() 
                })
                .setTitle(lang === 'fr' ? '═ CONFIGURATION INTERACTIVE ═' : '═ INTERACTIVE SETUP ═')
                .setDescription(
                    lang === 'fr' 
                        ? 'Choisissez votre jeu, mode, et rang en utilisant les menus ci-dessous.'
                        : 'Choose your game, mode, and rank using the menus below.'
                )
                .addFields(
                    { name: '📝 ' + (lang === 'fr' ? 'FORMAT MANUEL' : 'MANUAL FORMAT'), value: `\`${prefix}setgame [Jeu] | [Mode] | [Rang]\``, inline: false },
                    { name: '💡 ' + (lang === 'fr' ? 'EXEMPLES' : 'EXAMPLES'), value: t.examples.map(ex => `\`${ex}\``).join('\n'), inline: false }
                )
                .setFooter({ text: t.footer })
                .setTimestamp();
            
            const gameMenu = createGameSelectMenu(lang);
            const quickRow = createQuickSetupRow(lang, prefix);
            const menuRow = new ActionRowBuilder().addComponents(gameMenu);
            
            const reply = await message.reply({ 
                embeds: [interactiveEmbed], 
                components: [quickRow, menuRow] 
            });
            
            const collector = reply.createMessageComponentCollector({ time: 120000 });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: lang === 'fr' ? '❌ Ce menu ne vous appartient pas.' : '❌ This menu is not yours.', ephemeral: true });
                }
                
                // Quick buttons
                if (i.isButton()) {
                    let selectedGame = '';
                    if (i.customId === 'quick_cod') selectedGame = 'CALL OF DUTY';
                    else if (i.customId === 'quick_val') selectedGame = 'VALORANT';
                    else if (i.customId === 'quick_apex') selectedGame = 'APEX LEGENDS';
                    else if (i.customId === 'quick_fortnite') selectedGame = 'FORTNITE';
                    else if (i.customId === 'quick_csgo') selectedGame = 'CS:GO';
                    
                    await i.reply({ 
                        content: lang === 'fr' 
                            ? `✅ **${selectedGame}** sélectionné! Maintenant, entrez votre mode et rang:\n\`${prefix}setgame ${selectedGame} | [Mode] | [Rang]\``
                            : `✅ **${selectedGame}** selected! Now enter your mode and rank:\n\`${prefix}setgame ${selectedGame} | [Mode] | [Rank]\``,
                        ephemeral: true 
                    });
                }
                
                // Game select menu
                if (i.isStringSelectMenu() && i.customId === 'select_game') {
                    const gameMap = {
                        'cod': 'CALL OF DUTY',
                        'val': 'VALORANT',
                        'apex': 'APEX LEGENDS',
                        'fortnite': 'FORTNITE',
                        'csgo': 'CS:GO',
                        'lol': 'LEAGUE OF LEGENDS'
                    };
                    const selectedGame = gameMap[i.values[0]];
                    
                    await i.reply({ 
                        content: lang === 'fr' 
                            ? `✅ **${selectedGame}** sélectionné! Maintenant, entrez votre mode et rang:\n\`${prefix}setgame ${selectedGame} | [Mode] | [Rang]\``
                            : `✅ **${selectedGame}** selected! Now enter your mode and rank:\n\`${prefix}setgame ${selectedGame} | [Mode] | [Rank]\``,
                        ephemeral: true 
                    });
                }
            });
            
            return;
        }
        
        // ================= MANUAL PARSING =================
        const parts = fullInput.split('|').map(p => p.trim());
        let gameName = parts[0];
        let modeName = parts[1];
        let rankName = parts[2];
        
        // Auto-detect game if possible
        if (gameName && !modeName) {
            const detected = detectGame(gameName);
            if (detected) {
                gameName = detected;
            }
        }
        
        // Error handshake
        if (!gameName || !modeName || !rankName) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4757')
                .setAuthor({ 
                    name: t.error, 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTitle(t.incomplete)
                .setDescription(`**${t.desc}**\n\n${t.instruction}\n\`\`\`yaml\n${prefix}setgame [Game] | [Mode] | [Rank]\`\`\``)
                .addFields(
                    { name: t.supportedGames, value: '`Call of Duty` • `Valorant` • `Apex Legends` • `Fortnite` • `CS:GO` • `League of Legends`', inline: false },
                    { name: t.recognizedModes, value: '`MP` • `BR` • `ZM` • `DMZ` • `Ranked` • `Competitive` • `Casual`', inline: true },
                    { name: t.exampleUsage, value: t.examples.map(ex => `\`${ex}\``).join('\n'), inline: true }
                )
                .setFooter({ text: t.footer })
                .setTimestamp();

            return message.reply({ embeds: [errorEmbed] });
        }

        // Data cleaning
        const safeGame = gameName.slice(0, 30).toUpperCase();
        const safeMode = modeName.slice(0, 20).toUpperCase();
        const safeRank = rankName.slice(0, 25);

        // Store gaming data
        const gamingData = JSON.stringify({
            game: safeGame,
            mode: safeMode,
            rank: safeRank,
            timestamp: Date.now(),
            lastUpdated: new Date().toISOString()
        });
        
        db.prepare(`UPDATE users SET gaming = ? WHERE id = ?`).run(gamingData, message.author.id);
        const updatedUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(message.author.id);
        db.close();

        // Success embed
        const successEmbed = new EmbedBuilder()
            .setColor('#00ff9d')
            .setAuthor({ 
                name: `🎮 COMBAT PROFILE: ${message.author.username.toUpperCase()}`, 
                iconURL: message.author.displayAvatarURL({ dynamic: true, size: 1024 }) 
            })
            .setTitle(t.success)
            .setDescription(`**Agent ${message.author.username} has been successfully registered into the combat matrix.**`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: t.primarySector, value: `\`\`\`prolog\n${safeGame}\`\`\``, inline: true },
                { name: t.combatMode, value: `\`\`\`prolog\n${safeMode}\`\`\``, inline: true },
                { name: t.rankTier, value: `\`\`\`prolog\n${safeRank}\`\`\``, inline: true }
            )
            .addFields(
                {
                    name: t.agentStatus,
                    value: `\`\`\`ansi\n\u001b[1;36m▣\u001b[0m ${t.level}: ${updatedUser?.level || 1}\n\u001b[1;32m▣\u001b[0m ${t.xp}: ${(updatedUser?.xp || 0).toLocaleString()}\n\u001b[1;33m▣\u001b[0m ${t.messages}: ${(updatedUser?.total_messages || 0).toLocaleString()}\`\`\``,
                    inline: true
                },
                {
                    name: t.lastSync,
                    value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                    inline: true
                }
            )
            .setFooter({ 
                text: t.footer, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        const rankMessage = getRankMessage(safeRank, lang);

        await message.reply({ 
            content: `> **${rankMessage}**`,
            embeds: [successEmbed] 
        });
        
        console.log(`[SETGAME] ${message.author.tag} registered: ${safeGame} | ${safeMode} | ${safeRank}`);
    }
};