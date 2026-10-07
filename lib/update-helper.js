'use strict';
// Restarts the bot after an update. If the bot does not stay online,
// it puts the old version back and restarts again.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const oldHash = args[0], oldVersion = args[1], newVersion = args[2], app = args[3], root = args[4];
const RESULT = path.join(os.tmpdir(), 'archon-update-result.json');
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
const pm2 = function () { return spawnSync('pm2', Array.from(arguments), { cwd: root, encoding: 'utf8' }); };

function stable() {
    const out = pm2('jlist').stdout || '';
    try {
        const list = JSON.parse(out.slice(out.indexOf('[')));
        return list.some(function (p) {
            return p.name === app && p.pm2_env.status === 'online' && Date.now() - p.pm2_env.pm_uptime > 20000;
        });
    } catch (e) { return false; }
}

(async function () {
    await wait(3000);                       // let the bot send its last message
    pm2('restart', app, '--update-env');
    await wait(30000);
    if (stable()) {
        fs.writeFileSync(RESULT, JSON.stringify({ ok: true, oldVersion: oldVersion, newVersion: newVersion }));
        return;
    }
    spawnSync('git', ['reset', '--hard', oldHash], { cwd: root });
    pm2('restart', app, '--update-env');
    fs.writeFileSync(RESULT, JSON.stringify({ ok: false, oldVersion: oldVersion, newVersion: newVersion }));
})();
