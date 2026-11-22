// plugins/8ball.js — .8ball <question>: the magic 8-ball answers, in the asker's language (lib/fun cards)
const fun = require('../lib/fun');

// 10 yes, 5 maybe, 5 no — the classic balance of the toy
const ANSWERS = {
    en: { yes: ['It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes, definitely.', 'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.'],
        maybe: ['Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.'],
        no: ["Don't count on it.", 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'] },
    fr: { yes: ["C'est certain.", "C'est décidément le cas.", 'Sans aucun doute.', 'Oui, absolument.', 'Tu peux compter dessus.', 'Comme je le vois, oui.', 'Très probablement.', "L'avenir s'annonce bien.", 'Oui.', 'Les signes disent oui.'],
        maybe: ['Réponse floue, réessaie.', 'Redemande plus tard.', 'Mieux vaut ne pas te le dire maintenant.', 'Impossible à prédire pour le moment.', 'Concentre-toi et redemande.'],
        no: ["N'y compte pas.", 'Ma réponse est non.', 'Mes sources disent non.', "L'avenir n'est pas très bon.", "J'en doute fort."] },
    zh: { yes: ['这是肯定的。', '确实如此。', '毫无疑问。', '是的，绝对是。', '你可以相信它。', '依我看，是的。', '很有可能。', '前景不错。', '是的。', '迹象表明是的。'],
        maybe: ['回答模糊，再试一次。', '稍后再问。', '现在最好不告诉你。', '现在无法预测。', '集中精神再问一次。'],
        no: ['别指望了。', '我的回答是否定的。', '我的消息来源说不。', '前景不太好。', '非常值得怀疑。'] },
    ar: { yes: ['هذا مؤكد.', 'بالتأكيد كذلك.', 'بلا أدنى شك.', 'نعم، بالتأكيد.', 'يمكنك الاعتماد على ذلك.', 'كما أرى، نعم.', 'على الأرجح.', 'التوقعات جيدة.', 'نعم.', 'الإشارات تقول نعم.'],
        maybe: ['الإجابة غير واضحة، حاول مرة أخرى.', 'اسأل لاحقاً.', 'من الأفضل ألا أخبرك الآن.', 'لا يمكنني التنبؤ الآن.', 'ركّز واسأل مرة أخرى.'],
        no: ['لا تعتمد على ذلك.', 'إجابتي هي لا.', 'مصادري تقول لا.', 'التوقعات ليست جيدة.', 'مشكوك فيه جداً.'] },
};
const COLOR = { yes: 0x1D9E75, maybe: 0xBA7517, no: 0xE24B4A };

function funMake(client, { guild, user, lang, arg, priv }) {
    const question = fun.safe(arg, 300);
    const a = ANSWERS[lang] || ANSWERS.en;
    const r = Math.random() * 20;
    const kind = r < 10 ? 'yes' : r < 15 ? 'maybe' : 'no';
    return fun.textCard(guild, lang, {
        color: COLOR[kind], top: fun.F('asks', lang, { user: fun.safe(user.displayName || user.globalName || user.username, 40) }),
        body: `*« ${question} »*\n### 🎱 ${fun.pick(a[kind])}`,
        // the question travels in the button (cut to fit), so "Ask again" asks the same one
        again: ['8ball', user.id, question.slice(0, 60), fun.F('askAgain', lang)], priv,
    });
}

module.exports = {
    name: '8ball',
    aliases: ['eightball'],   // .ask is Ask Archon now (plugins/ask.js)
    description: 'Ask the magic 8-ball a question',
    category: 'FUN',
    cooldown: 2000,
    funMake,
    run: async (client, message, args) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        const question = args.join(' ').trim();
        if (!question) return message.reply({ content: fun.F('askFirst', lang), allowedMentions: { parse: [] } }).catch(() => {});
        return message.reply(funMake(client, { guild: message.guild, user: message.author, lang, arg: question })).catch(() => {});
    },
};
