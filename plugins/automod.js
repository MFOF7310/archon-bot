const { EmbedBuilder, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ================= DYNAMIC VERSIONING =================
function getVersion() {
    try {
        const versionPath = path.join(__dirname, '..', 'version.txt');
        if (fs.existsSync(versionPath)) {
            return fs.readFileSync(versionPath, 'utf8').trim();
        }
    } catch (e) {}
    return '2.1.0';
}
const VERSION = getVersion();

// ================= CONFIGURATION =================
const SPAM_THRESHOLD = 5;
const SPAM_WINDOW = 5000;
const CAPS_RATIO = 0.7;
const EMOJI_RATIO = 0.5;
const MENTION_LIMIT = 5;

// ================= CROSS-CHANNEL SPAM CONFIG =================
const CROSS_CHANNEL_MSG_THRESHOLD = 4;
const CROSS_CHANNEL_DUPE_THRESHOLD = 3;
const CROSS_CHANNEL_WINDOW = 10000;
const RAPID_FIRE_WINDOW = 5000;
const ATTACHMENT_HASH_WINDOW = 15000;
const SIMILARITY_THRESHOLD = 0.85;
const MAX_HISTORY_PER_USER = 200;

// ================= MALICIOUS LINK PATTERNS =================
const MALICIOUS_PATTERNS = [
    /discordg1ft/i, /free-nitro/i, /steamm-rewards/i, /steanm/i, /steamcommunity\.(?!com)/i,
    /grabify\./i, /iplogger\./i, /bit\.ly\s*[-_]/i, /short\.link/i,
    /free\s*tokens?/i, /giveaway\s*enter/i, /join\s*for\s*reward/i,
    /dm\s*me\s*for/i, /dm\s*for\s*(nitro|reward|prize|free)/i,
    /selfbot/i, /self-bot/i, /autotyper/i, /massdm/i,
    /\.(ru|tk|ml|ga|cf)\//i,
    /discord\.(?!com|gg|app)/i,
    /(?:https?:\/\/)?(?:www\.)?discord(?:app)?\.(?:com|gg)\/gift\/[a-zA-Z0-9]{16,}/i,
];

const INVITE_PATTERNS = [
    /discord\.gg\/[a-zA-Z0-9_-]+/i,
    /discord\.com\/invite\/[a-zA-Z0-9_-]+/i,
    /discordapp\.com\/invite\/[a-zA-Z0-9_-]+/i,
];

// ================= PER-SERVER USER MESSAGE TRACKING =================
const userMessageHistory = new Map();
const userWarnings = new Map();
const MAX_TRACKED_USERS = 5000;

function getTrackKey(userId, guildId) { return `${userId}:${guildId}`; }

setInterval(() => {
    const now = Date.now();
    const cutoff = now - (10 * 60 * 1000);
    let cleaned = 0;
    for (const [key, entry] of userMessageHistory) {
        if (entry.lastActivity && entry.lastActivity < cutoff) {
            userMessageHistory.delete(key);
            userWarnings.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) console.log(`[AUTOMOD] Cleaned ${cleaned} stale tracking entries`);
}, 10 * 60 * 1000);

// ================= TEXT SIMILARITY =================
function levenshteinDistance(a, b) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    let v0 = Array(b.length + 1).fill(0).map((_, i) => i);
    let v1 = Array(b.length + 1).fill(0);
    for (let i = 0; i < a.length; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < b.length; j++) {
            v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + (a[i] === b[j] ? 0 : 1));
        }
        [v0, v1] = [v1, v0];
    }
    return v0[b.length];
}

