const axios = require('axios');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { card } = require('../lib/games/v2');
const { icon } = require('../lib/ui/icons');

/**
 * VoteSync Engine — The heart of the voting system. (v1.1 i18n: en/fr/zh/ar)
 * Does ONE job well: process a vote claim from any source.
 */

// ================= TEXTS (en/fr/zh/ar; Bambara falls back to English) =================
const T = {
    en: {
        got: '+{n} credits', thanks: 'Thanks for your vote, {user}',
        streak: 'Streak of **{days}**', milestone: 'Milestone reached: **+{bonus}** bonus included',
        nextMs: 'Next milestone: {days}', allMs: 'Every milestone reached',
        weekend: 'Weekend: your vote counts double', next: 'Next vote {when}', nextRemind: 'Next vote {when}. I\'ll let you know.',
        voteAgain: 'Vote again', remindOn: 'Remind me', remindOff: 'Stop reminders',
        remindTitle: 'You can vote again', remindStreak: 'Vote today to keep your **{days}** streak going.',
        remindFresh: 'Every vote earns **{base}** credits{weekend}.', weekendBit: ', double this weekend',
        remindFoot: 'You get this because you turned reminders on.',
        log: '{user} voted · +{n} · streak {days} · {guild}',
        days: ['day', 'days'],
    },
    fr: {
        got: '+{n} crédits', thanks: 'Merci pour ton vote, {user}',
        streak: 'Série de **{days}**', milestone: 'Palier atteint : **+{bonus}** de bonus inclus',
        nextMs: 'Prochain palier : {days}', allMs: 'Tous les paliers sont atteints',
        weekend: 'Week-end : ton vote compte double', next: 'Prochain vote {when}', nextRemind: 'Prochain vote {when}. Je te préviens.',
        voteAgain: 'Voter à nouveau', remindOn: 'Me rappeler', remindOff: 'Arrêter les rappels',
        remindTitle: 'Tu peux voter de nouveau', remindStreak: 'Vote aujourd\'hui pour garder ta série de **{days}**.',
        remindFresh: 'Chaque vote rapporte **{base}** crédits{weekend}.', weekendBit: ', le double ce week-end',
        remindFoot: 'Tu reçois ce message parce que tu as activé les rappels.',
        log: '{user} a voté · +{n} · série {days} · {guild}',
        days: ['jour', 'jours'],
    },
    zh: {
        got: '+{n} 积分', thanks: '感谢你的投票，{user}',
        streak: '连投 **{days}**', milestone: '达成里程碑：已含 **+{bonus}** 奖励',
        nextMs: '下一个里程碑：{days}', allMs: '所有里程碑都已达成',
        weekend: '周末：你的投票算双倍', next: '下次投票：{when}', nextRemind: '下次投票：{when}。到时我会提醒你。',
        voteAgain: '再投一票', remindOn: '提醒我', remindOff: '停止提醒',
        remindTitle: '你可以再次投票了', remindStreak: '今天投票，保持你 **{days}** 的连投。',
        remindFresh: '每票可得 **{base}** 积分{weekend}。', weekendBit: '，本周末双倍',
        remindFoot: '你开启了提醒，所以收到这条消息。',
        log: '{user} 投票了 · +{n} · 连投 {days} · {guild}',
        days: ['天', '天'],
    },
    ar: {
        got: '+{n} رصيد', thanks: 'شكرًا على تصويتك، {user}',
        streak: 'سلسلة **{days}**', milestone: 'وصلت إلى محطة: تشمل **+{bonus}** إضافية',
        nextMs: 'المحطة التالية: {days}', allMs: 'وصلت إلى كل المحطات',
        weekend: 'عطلة نهاية الأسبوع: تصويتك يُحسب مرتين', next: 'التصويت التالي {when}', nextRemind: 'التصويت التالي {when}. سأنبهك.',
        voteAgain: 'صوّت مجددًا', remindOn: 'ذكّرني', remindOff: 'أوقف التذكير',
        remindTitle: 'يمكنك التصويت مجددًا', remindStreak: 'صوّت اليوم لتحافظ على سلسلة **{days}**.',
        remindFresh: 'كل تصويت يمنحك **{base}** رصيد{weekend}.', weekendBit: '، والضعف في عطلة نهاية الأسبوع',
        remindFoot: 'تصلك هذه الرسالة لأنك فعّلت التذكير.',
        log: '{user} صوّت · +{n} · السلسلة {days} · {guild}',
        days: ['يوم', 'يوم'],
    },
};
const BASE = 1000;
const MILESTONES = [[7, 2000], [30, 5000], [100, 10000]];
const fill = (str, v = {}) => String(str).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? String(v[k]) : m));
const num = (n, lang) => Number(n || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
const dayWord = (n, lang) => `${num(n, lang)} ${(T[lang] || T.en).days[Number(n) === 1 ? 0 : 1]}`;
// The vote link carries the server, so a vote made from a server's card is paid on that server (Top.gg sends it back)
const voteUrl = (client, guildId) => `https://top.gg/bot/${client.user.id}/vote${guildId ? `?guild=${guildId}` : ''}`;

function langFor(client, guildId, userId) {
    try { return require('../lib/pick-lang').pickLang(client, guildId, null, userId) || 'en'; } catch { return 'en'; }
}

// Top.gg's weekend multiplier (Friday to Sunday): asked to Top.gg, kept 10 minutes; Friday-Sunday UTC if it can't answer
let _weekend = { at: 0, v: false };
async function isWeekend() {
    if (Date.now() - _weekend.at < 600000) return _weekend.v;
    let v = [5, 6, 0].includes(new Date().getUTCDay());
    try {
        const token = process.env.TOPGG_API_TOKEN;
        if (token) { const r = await axios.get('https://top.gg/api/weekend', { headers: { Authorization: token }, timeout: 4000 }); if (typeof r.data?.is_weekend === 'boolean') v = r.data.is_weekend; }
    } catch {}
    _weekend = { at: Date.now(), v };
    return v;
}

// ================= DB =================
function setupDB(db) {
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 10000');
    db.pragma('synchronous = NORMAL');

    const userVotesInfo = db.prepare(`PRAGMA table_info(user_votes)`).all();
    if (userVotesInfo.length > 0 && !userVotesInfo.find(c => c.name === 'guild_id')) {
        console.log(`[VOTESYNC] Migrating user_votes table to per-server partitioning schema...`);
        db.prepare(`ALTER TABLE user_votes RENAME TO user_votes_old`).run();
        db.prepare(`CREATE TABLE user_votes (
            user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
            total_votes INTEGER DEFAULT 0, current_streak INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0, last_vote_date INTEGER DEFAULT 0,
            total_rewards INTEGER DEFAULT 0, votes_this_month INTEGER DEFAULT 0,
            last_month_reset INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id)
        )`).run();
        try {
            db.prepare(`INSERT INTO user_votes (user_id, guild_id, total_votes, current_streak, best_streak, last_vote_date, total_rewards, votes_this_month, last_month_reset)
                SELECT user_id, '0', total_votes, current_streak, best_streak, last_vote_date, total_rewards, votes_this_month, last_month_reset FROM user_votes_old`).run();
            db.prepare(`DROP TABLE user_votes_old`).run();
            console.log(`[VOTESYNC] user_votes migration complete.`);
        } catch (e) {
            console.log(`[VOTESYNC] Migration data copy failed: ${e.message}`);
        }
    }

    const voteClaimsInfo = db.prepare(`PRAGMA table_info(vote_claims)`).all();
    if (voteClaimsInfo.length > 0 && !voteClaimsInfo.find(c => c.name === 'guild_id')) {
        console.log(`[VOTESYNC] Migrating vote_claims table to per-server partitioning schema...`);
        db.prepare(`ALTER TABLE vote_claims RENAME TO vote_claims_old`).run();
        db.prepare(`CREATE TABLE vote_claims (
            user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
            claim_date INTEGER, reward INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id, claim_date)
        )`).run();
        try {
            db.prepare(`INSERT INTO vote_claims (user_id, guild_id, claim_date, reward)
                SELECT user_id, '0', claim_date, reward FROM vote_claims_old`).run();
            db.prepare(`DROP TABLE vote_claims_old`).run();
            console.log(`[VOTESYNC] vote_claims migration complete.`);
        } catch (e) {
            console.log(`[VOTESYNC] vote_claims migration data copy failed: ${e.message}`);
        }
    }

    db.prepare(`CREATE TABLE IF NOT EXISTS user_votes (
        user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
        total_votes INTEGER DEFAULT 0, current_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0, last_vote_date INTEGER DEFAULT 0,
        total_rewards INTEGER DEFAULT 0, votes_this_month INTEGER DEFAULT 0,
        last_month_reset INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id)
    )`).run();
    db.prepare(`CREATE TABLE IF NOT EXISTS vote_claims (
        user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
        claim_date INTEGER, reward INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id, claim_date)
    )`).run();
}

function getStats(db, userId, guildId) {
    let s = db.prepare(`SELECT * FROM user_votes WHERE user_id = ? AND guild_id = ?`).get(userId, guildId);
    if (!s) s = { user_id: userId, guild_id: guildId, total_votes: 0, current_streak: 0, best_streak: 0, last_vote_date: 0, total_rewards: 0, votes_this_month: 0, last_month_reset: 0 };
    // Year and month together: November 2027 is not "the same month" as November 2026
    const now = Math.floor(Date.now() / 1000), d = new Date(), month = d.getUTCFullYear() * 12 + d.getUTCMonth();
    const lm = s.last_month_reset ? new Date(s.last_month_reset * 1000) : null;
    const lastMonth = lm ? lm.getUTCFullYear() * 12 + lm.getUTCMonth() : -1;
    if (month !== lastMonth) {
        s.votes_this_month = 0; s.last_month_reset = now;
        db.prepare(`UPDATE user_votes SET votes_this_month = 0, last_month_reset = ? WHERE user_id = ? AND guild_id = ?`).run(now, userId, guildId);
    }
    return s;
}

// ================= TOP.GG API =================
async function checkTopGGVote(userId) {
    const token = process.env.TOPGG_API_TOKEN;
    if (!token) return null;
    const botId = global.client?.user?.id || process.env.CLIENT_ID || '1472707869257367676';
    try {
        const res = await axios.get(`https://top.gg/api/bots/${botId}/check?userId=${userId}`, {
            headers: { Authorization: token }, timeout: 5000
        });
        return res.data?.voted === 1;
    } catch (e) { return null; }
}

// ================= CALCULATE REWARD =================
// The streak counts days (UTC, which is Bamako time), not votes: with a 12-hour cooldown two votes fit in one day,
// so "7 days" used to be reached after 3 and a half days, and a milestone could pay twice the same day.
const dayOf = (ts) => Math.floor((ts || 0) / 86400);
function streakAlive(lastVote, now = Math.floor(Date.now() / 1000)) { return !!lastVote && dayOf(now) - dayOf(lastVote) <= 1; }
function calculateReward(stats, weekend = false) {
    const now = Math.floor(Date.now() / 1000);
    const gap = stats.last_vote_date ? dayOf(now) - dayOf(stats.last_vote_date) : 99;
    const cur = stats.current_streak || 0;
    const streak = gap === 0 ? Math.max(cur, 1) : gap === 1 ? cur + 1 : 1;
    const grew = streak > cur || gap > 1;
    let bonus = 0, milestone = null;
    if (grew && streak === 7) { bonus = 2000; milestone = '7'; }
    else if (grew && streak === 30) { bonus = 5000; milestone = '30'; }
    else if (grew && streak === 100) { bonus = 10000; milestone = '100'; }
    const base = weekend ? BASE * 2 : BASE;
    return { streak, bonus, base, weekend: !!weekend, total: base + bonus, best: Math.max(streak, stats.best_streak || 0), milestone };
}

// ================= UPDATE DB =================
function updateDB(db, userId, guildId, result, stats, addCredits = null) {
    const now = Math.floor(Date.now() / 1000);
    const newTotalVotes = (stats.total_votes || 0) + 1;
    const newTotalRewards = (stats.total_rewards || 0) + result.total;
    const newVotesThisMonth = (stats.votes_this_month || 0) + 1;

    db.prepare(`INSERT OR REPLACE INTO user_votes (user_id, guild_id, total_votes, current_streak, best_streak, last_vote_date, total_rewards, votes_this_month, last_month_reset)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, guildId, newTotalVotes, result.streak, result.best, now, newTotalRewards, newVotesThisMonth, stats.last_month_reset || now);

    db.prepare(`INSERT OR IGNORE INTO vote_claims (user_id, guild_id, claim_date, reward) VALUES (?, ?, ?, ?)`).run(userId, guildId, now, result.total);

    // Through the bot's economy helper when there is one: it also updates the cached profile. Writing the table
    // alone let the next batched save of the cached profile put the old balance back (the credits "vanished").
    if (typeof addCredits === 'function') {
        const r = addCredits(userId, guildId, result.total);
        if (!r?.ok) throw new Error(r?.error || 'credits not added');
    } else if (!db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`).run(result.total, userId, guildId).changes) {
        db.prepare(`INSERT INTO users (id, guild_id, credits, xp, level, streak_days, last_daily, total_dailies, highest_streak)
            VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0)`).run(userId, guildId || '0', result.total);
    }

    return { newTotalVotes, newTotalRewards };
}

