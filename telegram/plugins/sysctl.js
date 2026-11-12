// telegram/plugins/sysctl.js — the server from Telegram, owner only.
//   /sysctl (also /pm2, /check)  one card: server health, every app, last deploys, open cases, with buttons
//   /tail <app> [lines]          the last lines of an app's log (also /logs)
//   /file <path>                 sends a file from the server (read-only; secrets are refused)
//   /grep <text> [where]         searches the code or the logs of any app in PM2's list (rg, or grep when rg is missing)
//   /sed <file> <from>,<to>      shows those lines of a file, numbered (read-only: the bot reads the file itself)
//   /sysctl restart|stop|start <app>, /sysctl errors, /sysctl flush
// Files, logs and code are only sent in a private chat with the owner, never in a group.
// Everything runs through execFile with fixed arguments: nothing the owner types reaches a shell.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const BOT_DIR = path.resolve(__dirname, '..', '..');
const HOME = process.env.HOME || '/root';
const BACKUPS = process.env.DEPLOY_BACKUP_DIR || path.join(HOME, 'deploy-backups');
const SELF = 'Architect-CG223';

// Short names for the apps; anything else is matched against PM2's own names
const ALIAS = {
    bot: SELF, arch: SELF, archon: SELF,
    dash: 'architect-dashboard', dashboard: 'architect-dashboard',
    hook: 'archon-webhook', webhook: 'archon-webhook',
    lava: 'lavalink', wa: 'archon-wa', whatsapp: 'archon-wa',
};
const LABEL = { [SELF]: 'ARCHON bot', 'architect-dashboard': 'Dashboard', 'archon-webhook': 'Deploy webhook' };
const DIRS = { [SELF]: BOT_DIR, 'architect-dashboard': process.env.DEPLOY_DASHBOARD_DIR || '/opt/dashboard' };

// /file: where it may read, and what it never sends
const FILE_ROOTS = [BOT_DIR, DIRS['architect-dashboard'], BACKUPS, path.join(HOME, '.pm2', 'logs')];
// Never sent, listed or searched, in any app's folder: env files (also "config.env"), keys and certificates, login
// sessions (WhatsApp creds, cookies), databases, tokens, and the folders that only hold such things
const SECRET = [/(^|\/)[^/]*\.env(\.[^/]*)?$/i, /\.(pem|key|p12|pfx|jks|keystore|session)$/i, /(^|\/)id_[a-z0-9]+/i, /(^|\/)\.ssh(\/|$)/, /(^|\/)\.kene(\/|$)/,
    /backup-env/i, /\.(db|sqlite|sqlite3)(-wal|-shm|-journal)?$/i, /(^|\/)node_modules(\/|$)/, /(^|\/)\.git(\/|$)/, /credentials/i, /secret/i,
    /(^|\/)creds\.json$/i, /(^|\/)(session|sessions|auth_info[^/]*|\.wwebjs_auth|baileys[^/]*)(\/|$)/i, /(^|\/)cookies?[^/]*\.(txt|json)$/i,
    /(^|\/)[^/]*token[^/]*\.(json|txt)$/i, /(^|\/)\.(npmrc|netrc|git-credentials|pgpass)$/i];
const MAX_FILE = 45 * 1024 * 1024;   // Telegram bots can send up to 50 MB

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const run = (cmd, args, timeout = 20000, cwd) => new Promise((res) => execFile(cmd, args, { timeout, cwd, maxBuffer: 16 * 1024 * 1024 },
    (err, out, se) => res({ ok: !err, out: String(out || ''), err: String(se || '') || (err ? err.message : '') })));

function since(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 60) return `${m} min`;
    const h = Math.round(m / 60);
    return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}
const mb = (b) => `${Math.round((b || 0) / 1048576)} MB`;
const gb = (b) => (b / 1073741824).toFixed(1);
const clean = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');

