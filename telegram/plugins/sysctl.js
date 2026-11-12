// telegram/plugins/sysctl.js — the server from Telegram, owner only.
//   /sysctl (also /pm2, /check)  one card: server health, every app, last deploys, open cases, with buttons
//   /tail <app> [lines]          the last lines of an app's log (also /logs)
//   /file <path>                 sends a file from the server (read-only; secrets are refused)
//   /sysctl restart|stop|start <app>, /sysctl errors, /sysctl flush
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
const SECRET = [/(^|\/)\.env(\.|$)/i, /\.pem$/i, /\.key$/i, /(^|\/)id_[a-z0-9]+/i, /(^|\/)\.ssh\//, /(^|\/)\.kene\//, /backup-env/i,
    /\.(db|sqlite|sqlite3)(-wal|-shm|-journal)?$/i, /(^|\/)node_modules\//, /(^|\/)\.git\//, /credentials/i, /secret/i];
const MAX_FILE = 45 * 1024 * 1024;   // Telegram bots can send up to 50 MB

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const run = (cmd, args, timeout = 20000) => new Promise((res) => execFile(cmd, args, { timeout, maxBuffer: 16 * 1024 * 1024 },
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
function resolveFile(input) {
    const raw = String(input || '').trim().replace(/^~(?=\/|$)/, HOME);
    if (!raw) return { error: 'Give a path, for example <code>/file plugins/giveaway.js</code> or <code>/file ~/deploy-backups</code>.' };
    const full = path.resolve(path.isAbsolute(raw) ? raw : path.join(BOT_DIR, raw));
    let real;
    try { real = fs.realpathSync(full); } catch { return { error: `Nothing at <code>${esc(full)}</code>.` }; }
    if (!FILE_ROOTS.some((r) => real === r || real.startsWith(r + path.sep))) {
        return { error: `I only read inside the bot, the dashboard, <code>~/deploy-backups</code> and the PM2 logs.` };
    }
    if (SECRET.some((re) => re.test(real))) return { error: 'That file holds secrets or private data, so it stays on the server.' };
    return { real };
}

async function sendFile(ctx, input) {
    const r = resolveFile(input);
    if (r.error) return ctx.replyHTML(r.error);
    const st = fs.statSync(r.real);
    if (st.isDirectory()) {
        const items = fs.readdirSync(r.real, { withFileTypes: true })
            .filter((d) => !SECRET.some((re) => re.test(path.join(r.real, d.name) + (d.isDirectory() ? '/' : ''))))
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
async function onButton(ctx, data, msgId) {
    if (!ctx.isOwner()) return;
    const edit = (text, markup) => ctx.bridge.editMessage(ctx.chatId, msgId, text, { parse_mode: 'HTML', extra: { reply_markup: markup } }).catch(() => {});
    const [, what, a, b] = data.split(':');
    const list = await apps();

    if (what === 'home') { const c = await card(); return edit(c.text, c.markup); }
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

    if (called === 'file') return sendFile(ctx, args.join(' '));

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
    aliases: ['check', 'tail', 'file', 'server'],
    description: 'Server card, logs, files and restarts (owner only)',
    category: 'System',
    usage: '/sysctl · /tail <app> [lines] · /file <path>',
    ownerOnly: true,
    handler,
    onButton,
    // exposed for the tests
    _resolveFile: resolveFile,
};
