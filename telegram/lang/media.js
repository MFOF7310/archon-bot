"use strict";
// Texts of the download commands. One status message per download, edited in place; Bambara falls back to English.
const { langOf } = require('./menu');

const T = {
    en: {
        compressing: '🗜️ Making it smaller for Telegram…', no_audio: '🔇 No sound available for this one in this region', rate_limited: '{site} is slowing me down right now. Your link is fine: send it again in a minute.', album: '{n} photos and videos',
        usage: '📥 Send <code>{cmd}</code> followed by a link.\n<i>{example}</i>',
        usage_yta: '🎵 Send <code>/yta</code> with a YouTube link or a song name.\n<i>/yta Mama Le Succès</i>',
        usage_yts: '🔍 Send <code>/yts</code> with what you are looking for.\n<i>/yts Sidiki Diabaté live</i>',
        not_video: "That's a channel or a playlist. Open one video, copy its link and send it again.",
        wrong_site: "That isn't a {site} link. Send <code>/dl</code> with the link and I'll pick the right tool.",
        pick: '<b>{title}</b>\n{meta}\n\nWhich quality? Up to 50 MB I send the file, above that you get a download link.',
        best: '⭐ Best', audio_btn: '🎵 Audio only',
        looking: '🔍 Looking it up…', getting: '📥 Getting {what}…', sending: '📤 Sending…',
        what_video: 'the video', what_audio: 'the audio', what_q: 'the video in {q}',
        too_big: '<b>{title}</b> is {mb} MB, too big for Telegram (50 MB max). Download it here, the link works for a few hours.',
        too_big_lower: 'This one is {mb} MB, too big for Telegram. Try a lower quality.',
        dl_btn: '⬇️ Download',
        failed_private: "I can't get this one: it's private or no longer online.",
        failed: "I couldn't download this one. Try another quality or another link in a moment.",
        failed_site: "I couldn't get it from {site}. Public posts work best; private ones need a login.",
        no_media: 'There is no video or picture in that post.',
        results: '🔍 <b>{q}</b>', no_results: 'Nothing found for “{q}”.', pick_result: 'Tap a result to download it.',
        dl_sites: '📥 Send <code>/dl</code> followed by a link from one of these:\n{list}',
    },
    fr: {
        compressing: '🗜️ Je la rends plus légère pour Telegram…', no_audio: '🔇 Pas de son disponible pour celle-ci dans cette région', rate_limited: '{site} me ralentit en ce moment. Ton lien est bon : renvoie-le dans une minute.', album: '{n} photos et vidéos',
        usage: '📥 Envoie <code>{cmd}</code> suivi d\'un lien.\n<i>{example}</i>',
        usage_yta: '🎵 Envoie <code>/yta</code> avec un lien YouTube ou le nom d\'une chanson.\n<i>/yta Mama Le Succès</i>',
        usage_yts: '🔍 Envoie <code>/yts</code> avec ce que tu cherches.\n<i>/yts Sidiki Diabaté live</i>',
        not_video: "C'est une chaîne ou une playlist. Ouvre une vidéo, copie son lien et renvoie-le.",
        wrong_site: "Ce n'est pas un lien {site}. Envoie <code>/dl</code> avec le lien, je choisirai le bon outil.",
        pick: '<b>{title}</b>\n{meta}\n\nQuelle qualité ? Jusqu\'à 50 Mo j\'envoie le fichier, au-delà tu reçois un lien de téléchargement.',
        best: '⭐ La meilleure', audio_btn: '🎵 Audio seul',
        looking: '🔍 Je cherche…', getting: '📥 Je récupère {what}…', sending: '📤 J\'envoie…',
        what_video: 'la vidéo', what_audio: 'l\'audio', what_q: 'la vidéo en {q}',
        too_big: '<b>{title}</b> fait {mb} Mo, trop lourd pour Telegram (50 Mo max). Télécharge-la ici, le lien marche quelques heures.',
        too_big_lower: 'Celle-ci fait {mb} Mo, trop lourd pour Telegram. Essaie une qualité plus basse.',
        dl_btn: '⬇️ Télécharger',
        failed_private: "Je ne peux pas la récupérer : elle est privée ou n'est plus en ligne.",
        failed: "Je n'ai pas réussi à la télécharger. Essaie une autre qualité ou un autre lien dans un moment.",
        failed_site: "Je n'ai pas pu la récupérer sur {site}. Les publications publiques marchent le mieux, les privées demandent une connexion.",
        no_media: "Il n'y a ni vidéo ni image dans cette publication.",
        results: '🔍 <b>{q}</b>', no_results: 'Rien trouvé pour « {q} ».', pick_result: 'Appuie sur un résultat pour le télécharger.',
        dl_sites: '📥 Envoie <code>/dl</code> suivi d\'un lien de l\'un de ces sites :\n{list}',
    },
    zh: {
        compressing: '🗜️ 正在为 Telegram 压缩…', no_audio: '🔇 该地区无法获取此内容的声音', rate_limited: '{site} 暂时限制了请求。你的链接没问题，一分钟后再发一次。', album: '{n} 张图片和视频',
        usage: '📥 发送 <code>{cmd}</code> 加上链接。\n<i>{example}</i>',
        usage_yta: '🎵 发送 <code>/yta</code> 加上 YouTube 链接或歌名。\n<i>/yta Mama Le Succès</i>',
        usage_yts: '🔍 发送 <code>/yts</code> 加上你要找的内容。\n<i>/yts Sidiki Diabaté live</i>',
        not_video: '这是频道或播放列表。请打开一个视频，复制它的链接再发送。',
        wrong_site: '这不是 {site} 链接。发送 <code>/dl</code> 加上链接，我会自动选择合适的工具。',
        pick: '<b>{title}</b>\n{meta}\n\n选择画质：50 MB 以内直接发送文件，超过则提供下载链接。',
        best: '⭐ 最佳', audio_btn: '🎵 仅音频',
        looking: '🔍 正在查找…', getting: '📥 正在获取{what}…', sending: '📤 正在发送…',
        what_video: '视频', what_audio: '音频', what_q: '{q} 视频',
        too_big: '<b>{title}</b> 有 {mb} MB，超过 Telegram 的 50 MB 上限。请在这里下载，链接几小时内有效。',
        too_big_lower: '这个文件有 {mb} MB，超过 Telegram 上限。请换一个更低的画质。',
        dl_btn: '⬇️ 下载',
        failed_private: '无法获取：该内容为私密或已下线。',
        failed: '下载失败。请稍后换一个画质或链接再试。',
        failed_site: '无法从 {site} 获取。公开内容效果最好，私密内容需要登录。',
        no_media: '这条内容里没有视频或图片。',
        results: '🔍 <b>{q}</b>', no_results: '没有找到「{q}」。', pick_result: '点击一个结果即可下载。',
        dl_sites: '📥 发送 <code>/dl</code> 加上以下网站的链接：\n{list}',
    },
    ar: {
        compressing: '🗜️ أصغّر حجمه من أجل Telegram…', no_audio: '🔇 لا يتوفر صوت لهذا المقطع في هذه المنطقة', rate_limited: '{site} يبطئني حاليًا. رابطك سليم: أرسله مجددًا بعد دقيقة.', album: '{n} صور وفيديوهات',
        usage: '📥 أرسل <code>{cmd}</code> متبوعًا برابط.\n<i>{example}</i>',
        usage_yta: '🎵 أرسل <code>/yta</code> مع رابط YouTube أو اسم أغنية.\n<i>/yta Mama Le Succès</i>',
        usage_yts: '🔍 أرسل <code>/yts</code> مع ما تبحث عنه.\n<i>/yts Sidiki Diabaté live</i>',
        not_video: 'هذه قناة أو قائمة تشغيل. افتح فيديو واحدًا وانسخ رابطه ثم أرسله.',
        wrong_site: 'هذا ليس رابط {site}. أرسل <code>/dl</code> مع الرابط وسأختار الأداة المناسبة.',
        pick: '<b>{title}</b>\n{meta}\n\nأي جودة؟ حتى 50 ميغابايت أرسل الملف، وأكثر من ذلك تحصل على رابط تحميل.',
        best: '⭐ الأفضل', audio_btn: '🎵 الصوت فقط',
        looking: '🔍 أبحث…', getting: '📥 أجلب {what}…', sending: '📤 أرسل…',
        what_video: 'الفيديو', what_audio: 'الصوت', what_q: 'الفيديو بجودة {q}',
        too_big: '<b>{title}</b> حجمه {mb} ميغابايت، أكبر من حد Telegram (50 ميغابايت). حمّله من هنا، الرابط يعمل لبضع ساعات.',
        too_big_lower: 'حجمه {mb} ميغابايت، أكبر من حد Telegram. جرّب جودة أقل.',
        dl_btn: '⬇️ تحميل',
        failed_private: 'لا أستطيع جلبه: إنه خاص أو لم يعد متاحًا.',
        failed: 'تعذر التحميل. جرّب جودة أخرى أو رابطًا آخر بعد قليل.',
        failed_site: 'تعذر الجلب من {site}. المنشورات العامة تعمل أفضل، والخاصة تحتاج تسجيل دخول.',
        no_media: 'لا يوجد فيديو أو صورة في هذا المنشور.',
        results: '🔍 <b>{q}</b>', no_results: 'لا نتائج لـ «{q}».', pick_result: 'اضغط على نتيجة لتحميلها.',
        dl_sites: '📥 أرسل <code>/dl</code> متبوعًا برابط من أحد هذه المواقع:\n{list}',
    },
};

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// tr(ctx) → (key, vars) in the member's language. Values are escaped unless the key ends with _html.
function tr(ctx) {
    const lang = langOf(ctx.userId, (ctx.message || ctx.callbackQuery)?.from?.language_code);
    return (key, vars = {}) => {
        let v = (T[lang] && T[lang][key]) || T.en[key] || key;
        for (const [k, x] of Object.entries(vars)) v = v.split(`{${k}}`).join(k.endsWith('_html') ? String(x) : esc(x));
        return v;
    };
}
module.exports = { tr, esc, _T: T };