async function apps() {
    const r = await run('pm2', ['jlist']);
    try { return JSON.parse(r.out.slice(r.out.indexOf('['))); } catch { return []; }
}
function pick(list, word) {
    const w = String(word || '').toLowerCase();
    const name = ALIAS[w] || w;
    return list.find((p) => p.name.toLowerCase() === name.toLowerCase() || String(p.pm_id) === w) || null;
}
const label = (p) => LABEL[p.name] || p.name;

// ─── the card ───
async function lastCommit(dir) {
    if (!dir || !fs.existsSync(path.join(dir, '.git'))) return null;
    const r = await run('git', ['-C', dir, 'log', '-1', '--format=%h|%ct|%s']);
    const [h, t, ...s] = r.out.trim().split('|');
    return h ? { hash: h, ago: since(Date.now() - Number(t) * 1000), subject: s.join('|') } : null;
}
function openCases() { try { return JSON.parse(fs.readFileSync(path.join(BACKUPS, 'open-cases.json'), 'utf8')); } catch { return {}; } }
function dashboardAnswers() {
    return new Promise((res) => {
        const req = http.get({ host: '127.0.0.1', port: 3000, path: '/', timeout: 4000 }, (r) => { r.resume(); res(r.statusCode < 500); });
        req.on('error', () => res(false)); req.on('timeout', () => { req.destroy(); res(false); });
    });
}

async function card() {
    const [list, disk, bot, dash, site] = await Promise.all([apps(), run('df', ['-P', '/']), lastCommit(BOT_DIR), lastCommit(DIRS['architect-dashboard']), dashboardAnswers()]);
    const used = os.totalmem() - os.freemem();
    const diskPct = (disk.out.trim().split('\n')[1] || '').split(/\s+/)[4] || '?';
    const cpu = Math.round((os.loadavg()[0] / os.cpus().length) * 100);
    const online = list.filter((p) => p.pm2_env?.status === 'online');
    const crashed = list.filter((p) => ['errored', 'launching'].includes(p.pm2_env?.status) || (p.pm2_env?.status === 'online' && p.pm2_env?.unstable_restarts > 0));
    const cases = openCases();
    const problems = crashed.length + Object.keys(cases).length + (site ? 0 : 1);

    const lines = [];
    lines.push(`🖥 <b>${esc(os.hostname())}</b>`);
    lines.push(problems ? `⚠️ <b>${problems} thing${problems > 1 ? 's' : ''} to look at</b>` : `✅ <b>All good</b> · ${online.length} of ${list.length} apps running`);
    lines.push(`<i>CPU ${cpu} % · RAM ${gb(used)} of ${gb(os.totalmem())} GB · disk ${esc(diskPct)} · up ${since(os.uptime() * 1000)}</i>`);
    lines.push('');
    for (const p of list) {
        const st = p.pm2_env?.status;
        const dot = st === 'online' ? '🟢' : st === 'stopped' ? '⚫' : '🔴';
        const up = st === 'online' ? `${since(Date.now() - (p.pm2_env?.pm_uptime || Date.now()))} · ${mb(p.monit?.memory)}` : esc(st);
        const rs = p.pm2_env?.restart_time ? ` · ↺ ${p.pm2_env.restart_time}` : '';
        lines.push(`${dot} <b>${esc(label(p))}</b>  ${up}${rs}`);
    }
    lines.push('');
    if (bot) lines.push(`🚀 Bot: <code>${esc(bot.hash)}</code> ${bot.ago} ago`);
    if (dash) lines.push(`🚀 Dashboard: <code>${esc(dash.hash)}</code> ${dash.ago} ago${site ? '' : ' · <b>site not answering</b>'}`);
    for (const [kind, c] of Object.entries(cases)) lines.push(`📌 Open case (${esc(kind)}): ${esc(c.last || c.title)}, ${since(Date.now() - c.since)}, ${c.attempts} attempt(s)`);
    lines.push(`<i>Updated ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Bamako' })}</i>`);

    const markup = { inline_keyboard: [
        [{ text: '🔄 Refresh', callback_data: 'sys:home' }, { text: '📋 Logs', callback_data: 'sys:pick:log' }],
        [{ text: '⚠️ Errors', callback_data: 'sys:err' }, { text: '♻️ Restart', callback_data: 'sys:pick:rs' }],
    ] };
    return { text: lines.join('\n'), markup };
}

