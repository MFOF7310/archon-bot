'use strict';
// ARCHON updater.
// - tells the owner by DM when a newer version.txt is on GitHub
// - installs it safely: pull, safety checks, restart, automatic rollback
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const { t } = require('./i18n');
const EMOJIS = require('../config/emojis');

const ROOT = process.env.ARCHON_UPDATE_ROOT || path.join(__dirname, '..');
const RESULT_FILE = path.join(os.tmpdir(), 'archon-update-result.json');
const FALLBACK_REPO = 'MFOF7310/archon-bot';
const LANGS = ['en', 'fr', 'zh', 'ar'];

// Text lookup. Values are always passed, and filled again here, so the
// translator never replaces a placeholder with an emoji.
function tx(key, lang, vars) {
    vars = vars || {};
    let s = String(t('update.' + key, lang, vars));
    for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
}

function git() {
    return execFileSync('git', Array.from(arguments), { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 120000 }).trim();
}

function firstLine(e) {
    return String((e && (e.stderr || e.message)) || e).trim().split('\n')[0].slice(0, 200);
}

function parseSlug(url) {
    const m = String(url).trim().match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/);
    return m ? m[1] : null;
}

function repoSlug() {
    try { return parseSlug(git('remote', 'get-url', 'origin')) || FALLBACK_REPO; }
    catch (e) { return FALLBACK_REPO; }
}

function isNewer(remote, local) {
    const a = String(remote).match(/\d+/g) || [];
    const b = String(local).match(/\d+/g) || [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = parseInt(a[i] || 0, 10), y = parseInt(b[i] || 0, 10);
        if (x !== y) return x > y;
    }
    return false;
}

function localVersion(client) {
    try { return fs.readFileSync(path.join(ROOT, 'version.txt'), 'utf8').trim(); }
    catch (e) { return (client && client.version) || '?'; }
}

async function remoteInfo() {
    const base = 'https://raw.githubusercontent.com/' + repoSlug() + '/main/';
    const opts = { timeout: 10000, responseType: 'text', transformResponse: function (x) { return x; } };
    const res = await Promise.allSettled([axios.get(base + 'version.txt', opts), axios.get(base + 'changelog.txt', opts)]);
    if (res[0].status !== 'fulfilled') return null;
    const version = String(res[0].value.data).trim();
    if (!/^\d+(\.\d+)*$/.test(version)) return null;
    const notes = res[1].status === 'fulfilled' ? String(res[1].value.data).trim() : '';
    return { version: version, notes: notes };
}

function ownerLang(client) {
    try {
        const s = (client.getServerSettings && client.getServerSettings(process.env.GUILD_ID)) || {};
        const l = String(s.language || s.lang || 'en').toLowerCase();
        return LANGS.includes(l) ? l : 'en';
    } catch (e) { return 'en'; }
}

function mkEmbed(color, title, description, fields) {
    const e = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
    if (fields && fields.length) e.addFields(fields);
    return e;
}

function resultEmbed(r, lang) {
    const E = EMOJIS;
    let color = '#e74c3c', title = 'titleFailed', text = '', fields = [];
    switch (r.status) {
        case 'upToDate':
            color = '#f1c40f'; title = 'titleUpToDate';
            text = E.check + ' ' + tx('upToDate', lang, { ver: r.version }); break;
        case 'restarting': {
            color = '#2ecc71'; title = 'titleDone';
            text = E.check + ' ' + tx('restarting', lang, { oldV: r.oldVersion, newV: r.newVersion });
            const notes = String(r.notes || '').slice(0, 1000) || tx('noNotes', lang);
            fields = [{ name: tx('whatsNew', lang), value: notes }];
            break;
        }
        case 'wrongBranch':
            text = E.warning + ' ' + tx('wrongBranch', lang, { branch: r.branch }); break;
        case 'localChanges':
            text = E.warning + ' ' + tx('localChanges', lang, { list: r.files.map(function (f) { return '• ' + f; }).join('\n') }); break;
        case 'syntaxFail':
            text = E.error + ' ' + tx('syntaxFail', lang, { file: r.file }); break;
        case 'installFail':
            text = E.error + ' ' + tx('installFail', lang); break;
        case 'pullFail':
            text = E.error + ' ' + tx('pullFail', lang, { why: r.why || '' }); break;
        case 'fetchFail':
            text = E.error + ' ' + tx('fetchFail', lang); break;
        default:
            text = E.error + ' ' + tx('unknownFail', lang, { why: r.why || '' });
    }
    return mkEmbed(color, tx(title, lang), text, fields);
}

