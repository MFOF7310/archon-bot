// ═══════════════════════════════════════════
//  ARCHON Auto-Deploy Webhook
//  GitHub pushes here → pulls + restarts
// ═══════════════════════════════════════════

require('dotenv').config({ path: '/root/cloud-gaming-223-digital-engine/.env' });
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');

const SECRET = process.env.WEBHOOK_SECRET || 'changeme';
const PORT = process.env.WEBHOOK_PORT || 9001;
const BRANCH = 'main';

function verify(secret, payload, signature) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const digest = 'sha256=' + hmac.digest('hex');
    try { return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature)); } catch { return false; }
}

http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/deploy') {
        res.writeHead(404); return res.end('Not found');
    }

    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
        const sig = req.headers['x-hub-signature-256'] || '';
        if (!verify(SECRET, body, sig)) {
            console.log('[WEBHOOK] Invalid signature — rejected');
            res.writeHead(401); return res.end('Unauthorized');
        }

        let payload;
        try { payload = JSON.parse(body); } catch {
            res.writeHead(400); return res.end('Bad request');
        }

        const branch = payload.ref?.replace('refs/heads/', '');
        if (branch !== BRANCH) {
            res.writeHead(200); return res.end('Ignored — not main branch');
        }

        const commit = payload.head_commit?.id?.substring(0, 7) || '?';
        const author = payload.head_commit?.author?.name || '?';
        console.log(`[WEBHOOK] Push from ${author} — commit ${commit} — deploying...`);

        res.writeHead(200); res.end('Deploying...');

        const cmd = [
            'cd /root/cloud-gaming-223-digital-engine',
            'git pull origin main',
            'pm2 restart Architect-CG223 --update-env'
        ].join(' && ');

        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.error('[WEBHOOK] Deploy failed:', err.message);
                console.error(stderr?.substring(0, 300));
            } else {
                console.log('[WEBHOOK] Deploy success — commit', commit);
                console.log(stdout?.substring(0, 200));
            }
        });
    });
}).listen(PORT, () => {
    console.log(`[WEBHOOK] Listening on port ${PORT}`);
});
