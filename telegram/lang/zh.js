"use strict";
module.exports = {
    // General
    error: "❌ 出了点问题 — 再试一次吧！",
    owner_only: "⛔ 这个只有所有者才能用！",
    admin_only: "⛔ 仅限管理员，抱歉！",
    groups_only: "⚠️ 此命令只在群组中有效！",
    no_db: "❌ 数据库未连接。",

    // Welcome
    welcome_on: "👋 欢迎消息已开启！",
    welcome_off: "🔴 欢迎消息已关闭。",
    welcome_set: "✅ 欢迎消息已更新！",
    welcome_test: "👋 预览：",
    welcome_default: [
        "嘿 {name}！欢迎来到 {group}！🦅",
        "🎉 {name} 刚刚加入 — 打个招呼吧！",
        "欢迎 {name}！很高兴你在这里 💪",
        "🚀 {name} 进入了聊天室！",
        "{name} 来了！欢迎来到 {group} 🇲🇱",
    ],
    goodbye: "👋 {name} 已离开。再见！",

    // Filters
    filter_added: "✅ 过滤器已添加！",
    filter_removed: "✅ 过滤器已删除！",
    filter_not_found: "❌ 找不到该关键词的过滤器。",
    filter_no_args: "💡 用法：/filter <关键词> <回复>",
    filter_admin_only: "⛔ 只有管理员可以管理过滤器。",

    // Moderation
    kick_success: "👢 {name} 已被踢出。",
    kick_no_reply: "💡 回复某人的消息来踢出他们。",
    kick_failed: "❌ 无法踢出 — 检查我的管理员权限！",
    ban_success: "🔨 {name} 已被封禁。",
    ban_failed: "❌ 无法封禁 — 检查我的权限！",
    unban_success: "✅ 用户已解禁 — 可以重新加入了！",
    pin_success: "📌 消息已置顶！",
    pin_failed: "❌ 无法置顶 — 确保我有置顶权限！",
    mute_success: "🔇 {name} 已被禁言 {duration}。",
    warn_added: "⚠️ {name} 第 {count}/3 次警告。",
    warn_banned: "🔨 {name} 收到3次警告，已被封禁！",

    // Media
    media_fetching_video: "🎬 正在获取视频，稍等...",
    media_fetching_audio: "🎵 正在提取音频...",
    media_fetching_ig: "📸 正在从 Instagram 获取...",
    media_fetching_tw: "🐦 正在从 X 下载...",
    media_fetching_fb: "📘 正在从 Facebook 获取...",
    media_failed_yt: "❌ YouTube 现在有点问题 — 稍后再试！",
    media_failed_ig: "❌ 无法获取 — 私人账号？公开帖子效果最好！",
    media_failed_tw: "❌ 该推文没有视频或已受保护！",
    media_failed_fb: "❌ 仅限公开视频 — 私人视频需要登录！",
    media_failed_generic: "❌ 无法下载。试试其他链接！",

    // Economy
    daily_claimed: "🎁 每日奖励已领取！+{amount} 积分",
    daily_cooldown: "⏰ 今天已经领取了！{time} 后再来。",
    balance_msg: "💰 余额：{balance} 积分",

    // Games
    roll_result: "🎲 你掷出了：{result}",
    coinflip_heads: "🪙 正面！",
    coinflip_tails: "🪙 反面！",
};
