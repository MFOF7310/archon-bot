const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, Collection } = require('discord.js');

// ================= ACTIVE QUIZZES =================
const activeQuizzes = new Collection();

// ================= MALIAN CUISINE QUIZ DATABASE =================
const questions = [
    {
        en: { question: 'What is the main ingredient in Tô?', options: ['Millet', 'Rice', 'Corn', 'Wheat'] },
        fr: { question: 'Quel est l\'ingrédient principal du Tô ?', options: ['Le mil', 'Le riz', 'Le maïs', 'Le blé'] },
        correct: 0,
        fact: { en: 'Tô is a staple food made from millet or sorghum flour, served with sauce.', fr: 'Le Tô est un aliment de base fait de farine de mil ou de sorgho, servi avec une sauce.' }
    },
    {
        en: { question: 'What is Jollof Rice called in Mali?', options: ['Zamè', 'Riz gras', 'Fakoye', 'Tiguadege'] },
        fr: { question: 'Comment appelle-t-on le riz Jollof au Mali ?', options: ['Zamè', 'Riz gras', 'Fakoye', 'Tiguadege'] },
        correct: 1,
        fact: { en: 'Riz gras is a flavorful one-pot rice dish popular across West Africa.', fr: 'Le Riz gras est un plat de riz savoureux populaire en Afrique de l\'Ouest.' }
    },
    {
        en: { question: 'What meat is traditionally used in Fakoye?', options: ['Chicken', 'Beef', 'Lamb', 'Goat'] },
        fr: { question: 'Quelle viande est traditionnellement utilisée dans le Fakoye ?', options: ['Le poulet', 'Le bœuf', 'L\'agneau', 'La chèvre'] },
        correct: 2,
        fact: { en: 'Fakoye is a traditional Songhai dish made with lamb and a rich peanut sauce.', fr: 'Le Fakoye est un plat traditionnel Songhaï à base d\'agneau et d\'une riche sauce d\'arachide.' }
    },
    {
        en: { question: 'What is Dèguè made from?', options: ['Corn', 'Millet couscous', 'Rice', 'Potatoes'] },
        fr: { question: 'De quoi est fait le Dèguè ?', options: ['Du maïs', 'Du couscous de mil', 'Du riz', 'Des pommes de terre'] },
        correct: 1,
        fact: { en: 'Dèguè is a sweet millet couscous dessert mixed with yogurt or milk.', fr: 'Le Dèguè est un dessert sucré de couscous de mil mélangé avec du yaourt ou du lait.' }
    },
    {
        en: { question: 'What gives Tiguadege its distinctive color?', options: ['Tomatoes', 'Peanut butter', 'Palm oil', 'Saffron'] },
        fr: { question: 'Qu\'est-ce qui donne sa couleur distinctive au Tiguadege ?', options: ['Les tomates', 'Le beurre de cacahuète', 'L\'huile de palme', 'Le safran'] },
        correct: 1,
        fact: { en: 'Tiguadege is a rich peanut butter stew, a signature dish of Malian cuisine.', fr: 'Le Tiguadege est un riche ragoût au beurre de cacahuète, un plat signature de la cuisine malienne.' }
    },
    {
        en: { question: 'What is the name of the Malian grilled meat skewers?', options: ['Suya', 'Brochettes', 'Dibi', 'Chichinga'] },
        fr: { question: 'Quel est le nom des brochettes de viande grillée maliennes ?', options: ['Suya', 'Brochettes', 'Dibi', 'Chichinga'] },
        correct: 1,
        fact: { en: 'Brochettes are popular street food in Mali, grilled over charcoal.', fr: 'Les brochettes sont un plat de rue populaire au Mali, grillées au charbon de bois.' }
    },
    {
        en: { question: 'What leaf is used to make Saga-Saga sauce?', options: ['Spinach', 'Baobab leaf', 'Cassava leaf', 'Jute leaf'] },
        fr: { question: 'Quelle feuille est utilisée pour faire la sauce Saga-Saga ?', options: ['L\'épinard', 'La feuille de baobab', 'La feuille de manioc', 'La feuille de jute'] },
        correct: 2,
        fact: { en: 'Saga-Saga is a sauce made from cassava leaves, often served with rice.', fr: 'Le Saga-Saga est une sauce à base de feuilles de manioc, souvent servie avec du riz.' }
    },
    {
        en: { question: 'What is the traditional drink "Bissap" made from?', options: ['Ginger', 'Hibiscus flowers', 'Mango', 'Tamarind'] },
        fr: { question: 'De quoi est faite la boisson traditionnelle "Bissap" ?', options: ['Du gingembre', 'Des fleurs d\'hibiscus', 'De la mangue', 'Du tamarin'] },
        correct: 1,
        fact: { en: 'Bissap is a refreshing drink made from dried hibiscus flowers, popular across Mali.', fr: 'Le Bissap est une boisson rafraîchissante à base de fleurs d\'hibiscus séchées, populaire au Mali.' }
    },
    {
        en: { question: 'What is "Poulet Yassa" marinated with?', options: ['Tomato sauce', 'Lemon and onions', 'Peanut sauce', 'Coconut milk'] },
        fr: { question: 'Avec quoi marine-t-on le "Poulet Yassa" ?', options: ['Sauce tomate', 'Citron et oignons', 'Sauce d\'arachide', 'Lait de coco'] },
        correct: 1,
        fact: { en: 'Poulet Yassa is marinated chicken with lemon and onions, grilled to perfection.', fr: 'Le Poulet Yassa est du poulet mariné au citron et aux oignons, grillé à la perfection.' }
    },
    {
        en: { question: 'What grain is "Fonio" similar to?', options: ['Quinoa', 'Rice', 'Barley', 'Oats'] },
        fr: { question: 'À quelle céréale le "Fonio" ressemble-t-il ?', options: ['Le quinoa', 'Le riz', 'L\'orge', 'L\'avoine'] },
        correct: 0,
        fact: { en: 'Fonio is an ancient West African grain, gluten-free and highly nutritious.', fr: 'Le Fonio est une céréale ancienne d\'Afrique de l\'Ouest, sans gluten et très nutritive.' }
    }
];