function similarityScore(a, b) {
    if (!a || !b) return 0;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;
    return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

function normalizeContent(content) {
    return content.toLowerCase().replace(/\s+/g, ' ').replace(/[<@!#&>]/g, '').trim();
}

// ================= ATTACHMENT FINGERPRINTING =================
function getAttachmentFingerprint(attachment) {
    const raw = `${attachment.name}:${attachment.size}:${attachment.contentType || 'unknown'}`;
    return crypto.createHash('md5').update(raw).digest('hex').substring(0, 16);
}

function hasMaliciousLinks(content) {
    return MALICIOUS_PATTERNS.some(p => p.test(content));
}

function hasUnauthorizedInvites(content, guildId) {
    const matches = [];
    for (const pattern of INVITE_PATTERNS) {
        const found = content.match(pattern);
        if (found) matches.push(found[0]);
    }
    return matches.length > 0 ? matches : null;
}

// ================= TOXICITY DETECTION =================
async function checkToxicity(content) {
    if (!process.env.OPENROUTER_API_KEY) return null;
    if (content.length < 10) return null;
    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "meta-llama/llama-3.1-8b-instruct:free",
            messages: [{
                role: "system",
                content: `Analyze this message for toxicity. Return ONLY a JSON object: {"toxic": true/false, "reason": "short reason", "type": "insult|hate|harassment|spam|none"}`
            }, { role: "user", content: content }],
            temperature: 0, max_tokens: 100
        }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" }, timeout: 8000 });
        const result = response.data?.choices?.[0]?.message?.content;
        if (result) {
            try { return JSON.parse(result.replace(/```json|```/g, '').trim()); }
            catch { return result.includes('true') ? { toxic: true, reason: 'AI detected', type: 'spam' } : null; }
        }
    } catch (e) { console.log(`[AUTOMOD AI] Detection failed: ${e.message}`); }
    return null;
}

// ================= ESCALATION HELPER =================
function getEscalationBar(warnCount) {
    const filled = Math.min(warnCount, 5);
    const empty = 5 - filled;
    const bar = '🟥'.repeat(filled) + '⬛'.repeat(empty);
    const nextActions = ['1-Hour Mute', '2-Day Timeout', '7-Day Timeout', 'Permanent Ban', 'MAXIMUM'];
    const next = filled >= 5 ? 'MAXIMUM' : nextActions[filled];
    return { bar, next };
}

function getActionEmoji(action) {
    return { warn: '⚠️', mute: '⛓️', timeout: '⏱️', ban: '🔨' }[action] || '⚠️';
}

function getActionTitle(action) {
    return { warn: 'WARNING ISSUED', mute: 'MEMBER MUTED', timeout: 'TIMEOUT ENFORCED', ban: 'MEMBER BANNED' }[action] || 'VIOLATION DETECTED';
}

function formatTimestamp(date) {
    const d = new Date(date);
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} • ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

// ================= GATEWAY AUTO-MOD RULES =================
async function syncGatewayRule(guild, action = 'create', settings = {}) {
    try {
        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            console.log(`[GATEWAY] Missing ManageGuild permission in ${guild.name}`);
            return false;
        }

        const PREFIX = 'ARCHITECT CG-223 •';

        // Pre-resolve exemptRoles from settings so we inject them at creation time
        let exemptRoles = [];
        if (settings?.autoModWhitelist) {
            exemptRoles = settings.autoModWhitelist.split(',').filter(Boolean);
        }

        const RULE_BLUEPRINTS = [
            {
                name: 'ARCHITECT CG-223 • Core Preset Shield',
                eventType: 1, triggerType: 4,
                triggerMetadata: { presets: [1, 2, 3], allowList: [] },
                actions: [{ type: 1, metadata: { customMessage: '🛡️ Blocked by ARCHITECT: Content violation detected.' } }],
                enabled: true, exemptRoles, exemptChannels: [],
                reason: 'ARCHITECT multi-rule shield deployment — Preset Layer'
            },
            {
                name: 'ARCHITECT CG-223 • Malicious Links',
                eventType: 1, triggerType: 1,
                triggerMetadata: { keywordFilter: ['discordg1ft', 'free-nitro', 'steamm-rewards'], allowList: [] },
                actions: [{ type: 1, metadata: { customMessage: '🛡️ Blocked by ARCHITECT: Phishing/Scam link signature detected.' } }],
                enabled: true, exemptRoles, exemptChannels: [],
                reason: 'ARCHITECT multi-rule shield deployment — Link Layer'
            },
            {
                name: 'ARCHITECT CG-223 • Link Spam Prevention',
                eventType: 1, triggerType: 1,
                triggerMetadata: { keywordFilter: ['discord.gg/', 'discord.com/invite/', 'discordapp.com/invite/'], allowList: [] },
                actions: [{ type: 1, metadata: { customMessage: '🛡️ Blocked by ARCHITECT: Unsolicited invite link detected.' } }],
                enabled: true, exemptRoles, exemptChannels: [],
                reason: 'ARCHITECT multi-rule shield deployment — Invite Layer'
            },
            {
                name: 'ARCHITECT CG-223 • Self-Bot Detection',
                eventType: 1, triggerType: 1,
                triggerMetadata: { keywordFilter: ['selfbot', 'self-bot', 'autotyper', 'massdm'], allowList: [] },
                actions: [{ type: 1, metadata: { customMessage: '🛡️ Blocked by ARCHITECT: Automation tool signature detected.' } }],
                enabled: true, exemptRoles, exemptChannels: [],
                reason: 'ARCHITECT multi-rule shield deployment — Bot Detection Layer'
            },
            {
                name: 'ARCHITECT CG-223 • Rogue Domain Block',
                eventType: 1, triggerType: 1,
                triggerMetadata: { keywordFilter: ['*.ru', 'grabify.*', 'iplogger.*', 'bit.ly-looks'], allowList: [] },
                actions: [{ type: 1, metadata: { customMessage: '🛡️ Blocked by ARCHITECT: Unverified or malicious domain link.' } }],
                enabled: true, exemptRoles, exemptChannels: [],
                reason: 'ARCHITECT multi-rule shield deployment — Domain Security Layer'
            },
            {
                name: 'ARCHITECT CG-223 • Promo Spam Shield',
                eventType: 1, triggerType: 1,
                triggerMetadata: { keywordFilter: ['dm me for', 'join for reward', 'free tokens', 'giveaway enter'], allowList: [] },
                actions: [{ type: 1, metadata: { customMessage: '🛡️ Blocked by ARCHITECT: Promotional spam pattern detected.' } }],
                enabled: true, exemptRoles, exemptChannels: [],
                reason: 'ARCHITECT multi-rule shield deployment — Promo Protection Layer'
            }
        ];

        // ================= CREATE MODE =================
        if (action === 'create') {
            let existingRules;
            try { existingRules = await guild.autoModerationRules.fetch(); }
            catch (fetchError) {
                console.log(`[GATEWAY] Rule fetch failed in ${guild.name}: ${fetchError.message}`);
                existingRules = null;
            }

            let deployedCount = 0, skippedCount = 0, failedCount = 0;

            const creationPromises = RULE_BLUEPRINTS.map(async (blueprint) => {
                const alreadyExists = existingRules?.some?.(r => r.name === blueprint.name) ?? false;
                if (alreadyExists) return 'skipped';
                try {
                    await guild.autoModerationRules.create(blueprint);
                    return 'created';
                } catch (ruleError) {
                    console.log(`[GATEWAY] ❌ Failed: "${blueprint.name}" in ${guild.name}: ${ruleError.message}`);
                    return 'failed';
                }
            });

            const results = await Promise.all(creationPromises);
            deployedCount = results.filter(r => r === 'created').length;
            skippedCount = results.filter(r => r === 'skipped').length;
            failedCount = results.filter(r => r === 'failed').length;

            console.log(`[GATEWAY] ${guild.name} deployment complete | ✅ ${deployedCount} created | ⏭️ ${skippedCount} skipped | ❌ ${failedCount} failed`);
            return deployedCount > 0 || skippedCount > 0;
        }

        // ================= DELETE MODE =================
        else if (action === 'delete') {
            let existingRules;
            try { existingRules = await guild.autoModerationRules.fetch(); }
            catch (fetchError) {
                console.log(`[GATEWAY] Rule fetch failed in ${guild.name}: ${fetchError.message}`);
                return false;
            }

            if (!existingRules || existingRules.size === 0) {
                console.log(`[GATEWAY] No rules to delete in ${guild.name}`);
                return true;
            }

            let deletedCount = 0, failedCount = 0;
            const targetRules = [...existingRules.values()].filter(r => r.name.startsWith(PREFIX));

            if (targetRules.length === 0) {
                console.log(`[GATEWAY] No ARCHITECT rules found to delete in ${guild.name}`);
                return true;
            }

            for (const rule of targetRules) {
                try { await rule.delete(`ARCHITECT auto-mod deactivated`); deletedCount++; }
                catch (ruleError) { failedCount++; }
            }

            console.log(`[GATEWAY] ${guild.name} cleanup complete | 🗑️ ${deletedCount} deleted | ❌ ${failedCount} failed`);
            return true;
        }
    } catch (error) {
        console.log(`[GATEWAY] Rule sync failed in ${guild.name}: ${error.message}`);
        return false;
    }
}

