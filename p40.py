#!/usr/bin/env python3
# ============================================================
# PATCH 40 - plugins/use.js: lang source standardization
# Slash execute() was user-locale-only; now guild setting first
# (house idiom from index.js), client locale as fallback.
# ============================================================
import hashlib, json, os, subprocess, sys

ROOT = os.getcwd()
P = os.path.join(ROOT, 'plugins/use.js')
IN_SHA = '9af27203d5248ad5931f9566ee85a5c6362883b98d3938449d3161be15f0af46'
IN_SIZE = 41919

REPS = json.loads(r'''[["        const lang = { fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en';", "        const _ssU = interaction.guild ? client.getServerSettings?.(interaction.guild.id) : null;\n        const lang = _ssU?.language && _ssU.language !== 'auto' ? _ssU.language : ({ fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en');", 1]]''')

def sha(b): return hashlib.sha256(b).hexdigest()

def main():
    raw = open(P, 'rb').read()
    if len(raw) != IN_SIZE or sha(raw) != IN_SHA:
        print('INPUT GATE FAIL - file changed or wrong path')
        print('  got size', len(raw), 'sha', sha(raw)[:16])
        print('  want size', IN_SIZE, 'sha', IN_SHA[:16])
        sys.exit(1)
    s = raw.decode('utf-8')
    for old, new, cnt in REPS:
        c = s.count(old)
        if c != cnt:
            print('MISSING/COUNT FAIL: expected %d found %d for:' % (cnt, c))
            print('   ' + old[:110].replace('\n', '\\n'))
            sys.exit(1)
        s = s.replace(old, new)
        print('DONE x%d  %s' % (cnt, old[:90].replace('\n', '\\n')))
    # ---- post-gates ----
    assert s.count('_ssU') == 4, '_ssU wiring'
    assert "interaction.locale?.startsWith('fr')" not in s, 'locale-only remains'
    print('POST-GATE guild-first lang OK')
    # ---- syntax gate ----
    tmp = P + '.check.js'
    open(tmp, 'w', encoding='utf-8').write(s)
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.remove(tmp)
    if r.returncode != 0:
        print('NODE --CHECK FAIL:'); print(r.stderr[:2000]); sys.exit(1)
    print('NODE --CHECK OK')
    out = s.encode('utf-8')
    open(P, 'wb').write(out)
    print('WROTE', P, len(out), 'HASH', sha(out))
    print('ALL DONE')

if __name__ == '__main__':
    main()
