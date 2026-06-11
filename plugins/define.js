const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const https = require('https');

// ═══════════════════════════════════════════════════════════
//  ARCHON CG-223 — INTELLIGENCE TERMINAL: LEXICON MODULE
//  Trilingual Dictionary System | EN · FR · CN
//  Classification: UNRESTRICTED — Field Operations Ready
// ═══════════════════════════════════════════════════════════

const T = {
    en: {
        loading: (word) => `\`[LEXICON]\`  **Initializing query for \`${word}\`**`,
        notFound: (word) => `**No lexical entry found.**\n> Target: \`${word}\`\n> Status: **NOT IN DATABASE**`,
        error: '> **LEXICON SERVICE UNAVAILABLE**\n> Check network integrity or retry.',
        footer: (word) => `ARCHON LEXICON // TARGET: "${word}"`,
        source: 'Data Source',
        phonetic: 'Phonetic Transcription',
        partOfSpeech: 'Grammatical Class',
        definition: 'Semantic Definition',
        example: 'Contextual Usage',
        synonyms: 'Lexical Synonyms',
        antonyms: 'Lexical Antonyms',
        etymology: 'Etymological Origin',
        meanings: 'Semantic Entries',
        audio: 'Phonetic Audio',
        noAudio: 'No audio sample available',
        multipleMeanings: (count) => `Displaying ${count} semantic entries`,
        origin: 'Origin',
        license: 'License',
        queryTime: 'Query Time',
        classification: 'UNCLASSIFIED',
        operator: 'Operator',
        terminal: 'Terminal ID',
        status: 'Status',
        active: 'ONLINE',
        wordForms: 'Inflections',
        none: 'None recorded'
    },
    fr: {
        loading: (word) => `\`[LEXIQUE]\`  **Initialisation de la requête pour \`${word}\`**`,
        notFound: (word) => `**Aucune entrée lexicale trouvée.**\n> Cible : \`${word}\`\n> Statut : **NON RÉPERTORIÉ**`,
        error: '> **SERVICE LEXIQUE INDISPONIBLE**\n> Vérifiez l\'intégrité du réseau ou réessayez.',
        footer: (word) => `ARCHON LEXIQUE // CIBLE : "${word}"`,
        source: 'Source de Données',
        phonetic: 'Transcription Phonétique',
        partOfSpeech: 'Classe Grammaticale',
        definition: 'Définition Sémantique',
        example: 'Usage Contextuel',
        synonyms: 'Synonymes Lexicaux',
        antonyms: 'Antonymes Lexicaux',
        etymology: 'Origine Étymologique',
        meanings: 'Entrées Sémantiques',
        audio: 'Audio Phonétique',
        noAudio: 'Aucun échantillon audio disponible',
        multipleMeanings: (count) => `Affichage de ${count} entrées sémantiques`,
        origin: 'Origine',
        license: 'Licence',
        queryTime: 'Heure de Requête',
        classification: 'NON CLASSIFIÉ',
        operator: 'Opérateur',
        terminal: 'ID Terminal',
        status: 'Statut',
        active: 'EN LIGNE',
        wordForms: 'Déclinaisons',
        none: 'Aucun enregistrement'
    },
    cn: {
        loading: (word) => `\`[词库]\`  **正在初始化查询 \`${word}\`**`,
        notFound: (word) => `**未找到词汇条目。**\n> 目标：\`${word}\`\n> 状态：**未收录**`,
        error: '> **词库服务不可用**\n> 请检查网络完整性或重试。',
        footer: (word) => `ARCHON 词库 // 目标："${word}"`,
        source: '数据来源',
        phonetic: '音标转录',
        partOfSpeech: '词性分类',
        definition: '语义定义',
        example: '语境用法',
        synonyms: '同义词',
        antonyms: '反义词',
        etymology: '词源学起源',
        meanings: '语义条目',
        audio: '语音音频',
        noAudio: '无可用音频样本',
        multipleMeanings: (count) => `显示 ${count} 条语义条目`,
        origin: '起源',
        license: '许可协议',
        queryTime: '查询时间',
        classification: '未分类',
        operator: '操作员',
        terminal: '终端编号',
        status: '状态',
        active: '在线',
        wordForms: '词形变化',
        none: '无记录'
    }
};

