#!/usr/bin/env python3
# ============================================================
# PATCH 42 - plugins/shop.js: lang source standardization
# Was guild-only with hard en fallback; now guild first with
# client locale fallback when guild is auto/unset (DM too).
# ============================================================
import hashlib, json, os, subprocess, sys

ROOT = os.getcwd()
P = os.path.join(ROOT, 'plugins/shop.js')
IN_SHA = 'e2ce0ca5ec454c0f5dfe8bc269ac14ec95248e0a875bdf90652fc678b2104647'
IN_SIZE = 25805

REPS = json.loads(r'''[["        const lang = ['fr', 'bm', 'zh', 'ar'].includes(serverSettings?.language) ? serverSettings.language : 'en';", "        const lang = serverSettings?.language && serverSettings.language !== 'auto' ? serverSettings.language : ({ fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en');", 1]]''')

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
    assert s.count("serverSettings.language !== 'auto'") == 1, 'auto fallback missing'
    assert "interaction.locale || ''" in s, 'locale fallback missing'
    print('POST-GATE guild-first + locale-fallback OK')
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
