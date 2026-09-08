#!/usr/bin/env python3
# ============================================================
# PATCH 44 - plugins/use.js: guild setting is the lang source
# Per directive: ss = client.getServerSettings?.(guildId) || client.settings?.get(guildId) || {};
# lang = ss.language || 'en'. Drops interaction.locale entirely.
# Accepts the file in EITHER state: post-patch34 (fresh) or
# post-patch40 (if you already ran it) - both converge to the
# same verified output hash.
# ============================================================
import hashlib, json, os, subprocess, sys

ROOT = os.getcwd()
P = os.path.join(ROOT, 'plugins/use.js')

STATES = json.loads(r'''[[41919, "9af27203d5248ad5931f9566ee85a5c6362883b98d3938449d3161be15f0af46"], [42080, "a81896551943938a74c3c6870b74ac932f602b508723c8998ecf8f1bc18ae5f4"]]''')  # [[size, sha256], ...] one per accepted input state
REPS   = json.loads(r'''[[["        const lang = { fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en';", "        const ss = client.getServerSettings?.(guildId)\n            || client.settings?.get(guildId)\n            || {};\n        const lang = ss.language || 'en';", 1]], [["        const _ssU = interaction.guild ? client.getServerSettings?.(interaction.guild.id) : null;\n        const lang = _ssU?.language && _ssU.language !== 'auto' ? _ssU.language : ({ fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en');", "        const ss = client.getServerSettings?.(guildId)\n            || client.settings?.get(guildId)\n            || {};\n        const lang = ss.language || 'en';", 1]]]''')    # one rep-list per state, same order as STATES
OUT_SHA = 'd44035377806639b9be205c7f6a3143304fd62c7e6fe214b464da111177a61ef'

def sha(b): return hashlib.sha256(b).hexdigest()

def main():
    raw = open(P, 'rb').read()
    h = sha(raw)
    variant = None
    for i, (sz, hh) in enumerate(STATES):
        if len(raw) == sz and h == hh:
            variant = i
            break
    if variant is None:
        print('INPUT GATE FAIL - file changed, wrong path, or unknown state')
        print('  got size', len(raw), 'sha', h[:16])
        for sz, hh in STATES:
            print('  accepts size', sz, 'sha', hh[:16])
        sys.exit(1)
    print('INPUT STATE', 'AB'[variant], 'OK (sha', h[:16] + ')')
    s = raw.decode('utf-8')
    for old, new, cnt in REPS[variant]:
        c = s.count(old)
        if c != cnt:
            print('MISSING/COUNT FAIL: expected %d found %d for:' % (cnt, c))
            print('   ' + old[:110].replace('\n', '\\n'))
            sys.exit(1)
        s = s.replace(old, new)
        print('DONE x%d  %s' % (cnt, old[:90].replace('\n', '\\n')))
    # ---- post-gates ----
    assert s.count("const lang = ss.language || 'en';") == 1, 'lang line missing'
    assert '_ssU' not in s, 'patch40 leftovers'
    assert 'interaction.locale' not in s, 'locale source remains'
    assert s.count("client.settings?.get(guildId)") == 1, 'settings fallback missing'
    print('POST-GATE guild-setting lang OK')
    oh = sha(s.encode('utf-8'))
    if oh != OUT_SHA:
        print('OUTPUT GATE FAIL'); print('  got ', oh); print('  want', OUT_SHA); sys.exit(1)
    print('OUTPUT GATE OK')
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
