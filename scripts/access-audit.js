#!/usr/bin/env node
// Lists the member checks in plugins that still ask for full Administrator by hand, instead of lib/access.
// A line that is about the TARGET (an admin can't be muted, AutoMod skips admins) is fine: mark it with
// "access-ok" in a comment and it is skipped.   node scripts/access-audit.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'plugins');
const RE = /(member|permissions)[^;\n]*\.has\(\s*(PermissionFlagsBits\.Administrator|PermissionsBitField\.Flags\.Administrator|['"]Administrator['"])/;
let found = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
    fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((line, i) => {
        if (RE.test(line) && !/access-ok/.test(line)) { found++; console.log(`plugins/${f}:${i + 1}  ${line.trim().slice(0, 140)}`); }
    });
}
console.log(found ? `\n${found} hand-written Administrator check(s). Use lib/access (can / deny) unless the line is about the target.` : 'No hand-written Administrator check left.');
process.exitCode = found ? 1 : 0;