// ================= REMINDERS =================
// Off by default. When on, ARCHON sends one DM when the member's next vote opens (12 h after the last one).
let _remReady = false;
function remindersTable(db) {
    if (_remReady) return;
    db.prepare('CREATE TABLE IF NOT EXISTS vote_reminders (user_id TEXT PRIMARY KEY, guild_id TEXT, enabled INTEGER DEFAULT 0, notified_for INTEGER DEFAULT 0)').run();
    _remReady = true;
}
function reminderOn(db, userId) {
    try { remindersTable(db); return !!db.prepare('SELECT enabled FROM vote_reminders WHERE user_id = ?').get(userId)?.enabled; } catch { return false; }
}
function setReminder(db, userId, guildId, on) {
    remindersTable(db);
    db.prepare(`INSERT INTO vote_reminders (user_id, guild_id, enabled) VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, guild_id = COALESCE(excluded.guild_id, vote_reminders.guild_id)`).run(userId, guildId || null, on ? 1 : 0);
    return on;
}
function remindButton(lang, on, where) {
    const t = T[lang] || T.en;
    return new ButtonBuilder().setCustomId(on ? 'vote_remindoff_slash' : 'vote_remindon_slash').setLabel(on ? t.remindOff : t.remindOn)
        .setStyle(ButtonStyle.Secondary).setEmoji(icon(on ? 'bellOff' : 'bell', where));
}

