"use strict";
module.exports = {
    // General
    error: "❌ حدث خطأ ما، حاول مرة أخرى.",
    owner_only: "⛔ هذا الأمر للمالك فقط.",
    admin_only: "⛔ هذا الأمر للمشرفين فقط.",
    groups_only: "⚠️ هذا الأمر يعمل في المجموعات فقط.",
    no_db: "❌ قاعدة البيانات غير متصلة.",

    // Welcome
    welcome_on: "👋 تم تشغيل رسائل الترحيب.",
    welcome_off: "🔴 تم إيقاف رسائل الترحيب.",
    welcome_set: "✅ تم تحديث رسالة الترحيب.",
    welcome_test: "👋 معاينة:",
    welcome_default: [
        "أهلًا {name}! مرحبًا بك في {group}! 🦅",
        "🎉 انضم {name} للتو، قولوا مرحبًا!",
        "أهلًا بك {name}! سعداء بوجودك 💪",
        "🚀 دخل {name} إلى المحادثة!",
        "وصل {name}! مرحبًا بك في {group} 🇲🇱",
    ],
    goodbye: "👋 غادر {name}. إلى اللقاء!",

    // Filters
    filter_added: "✅ تمت إضافة الفلتر.",
    filter_removed: "✅ تمت إزالة الفلتر.",
    filter_not_found: "❌ لا يوجد فلتر لهذه الكلمة.",
    filter_no_args: "💡 الاستخدام: /filter <الكلمة> <الرد>",
    filter_admin_only: "⛔ المشرفون فقط يمكنهم إدارة الفلاتر.",

    // Moderation
    kick_success: "👢 تم طرد {name}.",
    kick_no_reply: "💡 رد على رسالة الشخص لطرده.",
    kick_failed: "❌ تعذر الطرد، تحقق من صلاحياتي كمشرف.",
    ban_success: "🔨 تم حظر {name}.",
    ban_failed: "❌ تعذر الحظر، تحقق من صلاحياتي.",
    unban_success: "✅ تم رفع الحظر، يمكنه الانضمام من جديد.",
    pin_success: "📌 تم تثبيت الرسالة.",
    pin_failed: "❌ تعذر التثبيت، تأكد أنني أستطيع تثبيت الرسائل.",
    mute_success: "🔇 تم كتم {name} لمدة {duration}.",
    warn_added: "⚠️ تحذير {count}/3 لـ {name}.",
    warn_banned: "🔨 وصل {name} إلى 3 تحذيرات وتم حظره.",

    // Media
    media_fetching_video: "🎬 جارٍ جلب الفيديو، لحظة...",
    media_fetching_audio: "🎵 جارٍ استخراج الصوت...",
    media_fetching_ig: "📸 جارٍ الجلب من إنستغرام...",
    media_fetching_tw: "🐦 جارٍ التحميل من X...",
    media_fetching_fb: "📘 جارٍ الجلب من فيسبوك...",
    media_failed_yt: "❌ يوتيوب لا يستجيب الآن، حاول بعد قليل.",
    media_failed_ig: "❌ تعذر الجلب، هل الحساب خاص؟ المقاطع العامة تعمل أفضل.",
    media_failed_tw: "❌ هذه التغريدة بلا فيديو أو محمية.",
    media_failed_fb: "❌ الفيديوهات العامة فقط، الخاصة تحتاج تسجيل دخول.",
    media_failed_generic: "❌ تعذر تحميل هذا الرابط، جرب رابطًا آخر.",

    // Economy
    daily_claimed: "🎁 تم استلام المكافأة اليومية! +{amount} رصيد",
    daily_cooldown: "⏰ استلمتها اليوم بالفعل، عد بعد {time}.",
    balance_msg: "💰 الرصيد: {balance}",

    // Games
    roll_result: "🎲 النتيجة: {result}",
    coinflip_heads: "🪙 وجه!",
    coinflip_tails: "🪙 كتابة!",
};
