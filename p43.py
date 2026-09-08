#!/usr/bin/env python3
# ============================================================
# PATCH 43 - index.js: slash-to-prefix adapter lang source
# Adapter fed run() plugins locale-only fr/en; now guild first,
# 5-locale client fallback. Affects every run()-only plugin.
# ============================================================
import hashlib, json, os, subprocess, sys

ROOT = os.getcwd()
P = os.path.join(ROOT, 'index.js')
IN_SHA = 'e7f873493739c1c80c312b9eeb2fe5594e1f51cb09d5e9f124ccab4ed230869e'
IN_SIZE = 282198

REPS = json.loads(r'''[["                const usedCommand = interaction.commandName;\n                const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';", "                const usedCommand = interaction.commandName;\n                const lang = interaction.guild && serverSettings?.language && serverSettings.language !== 'auto' ? serverSettings.language : ({ fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en');", 1]]''')

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
    assert s.count("const usedCommand = interaction.commandName;\n                const lang = interaction.guild && serverSettings?.language") == 1, 'adapter wiring'
    print('POST-GATE slash-adapter guild-first OK')
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