// ================= BILINGUAL TRANSLATIONS =================
const t = {
    en: {
        title: 'MALIAN CUISINE QUIZ',
        startDesc: 'Test your knowledge of Malian cuisine! Answer 5 questions correctly to become a Malian Food Master!',
        question: 'Question',
        of: 'of',
        timePerQuestion: '15 seconds per question',
        score: 'Score',
        correct: 'Correct!',
        wrong: 'Wrong!',
        correctAnswer: 'The correct answer was',
        fact: 'Food Fact',
        finalScore: 'Your final score',
        master: 'MALIAN FOOD MASTER! You know your Malian cuisine!',
        good: 'Good job! You have solid knowledge of Malian food.',
        ok: 'Not bad! Keep learning about Malian cuisine!',
        bad: 'Keep exploring! There is so much to discover in Malian cuisine!',
        timeout: 'Time is up! Moving to next question...',
        startButton: 'Start Quiz',
        quizEnded: 'Quiz ended.',
        footer: 'ARCHITECT CG-223 • Malian Cuisine Quiz'
    },
    fr: {
        title: 'QUIZ CUISINE MALIENNE',
        startDesc: 'Testez vos connaissances sur la cuisine malienne ! Répondez à 5 questions pour devenir un Maître de la Cuisine Malienne !',
        question: 'Question',
        of: 'sur',
        timePerQuestion: '15 secondes par question',
        score: 'Score',
        correct: 'Correct !',
        wrong: 'Faux !',
        correctAnswer: 'La bonne réponse était',
        fact: 'Fait Culinaire',
        finalScore: 'Votre score final',
        master: 'MAÎTRE DE LA CUISINE MALIENNE ! Vous connaissez votre cuisine malienne !',
        good: 'Bon travail ! Vous avez de solides connaissances de la cuisine malienne.',
        ok: 'Pas mal ! Continuez à apprendre la cuisine malienne !',
        bad: 'Continuez à explorer ! Il y a tant à découvrir dans la cuisine malienne !',
        timeout: 'Temps écoulé ! Passage à la question suivante...',
        startButton: 'Commencer le Quiz',
        quizEnded: 'Quiz terminé.',
        footer: 'ARCHITECT CG-223 • Quiz Cuisine Malienne'
    }
};

