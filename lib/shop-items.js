module.exports = [
    { 
        id: 'starter_pack', 
        price: 500, 
        emoji: require('../config/emojis').ic_bag || '📦', 
        type: 'consumable', 
        effect: { xp: 100, credits: 50 }
    },
    { 
        id: 'xp_boost_small', 
        price: 500, 
        emoji: require('../config/emojis').ic_bolt || '⚡', 
        type: 'consumable', 
        effect: { xp: 250 }
    },
    { 
        id: 'xp_boost_large', 
        price: 2000, 
        emoji: require('../config/emojis').ic_bolt || '⚡', 
        type: 'consumable', 
        effect: { xp: 1000 }
    },
    { 
        id: 'credit_boost_small', 
        price: 300, 
        emoji: require('../config/emojis').ic_credit || '🪙', 
        type: 'consumable', 
        effect: { credits: 200 }
    },
    { 
        id: 'credit_boost_large', 
        price: 1500, 
        emoji: require('../config/emojis').ic_credit || '💰', 
        type: 'consumable', 
        effect: { credits: 1000 }
    },
    { 
        id: 'vip_role', 
        price: 10000, 
        emoji: require('../config/emojis').ic_vip || '💎', 
        type: 'role',
        roleId: process.env.VIP_ROLE_ID,
        requirement: { level: 25 }
    },
    // ── BADGES ──
    {
        id: 'badge_eagle', price: 5000, emoji: require('../config/emojis').eagle || '🦅', type: 'badge', rarity: 'rare'
    },
    {
        id: 'badge_neural', price: 3000, emoji: require('../config/emojis').ic_vip || '🔮', type: 'badge', rarity: 'uncommon'
    },
    {
        id: 'badge_architect', price: 50000, emoji: require('../config/emojis').ic_architect || '👑', type: 'badge', rarity: 'legendary'
    },
    {
        id: 'badge_steel', price: 7500, emoji: require('../config/emojis').ic_steel || '⚙️', type: 'badge', rarity: 'epic'
    },
    { 
        id: 'verified_role', 
        price: 5000, 
        emoji: require('../config/emojis').ic_verified || '✅', 
        type: 'role',
        roleId: process.env.VERIFIED_ROLE_ID,
        requirement: { level: 10 }
    },
    { 
        id: 'badge_pioneer', 
        price: 8000, 
        emoji: require('../config/emojis').eagle || '🏅', 
        type: 'badge',
        requirement: { level: 5 }
    },
    { 
        id: 'badge_bamako', 
        price: 10000, 
        emoji: require('../config/emojis').ic_bamako || '🇲🇱', 
        type: 'badge',
        requirement: { level: 15 }
    },
    { 
        id: 'mystery_box_bronze', 
        price: 1000, 
        emoji: require('../config/emojis').ic_mystery || '🎁', 
        type: 'consumable',
        effect: { 
            random: [
                { xp: 100 }, { xp: 200 }, { credits: 100 }, 
                { credits: 200 }, { xp: 50, credits: 50 }
            ] 
        }
    },
    { 
        id: 'daily_streak_shield', 
        price: 2000, 
        emoji: require('../config/emojis').shield || '🛡️', 
        type: 'consumable',
        effect: { streak_protection: true }
    }
];
