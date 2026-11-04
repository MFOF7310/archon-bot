// ═══════════════════════════════════════════
//  ARCHON Auto-Deploy Webhook
//  A push to main on GitHub deploys it here:
//    • bot repo       → pull, syntax check, restart Architect-CG223
//    • dashboard repo → pull, build, restart architect-dashboard
//  Nothing broken is ever left on disk: a failed check or build puts
//  the previous commit back, and Telegram says what happened.
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
    const msg = [top, ...lines.filter(Boolean)].join('\n\n');
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

// ─── bot: pull, check every changed file, restart ───
async function deployBot(target, info) {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
    const git = (...a) => run('git', a, { cwd: target.dir, env });
    const before = await head(target, env);
    const pull = await git('pull', '--autostash', 'origin', BRANCH);
    if (!pull.ok) return report(target, info, false, 'git pull failed, nothing was restarted', [`<code>${esc(tail(pull.err))}</code>`]);
    const after = await head(target, env);

    const changed = new Set(info.files);
    if (before && after && before !== after) (await git('diff', '--name-only', before, after)).out.split('\n').forEach((f) => f && changed.add(f));

    if (before && after && before !== after && (await deps(target, before)) !== (await deps(target, after))) {
        return report(target, info, false, 'new packages, not restarted', [
            'This push changes the packages the bot needs. The bot keeps running the previous code until you run:',
            `<code>cd ${esc(target.dir)} &amp;&amp; npm install &amp;&amp; pm2 restart ${esc(target.pm2)}</code>`,
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
            const back = await git('reset', '--keep', before);
            undo = back.ok ? 'The code on the server was put back to the previous commit, and the bot keeps running it.'
                : 'The code could not be put back automatically: fix it on the server before the next restart.';
        }
        return report(target, info, false, `syntax error in ${f}, not restarted`, [`<code>${esc(tail(c.err, 500))}</code>`, undo]);
    }

    const rs = await run('pm2', ['restart', target.pm2, '--update-env'], { cwd: target.dir, timeout: 60000 });
    if (!rs.ok) return report(target, info, false, 'restart failed', [`<code>${esc(tail(rs.err))}</code>`]);
    report(target, info, true, before === after ? 'restarted (nothing new to pull)' : 'deployed and restarted ✓', [
        changed.has('webhook.js') ? 'webhook.js changed too: run <code>pm2 restart archon-webhook</code> to use the new version.' : '',
    ]);
}

// ─── dashboard: pull, build, restart ───
const stamp = (dir) => ['dist/boot.js', 'dist/public/index.html'].map((f) => { try { return fs.statSync(path.join(dir, f)).mtimeMs; } catch { return 0; } }).join('/');

async function deployDashboard(target, info) {
    const git = (...a) => run('git', a, { cwd: target.dir, env: PLAIN_ENV });
    const dirty = (await git('status', '--porcelain', '--untracked-files=no')).out.trim();
    if (dirty) {
        return report(target, info, false, 'files were changed on the server, nothing was updated', [
            `<code>${esc(dirty.split('\n').slice(0, 10).join('\n'))}</code>`,
            'Commit or undo those changes on the server, then push again.',
        ]);
    }
    const before = await head(target, PLAIN_ENV);
    const fetched = await git('fetch', '--quiet', 'origin', BRANCH);
    if (!fetched.ok) return report(target, info, false, 'git fetch failed, nothing was updated', [`<code>${esc(tail(fetched.err))}</code>`]);
    const merged = await git('merge', '--ff-only', 'FETCH_HEAD');
    if (!merged.ok) {
        return report(target, info, false, 'the server has commits GitHub does not have, nothing was updated', [
            `Push them from the server first: <code>cd ${esc(target.dir)} &amp;&amp; git push origin ${BRANCH}</code>. That push deploys by itself.`,
        ]);
    }
    const after = await head(target, PLAIN_ENV);
    if (before === after) return report(target, info, true, 'already up to date, nothing to build');

    if ((await deps(target, before)) !== (await deps(target, after))) {
        return report(target, info, false, 'new packages, not built', [
            'The code is updated but the site still runs the previous build. Finish with:',
            `<code>cd ${esc(target.dir)} &amp;&amp; npm install &amp;&amp; npm run build &amp;&amp; pm2 restart ${esc(target.pm2)}</code>`,
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
        return report(target, info, false, 'build failed, not deployed', [`<code>${esc(tail(build.out + '\n' + build.err, 700))}</code>`, state]);
    }
    // No --update-env: the dashboard keeps its own environment (PORT and the rest), never this process's
    const rs = await run('pm2', ['restart', target.pm2], { cwd: target.dir, env: PLAIN_ENV, timeout: 60000 });
    if (!rs.ok) return report(target, info, false, 'built, but the restart failed', [`<code>${esc(tail(rs.err))}</code>`]);
    report(target, info, true, 'built and restarted ✓');
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