module.exports = {
    name: 'quiz-mali-food',
    aliases: ['mali-food', 'malifood', 'cuisinemali', 'quiz-cuisine', 'mali-quiz'],
    description: 'Test your knowledge of Malian cuisine!',
    category: 'FUN',
    cooldown: 10,
    usage: '.quiz-mali-food',
    examples: ['.quiz-mali-food', '/quiz-mali-food'],

    data: new SlashCommandBuilder()
        .setName('quiz-mali-food')
        .setDescription('Test your knowledge of Malian cuisine!'),

    run: async (client, message, args) => {
        const lang = client.detectLanguage ? client.detectLanguage('food', 'en') : 'en';
        await startQuiz(client, message, lang, false);
    },

    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        await startQuiz(client, interaction, lang, true);
    }
};

async function startQuiz(client, context, lang, isSlash) {
    const userId = isSlash ? context.user.id : context.author.id;
    const username = isSlash ? context.user.username : context.author.username;

    const reply = async (opts) => {
        if (isSlash) {
            if (context.deferred || context.replied) return context.editReply(opts);
            return context.reply(opts);
        }
        return context.reply(opts);
    };

    if (activeQuizzes.has(userId)) {
        return reply({ content: 'You already have an active quiz! Finish it first.', flags: 64 });
    }

    const startEmbed = new EmbedBuilder()
        .setColor('#f39c12')
        .setAuthor({ name: `${t[lang].title} - ${username}` })
        .setDescription(`${t[lang].startDesc}\n\n5 Questions\n${t[lang].timePerQuestion}`)
        .setFooter({ text: t[lang].footer })
        .setTimestamp();

    const startRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mali_start_${userId}`)
            .setLabel(t[lang].startButton)
            .setStyle(ButtonStyle.Success)
            .setEmoji('🍳')
    );

    const startMsg = await reply({ embeds: [startEmbed], components: [startRow] });

    try {
        const startInteraction = await startMsg.awaitMessageComponent({
            filter: i => i.user.id === userId && i.customId === `mali_start_${userId}`,
            time: 30000
        });
        await startInteraction.deferUpdate();
        await startMsg.edit({ components: [] });
        await runQuiz(startMsg, userId, username, lang);
    } catch (e) {
        await startMsg.edit({ components: [] }).catch(() => {});
    }
}

async function runQuiz(msg, userId, username, lang) {
    const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, 5);
    let score = 0;
    let currentCollector = null;
    activeQuizzes.set(userId, true);

    for (let i = 0; i < shuffled.length; i++) {
        const q = shuffled[i];
        const data = q[lang];
        const emojis = ['🇦', '🇧', '🇨', '🇩'];

        const questionEmbed = new EmbedBuilder()
            .setColor('#f39c12')
            .setAuthor({ name: `🍚 ${t[lang].title} • ${username}` })
            .setDescription(
                `### ${t[lang].question} ${i + 1} ${t[lang].of} 5\n\n` +
                `**${data.question}**\n\n` +
                data.options.map((opt, idx) => `${emojis[idx]}  ${opt}`).join('\n')
            )
            .addFields({ name: `⭐ ${t[lang].score}`, value: `${score}/${i}`, inline: true })
            .setFooter({ text: t[lang].footer })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            data.options.map((_, idx) =>
                new ButtonBuilder()
                    .setCustomId(`mali_q_${i}_${idx}`)
                    .setLabel(String(idx + 1))
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojis[idx])
            )
        );

        await msg.edit({ embeds: [questionEmbed], components: [row] });

        // ================= WAIT FOR ANSWER =================
        let answered = false;
        
        try {
            const answerInteraction = await msg.awaitMessageComponent({
                filter: i => i.user.id === userId,
                time: 15000
            });

            // Stop accepting old interactions
            await answerInteraction.deferUpdate();
            answered = true;
            
            const choice = parseInt(answerInteraction.customId.split('_').pop());
            const isCorrect = choice === q.correct;
            if (isCorrect) score++;

            // Show result
            const resultEmbed = new EmbedBuilder()
                .setColor(isCorrect ? '#2ecc71' : '#e74c3c')
                .setAuthor({ name: `🍚 ${t[lang].title} • ${username}` })
                .setDescription(
                    `### ${isCorrect ? '✅ ' + t[lang].correct : '❌ ' + t[lang].wrong}\n\n` +
                    (!isCorrect ? `**${t[lang].correctAnswer}:** ${emojis[q.correct]} ${data.options[q.correct]}\n\n` : '') +
                    `**🍽️ ${t[lang].fact}:** ${q.fact[lang]}\n\n` +
                    `⭐ ${t[lang].score}: **${score}/${i + 1}**`
                )
                .setFooter({ text: t[lang].footer })
                .setTimestamp();

            // Disable all buttons
            const disabledRow = new ActionRowBuilder().addComponents(
                data.options.map((_, idx) =>
                    new ButtonBuilder()
                        .setCustomId(`mali_done_${i}_${idx}`)
                        .setLabel(String(idx + 1))
                        .setStyle(idx === q.correct ? ButtonStyle.Success : (idx === choice && !isCorrect ? ButtonStyle.Danger : ButtonStyle.Secondary))
                        .setEmoji(emojis[idx])
                        .setDisabled(true)
                )
            );

            await msg.edit({ embeds: [resultEmbed], components: [disabledRow] });
            await new Promise(resolve => setTimeout(resolve, 3500));

        } catch (e) {
            // Timeout - no answer
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setAuthor({ name: `🍚 ${t[lang].title} • ${username}` })
                .setDescription(
                    `### ⏰ ${t[lang].timeout}\n\n` +
                    `**${t[lang].correctAnswer}:** ${emojis[q.correct]} ${data.options[q.correct]}\n\n` +
                    `**🍽️ ${t[lang].fact}:** ${q.fact[lang]}`
                )
                .setFooter({ text: t[lang].footer })
                .setTimestamp();

            const disabledRow = new ActionRowBuilder().addComponents(
                data.options.map((_, idx) =>
                    new ButtonBuilder()
                        .setCustomId(`mali_timeout_${i}_${idx}`)
                        .setLabel(String(idx + 1))
                        .setStyle(idx === q.correct ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji(emojis[idx])
                        .setDisabled(true)
                )
            );

            await msg.edit({ embeds: [timeoutEmbed], components: [disabledRow] });
            await new Promise(resolve => setTimeout(resolve, 3500));
        }
    }

    activeQuizzes.delete(userId);

    // ================= FINAL RESULT =================
    let resultEmoji, resultText, resultColor;
    if (score >= 5) { resultEmoji = '👨‍🍳'; resultText = t[lang].master; resultColor = '#ffd700'; }
    else if (score >= 3) { resultEmoji = '👍'; resultText = t[lang].good; resultColor = '#2ecc71'; }
    else if (score >= 1) { resultEmoji = '📚'; resultText = t[lang].ok; resultColor = '#3498db'; }
    else { resultEmoji = '🌱'; resultText = t[lang].bad; resultColor = '#95a5a6'; }

    const finalEmbed = new EmbedBuilder()
        .setColor(resultColor)
        .setAuthor({ name: `🍚 ${t[lang].title} • ${username}` })
        .setDescription(
            `## ${resultEmoji} ${t[lang].finalScore}: **${score}/5**\n\n` +
            `${resultText}`
        )
        .setFooter({ text: t[lang].footer })
        .setTimestamp();

    await msg.edit({ embeds: [finalEmbed], components: [] });
}