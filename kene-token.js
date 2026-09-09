const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

// Parse .env manually
const env = fs.readFileSync('/root/cloud-gaming-223-digital-engine/.env', 'utf8');
const appId = env.match(/GITHUB_APP_ID=(.+)/)?.[1]?.trim();
const pemMatch = env.match(/GITHUB_APP_PRIVATE_KEY="([\s\S]+?)"/);
const pem = fs.readFileSync('/root/cloud-gaming-223-digital-engine/kene-key-pkcs8.pem', 'utf8');

if (!appId || !pem) { console.error('Missing credentials'); process.exit(1); }

const now = Math.floor(Date.now() / 1000);
const header = Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
const body = Buffer.from(JSON.stringify({iat:now-60,exp:now+600,iss:appId})).toString('base64url');
const signing = header + '.' + body;
const sign = crypto.createSign('RSA-SHA256');
sign.update(signing);
const jwt = signing + '.' + sign.sign(pem, 'base64url');

const REPO = 'MFOF7310/archon-bot';

function apiReq(path, method='GET', jwt) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.github.com',
            path,
            method,
            headers: { Authorization: 'Bearer ' + jwt, 'User-Agent': 'Kene-OpenClaw', 'Content-Length': 0 }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
        });
        req.on('error', reject);
        req.end();
    });
}

apiReq(`/repos/${REPO}/installation`, 'GET', jwt)
    .then(inst => apiReq(`/app/installations/${inst.id}/access_tokens`, 'POST', jwt))
    .then(tok => console.log(tok.token))
    .catch(e => { console.error(e); process.exit(1); });
