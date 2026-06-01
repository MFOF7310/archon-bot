const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const T = {
    en: { title: '🧮 CALCULATOR', result: 'Result', expression: 'Expression', error: '❌ Invalid expression.', footer: 'Architect CG-223 • Calculator', modeSci: 'Scientific', modeBasic: 'Basic', usage: '`.calc 2+2` or `.calc sin(45)`', history: '📊 Recent Calculations' },
    fr: { title: '🧮 CALCULATRICE', result: 'Résultat', expression: 'Expression', error: '❌ Expression invalide.', footer: 'Architect CG-223 • Calculatrice', modeSci: 'Scientifique', modeBasic: 'Basique', usage: '`.calc 2+2` ou `.calc sin(45)`', history: '📊 Calculs Récents' }
};

function safeCalc(expr) {
    // Whitelist: only allow safe math characters
    const clean = expr.replace(/\s/g, '');
    if (!/^[0-9+\-*/().%^sincotalgdrpeE]+$/.test(clean)) throw new Error('Invalid characters');
    // Map scientific functions
    let js = clean
        .replace(/sin\(/g, 'Math.sin(').replace(/cos\(/g, 'Math.cos(').replace(/tan\(/g, 'Math.tan(')
        .replace(/asin\(/g, 'Math.asin(').replace(/acos\(/g, 'Math.acos(').replace(/atan\(/g, 'Math.atan(')
        .replace(/sqrt\(/g, 'Math.sqrt(').replace(/log\(/g, 'Math.log10(').replace(/ln\(/g, 'Math.log(')
        .replace(/abs\(/g, 'Math.abs(').replace(/round\(/g, 'Math.round(').replace(/floor\(/g, 'Math.floor(')
        .replace(/ceil\(/g, 'Math.ceil(').replace(/pow\(/g, 'Math.pow(').replace(/exp\(/g, 'Math.exp(')
        .replace(/pi/g, 'Math.PI').replace(/e(?![xp])/g, 'Math.E')
        .replace(/%/g, '/100')
        .replace(/\^/g, '**');
    const result = new Function('Math', `return (${js})`)(Math);
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) throw new Error('Invalid result');
    return Number.isInteger(result) ? result : parseFloat(result.toFixed(6));
}

const history = new Map(); // userId -> [{expr, result}]
const MAX_HISTORY = 5;

module.exports = {
    name: 'calc', aliases: ['calculate', 'math', 'calculator', 'c'],
    description: '🧮 Safe calculator with scientific functions and history.',
    category: 'UTILITY', cooldown: 2000, usage: '.calc <expression>', examples: ['.calc 2+2', '.calc sin(45)', '.calc sqrt(144)'],
    data: new SlashCommandBuilder().setName('calc').setDescription('🧮 Calculator').addStringOption(o => o.setName('expression').setDescription('Math expression').setRequired(true)),
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, 'en') : 'en';
        const t = T[lang], expr = args.join(' ');
        if (!expr) return message.reply(`❌ ${t.usage}`).catch(() => {});
        try {
            const result = safeCalc(expr);
            const userHist = history.get(message.author.id) || [];
            userHist.unshift({ expr, result: String(result) });
            if (userHist.length > MAX_HISTORY) userHist.pop();
            history.set(message.author.id, userHist);
            const embed = new EmbedBuilder().setColor('#00fbff').setTitle(t.title).addFields(
                { name: t.expression, value: `\`\`\`\n${expr}\n\`\`\``, inline: false },
                { name: t.result, value: `\`\`\`fix\n${result}\n\`\`\``, inline: false }
            ).setFooter({ text: t.footer }).setTimestamp();
            if (userHist.length > 1) embed.addFields({ name: t.history, value: userHist.slice(1).map(h => `• \`${h.expr}\` = \`${h.result}\``).join('\n'), inline: false });
            message.reply({ embeds: [embed] }).catch(() => {});
        } catch (e) { message.reply(t.error).catch(() => {}); }
    },
    execute: async (interaction) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang], expr = interaction.options.getString('expression');
        await interaction.deferReply();
        try {
            const result = safeCalc(expr);
            const userHist = history.get(interaction.user.id) || [];
            userHist.unshift({ expr, result: String(result) });
            if (userHist.length > MAX_HISTORY) userHist.pop();
            history.set(interaction.user.id, userHist);
            const embed = new EmbedBuilder().setColor('#00fbff').setTitle(t.title).addFields(
                { name: t.expression, value: `\`\`\`\n${expr}\n\`\`\``, inline: false },
                { name: t.result, value: `\`\`\`fix\n${result}\n\`\`\``, inline: false }
            ).setFooter({ text: t.footer }).setTimestamp();
            if (userHist.length > 1) embed.addFields({ name: t.history, value: userHist.slice(1).map(h => `• \`${h.expr}\` = \`${h.result}\``).join('\n'), inline: false });
            await interaction.editReply({ embeds: [embed] });
        } catch (e) { interaction.editReply(t.error); }
    }
};