// ─── logs ───
async function tail(p, n = 30, errorsOnly = false) {
    const r = await run('pm2', ['logs', p.name, '--lines', String(errorsOnly ? 300 : n), '--nostream', ...(errorsOnly ? ['--err'] : [])], 30000);
    let rows = clean(r.out + '\n' + r.err).split('\n')
        .map((l) => l.replace(/^\s*\d+\|[\w.-]+\s*\|\s*/, '').trimEnd())
        .filter((l) => l.trim() && !/^\[TAILING\]|last \d+ lines|\.pm2\/logs\//i.test(l));
    if (errorsOnly) rows = rows.filter((l) => /error|fail|exception|unhandled|crash|ERR_|at\s+\S+\s+\(/i.test(l));
    // The same line repeated (one per restart, one per retry) shows once with a count
    const merged = [];
    for (const l of rows) {
        const last = merged[merged.length - 1];
        if (last && last.text === l) last.n++; else merged.push({ text: l, n: 1 });
    }
    rows = merged.map((m) => m.n > 1 ? `${m.text}  ×${m.n}` : m.text).slice(-n);
    let body = rows.join('\n');
    if (body.length > 3400) body = '…' + body.slice(-3400);
    return body || (errorsOnly ? 'No errors in the recent log.' : 'The log is empty.');
}

// ─── /file ───
const isSecret = (p) => SECRET.some((re) => re.test(p));

// Folders these tools may read: the fixed ones, plus the folder of every app in PM2's list.
// Never the home folder itself or a top-level folder: an app started from there would open everything.
function roots(list) {
    const out = new Set(FILE_ROOTS);
    for (const p of list || []) {
        let real; try { real = fs.realpathSync(p.pm2_env?.pm_cwd || ''); } catch { continue; }
        if (real === HOME || real.split(path.sep).filter(Boolean).length < 2) continue;
        out.add(real);
    }
    return [...out];
}
const inRoots = (real, rootList) => rootList.some((r) => real === r || real.startsWith(r + path.sep));

// "plugins/x.js" (inside the bot), "~/deploy-backups", an absolute path, or "dash:src/App.tsx" (inside that app's folder)
function resolveFile(input, list = [], rootList = roots(list)) {
    let raw = String(input || '').trim().replace(/^~(?=\/|$)/, HOME);
    if (!raw) return { error: 'Give a path, for example <code>plugins/giveaway.js</code>, <code>dash:package.json</code> or <code>~/deploy-backups</code>.' };
    let base = BOT_DIR;
    const m = /^([A-Za-z0-9_.-]{1,40}):(.*)$/.exec(raw);
    if (m && !path.isAbsolute(raw)) {
        const app = pick(list, m[1]);
        if (!app?.pm2_env?.pm_cwd) return { error: `I don't know the app <code>${esc(m[1])}</code>.`, missing: true };
        base = app.pm2_env.pm_cwd; raw = m[2] || '.';
    }
    const full = path.resolve(path.isAbsolute(raw) ? raw : path.join(base, raw));
    let real;
    try { real = fs.realpathSync(full); } catch { return { error: `Nothing at <code>${esc(full)}</code>.`, missing: true }; }
    if (!inRoots(real, rootList)) return { error: 'I only read inside the apps in PM2\'s list, <code>~/deploy-backups</code> and the PM2 logs.' };
    if (isSecret(real)) return { error: 'That file holds secrets or private data, so it stays on the server.' };
    return { real };
}

async function sendFile(ctx, input) {
    const r = resolveFile(input, await apps());
    if (r.error) return ctx.replyHTML(r.error);
    const st = fs.statSync(r.real);
    if (st.isDirectory()) {
        const items = fs.readdirSync(r.real, { withFileTypes: true })
            .filter((d) => !isSecret(path.join(r.real, d.name) + (d.isDirectory() ? '/' : '')))
            .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));
        const shown = items.slice(0, 60).map((d) => d.isDirectory() ? `📁 ${esc(d.name)}/` : `📄 ${esc(d.name)}`).join('\n');
        return ctx.replyHTML(`📁 <b>${esc(r.real)}</b>\n${items.length} item(s)\n\n${shown || '<i>Empty</i>'}${items.length > 60 ? '\n…' : ''}\n\n<i>Send one with /file ${esc(path.relative(BOT_DIR, r.real) || '.')}/name</i>`);
    }
    if (st.size > MAX_FILE) return ctx.replyHTML(`That file is ${mb(st.size)}, more than Telegram accepts from a bot (50 MB).`);
    await ctx.action('upload_document');
    const sent = await ctx.bridge.sendDocumentBuffer(ctx.chatId, fs.readFileSync(r.real), path.basename(r.real), {
        caption: `📄 <code>${esc(r.real)}</code>\n${st.size < 1024 ? st.size + ' bytes' : st.size < 1048576 ? Math.round(st.size / 1024) + ' KB' : mb(st.size)} · changed ${since(Date.now() - st.mtimeMs)} ago`,
        parse_mode: 'HTML', reply_to: ctx.message?.message_id,
    });
    if (!sent.success) return ctx.replyHTML(`Telegram refused the file${sent.error ? `: ${esc(sent.error)}` : ''}.`);
}

