// plugins/emoji-admin.js — /emojis check + /emojis sync
const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { card } = require('../lib/games/v2');
const i18n = require('../lib/i18n');

const APP_ID = process.env.DISCORD_APP_ID || process.env.CLIENT_ID || process.env.APPLICATION_ID || null;
const REGISTRY_PATH = path.join(__dirname, '..', 'config', 'emojis.js');

// ── Helpers ──
async function fetchAppEmojis(appId) {
    const id = appId || APP_ID;
    if (!id) throw new Error('App ID unavailable (no env, no client.application)');
    const token = process.env.DISCORD_TOKEN;
    const res = await fetch(`https://discord.com/api/v10/applications/${id}/emojis`, {
        headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const { items } = await res.json();
    const map = new Map();
    for (const e of items) map.set(e.name.toLowerCase(), { id: e.id, animated: !!e.animated, name: e.name });
    return map;
}

function readRegistry() {
    delete require.cache[require.resolve(REGISTRY_PATH)];
    return require(REGISTRY_PATH);
}

function analyse(registry, appMap) {
    const remap = [];   // { key, oldId, newId, animated }
    const add = [];     // { name, id, animated }
    const missing = []; // { key, name, id } — dans registry mais pas dans app
    const knownNames = new Set();

    for (const [key, val] of Object.entries(registry)) {
        const m = String(val || '').match(/<a?:(\w+):(\d+)>/);
        if (!m) continue;
        const [, name, oldId] = m;
        knownNames.add(name.toLowerCase());
        const app = appMap.get(name.toLowerCase());
        if (!app) { missing.push({ key, name, id: oldId }); continue; }
        if (app.id !== oldId) remap.push({ key, oldId, newId: app.id, animated: app.animated });
    }

    for (const [name, meta] of appMap) {
        if (!knownNames.has(name)) add.push({ name: meta.name, id: meta.id, animated: meta.animated });
    }
    return { remap, add, missing };
}

// ── Apply : écrit le fichier ──
function applySync(registry, appMap) {
    const lines = [];
    let remapped = 0, added = 0;
    const today = new Date().toISOString().slice(0, 10);

    // Bloc manuel (ordre original préservé)
    for (const [key, val] of Object.entries(registry)) {
        const m = String(val || '').match(/<a?:(\w+):(\d+)>/);
        if (!m) { lines.push(`    ${key}: ${JSON.stringify(val)},`); continue; }
        const [, name, oldId] = m;
        const app = appMap.get(name.toLowerCase());
        if (!app) { lines.push(`    ${key}: ${JSON.stringify(val)},   // ⚠️ orphelin`); continue; }
        if (app.id !== oldId) remapped++;
        const prefix = app.animated ? 'a' : '';
        lines.push(`    ${key}: '<${prefix}:${name}:${app.id}>',`);
    }

    // Bloc auto (nouveaux app emojis pas dans registry)
    const knownNames = new Set(Object.values(registry).map(v => (String(v).match(/<a?:(\w+):/)?.[1] || '').toLowerCase()).filter(Boolean));
    const autoLines = [];
    for (const [name, meta] of appMap) {
        if (knownNames.has(name)) continue;
        const prefix = meta.animated ? 'a' : '';
        autoLines.push(`    ${meta.name}: '<${prefix}:${meta.name}:${meta.id}>',   // [auto ${today}]`);
        added++;
    }

    const header = `/**
 * ARCHON CG-223 — Application Emoji Registry
 *
 * AUTO-SYNCED by /emojis sync — do not edit manually
 * Last sync: ${new Date().toISOString()}
 * Source: Discord Application ${APP_ID}
 */

module.exports = {
${lines.join('\n')}
${autoLines.length ? '\n    // ═══ AUTO-IMPORTÉS ═══\n' + autoLines.join('\n') + '\n' : ''}};
`;
    fs.writeFileSync(REGISTRY_PATH, header);
    return { remapped, added };
}

// ── Card builders ──
function checkCard(t, { remap, add, missing }, total, appTotal) {
    const items = [];
    items.push({ text: `## 📊 ${t('title')}` });
    items.push({ text: t('summary', { reg: total, app: appTotal }) });
    items.push({ rule: true });
    items.push({ text: `✅ ${t('inSync')} : ${total - remap.length - missing.length}` });
    items.push({ text: `🔧 ${t('toRemap')} : ${remap.length}` });
    items.push({ text: `➕ ${t('toAdd')} : ${add.length}` });
    items.push({ text: `❌ ${t('orphans')} : ${missing.length}` });

    if (add.length) {
        items.push({ rule: true });
        items.push({ text: `### ➕ ${t('newList')}` });
        items.push({ text: add.slice(0, 15).map(a => `• \`${a.name}\` → \`<${a.animated ? 'a' : ''}:${a.name}:${a.id}>\``).join('\n') });
        if (add.length > 15) items.push({ text: `-# …+${add.length - 15}` });
    }

    if (remap.length) {
        items.push({ rule: true });
        items.push({ text: `### 🔧 ${t('remapList')}` });
        items.push({ text: remap.slice(0, 10).map(r => `• \`${r.key}\` → ID \`${r.newId}\``).join('\n') });
        if (remap.length > 10) items.push({ text: `-# …+${remap.length - 10}` });
    }

    items.push({ rule: true });
    items.push({ text: `-# ${t('hint')}` });
    return items;
}

// ── Module ──
module.exports = {
    name: 'emojis',
    category: 'SYSTEM',
    cooldown: 3000,
    data: new SlashCommandBuilder()
        .setName('emojis')
        .setDescription('Emoji registry sync tools')
        .addSubcommand(s => s.setName('check').setDescription('Report registry sync status'))
        .addSubcommand(s => s.setName('sync').setDescription('Apply registry sync (owner only)')),

    execute: async (interaction) => {
        const sub = interaction.options.getSubcommand();
        const lang = interaction.client.detectLanguage?.('/emojis', 'en') || 'en';
        const t = (k, v) => i18n.t('emojis.' + k, lang, v);

        // Guard : sync = owner uniquement
        if (sub === 'sync') {
            const OWNER = process.env.OWNER_ID;
            if (OWNER && interaction.user.id !== OWNER) {
                return interaction.reply({ content: t('ownerOnly'), flags: 64 });
            }
        }

        await interaction.deferReply({ flags: sub === 'sync' ? 64 : 0 });

        try {
            const appMap = await fetchAppEmojis(interaction.client.application?.id);
            const registry = readRegistry();
            const result = analyse(registry, appMap);
            const total = Object.keys(registry).length;

            if (sub === 'check') {
                const items = checkCard(t, result, total, appMap.size);
                return interaction.editReply({ ...card(0xFFD700, items), allowedMentions: { parse: [] } });
            }

            // sync
            if (result.remap.length === 0 && result.add.length === 0) {
                return interaction.editReply({ ...card(0x2ECC71, [
                    { text: `## ✅ ${t('syncClean')}` },
                    { text: t('syncCleanMsg') },
                ]), allowedMentions: { parse: [] } });
            }

            const { remapped, added } = applySync(registry, appMap);
            const items = [];
            items.push({ text: `## ✅ ${t('syncDone')}` });
            items.push({ rule: true });
            items.push({ text: `🔧 ${t('remapped')} : ${remapped}\n➕ ${t('added')} : ${added}` });
            items.push({ rule: true });
            items.push({ text: `-# ${t('restartHint')}` });
            return interaction.editReply({ ...card(0x2ECC71, items), allowedMentions: { parse: [] } });
        } catch (e) {
            console.error('[EMOJIS]', e);
            return interaction.editReply({ content: `❌ ${e.message}` });
        }
    },
};
