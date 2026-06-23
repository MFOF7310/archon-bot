const { EmbedBuilder, SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

// ================= THRESHOLDS =================
const SPAM_THRESHOLD = 3;
const SPAM_WINDOW = 5000;
const CAPS_RATIO = 0.7;
const EMOJI_RATIO = 0.5;
const MENTION_LIMIT = 4;
const REPEAT_WINDOW = 15000;
const MAX_HISTORY = 100;
const IMAGE_SPAM_LIMIT = 2;
const IMAGE_SPAM_WINDOW = 10000;
const EVERYONE_COOLDOWN = 30000;

// ================= STATE =================
const history = new Map();
const appealCooldowns = new Map();
const everyoneCooldowns = new Map();
const APPEAL_COOLDOWN = 86400000;

// ================= APPEAL TRIBUNAL STATE =================
const appealTribunal = new Map(); // appealId => { guildId, userId, ownerId, status, messageId, channelId, expiresAt }

// Auto-cleanup expired tribunal entries every hour
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of appealTribunal) {
        if (data.expiresAt < now) appealTribunal.delete(id);
    }
}, 3600000);

// ================= MALICIOUS PATTERNS =================
const MALICIOUS = [
    /discordg1ft/i, /free-nitro/i, /steanm/i, /grabify\./i, /iplogger\./i,
    /free\s*tokens?/i, /dm\s*(me|for)\s*(nitro|reward)/i, /self[-\s]?bot/i, /massdm/i,
    /\.(ru|tk|ml|ga|cf)\//i, /discord\.(?!com|gg)/i,
    /(?:https?:\/\/)?(?:www\.)?discord(?:app)?\.(?:com|gg)\/gift\/[a-zA-Z0-9]{16,}/i,
    /t\.me\/\+?[a-zA-Z0-9_-]+/i,
];
const INVITE_RE = /discord\.gg\/[a-zA-Z0-9_-]+/gi;
const ANY_LINK_RE = /https?:\/\/[^\s<>"`{}|\[\]]+/gi;

// ================= DEFAULT DOMAIN WHITELIST =================
const DEFAULT_DOMAIN_WHITELIST = new Set([
    'google.com', 'www.google.com', 'youtube.com', 'www.youtube.com',
    'youtu.be', 'drive.google.com', 'docs.google.com', 'photos.google.com',
    'github.com', 'www.github.com', 'raw.githubusercontent.com',
    'stackoverflow.com', 'www.stackoverflow.com', 'stackexchange.com',
    'gitlab.com', 'www.gitlab.com', 'codepen.io', 'replit.com',
    'twitter.com', 'x.com', 'www.twitter.com', 'www.x.com',
    'instagram.com', 'www.instagram.com', 'tiktok.com', 'www.tiktok.com',
    'facebook.com', 'www.facebook.com', 'reddit.com', 'www.reddit.com',
    'pinterest.com', 'www.pinterest.com', 'imgur.com', 'www.imgur.com',
    'i.imgur.com', 'tenor.com', 'www.tenor.com', 'media.tenor.com',
    'giphy.com', 'www.giphy.com', 'media.giphy.com',
    'cdn.discordapp.com', 'media.discordapp.net',
    'pastebin.com', 'www.pastebin.com', 'wikipedia.org', 'www.wikipedia.org',
    'en.wikipedia.org', 'spotify.com', 'www.spotify.com', 'open.spotify.com',
    'steamcommunity.com', 'store.steampowered.com',
    'bamako-steel-dev.xyz', 'www.bamako-steel-dev.xyz',
]);

function extractDomain(url) {
    try {
        const u = new URL(url);
        return u.hostname.toLowerCase();
    } catch {
        const m = url.match(/^(?:https?:\/\/)?([^\/\s:]+)/i);
        return m ? m[1].toLowerCase() : '';
    }
}

function isDomainWhitelisted(content, customWhitelist) {
    const links = content.match(ANY_LINK_RE);
    if (!links) return true;
    const whitelist = new Set([...DEFAULT_DOMAIN_WHITELIST, ...(customWhitelist || [])]);
    for (const link of links) {
        const domain = extractDomain(link);
        if (!domain) continue;
        if (whitelist.has(domain)) continue;
        const parts = domain.split('.');
        let found = false;
        for (let i = 0; i < parts.length - 1; i++) {
            const parent = parts.slice(i).join('.');
            if (whitelist.has(parent)) { found = true; break; }
        }
        if (!found) return false;
    }
    return true;
}

function parseDomainWhitelist(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function key(uid, gid) { return `${uid}:${gid}`; }

setInterval(() => {
    const cutoff = Date.now() - 600000;
    for (const [k, v] of history) { if (v.last < cutoff) history.delete(k); }
}, 600000);

setInterval(() => {
    const cutoff = Date.now() - APPEAL_COOLDOWN;
    for (const [uid, ts] of appealCooldowns) { if (ts < cutoff) appealCooldowns.delete(uid); }
}, 3600000);

setInterval(() => {
    const cutoff = Date.now() - 300000;
    for (const [gid, ts] of everyoneCooldowns) { if (ts < cutoff) everyoneCooldowns.delete(gid); }
}, 60000);

function normalize(s) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

function similarity(a, b) {
    if (!a || !b) return 0;
    const m = [], al = a.length, bl = b.length;
    for (let i = 0; i <= al; i++) m[i] = [i];
    for (let j = 0; j <= bl; j++) m[0][j] = j;
    for (let i = 1; i <= al; i++) for (let j = 1; j <= bl; j++) m[i][j] = Math.min(m[i-1][j]+1, m[i][j-1]+1, m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    const d = m[al][bl], l = Math.max(al, bl);
    return l ? (l - d) / l : 1;
}

async function checkToxicity(text) {
    if (!process.env.OPENROUTER_API_KEY || text.length < 8) return null;
    try {
        const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'meta-llama/llama-3.1-8b-instruct:free',
            messages: [{ role: 'system', content: 'Analyze for toxicity. Return ONLY: {"toxic":true/false,"reason":"brief","type":"insult|hate|harassment|spam|none"}' }, { role: 'user', content: text }],
            temperature: 0, max_tokens: 60
        }, { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 5000 });
        const c = r.data?.choices?.[0]?.message?.content;
        if (c) { try { return JSON.parse(c.replace(/```json|```/g, '').trim()); } catch { return c.includes('true') ? { toxic: true, type: 'spam' } : null; } }
    } catch (e) { /* silent */ }
    return null;
}

const C = { BLURPLE: 0x5865F2, RED: 0xED4245, GREEN: 0x3BA55D, YELLOW: 0xFAA61A, GREY: 0x2F3136, DARK: 0x202225 };
const ICON = 'https://cdn.discordapp.com/embed/avatars/0.png';
function fmtDur(ms) { return ms >= 86400000 ? `${Math.round(ms/86400000)} day${Math.round(ms/86400000)>1?'s':''}` : `${Math.round(ms/3600000)} hour${Math.round(ms/3600000)>1?'s':''}`; }
function strikeBar(wc) { const f = Math.min(wc, 4), e = 4 - f; return `${'●'.repeat(f)}${'○'.repeat(e)}`; }

function isElevated(member) {
    if (!member) return false;
    return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
           member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
           member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
           member.permissions.has(PermissionsBitField.Flags.ManageGuild);
}

// ================= FIX 1: takeAction stores violation metadata in history =================
async function takeAction(message, violations, client, db) {
    const uid = message.author.id, gid = message.guild.id;
    const k = key(uid, gid);
    const entry = history.get(k) || { messages: [], warns: 0, last: Date.now() };
    entry.warns++;

    // ── FIX 1: Store violation metadata so the tribunal embed can show real evidence ──
    entry.lastMessageContent = message.content?.substring(0, 1800) || '(attachment / image)';
    entry.lastViolation = violations[0]?.type || 'unknown';
    entry.lastViolationTime = Date.now();

    history.set(k, entry);
    const wc = entry.warns;
    const displayWc = Math.min(wc, 4);

    const hasMalicious = violations.some(v => v.type.includes('malicious') || v.type.includes('phishing'));
    const hasEveryoneSpam = violations.some(v => v.type.includes('everyone') || v.type.includes('here'));
    let action = 'timeout', duration = 3600000;
    if (wc === 1) { action = 'timeout'; duration = 3600000; }
    else if (wc === 2) { action = 'timeout'; duration = 86400000; }
    else if (wc === 3) { action = 'timeout'; duration = 604800000; }
    else { action = 'ban'; duration = 0; }
    if (hasMalicious && wc >= 2) { action = 'ban'; duration = 0; }
    if (hasEveryoneSpam && wc >= 1) { action = 'timeout'; duration = 86400000; }

    // ── FIX 1 continued: Store action taken for tribunal context ──
    entry.lastAction = action;
    entry.lastDuration = duration;
    history.set(k, entry);

    await message.delete().catch(() => {});

    const repeatV = violations.find(v => v.channels);
    if (repeatV?.channels) {
        for (const cid of repeatV.channels) {
            if (cid === message.channel.id) continue;
            const ch = message.guild.channels.cache.get(cid);
            if (!ch) continue;
            const matching = entry.messages.filter(m => m.channelId === cid && Date.now() - m.ts <= REPEAT_WINDOW);
            for (const m of matching) {
                try { const msg = await ch.messages.fetch(m.mid).catch(() => null); if (msg) await msg.delete().catch(() => {}); }
                catch (e) {}
            }
        }
    }

    const member = await message.guild.members.fetch(uid).catch(() => null);
    let actionText = 'Timed out', actionColor = C.YELLOW;
    try {
        if (action === 'timeout' && member?.moderatable) {
            await member.timeout(duration, `AutoMod: ${violations[0].reason}`);
            actionText = `Timed out for ${fmtDur(duration)}`;
            actionColor = duration >= 604800000 ? C.RED : C.YELLOW;
        } else if (action === 'ban' && member?.bannable) {
            await member.ban({ reason: `AutoMod: ${violations[0].reason}`, deleteMessageSeconds: 86400 });
            actionText = 'Banned'; actionColor = C.RED;
            history.delete(k);
        } else {
            actionText = 'Warned (insufficient permissions)'; actionColor = C.GREY;
        }
    } catch (e) { actionText = 'Action failed'; actionColor = C.GREY; }

    // ── FIX 2: DM to user now includes an "Appeal This Action" button ──
    try {
        const guildOwner = await message.guild.fetchOwner().catch(() => null);
        const appealContact = guildOwner ? `<@${guildOwner.id}>` : 'a server administrator';
        const dm = new EmbedBuilder()
            .setColor(actionColor)
            .setAuthor({ name: 'AutoMod', iconURL: message.guild.iconURL({ size: 64 }) || ICON })
            .setTitle(action === 'ban' ? 'You were banned' : action === 'timeout' ? 'You were timed out' : 'Action taken on your account')
            .setDescription(`Your message in **${message.guild.name}** was removed by AutoMod.`)
            .addFields(
                { name: 'Rule', value: violations[0].type, inline: true },
                { name: 'Action', value: actionText, inline: true },
                { name: 'Violation', value: violations[0].reason, inline: false }
            )
            .setFooter({ text: `Strike ${displayWc} of 4` })
            .setTimestamp();
        dm.addFields({
            name: 'Allowed link domains include',
            value: 'youtube.com, youtu.be, github.com, twitter.com, x.com, instagram.com, reddit.com, wikipedia.org\nContact an admin to request additions.',
            inline: false
        });
        dm.addFields({
            name: 'Think this was a mistake?',
            value: `Click the button below, or reply here with:\n"appeal ${message.guild.name} | your reason"\n\nOr contact ${appealContact} directly.\n⚠️ You get **1 appeal per server every 24 hours**.`,
            inline: false
        });

        // ── FIX 2: Appeal button in the punishment DM ──
        const appealRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`automod_appeal_${uid}_${gid}`)
                .setLabel('📝 Appeal This Action')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setLabel('Server Rules')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${gid}`)
        );

        await message.author.send({ embeds: [dm], components: [appealRow] }).catch(() => {
            // If DM fails, that's fine — user can still type "appeal" manually
        });
    } catch (e) {}

    try {
        const notif = await message.channel.send({
            embeds: [new EmbedBuilder().setColor(actionColor).setDescription(`**${message.author.tag}** — ${actionText} by AutoMod\n**Rule:** ${violations[0].type}`)]
        }).catch(() => {});
        if (notif) setTimeout(() => notif.delete().catch(() => {}), 10000);
    } catch (e) {}

    const settings = client.getServerSettings?.(gid) || {};
    const logId = settings.autoModLogChannel || settings.automodlog || settings.modlog || settings.log;
    if (logId) {
        const logCh = message.guild.channels.cache.get(logId);
        if (logCh?.permissionsFor(message.guild.members.me)?.has(PermissionsBitField.Flags.SendMessages)) {
            const bar = strikeBar(displayWc);
            const next = displayWc >= 4 ? 'None — maximum reached' : ['1 hour timeout', '1 day timeout', '7 day timeout', 'Ban'][displayWc];
            const log = new EmbedBuilder()
                .setColor(actionColor)
                .setAuthor({ name: 'AutoMod', iconURL: client.user.displayAvatarURL() })
                .setTitle(actionText)
                .addFields(
                    { name: 'Member', value: `${message.author} \`${uid}\``, inline: false },
                    { name: 'Rule', value: violations[0].type, inline: true },
                    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                    { name: 'Violation', value: violations[0].reason, inline: true }
                )
                .setFooter({ text: `${bar}  Strike ${displayWc} of 4  •  Next: ${next}` })
                .setTimestamp();
            if (repeatV?.channels?.length > 1) log.addFields({ name: 'Cross-channel', value: repeatV.channels.map(c => `<#${c}>`).join(' '), inline: false });
            await logCh.send({ embeds: [log] }).catch(() => {});
        }
    }

    try {
        const owner = await message.guild.fetchOwner().catch(() => null);
        if (owner && !owner.user.bot) {
            const privateEmbed = new EmbedBuilder()
                .setColor(actionColor)
                .setAuthor({ name: 'AutoMod — Private Report', iconURL: client.user.displayAvatarURL() })
                .setTitle(actionText)
                .setDescription(`**Server:** ${message.guild.name}\n**Privacy:** Only you see this (server owner)`)
                .addFields(
                    { name: 'Member', value: `${message.author} \`${uid}\``, inline: false },
                    { name: 'Rule', value: violations[0].type, inline: true },
                    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                    { name: 'Strike', value: `${displayWc}/4`, inline: true },
                    { name: 'Message Content', value: `\`\`\`${message.content.substring(0, 1800) || '(attachment / image)'}\`\`\``, inline: false }
                )
                .setFooter({ text: 'ARCHON CG-223 • Confidential' })
                .setTimestamp();
            await owner.send({ embeds: [privateEmbed] }).catch(() => {});
        }
    } catch (e) {}

    try { db.prepare(`INSERT INTO moderation_logs (guild_id,user_id,moderator_id,action,reason,timestamp) VALUES (?,?,?,?,?,?)`).run(gid, uid, client.user.id, action, `AutoMod: ${violations[0].reason}`, Date.now()); } catch (e) {}
    try { db.prepare(`INSERT INTO warnings (id,guild_id,user_id,moderator_id,reason,expires_at,active) VALUES (?,?,?,?,?,?,1)`).run(`AM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`, gid, uid, client.user.id, `AutoMod: ${violations[0].reason}`, Math.floor(Date.now()/1000)+2592000); } catch (e) {}

    const cc = repeatV ? '[CROSS] ' : '';
    console.log(`[AUTOMOD] ${cc}${action.toUpperCase()} | ${message.author.tag} | ${violations.map(v=>v.type).join(', ')} | Strike ${displayWc}/4`);
}

