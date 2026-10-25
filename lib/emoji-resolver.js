const FALLBACKS = { small_check: '✅', small_cross: '❌', error: '❌', warning: '⚠️', check: '✅', success: '✅', trophy: '🏆', coins: '🪙', online: '🟢', offline: '⚫', cashmoney: '💰', member: '👤', target: '🎯', gift: '🎁', clock: '⏱️', crown: '👑', general: '📺', party: '🎉' };

function resolveEmoji(name, context) {
    try {
        const EMOJIS = require('../config/emojis');
        const raw = EMOJIS[name];
        if (!raw) return FALLBACKS[name] || '';
        if (!raw.startsWith('<')) return raw; // Already Unicode

        // Extract context safely without touching cache
        const guild = context?.guild || (context?.guildId ? context.client?.guilds?.cache?.get(context.guildId) : context);
        const channel = context?.channel || (context?.author ? context : null);
        const me = guild?.members?.me;

        let hasPerm = true; // Assume true for DMs

        if (channel && me && typeof channel.permissionsFor === 'function') {
            hasPerm = channel.permissionsFor(me)?.has('UseExternalEmojis') ?? false;
        } else if (me) {
            hasPerm = me.permissions.has('UseExternalEmojis');
        }

        return hasPerm ? raw : (FALLBACKS[name] || '❌');
        
    } catch { 
        return FALLBACKS[name] || '❌'; 
    }
}

module.exports = { resolveEmoji };