module.exports = {
    name: 'automod',
    category: 'MODERATION',
    aliases: ['am', 'modai', 'autofilter'],
    description: '🛡️ AI-Powered Auto-Moderation System',
    usage: '.automod [status|enable|disable|sensitivity|whitelist|log]',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('🛡️ Configure AI-powered auto-moderation')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .setDescriptionLocalizations({ fr: '🛡️ Configurer la modération automatique IA' })
        .addSubcommand(sub => sub.setName('status').setDescription('📊 View auto-mod status and settings').setDescriptionLocalizations({ fr: '📊 Voir le statut et les paramètres' }))
        .addSubcommand(sub => sub.setName('enable').setDescription('✅ Enable auto-mod').setDescriptionLocalizations({ fr: '✅ Activer l\'auto-mod' }))
        .addSubcommand(sub => sub.setName('disable').setDescription('❌ Disable auto-mod').setDescriptionLocalizations({ fr: '❌ Désactiver l\'auto-mod' }))
        .addSubcommand(sub => sub.setName('sensitivity').setDescription('🎯 Set toxicity sensitivity').setDescriptionLocalizations({ fr: '🎯 Définir la sensibilité à la toxicité' })
            .addStringOption(opt => opt.setName('level').setDescription('Sensitivity level').setDescriptionLocalizations({ fr: 'Niveau de sensibilité' }).setRequired(true)
                .addChoices({ name: '🟢 Low (fewer flags)', value: 'low' }, { name: '🟡 Medium (balanced)', value: 'medium' }, { name: '🔴 High (strict)', value: 'high' })))
        .addSubcommand(sub => sub.setName('whitelist').setDescription('👑 Add/remove whitelisted role').setDescriptionLocalizations({ fr: '👑 Ajouter/supprimer un rôle whitelisté' })
            .addRoleOption(opt => opt.setName('role').setDescription('Role to whitelist (skip to clear)').setDescriptionLocalizations({ fr: 'Rôle à whitelister (ignorer pour effacer)' }).setRequired(false)))
        .addSubcommand(sub => sub.setName('log').setDescription('📋 Set auto-mod log channel').setDescriptionLocalizations({ fr: '📋 Définir le salon de logs auto-mod' })
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel for mod logs').setDescriptionLocalizations({ fr: 'Salon pour les logs de modération' }).setRequired(true))),

    execute: async (interaction, client) => {
        const isOwner = interaction.user.id === interaction.guild.ownerId;
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!isOwner && !isAdmin) {
            return interaction.reply({
                content: interaction.locale?.startsWith('fr') ? '🔒 Seul le propriétaire ou les administrateurs peuvent configurer l\'auto-mod.' : '🔒 Only the owner or administrators can configure auto-mod.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const settings = client.getServerSettings(interaction.guild.id);
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';

        if (subcommand === 'status') {
            const embed = new EmbedBuilder()
                .setColor(settings.autoModEnabled ? '#2ecc71' : '#e74c3c')
                .setAuthor({ name: '🛡️ AUTO-MOD AI STATUS', iconURL: client.user.displayAvatarURL() })
                .addFields(
                    { name: '⚡ Status', value: settings.autoModEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '🎯 Sensitivity', value: (settings.autoModSensitivity || 'medium').toUpperCase(), inline: true },
                    { name: '📋 Log Channel', value: settings.autoModLogChannel ? `<#${settings.autoModLogChannel}>` : '❌ Not set', inline: true },
                    { name: '👑 Whitelist', value: settings.autoModWhitelist ? settings.autoModWhitelist.split(',').map(r => `<@&${r}>`).join(' ') : 'None', inline: false },
                    { name: '⏱️ Auto-Mute', value: (() => {
                        const muteId = settings.muteRoleId || settings.muterole || settings.muteRole || settings['mute role id'];
                        if (muteId) return `<@&${muteId}>`;
                        try {
                            const row = client.db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(interaction.guild.id);
                            if (row) { const dbMute = row['mute role id'] || row.muterole || row.muteRoleId; if (dbMute) return `<@&${dbMute}>`; }
                        } catch (e) {}
                        if (interaction.guild.id === '1218532454655955034') { const envMute = process.env.MUTE_ROLE_ID || process.env.MUTED_ROLE; if (envMute) return `<@&${envMute}> \u{1F539} .env`; }
                        return '\u274c No mute role set';
                    })(), inline: false }
                )
                .setFooter({ text: `ARCHITECT CG-223 • Auto-Mod AI • v${VERSION}` })
                .setTimestamp();
            return interaction.reply({ embeds: [embed], flags: 1 << 6 });
        }

        if (subcommand === 'enable' || subcommand === 'disable') {
            const enable = subcommand === 'enable';
            const dbSettings = client.db.prepare('SELECT automod_enabled FROM server_settings WHERE guild_id = ?').get(interaction.guild.id);
            const currentlyEnabled = dbSettings?.automod_enabled !== 0;
            if (enable === currentlyEnabled) {
                return interaction.reply({ content: lang === 'fr' ? `⚠️ L'auto-mod est déjà **${enable ? 'ACTIVÉ' : 'DÉSACTIVÉ'}**.` : `⚠️ Auto-mod is already **${enable ? 'ENABLED' : 'DISABLED'}**.`, flags: 1 << 6 });
            }
            if (enable) {
                const botMember = interaction.guild.members.me;
                const missingPerms = [];
                if (!botMember.permissions.has(PermissionsBitField.Flags.ManageGuild)) missingPerms.push('`Manage Guild`');
                if (!botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) missingPerms.push('`Manage Messages`');
                if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) missingPerms.push('`Moderate Members`');
                if (missingPerms.length > 0) {
                    return interaction.reply({
                        content: lang === 'fr' ? `🛡️ **Permissions insuffisantes**\n\n${botMember.user.username} a besoin de :\n${missingPerms.map(p => `• ${p}`).join('\n')}\n\n📋 Contactez le propriétaire du serveur.` : `🛡️ **Insufficient Permissions**\n\n${botMember.user.username} needs:\n${missingPerms.map(p => `• ${p}`).join('\n')}\n\n📋 Ask the server owner.`,
                        flags: 1 << 6
                    });
                }
            }
            client.db.prepare("UPDATE server_settings SET automod_enabled = ?, updated_at = strftime('%s', 'now') WHERE guild_id = ?").run(enable ? '1' : '0', interaction.guild.id);
            client.settings.delete(interaction.guild.id);
            await interaction.reply({ content: lang === 'fr' ? `✅ Auto-mod **${enable ? 'ACTIVÉ' : 'DÉSACTIVÉ'}** — règles en cours de déploiement...` : `✅ Auto-mod **${enable ? 'ENABLED' : 'DISABLED'}** — deploying rules...`, flags: 1 << 6 });
            if (enable) { await syncGatewayRule(interaction.guild, 'create', settings); }
            else { await syncGatewayRule(interaction.guild, 'delete'); }
            return;
        }

        if (subcommand === 'sensitivity') {
            const level = interaction.options.getString('level');
            const currentLevel = settings.autoModSensitivity || 'medium';
            if (level === currentLevel) return interaction.reply({ content: lang === 'fr' ? `⚠️ La sensibilité est déjà réglée sur **${level.toUpperCase()}**.` : `⚠️ Sensitivity is already set to **${level.toUpperCase()}**.`, flags: 1 << 6 });
            client.updateServerSetting(interaction.guild.id, 'automodsensitivity', level);
            client.settings.delete(interaction.guild.id);
            return interaction.reply({ content: lang === 'fr' ? `✅ Sensibilité changée de **${currentLevel.toUpperCase()}** → **${level.toUpperCase()}**.` : `✅ Sensitivity changed from **${currentLevel.toUpperCase()}** → **${level.toUpperCase()}**.`, flags: 1 << 6 });
        }

        if (subcommand === 'whitelist') {
            const role = interaction.options.getRole('role');
            const currentWhitelist = settings.autoModWhitelist;
            if (role) {
                if (currentWhitelist === role.id || (currentWhitelist && currentWhitelist.split(',').includes(role.id))) {
                    return interaction.reply({ content: lang === 'fr' ? `⚠️ Le rôle **${role.name}** est déjà whitelisté.` : `⚠️ Role **${role.name}** is already whitelisted.`, flags: 1 << 6 });
                }
                const newWhitelist = currentWhitelist ? `${currentWhitelist},${role.id}` : role.id;
                client.updateServerSetting(interaction.guild.id, 'automodwhitelist', newWhitelist);
                client.settings.delete(interaction.guild.id);

                // Re-create gateway rules with new exemptRoles baked in
                if (settings.autoModEnabled) {
                    await syncGatewayRule(interaction.guild, 'delete');
                    const updatedSettings = { ...settings, autoModWhitelist: newWhitelist };
                    await syncGatewayRule(interaction.guild, 'create', updatedSettings);
                }

                return interaction.reply({ content: lang === 'fr' ? `✅ Rôle whitelisté: **${role.name}**` : `✅ Whitelisted role: **${role.name}**`, flags: 1 << 6 });
            } else {
                if (!currentWhitelist) return interaction.reply({ content: lang === 'fr' ? '⚠️ La whitelist est déjà vide.' : '⚠️ Whitelist is already empty.', flags: 1 << 6 });
                client.updateServerSetting(interaction.guild.id, 'automodwhitelist', null);
                client.settings.delete(interaction.guild.id);

                if (settings.autoModEnabled) {
                    await syncGatewayRule(interaction.guild, 'delete');
                    const updatedSettings = { ...settings, autoModWhitelist: null };
                    await syncGatewayRule(interaction.guild, 'create', updatedSettings);
                }

                return interaction.reply({ content: lang === 'fr' ? '✅ Whitelist effacée.' : '✅ Whitelist cleared.', flags: 1 << 6 });
            }
        }

        if (subcommand === 'log') {
            const channel = interaction.options.getChannel('channel');
            const currentLogChannel = settings.autoModLogChannel;
            if (currentLogChannel === channel.id) return interaction.reply({ content: lang === 'fr' ? `⚠️ Les logs sont déjà envoyés dans ${channel}.` : `⚠️ Logs are already sent to ${channel}.`, flags: 1 << 6 });
            client.updateServerSetting(interaction.guild.id, 'automodlog', channel.id);
            client.settings.delete(interaction.guild.id);
            return interaction.reply({ content: lang === 'fr' ? `✅ Salon de logs changé : ${currentLogChannel ? `<#${currentLogChannel}>` : 'Aucun'} → ${channel}.` : `✅ Log channel changed: ${currentLogChannel ? `<#${currentLogChannel}>` : 'None'} → ${channel}.`, flags: 1 << 6 });
        }
    },

    // ================= MAIN MESSAGE HOOK =================
    async handleMessage(message, client, db) {
        if (!message.guild || message.author.bot || message.webhookId) return;
        const settings = client.getServerSettings?.(message.guild.id);
        if (!settings || !settings.autoModEnabled) return;

        const member = message.member;
        if (member && settings.autoModWhitelist) {
            const whitelistRoles = settings.autoModWhitelist.split(',');
            if (member.roles.cache.some(r => whitelistRoles.includes(r.id))) return;
        }
        if (member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const content = message.content;
        const userId = message.author.id;
        const guildId = message.guild.id;
        const trackKey = getTrackKey(userId, guildId);
        const now = Date.now();

        if (userMessageHistory.size >= MAX_TRACKED_USERS && !userMessageHistory.has(trackKey)) {
            const firstKey = userMessageHistory.keys().next().value;
            userMessageHistory.delete(firstKey);
            userWarnings.delete(firstKey);
        }
        if (!userMessageHistory.has(trackKey)) {
            userMessageHistory.set(trackKey, { messages: [], lastActivity: now, crossChannelViolations: new Set() });
        }
        const trackEntry = userMessageHistory.get(trackKey);
        trackEntry.lastActivity = now;

        const msgRecord = {
            timestamp: now, content, channelId: message.channel.id, messageId: message.id,
            attachments: message.attachments.map(a => ({ id: a.id, name: a.name, size: a.size, contentType: a.contentType, fingerprint: getAttachmentFingerprint(a), url: a.url })),
            hasLinks: /https?:\/\//i.test(content), normalized: normalizeContent(content)
        };
        trackEntry.messages.push(msgRecord);

        const retentionCutoff = now - 120000;
        while (trackEntry.messages.length > 0 && trackEntry.messages[0].timestamp < retentionCutoff) trackEntry.messages.shift();
        if (trackEntry.messages.length > MAX_HISTORY_PER_USER) trackEntry.messages = trackEntry.messages.slice(-150);

        const history = trackEntry.messages;
        const recentHistory = history.filter(m => now - m.timestamp <= SPAM_WINDOW);
        let violations = [];
        let violationSources = new Set();

        // Single-channel checks
        const sameChannelRecent = recentHistory.filter(m => m.channelId === message.channel.id);
        if (sameChannelRecent.length >= SPAM_THRESHOLD && !violationSources.has('single-spam')) {
            violations.push({ type: 'spam', reason: 'Message flooding', source: 'single-spam' });
            violationSources.add('single-spam');
        }
        if (content.length > 20) {
            const capsCount = (content.match(/[A-Z]/g) || []).length;
            const totalLetters = (content.match(/[A-Za-z]/g) || []).length;
            if (totalLetters > 0 && capsCount / totalLetters > CAPS_RATIO && !violationSources.has('caps')) {
                violations.push({ type: 'caps', reason: 'Excessive caps', source: 'caps' });
                violationSources.add('caps');
            }
        }
        if (content.length > 30) {
            const emojiCount = (content.match(/[\p{Emoji}]/gu) || []).length;
            if (emojiCount / content.length > EMOJI_RATIO && !violationSources.has('emoji')) {
                violations.push({ type: 'emoji', reason: 'Emoji flood', source: 'emoji' });
                violationSources.add('emoji');
            }
        }
        const mentionCount = message.mentions.users.size + message.mentions.roles.size;
        if (mentionCount > MENTION_LIMIT && !violationSources.has('mentions')) {
            violations.push({ type: 'mentions', reason: 'Mass mention', source: 'mentions' });
            violationSources.add('mentions');
        }

        // Cross-channel checks
        const crossChannelRecent = history.filter(m => now - m.timestamp <= CROSS_CHANNEL_WINDOW);
        const rapidFireRecent = history.filter(m => now - m.timestamp <= RAPID_FIRE_WINDOW);
        const attachmentRecent = history.filter(m => now - m.timestamp <= ATTACHMENT_HASH_WINDOW);

        if (rapidFireRecent.length >= CROSS_CHANNEL_MSG_THRESHOLD && !violationSources.has('rapid-fire')) {
            const uniqueChannels = new Set(rapidFireRecent.map(m => m.channelId));
            if (uniqueChannels.size >= 2) {
                violations.push({ type: 'cross-channel spam', reason: `Rapid-fire: ${rapidFireRecent.length} messages across ${uniqueChannels.size} channels in 5s`, source: 'rapid-fire', crossChannel: true });
                violationSources.add('rapid-fire');
            }
        }

        if (!violationSources.has('cross-dupe')) {
            const channelGroups = new Map();
            for (const m of crossChannelRecent) {
                if (!channelGroups.has(m.normalized)) channelGroups.set(m.normalized, new Set());
                channelGroups.get(m.normalized).add(m.channelId);
            }
            const checkedPairs = new Set();
            for (let i = 0; i < crossChannelRecent.length; i++) {
                for (let j = i + 1; j < crossChannelRecent.length; j++) {
                    const a = crossChannelRecent[i], b = crossChannelRecent[j];
                    if (a.channelId === b.channelId) continue;
                    const pairKey = [a.normalized, b.normalized].sort().join('||');
                    if (checkedPairs.has(pairKey)) continue;
                    checkedPairs.add(pairKey);
                    if (similarityScore(a.normalized, b.normalized) >= SIMILARITY_THRESHOLD) {
                        if (!channelGroups.has(a.normalized)) channelGroups.set(a.normalized, new Set());
                        channelGroups.get(a.normalized).add(a.channelId);
                        channelGroups.get(a.normalized).add(b.channelId);
                    }
                }
            }
            for (const [normContent, channels] of channelGroups) {
                if (channels.size >= CROSS_CHANNEL_DUPE_THRESHOLD && normContent.length > 5) {
                    violations.push({ type: 'cross-channel duplicate', reason: `Same message posted in ${channels.size} channels simultaneously`, source: 'cross-dupe', crossChannel: true, channels: [...channels] });
                    violationSources.add('cross-dupe');
                    break;
                }
            }
        }

        if (!violationSources.has('attachment-spam') && message.attachments.size > 0) {
            const attachmentFingerprints = new Map();
            for (const m of attachmentRecent) {
                for (const att of m.attachments) {
                    if (!attachmentFingerprints.has(att.fingerprint)) attachmentFingerprints.set(att.fingerprint, new Set());
                    attachmentFingerprints.get(att.fingerprint).add(m.channelId);
                }
            }
            for (const [fingerprint, channels] of attachmentFingerprints) {
                if (channels.size >= 3) {
                    violations.push({ type: 'attachment spam', reason: `Same file spread across ${channels.size} channels`, source: 'attachment-spam', crossChannel: true, channels: [...channels] });
                    violationSources.add('attachment-spam');
                    break;
                }
            }
        }

        if (!violationSources.has('malicious-spread') && msgRecord.hasLinks) {
            const hasMalicious = hasMaliciousLinks(content);
            const hasInvites = hasUnauthorizedInvites(content, guildId);
            if (hasMalicious || hasInvites) {
                const maliciousChannels = new Set();
                for (const m of crossChannelRecent) {
                    if (m.hasLinks && (hasMaliciousLinks(m.content) || hasUnauthorizedInvites(m.content, guildId))) maliciousChannels.add(m.channelId);
                }
                if (maliciousChannels.size >= 2) {
                    violations.push({ type: 'malicious link spread', reason: `Unauthorized links posted in ${maliciousChannels.size} channels`, source: 'malicious-spread', crossChannel: true, channels: [...maliciousChannels] });
                    violationSources.add('malicious-spread');
                } else if (hasMalicious && !violationSources.has('malicious-link')) {
                    violations.push({ type: 'malicious link', reason: 'Unauthorized or phishing link detected', source: 'malicious-link' });
                    violationSources.add('malicious-link');
                }
            }
        }

        if (!violationSources.has('image-spam') && message.attachments.size > 0 && content.length < 10) {
            const imageChannels = new Set();
            for (const m of attachmentRecent) { if (m.attachments.length > 0 && m.content.length < 10) imageChannels.add(m.channelId); }
            if (imageChannels.size >= 3) {
                violations.push({ type: 'image spam', reason: `Image-only messages across ${imageChannels.size} channels`, source: 'image-spam', crossChannel: true, channels: [...imageChannels] });
                violationSources.add('image-spam');
            }
        }

        if (violations.length === 0 && content.length > 15) {
            const toxicityResult = await checkToxicity(content);
            if (toxicityResult?.toxic && violations.length === 0) {
                violations.push({ type: toxicityResult.type || 'toxic', reason: toxicityResult.reason, source: 'ai-toxicity' });
            }
        }

        if (violations.length > 0) {
            await this.handleViolation(message, violations, settings, client, db);
            return true;
        }
        return false;
    },

    // ================= HANDLE VIOLATION =================
    async handleViolation(message, violations, settings, client, db) {
        const userId = message.author.id;
        const guildId = message.guild.id;
        const trackKey = getTrackKey(userId, guildId);
        const warnCount = (userWarnings.get(trackKey) || 0) + 1;
        userWarnings.set(trackKey, warnCount);

        const hasCrossChannel = violations.some(v => v.crossChannel);
        const hasMalicious = violations.some(v => v.type.includes('malicious') || v.type.includes('phishing'));

        let action = 'warn';
        let timeoutDuration = null;
        if (warnCount >= 5) action = 'ban';
        else if (warnCount >= 3) { action = 'timeout'; timeoutDuration = hasCrossChannel ? 7 * 24 * 60 * 60 * 1000 : 2 * 24 * 60 * 60 * 1000; }
        else if (warnCount >= 2) action = 'mute';
        if (hasMalicious && hasCrossChannel && warnCount >= 2) action = 'ban';

        // Delete the triggering message
        await message.delete().catch(() => {});

        // Delete cross-channel copies
        const crossChannelViolation = violations.find(v => v.crossChannel && v.channels);
        if (crossChannelViolation?.channels) {
            for (const channelId of crossChannelViolation.channels) {
                if (channelId === message.channel.id) continue;
                const channel = message.guild.channels.cache.get(channelId);
                if (!channel) continue;
                const trackEntry = userMessageHistory.get(trackKey);
                if (!trackEntry) continue;
                const matchingMsgs = trackEntry.messages.filter(m => m.channelId === channelId && Date.now() - m.timestamp <= CROSS_CHANNEL_WINDOW);
                for (const m of matchingMsgs) {
                    try { const msg = await channel.messages.fetch(m.messageId).catch(() => null); if (msg) await msg.delete().catch(() => {}); }
                    catch (e) {}
                }
            }
        }

        // ================= OUTPUT A: DISCORD-STYLE EPHEMERAL NOTIFICATION =================
        const primaryViolation = violations[0];
        let notifyLines = [
            `⚠️ Your message was removed by automated moderation.`,
            `Reason: ${primaryViolation.type} — ${primaryViolation.reason}`,
            `Warning ${warnCount} of 5. Further violations will escalate.`
        ];
        if (hasCrossChannel && crossChannelViolation?.channels) {
            notifyLines.push(`All copies across ${crossChannelViolation.channels.length} channels have been removed.`);
        }
        const notifyText = notifyLines.join('\n');

        await message.channel.send({ content: notifyText })
            .then(m => setTimeout(() => m.delete().catch(() => {}), 6000))
            .catch(() => {});

        // ================= OUTPUT B: PROFESSIONAL SENTENCING LOG =================
        const logChannelId = settings.autoModLogChannel;
        if (logChannelId) {
            const logChannel = message.guild.channels.cache.get(logChannelId);
            if (logChannel && logChannel.permissionsFor(message.guild.members.me)?.has(PermissionsBitField.Flags.SendMessages)) {
                const { bar, next } = getEscalationBar(warnCount);
                const actionEmoji = getActionEmoji(action);
                const actionTitle = getActionTitle(action);

                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setAuthor({ name: `⚖️ ARCHITECT CG-223 • SENTENCING ORDER`, iconURL: client.user.displayAvatarURL() })
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setTitle(`${actionEmoji} ${actionTitle}`)
                    .addFields(
                        { name: '📋 OFFENDER', value: `${message.author} (${message.author.tag}) | ID: \`${userId}\``, inline: false },
                        { name: '📝 VIOLATION', value: `**${primaryViolation.type}** — ${primaryViolation.reason}`, inline: false },
                        { name: '⚡ ACTION TAKEN', value: `**${action.toUpperCase()}** — Warning #${warnCount} of 5`, inline: false },
                        { name: '📍 LOCATION', value: `<#${message.channel.id}>`, inline: true },
                        { name: '📅 TIMESTAMP', value: formatTimestamp(new Date()), inline: true }
                    )
                    .setFooter({ text: `ARCHITECT CG-223 • Autonomous Moderation • v${VERSION}`, iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();

                // Cross-channel field (omitted if single-channel)
                if (hasCrossChannel && crossChannelViolation?.channels && crossChannelViolation.channels.length > 1) {
                    embed.addFields({
                        name: '🌐 CROSS-CHANNEL ACTIVITY',
                        value: crossChannelViolation.channels.map(c => `<#${c}>`).join(' '),
                        inline: false
                    });
                }

                // Escalation status
                embed.addFields({
                    name: '📊 ESCALATION STATUS',
                    value: `${bar} ${warnCount}/5 — NEXT: ${next}`,
                    inline: false
                });

                await logChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }

        // ================= EXECUTE MODERATION ACTION =================
        try {
            switch (action) {
                case 'mute': {
                    let muteRoleId = settings.muteRoleId || settings.muterole || settings.muteRole;
                    if (!muteRoleId) {
                        try { const row = db.prepare('SELECT muterole FROM server_settings WHERE guild_id = ?').get(message.guild.id); if (row?.muterole) muteRoleId = row.muterole; }
                        catch (e) {}
                    }
                    if (!muteRoleId && message.guild.id === '1218532454655955034') muteRoleId = process.env.MUTE_ROLE_ID || process.env.MUTED_ROLE;
                    if (!muteRoleId) {
                        console.log(`[AUTOMOD] Mute skipped — No mute role configured for guild "${message.guild.name}" (${message.guild.id}).`);
                        try { db.prepare(`INSERT INTO moderation_logs (guild_id, user_id, moderator_id, action, reason, timestamp) VALUES (?, ?, ?, 'warn', ?, ?)`).run(message.guild.id, userId, client.user.id, `Auto-Mod (mute failed - no role): ${violations[0].reason}`, Date.now()); }
                        catch (e) {}
                        break;
                    }
                    const muteRole = message.guild.roles.cache.get(muteRoleId);
                    if (!muteRole) { console.log(`[AUTOMOD] Mute role not found in ${message.guild.name}.`); break; }
                    const member = await message.guild.members.fetch(userId).catch(() => null);
                    if (!member) { console.log(`[AUTOMOD] Member ${userId} left before mute.`); break; }
                    await member.roles.add(muteRole).catch(err => console.log(`[AUTOMOD] Failed to add mute role: ${err.message}`));
                    setTimeout(() => member.roles.remove(muteRole).catch(() => {}), 3600000);
                    try { db.prepare(`INSERT INTO moderation_logs (guild_id, user_id, moderator_id, action, reason, timestamp) VALUES (?, ?, ?, 'mute', ?, ?)`).run(message.guild.id, userId, client.user.id, `Auto-Mod: ${violations[0].reason}`, Date.now()); }
                    catch (e) { console.log(`[AUTOMOD] Failed to log mute: ${e.message}`); }
                    console.log(`[AUTOMOD] 🔇 Muted ${message.author.tag} in ${message.guild.name}`);
                    break;
                }
                case 'timeout': {
                    const member = await message.guild.members.fetch(userId).catch(() => null);
                    if (member?.moderatable) {
                        await member.timeout(timeoutDuration, `Auto-Mod: Warning #${warnCount} — ${violations[0].reason}`).catch(() => {});
                        try { db.prepare(`INSERT INTO moderation_logs (guild_id, user_id, moderator_id, action, reason, timestamp) VALUES (?, ?, ?, 'timeout', ?, ?)`).run(message.guild.id, userId, client.user.id, `Auto-Mod (${Math.round(timeoutDuration/86400000)}-day timeout): ${violations[0].reason}`, Date.now()); }
                        catch (e) {}
                    }
                    break;
                }
                case 'ban': {
                    const member = await message.guild.members.fetch(userId).catch(() => null);
                    if (member?.bannable) {
                        await member.ban({ reason: `Auto-Mod: ${violations[0].reason}` }).catch(() => {});
                        try { db.prepare(`INSERT INTO moderation_logs (guild_id, user_id, moderator_id, action, reason, timestamp) VALUES (?, ?, ?, 'ban', ?, ?)`).run(message.guild.id, userId, client.user.id, `Auto-Mod: ${violations[0].reason}`, Date.now()); }
                        catch (e) {}
                    }
                    break;
                }
            }
        } catch (e) { console.log(`[AUTOMOD] Action failed: ${e.message}`); }

        if (action === 'warn') {
            try {
                db.prepare(`INSERT INTO moderation_logs (guild_id, user_id, moderator_id, action, reason, timestamp) VALUES (?, ?, ?, 'warn', ?, ?)`).run(message.guild.id, userId, client.user.id, `Auto-Mod: ${violations[0].reason}`, Date.now());
                const warningId = `AM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                const expiresAt = Math.floor(Date.now() / 1000) + (30 * 86400);
                db.prepare(`INSERT INTO warnings (id, guild_id, user_id, moderator_id, reason, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, 1)`).run(warningId, message.guild.id, userId, client.user.id, `Auto-Mod: ${violations[0].reason}`, expiresAt);
            } catch (e) {}
        }

        if (action !== 'warn') {
            const crossPrefix = hasCrossChannel ? '[CROSS-CHANNEL] ' : '';
            console.log(`[AUTOMOD] ${crossPrefix}${action.toUpperCase()} | ${message.author.tag} | ${violations.map(v => v.type).join(', ')}`);
        }
    },

    // ================= COMMAND HANDLER =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const isOwner = message.author.id === message.guild.ownerId;
        const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!isOwner && !isAdmin) {
            const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
            return message.reply(lang === 'fr' ? '🔒 Seul le propriétaire du serveur ou les administrateurs peuvent configurer l\'auto-mod.' : '🔒 Only the server owner or administrators can configure auto-mod.');
        }

        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const settings = client.getServerSettings(message.guild.id);
        const action = args[0]?.toLowerCase() || 'status';

        if (action === 'status') {
            const embed = new EmbedBuilder()
                .setColor(settings.autoModEnabled ? '#2ecc71' : '#e74c3c')
                .setAuthor({ name: '🛡️ AUTO-MOD AI STATUS', iconURL: client.user.displayAvatarURL() })
                .addFields(
                    { name: '⚡ Status', value: settings.autoModEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '🎯 Sensitivity', value: (settings.autoModSensitivity || 'medium').toUpperCase(), inline: true },
                    { name: '📋 Log Channel', value: settings.autoModLogChannel ? `<#${settings.autoModLogChannel}>` : '❌ Not set', inline: true },
                    { name: '👑 Whitelist', value: settings.autoModWhitelist ? settings.autoModWhitelist.split(',').map(r => `<@&${r}>`).join(' ') : 'None', inline: false },
                    { name: '⏱️ Auto-Mute', value: (() => {
                        const muteId = settings.muteRoleId || settings.muterole || settings.muteRole || settings['mute role id'];
                        if (muteId) return `<@&${muteId}>`;
                        try { const row = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(message.guild.id); if (row) { const dbMute = row['mute role id'] || row.muterole || row.muteRoleId; if (dbMute) return `<@&${dbMute}>`; } }
                        catch (e) {}
                        if (message.guild.id === '1218532454655955034') { const envMute = process.env.MUTE_ROLE_ID || process.env.MUTED_ROLE; if (envMute) return `<@&${envMute}> \u{1F539} .env`; }
                        return '\u274c No mute role set';
                    })(), inline: false }
                )
                .setFooter({ text: `ARCHITECT CG-223 • Auto-Mod AI • v${VERSION}` })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        if (action === 'enable' || action === 'on') {
            const dbSettings = client.db.prepare('SELECT automod_enabled FROM server_settings WHERE guild_id = ?').get(message.guild.id);
            if (dbSettings?.automod_enabled !== 0) return message.reply(lang === 'fr' ? '⚠️ L\'auto-mod est déjà **ACTIVÉ**.' : '⚠️ Auto-mod is already **ENABLED**.');

            const botMember = message.guild.members.me;
            const missingPerms = [];
            if (!botMember.permissions.has(PermissionsBitField.Flags.ManageGuild)) missingPerms.push('`Manage Guild`');
            if (!botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) missingPerms.push('`Manage Messages`');
            if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) missingPerms.push('`Moderate Members`');
            if (missingPerms.length > 0) return message.reply(lang === 'fr' ? `🛡️ **Permissions insuffisantes**\n\n${botMember.user.username} a besoin de :\n${missingPerms.map(p => `• ${p}`).join('\n')}\n\n📋 Contactez le propriétaire du serveur.` : `🛡️ **Insufficient Permissions**\n\n${botMember.user.username} needs:\n${missingPerms.map(p => `• ${p}`).join('\n')}\n\n📋 Ask the server owner.`);

            let gatewayMsg = '';
            const synced = await syncGatewayRule(message.guild, 'create', settings);
            gatewayMsg = synced ? '\n🛡️ Shield badge active!' : '';
            client.db.prepare("UPDATE server_settings SET automod_enabled = 1, updated_at = strftime('%s', 'now') WHERE guild_id = ?").run(message.guild.id);
            client.settings.delete(message.guild.id);
            return message.reply(lang === 'fr' ? `✅ Auto-mod **ACTIVÉ**.${gatewayMsg}` : `✅ Auto-mod **ENABLED**.${gatewayMsg}`);
        }

        if (action === 'disable' || action === 'off') {
            const dbSettings = client.db.prepare('SELECT automod_enabled FROM server_settings WHERE guild_id = ?').get(message.guild.id);
            if (dbSettings?.automod_enabled === 0) return message.reply(lang === 'fr' ? '⚠️ L\'auto-mod est déjà **DÉSACTIVÉ**.' : '⚠️ Auto-mod is already **DISABLED**.');
            await syncGatewayRule(message.guild, 'delete');
            client.db.prepare("UPDATE server_settings SET automod_enabled = 0, updated_at = strftime('%s', 'now') WHERE guild_id = ?").run(message.guild.id);
            client.settings.delete(message.guild.id);
            return message.reply(lang === 'fr' ? '✅ Auto-mod **DÉSACTIVÉ**.' : '✅ Auto-mod **DISABLED**.');
        }

        if (action === 'sensitivity') {
            const level = args[1]?.toLowerCase();
            if (!['low', 'medium', 'high'].includes(level)) return message.reply(lang === 'fr' ? '❌ Usage: `.automod sensitivity <low|medium|high>`' : '❌ Usage: `.automod sensitivity <low|medium|high>`');
            const currentLevel = settings.autoModSensitivity || 'medium';
            if (level === currentLevel) return message.reply(lang === 'fr' ? `⚠️ La sensibilité est déjà réglée sur **${level.toUpperCase()}**.` : `⚠️ Sensitivity is already set to **${level.toUpperCase()}**.`);
            client.updateServerSetting(message.guild.id, 'automodsensitivity', level);
            client.settings.delete(message.guild.id);
            return message.reply(lang === 'fr' ? `✅ Sensibilité changée de **${currentLevel.toUpperCase()}** → **${level.toUpperCase()}**.` : `✅ Sensitivity changed from **${currentLevel.toUpperCase()}** → **${level.toUpperCase()}**.`);
        }

        if (action === 'whitelist') {
            const role = message.mentions.roles.first();
            const currentWhitelist = settings.autoModWhitelist;
            if (role) {
                if (currentWhitelist === role.id || (currentWhitelist && currentWhitelist.split(',').includes(role.id))) return message.reply(lang === 'fr' ? `⚠️ Le rôle **${role.name}** est déjà whitelisté.` : `⚠️ Role **${role.name}** is already whitelisted.`);
                const newWhitelist = currentWhitelist ? `${currentWhitelist},${role.id}` : role.id;
                client.updateServerSetting(message.guild.id, 'automodwhitelist', newWhitelist);
                client.settings.delete(message.guild.id);

                if (settings.autoModEnabled) {
                    await syncGatewayRule(message.guild, 'delete');
                    const updatedSettings = { ...settings, autoModWhitelist: newWhitelist };
                    await syncGatewayRule(message.guild, 'create', updatedSettings);
                }
                return message.reply(lang === 'fr' ? `✅ Rôle whitelisté: **${role.name}**` : `✅ Whitelisted role: **${role.name}**`);
            } else {
                if (!currentWhitelist) return message.reply(lang === 'fr' ? '⚠️ La whitelist est déjà vide.' : '⚠️ Whitelist is already empty.');
                client.updateServerSetting(message.guild.id, 'automodwhitelist', null);
                client.settings.delete(message.guild.id);

                if (settings.autoModEnabled) {
                    await syncGatewayRule(message.guild, 'delete');
                    const updatedSettings = { ...settings, autoModWhitelist: null };
                    await syncGatewayRule(message.guild, 'create', updatedSettings);
                }
                return message.reply(lang === 'fr' ? '✅ Whitelist effacée.' : '✅ Whitelist cleared.');
            }
        }

        if (action === 'log') {
            const channel = message.mentions.channels.first();
            if (!channel) return message.reply(lang === 'fr' ? '❌ Mentionnez un salon. Ex: `.automod log #mod-logs`' : '❌ Mention a channel. Ex: `.automod log #mod-logs`');
            const currentLogChannel = settings.autoModLogChannel;
            if (currentLogChannel === channel.id) return message.reply(lang === 'fr' ? `⚠️ Les logs sont déjà envoyés dans ${channel}.` : `⚠️ Logs are already sent to ${channel}.`);
            client.updateServerSetting(message.guild.id, 'automodlog', channel.id);
            client.settings.delete(message.guild.id);
            return message.reply(lang === 'fr' ? `✅ Salon de logs changé : ${currentLogChannel ? `<#${currentLogChannel}>` : 'Aucun'} → ${channel}.` : `✅ Log channel changed: ${currentLogChannel ? `<#${currentLogChannel}>` : 'None'} → ${channel}.`);
        }

        return message.reply(lang === 'fr'
            ? '🛡️ **Auto-Mod AI — Commandes:**\n\n📊 `.automod status` — Voir l\'état\n✅ `.automod enable` — Activer\n❌ `.automod disable` — Désactiver\n🎯 `.automod sensitivity <low|medium|high>` — Sensibilité\n👑 `.automod whitelist @role` — Ajouter rôle\n🧹 `.automod whitelist` — Effacer whitelist\n📋 `.automod log #channel` — Définir salon logs'
            : '🛡️ **Auto-Mod AI — Commands:**\n\n📊 `.automod status` — View status\n✅ `.automod enable` — Enable\n❌ `.automod disable` — Disable\n🎯 `.automod sensitivity <low|medium|high>` — Sensitivity\n👑 `.automod whitelist @role` — Add role\n🧹 `.automod whitelist` — Clear whitelist\n📋 `.automod log #channel` — Set log channel');
    }
};