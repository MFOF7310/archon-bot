// ═══════════════════════════════════════════════════════════════════════
// AUTOCOMPLETE HELPERS — one shape for every plugin
//   filter(query, items)  → filtered, capped at 25
//   reply(interaction, items) → safe respond, never throws
//   fromRows(rows, nameKey, valueKey) → [{ name, value }, ...]
// ═══════════════════════════════════════════════════════════════════════
const MAX = 25;
const clean = (s, max = 100) => String(s ?? '').replace(/[*_`~|\\]/g, '').slice(0, max);

function filter(query, items = []) {
    const q = String(query || '').toLowerCase().trim();
    const seen = new Set();
    const out = [];
    for (const it of items) {
        if (!it || it.value === undefined || it.value === null) continue;
        const name = String(it.name ?? it.value);
        const value = String(it.value);
        if (seen.has(value)) continue;
        if (q && !name.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) continue;
        seen.add(value);
        out.push({ name: clean(name, 100), value: value.slice(0, 100) });
        if (out.length >= MAX) break;
    }
    return out;
}

function fromRows(rows = [], nameKey, valueKey) {
    return rows.map(r => ({ name: String(r[nameKey] ?? r[valueKey] ?? ''), value: String(r[valueKey] ?? r[nameKey] ?? '') }));
}

async function reply(interaction, items = []) {
    const focused = (() => {
        try { return interaction.options.getFocused(); } catch { return ''; }
    })();
    const list = filter(focused, items);
    if (interaction.responded) return;
    await interaction.respond(list).catch(() => {});
}

module.exports = { filter, reply, fromRows };
