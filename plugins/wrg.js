const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// ═══════════════════════════════════════════════════════
//  🎮 ARCHON WRG v3.0 — NEURAL GRID WORD COMBAT
//  5 tiers · Speed bonus · Streak multiplier · Hint system
// ═══════════════════════════════════════════════════════

// ── Level calculation ──
function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp)) + 1; }

// ── Rank titles ──
const AGENT_RANKS = [
    { minLevel: 1,  maxLevel: 5,        title: { fr: "RECRUE NEURALE",    en: "NEURAL RECRUIT"    }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6,  maxLevel: 15,       title: { fr: "AGENT DE TERRAIN",  en: "FIELD AGENT"       }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30,       title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST"  }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50,       title: { fr: "COMMANDANT BKO",    en: "BKO COMMANDER"     }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME","en": "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];
function getRank(level) { return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length-1]; }
function progressBar(pct, len=15) { const f=Math.round((pct/100)*len); return '█'.repeat(Math.max(0,f))+'░'.repeat(Math.max(0,len-f)); }

// ── Word sanitization ──
function sanitize(word) { return word.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z]/g,''); }
function shuffle(word) {
    let arr = word.split('');
    for (let i=arr.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    // Ensure not same as original
    if (arr.join('')===word && word.length>1) { [arr[0],arr[1]]=[arr[1],arr[0]]; }
    return arr.join('');
}

// ── Hint: reveal one letter ──
function buildHint(word) {
    const idx = Math.floor(Math.random() * word.length);
    return word.split('').map((c,i) => i===idx ? c : '_').join(' ');
}

// ═══════════════════════════════════════════════════════
//  WORD DATABASE — 5 TIERS
// ═══════════════════════════════════════════════════════
const TIERS = {
    rookie: {
        label: { en: '⚪ ROOKIE',     fr: '⚪ RECRUE'    },
        color: '#95a5a6', ansiColor: '\u001b[0;37m', emoji: '⚪',
        xpBase: 15,  xpBonus: 0,   creditBase: 3,  creditBonus: 0,
        timeLimit: 20000,
        speedWindow: 5000,
        words: {
            en: ['CAT','DOG','SUN','MOON','STAR','FISH','BIRD','TREE','CAR','BOOK','BALL','CAKE','LAKE','RAIN','FIRE'],
            fr: ['CHAT','CHIEN','SOLEIL','LUNE','ETOILE','POISSON','OISEAU','ARBRE','VOITURE','LIVRE','BALLE','GATEAU','LAC','PLUIE','FEU']
        },
        hint: { en: '✨ Simple everyday word (3-5 letters)', fr: '✨ Mot simple du quotidien (3-5 lettres)' }
    },
    agent: {
        label: { en: '🔵 AGENT',      fr: '🔵 AGENT'     },
        color: '#3498db', ansiColor: '\u001b[1;34m', emoji: '🔵',
        xpBase: 25,  xpBonus: 20,  creditBase: 5,  creditBonus: 10,
        timeLimit: 30000,
        speedWindow: 6000,
        words: {
            en: ['GAMING','LAPTOP','KEYBOARD','MONITOR','ROCKET','PLANET','GARDEN','CAMERA','JUNGLE','CASTLE','BRIDGE','MARKET'],
            fr: ['CLAVIER','ECRAN','FUSEE','PLANETE','JARDIN','CAMERA','JUNGLE','CHATEAU','PONT','MARCHE','ORDINATEUR','TABLETTE']
        },
        hint: { en: '💡 Everyday object or place', fr: '💡 Objet ou lieu du quotidien' }
    },
    elite: {
        label: { en: '🟠 ELITE',      fr: '🟠 ELITE'     },
        color: '#e67e22', ansiColor: '\u001b[1;33m', emoji: '🟠',
        xpBase: 40,  xpBonus: 50,  creditBase: 8,  creditBonus: 25,
        timeLimit: 40000,
        speedWindow: 7000,
        words: {
            en: ['ALGORITHM','DATABASE','FIREWALL','PROCESSOR','SOFTWARE','NETWORK','PROTOCOL','TERMINAL','COMPILER','DEBUGGER'],
            fr: ['ALGORITHME','PAREFEU','PROCESSEUR','LOGICIEL','RESEAU','PROTOCOLE','TERMINAL','COMPILATEUR','DEBOGUEUR','CHIFFREMENT']
        },
        hint: { en: '🧠 Technical / computer science term', fr: '🧠 Terme technique / informatique' }
    },
    commander: {
        label: { en: '🔴 COMMANDER', fr: '🔴 COMMANDANT' },
        color: '#e74c3c', ansiColor: '\u001b[1;31m', emoji: '🔴',
        xpBase: 60,  xpBonus: 100, creditBase: 12, creditBonus: 50,
        timeLimit: 50000,
        speedWindow: 8000,
        words: {
            en: ['TECHNOLOGY','SPECTACULAR','MAGNIFICENT','KNOWLEDGE','EXTRAORDINARY','REVOLUTIONARY','INTELLIGENCE','INFRASTRUCTURE','CYBERSECURITY'],
            fr: ['TECHNOLOGIE','SPECTACULAIRE','MAGNIFIQUE','CONNAISSANCE','EXTRAORDINAIRE','REVOLUTIONNAIRE','INTELLIGENCE','INFRASTRUCTURE','CYBERSECURITE']
        },
        hint: { en: '🏆 Advanced vocabulary — think big!', fr: '🏆 Vocabulaire avancé — pensez grand !' }
    },
    architect: {
        label: { en: '👑 ARCHITECT',  fr: '👑 ARCHITECTE' },
        color: '#f1c40f', ansiColor: '\u001b[1;33m', emoji: '👑',
        xpBase: 100, xpBonus: 200, creditBase: 20, creditBonus: 100,
        timeLimit: 60000,
        speedWindow: 10000,
        words: {
            en: ['DECENTRALIZATION','CRYPTOGRAPHY','MICROPROCESSOR','VIRTUALIZATION','AUTHENTICATION','TELECOMMUNICATIONS','SUPERINTELLIGENCE','ELECTROMAGNETIC'],
            fr: ['DECENTRALISATION','CRYPTOGRAPHIE','MICROPROCESSEUR','VIRTUALISATION','AUTHENTIFICATION','TELECOMMUNICATION','SUPERINTELLIGENCE','ELECTROMAGNETIQUE']
        },
        hint: { en: '💀 ARCHITECT level — ultra rare vocabulary', fr: '💀 Niveau ARCHITECTE — vocabulaire ultra rare' }
    }
};

// ── Streak storage (per guild+user, in memory) ──
const streaks = new Map();
function getStreak(userId, guildId) { return streaks.get(`${userId}:${guildId}`) || 0; }
function incStreak(userId, guildId) { const k=`${userId}:${guildId}`; streaks.set(k, (streaks.get(k)||0)+1); return streaks.get(k); }
function resetStreak(userId, guildId) { streaks.delete(`${userId}:${guildId}`); }

// ── XP calculation with speed + streak bonus ──
function calcRewards(tier, wordLen, solveTimeMs, streakCount) {
    const base = tier.xpBase + (wordLen * 10) + tier.xpBonus;
    const credits = tier.creditBase + (wordLen * 2) + tier.creditBonus;

    let speedMult = 1;
    let speedLabel = '';
    if (solveTimeMs <= tier.speedWindow) {
        speedMult = 2;
        speedLabel = '⚡ SPEED BONUS x2!';
    } else if (solveTimeMs <= tier.speedWindow * 2) {
        speedMult = 1.5;
        speedLabel = '🔥 QUICK x1.5!';
    }

    let streakMult = 1;
    let streakLabel = '';
    if (streakCount >= 5) { streakMult = 2; streakLabel = '🌟 STREAK x2 (5+)!'; }
    else if (streakCount >= 3) { streakMult = 1.5; streakLabel = '🔥 STREAK x1.5 (3+)!'; }

    const finalXP = Math.round(base * speedMult * streakMult);
    const finalCredits = Math.round(credits * speedMult * streakMult);
    return { xp: finalXP, credits: finalCredits, speedLabel, streakLabel, speedMult, streakMult };
}

// ═══════════════════════════════════════════════════════
//  CORE GAME RUNNER
// ═══════════════════════════════════════════════════════
async function runGame(client, message, args, db, lang) {
    try {
        // ── Tier selection ──
        const tierMap = {
            rookie:['rookie','recrue','easy','facile','r'],
            agent:['agent','medium','moyen','a'],
            elite:['elite','hard','difficile','e'],
            commander:['commander','commandant','expert','c'],
            architect:['architect','architecte','legend','legendary','god','x']
        };
        let tierKey = 'rookie';
        if (args[0]) {
            const a = args[0].toLowerCase();
            for (const [k, aliases] of Object.entries(tierMap)) {
                if (aliases.includes(a)) { tierKey = k; break; }
            }
        }

        const tier = TIERS[tierKey];
        const wordPool = tier.words[lang] || tier.words.en;
        const rawWord = wordPool[Math.floor(Math.random() * wordPool.length)];
        const targetWord = sanitize(rawWord);
        let scrambled = shuffle(targetWord);
        while (scrambled === targetWord && targetWord.length > 2) scrambled = shuffle(targetWord);

        const guildId = message.guild?.id || 'DM';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const streakCount = getStreak(message.author.id, guildId);

        // ── User stats ──
        let userStats = db.prepare("SELECT xp, credits, level, games_played, games_won FROM users WHERE id = ? AND guild_id = ?").get(message.author.id, guildId);
        if (!userStats) {
            db.prepare("INSERT OR IGNORE INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, 0)").run(message.author.id, guildId, message.author.username);
            userStats = { xp: 0, credits: 0, level: 1, games_played: 0, games_won: 0 };
        }
        const currentLevel = userStats.level || calculateLevel(userStats.xp || 0);
        const currentRank = getRank(currentLevel);
        const xpNeeded = Math.pow(currentLevel / 0.1, 2) - Math.pow((currentLevel-1) / 0.1, 2);
        const xpProgress = (userStats.xp || 0) - Math.pow((currentLevel-1) / 0.1, 2);
        const pct = xpNeeded > 0 ? Math.min(100, Math.max(0, (xpProgress/xpNeeded)*100)) : 100;

        // ── Estimate rewards ──
        const estRewards = calcRewards(tier, targetWord.length, 9999999, streakCount);

        // ── Start embed ──
        const startEmbed = new EmbedBuilder()
            .setColor(tier.color)
            .setAuthor({ name: `🎮 ARCHON WORD COMBAT — ${tier.label[lang]}`, iconURL: client.user.displayAvatarURL() })
            .setDescription(
                `\`\`\`ansi\n` +
                `${tier.ansiColor}╔══════════════════════════════════╗\u001b[0m\n` +
                `${tier.ansiColor}║  TIER    \u001b[0m ${tier.emoji} ${tierKey.toUpperCase().padEnd(22)}${tier.ansiColor}║\u001b[0m\n` +
                `${tier.ansiColor}║  WORD    \u001b[0m \u001b[1;37m${'█'.repeat(targetWord.length).padEnd(24)}\u001b[0m${tier.ansiColor}║\u001b[0m\n` +
                `${tier.ansiColor}║  LETTERS \u001b[0m \u001b[1;36m${String(targetWord.length).padEnd(24)}\u001b[0m${tier.ansiColor}║\u001b[0m\n` +
                `${tier.ansiColor}║  TIME    \u001b[0m \u001b[1;33m${String(tier.timeLimit/1000)+'s'}\u001b[0m\n` +
                `${tier.ansiColor}╚══════════════════════════════════╝\u001b[0m\n` +
                `\`\`\`` +
                `\n## ${tier.emoji}  \`${scrambled}\`\n` +
                `*${tier.hint[lang]}*`
            )
            .addFields(
                { name: '💰 Base Rewards', value: `\`+${estRewards.xp} XP\` · \`+${estRewards.credits} 🪙\``, inline: true },
                { name: '⚡ Speed Bonus', value: `Solve in **${tier.speedWindow/1000}s** → **2x XP**`, inline: true },
                { name: streakCount > 0 ? `🔥 Streak: ${streakCount}` : '🔥 Streak', value: streakCount >= 3 ? `**${streakCount} wins!** Multiplier active!` : `Win more for multiplier!`, inline: true },
                { name: `${currentRank.emoji} ${lang==='fr'?'Rang':'Rank'}`, value: `${currentRank.title[lang]} · Lv.${currentLevel}`, inline: true },
                { name: '📊 Progress', value: `\`${progressBar(pct, 12)}\` ${pct.toFixed(0)}%`, inline: true },
                { name: '💡 How to play', value: lang==='fr'?'Tapez votre réponse dans le chat !':'Type your answer in chat!', inline: true }
            )
            .setFooter({ text: `${guildName} · NEURAL WRG v3.0 · BAMAKO_223 🇲🇱` })
            .setTimestamp();

        await message.channel.send({ embeds: [startEmbed] });

        const gameStart = Date.now();
        let winnerDeclared = false;
        let hintSent = false;

        // ── Hint timer (half time) ──
        const hintTimer = setTimeout(async () => {
            if (!winnerDeclared) {
                hintSent = true;
                const hintStr = buildHint(targetWord);
                const hintEmbed = new EmbedBuilder()
                    .setColor('#00f0ff')
                    .setDescription(
                        `\`\`\`ansi\n\u001b[1;36m▸ HINT UNLOCKED\u001b[0m\n` +
                        `\u001b[1;37m${hintStr}\u001b[0m\n\`\`\`` +
                        `\n*${tier.emoji} Still scrambled: \`${scrambled}\`*`
                    )
                    .setFooter({ text: `${tier.timeLimit/2000}s elapsed · Hint revealed` });
                await message.channel.send({ embeds: [hintEmbed] }).catch(() => {});
            }
        }, tier.timeLimit / 2);

        // ── Collector ──
        const collector = message.channel.createMessageCollector({
            filter: m => !m.author.bot,
            time: tier.timeLimit
        });

        collector.on('collect', async (m) => {
            if (winnerDeclared) return;
            const guess = sanitize(m.content);
            if (guess !== targetWord) return;

            winnerDeclared = true;
            clearTimeout(hintTimer);
            collector.stop('winner');

            const solveTime = Date.now() - gameStart;
            const newStreak = incStreak(m.author.id, guildId);
            const rewards = calcRewards(tier, targetWord.length, solveTime, newStreak);

            // ── Update DB ──
            const winnerData = db.prepare("SELECT xp, credits, level, games_played, games_won FROM users WHERE id = ? AND guild_id = ?").get(m.author.id, guildId);
            const oldXP = winnerData?.xp || 0;
            const newXP = oldXP + rewards.xp;
            const newLevel = calculateLevel(newXP);
            const oldLevel = winnerData?.level || calculateLevel(oldXP);

            if (client.queueUserUpdate) {
                client.queueUserUpdate(m.author.id, guildId, {
                    ...winnerData, xp: newXP, level: newLevel,
                    credits: (winnerData?.credits||0) + rewards.credits,
                    games_played: (winnerData?.games_played||0)+1,
                    games_won: (winnerData?.games_won||0)+1,
                    username: m.author.username
                });
            } else {
                db.prepare(`UPDATE users SET xp=xp+?, credits=credits+?, level=?, games_played=COALESCE(games_played,0)+1, games_won=COALESCE(games_won,0)+1 WHERE id=? AND guild_id=?`)
                    .run(rewards.xp, rewards.credits, newLevel, m.author.id, guildId);
            }

            const finalRank = getRank(newLevel);
            const newXpNeeded = Math.pow(newLevel/0.1,2) - Math.pow((newLevel-1)/0.1,2);
            const newXpProgress = newXP - Math.pow((newLevel-1)/0.1,2);
            const newPct = newXpNeeded > 0 ? Math.min(100, Math.max(0,(newXpProgress/newXpNeeded)*100)) : 100;
            const solveSeconds = (solveTime/1000).toFixed(1);

            // ── Win embed ──
            let bonusLines = '';
            if (rewards.speedLabel) bonusLines += `\u001b[1;33m⚡ ${rewards.speedLabel}\u001b[0m\n`;
            if (rewards.streakLabel) bonusLines += `\u001b[1;35m${rewards.streakLabel}\u001b[0m\n`;

            const winEmbed = new EmbedBuilder()
                .setColor('#00ff88')
                .setAuthor({ name: `🏆 NEURAL GRID — CODE CRACKED!`, iconURL: m.author.displayAvatarURL() })
                .setDescription(
                    `\`\`\`ansi\n` +
                    `\u001b[1;32m╔══════════════════════════════════╗\u001b[0m\n` +
                    `\u001b[1;32m║  ✅ CORRECT — ${targetWord.padEnd(19)}\u001b[1;32m║\u001b[0m\n` +
                    `\u001b[1;32m║  ⏱  Solved in ${String(solveSeconds+'s').padEnd(18)}\u001b[1;32m║\u001b[0m\n` +
                    `\u001b[1;32m║  🔥 Streak   ${String(newStreak+' wins').padEnd(19)}\u001b[1;32m║\u001b[0m\n` +
                    `\u001b[1;32m╚══════════════════════════════════╝\u001b[0m\n` +
                    (bonusLines ? bonusLines : '') +
                    `\u001b[1;36m+${rewards.xp} XP\u001b[0m  \u001b[1;33m+${rewards.credits} 🪙\u001b[0m\n` +
                    `\`\`\``
                )
                .addFields(
                    { name: '📊 Progress', value: `\`${progressBar(newPct,15)}\` ${newPct.toFixed(1)}%\n└ ${Math.ceil(newXpNeeded-newXpProgress).toLocaleString()} XP to next level`, inline: false },
                    { name: `${finalRank.emoji} Rank`, value: `${finalRank.title[lang]} · Lv.${newLevel}`, inline: true },
                    { name: '💎 Credits', value: `\`${((winnerData?.credits||0)+rewards.credits).toLocaleString()} 🪙\``, inline: true },
                    { name: '🎮 Tier', value: `${tier.emoji} ${tierKey.toUpperCase()}`, inline: true }
                )
                .setFooter({ text: `${guildName} · NEURAL WRG v3.0 · BAMAKO_223 🇲🇱` })
                .setTimestamp();

            await message.channel.send({ embeds: [winEmbed] });

            // ── Level up ──
            if (newLevel > oldLevel) {
                const lvlEmbed = new EmbedBuilder()
                    .setColor(finalRank.color)
                    .setDescription(
                        `\`\`\`ansi\n` +
                        `\u001b[1;33m╔══════════════════════════════════╗\u001b[0m\n` +
                        `\u001b[1;33m║        🎉 LEVEL UP!              ║\u001b[0m\n` +
                        `\u001b[1;33m║  ${m.author.username.substring(0,18).padEnd(18)} → Lv.${String(newLevel).padEnd(6)}\u001b[1;33m║\u001b[0m\n` +
                        `\u001b[1;33m║  ${finalRank.emoji} ${finalRank.title[lang].substring(0,26).padEnd(26)}\u001b[1;33m║\u001b[0m\n` +
                        `\u001b[1;33m╚══════════════════════════════════╝\u001b[0m\n` +
                        `\`\`\``
                    )
                    .setFooter({ text: `ARCHON CG-223 · BAMAKO_223 🇲🇱` });
                await message.channel.send({ embeds: [lvlEmbed] });
            }

            // ── Duelist role ──
            if (message.guild) {
                try {
                    const settings = client.getServerSettings?.(message.guild.id);
                    const roleId = settings?.duelistRoleId || process.env.DUELIST_ROLE_ID;
                    if (roleId) {
                        const member = await message.guild.members.fetch(m.author.id).catch(()=>null);
                        if (member) {
                            const role = message.guild.roles.cache.get(roleId);
                            if (role && !member.roles.cache.has(roleId)) await member.roles.add(role,'⚔️ WRG champion').catch(()=>{});
                        }
                    }
                } catch(e) {}
            }
        });

        collector.on('end', (_, reason) => {
            clearTimeout(hintTimer);
            if (!winnerDeclared && reason !== 'winner') {
                resetStreak(message.author.id, guildId);
                const failEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setDescription(
                        `\`\`\`ansi\n` +
                        `\u001b[1;31m╔══════════════════════════════════╗\u001b[0m\n` +
                        `\u001b[1;31m║  ⏰ TIME\'S UP!                   ║\u001b[0m\n` +
                        `\u001b[1;31m║  The word was: ${targetWord.padEnd(18)}\u001b[1;31m║\u001b[0m\n` +
                        `\u001b[1;31m║  Scrambled:   ${scrambled.padEnd(18)}\u001b[1;31m║\u001b[0m\n` +
                        `\u001b[1;31m╚══════════════════════════════════╝\u001b[0m\n` +
                        `\u001b[0;37mStreak reset. Try \`.wrg rookie\` to warm up!\u001b[0m\n` +
                        `\`\`\``
                    )
                    .setFooter({ text: `${guildName} · NEURAL WRG v3.0 · BAMAKO_223 🇲🇱` });
                message.channel.send({ embeds: [failEmbed] }).catch(()=>{});
            }
        });

        console.log(`[WRG v3] ${message.author.tag} | Tier: ${tierKey} | Word: ${targetWord} | Streak: ${streakCount}`);

    } catch(err) {
        console.error('[WRG v3] Fatal:', err.message);
        message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setTitle('❌ GAME ERROR').setDescription('An error occurred. Please try again.').setFooter({ text: 'ARCHON CG-223' })] }).catch(()=>{});
    }
}

