"use strict";
// Texts of the /start menu and its pages. Short sentences, actions as buttons; Bambara falls back to English.
const { store } = require('../safe');
const fs = require('fs');

const T = {
    en: {
        help_also: 'Also: {list}', help_admin: '🛡️ Group admins only', help_owner: '🔒 Bot owner only', help_unknown: "I don't know /{cmd}. Open the menu to see what I can do.",
        list_t: '📋 Commands', list_d: '{n} commands. Tap an area to see them.', b_areas: '◀️ All areas', list_none: 'No area called "{q}". Tap one below.',
        cat: { Media: '🎬 Media', System: '⚙️ System', Moderation: '🛡️ Moderation', Economy: '💰 Economy', Games: '🎮 Games', Utility: '🛠️ Tools', AI: '🤖 AI', Fun: '🎉 Fun', General: '📋 General', Music: '🎵 Music' },
        morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening',
        intro: "I'm ARCHON. I can answer your questions, download a video from a link, start a game or look after your group.",
        hint: 'Pick below, or send me /dl with a link.',
        b_ai: '🤖 Talk to Lydia', b_dl: '📥 Download', b_games: '🎮 Games', b_econ: '💰 Economy', b_group: '🛡️ Manage a group', b_util: '🛠️ Tools',
        b_lang: '🌍 Language', b_all: '📋 All commands', b_back: '◀️ Back', b_about: 'ℹ️ About',
        ai_t: '🤖 Lydia, your assistant', ai_d: 'Ask me anything with /lydia, or switch on auto-replies in a group.',
        ai_c: ['/lydia <message> · ask a question', '/lydia on · reply on its own here', '/lydia off · stop the auto-replies', '/lydia clear · forget our conversation'],
        b_ask: '💬 Ask Lydia', b_tr: '🌐 Translate',
        dl_t: '📥 Download', dl_d: 'Send /dl followed by a link: YouTube, Instagram, TikTok, Facebook or X. I find the right tool for it.',
        dl_c: ['/dl <link> · any supported link', '/ytv <link> · YouTube video, pick the quality', '/yta <link or title> · audio only', '/yts <search> · find a YouTube video'],
        b_search: '🔍 Search YouTube',
        games_t: '🎮 Games', games_d: 'Play here or in any group. Wins earn XP for the leaderboard.',
        games_c: ['/trivia · quiz with answer buttons', '/wordguess · guess the word letter by letter', '/roll · roll a die', '/flip · heads or tails', '/leaderboard · top players'],
        b_trivia: '🎯 Trivia', b_word: '🔤 Word guess', b_roll: '🎲 Roll a die', b_flip: '🪙 Heads or tails',
        econ_t: '💰 Economy', econ_d: 'Claim credits every day, keep your streak, and spend them in the shop.',
        econ_c: ['/daily · today\'s reward', '/balance · your credits', '/rank · your level', '/profile · all your stats', '/shop · the shop'],
        b_daily: '🎁 Daily reward', b_bal: '💰 Balance', b_rank: '📊 Rank', b_prof: '📋 Profile',
        group_t: '🛡️ Manage a group', group_d: 'Add me as an admin in your group, then open the settings panel.',
        group_c: ['/settings · the settings panel', '/welcome · welcome messages', '/antilink on · block links', '/warn · warn a member (reply to them)', '/mute · mute a member', '/rules · show or set the rules'],
        b_settings: '⚙️ Settings panel', b_admins: '👥 Admins',
        util_t: '🛠️ Tools', util_d: 'Small everyday helpers.',
        util_c: ['/weather <city> · the weather', '/crypto <coin> · a crypto price', '/translate <text> <language> · translate', '/reminder <time> <text> · a reminder', '/joke · a joke'],
        b_weather: '🌤️ Weather', b_crypto: '💎 Crypto', b_remind: '⏰ Reminder',
        all_t: '📋 All commands', all_hint: 'Type /help <command> for the details of one command.',
        about_t: 'ℹ️ About ARCHON', about_d: 'Built from scratch in Bamako, Mali 🇲🇱 by Moussa Fofana (@mfof7310). The same bot also runs on Discord.',
        about_up: 'Running for {uptime} · version {version}',
        lang_t: '🌍 Language', lang_cur: 'I answer you in {name}.', lang_pick: 'Tap a language to switch.', lang_done: 'Done, I answer you in {name} now.', lang_auto: 'Done, I follow your Telegram language again.', b_auto: '🔄 Auto',
    },
    fr: {
        help_also: 'Aussi : {list}', help_admin: '🛡️ Admins du groupe seulement', help_owner: '🔒 Propriétaire du bot seulement', help_unknown: 'Je ne connais pas /{cmd}. Ouvre le menu pour voir ce que je sais faire.',
        list_t: '📋 Commandes', list_d: '{n} commandes. Appuie sur un domaine pour les voir.', b_areas: '◀️ Tous les domaines', list_none: 'Aucun domaine « {q} ». Choisis-en un ci-dessous.',
        cat: { Media: '🎬 Médias', System: '⚙️ Système', Moderation: '🛡️ Modération', Economy: '💰 Économie', Games: '🎮 Jeux', Utility: '🛠️ Outils', AI: '🤖 IA', Fun: '🎉 Fun', General: '📋 Général', Music: '🎵 Musique' },
        morning: 'Bonjour', afternoon: 'Bon après-midi', evening: 'Bonsoir',
        intro: "Je suis ARCHON. Je peux répondre à tes questions, télécharger une vidéo depuis un lien, lancer un jeu ou gérer ton groupe.",
        hint: 'Choisis ci-dessous, ou envoie-moi /dl suivi d\'un lien.',
        b_ai: '🤖 Parler à Lydia', b_dl: '📥 Télécharger', b_games: '🎮 Jeux', b_econ: '💰 Économie', b_group: '🛡️ Gérer un groupe', b_util: '🛠️ Outils',
        b_lang: '🌍 Langue', b_all: '📋 Toutes les commandes', b_back: '◀️ Retour', b_about: 'ℹ️ À propos',
        ai_t: '🤖 Lydia, ton assistante', ai_d: 'Pose-moi une question avec /lydia, ou active les réponses automatiques dans un groupe.',
        ai_c: ['/lydia <message> · poser une question', '/lydia on · répondre toute seule ici', '/lydia off · arrêter les réponses auto', '/lydia clear · oublier notre conversation'],
        b_ask: '💬 Demander à Lydia', b_tr: '🌐 Traduire',
        dl_t: '📥 Télécharger', dl_d: 'Envoie /dl suivi d\'un lien : YouTube, Instagram, TikTok, Facebook ou X. Je trouve le bon outil.',
        dl_c: ['/dl <lien> · n\'importe quel lien pris en charge', '/ytv <lien> · vidéo YouTube, au choix de la qualité', '/yta <lien ou titre> · audio seulement', '/yts <recherche> · chercher une vidéo YouTube'],
        b_search: '🔍 Chercher sur YouTube',
        games_t: '🎮 Jeux', games_d: 'Joue ici ou dans n\'importe quel groupe. Les victoires rapportent de l\'XP pour le classement.',
        games_c: ['/trivia · quiz avec boutons de réponse', '/wordguess · deviner le mot lettre par lettre', '/roll · lancer un dé', '/flip · pile ou face', '/leaderboard · meilleurs joueurs'],
        b_trivia: '🎯 Quiz', b_word: '🔤 Mot mystère', b_roll: '🎲 Lancer un dé', b_flip: '🪙 Pile ou face',
        econ_t: '💰 Économie', econ_d: 'Récupère des crédits chaque jour, garde ta série et dépense-les dans la boutique.',
        econ_c: ['/daily · la récompense du jour', '/balance · tes crédits', '/rank · ton niveau', '/profile · toutes tes stats', '/shop · la boutique'],
        b_daily: '🎁 Récompense du jour', b_bal: '💰 Solde', b_rank: '📊 Niveau', b_prof: '📋 Profil',
        group_t: '🛡️ Gérer un groupe', group_d: 'Ajoute-moi comme admin dans ton groupe, puis ouvre le panneau de réglages.',
        group_c: ['/settings · le panneau de réglages', '/welcome · messages de bienvenue', '/antilink on · bloquer les liens', '/warn · avertir un membre (en réponse à son message)', '/mute · rendre un membre muet', '/rules · voir ou fixer les règles'],
        b_settings: '⚙️ Réglages', b_admins: '👥 Admins',
        util_t: '🛠️ Outils', util_d: 'De petits outils pour tous les jours.',
        util_c: ['/weather <ville> · la météo', '/crypto <monnaie> · le prix d\'une crypto', '/translate <texte> <langue> · traduire', '/reminder <durée> <texte> · un rappel', '/joke · une blague'],
        b_weather: '🌤️ Météo', b_crypto: '💎 Crypto', b_remind: '⏰ Rappel',
        all_t: '📋 Toutes les commandes', all_hint: 'Tape /help <commande> pour le détail d\'une commande.',
        about_t: 'ℹ️ À propos d\'ARCHON', about_d: 'Construit de zéro à Bamako, au Mali 🇲🇱, par Moussa Fofana (@mfof7310). Le même bot tourne aussi sur Discord.',
        about_up: 'En ligne depuis {uptime} · version {version}',
        lang_t: '🌍 Langue', lang_cur: 'Je te réponds en {name}.', lang_pick: 'Appuie sur une langue pour changer.', lang_done: 'C\'est fait, je te réponds en {name} maintenant.', lang_auto: 'C\'est fait, je suis de nouveau la langue de ton Telegram.', b_auto: '🔄 Auto',
    },
    zh: {
        help_also: '别名：{list}', help_admin: '🛡️ 仅限群管理员', help_owner: '🔒 仅限机器人所有者', help_unknown: '我不认识 /{cmd}。打开菜单看看我能做什么。',
        list_t: '📋 命令', list_d: '共 {n} 个命令。点击一个类别查看。', b_areas: '◀️ 全部类别', list_none: '没有名为「{q}」的类别，请在下方选择。',
        cat: { Media: '🎬 媒体', System: '⚙️ 系统', Moderation: '🛡️ 管理', Economy: '💰 经济', Games: '🎮 游戏', Utility: '🛠️ 工具', AI: '🤖 AI', Fun: '🎉 娱乐', General: '📋 通用', Music: '🎵 音乐' },
        morning: '早上好', afternoon: '下午好', evening: '晚上好',
        intro: '我是 ARCHON。我可以回答你的问题、通过链接下载视频、开始游戏或帮你管理群组。',
        hint: '在下方选择，或发送 /dl 加上链接。',
        b_ai: '🤖 和 Lydia 聊天', b_dl: '📥 下载', b_games: '🎮 游戏', b_econ: '💰 经济', b_group: '🛡️ 管理群组', b_util: '🛠️ 工具',
        b_lang: '🌍 语言', b_all: '📋 全部命令', b_back: '◀️ 返回', b_about: 'ℹ️ 关于',
        ai_t: '🤖 你的助手 Lydia', ai_d: '用 /lydia 问我任何问题，或在群组里开启自动回复。',
        ai_c: ['/lydia <消息> · 提问', '/lydia on · 在这里自动回复', '/lydia off · 关闭自动回复', '/lydia clear · 清除我们的对话'],
        b_ask: '💬 问 Lydia', b_tr: '🌐 翻译',
        dl_t: '📥 下载', dl_d: '发送 /dl 加上链接：YouTube、Instagram、TikTok、Facebook 或 X，我会自动选择合适的工具。',
        dl_c: ['/dl <链接> · 任何支持的链接', '/ytv <链接> · YouTube 视频，可选画质', '/yta <链接或标题> · 仅音频', '/yts <关键词> · 搜索 YouTube 视频'],
        b_search: '🔍 搜索 YouTube',
        games_t: '🎮 游戏', games_d: '在这里或任何群组都能玩，获胜可获得排行榜经验值。',
        games_c: ['/trivia · 带按钮的问答', '/wordguess · 逐个字母猜单词', '/roll · 掷骰子', '/flip · 抛硬币', '/leaderboard · 排行榜'],
        b_trivia: '🎯 问答', b_word: '🔤 猜单词', b_roll: '🎲 掷骰子', b_flip: '🪙 抛硬币',
        econ_t: '💰 经济', econ_d: '每天领取积分，保持连续签到，在商店里消费。',
        econ_c: ['/daily · 今日奖励', '/balance · 你的积分', '/rank · 你的等级', '/profile · 全部数据', '/shop · 商店'],
        b_daily: '🎁 每日奖励', b_bal: '💰 余额', b_rank: '📊 等级', b_prof: '📋 资料',
        group_t: '🛡️ 管理群组', group_d: '把我设为群组管理员，然后打开设置面板。',
        group_c: ['/settings · 设置面板', '/welcome · 欢迎消息', '/antilink on · 屏蔽链接', '/warn · 警告成员（回复其消息）', '/mute · 禁言成员', '/rules · 查看或设置群规'],
        b_settings: '⚙️ 设置面板', b_admins: '👥 管理员',
        util_t: '🛠️ 工具', util_d: '日常小工具。',
        util_c: ['/weather <城市> · 天气', '/crypto <币种> · 加密货币价格', '/translate <文本> <语言> · 翻译', '/reminder <时间> <内容> · 提醒', '/joke · 讲个笑话'],
        b_weather: '🌤️ 天气', b_crypto: '💎 加密货币', b_remind: '⏰ 提醒',
        all_t: '📋 全部命令', all_hint: '输入 /help <命令> 查看某个命令的详情。',
        about_t: 'ℹ️ 关于 ARCHON', about_d: '由 Moussa Fofana（@mfof7310）在马里巴马科 🇲🇱 从零打造。同一个机器人也在 Discord 上运行。',
        about_up: '已运行 {uptime} · 版本 {version}',
        lang_t: '🌍 语言', lang_cur: '我用{name}回复你。', lang_pick: '点击一种语言即可切换。', lang_done: '好了，我现在用{name}回复你。', lang_auto: '好了，我会重新跟随你的 Telegram 语言。', b_auto: '🔄 自动',
    },
    ar: {
        help_also: 'أيضًا: {list}', help_admin: '🛡️ لمشرفي المجموعة فقط', help_owner: '🔒 لمالك البوت فقط', help_unknown: 'لا أعرف /{cmd}. افتح القائمة لترى ما يمكنني فعله.',
        list_t: '📋 الأوامر', list_d: '{n} أمرًا. اضغط على قسم لعرضها.', b_areas: '◀️ كل الأقسام', list_none: 'لا يوجد قسم باسم «{q}». اختر واحدًا من الأسفل.',
        cat: { Media: '🎬 الوسائط', System: '⚙️ النظام', Moderation: '🛡️ الإشراف', Economy: '💰 الاقتصاد', Games: '🎮 الألعاب', Utility: '🛠️ أدوات', AI: '🤖 الذكاء الاصطناعي', Fun: '🎉 تسلية', General: '📋 عام', Music: '🎵 موسيقى' },
        morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير',
        intro: 'أنا ARCHON. أستطيع الإجابة عن أسئلتك، وتحميل فيديو من رابط، وبدء لعبة، أو إدارة مجموعتك.',
        hint: 'اختر من الأسفل، أو أرسل /dl متبوعًا برابط.',
        b_ai: '🤖 تحدث مع Lydia', b_dl: '📥 تحميل', b_games: '🎮 ألعاب', b_econ: '💰 الاقتصاد', b_group: '🛡️ إدارة مجموعة', b_util: '🛠️ أدوات',
        b_lang: '🌍 اللغة', b_all: '📋 كل الأوامر', b_back: '◀️ رجوع', b_about: 'ℹ️ حول',
        ai_t: '🤖 Lydia، مساعدتك', ai_d: 'اسألني أي شيء عبر /lydia، أو فعّل الردود التلقائية في مجموعة.',
        ai_c: ['/lydia <رسالة> · اطرح سؤالًا', '/lydia on · الرد تلقائيًا هنا', '/lydia off · إيقاف الردود التلقائية', '/lydia clear · نسيان محادثتنا'],
        b_ask: '💬 اسأل Lydia', b_tr: '🌐 ترجمة',
        dl_t: '📥 تحميل', dl_d: 'أرسل /dl متبوعًا برابط من YouTube أو Instagram أو TikTok أو Facebook أو X، وسأختار الأداة المناسبة.',
        dl_c: ['/dl <رابط> · أي رابط مدعوم', '/ytv <رابط> · فيديو YouTube مع اختيار الجودة', '/yta <رابط أو عنوان> · الصوت فقط', '/yts <بحث> · البحث عن فيديو في YouTube'],
        b_search: '🔍 بحث في YouTube',
        games_t: '🎮 ألعاب', games_d: 'العب هنا أو في أي مجموعة. الفوز يمنحك نقاط خبرة للترتيب.',
        games_c: ['/trivia · مسابقة بأزرار للإجابة', '/wordguess · خمّن الكلمة حرفًا حرفًا', '/roll · ارمِ النرد', '/flip · وجه أو كتابة', '/leaderboard · أفضل اللاعبين'],
        b_trivia: '🎯 مسابقة', b_word: '🔤 خمّن الكلمة', b_roll: '🎲 ارمِ النرد', b_flip: '🪙 وجه أو كتابة',
        econ_t: '💰 الاقتصاد', econ_d: 'اجمع الرصيد كل يوم، وحافظ على سلسلتك، وأنفقه في المتجر.',
        econ_c: ['/daily · مكافأة اليوم', '/balance · رصيدك', '/rank · مستواك', '/profile · كل إحصاءاتك', '/shop · المتجر'],
        b_daily: '🎁 مكافأة اليوم', b_bal: '💰 الرصيد', b_rank: '📊 المستوى', b_prof: '📋 الملف',
        group_t: '🛡️ إدارة مجموعة', group_d: 'أضفني كمشرف في مجموعتك، ثم افتح لوحة الإعدادات.',
        group_c: ['/settings · لوحة الإعدادات', '/welcome · رسائل الترحيب', '/antilink on · حظر الروابط', '/warn · تحذير عضو (بالرد على رسالته)', '/mute · كتم عضو', '/rules · عرض القواعد أو تعيينها'],
        b_settings: '⚙️ الإعدادات', b_admins: '👥 المشرفون',
        util_t: '🛠️ أدوات', util_d: 'أدوات صغيرة للاستخدام اليومي.',
        util_c: ['/weather <مدينة> · الطقس', '/crypto <عملة> · سعر عملة رقمية', '/translate <نص> <لغة> · ترجمة', '/reminder <وقت> <نص> · تذكير', '/joke · نكتة'],
        b_weather: '🌤️ الطقس', b_crypto: '💎 العملات الرقمية', b_remind: '⏰ تذكير',
        all_t: '📋 كل الأوامر', all_hint: 'اكتب /help <أمر> لتفاصيل أمر معيّن.',
        about_t: 'ℹ️ حول ARCHON', about_d: 'بُني من الصفر في باماكو، مالي 🇲🇱 على يد Moussa Fofana (@mfof7310). يعمل البوت نفسه أيضًا على Discord.',
        about_up: 'يعمل منذ {uptime} · الإصدار {version}',
        lang_t: '🌍 اللغة', lang_cur: 'أرد عليك بـ{name}.', lang_pick: 'اضغط على لغة للتبديل.', lang_done: 'تم، سأرد عليك الآن بـ{name}.', lang_auto: 'تم، سأتبع لغة Telegram لديك من جديد.', b_auto: '🔄 تلقائي',
    },
};
T.bm = {}; // Bambara: English until the translations arrive

