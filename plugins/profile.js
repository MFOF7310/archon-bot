const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const AGENT_RANKS = [
    { minLevel: 1,  maxLevel: 5,        title: { fr: "RECRUE NEURALE",    en: "NEURAL RECRUIT"    }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6,  maxLevel: 15,       title: { fr: "AGENT DE TERRAIN",  en: "FIELD AGENT"       }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30,       title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST"  }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50,       title: { fr: "COMMANDANT BKO",    en: "BKO COMMANDER"     }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME",en: "SYSTEM ARCHITECT"  }, color: "#e74c3c", emoji: "👑" },
];

const WEALTH_TIERS = [
    { minCredits: 0,      title: { fr: "SANS LE SOU",          en: "BROKE"              }, emoji: "💀", color: "#95a5a6" },
    { minCredits: 100,    title: { fr: "PETIT PORTEFEUILLE",    en: "SMALL WALLET"       }, emoji: "🪙", color: "#7f8c8d" },
    { minCredits: 1000,   title: { fr: "COLLECTIONNEUR",        en: "COLLECTOR"          }, emoji: "💰", color: "#f1c40f" },
    { minCredits: 5000,   title: { fr: "INVESTISSEUR",          en: "INVESTOR"           }, emoji: "📈", color: "#e67e22" },
    { minCredits: 15000,  title: { fr: "BARON",                 en: "BARON"              }, emoji: "🏦", color: "#3498db" },
    { minCredits: 50000,  title: { fr: "MAGNAT",                en: "MAGNATE"            }, emoji: "👑", color: "#9b59b6" },
    { minCredits: 100000, title: { fr: "LÉGENDE FINANCIÈRE",    en: "FINANCIAL LEGEND"   }, emoji: "🏆", color: "#e74c3c" },
];

function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1; }
function getAgentRank(level) { return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1]; }
function getWealthTier(credits) { return [...WEALTH_TIERS].reverse().find(t => (credits || 0) >= t.minCredits) || WEALTH_TIERS[0]; }
function getNextWealthTier(credits) { return WEALTH_TIERS.find(t => t.minCredits > (credits || 0)); }
function createProgressBar(pct, len = 12) {
    const f = Math.round((Math.min(100, Math.max(0, pct)) / 100) * len);
    return '█'.repeat(f) + '░'.repeat(len - f);
}

// ── Badge helpers ──────────────────────────────────────────────
function getBadgeDisplay(activeBadge, shopItems) {
    if (!activeBadge) return null;
    const item = shopItems?.find(i => i.id === activeBadge);
    if (!item) return { emoji: '🎖️', name: activeBadge };
    return {
        emoji: item.emoji || '🎖️',
        name: item.en?.name || item.name || activeBadge,
        rarity: item.rarity || 'standard',
    };
}

// ── Translations ───────────────────────────────────────────────
const TRANSLATIONS = {
    fr: {
        title: (n) => `📋 DOSSIER AGENT: ${n.toUpperCase()}`,
        node: 'Nœud', core: 'Noyau', rank: 'Rang',
        level: 'Niveau', xp: 'XP', credits: 'Crédits',
        wealth: 'Richesse', progress: 'PROGRESSION',
        next: 'Prochain', combatMatrix: 'MATRICE COMBAT',
        played: 'Parties', won: 'Victoires', winRate: 'Taux',
        streak: 'SÉRIE QUOTIDIENNE', messages: 'Messages',
        serverRank: 'Classement', days: 'jours',
        required: 'requis', wealthProg: 'Progression Richesse',
        badge: 'EMBLÈME ACTIF', noBadge: 'Aucun emblème équipé',
        architectRecognition: '🏛️ RECONNAISSANCE ARCHITECTE',
        architectDesc: 'Le Créateur marche parmi nous. Le Système honore son Architecte.',
        noData: (n) => `❌ **Agent ${n}** n'a aucune donnée enregistrée.`,
        footer: 'BAMAKO_223 🇲🇱 • NEURAL GRID',
        classifiedHeader: 'CLASSIFIÉ // ARCHON CG-223',
        operationalStatus: 'STATUT OPÉRATIONNEL',
        intelligenceReport: 'RAPPORT DE RENSEIGNEMENT',
        combatRecord: 'BILAN COMBAT',
        identity: 'IDENTITÉ',
    },
    en: {
        title: (n) => `📋 AGENT DOSSIER: ${n.toUpperCase()}`,
        node: 'Node', core: 'Core', rank: 'Rank',
        level: 'Level', xp: 'XP', credits: 'Credits',
        wealth: 'Wealth', progress: 'PROGRESS',
        next: 'Next', combatMatrix: 'COMBAT MATRIX',
        played: 'Played', won: 'Won', winRate: 'Rate',
        streak: 'DAILY STREAK', messages: 'Messages',
        serverRank: 'Server Rank', days: 'days',
        required: 'required', wealthProg: 'Wealth Progress',
        badge: 'ACTIVE EMBLEM', noBadge: 'No emblem equipped',
        architectRecognition: '🏛️ ARCHITECT RECOGNITION',
        architectDesc: 'The Creator walks among us. The System honors its Architect.',
        noData: (n) => `❌ **Agent ${n}** has no recorded data.`,
        footer: 'BAMAKO_223 🇲🇱 • NEURAL GRID',
        classifiedHeader: 'CLASSIFIED // ARCHON CG-223',
        operationalStatus: 'OPERATIONAL STATUS',
        intelligenceReport: 'INTELLIGENCE REPORT',
        combatRecord: 'COMBAT RECORD',
        identity: 'IDENTITY',
    }
};