// ═══════════════════════════════════════════════════════
//  MODULE EXPORT
// ═══════════════════════════════════════════════════════
module.exports = {
    name: 'wrg',
    aliases: ['wordguess','guess','scramble','devine','mot','word','wrd'],
    description: '🎮 Neural Grid Word Combat — 5 tiers, speed bonus, streak multiplier!',
    category: 'GAMING',
    usage: '.wrg [rookie|agent|elite|commander|architect]',
    cooldown: 3000,
    examples: ['.wrg','.wrg rookie','.wrg elite','.wrg architect'],

    data: new SlashCommandBuilder()
        .setName('wrg')
        .setDescription('🎮 Neural Grid Word Combat — 5 tiers, speed bonus, streaks!')
        .addStringOption(opt => opt
            .setName('tier')
            .setDescription('Combat tier / Niveau de combat')
            .setRequired(false)
            .addChoices(
                { name: '⚪ Rookie  — Easy words, low stakes',         value: 'rookie'     },
                { name: '🔵 Agent  — Everyday objects & places',       value: 'agent'      },
                { name: '🟠 Elite  — Technical & cyber terms',         value: 'elite'      },
                { name: '🔴 Commander — Advanced vocabulary',          value: 'commander'  },
                { name: '👑 Architect — LEGENDARY difficulty',         value: 'architect'  }
            )),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        await runGame(client, message, args, db, lang);
    },

    execute: async (interaction, client) => {
        const tier = interaction.options.getString('tier') || 'rookie';
        await interaction.deferReply();
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (opts) => interaction.editReply(opts),
            react: () => Promise.resolve()
        };
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        await runGame(client, fakeMessage, [tier], client.db, lang);
    }
};
