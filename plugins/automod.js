const { EmbedBuilder, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const axios = require('axios');

// ================= THRESHOLDS =================
const SPAM_THRESHOLD = 3;           // messages in window
const SPAM_WINDOW = 5000;           // 5 seconds
const CAPS_RATIO = 0.7;             // 70% uppercase
const EMOJI_RATIO = 0.5;            // 50% emoji
const MENTION_LIMIT = 4;            // @mentions
const REPEAT_WINDOW = 15000;        // cross-channel repeat window
const MAX_HISTORY = 100;            // per-user message cache

// ================= STATE =================
const history = new Map();          // user:guild -> { messages: [], warns: 0 }

// ================= MALICIOUS PATTERNS =================
const MALICIOUS = [
    /discordg1ft/i, /free-nitro/i, /steanm/i, /grabify\./i, /iplogger\./i,
    /free\s*tokens?/i, /dm\s*(me|for)\s*(nitro|reward)/i, /self[-\s]?bot/i, /massdm/i,
    /\.(ru|tk|ml|ga|cf)\//i, /discord\.(?!com|gg)/i,
    /(?:https?:\/\/)?(?:www\.)?discord(?:app)?\.(?:com|gg)\/gift\/[a-zA-Z0-9]{16,}/i,
    /t\.me\/\+?[a-zA-Z0-9_-]+/i,
];
const INVITE_RE = /discord\.gg\/[a-zA-Z0-9_-]+/gi;

// ================= HELPERS =================
function key(uid, gid) { return `${uid}:${gid}`; }

setInterval(() => {
    const cutoff = Date.now() - 600000;
    for (const [k, v] of history) { if (v.last < cutoff) history.delete(k); }
}, 600000);

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

// ================= ACTION ENGINE =================
async function takeAction(message, violations, client, db) {
    const uid = message.author.id, gid = message.guild.id;
    const k = key(uid, gid);
    const entry = history.get(k) || { messages: [], warns: 0, last: Date.now() };
    entry.warns++;
    history.set(k, entry);
    const wc = entry.warns;

    // Determine action
    const hasMalicious = violations.some(v => v.type.includes('malicious') || v.type.includes('phishing'));
    let action = 'timeout', duration = 3600000; // default: 1h timeout
    if (wc === 1) { action = 'timeout'; duration = 3600000; }        // 1h
    else if (wc === 2) { action = 'timeout'; duration = 86400000; }   // 1d
    else if (wc === 3) { action = 'timeout'; duration = 604800000; }  // 7d
    else { action = 'ban'; duration = 0; }
    if (hasMalicious && wc >= 2) { action = 'ban'; duration = 0; }

    // Delete message
    await message.delete().catch(() => {});

    // Delete repeated messages across channels
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

    // Execute action
    const member = await message.guild.members.fetch(uid).catch(() => null);
    let actionStatus = '⏳ Pending';
    try {
        if (action === 'timeout' && member?.moderatable) {
            await member.timeout(duration, `AutoMod: ${violations[0].reason}`);
            actionStatus = `⏱️ Timed out for ${duration >= 86400000 ? Math.round(duration/86400000) + 'd' : Math.round(duration/3600000) + 'h'}`;
        } else if (action === 'ban' && member?.bannable) {
            await member.ban({ reason: `AutoMod: ${violations[0].reason}`, deleteMessageSeconds: 86400 });
            actionStatus = '🔨 Banned';
        } else {
            actionStatus = '⚠️ Warned (insufficient perms)';
        }
    } catch (e) { actionStatus = '❌ Failed: ' + e.message; }

    // DM user
    try {
        const dmEmbed = new EmbedBuilder().setColor('#5865F2').setAuthor({ name: '🛡️ AutoMod', iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png' })
            .setTitle(action === 'ban' ? 'You were banned' : action === 'timeout' ? 'You were timed out' : 'Warning issued')
            .setDescription(`Your message in **${message.guild.name}** was removed.\n\n**Reason:** ${violations[0].type}\n**Details:** ${violations[0].reason}\n**Action:** ${actionStatus}\n**Strike:** ${wc}/4`)
            .setFooter({ text: 'ARCHON CG-223 AutoMod' }).setTimestamp();
        await message.author.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch (e) {}

    // Channel notification (10s)
    try {
        const notif = await message.channel.send({
            embeds: [new EmbedBuilder().setColor(action === 'ban' ? '#ED4245' : '#F23F43').setDescription(`**${message.author.tag}** was ${action === 'ban' ? 'banned' : action === 'timeout' ? 'timed out' : 'warned'} by AutoMod\n**Reason:** ${violations[0].reason}`)]
        }).catch(() => {});
        if (notif) setTimeout(() => notif.delete().catch(() => {}), 10000);
    } catch (e) {}

    // Log to mod channel
    const settings = client.getServerSettings?.(gid) || {};
    const logId = settings.autoModLogChannel || settings.automodlog || settings.modlog || settings.log;
    if (logId) {
        const logCh = message.guild.channels.cache.get(logId);
        if (logCh?.permissionsFor(message.guild.members.me)?.has(PermissionsBitField.Flags.SendMessages)) {
            const bar = '🟥'.repeat(Math.min(wc, 4)) + '⬛'.repeat(Math.max(0, 4 - wc));
            const next = ['1h Timeout', '1d Timeout', '7d Timeout', 'Ban'][Math.min(wc - 1, 3)] || 'MAX';
            const embed = new EmbedBuilder().setColor('#ED4245').setAuthor({ name: '🛡️ AutoMod Action', iconURL: client.user.displayAvatarURL() })
                .setDescription(`**Member:** ${message.author} \`${uid}\`\n**Action:** ${actionStatus}\n**Reason:** ${violations[0].type} — ${violations[0].reason}\n**Channel:** <#${message.channel.id}>\n**Strike:** ${wc}/4`)
                .addFields({ name: 'Escalation', value: `${bar} Next: ${next}`, inline: false })
                .setFooter({ text: `ARCHON CG-223 • Strike ${wc}/4` }).setTimestamp();
            if (repeatV?.channels) embed.addFields({ name: 'Cross-channel', value: repeatV.channels.map(c => `<#${c}>`).join(' '), inline: false });
            await logCh.send({ embeds: [embed] }).catch(() => {});
        }
    }

    // DB log
    try { db.prepare(`INSERT INTO moderation_logs (guild_id,user_id,moderator_id,action,reason,timestamp) VALUES (?,?,?,?,?,?)`).run(gid, uid, client.user.id, action, `AutoMod: ${violations[0].reason}`, Date.now()); } catch (e) {}
    try { db.prepare(`INSERT INTO warnings (id,guild_id,user_id,moderator_id,reason,expires_at,active) VALUES (?,?,?,?,?,?,1)`).run(`AM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`, gid, uid, client.user.id, `AutoMod: ${violations[0].reason}`, Math.floor(Date.now()/1000)+2592000); } catch (e) {}

    const cc = repeatV ? '[CROSS] ' : '';
    console.log(`[AUTOMOD] ${cc}${action.toUpperCase()} | ${message.author.tag} | ${violations.map(v=>v.type).join(', ')} | Strike ${wc}/4`);
}

// ================= DETECTION ENGINE =================
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

    const record = { ts: now, content: message.content, channelId: message.channel.id, mid: message.id, hasLinks: /https?:\/\//i.test(message.content), norm: normalize(message.content) };
    entry.messages.push(record);
    const cutoff = now - 120000;
    while (entry.messages.length && entry.messages[0].ts < cutoff) entry.messages.shift();
    if (entry.messages.length > MAX_HISTORY) entry.messages = entry.messages.slice(-80);

    const h = entry.messages;
    const recent = h.filter(m => now - m.ts <= SPAM_WINDOW);
    const violations = [];
    const seen = new Set();

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

    // 5. @here/@everyone + link
    if ((message.content.includes('@here') || message.content.includes('@everyone')) && record.hasLinks && !seen.has('promo')) {
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

    // 7. Cross-channel duplicate
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

    // 8. Rapid fire across channels
    if (!seen.has('rapid')) {
        const rapid = h.filter(m => now - m.ts <= SPAM_WINDOW);
        if (rapid.length >= 3) { const uc = new Set(rapid.map(m => m.channelId)); if (uc.size >= 2) { violations.push({ type: 'rapid fire', reason: `${rapid.length} messages across ${uc.size} channels in ${SPAM_WINDOW/1000}s`, source: 'rapid', crossChannel: true, channels: [...uc] }); seen.add('rapid'); } }
    }

    // 9. AI toxicity
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

// ================= GATEWAY RULES =================
async function syncRules(guild, action, settings) {
    const PREFIX = 'ARCHON CG-223';
    try {
        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageGuild)) return false;
        let existing; try { existing = await guild.autoModerationRules.fetch(); } catch { existing = null; }
        const exemptRoles = settings?.autoModWhitelist ? settings.autoModWhitelist.split(',').filter(Boolean) : [];

        const rules = [
            { name: `${PREFIX} • Core Shield`, eventType: 1, triggerType: 4, triggerMetadata: { presets: [1, 2, 3] }, actions: [{ type: 1, metadata: { customMessage: '🛡️ AutoMod: Content violation detected.' } }], enabled: true, exemptRoles, reason: 'AutoMod Core Shield' },
            { name: `${PREFIX} • Malicious Links`, eventType: 1, triggerType: 1, triggerMetadata: { keywordFilter: ['discordg1ft', 'free-nitro', 'steamm-rewards', 'grabify.', 'iplogger.'] }, actions: [{ type: 1, metadata: { customMessage: '🛡️ AutoMod: Phishing link blocked.' } }], enabled: true, exemptRoles, reason: 'AutoMod Link Shield' },
            { name: `${PREFIX} • Invite Spam`, eventType: 1, triggerType: 1, triggerMetadata: { keywordFilter: ['discord.gg/', 'discord.com/invite/'] }, actions: [{ type: 1, metadata: { customMessage: '🛡️ AutoMod: Unauthorized invite blocked.' } }], enabled: true, exemptRoles, reason: 'AutoMod Invite Shield' },
            { name: `${PREFIX} • Self-Bot`, eventType: 1, triggerType: 1, triggerMetadata: { keywordFilter: ['selfbot', 'self-bot', 'autotyper', 'massdm'] }, actions: [{ type: 1, metadata: { customMessage: '🛡️ AutoMod: Automation tool detected.' } }], enabled: true, exemptRoles, reason: 'AutoMod Bot Shield' },
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

// ================= RESOLVER =================
function resolveSetting(s, ...keys) { for (const k of keys) { if (s?.[k] != null && s[k] !== '') return s[k]; } return null; }

// ================= MODULE =================
module.exports = {
    name: 'automod', category: 'MODERATION', aliases: ['am', 'modai'],
    description: '🛡️ Discord-native AutoMod system with timeouts, AI toxicity detection, and escalation.',
    usage: '.automod [status|enable|disable|sensitivity|whitelist|log]',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('automod').setDescription('🛡️ Configure AutoMod').
        setDefaultMemberPermissions(Number(PermissionsBitField.Flags.Administrator)).
        addSubcommand(s => s.setName('status').setDescription('View AutoMod status')).
        addSubcommand(s => s.setName('enable').setDescription('Enable AutoMod')).
        addSubcommand(s => s.setName('disable').setDescription('Disable AutoMod')).
        addSubcommand(s => s.setName('sensitivity').setDescription('Set sensitivity').addStringOption(o => o.setName('level').setDescription('Level').setRequired(true).addChoices({name:'🟢 Low',value:'low'},{name:'🟡 Medium',value:'medium'},{name:'🔴 High',value:'high'}))).
        addSubcommand(s => s.setName('whitelist').setDescription('Whitelist role').addRoleOption(o => o.setName('role').setDescription('Role (skip to clear)').setRequired(false))).
        addSubcommand(s => s.setName('log').setDescription('Set log channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))),

    // ================= SLASH =================
    execute: async (ix, client) => {
        const adm = ix.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!adm) return ix.reply({ content: '🔒 Admin only.', flags: 1 << 6 });
        const sc = ix.options.getSubcommand();
        const ss = client.getServerSettings(ix.guild.id);
        const lang = ix.locale?.startsWith('fr') ? 'fr' : 'en';

        if (sc === 'status') {
            const logId = resolveSetting(ss, 'autoModLogChannel', 'automodlog', 'modlog', 'log');
            const wl = ss?.autoModWhitelist;
            const e = new EmbedBuilder().setColor(ss?.autoModEnabled ? '#2ecc71' : '#e74c3c').setAuthor({ name: '🛡️ AutoMod Status', iconURL: client.user.displayAvatarURL() }).
                addFields({ name: 'Status', value: ss?.autoModEnabled ? '✅ Enabled' : '❌ Disabled', inline: true }, { name: 'Sensitivity', value: (ss?.autoModSensitivity || 'medium').toUpperCase(), inline: true }, { name: 'Log Channel', value: logId ? `<#${logId}>` : 'Not set', inline: true }, { name: 'Whitelist', value: wl ? wl.split(',').map(r => `<@&${r}>`).join(' ') : 'None', inline: false }).
                setFooter({ text: '🦅 ARCHON CG-223 • AutoMod' }).setTimestamp();
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
            await ix.reply({ content: `✅ AutoMod ${en ? 'enabled' : 'disabled'}...`, flags: 1 << 6 });
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
        if (sc === 'log') {
            const ch = ix.options.getChannel('channel');
            client.updateServerSetting(ix.guild.id, 'automodlog', ch.id); client.settings.delete(ix.guild.id);
            return ix.reply({ content: `✅ Log → ${ch}`, flags: 1 << 6 });
        }
    },

    // ================= PREFIX =================
    run: async (client, msg, args, db, ss) => {
        const adm = msg.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!adm) return msg.reply('🔒 Admin only.');
        const action = args[0]?.toLowerCase() || 'status';
        const settings = client.getServerSettings(msg.guild.id);

        if (action === 'status') {
            const logId = resolveSetting(settings, 'autoModLogChannel', 'automodlog', 'modlog', 'log');
            const wl = settings?.autoModWhitelist;
            const e = new EmbedBuilder().setColor(settings?.autoModEnabled ? '#2ecc71' : '#e74c3c').setAuthor({ name: '🛡️ AutoMod Status', iconURL: client.user.displayAvatarURL() }).
                addFields({ name: 'Status', value: settings?.autoModEnabled ? '✅ Enabled' : '❌ Disabled', inline: true }, { name: 'Sensitivity', value: (settings?.autoModSensitivity || 'medium').toUpperCase(), inline: true }, { name: 'Log', value: logId ? `<#${logId}>` : 'Not set', inline: true }, { name: 'Whitelist', value: wl ? wl.split(',').map(r => `<@&${r}>`).join(' ') : 'None', inline: false }).
                setFooter({ text: '🦅 ARCHON CG-223 • AutoMod' }).setTimestamp();
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
            return msg.reply(`✅ Enabled.${synced ? ' 🛡️ Shield active!' : ''}`);
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
            if (!['low', 'medium', 'high'].includes(lv)) return msg.reply('❌ Usage: `.automod sensitivity <low|medium|high>`');
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
        if (action === 'log') {
            const ch = msg.mentions.channels.first() || msg.guild.channels.cache.get(args[1]);
            if (!ch) return msg.reply('❌ Mention a channel.');
            client.updateServerSetting(msg.guild.id, 'automodlog', ch.id); client.settings.delete(msg.guild.id);
            return msg.reply(`✅ Log → ${ch}`);
        }
        return msg.reply('❓ Usage: `.automod [status|enable|disable|sensitivity|whitelist|log]`');
    },

    // ================= MESSAGE HOOK (called by index.js) =================
    async handleMessage(message, client, db) {
        return await scanMessage(message, client, db);
    }
};
