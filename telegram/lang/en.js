"use strict";
module.exports = {
    // General
    error: "❌ Something went wrong — try again!",
    owner_only: "⛔ This one's for the owner only!",
    admin_only: "⛔ Admins only, sorry!",
    groups_only: "⚠️ This command only works in groups!",
    no_db: "❌ Database not connected.",

    // Welcome
    welcome_on: "👋 Welcome messages are now ON!",
    welcome_off: "🔴 Welcome messages turned off.",
    welcome_set: "✅ Welcome message updated!",
    welcome_test: "👋 Preview:",
    welcome_default: [
        "Hey {name}! Welcome to {group}! 🦅",
        "🎉 {name} just joined — say hello!",
        "Welcome aboard {name}! Glad you're here 💪",
        "🚀 {name} has entered the chat!",
        "{name} dropped in! Welcome to {group} 🇲🇱",
    ],
    goodbye: "👋 {name} has left. See you around!",

    // Filters
    filter_added: "✅ Filter added!",
    filter_removed: "✅ Filter removed!",
    filter_not_found: "❌ No filter found for that keyword.",
    filter_no_args: "💡 Usage: /filter <keyword> <response>",
    filter_admin_only: "⛔ Only admins can manage filters.",

    // Moderation
    kick_success: "👢 {name} has been kicked.",
    kick_no_reply: "💡 Reply to someone's message to kick them.",
    kick_failed: "❌ Couldn't kick — check my admin rights!",
    ban_success: "🔨 {name} has been banned.",
    ban_failed: "❌ Couldn't ban — check my permissions!",
    unban_success: "✅ User unbanned — they can rejoin now!",
    pin_success: "📌 Message pinned!",
    pin_failed: "❌ Couldn't pin — make sure I can pin messages!",
    mute_success: "🔇 {name} has been muted for {duration}.",
    warn_added: "⚠️ Warning {count}/3 for {name}.",
    warn_banned: "🔨 {name} hit 3 warnings and got banned!",

    // Media
    media_fetching_video: "🎬 Fetching that video, give me a sec...",
    media_fetching_audio: "🎵 Extracting audio...",
    media_fetching_ig: "📸 Grabbing that from Instagram...",
    media_fetching_tw: "🐦 Downloading from X...",
    media_fetching_fb: "📘 Grabbing from Facebook...",
    media_failed_yt: "❌ YouTube's being tricky right now — try again in a bit!",
    media_failed_ig: "❌ Couldn't grab that — private account? Public reels work best!",
    media_failed_tw: "❌ That tweet has no video or it's protected!",
    media_failed_fb: "❌ Public videos only — private ones need login!",
    media_failed_generic: "❌ Couldn't download that one. Try a different link!",

    // Economy
    daily_claimed: "🎁 Daily reward claimed! +{amount} credits",
    daily_cooldown: "⏰ Already claimed today! Come back in {time}.",
    balance_msg: "💰 Balance: {balance} credits",

    // Games
    roll_result: "🎲 You rolled: {result}",
    coinflip_heads: "🪙 Heads!",
    coinflip_tails: "🪙 Tails!",
};
