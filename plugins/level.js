const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const T = {
    en: { title: '📊 Level Progress', footer: 'Architect CG-223 • v{version}', progress: '🚀 Progress', xp: 'XP', level: 'Level', rank: 'Rank', messages: 'Messages', nextLevel: 'Next Level', xpNeeded: 'XP needed', totalXP: 'Total XP', notFound: '❌ No data found. Start chatting to earn XP!', },
    fr: { title: '📊 Progression de Niveau', footer: 'Architect CG-223 • v{version}', progress: '🚀 Progression', xp: 'XP', level: 'Niveau', rank: 'Rang', messages: 'Messages', nextLevel: 'Niveau Suivant', xpNeeded: 'XP requis', totalXP: 'XP Total', notFound: '❌ Aucune donnée trouvée. Commencez à discuter pour gagner de l\'XP !', }
};

function calcLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1; }
function xpForLevel(lvl) { return Math.pow((lvl - 1) / 0.1, 2); }
function bar(pct, len = 15) { const f = Math.round((pct / 100) * len); return '█'.repeat(Math.max(0, f)) + '░'.repeat(Math.max(0, len - f)); }

module.exports = {
    name: 'level', aliases: ['lvl', 'xp', 'progress', 'rank'],
    description: '📊 Check your level progress with XP bar and rank.',
    category: 'UTILITY', cooldown: 3000, usage: '.level [@user]', examples: ['.level', '.level @user', '/level user:@user'],
    data: new SlashCommandBuilder().setName('level').setDescription('📊 Check level progress').addUserOption(o => o.setName('user').setDescription('User to check (default: you)').setRequired(false)),
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang], guild = message.guild, guildId = guild?.id || 'DM';
        const target = message.mentions.users.first() || message.author;
        let userData = client.getUserData ? client.getUserData(target.id, guildId) : null;
        if (!userData && db) userData = db.prepare("SELECT xp, level, credits, total_messages FROM users WHERE id = ? AND guild_id = ?").get(target.id, guildId);
        if (!userData) return message.reply(t.notFound).catch(() => {});

        const xp = userData.xp || 0, level = userData.level || calcLevel(xp);
        const currentLvlXP = xpForLevel(level), nextLvlXP = xpForLevel(level + 1);
        const pct = nextLvlXP > currentLvlXP ? ((xp - currentLvlXP) / (nextLvlXP - currentLvlXP)) * 100 : 100;
        const remaining = Math.ceil(nextLvlXP - xp);
        let rank = 'N/A';
        if (db) { try { const r = db.prepare('SELECT COUNT(*) as rank FROM users WHERE xp > ? AND guild_id = ?').get(xp, guildId); rank = '#' + ((r?.rank || 0) + 1); } catch (e) {} }

        const embed = new EmbedBuilder().setColor('#00fbff').setAuthor({ name: `${t.title}: ${target.username}`, iconURL: target.displayAvatarURL() }).setThumbnail(target.displayAvatarURL({ size: 256 })).setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;33m${t.level}:\u001b[0m ${level}\n` +
            `\u001b[1;36m${t.xp}:\u001b[0m ${xp.toLocaleString()} / ${Math.ceil(nextLvlXP).toLocaleString()}\n` +
            `\u001b[1;35m${bar(Math.min(100, Math.max(0, pct)))}\u001b[0m \u001b[1;32m${pct.toFixed(1)}%\u001b[0m\n` +
            `\u001b[1;31m${t.xpNeeded}:\u001b[0m ${remaining.toLocaleString()}\n` +
            `\u001b[1;34m${t.rank}:\u001b[0m ${rank}\n` +
            `\u001b[1;37m${t.messages}:\u001b[0m ${(userData.total_messages || 0).toLocaleString()}\n` +
            `\`\`\``
        ).setFooter({ text: t.footer.replace('{version}', client.version || '2.0') }).setTimestamp();
        message.reply({ embeds: [embed] }).catch(() => {});
    },
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang], guildId = interaction.guild?.id || 'DM';
        const target = interaction.options.getUser('user') || interaction.user;
        await interaction.deferReply();
        let userData = client.getUserData ? client.getUserData(target.id, guildId) : null;
        if (!userData && client.db) userData = client.db.prepare("SELECT xp, level, credits, total_messages FROM users WHERE id = ? AND guild_id = ?").get(target.id, guildId);
        if (!userData) return interaction.editReply(t.notFound);

        const xp = userData.xp || 0, level = userData.level || calcLevel(xp);
        const currentLvlXP = xpForLevel(level), nextLvlXP = xpForLevel(level + 1);
        const pct = nextLvlXP > currentLvlXP ? ((xp - currentLvlXP) / (nextLvlXP - currentLvlXP)) * 100 : 100;
        const remaining = Math.ceil(nextLvlXP - xp);
        let rank = 'N/A';
        if (client.db) { try { const r = client.db.prepare('SELECT COUNT(*) as rank FROM users WHERE xp > ? AND guild_id = ?').get(xp, guildId); rank = '#' + ((r?.rank || 0) + 1); } catch (e) {} }

        const embed = new EmbedBuilder().setColor('#00fbff').setAuthor({ name: `${t.title}: ${target.username}`, iconURL: target.displayAvatarURL() }).setThumbnail(target.displayAvatarURL({ size: 256 })).setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;33m${t.level}:\u001b[0m ${level}\n` +
            `\u001b[1;36m${t.xp}:\u001b[0m ${xp.toLocaleString()} / ${Math.ceil(nextLvlXP).toLocaleString()}\n` +
            `\u001b[1;35m${bar(Math.min(100, Math.max(0, pct)))}\u001b[0m \u001b[1;32m${pct.toFixed(1)}%\u001b[0m\n` +
            `\u001b[1;31m${t.xpNeeded}:\u001b[0m ${remaining.toLocaleString()}\n` +
            `\u001b[1;34m${t.rank}:\u001b[0m ${rank}\n` +
            `\u001b[1;37m${t.messages}:\u001b[0m ${(userData.total_messages || 0).toLocaleString()}\n` +
            `\`\`\``
        ).setFooter({ text: t.footer.replace('{version}', client.version || '2.0') }).setTimestamp();
        interaction.editReply({ embeds: [embed] });
    }
};