// ─── /sed: lines of a file, numbered. The bot reads the file itself, so nothing can be changed. ───
async function showLines(ctx, args) {
    let from = null, to = null; const rest = [];
    for (const a of args) {
        const m = /^(\d+)(?:[,:-](\d+))?p?$/.exec(a);
        if (m && from === null) { from = Number(m[1]); to = m[2] ? Number(m[2]) : null; }
        else if (a !== '-n') rest.push(a.replace(/^['"]|['"]$/g, ''));
    }
    const r = resolveFile(rest.join(' '), await apps());
    if (r.error) return ctx.replyHTML(`${r.error}\n\nExample: <code>/sed plugins/credit.js 120,160</code>`);
    const st = fs.statSync(r.real);
    if (st.isDirectory()) return ctx.replyHTML('That is a folder. <code>/file</code> lists it; <code>/sed</code> shows lines of a file.');
    if (st.size > 8 * 1024 * 1024) return ctx.replyHTML(`That file is ${mb(st.size)}. Use <code>/grep</code> to find the part you need, or <code>/tail</code> for a log.`);
    const buf = fs.readFileSync(r.real);
    if (buf.subarray(0, 4096).includes(0)) return ctx.replyHTML('That file isn\'t text.');
    const lines = buf.toString('utf8').split('\n');
    from = Math.max(1, from || 1);
    to = Math.min(lines.length, to && to >= from ? to : from + 39);
    const MAX_LINES = 120;
    const cut = to - from + 1 > MAX_LINES;
    if (cut) to = from + MAX_LINES - 1;
    const width = String(to).length;
    let body = '', last = from - 1;
    for (let n = from; n <= to; n++) {
        const row = `${String(n).padStart(width)}│ ${(lines[n - 1] ?? '').replace(/\t/g, '  ').slice(0, 170)}\n`;
        if (body.length + row.length > 3300) break;
        body += row; last = n;
    }
    if (!body) return ctx.replyHTML(`<code>${esc(path.basename(r.real))}</code> has ${lines.length} lines.`);
    const more = last < lines.length ? `\n<i>Next: /sed ${esc(rest.join(' '))} ${last + 1},${Math.min(lines.length, last + 40)}</i>` : '';
    return ctx.replyHTML(`📄 <b>${esc(path.relative(BOT_DIR, r.real).startsWith('..') ? r.real : path.relative(BOT_DIR, r.real))}</b> · lines ${from} to ${last} of ${lines.length}\n<pre>${esc(body)}</pre>${more}`);
}

// ─── /grep: search the code or the logs ───
const tokens = (text) => {
    const out = []; const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g; let m;
    const t = String(text || '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    while ((m = re.exec(t))) out.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2] !== undefined ? m[2] : m[3]);
    return out;
};
const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'session', 'sessions', '.ssh'];
const SKIP_FILES = ['.env*', '*.env', '*.env.*', '*.pem', '*.key', '*.p12', '*.pfx', '*.session', 'creds.json', 'cookies*.txt', '*.sqlite*', '*.db', '*.db-*', 'package-lock.json', '*.map', '*.min.js'];

// Where to search. { dir, target, label, logs } or { error }
function scope(word, list, rootList) {
    if (!word) return { dir: BOT_DIR, target: '.', label: 'ARCHON bot' };
    const lw = word.toLowerCase();
    if (lw === 'logs' || lw.startsWith('logs:')) {
        const only = lw.includes(':') ? pick(list, lw.split(':')[1]) : null;
        if (lw.includes(':') && !only) return { error: `I don't know the app <code>${esc(word.split(':')[1])}</code>.` };
        const files = (only ? [only] : list).flatMap((p) => [p.pm2_env?.pm_out_log_path, p.pm2_env?.pm_err_log_path]).filter((f) => f && fs.existsSync(f));
        if (!files.length) return { error: 'No PM2 log file found.' };
        return { dir: path.dirname(files[0]), target: files, label: only ? `logs of ${label(only)}` : 'all PM2 logs', logs: true };
    }
    const app = pick(list, word);
    if (app) {
        let real; try { real = fs.realpathSync(app.pm2_env?.pm_cwd || ''); } catch { real = null; }
        if (!real || !inRoots(real, rootList)) return { error: `<b>${esc(label(app))}</b> runs from a folder too wide to search. Give a folder inside it instead.` };
        return { dir: real, target: '.', label: label(app) };
    }
    const r = resolveFile(word, list, rootList);
    if (r.error) return { error: r.error, notFound: !!r.missing };
    const isDir = fs.statSync(r.real).isDirectory();
    const shown = path.relative(BOT_DIR, r.real).startsWith('..') ? r.real : (path.relative(BOT_DIR, r.real) || 'ARCHON bot');
    return isDir ? { dir: r.real, target: '.', label: shown } : { dir: path.dirname(r.real), target: path.basename(r.real), label: shown };
}

async function search(ctx) {
    const all = tokens(String(ctx.text || '').replace(/^\/\S+\s*/, ''));
    let ignoreCase = false, regex = false;
    while (all.length && /^-[iE]{1,2}$/.test(all[0])) { const f = all.shift(); if (f.includes('i')) ignoreCase = true; if (f.includes('E')) regex = true; }
    const usage = [
        '🔎 <b>Search the server</b>', '',
        '<code>/grep addCredits</code> in the bot\'s code',
        '<code>/grep "await interaction.reply" plugins</code> in a folder',
        '<code>/grep useQuery dash</code> in another app',
        '<code>/grep TypeError logs</code> in the PM2 logs (<code>logs:dash</code> for one app)',
        '<code>/grep -i -E "error|fail" logs:bot</code> any case, as a pattern', '',
        '<i>Then read around a match with /sed file 120,150</i>',
    ].join('\n');
    if (!all.length) return ctx.replyHTML(usage);

    const list = await apps();
    const rootList = roots(list);
    // The last word is the place when it names one (an app, "logs", a folder or a file); otherwise everything is the text
    let where = scope(null, list, rootList), words = all;
    if (all.length > 1) {
        const tryPlace = scope(all[all.length - 1], list, rootList);
        if (!tryPlace.error) { where = tryPlace; words = all.slice(0, -1); }
        else if (!tryPlace.notFound) return ctx.replyHTML(tryPlace.error);
    }
    const pattern = words.join(' ');
    if (pattern.length < 2) return ctx.replyHTML('Give at least 2 characters to search for.');

    const targets = Array.isArray(where.target) ? where.target : [where.target];
    const smart = !ignoreCase && pattern === pattern.toLowerCase();
    const rg = ['--no-heading', '--line-number', '--with-filename', '--color', 'never', '--no-messages', '--max-columns', '240', '--max-columns-preview',
        ...(where.logs ? [] : ['--max-count', '40', '--max-filesize', '3M']), ...(regex ? [] : ['--fixed-strings']), ignoreCase ? '--ignore-case' : '--smart-case',
        ...SKIP_DIRS.flatMap((d) => ['--glob', `!${d}/`]), ...SKIP_FILES.flatMap((f) => ['--glob', `!${f}`]), '-e', pattern, '--', ...targets];
    let r = await run('rg', rg, 15000, where.dir);
    if (!r.out && /ENOENT/.test(r.err)) {   // ripgrep isn't installed: plain grep does the same job, a little slower
        const gr = ['-rnIH', '--color=never', regex ? '-E' : '-F', ...(ignoreCase || smart ? ['-i'] : []), ...(where.logs ? [] : ['-m', '40']),
            ...SKIP_DIRS.map((d) => `--exclude-dir=${d}`), ...SKIP_FILES.map((f) => `--exclude=${f}`), '-e', pattern, '--', ...targets];
        r = await run('grep', gr, 15000, where.dir);
    }
    const hits = [];
    for (const line of clean(r.out).split('\n')) {
        const m = /^(.+?):(\d+):(.*)$/.exec(line);
        if (!m) continue;
        const file = m[1].replace(/^\.\//, '');
        if (isSecret(path.resolve(where.dir, file))) continue;   // never a line from a secrets file, whatever the tool matched
        hits.push({ file: where.logs ? path.basename(file) : file, n: m[2], text: m[3].trim().slice(0, 170) });
    }
    const head = `🔎 <b>${esc(pattern.slice(0, 60))}</b> in ${esc(where.label)}`;
    if (!hits.length) return ctx.replyHTML(`${head}\nNothing found.${/timed? ?out|ETIMEDOUT|killed/i.test(r.err) ? ' The search took too long: try a smaller folder.' : ''}`);

    const files = new Set(hits.map((h) => h.file));
    // Logs: the newest lines matter, a few from each file. Code: the first matches, file by file.
    let pickHits = hits;
    if (where.logs) {
        const per = Math.max(5, Math.floor(40 / files.size));
        pickHits = [...files].flatMap((f) => hits.filter((h) => h.file === f).slice(-per));
    }
    let body = '', shown = 0, lastFile = null;
    for (const h of pickHits) {
        const row = (h.file !== lastFile ? `\n<b>${esc(h.file)}</b>\n` : '') + `<code>${h.n}</code> ${esc(h.text)}\n`;
        if (body.length + row.length > 3300 || shown >= 40) break;
        body += row; shown++; lastFile = h.file;
    }
    const first = hits[0];
    const hint = where.logs ? '' : `\n<i>Read around a match: /sed ${esc(where.target === '.' ? path.join(path.relative(BOT_DIR, where.dir).startsWith('..') ? where.dir : path.relative(BOT_DIR, where.dir), first.file) : where.label)} ${Math.max(1, first.n - 5)},${Number(first.n) + 15}</i>`;
    return ctx.replyHTML(`${head} · ${hits.length}${!where.logs && hits.length >= 40 ? '+' : ''} line${hits.length > 1 ? 's' : ''} in ${files.size} file${files.size > 1 ? 's' : ''}${shown < hits.length ? `, ${where.logs ? 'newest' : 'first'} ${shown} shown` : ''}\n${body}${hint}`);
}

// ─── actions on an app ───
async function act(verb, p) {
    if (verb === 'stop' && p.name === SELF) return { ok: false, text: `I can't stop the bot from inside the bot. Use <code>pm2 stop ${SELF}</code> on the server.` };
    if (p.name === SELF && verb === 'restart') {
        // The Telegram bot runs inside this process: answer first, restart a moment later
        setTimeout(() => execFile('pm2', ['restart', SELF, '--update-env'], { cwd: BOT_DIR }, () => {}), 1500);
        return { ok: true, text: `♻️ <b>ARCHON bot</b> is restarting. It's back in about 15 seconds; send /sysctl to check.` };
    }
    const args = verb === 'restart' && p.name !== 'architect-dashboard' ? ['restart', p.name, '--update-env'] : [verb, p.name];
    const r = await run('pm2', args, 60000);
    await new Promise((res) => setTimeout(res, 2500));
    const now = pick(await apps(), p.name);
    const st = now?.pm2_env?.status || 'unknown';
    const good = verb === 'stop' ? st === 'stopped' : st === 'online';
    return { ok: good, text: `${good ? '✅' : '❌'} <b>${esc(label(p))}</b> is ${esc(st)}.${r.ok ? '' : `\n<code>${esc(clean(r.err).slice(-400))}</code>`}${good || verb === 'stop' ? '' : '\nOpen its logs to see why.'}` };
}

// ─── buttons (sys:...) ───
const back = [{ text: '← Back', callback_data: 'sys:home' }];
const PRIVATE_ONLY = '🔒 I only send files, logs and code in a private chat. Message me directly.';
async function onButton(ctx, data, msgId) {
    if (!ctx.isOwner()) return;
    const edit = (text, markup) => ctx.bridge.editMessage(ctx.chatId, msgId, text, { parse_mode: 'HTML', extra: { reply_markup: markup } }).catch(() => {});
    const [, what, a, b] = data.split(':');
    const list = await apps();

    if (what === 'home') { const c = await card(); return edit(c.text, c.markup); }
    if (['log', 'elog', 'err'].includes(what) && !ctx.isPrivate) return edit(PRIVATE_ONLY, { inline_keyboard: [back] });
    if (what === 'pick') {
        const rows = [];
        const btns = list.map((p) => ({ text: `${p.pm2_env?.status === 'online' ? '🟢' : '⚫'} ${label(p)}`, callback_data: `sys:${a}:${p.pm_id}` }));
        for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
        rows.push(back);
        return edit(a === 'log' ? '📋 <b>Which app\'s logs?</b>' : '♻️ <b>Restart which app?</b>', { inline_keyboard: rows });
    }
    const p = list.find((x) => String(x.pm_id) === a);
    if (what === 'err') {
        const bot = pick(list, 'bot');
        const body = bot ? await tail(bot, 25, true) : 'The bot is not in PM2.';
        return edit(`⚠️ <b>Recent errors · ARCHON bot</b>\n<pre>${esc(body)}</pre>`, { inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'sys:err' }], back] });
    }
    if (!p) { const c = await card(); return edit(c.text, c.markup); }
    if (what === 'log') {
        return edit(`📋 <b>${esc(label(p))}</b> · last 30 lines\n<pre>${esc(await tail(p, 30))}</pre>`, { inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: `sys:log:${p.pm_id}` }, { text: '⚠️ Errors only', callback_data: `sys:elog:${p.pm_id}` }], back] });
    }
    if (what === 'elog') {
        return edit(`⚠️ <b>${esc(label(p))}</b> · recent errors\n<pre>${esc(await tail(p, 25, true))}</pre>`, { inline_keyboard: [[{ text: '📋 Full log', callback_data: `sys:log:${p.pm_id}` }], back] });
    }
    if (what === 'rs') {
        if (b !== 'yes') {
            return edit(`♻️ Restart <b>${esc(label(p))}</b>?${p.name === SELF ? '\nThis bot goes quiet for about 15 seconds.' : ''}`, { inline_keyboard: [[
                { text: '✅ Restart', callback_data: `sys:rs:${p.pm_id}:yes` }, { text: 'Cancel', callback_data: 'sys:home' }]] });
        }
        await edit(`♻️ Restarting <b>${esc(label(p))}</b>…`, { inline_keyboard: [] });
        const r = await act('restart', p);
        return edit(r.text, { inline_keyboard: [back] });
    }
}