// Color palette — Intelligence Terminal Theme
const PALETTE = {
    primary: 0x1a1a2e,      // Deep navy
    secondary: 0x16213e,    // Dark slate
    accent: 0xe94560,       // Alert red / Archon brand
    gold: 0xf5a623,         // Intelligence gold
    cyan: 0x00d9ff,         // Terminal cyan
    success: 0x00b894,      // Operational green
    warning: 0xfdcb6e,      // Caution amber
    text: 0xdfe6e9,         // Terminal white
    muted: 0x636e72         // Declassified gray
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
    // Priority 1: Explicit override from slash command option
    if (overrideLang && T[overrideLang]) return overrideLang;

    // Priority 2: Discord locale for slash commands
    if (interactionOrMessage?.locale) {
        const loc = interactionOrMessage.locale.toLowerCase();
        if (loc.startsWith('fr')) return 'fr';
        if (loc.startsWith('zh') || loc.startsWith('cn')) return 'cn';
        return 'en';
    }

    // Priority 3: Message guild locale or author locale
    if (interactionOrMessage?.guild?.preferredLocale) {
        const guildLoc = interactionOrMessage.guild.preferredLocale.toLowerCase();
        if (guildLoc.startsWith('fr')) return 'fr';
        if (guildLoc.startsWith('zh') || guildLoc.startsWith('cn')) return 'cn';
    }

    // Priority 4: Client language detection if available
    if (client?.detectLanguage) {
        try {
            const detected = client.detectLanguage(usedPrefix, 'en');
            if (detected === 'fr') return 'fr';
            if (detected === 'cn' || detected === 'zh') return 'cn';
        } catch (e) { /* fallback */ }
    }

    // Default: English
    return 'en';
}

function buildIntelligenceEmbed(entry, t, word, timestamp) {
    const embed = new EmbedBuilder()
        .setColor(PALETTE.primary)
        .setTitle(`\`[ ${entry.word.toUpperCase()} ]\``)
        .setDescription(
            `\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`\n` +
            `**${t.phonetic}**  ${entry.phonetic ? `\` ${entry.phonetic} \`` : '\` N/A \`'}\n` +
            `\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\``
        )
        .setFooter({
            text: `${t.footer(word)}  |  ${t.classification}  |  Free Dictionary API`
        })
        .setTimestamp(timestamp);

    // Add phonetic audio if available
    const audioUrl = entry.phonetics?.find(p => p.audio)?.audio;
    if (audioUrl) {
        embed.addFields({
            name: `\` ${t.audio} \``,
            value: `[\`▶ PLAY AUDIO\`](${audioUrl})`,
            inline: true
        });
    }

    // Process all meanings (up to 4 to avoid embed bloat)
    const meanings = entry.meanings?.slice(0, 4) || [];

    if (meanings.length > 0) {
        embed.addFields({
            name: `\` ${t.meanings} [${meanings.length}] \``,
            value: `\`<< ${t.multipleMeanings(meanings.length)} >>\``,
            inline: false
        });

        meanings.forEach((meaning, idx) => {
            const defs = meaning.definitions?.slice(0, 2) || [];
            if (defs.length === 0) return;

            let fieldValue = '';

            defs.forEach((def, dIdx) => {
                fieldValue += `\`[${idx + 1}.${dIdx + 1}]\`  ${def.definition}\n`;
                if (def.example) {
                    fieldValue += `> *"${def.example}"*\n`;
                }
                if (def.synonyms?.length > 0) {
                    fieldValue += `> \`SYN:\`  ${def.synonyms.slice(0, 3).join(' · ')}\n`;
                }
                if (def.antonyms?.length > 0) {
                    fieldValue += `> \`ANT:\`  ${def.antonyms.slice(0, 3).join(' · ')}\n`;
                }
                fieldValue += '\n';
            });

            // Add part-of-speech level synonyms/antonyms
            if (meaning.synonyms?.length > 0 || meaning.antonyms?.length > 0) {
                fieldValue += `\`━━━\`\n`;
                if (meaning.synonyms?.length > 0) {
                    fieldValue += `\`[${t.synonyms}]\`  ${meaning.synonyms.slice(0, 5).join(' · ')}\n`;
                }
                if (meaning.antonyms?.length > 0) {
                    fieldValue += `\`[${t.antonyms}]\`  ${meaning.antonyms.slice(0, 5).join(' · ')}\n`;
                }
            }

            embed.addFields({
                name: `\`▸ ${meaning.partOfSpeech.toUpperCase()} \``,
                value: fieldValue.trim() || '> No data',
                inline: false
            });
        });
    }

    // Etymology / Origin
    if (entry.etymology?.[0]) {
        embed.addFields({
            name: `\` ${t.etymology} \``,
            value: `> ${entry.etymology[0].substring(0, 300)}${entry.etymology[0].length > 300 ? '...' : ''}`,
            inline: false
        });
    }
    return embed;
}