async function scanMessage(message, client, db) {
    if (!message.guild || message.author.bot || message.webhookId) return false;
    const ss = client.getServerSettings?.(message.guild.id);
    if (!ss?.autoModEnabled) return false;
    const member = message.member;
    if (member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) return false;
    if (ss.autoModWhitelist) {
        const wl = ss.autoModWhitelist.split(',');
        if (wl.some(rid => member?.roles.cache.has(rid))) return false;
    }

    const uid = message.author.id, gid = message.guild.id;
    const k = key(uid, gid), now = Date.now();
    if (!history.has(k)) history.set(k, { messages: [], warns: 0, last: now });
    const entry = history.get(k);
    entry.last = now;

    const record = { ts: now, content: message.content, channelId: message.channel.id, mid: message.id, hasLinks: ANY_LINK_RE.test(message.content), norm: normalize(message.content), attachments: message.attachments.size };
    entry.messages.push(record);
    const cutoff = now - 120000;
    while (entry.messages.length && entry.messages[0].ts < cutoff) entry.messages.shift();
    if (entry.messages.length > MAX_HISTORY) entry.messages = entry.messages.slice(-80);

    const h = entry.messages;
    const recent = h.filter(m => now - m.ts <= SPAM_WINDOW);
    const violations = [];
    const seen = new Set();

    // ── PER-SERVER CHANNEL RESTRICTION ──
    const rawChannels = ss?.automodChannels || ss?.automod_channels || '';
    const restrictedChannels = rawChannels ? rawChannels.split(',').map(c => c.trim()) : null;
    const isRestrictedChannel = restrictedChannels ? restrictedChannels.includes(message.channel.id) : true;

    // 1. Message spam (same channel)
    if (recent.filter(m => m.channelId === message.channel.id).length >= SPAM_THRESHOLD && !seen.has('spam')) {
        violations.push({ type: 'message spam', reason: `${SPAM_THRESHOLD}+ messages in ${SPAM_WINDOW/1000}s`, source: 'spam' });
        seen.add('spam');
    }

    // 2. Caps flood
    if (message.content.length > 15) {
        const letters = (message.content.match(/[A-Za-z]/g) || []).length;
        const caps = (message.content.match(/[A-Z]/g) || []).length;
        if (letters > 0 && caps / letters > CAPS_RATIO && !seen.has('caps')) {
            violations.push({ type: 'caps flood', reason: `${Math.round(caps/letters*100)}% uppercase`, source: 'caps' });
            seen.add('caps');
        }
    }

    // 3. Emoji flood
    if (message.content.length > 20) {
        const emojis = (message.content.match(/[\p{Emoji}]/gu) || []).length;
        if (emojis / message.content.length > EMOJI_RATIO && !seen.has('emoji')) {
            violations.push({ type: 'emoji flood', reason: `${Math.round(emojis/message.content.length*100)}% emoji`, source: 'emoji' });
            seen.add('emoji');
        }
    }

    // 4. Mass mention
    const mentions = message.mentions.users.size + message.mentions.roles.size + (message.content.match(/@here|@everyone/g) || []).length;
    if (mentions > MENTION_LIMIT && !seen.has('mention')) {
        violations.push({ type: 'mass mention', reason: `${mentions} mentions`, source: 'mention' });
        seen.add('mention');
    }

    // ── FIX 3: @everyone/@here — check both content text AND Discord's resolved mention flag ──
    if (isRestrictedChannel && !seen.has('everyone')) {
        const hasEveryoneText = message.content.includes('@everyone') || message.content.includes('@here');
        const hasEveryoneResolved = message.mentions.everyone === true; // Discord sets this when it actually resolves
        const hasEveryone = hasEveryoneText || hasEveryoneResolved;

        if (hasEveryone && !isElevated(member)) {
            const lastEveryone = everyoneCooldowns.get(gid) || 0;
            if (now - lastEveryone > EVERYONE_COOLDOWN) {
                everyoneCooldowns.set(gid, now);
                violations.push({ type: 'everyone/here spam', reason: 'Unauthorized @everyone/@here ping', source: 'everyone' });
                seen.add('everyone');
            } else {
                violations.push({ type: 'rapid everyone spam', reason: 'Multiple @everyone/@here pings in short window', source: 'everyone' });
                seen.add('everyone');
            }
        }
    }

    // 5. @here/@everyone + link
    if ((message.content.includes('@here') || message.content.includes('@everyone') || message.mentions.everyone) && record.hasLinks && !seen.has('promo')) {
        violations.push({ type: 'promotional spam', reason: '@here/@everyone + external link', source: 'promo', crossChannel: true });
        seen.add('promo');
    }

    // 6. Malicious links
    if (record.hasLinks) {
        const mal = MALICIOUS.some(p => p.test(message.content));
        const inv = message.content.match(INVITE_RE);
        if (mal && !seen.has('malicious')) { violations.push({ type: 'malicious link', reason: 'Phishing/scam URL detected', source: 'malicious' }); seen.add('malicious'); }
        else if (inv?.length && !seen.has('invite')) { violations.push({ type: 'unauthorized invite', reason: 'External Discord invite', source: 'invite' }); seen.add('invite'); }
    }

    // 7. Global link blocker
    if (record.hasLinks && !seen.has('malicious') && !seen.has('invite') && !seen.has('global_link')) {
        if (!isElevated(member)) {
            const customDomains = parseDomainWhitelist(ss?.autoModDomains);
            if (!isDomainWhitelisted(message.content, customDomains)) {
                violations.push({ type: 'unauthorized link', reason: 'Link domain not permitted', source: 'global_link' });
                seen.add('global_link');
            }
        }
    }

    // ── Image/attachment spam ──
    if (isRestrictedChannel && !seen.has('image_spam')) {
        const imageRecent = h.filter(m =>
            now - m.ts <= IMAGE_SPAM_WINDOW &&
            m.channelId === message.channel.id &&
            m.attachments > 0
        );
        const totalImages = imageRecent.reduce((sum, m) => sum + m.attachments, 0);

        // ── FIX 5: Also catch a single message that contains multiple attachments ──
        const singleMsgImages = message.attachments.size;

        if (totalImages >= IMAGE_SPAM_LIMIT || singleMsgImages >= IMAGE_SPAM_LIMIT) {
            violations.push({ type: 'image spam', reason: `${Math.max(totalImages, singleMsgImages)} images in ${IMAGE_SPAM_WINDOW/1000}s`, source: 'image_spam' });
            seen.add('image_spam');
        }
    }

    // ── Attachment-only spam ──
    if (isRestrictedChannel && !seen.has('attachment_spam') && message.attachments.size > 0) {
        const textContent = message.content.trim();
        const hasOnlyMentions = textContent.length > 0 && /^[@<>:!&\s\d]+$/.test(textContent);
        if (textContent.length === 0 || hasOnlyMentions) {
            const attachmentRecent = h.filter(m =>
                now - m.ts <= IMAGE_SPAM_WINDOW &&
                m.channelId === message.channel.id &&
                m.attachments > 0 &&
                (m.content.trim().length === 0 || /^[@<>:!&\s\d]+$/.test(m.content.trim()))
            );
            if (attachmentRecent.length >= 2) {
                violations.push({ type: 'attachment spam', reason: 'Multiple image-only posts', source: 'attachment_spam' });
                seen.add('attachment_spam');
            }
        }
    }

    // 8. Cross-channel duplicate
    const crossRecent = h.filter(m => now - m.ts <= REPEAT_WINDOW);
    if (!seen.has('repeat')) {
        const contentMap = new Map();
        for (const m of crossRecent) { if (m.norm.length < 5) continue; if (!contentMap.has(m.norm)) contentMap.set(m.norm, new Set()); contentMap.get(m.norm).add(m.channelId); }
        for (const [norm, channels] of contentMap) {
            if (channels.size >= 2) {
                const hasLinks = /https?:\/\//i.test(norm);
                const thresh = hasLinks ? 2 : 3;
                if (channels.size >= thresh) { violations.push({ type: 'cross-channel spam', reason: `Same message in ${channels.size} channels${hasLinks ? ' (contains links)' : ''}`, source: 'repeat', crossChannel: true, channels: [...channels] }); seen.add('repeat'); break; }
            }
        }
    }

    // 9. Rapid fire across channels
    if (!seen.has('rapid')) {
        const rapid = h.filter(m => now - m.ts <= SPAM_WINDOW);
        if (rapid.length >= 3) { const uc = new Set(rapid.map(m => m.channelId)); if (uc.size >= 2) { violations.push({ type: 'rapid fire', reason: `${rapid.length} messages across ${uc.size} channels in ${SPAM_WINDOW/1000}s`, source: 'rapid', crossChannel: true, channels: [...uc] }); seen.add('rapid'); } }
    }

    // 10. AI toxicity
    if (violations.length === 0 && message.content.length > 10) {
        const ai = await checkToxicity(message.content);
        if (ai?.toxic) { violations.push({ type: ai.type || 'toxic content', reason: ai.reason || 'AI detected', source: 'ai' }); }
    }

    if (violations.length > 0) {
        await takeAction(message, violations, client, db);
        return true;
    }
    return false;
}

