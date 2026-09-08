#!/usr/bin/env python3
# ============================================================
# PATCH 45 - plugins/inventory.js: guild setting is the lang source
# Same prescribed pattern as use.js; guildId hoisted above lang;
# prefix now reads ss.prefix (drops a duplicate settings fetch).
# Accepts the file in EITHER state: post-patch35 (fresh) or
# post-patch41 (if you already ran it) - both converge to the
# same verified output hash.
# ============================================================
import hashlib, json, os, subprocess, sys

ROOT = os.getcwd()
P = os.path.join(ROOT, 'plugins/inventory.js')

STATES = json.loads(r'''[[16090, "6ade9588917f37016aa327bcfe38374de6d7ad667fa8e2c102bbf8cf1ee14468"], [16251, "ea46bfe46aa4d8c74c91b1e38ef4bdbb9fd8462db859b015805680acb0af656e"]]''')  # [[size, sha256], ...] one per accepted input state
REPS   = json.loads(r'''[[["        const lang = { fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en';\n        const prefix = interaction.guild ? (client.getServerSettings?.(interaction.guild.id)?.prefix || '.') : '.';\n        const guildId = interaction.guild?.id || 'DM';", "        const guildId = interaction.guild?.id || 'DM';\n        const ss = client.getServerSettings?.(guildId)\n            || client.settings?.get(guildId)\n            || {};\n        const lang = ss.language || 'en';\n        const prefix = ss.prefix || '.';", 1]], [["        const _ssI = interaction.guild ? client.getServerSettings?.(interaction.guild.id) : null;\n        const lang = _ssI?.language && _ssI.language !== 'auto' ? _ssI.language : ({ fr: 'fr', zh: 'zh', ar: 'ar', bm: 'bm' }[(interaction.locale || '').slice(0, 2).toLowerCase()] || 'en');\n        const prefix = interaction.guild ? (client.getServerSettings?.(interaction.guild.id)?.prefix || '.') : '.';\n        const guildId = interaction.guild?.id || 'DM';", "        const guildId = interaction.guild?.id || 'DM';\n        const ss = client.getServerSettings?.(guildId)\n            || client.settings?.get(guildId)\n            || {};\n        const lang = ss.language || 'en';\n        const prefix = ss.prefix || '.';", 1]]]''')    # one rep-list per state, same order as STATES
OUT_SHA = 'c150497fe7a104c2326597a373de57c3197ace75a9f6ba125492c7e1f7883b1d'

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
    assert '_ssI' not in s, 'patch41 leftovers'
    assert 'interaction.locale' not in s, 'locale source remains'
    assert s.count("const prefix = ss.prefix || '.';") == 1, 'prefix rewire missing'
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
