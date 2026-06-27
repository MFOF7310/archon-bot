// ═══════════════════════════════════════════
//  TG COMMAND: Start (Button Callback Handler)
//  Handles all /start menu button interactions
// ═══════════════════════════════════════════

const { ButtonBuilder } = require('./_buttons');
const os = require('os');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const formatUptime = (s) => { const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60); return d>0?`${d}d ${h}h ${m}m`:h>0?`${h}h ${m}m`:`${m}m`; };
const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';

module.exports = {
    name: 'start',
    description: 'Welcome menu (button handler)',
    category: 'System',
    hidden: true, // Don't show in help list

    handler: async (ctx) => {
        // /start is handled as a built-in in bot.js
        // This plugin just exists for the callback handler
        ctx.replyHTML(`Use <code>/start</code> to see the welcome menu.`);
    },

    handleCallback: async (ctx, data) => {
        const bridge = ctx.bridge;

        switch (data) {

            // ── 🤖 Chat with AI ──
            case 'start_ai': {
                await ctx.answerCallback('AI Assistant');

                const bb = new ButtonBuilder()
                    .add('💬 Start Chat', 'lydia_on')
                    .add('❓ Ask a Question', 'lydia_ask')
                    .newline()
                    .back('🔙 Back', 'menu_main')
                    .build();

                await ctx.bridge.sendTo(ctx.chatId,
                    `🤖 <b>LYDIA AI ASSISTANT</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Powered by <b>Gemini 2.0</b> via OpenRouter.\n\n` +
                    `• <code>/lydia &lt;message&gt;</code> — Chat with me\n` +
                    `• <code>/lydia on</code> — Enable auto-reply mode\n` +
                    `• <code>/lydia off</code> — Disable auto-reply\n` +
                    `• <code>/lydia clear</code> — Reset conversation\n\n` +
                    `I remember up to 12 messages and can help with questions, coding, writing, and more!\n\n` +
                    `💡 <i>I also respond when you mention my keywords like "archon", "bamako", or "cg223"!</i>`,
                    { parse_mode: 'HTML', extra: { reply_markup: bb } }
                );
                return true;
            }

            // ── 🎮 Play Games ──
            case 'start_games': {
                await ctx.answerCallback('Games Menu');

                const bb = new ButtonBuilder()
                    .emoji('🎯', 'Trivia Quiz', 'game_trivia')
                    .emoji('🔤', 'Word Guess', 'game_word')
                    .newline()
                    .emoji('🎲', 'Roll Dice', 'game_roll')
                    .emoji('🪙', 'Coin Flip', 'game_flip')
                    .newline()
                    .emoji('🏆', 'Leaderboard', 'cmd_leaderboard')
                    .back('🔙 Back', 'menu_main')
                    .build();

                await ctx.bridge.sendTo(ctx.chatId,
                    `🎮 <b>GAMES & FUN</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `<b>🎯 Trivia</b> — Test your knowledge with 25+ questions\n` +
                    `<b>🔤 Word Guess</b> — Hangman-style letter guessing\n` +
                    `<b>🎲 Roll Dice</b> — Roll d6, d20, or custom dice\n` +
                    `<b>🪙 Coin Flip</b> — Heads or tails?\n\n` +
                    `Earn XP and climb the leaderboard!\n\n` +
                    `💡 <i>All games work in any chat — groups, channels, or DMs!</i>`,
                    { parse_mode: 'HTML', extra: { reply_markup: bb } }
                );
                return true;
            }

            // ── 💰 Economy ──
            case 'start_economy': {
                await ctx.answerCallback('Economy Menu');

                const bb = new ButtonBuilder()
                    .emoji('🎁', 'Daily Reward', 'start_daily')
                    .emoji('💰', 'My Balance', 'start_balance')
                    .newline()
                    .emoji('📊', 'My Rank', 'start_rank')
                    .emoji('📋', 'My Profile', 'start_profile')
                    .newline()
                    .emoji('🏆', 'Leaderboard', 'cmd_leaderboard')
                    .emoji('📈', 'Invest', 'start_invest')
                    .newline()
                    .back('🔙 Back', 'menu_main')
                    .build();

                await ctx.bridge.sendTo(ctx.chatId,
                    `💰 <b>ECONOMY SYSTEM</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Welcome to the <b>Bamako Economy</b>!\n\n` +
                    `• <code>/daily</code> — Claim daily rewards with streak bonuses\n` +
                    `• <code>/balance</code> — Check your credits\n` +
                    `• <code>/rank</code> — View your level and XP progress\n` +
                    `• <code>/profile</code> — Full stats overview\n` +
                    `• <code>/leaderboard</code> — Top players\n` +
                    `• <code>/invest</code> — Invest in the Bamako Market\n\n` +
                    `🔥 <b>Streak Bonuses:</b> 7 days = +500 🪙 · 30 days = +2000 🪙\n` +
                    `🏆 <b>5 Ranks:</b> Neural Recruit → System Architect`,
                    { parse_mode: 'HTML', extra: { reply_markup: bb } }
                );
                return true;
            }

            // ── 🛠️ Utility ──
            case 'start_utility': {
                await ctx.answerCallback('Utility Tools');

                const bb = new ButtonBuilder()
                    .emoji('🌤️', 'Weather', 'start_weather')
                    .emoji('💎', 'Crypto', 'start_crypto')
                    .newline()
                    .emoji('🌐', 'Translate', 'start_translate')
                    .emoji('⏰', 'Reminder', 'start_reminder')
                    .newline()
                    .emoji('🎬', 'Video DL', 'start_douyin')
                    .emoji('😂', 'Joke', 'start_joke')
                    .newline()
                    .back('🔙 Back', 'menu_main')
                    .build();

                await ctx.bridge.sendTo(ctx.chatId,
                    `🛠️ <b>UTILITY TOOLS</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `<b>🌤️ Weather</b> — <code>/weather Bamako</code>\n` +
                    `<b>💎 Crypto</b> — <code>/crypto bitcoin</code>\n` +
                    `<b>🌐 Translate</b> — <code>/translate Hello fr</code>\n` +
                    `<b>⏰ Reminder</b> — <code>/reminder 2h Meeting</code>\n` +
                    `<b>🎬 Video DL</b> — <code>/douyin &lt;url&gt;</code>\n` +
                    `<b>😂 Joke</b> — <code>/joke</code>\n\n` +
                    `Also available:\n` +
                    `<code>/id</code> · <code>/ping</code> · <code>/alive</code> · <code>/creator</code>`,
                    { parse_mode: 'HTML', extra: { reply_markup: bb } }
                );
                return true;
            }

            // ── ℹ️ About ──
            case 'start_about': {
                await ctx.answerCallback('About Archon');

                const guilds = ctx.client?.guilds?.cache || new Map();
                const arr = Array.from(guilds.values());
                const totalM = arr.reduce((a,g) => a+(g.memberCount||0), 0);
                const mem = process.process?.memoryUsage ? process.memoryUsage() : { rss: 0 };
                const ramU = Math.round(mem.rss/1024/1024);
                const ping = Math.round(ctx.client?.ws?.ping||0);
                const cpu = os.cpus()[0];

                const bb = new ButtonBuilder()
                    .emoji('📋', 'Commands', 'cmd_help')
                    .emoji('💬', 'Feedback', 'start_feedback')
                    .newline()
                    .url('🔗 GitHub', 'https://github.com/MFOF7310')
                    .back('🔙 Back', 'menu_main')
                    .build();

                await ctx.bridge.sendTo(ctx.chatId,
                    `🦅 <b>ABOUT ARCHON CG-223</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `<b>Architect:</b> Moussa Fofana\n` +
                    `<b>Telegram:</b> @mfof7310\n` +
                    `<b>Discord:</b> mfof7559\n` +
                    `<b>GitHub:</b> github.com/MFOF7310\n` +
                    `<b>Location:</b> Bamako, Mali 🇲🇱\n\n` +
                    `<b>⚡ SYSTEM STATS</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Version   · v3.0.0\n` +
                    `Node      · BAMAKO_223\n` +
                    `CPU       · ${cpu.model.split('@')[0].trim()}\n` +
                    `Cores     · ${os.cpus().length}\n` +
                    `RAM       · ${ramU}MB\n` +
                    `Ping      · ${ping}ms\n` +
                    `Discord   · ${arr.length} servers · ${formatNumber(totalM)} members\n` +
                    `Telegram  · ${bridge.commands.size} commands\n` +
                    `Uptime    · ${formatUptime(process.uptime())}\n\n` +
                    `<i>"Digital Sovereignty · BAMAKO_223"</i>`,
                    { parse_mode: 'HTML', extra: { reply_markup: bb } }
                );
                return true;
            }

            // ── Quick action: Daily ──
            case 'start_daily': {
                await ctx.answerCallback('Opening Daily...');
                const daily = require('./daily');
                ctx.args = [];
                await daily.handler(ctx);
                return true;
            }

            // ── Quick action: Balance ──
            case 'start_balance': {
                await ctx.answerCallback('Checking Balance...');
                const balance = require('./balance');
                ctx.args = [];
                await balance.handler(ctx);
                return true;
            }

            // ── Quick action: Rank ──
            case 'start_rank': {
                await ctx.answerCallback('Loading Rank...');
                const rank = require('./rank');
                ctx.args = [];
                await rank.handler(ctx);
                return true;
            }

            // ── Quick action: Profile ──
            case 'start_profile': {
                await ctx.answerCallback('Loading Profile...');
                const profile = require('./profile');
                ctx.args = [];
                await profile.handler(ctx);
                return true;
            }

            // ── Quick action: Invest ──
            case 'start_invest': {
                await ctx.answerCallback('Opening Market...');
                const invest = require('./invest');
                ctx.args = ['status'];
                await invest.handler(ctx);
                return true;
            }

            // ── Quick action: Feedback ──
            case 'start_feedback': {
                await ctx.answerCallback('Send Feedback');
                await ctx.bridge.sendTo(ctx.chatId,
                    `💬 <b>SEND FEEDBACK</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Have a suggestion or found a bug?\n\n` +
                    `<code>/feedback Your message here</code>\n\n` +
                    `It goes directly to @mfof7310!`,
                    { parse_mode: 'HTML' }
                );
                return true;
            }

            // ── Info pages (text-only, no buttons to keep it simple) ──
            case 'start_weather':
                await ctx.answerCallback('Weather');
                await ctx.bridge.sendTo(ctx.chatId,
                    `🌤️ <b>WEATHER</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n<code>/weather Bamako</code>\n<code>/weather London</code>\n<code>/weather Tokyo</code>\n\nGet current conditions for any city worldwide!`,
                    { parse_mode: 'HTML' });
                return true;

            case 'start_crypto':
                await ctx.answerCallback('Crypto');
                await ctx.bridge.sendTo(ctx.chatId,
                    `💎 <b>CRYPTO PRICES</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n<code>/crypto bitcoin</code>\n<code>/crypto eth</code>\n<code>/crypto sol</code>\n\nLive prices from CoinGecko!`,
                    { parse_mode: 'HTML' });
                return true;

            case 'start_translate':
                await ctx.answerCallback('Translate');
                await ctx.bridge.sendTo(ctx.chatId,
                    `🌐 <b>TRANSLATOR</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n<code>/translate Hello world fr</code>\n<code>/translate fr:en Bonjour</code>\n\nSupports 15+ languages!`,
                    { parse_mode: 'HTML' });
                return true;

            case 'start_reminder':
                await ctx.answerCallback('Reminder');
                await ctx.bridge.sendTo(ctx.chatId,
                    `⏰ <b>REMINDER</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n<code>/reminder 30m Check oven</code>\n<code>/reminder 2h Meeting</code>\n<code>/reminder 1d Birthday</code>\n\nI'll ping you when time's up!`,
                    { parse_mode: 'HTML' });
                return true;

            case 'start_douyin':
                await ctx.answerCallback('Video Downloader');
                await ctx.bridge.sendTo(ctx.chatId,
                    `🎬 <b>VIDEO DOWNLOADER</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n<code>/douyin &lt;url&gt;</code>\n<code>/tiktok &lt;url&gt;</code>\n<code>/tt &lt;url&gt;</code>\n\nDownload TikTok & Douyin videos in HD!`,
                    { parse_mode: 'HTML' });
                return true;

            case 'start_joke':
                await ctx.answerCallback('Joke');
                const joke = require('./joke');
                ctx.args = [];
                await joke.handler(ctx);
                return true;

            // ── Lydia sub-actions ──
            case 'lydia_on': {
                await ctx.answerCallback('AI Enabled!');
                ctx.lydiaActiveChats.add(String(ctx.chatId));
                await ctx.bridge.sendTo(ctx.chatId,
                    `🟢 <b>Lydia AI is now ACTIVE!</b>\n\nI'll respond to all your messages in this chat.\n\n<code>/lydia off</code> to disable.`,
                    { parse_mode: 'HTML' });
                return true;
            }

            case 'lydia_ask': {
                await ctx.answerCallback('Ask me anything!');
                await ctx.bridge.sendTo(ctx.chatId,
                    `💬 <b>Just send me a message!</b>\n\nOr use:\n<code>/lydia What is quantum computing?</code>`,
                    { parse_mode: 'HTML' });
                return true;
            }

            default:
                return false;
        }
    }
};
