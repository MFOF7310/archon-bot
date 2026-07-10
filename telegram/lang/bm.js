"use strict";
module.exports = {
    // General
    error: "❌ Fɛn dɔ ma se ka kɛ — seginkɛ a kan tugun!",
    owner_only: "⛔ Nin ye jogomuso ta dɔrɔn!",
    admin_only: "⛔ Administrateuruw dɔrɔn, hakɛ to!",
    groups_only: "⚠️ Nin commande bɛ se ka baara kɛ groupew dɔrɔn de la!",
    no_db: "❌ Base de données ma sɔrɔ.",

    // Welcome
    welcome_on: "👋 Bisimilali fɛnw dayɛlɛ len do!",
    welcome_off: "🔴 Bisimilali datugulen do.",
    welcome_set: "✅ Bisimilali fɛn sɛbɛnna!",
    welcome_test: "Bisimilali jirali:",
    welcome_default: [
        "I ni ce {name}! I bisimila {group} kan, an bɛ kun! 🦅",
        "🎉 {name} donna — i ni ce!",
        "Baro {name}! Ani sɔrɔ 💪",
        "🚀 {name} donna causerie kɔnɔ!",
        "{name} nana! Bienvenido {group} 🇲🇱",
    ],
    goodbye: "👋 {name} ye gurupu quitté. Kanbɛ waati wɛrɛ!",

    // Filters
    filter_added: "✅ Filtre donna!",
    filter_removed: "✅ Filtre bɔra!",
    filter_not_found: "❌ Filtre ma sɔrɔ.",
    filter_no_args: "💡 Baara: /filter <kuma> <jaabi>",
    filter_admin_only: "⛔ Administrateuruw dɔrɔn.",

    // Moderation
    kick_success: "👢 {name} gɛn na ka bɔ gurupu la.",
    kick_no_reply: "💡 Mɔgɔ dɔ ka cikan jaabi ka a gɛn ka bɔ gurupu la.",
    kick_failed: "❌ {name} ma se ka gɛn ka bɔ — admin hakɛw lajɛ!",
    ban_success: "🔨 {name} ban ɲɛ sɔrɔla.",
    ban_failed: "❌ Ma se ka ban ka bɔ gurupu la— hakɛw lajɛ!",
    unban_success: "✅ Mɔgɔ ban bɔra a ma — a bɛ se ka segin ka na gurupu la!",
    pin_success: "📌 Cikan glonna!",
    pin_failed: "❌ Ma se ka glon — hakɛ lajɛ!",
    mute_success: "🔇 {name} dabara tugula, ka se {duration} ma.",
    warn_added: "⚠️ Kɔlɔsi {count}/3 {name} ma.",
    warn_banned: "🔨 {name} kɔlɔsi 3 sɔrɔra ka banni!",

    // Media
    media_fetching_video: "🎬 nbɛ ka ni vidéo sɔrɔli bolo da, hakɛ waati dɔnni dɔrɔn di yan...",
    media_fetching_audio: "🎵 Son taali bɛ senna...",
    media_fetching_ig: "📸 nbɛ ka Instagram video ta san fɛ kana ni a ye, hakɛto makɔnɔni la...",
    media_fetching_tw: "🐦 nbɛ ka X vidéo ta kana ni a ye, hakɛto makɔnɔni la...",
    media_fetching_fb: "📘 nbɛ ka Facebook vidéo ta kana n'a ye, hakɛto makɔnɔni la...",
    media_failed_yt: "❌ YouTube bɛ ka fɛrɛ boloda, — hakɛto i ka a lajɛ tugun!",
    media_failed_ig: "❌ Ma se ka sɔrɔ — compte privée? Reels publics ka fisa tɛlɛchargeli la!",
    media_failed_tw: "❌ Vidéo tɛ nin Tweet in na, walima a tanga len do taa li ma!",
    media_failed_fb: "❌ Vidéos publiques dɔrɔn de bɛ se ka taa, privewu mako bɛ login na!",
    media_failed_generic: "❌ Ni vidéo ma se ka tɛlɛcharge dɛɛ. Lien wɛrɛ lajɛ!",

    // Economy
    daily_claimed: "🎁 Tile rewards sɔrɔla! +{amount} crédits",
    daily_cooldown: "⏰ Bi sɔrɔli kɛra kaban! Segin kɛ a kan {time} kɔnɔ.",
    balance_msg: "💰 Wari: {balance} crédits",

    // Games
    roll_result: "🎲 I ye: {result} sɔrɔ kɛ",
    coinflip_heads: "🪙 Pile!",
    coinflip_tails: "🪙 Face!",
};