async function sendReminders(client) {
    const db = client.db;
    if (!db) return;
    remindersTable(db);
    const now = Math.floor(Date.now() / 1000);
    let due = [];
    try {
        due = db.prepare(`SELECT r.user_id, r.guild_id, MAX(v.last_vote_date) AS last FROM vote_reminders r
            JOIN user_votes v ON v.user_id = r.user_id WHERE r.enabled = 1 GROUP BY r.user_id
            HAVING last > 0 AND last + 43200 <= ? AND COALESCE(MAX(r.notified_for), 0) < last`).all(now);
    } catch (e) { return console.log('[VOTE REMIND]', e.message); }
    const weekend = due.length ? await isWeekend() : false;
    for (const r of due) {
        db.prepare('UPDATE vote_reminders SET notified_for = ? WHERE user_id = ?').run(r.last, r.user_id);   // once per vote, even if the DM fails
        const user = await client.users.fetch(r.user_id).catch(() => null);
        if (!user) continue;
        const lang = langFor(client, r.guild_id, r.user_id), t = T[lang] || T.en;
        const st = r.guild_id ? getStats(db, r.user_id, r.guild_id) : null;
        const keep = st && st.current_streak > 0 && streakAlive(st.last_vote_date, now);
        const body = keep ? fill(t.remindStreak, { days: dayWord(st.current_streak, lang) })
            : fill(t.remindFresh, { base: num(BASE, lang), weekend: weekend ? t.weekendBit : '' });
        const msg = card(0x1D9E75, [
            { text: `### ${icon('bell')} ${t.remindTitle}\n${body}` },
            { row: new ActionRowBuilder().addComponents(
                new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(voteUrl(client, r.guild_id)).setLabel(t.voteAgain).setEmoji(icon('star')),
                remindButton(lang, true)) },
            { text: `-# ${t.remindFoot}` },
        ]);
        await user.send(msg).catch(() => {});
        await new Promise((res) => setTimeout(res, 800));
    }
}
let _remTimer = null;
function startReminders(client) {
    if (_remTimer) return;
    _remTimer = setInterval(() => sendReminders(client).catch((e) => console.log('[VOTE REMIND]', e.message)), 120000);
}