async function handleAppeal(message, client) {
    if (message.guild) return;
    if (message.author.bot) return;

    const content = message.content.trim();
    const lower = content.toLowerCase();

    if (lower === 'appeal' || lower === 'help') {
        const appeals = [];
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const member = await guild.members.fetch(message.author.id).catch(() => null);
                if (member) {
                    const entry = history.get(key(message.author.id, guildId));
                    if (entry && entry.warns > 0) {
                        appeals.push({ guild, warns: Math.min(entry.warns, 4) });
                    }
                }
            } catch (e) {}
        }

        if (appeals.length === 0) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(C.GREY)
                    .setTitle('No Active Strikes')
                    .setDescription('You have no recent AutoMod actions on servers I manage.\nIf you believe a message was wrongly deleted, please include:\n\n**Server name**\n**What you posted**\n**Why it should be allowed**\n\nI will forward this to the server owner.')
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setColor(C.YELLOW)
            .setTitle('AutoMod Appeal')
            .setDescription('You have active strikes on the following servers:');

        for (const a of appeals.slice(0, 5)) {
            const owner = await a.guild.fetchOwner().catch(() => null);
            embed.addFields({
                name: a.guild.name,
                value: `Strikes: ${a.warns}/4\nContact: ${owner ? `<@${owner.id}>` : 'Server admin'}`,
                inline: true
            });
        }

        embed.addFields({
            name: 'How to appeal',
            value: 'Reply with:\n"appeal [server name] | [your message]"\n\nExample:\n"appeal Testing bot | I was just excited, not flooding caps on purpose"\n\n⚠️ You get **1 appeal per server every 24 hours** — make it count.\nOr contact the server owner directly.',
            inline: false
        });

        return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (lower.startsWith('appeal ')) {
        const body = content.substring(7).trim();
        const pipeIdx = body.indexOf('|');

        let serverName, reason, usedFallback = false;
        if (pipeIdx !== -1) {
            serverName = body.substring(0, pipeIdx).trim();
            reason = body.substring(pipeIdx + 1).trim() || 'No reason provided';
        } else {
            usedFallback = true;
            const parts = body.split(' ');
            serverName = parts[0];
            reason = parts.slice(1).join(' ') || 'No reason provided';
        }

        if (!serverName) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(C.RED)
                    .setTitle('Missing Server Name')
                    .setDescription('Usage:\n"appeal [server name] | [your message]"\n\nExample:\n"appeal Testing bot | I was just excited, not flooding caps on purpose"')
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        let targetGuild = null;
        for (const [gid, guild] of client.guilds.cache) {
            if (guild.name.toLowerCase().includes(serverName.toLowerCase())) {
                targetGuild = guild;
                break;
            }
        }

        if (!targetGuild && usedFallback && body.split(' ').length > 1) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(C.RED)
                    .setTitle('Could not Identify the Server')
                    .setDescription('I could not tell where the server name ends and your message begins.\n\nPlease use the pipe format so I parse it correctly:\n"appeal [server name] | [your message]"\n\nExample:\n"appeal Testing bot | I was just excited, not flooding caps on purpose"')
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        if (!targetGuild) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(C.RED)
                    .setTitle('Server Not Found')
                    .setDescription('I could not find a server matching "' + serverName + '".\nUse "appeal" to see your active strikes.')
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        const cdKey = `${message.author.id}:${targetGuild.id}`;
        const lastAppeal = appealCooldowns.get(cdKey);
        const now = Date.now();

        // ── Check for appeal ban (from 🔨 tribunal button) ──
        const banKey = `ban:${message.author.id}:${targetGuild.id}`;
        const banUntil = appealCooldowns.get(banKey);
        if (banUntil && now < banUntil) {
            const remainingMs = banUntil - now;
            const remainingDays = Math.ceil(remainingMs / 86400000);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(C.DARK)
                    .setTitle('🚫 Appeals Banned')
                    .setDescription(`You are banned from appealing on **${targetGuild.name}** for **${remainingDays} more day${remainingDays !== 1 ? 's' : ''}** due to a previous frivolous appeal.`)
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        if (lastAppeal && (now - lastAppeal) < APPEAL_COOLDOWN) {
            const remainingMs = APPEAL_COOLDOWN - (now - lastAppeal);
            const remainingHrs = Math.ceil(remainingMs / 3600000);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(C.YELLOW)
                    .setTitle('Appeal Cooldown Active')
                    .setDescription(`You have already submitted an appeal for **${targetGuild.name}** recently.\nYou can submit one appeal per server every 24 hours.\n\nTry again in **${remainingHrs} hour${remainingHrs !== 1 ? 's' : ''}**.`)
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        try {
            const owner = await targetGuild.fetchOwner().catch(() => null);
            const entry = history.get(key(message.author.id, targetGuild.id));

            // ── FIX 1: Use stored violation metadata for rich tribunal embed ──
            const evidence = entry?.lastMessageContent || '*(content unavailable)*';
            const violationType = entry?.lastViolation || 'unknown';
            const violationTime = entry?.lastViolationTime
                ? `<t:${Math.floor(entry.lastViolationTime / 1000)}:R>`
                : 'unknown';

            const appealId = `AP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`appeal_approve_${appealId}`).setLabel('✅ Approve').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`appeal_reject_${appealId}`).setLabel('❌ Reject').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`appeal_ban_${appealId}`).setLabel('🔨 Ban Appeals').setStyle(ButtonStyle.Secondary)
            );

            const tribunalEmbed = new EmbedBuilder()
                .setColor(C.BLURPLE)
                .setAuthor({ name: 'AutoMod Appeal Tribunal', iconURL: message.author.displayAvatarURL() })
                .setTitle('⚖️ New Appeal Received')
                .setDescription(`**From:** ${message.author.tag} (${message.author.id})
**Server:** ${targetGuild.name}
**Reason:** ${reason}

**Strikes:** ${Math.min(entry?.warns || 1, 4)}/4`)
                .addFields(
                    { name: '🛡️ Original Violation', value: `\`${violationType}\``, inline: true },
                    { name: '⏰ When', value: violationTime, inline: true },
                    { name: '⚡ Action Taken', value: entry?.lastAction ? `${entry.lastAction} (${entry.lastDuration ? fmtDur(entry.lastDuration) : 'permanent'})` : 'unknown', inline: true },
                    { name: '📄 Deleted Message', value: `\`\`\`${evidence.substring(0, 900)}\`\`\`` }
                )
                .setFooter({ text: 'ARCHON CG-223 • Click to render verdict' })
                .setTimestamp();

            // ── FIX 4: 3-tier appeal delivery: DM → log channel → queue ──
            let sent = null;
            let deliveryMethod = 'none';

            // Tier 1: Try to DM the owner
            if (owner && !owner.user.bot) {
                sent = await owner.send({ embeds: [tribunalEmbed], components: [row] }).catch(() => null);
                if (sent) deliveryMethod = 'dm';
            }

            // Tier 2: Fall back to the server's automod log channel
            if (!sent) {
                const settings = client.getServerSettings?.(targetGuild.id) || {};
                const logId = settings.autoModLogChannel || settings.automodlog || settings.modlog;
                if (logId) {
                    const logCh = targetGuild.channels.cache.get(logId);
                    if (logCh) {
                        const ownerMention = owner ? `<@${owner.id}>` : 'Server owner';
                        sent = await logCh.send({
                            content: `${ownerMention} — an appeal was submitted but I couldn't DM you directly.`,
                            embeds: [tribunalEmbed],
                            components: [row]
                        }).catch(() => null);
                        if (sent) deliveryMethod = 'log_channel';
                    }
                }
            }

            // Tier 3: Queue for /automod appeals (always stored regardless)
            if (sent) {
                appealTribunal.set(appealId, {
                    guildId: targetGuild.id,
                    userId: message.author.id,
                    ownerId: owner?.id || null,
                    status: 'pending',
                    messageId: sent.id,
                    channelId: sent.channel.id,
                    expiresAt: Date.now() + 7 * 86400000,
                    reason,
                    deliveryMethod,
                    userTag: message.author.tag,
                    evidence,
                    violationType,
                });
            } else {
                // No delivery succeeded — still queue so /automod appeals shows it
                appealTribunal.set(appealId, {
                    guildId: targetGuild.id,
                    userId: message.author.id,
                    ownerId: owner?.id || null,
                    status: 'pending',
                    messageId: null,
                    channelId: null,
                    expiresAt: Date.now() + 7 * 86400000,
                    reason,
                    deliveryMethod: 'queued',
                    userTag: message.author.tag,
                    evidence,
                    violationType,
                });
                deliveryMethod = 'queued';
            }

            appealCooldowns.set(cdKey, now);

            // Confirmation message varies by delivery method
            const confirmDesc = deliveryMethod === 'dm'
                ? `Your appeal for **${targetGuild.name}** has been forwarded to the server owner.\n\n🕊️ **Please be patient** — they will review it and may reach out to you directly.`
                : deliveryMethod === 'log_channel'
                ? `Your appeal for **${targetGuild.name}** could not reach the owner's DMs, so it was posted in the server log channel.\n\n🕊️ The owner will see it there.`
                : `Your appeal for **${targetGuild.name}** has been queued. The server owner can review it with \`/automod appeals\`.\n\n⚠️ I could not reach the owner directly or via log channel.`;

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(deliveryMethod === 'queued' ? C.YELLOW : C.GREEN)
                    .setTitle(deliveryMethod === 'queued' ? '⏳ Appeal Queued' : '✅ Appeal Submitted')
                    .setDescription(confirmDesc + '\n\nSince you get one appeal per server per day, sending follow-up messages here won\'t speed things up.')
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});

        } catch (e) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(C.RED)
                    .setTitle('Appeal Failed')
                    .setDescription('An unexpected error occurred. Please try again later.')
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }
    }
}

