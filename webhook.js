// ═══════════════════════════════════════════
//  ARCHON Auto-Deploy Webhook
//  A push to main on GitHub deploys it here:
//    • bot repo       → pull, syntax check, restart Architect-CG223
//    • dashboard repo → pull, build, restart architect-dashboard
//  Nothing broken is ever left on disk: a failed check or build puts
//  the previous commit back, and Telegram says what happened.
//  The server always ends up exactly on GitHub's main: changes made by
//  hand on the server are saved to ~/deploy-backups, then replaced.
//  A failed deploy opens a "case"; Telegram says when it's solved.
// ═══════════════════════════════════════════

require('dotenv').config({ path: '/root/cloud-gaming-223-digital-engine/.env' });
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const SECRET = process.env.WEBHOOK_SECRET;
if (!SECRET) { console.error('[WEBHOOK] WEBHOOK_SECRET missing — refusing to start'); process.exit(1); }
const PORT = process.env.WEBHOOK_PORT || 9001;
const BRANCH = 'main';
const MAX_BODY = 5 * 1024 * 1024; // a GitHub push is far smaller; anything bigger is refused

// Which GitHub repository deploys where. A push to any other repository is ignored.
const TARGETS = [
    {
        kind: 'bot', name: 'ARCHON bot',
        repo: (process.env.DEPLOY_BOT_REPO || 'MFOF7310/archon-bot').toLowerCase(),
        dir: process.env.DEPLOY_BOT_DIR || '/root/cloud-gaming-223-digital-engine',
        pm2: process.env.DEPLOY_BOT_PM2 || 'Architect-CG223',
    },
    {
        kind: 'dashboard', name: 'Dashboard',
        repo: (process.env.DEPLOY_DASHBOARD_REPO || 'MFOF7310/archon-dashboard-new').toLowerCase(),
        dir: process.env.DEPLOY_DASHBOARD_DIR || '/opt/dashboard',
        pm2: process.env.DEPLOY_DASHBOARD_PM2 || 'architect-dashboard',
    },
];

// The dashboard is built with a plain environment, like a build typed in a shell:
// the bot's .env (loaded above for this process) must never leak into the dashboard's build or process.
const PLAIN_ENV = {
    PATH: process.env.PATH, HOME: process.env.HOME || '/root', LANG: process.env.LANG || 'C.UTF-8',
    GIT_TERMINAL_PROMPT: '0',
};

function verify(secret, payload, signature) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const digest = 'sha256=' + hmac.digest('hex');
    try { return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature)); } catch { return false; }
}

// ─── small helpers ───
function run(cmd, args, { cwd, env = process.env, timeout = 120000 } = {}) {
    return new Promise((resolve) => {
        execFile(cmd, args, { cwd, env, timeout, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
            resolve({ ok: !err, out: String(stdout || ''), err: String(stderr || '') || (err ? err.message : '') });
        });
    });
}
const tail = (s, n = 600) => { const x = String(s || '').trim(); return x.length > n ? '…' + x.slice(-n) : x; };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function tgNotify(msg) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chat = process.env.TELEGRAM_CHAT_ID || process.env.OWNER_TELEGRAM_ID;
    if (!token || !chat) return;
    const body = JSON.stringify({ chat_id: chat, text: msg, parse_mode: 'HTML', disable_web_page_preview: true });
    const req = https.request({
        hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    });
    req.on('error', (e) => console.error('[WEBHOOK] Telegram:', e.message));
    req.end(body);
}

function report(target, info, ok, title, lines = []) {
    const top = `${ok ? '🚀' : '❌'} <b>${esc(target.name)}: ${esc(title)}</b>\nCommit <code>${esc(info.commit)}</code> by ${esc(info.author)}`;
    const extra = [];
    if (ok) {
        const was = closeCase(target);
        if (was) extra.push(`✅ <b>Case closed</b>\nThe problem from commit <code>${esc(was.commit)}</code> (${esc(was.title)}) is solved, ${ago(Date.now() - was.since)} and ${was.attempts} failed deploy(s) later.`);
    } else {
        const c = openCase(target, info, title);
        extra.push(c.attempts > 1
            ? `📌 Open case, failing since ${ago(Date.now() - c.since)} (${c.attempts} deploys). You'll get a message here once it's solved.`
            : `📌 Case opened. You'll get a message here once it's solved.`);
    }
    const msg = [top, ...lines.filter(Boolean), ...extra].join('\n\n');
    (ok ? console.log : console.error)(`[WEBHOOK] ${target.name}: ${title} (${info.commit})`);
    tgNotify(msg);
}

