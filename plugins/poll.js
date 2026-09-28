const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'poll',
    aliases: ['survey', 'vote', 'sondage'],
    description: '📊 Create a quick poll with reactions.',
    category: 'UTILITY',
    cooldown: 5000,
    usage: '.poll "Question" "Option1" "Option2" ...',
    examples: ['.poll "Quel jeu ?" "CODM" "Valorant" "Fortnite"'],

data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('📊 Create a quick poll / Créer un sondage rapide')
    .addStringOption(opt => opt
        .setName('question')
        .setDescription('The poll question / La question du sondage')
        .setRequired(true))
    .addStringOption(opt => opt
        .setName('option1')
        .setDescription('Option 1')
        .setRequired(true))
    .addStringOption(opt => opt
        .setName('option2')
        .setDescription('Option 2')
        .setRequired(true))
    .addStringOption(opt => opt
        .setName('option3')
        .setDescription('Option 3 (optional)')
        .setRequired(false))
    .addStringOption(opt => opt
        .setName('option4')
        .setDescription('Option 4 (optional)')
        .setRequired(false))
    .addStringOption(opt => opt
        .setName('option5')
        .setDescription('Option 5 (optional)')
        .setRequired(false))
    .addStringOption(opt => opt
        .setName('option6')
        .setDescription('Option 6 (optional)')
        .setRequired(false))
    .addStringOption(opt => opt
        .setName('option7')
        .setDescription('Option 7 (optional)')
        .setRequired(false))
    .addStringOption(opt => opt
        .setName('option8')
        .setDescription('Option 8 (optional)')
        .setRequired(false))
    .addStringOption(opt => opt
        .setName('option9')
        .setDescription('Option 9 (optional)')
        .setRequired(false)),

run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        
        const OKL = ['en','fr','bm','zh','ar'];
        lang = OKL.includes(serverSettings?.language) ? serverSettings.language : (OKL.includes(lang) ? lang : 'en');
        const T = {
            en: { title: '📊 POLL', createdBy: 'Created by', reactToVote: 'React with the corresponding emoji to vote!', invalid: '❌ Usage: `.poll "Question" "Option1" "Option2" ...`\nExample: `.poll "Favorite color?" "Red" "Blue" "Green"`', maxOptions: '❌ Maximum 9 options allowed.', minOptions: '❌ You must provide at least 2 options.' },
            fr: { title: '📊 SONDAGE', createdBy: 'Créé par', reactToVote: 'Réagissez avec l\'emoji correspondant pour voter !', invalid: '❌ Utilisation: `.poll "Question" "Option1" "Option2" ...`\nExemple: `.poll "Couleur préférée ?" "Rouge" "Bleu" "Vert"`', maxOptions: '❌ Maximum 9 options autorisées.', minOptions: '❌ Il faut au moins 2 options.' },
            zh: { title: '📊 投票', createdBy: '发起人', reactToVote: '用对应的表情符号投票吧！', invalid: '❌ 用法：`.poll "问题" "选项1" "选项2" ...`\n例如：`.poll "最喜欢什么颜色？" "红" "蓝" "绿"`', maxOptions: '❌ 最多 9 个选项。', minOptions: '❌ 至少需要 2 个选项。' },
            ar: { title: '📊 تصويت', createdBy: 'أنشأه', reactToVote: 'صوّت بالإيموجي المناسب!', invalid: '❌ الاستخدام: `.poll "سؤال" "خيار1" "خيار2" ...`\nمثال: `.poll "أفضل لون؟" "أحمر" "أزرق"`', maxOptions: '❌ الحد الأقصى 9 خيارات.', minOptions: '❌ تحتاج خيارين على الأقل.' }
        };
        const t = T[lang] || T.en;

        // Parse arguments (support quoted strings)
        const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
        const parts = [];
        let match;
        while ((match = regex.exec(args.join(' '))) !== null) {
            parts.push(match[1] || match[2] || match[3]);
        }

        if (parts.length < 3) {
            return message.reply({ content: t.invalid, flags: 64 }).catch(() => {});
        }

        const question = parts[0];
        const options = parts.slice(1);

        if (options.length > 9) {
            return message.reply({ content: t.maxOptions, flags: 64 }).catch(() => {});
        }

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
        
        let description = `**${question}**\n\n`;
        options.forEach((opt, i) => {
            description += `${emojis[i]} **${opt}**\n`;
        });
        description += `\n📢 *${t.reactToVote}*`;

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(t.title)
            .setDescription(description)
            .setFooter({ text: `${t.createdBy}: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        const pollMsg = await message.channel.send({ embeds: [embed] }).catch(() => {});
        if (!pollMsg) return;

        // Add reactions
        for (let i = 0; i < options.length; i++) {
            await pollMsg.react(emojis[i]).catch(() => {});
        }

                // Delete command message for cleanliness
        await message.delete().catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = require('../lib/i18n').slashLang(interaction, ['en','fr','zh','ar']);
        
        const t = {
            en: { title: '📊 POLL', createdBy: 'Created by', reactToVote: 'React with the corresponding emoji to vote!', maxOptions: '❌ Maximum 9 options allowed.', minOptions: '❌ You must provide at least 2 options.' },
            fr: { title: '📊 SONDAGE', createdBy: 'Créé par', reactToVote: 'Réagissez avec l\'emoji correspondant pour voter !', maxOptions: '❌ Maximum 9 options autorisées.', minOptions: '❌ Il faut au moins 2 options.' },
            zh: { title: '📊 投票', createdBy: '发起人', reactToVote: '用对应的表情符号投票吧！', invalid: '❌ 用法：`.poll "问题" "选项1" "选项2" ...`\n例如：`.poll "最喜欢什么颜色？" "红" "蓝" "绿"`', maxOptions: '❌ 最多 9 个选项。', minOptions: '❌ 至少需要 2 个选项。' },
        }[lang];

        const question = interaction.options.getString('question');
        
        // Collect all provided options
        const options = [];
        for (let i = 1; i <= 9; i++) {
            const opt = interaction.options.getString(`option${i}`);
            if (opt) options.push(opt);
        }

        if (options.length < 2) {
            return interaction.reply({ content: t.minOptions, flags: 64 });
        }

        if (options.length > 9) {
            return interaction.reply({ content: t.maxOptions, flags: 64 });
        }

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
        
        let description = `**${question}**\n\n`;
        options.forEach((opt, i) => {
            description += `${emojis[i]} **${opt}**\n`;
        });
        description += `\n📢 *${t.reactToVote}*`;

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(t.title)
            .setDescription(description)
            .setFooter({ text: `${t.createdBy}: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        
        const pollMsg = await interaction.fetchReply();
        
        // Add reactions
        for (let i = 0; i < options.length; i++) {
            await pollMsg.react(emojis[i]).catch(() => {});
        }
    }
};