// ══════════════════════════════════════════════════════════════
// CORE PROFILE BUILDER
// ══════════════════════════════════════════════════════════════
async function buildProfile(target, client, db, guildId, guild, lang, version, isSlash = false) {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const guildName = guild?.name?.toUpperCase() || 'NEURAL NODE';
    const guildIcon  = guild?.iconURL() || client.user.displayAvatarURL();
    const shopItems  = client.shopItems || [];

    // ── Fetch user data ──
    let userData = null;
    try { if (client.getUserData) userData = client.getUserData(target.id, guildId); } catch (e) {}
    if (!userData && db) {
        userData = db.prepare(
            `SELECT id, xp, credits, streak_days, created_at, games_played, games_won,
             total_messages, total_winnings, gaming, level, username, guild_id, active_badge
             FROM users WHERE id = ? AND guild_id = ?`
        ).get(target.id, guildId);
    }
    if (!userData && client.getOrCreateUser) {
        try { userData = client.getOrCreateUser(target.id, guildId, target.username); } catch (e) {}
    }
    if (!userData) return null;

    // ── Stats ──
    const xp           = userData.xp           ?? 0;
    const credits      = userData.credits       ?? 0;
    const streakDays   = userData.streak_days   ?? 0;
    const totalMessages= userData.total_messages?? 0;
    const gamesPlayed  = userData.games_played  ?? 0;
    const gamesWon     = userData.games_won     ?? 0;
    const totalWinnings= userData.total_winnings?? 0;
    const level        = userData.level         ?? calculateLevel(xp);
    const agentRank    = getAgentRank(level);
    const wealthTier   = getWealthTier(credits);
    const nextWealth   = getNextWealthTier(credits);
    const winRate      = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const activeBadge  = userData.active_badge  || null;
    const badgeDisplay = getBadgeDisplay(activeBadge, shopItems);

    // ── Server rank ──
    let serverRank = 1, totalUsers = 1;
    try {
        if (db && guild) {
            serverRank = ((db.prepare(`SELECT COUNT(*) as r FROM users WHERE xp > ? AND guild_id = ?`).get(xp, guildId)?.r) || 0) + 1;
            totalUsers  = db.prepare(`SELECT COUNT(*) as c FROM users WHERE guild_id = ?`).get(guildId)?.c || 1;
        }
    } catch (e) {}

    // ── Progress bars ──
    const curLvlXP   = Math.pow((level - 1) / 0.1, 2);
    const nxtLvlXP   = Math.pow(level / 0.1, 2);
    const pct        = nxtLvlXP > curLvlXP ? Math.min(100, ((xp - curLvlXP) / (nxtLvlXP - curLvlXP)) * 100) : 100;
    const xpRemain   = Math.max(0, Math.ceil(nxtLvlXP - xp));
    const lvlBar     = createProgressBar(pct, 14);

    let wealthPct = 100, creditsToNext = 0;
    if (nextWealth) {
        const prev = WEALTH_TIERS[WEALTH_TIERS.indexOf(nextWealth) - 1]?.minCredits || 0;
        creditsToNext = nextWealth.minCredits - credits;
        wealthPct = Math.min(100, ((credits - prev) / (nextWealth.minCredits - prev)) * 100);
    }
    const wealthBar = createProgressBar(wealthPct, 14);

    // ── Discord member info ──
    let highestRole = 'Member', memberDays = 0;
    try {
        const member = guild?.members.cache.get(target.id);
        if (member) {
            highestRole = member.roles.highest.name !== '@everyone' ? member.roles.highest.name : 'Member';
            memberDays = Math.floor((Date.now() - (member.joinedAt?.getTime() || Date.now())) / 86400000);
        }
    } catch (e) {}

    // ── Gaming data ──
    let gamingData = { game: 'CODM', rank: 'Unranked', mode: 'Standard' };
    try { if (userData.gaming) gamingData = JSON.parse(userData.gaming); } catch (e) {}

    // ══════════════════════════════════════════════════════════
    // BUILD CLASSIFIED DOSSIER EMBED
    // ══════════════════════════════════════════════════════════
    const embed = new EmbedBuilder()
        .setColor(agentRank.color)
        .setAuthor({
            name: `// ${t.classifiedHeader} // v${version}`,
            iconURL: client.user.displayAvatarURL({ dynamic: true })
        })
        .setTitle(`📁 ${t.title(target.username)}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }));

    // ── BLOCK 1: Operational Status ──
    const statusBlock = [
        `\`\`\`ansi`,
        `\u001b[1;36mSUBJECT          \u001b[0m ${target.username}`,
        `\u001b[1;36m${t.rank.padEnd(17)}\u001b[0m ${agentRank.emoji} ${agentRank.title[lang]}`,
        `\u001b[1;36m${t.level.padEnd(17)}\u001b[0m \u001b[1;33m${level}\u001b[0m`,
        `\u001b[1;36m${t.serverRank.padEnd(17)}\u001b[0m #${serverRank}/${totalUsers}`,
        `\u001b[1;36mNODE             \u001b[0m BAMAKO-STEEL-NODE`,
        `\`\`\``
    ].join('\n');

    embed.addFields({ name: `⬛ ${t.operationalStatus}`, value: statusBlock, inline: false });

    // ── BLOCK 2: Intelligence Report ──
    const intelBlock = [
        `\`\`\`ansi`,
        `\u001b[0;37m▸ ${t.xp.padEnd(16)}\u001b[0m \u001b[1;36m${xp.toLocaleString()}\u001b[0m`,
        `\u001b[0;37m▸ ${t.credits.padEnd(16)}\u001b[0m \u001b[1;33m${credits.toLocaleString()} 🪙\u001b[0m`,
        `\u001b[0;37m▸ ${t.wealth.padEnd(16)}\u001b[0m ${wealthTier.emoji} ${wealthTier.title[lang]}`,
        `\u001b[0;37m▸ ${t.streak.padEnd(16)}\u001b[0m \u001b[1;31m🔥 ${streakDays} ${t.days}\u001b[0m`,
        `\u001b[0;37m▸ ${t.messages.padEnd(16)}\u001b[0m ${totalMessages.toLocaleString()}`,
        `\`\`\``
    ].join('\n');

    embed.addFields({ name: `📊 ${t.intelligenceReport}`, value: intelBlock, inline: false });

    // ── BLOCK 3: XP Progress ──
    const progressBlock = `\`\`\`ansi\n\u001b[1;36m${lvlBar}\u001b[0m ${pct.toFixed(1)}%\n\u001b[0;37m└─ ${t.next} ${t.level}: ${xpRemain.toLocaleString()} ${t.xp}\u001b[0m\n\`\`\``;
    embed.addFields({ name: `🚀 ${t.progress}`, value: progressBlock, inline: true });

    // ── BLOCK 4: Wealth Progress ──
    const wealthBlock = nextWealth
        ? `\`\`\`ansi\n\u001b[1;33m${wealthBar}\u001b[0m ${wealthPct.toFixed(1)}%\n\u001b[0;37m└─ ${creditsToNext.toLocaleString()} 🪙 ${t.required}\u001b[0m\n\`\`\``
        : `\`\`\`ansi\n\u001b[1;33m██████████████\u001b[0m 100%\n\u001b[1;32m└─ MAX ${t.wealth.toUpperCase()} ACHIEVED\u001b[0m\n\`\`\``;
    embed.addFields({ name: `💎 ${t.wealthProg}`, value: wealthBlock, inline: true });

    // ── BLOCK 5: Badge ──
    const badgeBlock = badgeDisplay
        ? `\`\`\`ansi\n\u001b[1;35m${badgeDisplay.emoji} ${badgeDisplay.name}\u001b[0m\n\u001b[0;37m${badgeDisplay.rarity?.toUpperCase() || 'STANDARD'} CLEARANCE\u001b[0m\n\`\`\``
        : `\`\`\`ansi\n\u001b[0;37m${t.noBadge}\u001b[0m\n\`\`\``;
    embed.addFields({ name: `🎖️ ${t.badge}`, value: badgeBlock, inline: false });

    // ── BLOCK 6: Combat Record ──
    const combatBlock = [
        `\`\`\`ansi`,
        `\u001b[1;31m▸ SECTOR         \u001b[0m ${gamingData.game}`,
        `\u001b[1;31m▸ MODE           \u001b[0m ${gamingData.mode || 'Standard'}`,
        `\u001b[1;31m▸ RANK           \u001b[0m ${gamingData.rank || 'Unranked'}`,
        `\u001b[1;31m▸ ${t.played.padEnd(16)}\u001b[0m ${gamesPlayed.toLocaleString()}`,
        `\u001b[1;31m▸ ${t.won.padEnd(16)}\u001b[0m ${gamesWon} (${winRate}%)`,
        `\u001b[1;31m▸ WINNINGS       \u001b[0m ${totalWinnings.toLocaleString()} 🪙`,
        `\`\`\``
    ].join('\n');
    embed.addFields({ name: `🔴 ${t.combatRecord}`, value: combatBlock, inline: false });

    // ── BLOCK 7: Identity ──
    const identityBlock = [
        `\`\`\`ansi`,
        `\u001b[1;33m▸ ROLE           \u001b[0m ${highestRole}`,
        `\u001b[1;33m▸ MEMBER         \u001b[0m ${memberDays} ${t.days}`,
        `\u001b[1;33m▸ ID             \u001b[0m ${target.id.slice(0, 10)}...`,
        `\u001b[1;33m▸ SERVER         \u001b[0m ${guildName.slice(0, 20)}`,
        `\`\`\``
    ].join('\n');
    embed.addFields({ name: `🪪 ${t.identity}`, value: identityBlock, inline: false });

    // ── Architect recognition ──
    if (target.id === process.env.OWNER_ID) {
        embed.addFields({
            name: t.architectRecognition,
            value: `\`\`\`ansi\n\u001b[1;32m[ARCHITECT ACCESS CONFIRMED]\u001b[0m\n\u001b[0;37m${t.architectDesc}\u001b[0m\n\`\`\``,
            inline: false
        });
    }

    embed.setFooter({ text: `${t.footer} • v${version}`, iconURL: guildIcon }).setTimestamp();
    return embed;
}

