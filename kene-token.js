const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = '/root/cloud-gaming-223-digital-engine';
const LOG = `${BASE}/kene-push.log`;

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(LOG, line);
}

// Load credentials
const env = fs.readFileSync(`${BASE}/.env`, 'utf8');
const appId = env.match(/GITHUB_APP_ID=(.+)/)?.[1]?.trim();

// Auto-regenerate PKCS8 from RSA if missing
const pkcs8Path = `${BASE}/kene-key-pkcs8.pem`;
const rsaPath = `${BASE}/kene-key.pem`;

if (!fs.existsSync(pkcs8Path)) {
    log('PKCS8 key missing — regenerating from RSA key');
    const { execSync } = require('child_process');
    try {
        execSync(`openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in ${rsaPath} -out ${pkcs8Path}`);
        fs.chmodSync(pkcs8Path, 0o600);
        log('PKCS8 key regenerated OK');
    } catch(e) {
        log(`PKCS8 regeneration failed: ${e.message}`);
        process.exit(1);
    }
}

const pem = fs.readFileSync(pkcs8Path, 'utf8');

if (!appId || !pem) {
    log('Missing credentials');
    console.error('Missing credentials');
    process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const header = Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
const body = Buffer.from(JSON.stringify({iat:now-60,exp:now+600,iss:appId})).toString('base64url');
const signing = header + '.' + body;
const sign = crypto.createSign('RSA-SHA256');
sign.update(signing);
const jwt = signing + '.' + sign.sign(pem, 'base64url');

const REPO = 'MFOF7310/archon-bot';

function apiReq(path, method='GET', token) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.github.com',
            path,
            method,
            headers: {
                Authorization: 'Bearer ' + token,
                'User-Agent': 'Kene-OpenClaw',
                'Content-Length': 0
            }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve(JSON.parse(d)); }
                catch(e) { reject(new Error('Invalid JSON: ' + d)); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

apiReq(`/repos/${REPO}/installation`, 'GET', jwt)
    .then(inst => {
        if (!inst.id) throw new Error('No installation ID: ' + JSON.stringify(inst));
        return apiReq(`/app/installations/${inst.id}/access_tokens`, 'POST', jwt);
    })
    .then(tok => {
        if (!tok.token) throw new Error('No token in response: ' + JSON.stringify(tok));
        log('Token generated OK');
        console.log(tok.token);
    })
    .catch(e => {
        log(`Token generation failed: ${e.message}`);
        console.error(e.message);
        process.exit(1);
    });
