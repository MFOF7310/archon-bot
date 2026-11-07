'use strict';
const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const https = require('https');

const T = {
    en: {
        loading: (word) => `\`[LEXICON]\`  **Initializing query for \`${word}\`**`,
        notFound: (word) => `**No lexical entry found.**\n> Target: \`${word}\`\n> Status: **NOT IN DATABASE**`,
        error: '> **LEXICON SERVICE UNAVAILABLE**\n> Check network integrity or retry.',
        footer: (word) => `ARCHON LEXICON // TARGET: "${word}"`,
        phonetic: 'Phonetic Transcription',
        meanings: 'Semantic Entries',
        audio: 'Phonetic Audio',
        multipleMeanings: (count) => `Displaying ${count} semantic entries`,
        operator: 'Operator'
    },
    fr: {
        loading: (word) => `\`[LEXIQUE]\`  **Initialisation de la requête pour \`${word}\`**`,
        notFound: (word) => `**Aucune entrée lexicale trouvée.**\n> Cible : \`${word}\`\n> Statut : **NON RÉPERTORIÉ**`,
        error: '> **SERVICE LEXIQUE INDISPONIBLE**\n> Vérifiez l\'intégrité du réseau ou réessayez.',
        footer: (word) => `ARCHON LEXIQUE // CIBLE : "${word}"`,
        phonetic: 'Transcription Phonétique',
        meanings: 'Entrées Sémantiques',
        audio: 'Audio Phonétique',
        multipleMeanings: (count) => `Affichage de ${count} entrées sémantiques`,
        operator: 'Opérateur'
    },
    cn: {
        loading: (word) => `\`[词库]\`  **正在初始化查询 \`${word}\`**`,
        notFound: (word) => `**未找到词汇条目。**\n> 目标：\`${word}\`\n> 状态：**未收录**`,
        error: '> **词库服务不可用**\n> 请检查网络完整性或重试。',
        footer: (word) => `ARCHON 词库 // 目标："${word}"`,
        phonetic: '音标转录',
        meanings: '语义条目',
        audio: '语音音频',
        multipleMeanings: (count) => `显示 ${count} 条语义条目`,
        operator: '操作员'
    }
};

const PALETTE = {
    primary: 0x1a1a2e,
    accent: 0xe94560,
    cyan: 0x00d9ff,
    warning: 0xfdcb6e,
};

function fetchDict(word) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
            { timeout: 10000 },
            (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode === 404) return resolve([]);
                        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
                        resolve(JSON.parse(data));
                    } catch (e) { reject(e); }
                });
            }
        );
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

function getLang(client, interactionOrMessage, usedPrefix, overrideLang) {
    if (overrideLang && T[overrideLang]) return overrideLang;
    if (interactionOrMessage?.locale) {
        const loc = interactionOrMessage.locale.toLowerCase();
        if (loc.startsWith('fr')) return 'fr';
        if (loc.startsWith('zh') || loc.startsWith('cn')) return 'cn';
        return 'en';
    }
    if (interactionOrMessage?.guild?.preferredLocale) {
        const guildLoc = interactionOrMessage.guild.preferredLocale.toLowerCase();
        if (guildLoc.startsWith('fr')) return 'fr';
        if (guildLoc.startsWith('zh') || guildLoc.startsWith('cn')) return 'cn';
    }
    if (client?.detectLanguage) {
        try {
            const detected = client.detectLanguage(usedPrefix, 'en');
            if (detected === 'fr') return 'fr';
            if (detected === 'cn' || detected === 'zh') return 'cn';
        } catch (e) { /* fallback */ }
    }
    return 'en';
}