// Installs the newest version. Never edits version.txt by hand: it comes from the pull.
async function applyUpdate(client) {
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    if (branch !== 'main') return { status: 'wrongBranch', branch: branch };

    // tracked files edited by hand (plain file names, nothing to cut off)
    const dirty = git('diff', '--name-only', 'HEAD').split('\n').filter(Boolean);
    if (dirty.length) return { status: 'localChanges', files: dirty.slice(0, 8) };

    const oldHash = git('rev-parse', 'HEAD');
    const oldVersion = localVersion(client);

    try { git('fetch', 'origin', 'main'); } catch (e) { return { status: 'fetchFail' }; }
    const behind = parseInt(git('rev-list', '--count', 'HEAD..origin/main'), 10) || 0;
    if (!behind) return { status: 'upToDate', version: oldVersion };

    try { git('merge', '--ff-only', 'origin/main'); }
    catch (e) { return { status: 'pullFail', why: firstLine(e) }; }

    const rollback = function () { try { git('reset', '--hard', oldHash); } catch (e) {} };
    const changed = git('diff', '--name-only', oldHash, 'HEAD').split('\n').filter(Boolean);

    for (const f of changed.filter(function (x) { return x.endsWith('.js'); })) {
        const full = path.join(ROOT, f);
        if (!fs.existsSync(full)) continue;
        try { execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' }); }
        catch (e) { rollback(); return { status: 'syntaxFail', file: f }; }
    }

    if (changed.includes('package.json') || changed.includes('package-lock.json')) {
        try { execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'pipe', timeout: 300000 }); }
        catch (e) { rollback(); return { status: 'installFail' }; }
    }

    const newVersion = localVersion(client);
    let notes = '';
    try { notes = fs.readFileSync(path.join(ROOT, 'changelog.txt'), 'utf8').trim(); } catch (e) {}

    if (!process.env.ARCHON_UPDATE_DRY) {
        // PM2 kills every process the bot started when it restarts it. So the helper is
        // started by a middleman that exits at once, and the helper is not a child of the bot.
        const helper = path.join(__dirname, 'update-helper.js');
        const args = [helper, oldHash, oldVersion, newVersion, process.env.name || 'Architect-CG223', ROOT];
        const launcher = "require('child_process').spawn(process.execPath," + JSON.stringify(args) + ",{detached:true,stdio:'ignore'}).unref()";
        spawn(process.execPath, ['-e', launcher], { detached: true, stdio: 'ignore' }).unref();
    }
    return { status: 'restarting', oldVersion: oldVersion, newVersion: newVersion, notes: notes };
}

// DM the owner once per new version (and at most once a day).
async function checkAndNotify(client, db) {
    const info = await remoteInfo();
    if (!info) return 'unreachable';
    const local = localVersion(client);
    if (!isNewer(info.version, local)) return 'current';

    const get = function (k) { const r = db.prepare('SELECT value FROM bot_meta WHERE key = ?').get(k); return r && r.value; };
    const set = function (k, v) { db.prepare('INSERT OR REPLACE INTO bot_meta (key, value) VALUES (?, ?)').run(k, String(v)); };
    if (get('update_notified_version') === info.version) return 'already';
    if (Date.now() - Number(get('update_notified_at') || 0) < 20 * 3600 * 1000) return 'too-soon';

    const owner = await client.users.fetch(process.env.OWNER_ID).catch(function () { return null; });
    if (!owner) return 'no-owner';

    const lang = ownerLang(client);
    const cmd = (process.env.PREFIX || '.') + 'update';
    const notes = info.notes.slice(0, 1000) || tx('noNotes', lang);
    const embed = mkEmbed('#00f0ff', tx('titleAvailable', lang),
        EMOJIS.website + ' ' + tx('available', lang, { newV: info.version, oldV: local, cmd: cmd }),
        [{ name: tx('whatsNew', lang), value: notes }]);
    await owner.send({ embeds: [embed] });
    set('update_notified_version', info.version);
    set('update_notified_at', Date.now());
    console.log('[UPDATE] Owner notified about version ' + info.version);
    return 'sent';
}

// After a restart started by .update, tell the owner how it went.
async function announceAfterRestart(client) {
    if (!fs.existsSync(RESULT_FILE)) return false;
    let r = null;
    try { r = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8')); } catch (e) {}
    try { fs.unlinkSync(RESULT_FILE); } catch (e) {}
    if (!r) return false;
    const owner = await client.users.fetch(process.env.OWNER_ID).catch(function () { return null; });
    if (!owner) return false;
    const lang = ownerLang(client);
    const embed = r.ok
        ? mkEmbed('#2ecc71', tx('titleBack', lang), EMOJIS.check + ' ' + tx('back', lang, { ver: r.newVersion }))
        : mkEmbed('#e67e22', tx('titleRolledBack', lang), EMOJIS.warning + ' ' + tx('rolledBack', lang, { ver: r.oldVersion }));
    await owner.send({ embeds: [embed] });
    return true;
}

module.exports = { tx, isNewer, parseSlug, localVersion, remoteInfo, applyUpdate, resultEmbed, checkAndNotify, announceAfterRestart };