// The packages a commit asks for. A change here needs "npm install", which is never run automatically.
async function deps(target, rev) {
    const r = await run('git', ['show', `${rev}:package.json`], { cwd: target.dir, env: PLAIN_ENV });
    if (!r.ok) return null;
    try {
        const p = JSON.parse(r.out);
        return JSON.stringify([p.dependencies || {}, p.optionalDependencies || {}, target.kind === 'dashboard' ? p.devDependencies || {} : {}]);
    } catch { return null; }
}

const head = async (target, env) => (await run('git', ['rev-parse', 'HEAD'], { cwd: target.dir, env })).out.trim();

// ─── the server is a copy of GitHub ───
// Anything changed by hand on the server (a file edited, an unfinished merge, a local commit) used to block every deploy
// with a git conflict. Now it is saved first, then the server is put back exactly on GitHub's main.
// Saved in ~/deploy-backups: a .diff with the changed files and a .patch with local commits (also kept on a backup branch).
// Files git doesn't track (.env, config/emojis.js, the database, node_modules) are never touched.
const BACKUPS = process.env.DEPLOY_BACKUP_DIR || path.join(process.env.HOME || '/root', 'deploy-backups');

async function syncToGitHub(target, git) {
    const fetched = await git('fetch', '--quiet', 'origin', BRANCH);
    if (!fetched.ok) return { ok: false, error: tail(fetched.err) };

    const conflicted = (await git('diff', '--name-only', '--diff-filter=U')).out.trim().split('\n').filter(Boolean);
    const changed = [...new Set([...(await git('diff', '--name-only', 'HEAD')).out.split('\n'), ...conflicted])].map((x) => x.trim()).filter(Boolean);
    const localCommits = (await git('log', '--oneline', 'FETCH_HEAD..HEAD')).out.trim().split('\n').filter(Boolean);
    const saved = { conflicted, changed, localCommits, files: [] };

    if (changed.length || localCommits.length) {
        const when = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
        try {
            fs.mkdirSync(BACKUPS, { recursive: true });
            if (changed.length) {
                const f = path.join(BACKUPS, `${target.kind}-${when}.diff`);
                fs.writeFileSync(f, (await git('diff', 'HEAD')).out);
                saved.files.push(f);
            }
            if (localCommits.length) {
                const f = path.join(BACKUPS, `${target.kind}-${when}.patch`);
                fs.writeFileSync(f, (await git('format-patch', '--stdout', 'FETCH_HEAD..HEAD')).out);
                saved.files.push(f);
                await git('branch', '-f', `backup/${when}`, 'HEAD');
                saved.branch = `backup/${when}`;
            }
        } catch (e) {
            return { ok: false, error: `couldn't save the server's own changes (${e.message}), so nothing was overwritten` };
        }
    }
    // Finish whatever git was in the middle of, then line up with GitHub
    await git('merge', '--abort'); await git('rebase', '--abort'); await git('cherry-pick', '--abort');
    const reset = await git('reset', '--hard', 'FETCH_HEAD');
    if (!reset.ok) return { ok: false, error: tail(reset.err), saved };
    return { ok: true, saved };
}

// What the sync had to clean up, as lines for the Telegram message
function cleanupLines(saved) {
    if (!saved || (!saved.changed.length && !saved.localCommits.length)) return [];
    const lines = ['🩹 <b>Fixed on the way</b>'];
    if (saved.conflicted.length) lines.push(`A git conflict was blocking deploys (${saved.conflicted.map(esc).join(', ')}). It's cleared.`);
    const edited = saved.changed.filter((f) => !saved.conflicted.includes(f));
    if (edited.length) lines.push(`Files changed by hand on the server were replaced by GitHub's version: ${edited.slice(0, 8).map(esc).join(', ')}${edited.length > 8 ? '…' : ''}.`);
    if (saved.localCommits.length) lines.push(`${saved.localCommits.length} commit(s) made on the server only were set aside${saved.branch ? ` on branch <code>${esc(saved.branch)}</code>` : ''}.`);
    lines.push(`Nothing is lost, the old version is saved in:\n${saved.files.map((f) => `<code>${esc(f)}</code>`).join('\n')}`);
    return [lines.join('\n')];
}

