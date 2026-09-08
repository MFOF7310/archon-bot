#!/usr/bin/env python3
# ============================================================
# PATCH 41 - plugins/inventory.js: lang source standardization
# Slash execute() was user-locale-only; now guild setting first,
# client locale as fallback. Matches use.js/shop.js/index.js.
# ============================================================
import hashlib, json, os, subprocess, sys

ROOT = os.getcwd()
P = os.path.join(ROOT, 'plugins/inventory.js')
IN_SHA = '6ade9588917f37016aa327bcfe38374de6d7ad667fa8e2c102bbf8cf1ee14468'
IN_SIZE = 16090

REPS = json.loads(r'''[["        const lang = { fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en';", "        const _ssI = interaction.guild ? client.getServerSettings?.(interaction.guild.id) : null;\n        const lang = _ssI?.language && _ssI.language !== 'auto' ? _ssI.language : ({ fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en');", 1]]''')

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
    assert s.count('_ssI') == 4, '_ssI wiring'
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