// ─── typed commands ───
async function handler(ctx) {
    if (!ctx.isOwner()) return ctx.replyHTML('⛔ Owner only.');
    const called = String(ctx.calledAs || 'sysctl').toLowerCase();
    const args = ctx.args || [];
    await ctx.action('typing');

    // Files, logs and code leave the server only towards the owner's private chat
    if (['file', 'tail', 'logs', 'grep', 'rg', 'sed'].includes(called) && !ctx.isPrivate) return ctx.replyHTML(PRIVATE_ONLY);
    if (called === 'file') return sendFile(ctx, args.join(' '));
    if (called === 'grep' || called === 'rg') return search(ctx);
    if (called === 'sed') return showLines(ctx, args);

    const list = await apps();
    if (called === 'tail' || called === 'logs') {
        const word = isNaN(Number(args[0])) ? args[0] : 'bot';
        const n = Math.min(200, Math.max(5, parseInt(args.find((x) => /^\d+$/.test(x)), 10) || 30));
        if (word === 'errors' || word === 'err') { const bot = pick(list, 'bot'); return ctx.replyHTML(`⚠️ <b>Recent errors · ARCHON bot</b>\n<pre>${esc(await tail(bot, n, true))}</pre>`); }
        const p = pick(list, word || 'bot');
        if (!p) return ctx.replyHTML(`I don't know <code>${esc(word)}</code>. Apps: ${list.map((x) => `<code>${esc(x.name)}</code>`).join(', ')}`);
        return ctx.replyHTML(`📋 <b>${esc(label(p))}</b> · last ${n} lines\n<pre>${esc(await tail(p, n))}</pre>`);
    }

    const sub = (args[0] || '').toLowerCase();
    if (['restart', 'rs', 'stop', 'start'].includes(sub)) {
        const p = pick(list, args[1]);
        if (!p) return ctx.replyHTML(`Which app? For example <code>/sysctl ${sub} dash</code>. Apps: ${list.map((x) => `<code>${esc(x.name)}</code>`).join(', ')}`);
        const r = await act(sub === 'rs' ? 'restart' : sub, p);
        return ctx.replyHTML(r.text);
    }
    if ((sub === 'errors' || sub === 'err') && !ctx.isPrivate) return ctx.replyHTML(PRIVATE_ONLY);
    if (sub === 'errors' || sub === 'err') { const bot = pick(list, 'bot'); return ctx.replyHTML(`⚠️ <b>Recent errors · ARCHON bot</b>\n<pre>${esc(await tail(bot, 25, true))}</pre>`); }
    if (sub === 'logs' || sub === 'log') { ctx.calledAs = 'tail'; ctx.args = args.slice(1); return handler(ctx); }
    if (sub === 'flush') { const r = await run('pm2', ['flush']); return ctx.replyHTML(r.ok ? '🗑 PM2 logs emptied.' : `❌ <code>${esc(clean(r.err).slice(-300))}</code>`); }
    if (sub === 'help') {
        return ctx.replyHTML([
            '🖥 <b>Server tools</b> (owner only)', '',
            '<code>/sysctl</code> the server card, with buttons',
            '<code>/tail dash 50</code> the last 50 lines of an app',
            '<code>/tail errors</code> recent errors of the bot',
            '<code>/file plugins/giveaway.js</code> sends a file',
            '<code>/file ~/deploy-backups</code> lists a folder',
            '<code>/grep addCredits plugins</code> searches code or logs',
            '<code>/sed plugins/credit.js 120,160</code> shows those lines',
            '<code>/sysctl restart dash</code> · <code>stop</code> · <code>start</code>',
            '<code>/sysctl flush</code> empties the PM2 logs', '',
            '<i>Apps: bot, dash, hook, or any PM2 name.</i>',
        ].join('\n'));
    }
    const c = await card();
    return ctx.replyHTML(c.text, { extra: { reply_markup: c.markup } });
}

module.exports = {
    name: 'sysctl',
    aliases: ['check', 'tail', 'file', 'server', 'grep', 'rg', 'sed'],
    description: 'Server card, logs, files and restarts (owner only)',
    category: 'System',
    usage: '/sysctl · /tail <app> [lines] · /file <path> · /grep <text> [where] · /sed <file> <from>,<to>',
    ownerOnly: true,
    handler,
    onButton,
    // exposed for the tests
    _resolveFile: resolveFile,
};