function buildIntelligenceCard(entry, t, word, timestamp) {
    const c = new ContainerBuilder().setAccentColor(PALETTE.primary);
    const audioUrl = entry.phonetics?.find(p => p.audio)?.audio;
    const phoneticTxt = entry.phonetic ? `\` ${entry.phonetic} \`` : '\` N/A \`';

    let header = `## ${em('note', '📖')} ${entry.word.toUpperCase()}\n**${t.phonetic}:** ${phoneticTxt}`;
    if (audioUrl) header += `  •  [${em('mc_volume_up', '🔊')} ${t.audio || 'Play'}](${audioUrl})`;
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));

    const meanings = entry.meanings?.slice(0, 4) || [];

    if (meanings.length > 0) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${em('ic_general', '📚')} ${t.meanings} [${meanings.length}]\n*${t.multipleMeanings(meanings.length)}*`));

        meanings.forEach((meaning, idx) => {
            const defs = meaning.definitions?.slice(0, 2) || [];
            if (defs.length === 0) return;

            let fieldValue = `**${meaning.partOfSpeech ? meaning.partOfSpeech.toUpperCase() : 'DEFINITION'}**\n`;
            defs.forEach((def) => {
                fieldValue += `${em('dot_white', '•')} ${def.definition}\n`;
                if (def.example) fieldValue += `> *"${def.example}"*\n`;
                if (def.synonyms?.length > 0) fieldValue += `> \`SYN:\`  ${def.synonyms.slice(0, 3).join(' · ')}\n`;
                fieldValue += '\n';
            });
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(fieldValue.trim()));
        });
    }

    const queryTime = ((Date.now() - timestamp.getTime()) / 1000).toFixed(2);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t.footer(word)}  |  Free Dictionary API  |  ⏱️ ${queryTime}s`));

    return c;
}

module.exports = {
    name: 'define',
    description: '📖 Intelligence dictionary lookup — English definitions with trilingual UI',
    category: 'UTILITY',
    data: new SlashCommandBuilder()
        .setName('define')
        .setDescription('📖 Intelligence dictionary lookup')
        .addStringOption(o => o.setName('word').setDescription('Target lexical entry to query').setRequired(true))
        .addStringOption(o => o.setName('language').setDescription('Interface language (overrides auto-detect)').addChoices({ name: 'English', value: 'en' }, { name: 'Français', value: 'fr' }, { name: '中文', value: 'cn' })),

    run: async (client, message, args, db, ss, used) => {
        const lang = getLang(client, message, used);
        const t = T[lang];
        const word = args.join(' ').trim();

        if (!word) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(PALETTE.warning)
                    .setTitle('\`[ ERROR ]\`')
                    .setDescription('**' + t.operator + '** — Provide a target lexical entry.\n> Usage: \`.define <word>\`')
                    .setFooter({ text: `ARCHON Lexicon  |  Free Dictionary API` })
                ]
            }).catch(() => {});
        }

        const loadingEmbed = new EmbedBuilder()
            .setColor(PALETTE.cyan)
            .setTitle('\`[ PENDING ]\`')
            .setDescription(t.loading(word))
            .setFooter({ text: `${t.footer(word)}  |  QUERY IN PROGRESS  |  Free Dictionary API` });

        const msg = await message.reply({ embeds: [loadingEmbed] }).catch(() => null);
        const startTime = Date.now();

        try {
            const data = await fetchDict(word);
            if (!Array.isArray(data) || data.length === 0) {
                const notFoundEmbed = new EmbedBuilder()
                    .setColor(PALETTE.accent)
                    .setTitle('\`[ NOT FOUND ]\`')
                    .setDescription(t.notFound(word))
                    .setFooter({ text: `${t.footer(word)}  |  Free Dictionary API` })
                    .setTimestamp();
                return msg?.edit({ embeds: [notFoundEmbed], content: null }).catch(() => {});
            }

            const entry = data[0];
            const card = buildIntelligenceCard(entry, t, word, new Date(startTime));
            msg?.edit({ content: null, components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});

        } catch (e) {
            const errorEmbed = new EmbedBuilder()
                .setColor(PALETTE.accent)
                .setTitle('\`[ SYSTEM FAILURE ]\`')
                .setDescription(t.error + `\n\n\`[DEBUG]\`  ${e.message?.substring(0, 100) || 'Unknown'}`)
                .setFooter({ text: `${t.footer(word)}  |  Free Dictionary API` })
                .setTimestamp();
            msg?.edit({ content: null, embeds: [errorEmbed] }).catch(() => {});
        }
    },

    execute: async (interaction) => {
        const overrideLang = interaction.options.getString('language');
        const lang = getLang(null, interaction, null, overrideLang);
        const t = T[lang];
        const word = interaction.options.getString('word').trim();
        const startTime = Date.now();

        await interaction.deferReply();

        try {
            const data = await fetchDict(word);
            if (!Array.isArray(data) || data.length === 0) {
                const notFoundEmbed = new EmbedBuilder()
                    .setColor(PALETTE.accent)
                    .setTitle('\`[ NOT FOUND ]\`')
                    .setDescription(t.notFound(word))
                    .setFooter({ text: `${t.footer(word)}  |  Free Dictionary API` })
                    .setTimestamp();
                return interaction.editReply({ embeds: [notFoundEmbed] });
            }

            const entry = data[0];
            const card = buildIntelligenceCard(entry, t, word, new Date(startTime));
            interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

        } catch (e) {
            const errorEmbed = new EmbedBuilder()
                .setColor(PALETTE.accent)
                .setTitle('\`[ SYSTEM FAILURE ]\`')
                .setDescription(t.error + `\n\n\`[DEBUG]\`  ${e.message?.substring(0, 100) || 'Unknown'}`)
                .setFooter({ text: `${t.footer(word)}  |  Free Dictionary API` })
                .setTimestamp();
            interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