module.exports = {
    name: 'define',
    aliases: ['definition', 'def', 'dict', 'dictionary', 'lexicon'],
    description: '📖 Trilingual intelligence dictionary (EN/FR/CN) with phonetics, etymology, and semantic analysis.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.define <word> | /define word:<word>',
    examples: [
        '.define serendipity',
        '.define ephemeral',
        '/define word:resilience'
    ],

    data: new SlashCommandBuilder()
        .setName('define')
        .setDescription('📖 Intelligence dictionary lookup — English definitions with trilingual UI')
        .addStringOption(o => o
            .setName('word')
            .setDescription('Target lexical entry to query')
            .setRequired(true)
        )
        .addStringOption(o => o
            .setName('language')
            .setDescription('Interface language (overrides auto-detect)')
            .setRequired(false)
            .addChoices(
                { name: '🇬🇧 English', value: 'en' },
                { name: '🇫🇷 Français', value: 'fr' },
                { name: '🇨🇳 中文', value: 'cn' }
            )
        ),

    // ═══════ PREFIX COMMAND ═══════
    run: async (client, message, args, db, ss, used) => {
        const lang = getLang(client, message, used);
        const t = T[lang];
        const word = args.join(' ').trim();

        if (!word) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(PALETTE.warning)
                    .setTitle('\`[ ERROR ]\`')
                    .setDescription(`\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`\n**${t.operator}** — Provide a target lexical entry.\n> Usage: \`.define <word>\`\n\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\``)
                    .setFooter({ text: `ARCHON LEXICON  |  UNCLASSIFIED  |  Free Dictionary API` })
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
                    .setDescription(
                        `\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`\n` +
                        t.notFound(word) +
                        `\n\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\``
                    )
                    .setFooter({ text: `${t.footer(word)}  |  ${t.classification}  |  Free Dictionary API` })
                    .setTimestamp();
                return msg?.edit({ embeds: [notFoundEmbed], content: null }).catch(() => {});
            }

            const entry = data[0];
            const embed = buildIntelligenceEmbed(entry, t, word, new Date(startTime));

            // Add query time
            embed.addFields({
                name: `\` ${t.queryTime} \``,
                value: `\`${((Date.now() - startTime) / 1000).toFixed(2)}s\``,
                inline: true
            });

            msg?.edit({ content: null, embeds: [embed] }).catch(() => {});

        } catch (e) {
            const errorEmbed = new EmbedBuilder()
                .setColor(PALETTE.accent)
                .setTitle('\`[ SYSTEM FAILURE ]\`')
                .setDescription(
                    `\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`\n` +
                    t.error +
                    `\n\n\`[DEBUG]\`  ${e.message?.substring(0, 100) || 'Unknown'}\n` +
                    `\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\``
                )
                .setFooter({ text: `${t.footer(word)}  |  ${t.classification}  |  Free Dictionary API` })
                .setTimestamp();
            msg?.edit({ content: null, embeds: [errorEmbed] }).catch(() => {});
        }
    },

    // ═══════ SLASH COMMAND ═══════
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
                    .setDescription(
                        `\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`\n` +
                        t.notFound(word) +
                        `\n\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\``
                    )
                    .setFooter({ text: `${t.footer(word)}  |  ${t.classification}  |  Free Dictionary API` })
                    .setTimestamp();
                return interaction.editReply({ embeds: [notFoundEmbed] });
            }

            const entry = data[0];
            const embed = buildIntelligenceEmbed(entry, t, word, new Date(startTime));

            embed.addFields({
                name: `\` ${t.queryTime} \``,
                value: `\`${((Date.now() - startTime) / 1000).toFixed(2)}s\``,
                inline: true
            });

            interaction.editReply({ embeds: [embed] });

        } catch (e) {
            const errorEmbed = new EmbedBuilder()
                .setColor(PALETTE.accent)
                .setTitle('\`[ SYSTEM FAILURE ]\`')
                .setDescription(
                    `\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`\n` +
                    t.error +
                    `\n\n\`[DEBUG]\`  ${e.message?.substring(0, 100) || 'Unknown'}\n` +
                    `\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\``
                )
                .setFooter({ text: `${t.footer(word)}  |  ${t.classification}  |  Free Dictionary API` })
                .setTimestamp();
            interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