// ================= DM RECEIPT =================
function buildDM(client, user, result, lang, guildName, reminders) {
    const t = T[lang] || T.en, nextTs = Math.floor(Date.now() / 1000) + 43200;
    const lines = [`${icon('streak')} ${fill(t.streak, { days: dayWord(result.streak, lang) })}`];
    if (result.milestone) lines.push(`${icon('trophy')} ${fill(t.milestone, { bonus: num(result.bonus, lang) })}`);
    const nm = MILESTONES.find(([d]) => result.streak < d);
    lines.push(`${icon('milestone')} ${nm ? fill(t.nextMs, { days: dayWord(nm[0], lang) }) : t.allMs}`);
    if (result.weekend) lines.push(`${icon('weekend')} ${t.weekend}`);
    lines.push(`${icon('clock')} ${fill(reminders ? t.nextRemind : t.next, { when: `<t:${nextTs}:R>` })}`);
    const head = `### ${fill(t.got, { n: num(result.total, lang) })}\n-# ${fill(t.thanks, { user: user.globalName || user.username })}${guildName ? ` · ${guildName}` : ''}`;
    const avatar = user.displayAvatarURL?.({ size: 128 });
    return {
        nextVote: nextTs,
        payload: card(0xBA7517, [avatar ? { thumbnail: [head, avatar] } : { text: head }, { rule: true }, { text: lines.join('\n') },
            { row: new ActionRowBuilder().addComponents(
                new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(voteUrl(client, result.guildId)).setLabel(t.voteAgain).setEmoji(icon('star')),
                remindButton(lang, reminders)) }]),
    };
}