module.exports = {
    name: 'profile',
    aliases: ['p', 'identifiant', 'userinfo', 'agent', 'profil'],
    description: '📋 Complete Agent Dossier — classified neural statistics.',
    category: 'PROFILE',
    usage: '.profile [@user]',
    cooldown: 3000,
    examples: ['.profile', '.profile @user', '.p @agent'],

    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('📋 Display classified agent dossier with neural statistics')
        .addUserOption(o => o.setName('agent').setDescription('Agent to inspect').setRequired(false)),

    // ══════════════════════════════════════════════════
    // PREFIX
    // ══════════════════════════════════════════════════
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        try {
            const guildId = message.guild?.id || 'DM';
            const guild   = message.guild;
            const lang    = client.detectLanguage ? client.detectLanguage(usedCommand || 'profile', guildId) : 'en';
            const version = client.version || '3.0.7';

            let target = message.author;
            if (args[0] && message.mentions?.users?.size > 0) target = message.mentions.users.first();
            else if (args[0] && guild) target = guild.members.cache.get(args[0])?.user || message.author;

            const embed = await buildProfile(target, client, db, guildId, guild, lang, version, false);
            if (!embed) {
                const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
                return message.reply({ content: t.noData(target.username) }).catch(() => {});
            }
            await message.reply({ embeds: [embed] }).catch(() => {});
        } catch (err) {
            console.error('[PROFILE] Error:', err);
            message.reply('⚠️ Neural link error. Contact the Architect.').catch(() => {});
        }
    },

    // ══════════════════════════════════════════════════
    // SLASH
    // ══════════════════════════════════════════════════
    execute: async (interaction, client) => {
        try {
            const guildId  = interaction.guild?.id || 'DM';
            const guild    = interaction.guild;
            const serverLang = client.getServerSettings?.(guildId)?.language;
            const lang     = serverLang === 'fr' ? 'fr' : serverLang === 'en' ? 'en' : (interaction.locale?.startsWith('fr') ? 'fr' : 'en');
            const version  = client.version || '3.0.7';
            const db       = client.db;
            const target   = interaction.options.getUser('agent') || interaction.user;

            await interaction.deferReply();

            const embed = await buildProfile(target, client, db, guildId, guild, lang, version, true);
            if (!embed) {
                const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
                return interaction.editReply({ content: t.noData(target.username) });
            }
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[PROFILE SLASH] Error:', err);
            interaction.editReply('⚠️ Neural link error.').catch(() => {});
        }
    }
};
