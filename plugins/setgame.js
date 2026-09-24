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
const i18n = require('../lib/i18n');
const I18N_PLAIN = ["title", "success", "error", "incomplete", "desc", "instruction", "supportedGames", "recognizedModes", "exampleUsage", "quickSetup", "selectGame", "selectMode", "enterRank", "primarySector", "combatMode", "rankTier", "agentStatus", "lastSync", "level", "xp", "messages", "credits", "rank", "footer", "accessDenied", "manualFormat", "interactiveSetup", "chooseGame", "selectedGame", "registered"];
function loadT(lang) {
    const o = {};
    for (const k of I18N_PLAIN) o[k] = i18n.t(`setgame.${k}`, lang);
    o.examples = [0,1,2,3,4].map(i => i18n.t(`setgame.examples_${i}`, lang));
    const _rankMessages = {};
    _rankMessages['bronze'] = i18n.t(`setgame.rankMessages_bronze`, lang);
    _rankMessages['silver'] = i18n.t(`setgame.rankMessages_silver`, lang);
    _rankMessages['gold'] = i18n.t(`setgame.rankMessages_gold`, lang);
    _rankMessages['platinum'] = i18n.t(`setgame.rankMessages_platinum`, lang);
    _rankMessages['diamond'] = i18n.t(`setgame.rankMessages_diamond`, lang);
    _rankMessages['master'] = i18n.t(`setgame.rankMessages_master`, lang);
    _rankMessages['grandmaster'] = i18n.t(`setgame.rankMessages_grandmaster`, lang);
    _rankMessages['predator'] = i18n.t(`setgame.rankMessages_predator`, lang);
    _rankMessages['radiant'] = i18n.t(`setgame.rankMessages_radiant`, lang);
    _rankMessages['global'] = i18n.t(`setgame.rankMessages_global`, lang);
    _rankMessages['default'] = i18n.t(`setgame.rankMessages_default`, lang);
    o.rankMessages = _rankMessages;
    const _quickButtons = {};
    _quickButtons['cod'] = i18n.t(`setgame.quickButtons_cod`, lang);
    _quickButtons['val'] = i18n.t(`setgame.quickButtons_val`, lang);
    _quickButtons['apex'] = i18n.t(`setgame.quickButtons_apex`, lang);
    _quickButtons['fortnite'] = i18n.t(`setgame.quickButtons_fortnite`, lang);
    _quickButtons['csgo'] = i18n.t(`setgame.quickButtons_csgo`, lang);
    _quickButtons['lol'] = i18n.t(`setgame.quickButtons_lol`, lang);
    o.quickButtons = _quickButtons;
    const _modes = {};
    _modes['mp'] = i18n.t(`setgame.modes_mp`, lang);
    _modes['br'] = i18n.t(`setgame.modes_br`, lang);
    _modes['zm'] = i18n.t(`setgame.modes_zm`, lang);
    _modes['dmz'] = i18n.t(`setgame.modes_dmz`, lang);
    _modes['ranked'] = i18n.t(`setgame.modes_ranked`, lang);
    _modes['competitive'] = i18n.t(`setgame.modes_competitive`, lang);
    _modes['casual'] = i18n.t(`setgame.modes_casual`, lang);
    o.modes = _modes;
    return o;
}

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
    const t = loadT(lang);
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
    const t = loadT(lang);
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quick_cod').setLabel(t.quickButtons.cod).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('quick_val').setLabel(t.quickButtons.val).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('quick_apex').setLabel(t.quickButtons.apex).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('quick_fortnite').setLabel(t.quickButtons.fortnite).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('quick_csgo').setLabel(t.quickButtons.csgo).setStyle(ButtonStyle.Primary)
    );
}

function createGameSelectMenu(lang) {
    const t = loadT(lang);
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
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE
        
        const t = loadT(lang);
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
                if (i.user.id !== message.author.id) return i.reply({ content: t.accessDenied, flags: 64 }).catch(() => {});
                
                if (i.isButton()) {
                    const gameMap = { quick_cod: 'CALL OF DUTY', quick_val: 'VALORANT', quick_apex: 'APEX LEGENDS', quick_fortnite: 'FORTNITE', quick_csgo: 'CS:GO' };
                    const selectedGame = gameMap[i.customId];
                    if (selectedGame) await i.reply({ content: i18n.t('setgame.selectedGame', lang, { a: selectedGame }), flags: 64 }).catch(() => {});
                }
                
                if (i.isStringSelectMenu() && i.customId === 'select_game') {
                    const gameMap = { cod: 'CALL OF DUTY', val: 'VALORANT', apex: 'APEX LEGENDS', fortnite: 'FORTNITE', csgo: 'CS:GO', lol: 'LEAGUE OF LEGENDS' };
                    const selectedGame = gameMap[i.values[0]];
                    if (selectedGame) await i.reply({ content: i18n.t('setgame.selectedGame', lang, { a: selectedGame }), flags: 64 }).catch(() => {});
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
        
        // 🔥 BATCH UPDATE (PER-SERVER)
        const guildId = message.guild?.id || 'DM';
        const userData = client.getUserData ? client.getUserData(message.author.id, guildId) : db.prepare(`SELECT * FROM users WHERE id = ? AND guild_id = ?`).get(message.author.id, guildId);
        
        if (client.queueUserUpdate && userData) {
            client.queueUserUpdate(message.author.id, guildId, { ...userData, gaming: gamingData, username: message.author.username });
        } else {
            db.prepare(`UPDATE users SET gaming = ? WHERE id = ? AND guild_id = ?`).run(gamingData, message.author.id, guildId);
        }
        
        const updatedUser = userData ? { ...userData, gaming: gamingData } : db.prepare(`SELECT * FROM users WHERE id = ? AND guild_id = ?`).get(message.author.id, guildId);
        const level = updatedUser?.level || calculateLevel(updatedUser?.xp || 0);
        const agentRank = getAgentRank(level);
        
        const successEmbed = new EmbedBuilder()
            .setColor('#00ff9d')
            .setAuthor({ name: `🎮 COMBAT PROFILE: ${message.author.username.toUpperCase()}`, iconURL: message.author.displayAvatarURL() })
            .setTitle(t.success)
            .setDescription(i18n.t('setgame.registered', lang, { a: message.author.username }))
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