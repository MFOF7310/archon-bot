'use strict';
// Files in Lydia's answers.
// The model can't attach or host anything, but when asked for a file it used to invent a download link
// (sandbox:/mnt/data/…, file://…) that came out broken. Now it writes [FILE:name.ext] followed by a code block,
// and ARCHON sends that content as a real attachment. Invented links that can't work are reduced to their text.

const MAX_FILES = 3;
const MAX_BYTES = 512 * 1024;
// Plain-text formats only: the content comes from a code block
const TEXT_EXT = /\.(txt|md|json|js|mjs|cjs|ts|tsx|jsx|py|sh|bash|ps1|bat|html|css|xml|yml|yaml|toml|ini|env|csv|tsv|sql|java|kt|c|h|cpp|cs|go|rs|rb|php|lua|swift|dart|r|log|cfg|conf|srt|vtt)$/i;

function safeName(raw, lang) {
    let n = String(raw || '').trim().replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^\.+/, '').slice(0, 80);
    if (!n) n = 'archon';
    if (!/\.[a-z0-9]{1,5}$/i.test(n)) n += lang && /^[a-z0-9]{1,5}$/i.test(lang) ? `.${lang.toLowerCase()}` : '.txt';
    if (!TEXT_EXT.test(n)) n += '.txt';   // a .pdf / .zip / .docx can't be made from text: keep the text readable
    return n;
}

// [FILE:name.ext] + ```lang … ``` → { name, content }; the block is replaced by a short "📎 name" line
function extractFiles(text) {
    const files = [];
    const out = String(text || '').replace(/\[FILE:\s*([^\]\n]{1,100})\]\s*\n?```([^\n`]*)\n([\s\S]*?)```/g, (all, name, lang, body) => {
        if (files.length >= MAX_FILES) return all;
        const content = body.replace(/\n$/, '');
        if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) return all;
        let n = safeName(name, lang.trim());
        while (files.some((f) => f.name === n)) n = n.replace(/(\.[^.]+)$/, '_2$1');
        files.push({ name: n, content });
        return `📎 **${n}**`;
    });
    // a tag left without its block: drop the tag
    return { text: out.replace(/\[FILE:[^\]\n]{0,100}\]/g, '').trim(), files };
}

// Links that can't work in Discord (the model's sandbox, local paths, inline data): keep their text, drop the link
function stripFakeLinks(text) {
    const fake = /^(sandbox:|file:|attachment:|data:|\/mnt\/|\/tmp\/|\/home\/|[a-z]:\\)/i;
    return String(text || '')
        .replace(/\[([^\]]{0,200})\]\(\s*<?([^)\s>]+)>?\s*\)/g, (all, label, url) => (fake.test(url) ? `**${label}**` : all))
        .replace(/(^|\s)(sandbox:\/\S+|file:\/\/\S+)/gi, '$1')
        .trim();
}

module.exports = { extractFiles, stripFakeLinks, MAX_FILES };