const LANGS = ['en', 'fr', 'bm', 'zh', 'ar'];
const PREFS = store('archon_user_langs.json');
// The member's choice from /setlang first, then the language of their Telegram app
function langOf(userId, code) {
    try { const p = JSON.parse(fs.readFileSync(PREFS, 'utf8'))[String(userId)]; if (LANGS.includes(p)) return p; } catch {}
    const c = String(code || '').toLowerCase().split('-')[0];
    return LANGS.includes(c) ? c : 'en';
}
function m(lang, key, vars = {}) {
    let v = (T[lang] && T[lang][key] !== undefined) ? T[lang][key] : T.en[key];
    if (typeof v === 'string') for (const [k, x] of Object.entries(vars)) v = v.split(`{${k}}`).join(String(x));
    return v;
}
const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// The /start menu (also what /help shows without a command). The greeting follows Bamako time (UTC).
function startMenu(name, lang = 'en') {
    const h = new Date().getUTCHours();
    const greet = m(lang, h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 18 ? 'afternoon' : 'evening');
    const b = (k, data) => ({ text: m(lang, k), callback_data: data });
    return {
        text: `🦅 <b>${greet} ${esc(name)}</b>\n\n${m(lang, 'intro')}\n\n<i>${m(lang, 'hint')}</i>`,
        markup: { inline_keyboard: [
            [b('b_ai', 'm:ai'), b('b_dl', 'm:dl')],
            [b('b_games', 'm:games'), b('b_econ', 'm:econ')],
            [b('b_group', 'm:group'), b('b_util', 'm:util')],
            [b('b_lang', 'lang:menu'), b('b_all', 'm:cmds')],
        ] },
    };
}
const catName = (lang, cat) => { const c = m(lang, 'cat') || {}; const k = Object.keys(c).find((x) => x.toLowerCase() === String(cat).toLowerCase()); return k ? c[k] : `📋 ${cat}`; };
module.exports = { m, langOf, LANGS, startMenu, catName, esc, _T: T };