// ================= TRIBUNAL BUTTON HANDLER =================
async function handleAppealButton(interaction, client) {
    if (!interaction.isButton() || !interaction.customId.startsWith('appeal_')) return false;

    const parts = interaction.customId.split('_');
    const action = parts[1];
    const appealId = parts[2];
    const vote = appealTribunal.get(appealId);

    if (!vote) {
        return interaction.reply({ content: '⚠️ This appeal has expired or was already ruled on.', flags: 1 << 6 }).catch(() => {});
    }

    if (interaction.user.id !== vote.ownerId) {
        return interaction.reply({ content: '🔒 Only the server owner can rule on this appeal.', flags: 1 << 6 }).catch(() => {});
    }

    if (vote.status !== 'pending') {
        return interaction.reply({ content: '⚠️ This appeal was already decided.', flags: 1 << 6 }).catch(() => {});
    }

    const guild = client.guilds.cache.get(vote.guildId);
    const targetUser = await client.users.fetch(vote.userId).catch(() => null);

    if (action === 'approve') {
        const k = key(vote.userId, vote.guildId);
        const entry = history.get(k);
        if (entry && entry.warns > 0) {
            entry.warns = Math.max(0, entry.warns - 1);
            history.set(k, entry);
        }

        // ── CORE FIX: Actually lift the Discord timeout on the member ──
        let timeoutLifted = false;
        let wasTimedOut = false;
        if (guild) {
            try {
                const member = await guild.members.fetch(vote.userId).catch(() => null);
                if (member) {
                    // Check if they are actually still timed out
                    wasTimedOut = !!member.communicationDisabledUntilTimestamp &&
                                  member.communicationDisabledUntilTimestamp > Date.now();
                    if (wasTimedOut) {
                        // null removes the timeout immediately
                        await member.timeout(null, `Appeal approved by ${interaction.user.tag}`);
                        timeoutLifted = true;
                        console.log(`[AUTOMOD APPEAL] Timeout lifted for ${vote.userId} in ${guild.name} by ${interaction.user.tag}`);
                    }
                }
            } catch (e) {
                console.error(`[AUTOMOD APPEAL] Failed to lift timeout for ${vote.userId}:`, e.message);
            }
        }

        if (targetUser) {
            const liftedNote = timeoutLifted
                ? '\n\n⏰ Your timeout has been **lifted immediately**. You can chat again!'
                : wasTimedOut === false && guild
                ? '\n\n✅ Your timeout had already expired.'
                : '';
            await targetUser.send({
                embeds: [new EmbedBuilder()
                    .setColor(C.GREEN)
                    .setTitle('✅ Appeal Approved')
                    .setDescription(`Your appeal for **${guild?.name || 'the server'}** was **approved** by the owner.\n\nYour strike count has been reduced. Stay clean! 🕊️${liftedNote}`)
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        vote.status = 'approved';
        appealTribunal.set(appealId, vote);

        await interaction.update({
            content: `✅ **APPROVED** by ${interaction.user.tag}\nStrike reduced. User notified.${timeoutLifted ? ' Timeout lifted.' : ' (timeout already expired or user left)'}`,
            embeds: [],
            components: []
        }).catch(() => {});

    } else if (action === 'reject') {
        if (targetUser) {
            await targetUser.send({
                embeds: [new EmbedBuilder()
                    .setColor(C.RED)
                    .setTitle('❌ Appeal Rejected')
                    .setDescription(`Your appeal for **${guild?.name || 'the server'}** was **rejected** by the owner.\n\nThe punishment stands. You can appeal again in 24 hours.`)
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        vote.status = 'rejected';
        appealTribunal.set(appealId, vote);

        await interaction.update({
            content: `❌ **REJECTED** by ${interaction.user.tag}\nPunishment stands. User notified.`,
            embeds: [],
            components: []
        }).catch(() => {});

    } else if (action === 'ban') {
        const banKey = `ban:${vote.userId}:${vote.guildId}`;
        // Store timestamp of when the ban expires (7 days from now)
        appealCooldowns.set(banKey, Date.now() + 7 * 86400000);

        const k = key(vote.userId, vote.guildId);
        const entry = history.get(k) || { messages: [], warns: 0, last: Date.now() };
        entry.warns++;
        history.set(k, entry);

        if (targetUser) {
            await targetUser.send({
                embeds: [new EmbedBuilder()
                    .setColor(C.DARK)
                    .setTitle('🚫 Appeal Banned')
                    .setDescription(`You have been **banned from appealing** on **${guild?.name || 'the server'}** for **7 days** due to frivolous appeals.\n\nYou also received an additional strike.`)
                    .setFooter({ text: 'ARCHON CG-223' })]
            }).catch(() => {});
        }

        vote.status = 'banned';
        appealTribunal.set(appealId, vote);

        await interaction.update({
            content: `🔨 **APPEAL BANNED** by ${interaction.user.tag}\nUser cannot appeal for 7 days. +1 strike added.`,
            embeds: [],
            components: []
        }).catch(() => {});
    }

    return true;
}

async function syncRules(guild, action, settings) {
    const PREFIX = 'ARCHON CG-223';
    try {
        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageGuild)) return false;
        let existing; try { existing = await guild.autoModerationRules.fetch(); } catch { existing = null; }
        const exemptRoles = settings?.autoModWhitelist ? settings.autoModWhitelist.split(',').filter(Boolean) : [];

        const rules = [
            { name: `${PREFIX} • Core Shield`, eventType: 1, triggerType: 4, triggerMetadata: { presets: [1, 2, 3] }, actions: [{ type: 1, metadata: { customMessage: '🛡️ AutoMod: Content violation detected.' } }], enabled: true, exemptRoles, reason: 'AutoMod Core Shield' },
            { name: `${PREFIX} • Malicious Links`, eventType: 1, triggerType: 1, triggerMetadata: { keywordFilter: ['discordg1ft', 'free-nitro', 'steamm-rewards'] }, actions: [{ type: 1, metadata: { customMessage: '🛡️ AutoMod: Phishing link blocked.' } }], enabled: true, exemptRoles, reason: 'AutoMod Link Shield' },
            { name: `${PREFIX} • Invite Spam`, eventType: 1, triggerType: 1, triggerMetadata: { keywordFilter: ['discord.gg/', 'discord.com/invite/', 'discordapp.com/invite/'] }, actions: [{ type: 1, metadata: { customMessage: '🛡️ AutoMod: Unauthorized invite blocked.' } }], enabled: true, exemptRoles, reason: 'AutoMod Invite Shield' },
            { name: `${PREFIX} • Self-Bot`, eventType: 1, triggerType: 1, triggerMetadata: { keywordFilter: ['selfbot', 'self-bot', 'autotyper', 'massdm'] }, actions: [{ type: 1, metadata: { customMessage: '🛡️ AutoMod: Automation tool detected.' } }], enabled: true, exemptRoles, reason: 'AutoMod Bot Shield' },
            { name: `${PREFIX} • Rogue Domains`, eventType: 1, triggerType: 1, triggerMetadata: { keywordFilter: ['.ru/', 'grabify.', 'iplogger.', 'bit.ly-'] }, actions: [{ type: 1, metadata: { customMessage: '🛡️ AutoMod: Unverified domain blocked.' } }], enabled: true, exemptRoles, reason: 'AutoMod Domain Shield' },
            { name: `${PREFIX} • Promo Spam`, eventType: 1, triggerType: 1, triggerMetadata: { keywordFilter: ['dm me for', 'join for reward', 'free tokens', 'giveaway enter'] }, actions: [{ type: 1, metadata: { customMessage: '🛡️ AutoMod: Promotional spam blocked.' } }], enabled: true, exemptRoles, reason: 'AutoMod Promo Shield' },
        ];

        if (action === 'create') {
            let created = 0, skipped = 0;
            for (const r of rules) {
                if (existing?.some?.(ex => ex.name === r.name)) { skipped++; continue; }
                try { await guild.autoModerationRules.create(r); created++; } catch (e) { console.log(`[AUTOMOD GATEWAY] ${r.name}: ${e.message}`); }
            }
            console.log(`[AUTOMOD GATEWAY] ${guild.name}: ${created} created, ${skipped} skipped`);
            return created > 0 || skipped > 0;
        } else if (action === 'delete') {
            const targets = [...(existing?.values() || [])].filter(r => r.name.startsWith(PREFIX));
            for (const r of targets) { try { await r.delete('AutoMod deactivated'); } catch {} }
            return true;
        }
    } catch (e) { console.log(`[AUTOMOD GATEWAY] ${e.message}`); return false; }
}

function resolveSetting(s, ...keys) { for (const k of keys) { if (s?.[k] != null && s[k] !== '') return s[k]; } return null; }

// ================= FIX 4 HELPER: Format pending appeals for /automod appeals ──
function formatPendingAppeals(guildId) {
    const pending = [];
    for (const [id, data] of appealTribunal) {
        if (data.guildId !== guildId) continue;
        if (data.status !== 'pending') continue;
        pending.push({ id, ...data });
    }
    return pending;
}

module.exports = {
    name: 'automod', category: 'MODERATION', aliases: ['am', 'modai'],
    description: '🛡️ Discord-native AutoMod system with timeouts, AI toxicity detection, domain-based link blocking, image spam detection, @everyone protection, and appeals.',
    usage: '.automod [status|enable|disable|sensitivity|whitelist|domains|log|channels|appeals]',
    cooldown: 3000,

    // ── FIX 4: Added 'appeals' subcommand to slash builder ──
    data: new SlashCommandBuilder().setName('automod').setDescription('🛡️ Configure AutoMod').
        setDefaultMemberPermissions(Number(PermissionsBitField.Flags.Administrator)).
        addSubcommand(s => s.setName('status').setDescription('View AutoMod status')).
        addSubcommand(s => s.setName('enable').setDescription('Enable AutoMod')).
        addSubcommand(s => s.setName('disable').setDescription('Disable AutoMod')).
        addSubcommand(s => s.setName('appeals').setDescription('View and manage pending appeals')).
        addSubcommand(s => s.setName('sensitivity').setDescription('Set sensitivity').addStringOption(o => o.setName('level').setDescription('Level').setRequired(true).addChoices({name:'🟢 Low',value:'low'},{name:'🟡 Medium',value:'medium'},{name:'🔴 High',value:'high'}))).
        addSubcommand(s => s.setName('whitelist').setDescription('Whitelist role').addRoleOption(o => o.setName('role').setDescription('Role (skip to clear)').setRequired(false))).
        addSubcommand(s => s.setName('domains').setDescription('Manage allowed link domains').addStringOption(o => o.setName('action').setDescription('add, remove, list, or reset').setRequired(true).addChoices({name:'📋 List allowed domains',value:'list'},{name:'➕ Add domain',value:'add'},{name:'➖ Remove domain',value:'remove'},{name:'🔄 Reset to defaults',value:'reset'})).addStringOption(o => o.setName('domain').setDescription('Domain to add/remove (e.g., example.com)').setRequired(false))).
        addSubcommand(s => s.setName('log').setDescription('Set log channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))).
        addSubcommand(s => s.setName('channels').setDescription('Restrict AutoMod to specific channels').addStringOption(o => o.setName('action').setDescription('add, remove, list, or clear').setRequired(true).addChoices({name:'📋 List restricted channels',value:'list'},{name:'➕ Add channel',value:'add'},{name:'➖ Remove channel',value:'remove'},{name:'🔄 Clear all',value:'clear'})).addChannelOption(o => o.setName('channel').setDescription('Channel to add/remove').setRequired(false))),

    execute: async (ix, client) => {
        const adm = ix.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!adm) return ix.reply({ content: '🔒 Admin only.', flags: 1 << 6 });
        const sc = ix.options.getSubcommand();
        const ss = client.getServerSettings(ix.guild.id);

        // ── FIX 4: /automod appeals — slash handler ──
        if (sc === 'appeals') {
            const pending = formatPendingAppeals(ix.guild.id);
            if (pending.length === 0) {
                return ix.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(C.GREEN)
                        .setTitle('⚖️ Appeal Queue')
                        .setDescription('No pending appeals for this server.')
                        .setFooter({ text: 'ARCHON CG-223' })],
                    flags: 1 << 6
                });
            }
            const e = new EmbedBuilder()
                .setColor(C.BLURPLE)
                .setTitle(`⚖️ Pending Appeals (${pending.length})`)
                .setFooter({ text: 'ARCHON CG-223 • Use the tribunal buttons to rule' })
                .setTimestamp();

            for (const a of pending.slice(0, 10)) {
                const timeAgo = a.lastViolationTime
                    ? `<t:${Math.floor(a.lastViolationTime / 1000)}:R>`
                    : 'Unknown time';
                e.addFields({
                    name: `${a.userTag} — ${a.violationType || 'unknown violation'}`,
                    value: `**Reason:** ${a.reason?.substring(0, 100) || 'No reason'}\n**Delivery:** ${a.deliveryMethod || 'unknown'}\n**When:** ${timeAgo}\n**ID:** \`${a.id}\``,
                    inline: false
                });
            }
            return ix.reply({ embeds: [e], flags: 1 << 6 });
        }

        if (sc === 'status') {
            const logId = resolveSetting(ss, 'autoModLogChannel', 'automodlog', 'modlog', 'log');
            const wl = ss?.autoModWhitelist;
            const domainList = parseDomainWhitelist(ss?.autoModDomains);
            const rawChannels = ss?.automodChannels || ss?.automod_channels || '';
            const channelList = rawChannels ? rawChannels.split(',').map(c => `<#${c}>`).join(' ') : 'All channels';
            const pendingCount = formatPendingAppeals(ix.guild.id).length;
            const e = new EmbedBuilder()
                .setColor(ss?.autoModEnabled ? C.GREEN : C.RED)
                .setAuthor({ name: 'AutoMod', iconURL: client.user.displayAvatarURL() })
                .setTitle('Configuration')
                .addFields(
                    { name: 'Status', value: ss?.autoModEnabled ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Sensitivity', value: (ss?.autoModSensitivity || 'medium').toUpperCase(), inline: true },
                    { name: 'Log Channel', value: logId ? `<#${logId}>` : 'Not configured', inline: true },
                    { name: 'Exempt Roles', value: wl ? wl.split(',').map(r => `<@&${r}>`).join(' ') : 'None', inline: false },
                    { name: 'Link Policy', value: `Non-mods: whitelisted domains only\nCustom: ${domainList.length} added`, inline: true },
                    { name: 'Restricted Channels', value: channelList, inline: false },
                    { name: 'Pending Appeals', value: pendingCount > 0 ? `${pendingCount} — use \`/automod appeals\` to review` : 'None', inline: false }
                )
                .setFooter({ text: 'Use /automod domains to manage • ARCHON CG-223' })
                .setTimestamp();
            return ix.reply({ embeds: [e], flags: 1 << 6 });
        }

        if (sc === 'enable' || sc === 'disable') {
            const en = sc === 'enable';
            const cur = ss?.autoModEnabled;
            if (en === !!cur) return ix.reply({ content: `⚠️ Already ${en ? 'enabled' : 'disabled'}.`, flags: 1 << 6 });
            if (en) {
                const me = ix.guild.members.me;
                const missing = ['ManageGuild', 'ManageMessages', 'ModerateMembers'].filter(p => !me.permissions.has(PermissionsBitField.Flags[p]));
                if (missing.length) return ix.reply({ content: `🛡️ Missing: ${missing.map(p => '`' + p + '`').join(', ')}`, flags: 1 << 6 });
            }
            client.db.prepare("UPDATE server_settings SET automod_enabled = ?, updated_at = strftime('%s','now') WHERE guild_id = ?").run(en ? '1' : '0', ix.guild.id);
            client.settings.delete(ix.guild.id);
            const e = new EmbedBuilder().setColor(en ? C.GREEN : C.GREY).setAuthor({ name: 'AutoMod', iconURL: client.user.displayAvatarURL() }).setDescription(en ? '**AutoMod is now enabled.**\nShield rules deployed to this server.\n🛡️ Non-moderators can only post links from trusted domains.\nUse `/automod domains` to customize.' : '**AutoMod is now disabled.**\nShield rules removed.').setFooter({ text: 'ARCHON CG-223' }).setTimestamp();
            await ix.reply({ embeds: [e], flags: 1 << 6 });
            await syncRules(ix.guild, en ? 'create' : 'delete', ss);
            return;
        }

        if (sc === 'sensitivity') {
            const lv = ix.options.getString('level');
            client.updateServerSetting(ix.guild.id, 'automodsensitivity', lv);
            client.settings.delete(ix.guild.id);
            return ix.reply({ content: `✅ Sensitivity → **${lv.toUpperCase()}**`, flags: 1 << 6 });
        }
        if (sc === 'whitelist') {
            const role = ix.options.getRole('role');
            const cur = ss?.autoModWhitelist;
            if (role) {
                if (cur?.split(',').includes(role.id)) return ix.reply({ content: `⚠️ Already whitelisted.`, flags: 1 << 6 });
                const nw = cur ? `${cur},${role.id}` : role.id;
                client.updateServerSetting(ix.guild.id, 'automodwhitelist', nw); client.settings.delete(ix.guild.id);
                if (ss?.autoModEnabled) { await syncRules(ix.guild, 'delete'); await syncRules(ix.guild, 'create', { ...ss, autoModWhitelist: nw }); }
                return ix.reply({ content: `✅ Whitelisted **${role.name}**`, flags: 1 << 6 });
            } else {
                if (!cur) return ix.reply({ content: `⚠️ Empty.`, flags: 1 << 6 });
                client.updateServerSetting(ix.guild.id, 'automodwhitelist', null); client.settings.delete(ix.guild.id);
                if (ss?.autoModEnabled) { await syncRules(ix.guild, 'delete'); await syncRules(ix.guild, 'create', { ...ss, autoModWhitelist: null }); }
                return ix.reply({ content: `✅ Cleared.`, flags: 1 << 6 });
            }
        }
        if (sc === 'domains') {
            const action = ix.options.getString('action');
            const domain = ix.options.getString('domain')?.toLowerCase().trim();
            const cur = ss?.autoModDomains || '';
            const list = parseDomainWhitelist(cur);

            if (action === 'list') {
                const customList = list.length > 0 ? list.join(', ') : 'None (using defaults only)';
                const e = new EmbedBuilder()
                    .setColor(C.BLURPLE)
                    .setAuthor({ name: 'AutoMod — Domain Whitelist', iconURL: client.user.displayAvatarURL() })
                    .addFields(
                        { name: 'Default Allowed', value: [...DEFAULT_DOMAIN_WHITELIST].slice(0, 12).join(', ') + '...', inline: false },
                        { name: 'Custom Added', value: customList, inline: false }
                    )
                    .setFooter({ text: 'ARCHON CG-223' });
                return ix.reply({ embeds: [e], flags: 1 << 6 });
            }
            if (action === 'add') {
                if (!domain) return ix.reply({ content: '❌ Provide a domain. Example: example.com', flags: 1 << 6 });
                if (list.includes(domain)) return ix.reply({ content: '⚠️ `' + domain + '` is already allowed.', flags: 1 << 6 });
                const nw = cur ? `${cur},${domain}` : domain;
                client.updateServerSetting(ix.guild.id, 'automoddomains', nw); client.settings.delete(ix.guild.id);
                return ix.reply({ content: '✅ Added `' + domain + '` to allowed domains.', flags: 1 << 6 });
            }
            if (action === 'remove') {
                if (!domain) return ix.reply({ content: '❌ Provide a domain to remove.', flags: 1 << 6 });
                if (!list.includes(domain)) return ix.reply({ content: '⚠️ `' + domain + '` is not in the custom list.', flags: 1 << 6 });
                const nw = list.filter(d => d !== domain).join(',');
                client.updateServerSetting(ix.guild.id, 'automoddomains', nw || null); client.settings.delete(ix.guild.id);
                return ix.reply({ content: '✅ Removed `' + domain + '` from allowed domains.', flags: 1 << 6 });
            }
            if (action === 'reset') {
                client.updateServerSetting(ix.guild.id, 'automoddomains', null); client.settings.delete(ix.guild.id);
                return ix.reply({ content: `✅ Custom domains cleared. Using defaults only.`, flags: 1 << 6 });
            }
        }
        if (sc === 'channels') {
            const action = ix.options.getString('action');
            const ch = ix.options.getChannel('channel');
            const rawCur = ss?.automodChannels || ss?.automod_channels || '';
            const list = rawCur ? rawCur.split(',').map(c => c.trim()).filter(Boolean) : [];

            if (action === 'list') {
                const channelList = list.length > 0 ? list.map(c => `<#${c}>`).join(' ') : 'All channels (no restrictions)';
                const e = new EmbedBuilder()
                    .setColor(C.BLURPLE)
                    .setAuthor({ name: 'AutoMod — Channel Restrictions', iconURL: client.user.displayAvatarURL() })
                    .setDescription(`AutoMod is active in: ${channelList}`)
                    .setFooter({ text: 'ARCHON CG-223' });
                return ix.reply({ embeds: [e], flags: 1 << 6 });
            }
            if (action === 'add') {
                if (!ch) return ix.reply({ content: '❌ Mention a channel.', flags: 1 << 6 });
                if (list.includes(ch.id)) return ix.reply({ content: '⚠️ Already restricted.', flags: 1 << 6 });
                const nw = rawCur ? `${rawCur},${ch.id}` : ch.id;
                client.updateServerSetting(ix.guild.id, 'automodchannels', nw); client.settings.delete(ix.guild.id);
                return ix.reply({ content: `✅ AutoMod now active in <#${ch.id}>`, flags: 1 << 6 });
            }
            if (action === 'remove') {
                if (!ch) return ix.reply({ content: '❌ Mention a channel.', flags: 1 << 6 });
                if (!list.includes(ch.id)) return ix.reply({ content: '⚠️ Not in list.', flags: 1 << 6 });
                const nw = list.filter(c => c !== ch.id).join(',');
                client.updateServerSetting(ix.guild.id, 'automodchannels', nw || null); client.settings.delete(ix.guild.id);
                return ix.reply({ content: `✅ Removed <#${ch.id}> from restrictions.`, flags: 1 << 6 });
            }
            if (action === 'clear') {
                client.updateServerSetting(ix.guild.id, 'automodchannels', null); client.settings.delete(ix.guild.id);
                return ix.reply({ content: `✅ Channel restrictions cleared. AutoMod active in all channels.`, flags: 1 << 6 });
            }
        }
        if (sc === 'log') {
            const ch = ix.options.getChannel('channel');
            client.updateServerSetting(ix.guild.id, 'automodlog', ch.id); client.settings.delete(ix.guild.id);
            return ix.reply({ content: `✅ Log → ${ch}`, flags: 1 << 6 });
        }
    },

    run: async (client, msg, args, db, ss) => {
        const adm = msg.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!adm) return msg.reply('🔒 Admin only.');
        const action = args[0]?.toLowerCase() || 'status';
        const settings = client.getServerSettings(msg.guild.id);

        // ── FIX 4: .automod appeals — prefix handler ──
        if (action === 'appeals') {
            const pending = formatPendingAppeals(msg.guild.id);
            if (pending.length === 0) {
                return msg.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(C.GREEN)
                        .setTitle('⚖️ Appeal Queue')
                        .setDescription('No pending appeals for this server.')
                        .setFooter({ text: 'ARCHON CG-223' })]
                });
            }
            const e = new EmbedBuilder()
                .setColor(C.BLURPLE)
                .setTitle(`⚖️ Pending Appeals (${pending.length})`)
                .setFooter({ text: 'ARCHON CG-223 • Appeals expire after 7 days' })
                .setTimestamp();
            for (const a of pending.slice(0, 10)) {
                e.addFields({
                    name: `${a.userTag} — ${a.violationType || 'unknown'}`,
                    value: `**Reason:** ${a.reason?.substring(0, 100) || 'No reason'}\n**Delivery:** ${a.deliveryMethod || 'unknown'}\n**ID:** \`${a.id}\``,
                    inline: false
                });
            }
            return msg.reply({ embeds: [e] });
        }

        if (action === 'status') {
            const logId = resolveSetting(settings, 'autoModLogChannel', 'automodlog', 'modlog', 'log');
            const wl = settings?.autoModWhitelist;
            const domainList = parseDomainWhitelist(settings?.autoModDomains);
            const rawChannels = settings?.automodChannels || settings?.automod_channels || '';
            const channelList = rawChannels ? rawChannels.split(',').map(c => `<#${c}>`).join(' ') : 'All channels';
            const pendingCount = formatPendingAppeals(msg.guild.id).length;
            const e = new EmbedBuilder()
                .setColor(settings?.autoModEnabled ? C.GREEN : C.RED)
                .setAuthor({ name: 'AutoMod', iconURL: client.user.displayAvatarURL() })
                .setTitle('Configuration')
                .addFields(
                    { name: 'Status', value: settings?.autoModEnabled ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Sensitivity', value: (settings?.autoModSensitivity || 'medium').toUpperCase(), inline: true },
                    { name: 'Log Channel', value: logId ? `<#${logId}>` : 'Not configured', inline: true },
                    { name: 'Exempt Roles', value: wl ? wl.split(',').map(r => `<@&${r}>`).join(' ') : 'None', inline: false },
                    { name: 'Link Policy', value: `Non-mods: whitelisted domains only\nCustom: ${domainList.length} added`, inline: true },
                    { name: 'Restricted Channels', value: channelList, inline: false },
                    { name: 'Pending Appeals', value: pendingCount > 0 ? `${pendingCount} — use \`.automod appeals\` to review` : 'None', inline: false }
                )
                .setFooter({ text: 'Use .automod domains to manage • ARCHON CG-223' })
                .setTimestamp();
            return msg.reply({ embeds: [e] });
        }
        if (action === 'enable' || action === 'on') {
            const cur = client.db.prepare('SELECT automod_enabled FROM server_settings WHERE guild_id = ?').get(msg.guild.id);
            if (cur?.automod_enabled === 1) return msg.reply('⚠️ Already enabled.');
            const me = msg.guild.members.me;
            const missing = ['ManageGuild', 'ManageMessages', 'ModerateMembers'].filter(p => !me.permissions.has(PermissionsBitField.Flags[p]));
            if (missing.length) return msg.reply(`🛡️ Missing: ${missing.join(', ')}`);
            client.db.prepare("UPDATE server_settings SET automod_enabled = 1 WHERE guild_id = ?").run(msg.guild.id);
            client.settings.delete(msg.guild.id);
            const synced = await syncRules(msg.guild, 'create', settings);
            return msg.reply(`✅ Enabled.${synced ? ' 🛡️ Shield active! Non-mods can only post trusted domains. Use .automod domains to customize.' : ''}`);
        }
        if (action === 'disable' || action === 'off') {
            const cur = client.db.prepare('SELECT automod_enabled FROM server_settings WHERE guild_id = ?').get(msg.guild.id);
            if (cur?.automod_enabled === 0) return msg.reply('⚠️ Already disabled.');
            await syncRules(msg.guild, 'delete');
            client.db.prepare("UPDATE server_settings SET automod_enabled = 0 WHERE guild_id = ?").run(msg.guild.id);
            client.settings.delete(msg.guild.id);
            return msg.reply('✅ Disabled.');
        }
        if (action === 'sensitivity') {
            const lv = args[1]?.toLowerCase();
            if (!['low', 'medium', 'high'].includes(lv)) return msg.reply('❌ Usage: .automod sensitivity <low|medium|high>');
            client.updateServerSetting(msg.guild.id, 'automodsensitivity', lv); client.settings.delete(msg.guild.id);
            return msg.reply(`✅ Sensitivity → **${lv.toUpperCase()}**`);
        }
        if (action === 'whitelist') {
            const role = msg.mentions.roles.first();
            const cur = settings?.autoModWhitelist;
            if (role) {
                if (cur?.split(',').includes(role.id)) return msg.reply('⚠️ Already whitelisted.');
                const nw = cur ? `${cur},${role.id}` : role.id;
                client.updateServerSetting(msg.guild.id, 'automodwhitelist', nw); client.settings.delete(msg.guild.id);
                if (settings?.autoModEnabled) { await syncRules(msg.guild, 'delete'); await syncRules(msg.guild, 'create', { ...settings, autoModWhitelist: nw }); }
                return msg.reply(`✅ Whitelisted **${role.name}**`);
            } else {
                if (!cur) return msg.reply('⚠️ Empty.');
                client.updateServerSetting(msg.guild.id, 'automodwhitelist', null); client.settings.delete(msg.guild.id);
                if (settings?.autoModEnabled) { await syncRules(msg.guild, 'delete'); await syncRules(msg.guild, 'create', { ...settings, autoModWhitelist: null }); }
                return msg.reply('✅ Cleared.');
            }
        }
        if (action === 'domains') {
            const sub = args[1]?.toLowerCase();
            const cur = settings?.autoModDomains || '';
            const list = parseDomainWhitelist(cur);

            if (!sub || sub === 'list') {
                const customList = list.length > 0 ? list.join(', ') : 'None (using defaults only)';
                const e = new EmbedBuilder()
                    .setColor(C.BLURPLE)
                    .setAuthor({ name: 'AutoMod — Domain Whitelist', iconURL: client.user.displayAvatarURL() })
                    .addFields(
                        { name: 'Default Allowed', value: [...DEFAULT_DOMAIN_WHITELIST].slice(0, 12).join(', ') + '...', inline: false },
                        { name: 'Custom Added', value: customList, inline: false }
                    )
                    .setFooter({ text: 'ARCHON CG-223' });
                return msg.reply({ embeds: [e] });
            }
            if (sub === 'add') {
                const domain = args[2]?.toLowerCase().trim();
                if (!domain) return msg.reply('❌ Usage: .automod domains add <domain> (e.g., example.com)');
                if (list.includes(domain)) return msg.reply('⚠️ `' + domain + '` is already allowed.');
                const nw = cur ? `${cur},${domain}` : domain;
                client.updateServerSetting(msg.guild.id, 'automoddomains', nw); client.settings.delete(msg.guild.id);
                return msg.reply('✅ Added `' + domain + '` to allowed domains.');
            }
            if (sub === 'remove') {
                const domain = args[2]?.toLowerCase().trim();
                if (!domain) return msg.reply('❌ Usage: .automod domains remove <domain>');
                if (!list.includes(domain)) return msg.reply('⚠️ `' + domain + '` is not in the custom list.');
                const nw = list.filter(d => d !== domain).join(',');
                client.updateServerSetting(msg.guild.id, 'automoddomains', nw || null); client.settings.delete(msg.guild.id);
                return msg.reply('✅ Removed `' + domain + '` from allowed domains.');
            }
            if (sub === 'reset') {
                client.updateServerSetting(msg.guild.id, 'automoddomains', null); client.settings.delete(msg.guild.id);
                return msg.reply(`✅ Custom domains cleared. Using defaults only.`);
            }
            return msg.reply('❓ Usage: .automod domains [list|add|remove|reset]');
        }
        if (action === 'channels') {
            const sub = args[1]?.toLowerCase();
            const rawCur = settings?.automodChannels || settings?.automod_channels || '';
            const list = rawCur ? rawCur.split(',').map(c => c.trim()).filter(Boolean) : [];

            if (!sub || sub === 'list') {
                const channelList = list.length > 0 ? list.map(c => `<#${c}>`).join(' ') : 'All channels (no restrictions)';
                const e = new EmbedBuilder()
                    .setColor(C.BLURPLE)
                    .setAuthor({ name: 'AutoMod — Channel Restrictions', iconURL: client.user.displayAvatarURL() })
                    .setDescription(`AutoMod is active in: ${channelList}`)
                    .setFooter({ text: 'ARCHON CG-223' });
                return msg.reply({ embeds: [e] });
            }
            if (sub === 'add') {
                const ch = msg.mentions.channels.first() || msg.guild.channels.cache.get(args[2]);
                if (!ch) return msg.reply('❌ Mention a channel.');
                if (list.includes(ch.id)) return msg.reply('⚠️ Already restricted.');
                const nw = rawCur ? `${rawCur},${ch.id}` : ch.id;
                client.updateServerSetting(msg.guild.id, 'automodchannels', nw); client.settings.delete(msg.guild.id);
                return msg.reply(`✅ AutoMod now active in ${ch}`);
            }
            if (sub === 'remove') {
                const ch = msg.mentions.channels.first() || msg.guild.channels.cache.get(args[2]);
                if (!ch) return msg.reply('❌ Mention a channel.');
                if (!list.includes(ch.id)) return msg.reply('⚠️ Not in list.');
                const nw = list.filter(c => c !== ch.id).join(',');
                client.updateServerSetting(msg.guild.id, 'automodchannels', nw || null); client.settings.delete(msg.guild.id);
                return msg.reply(`✅ Removed ${ch} from restrictions.`);
            }
            if (sub === 'clear') {
                client.updateServerSetting(msg.guild.id, 'automodchannels', null); client.settings.delete(msg.guild.id);
                return msg.reply(`✅ Channel restrictions cleared. AutoMod active in all channels.`);
            }
            return msg.reply('❓ Usage: .automod channels [list|add|remove|clear]');
        }
        if (action === 'log') {
            const ch = msg.mentions.channels.first() || msg.guild.channels.cache.get(args[1]);
            if (!ch) return msg.reply('❌ Mention a channel.');
            client.updateServerSetting(msg.guild.id, 'automodlog', ch.id); client.settings.delete(msg.guild.id);
            return msg.reply(`✅ Log → ${ch}`);
        }
        return msg.reply('❓ Usage: .automod [status|enable|disable|sensitivity|whitelist|domains|channels|log|appeals]');
    },

    async handleMessage(message, client, db) {
        return await scanMessage(message, client, db);
    },

    async handleDM(message, client) {
        return await handleAppeal(message, client);
    },

    async handleAppealButton(interaction, client) {
        return await handleAppealButton(interaction, client);
    }
};