// ─── case tracking: a failed deploy stays open until a later deploy of the same repository succeeds ───
const CASES = path.join(BACKUPS, 'open-cases.json');
function readCases() { try { return JSON.parse(fs.readFileSync(CASES, 'utf8')); } catch { return {}; } }
function writeCases(c) { try { fs.mkdirSync(BACKUPS, { recursive: true }); fs.writeFileSync(CASES, JSON.stringify(c, null, 2)); } catch (e) { console.error('[WEBHOOK] cases:', e.message); } }
function openCase(target, info, title) {
    const c = readCases();
    const cur = c[target.kind];
    c[target.kind] = cur ? { ...cur, attempts: (cur.attempts || 1) + 1, last: title, lastCommit: info.commit }
        : { since: Date.now(), title, commit: info.commit, attempts: 1 };
    writeCases(c);
    return c[target.kind];
}
function closeCase(target) {
    const c = readCases(); const was = c[target.kind];
    if (!was) return null;
    delete c[target.kind]; writeCases(c);
    return was;
}
function ago(ms) {
    const m = Math.round(ms / 60000);
    return m < 60 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`;
}

// ─── bot: pull, check every changed file, restart ───
async function deployBot(target, info) {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
    const git = (...a) => run('git', a, { cwd: target.dir, env });
    const before = await head(target, env);
    const sync = await syncToGitHub(target, git);
    if (!sync.ok) return report(target, info, false, 'update failed, nothing was restarted', [`<code>${esc(sync.error)}</code>`, ...cleanupLines(sync.saved)]);
    const fixed = cleanupLines(sync.saved);
    const after = await head(target, env);

    const changed = new Set(info.files);
    if (before && after && before !== after) (await git('diff', '--name-only', before, after)).out.split('\n').forEach((f) => f && changed.add(f));

    if (before && after && before !== after && (await deps(target, before)) !== (await deps(target, after))) {
        return report(target, info, false, 'new packages, not restarted', [
            'This push changes the packages the bot needs. The bot keeps running the previous code until you run:',
            `<code>cd ${esc(target.dir)} &amp;&amp; npm install &amp;&amp; pm2 restart ${esc(target.pm2)}</code>`,
            ...fixed,
        ]);
    }

    // node --check on index.js and on every changed .js file: a syntax error never reaches a restart
    const files = ['index.js', ...[...changed].filter((f) => f.endsWith('.js'))]
        .filter((f, i, a) => a.indexOf(f) === i && !f.includes('..') && fs.existsSync(path.join(target.dir, f)))
        .slice(0, 300);
    for (const f of files) {
        const c = await run(process.execPath, ['--check', f], { cwd: target.dir, timeout: 30000 });
        if (c.ok) continue;
        let undo = 'The bot keeps running the previous code.';
        if (before && after && before !== after) {
            const back = await git('reset', '--hard', before);
            undo = back.ok ? 'The code on the server was put back to the previous commit, and the bot keeps running it.'
                : 'The code could not be put back automatically: fix it on the server before the next restart.';
        }
        return report(target, info, false, `syntax error in ${f}, not restarted`, [`<code>${esc(tail(c.err, 500))}</code>`, undo, ...fixed]);
    }

    const rs = await run('pm2', ['restart', target.pm2, '--update-env'], { cwd: target.dir, timeout: 60000 });
    if (!rs.ok) return report(target, info, false, 'restart failed', [`<code>${esc(tail(rs.err))}</code>`, ...fixed]);
    report(target, info, true, before === after ? 'restarted (nothing new to pull)' : 'deployed and restarted ✓', [
        ...fixed,
        changed.has('webhook.js') ? 'webhook.js changed too: run <code>pm2 restart archon-webhook</code> to use the new version.' : '',
    ]);
}

// ─── dashboard: pull, build, restart ───
const stamp = (dir) => ['dist/boot.js', 'dist/public/index.html'].map((f) => { try { return fs.statSync(path.join(dir, f)).mtimeMs; } catch { return 0; } }).join('/');

async function deployDashboard(target, info) {
    const git = (...a) => run('git', a, { cwd: target.dir, env: PLAIN_ENV });
    const before = await head(target, PLAIN_ENV);
    const sync = await syncToGitHub(target, git);
    if (!sync.ok) return report(target, info, false, 'update failed, nothing was updated', [`<code>${esc(sync.error)}</code>`, ...cleanupLines(sync.saved)]);
    const fixed = cleanupLines(sync.saved);
    const after = await head(target, PLAIN_ENV);
    if (before === after) return report(target, info, true, 'already up to date, nothing to build', fixed);

    if ((await deps(target, before)) !== (await deps(target, after))) {
        return report(target, info, false, 'new packages, not built', [
            'The code is updated but the site still runs the previous build. Finish with:',
            `<code>cd ${esc(target.dir)} &amp;&amp; npm install &amp;&amp; npm run build &amp;&amp; pm2 restart ${esc(target.pm2)}</code>`,
            ...fixed,
        ]);
    }

    const was = stamp(target.dir);
    const build = await run('npm', ['run', 'build'], { cwd: target.dir, env: PLAIN_ENV, timeout: 15 * 60 * 1000 });
    if (!build.ok) {
        // Put the code back. If the failed build already touched dist/, rebuild the previous version so the site's files match what runs.
        await git('reset', '--hard', before);
        let state = 'The site keeps the previous version.';
        if (stamp(target.dir) !== was) {
            const again = await run('npm', ['run', 'build'], { cwd: target.dir, env: PLAIN_ENV, timeout: 15 * 60 * 1000 });
            state = again.ok ? 'The previous version was rebuilt; the site keeps it.' : 'The previous version could not be rebuilt either: check the server now.';
        }
        return report(target, info, false, 'build failed, not deployed', [`<code>${esc(tail(build.out + '\n' + build.err, 700))}</code>`, state, ...fixed]);
    }
    // No --update-env: the dashboard keeps its own environment (PORT and the rest), never this process's
    const rs = await run('pm2', ['restart', target.pm2], { cwd: target.dir, env: PLAIN_ENV, timeout: 60000 });
    if (!rs.ok) return report(target, info, false, 'built, but the restart failed', [`<code>${esc(tail(rs.err))}</code>`, ...fixed]);
    report(target, info, true, 'built and restarted ✓', fixed);
}

// ─── one deploy at a time per repository; a push that arrives meanwhile runs right after ───
const lanes = new Map();
function queue(target, info) {
    const lane = lanes.get(target.kind) || { running: false, next: null };
    lanes.set(target.kind, lane);
    if (lane.running) { lane.next = info; console.log(`[WEBHOOK] ${target.name}: deploy running, ${info.commit} will follow`); return; }
    lane.running = true;
    (async () => {
        let job = info;
        while (job) {
            lane.next = null;
            try { await (target.kind === 'dashboard' ? deployDashboard : deployBot)(target, job); }
            catch (e) { report(target, job, false, 'deploy crashed', [`<code>${esc(e.message)}</code>`]); }
            job = lane.next;
        }
        lane.running = false;
    })();
}

const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/deploy') {
        res.writeHead(404); return res.end('Not found');
    }

    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { res.writeHead(413); res.end('Too large'); req.destroy(); return; }
        chunks.push(c);
    });
    req.on('end', () => {
        if (size > MAX_BODY) return;
        const body = Buffer.concat(chunks).toString('utf8');
        const sig = req.headers['x-hub-signature-256'] || '';
        if (!verify(SECRET, body, sig)) {
            console.log('[WEBHOOK] Invalid signature — rejected');
            res.writeHead(401); return res.end('Unauthorized');
        }

        const event = req.headers['x-github-event'] || 'push';
        if (event === 'ping') { res.writeHead(200); return res.end('pong'); }
        if (event !== 'push') { res.writeHead(200); return res.end(`Ignored — ${event} event`); }

        let payload;
        try {
            // GitHub sends JSON, or a form with a "payload" field when the webhook was saved that way
            const form = String(req.headers['content-type'] || '').includes('x-www-form-urlencoded');
            payload = JSON.parse(form ? new URLSearchParams(body).get('payload') || '' : body);
        } catch {
            res.writeHead(400); return res.end('Bad request');
        }

        const repo = String(payload.repository?.full_name || '').toLowerCase();
        const target = TARGETS.find((t) => t.repo === repo);
        if (!target) { res.writeHead(200); return res.end(`Ignored — ${repo || 'unknown repository'} is not set up for deploys`); }

        const branch = payload.ref?.replace('refs/heads/', '');
        if (branch !== BRANCH) { res.writeHead(200); return res.end('Ignored — not main branch'); }
        if (payload.deleted) { res.writeHead(200); return res.end('Ignored — branch deleted'); }

        const files = new Set();
        for (const c of Array.isArray(payload.commits) ? payload.commits : []) {
            for (const f of [...(c.added || []), ...(c.modified || [])]) if (typeof f === 'string') files.add(f);
        }
        const info = {
            commit: payload.head_commit?.id?.substring(0, 7) || '?',
            author: payload.head_commit?.author?.name || '?',
            files: [...files],
        };
        console.log(`[WEBHOOK] ${target.name}: push from ${info.author} — commit ${info.commit} — deploying...`);
        res.writeHead(200); res.end(`Deploying ${target.name}...`);
        queue(target, info);
    });
});

if (require.main === module) {
    server.listen(PORT, () => console.log(`[WEBHOOK] Listening on port ${PORT}`));
}
module.exports = { server, TARGETS };