// One plain line in the owner's log channel (LOG_CHANNEL_ID), no ping
async function sendPublicLog(client, user, result, lang, guildName) {
    const logId = process.env.LOG_CHANNEL_ID;
    if (!logId) return;
    const ch = await client.channels.fetch(logId).catch(() => null);
    if (!ch?.isTextBased?.()) return;
    const t = T.en;
    await ch.send({ content: `${icon('votes', ch)} ${fill(t.log, { user: user.username, n: num(result.total, 'en'), days: dayWord(result.streak, 'en'), guild: guildName || '?' })}${result.weekend ? ' · weekend x2' : ''}`, allowedMentions: { parse: [] } }).catch(() => {});
}

// ================= PROCESS VOTE (Main Entry Point) =================
const MAIN_GUILD = process.env.GUILD_ID;
let _homeReady = false;
function ensureHome(db) {
    if (_homeReady) return;
    db.prepare('CREATE TABLE IF NOT EXISTS vote_home (user_id TEXT PRIMARY KEY, guild_id TEXT, ts INTEGER)').run();
    _homeReady = true;
}

async function resolveHomeGuild(userId, client) {
    const db = client.db;
    ensureHome(db);
    const isMember = async (gid) => {
        const g = client.guilds.cache.get(String(gid));
        if (!g) return false;
        return !!(g.members.cache.get(userId) || await g.members.fetch(userId).catch(() => null));
    };
    const home = db.prepare('SELECT guild_id FROM vote_home WHERE user_id = ?').get(userId)?.guild_id;
    if (home && await isMember(home)) return home;
    if (await isMember(MAIN_GUILD)) return MAIN_GUILD;
    const rows = db.prepare('SELECT guild_id FROM users WHERE id = ? ORDER BY xp DESC LIMIT 10').all(userId);
    for (const r of rows) if (await isMember(r.guild_id)) return r.guild_id;
    return null;
}

const claiming = new Set();   // one claim at a time per member
async function processVote(userId, guildId, client, opts = {}) {
    if (claiming.has(userId)) return { success: false, error: 'COOLDOWN', nextVote: Math.floor(Date.now() / 1000) + 5 };
    claiming.add(userId);
    try { return await _processVote(userId, guildId, client, opts); }
    finally { claiming.delete(userId); }
}

async function _processVote(userId, guildId, client, opts = {}) {
    const db = client.db;
    if (!db) return { success: false, error: 'NO_DB' };
    setupDB(db);
    if (opts.source !== 'webhook' && guildId) {
        ensureHome(db);
        db.prepare('INSERT OR REPLACE INTO vote_home (user_id, guild_id, ts) VALUES (?, ?, ?)').run(userId, guildId, Math.floor(Date.now() / 1000));
    }

    // 1. Check Top.gg
    const voted = await checkTopGGVote(userId);
    if (voted === false) return { success: false, error: 'NOT_VOTED' };
    if (voted === null) return { success: false, error: 'CHECK_FAILED' };

    // Weekend: the webhook says it (weight 2); a claim asks Top.gg
    const weekend = typeof opts.weekend === 'boolean' ? opts.weekend : await isWeekend();

    // 2-4. Cooldown check, reward and write in one transaction, after the Top.gg answer: two quick presses on Claim
    // (or Claim at the same time as the webhook) used to both pass the check during the wait and pay twice.
    let stats, result, totals;
    try {
        const out = db.transaction(() => {
            const st = getStats(db, userId, guildId);
            const now = Math.floor(Date.now() / 1000);
            const lastAny = db.prepare('SELECT MAX(last_vote_date) AS t FROM user_votes WHERE user_id = ?').get(userId)?.t || 0;
            const cooldown = Math.max(st.last_vote_date || 0, lastAny) + 43200;
            if (now < cooldown) return { cooldown };
            const r = calculateReward(st, weekend);
            return { st, r, totals: updateDB(db, userId, guildId, r, st, client.addCredits) };
        })();
        if (out.cooldown) return { success: false, error: 'COOLDOWN', nextVote: out.cooldown };
        ({ st: stats, r: result, totals } = out);
    } catch (e) {
        console.error('[VOTESYNC] claim failed:', e.message);
        return { success: false, error: 'PROCESS_FAILED' };
    }
    const { newTotalVotes, newTotalRewards } = totals;

    // 5. Fetch user
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return { success: false, error: 'USER_NOT_FOUND' };

    // 6. The member's language (server setting, then their /mylang)
    result.guildId = guildId;
    const lang = langFor(client, guildId, userId);
    const guildName = client.guilds.cache.get(String(guildId))?.name || null;

    // 7. Receipt by DM
    let dmSent = false;
    const { payload, nextVote } = buildDM(client, user, result, lang, guildName, reminderOn(db, userId));
    await user.send(payload).then(() => { dmSent = true; }).catch((err) => console.log(`[VOTESYNC] DM failed for ${userId}: ${err.message}`));

    // 8. Owner's log line
    await sendPublicLog(client, user, result, lang, guildName);

    console.log(`[VOTESYNC] ${user.username} | +${result.total}${result.weekend ? ' (weekend)' : ''} | streak ${result.streak} | ${guildName || guildId} | DM ${dmSent ? 'sent' : 'failed'}`);
    return { success: true, ...result, nextVote, lang, dmSent, total_votes: newTotalVotes, total_rewards: newTotalRewards };
}

// ================= MODULE =================
module.exports = {
    name: 'votesync',
    description: 'Internal vote processing engine — called by vote.js',
    category: 'SYSTEM',
    hidden: true,
    processVote,
    resolveHomeGuild,
    checkTopGGVote,
    setupDB,
    getStats,
    calculateReward,
    streakAlive,
    isWeekend,
    reminderOn,
    setReminder,
    remindButton,
    startReminders,
    voteUrl,
    T
};
