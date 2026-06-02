/*
// plugins/premium.js — Archon Engine Premium Tier Provisioner (Production v3.1.0)
// ============================================================
// FIXES in v3.1:
//   1. Status now properly reads from user_premium table via client.db
//   2. Added debug mode flag (set DEBUG_PREMIUM=true in .env for verbose logs)
//   3. Handles missing db gracefully with helpful error messages
//   4. Properly formats tier names and expiry dates
// ============================================================

try {
    require('dotenv').config();
} catch (e) {}

const DEBUG = process.env.DEBUG_PREMIUM === 'true';

const DODO_PRODUCT_URL = process.env.DODO_PRODUCT_URL || 'https://app.dodopayments.com/buy/p_mock12345';

if (!process.env.DODO_PRODUCT_URL) {
    console.warn(
        '[PREMIUM PLUGIN] ⚠️ DODO_PRODUCT_URL not set. Using fallback placeholder.\n' +
        '  → Set it in your .env file for live checkout links.'
    );
} else {
    console.log('[PREMIUM PLUGIN] ✅ DODO_PRODUCT_URL loaded.');
}

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

// ============================================================
// HELPERS
// ============================================================
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

function daysRemaining(expiryTimestamp) {
    if (!expiryTimestamp) return null;
    return Math.max(0, Math.ceil((expiryTimestamp * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
}

function buildProgressBar(premiumSince, premiumExpires) {
    if (!premiumExpires) return '████████████████████ ▓▓ Lifetime';
    const total = premiumExpires - premiumSince;
    const elapsed = Math.floor(Date.now() / 1000) - premiumSince;
    const remaining = premiumExpires - Math.floor(Date.now() / 1000);
    if (remaining <= 0) return '░░░░░░░░░░░░░░░░░░░░ ▓▓ Expired';
    const filled = Math.round(Math.min(1, Math.max(0, elapsed / total)) * 20);
    return '█'.repeat(filled) + '░'.repeat(20 - filled) + ' ▓▓ ' + daysRemaining(premiumExpires) + 'd left';
}

function getStatusEmoji(premiumExpires, isActive) {
    if (!isActive) return '⚪';
    if (!premiumExpires) return '🟢';
    const days = daysRemaining(premiumExpires);
    if (days === null) return '🟢';
    if (days > 30) return '🟢';
    if (days > 7) return '🟡';
    if (days > 0) return '🟠';
    return '🔴';
}

function formatTier(tier) {
    if (!tier) return 'PREMIUM';
    return tier.replace(/_/g, ' ').toUpperCase();
}

// ============================================================
// DATABASE QUERY (with debug logging)
// ============================================================
function fetchPremiumData(db, userId) {
    if (!db) {
        if (DEBUG) console.log('[PREMIUM] ❌ fetchPremiumData called with null db');
        return null;
    }
    try {
        const row = db.prepare(
            'SELECT premium_active, premium_since, premium_expires, tier, cancelled_at, notified FROM user_premium WHERE user_id = ?'
        ).get(userId);

        if (DEBUG) console.log(`[PREMIUM] DB query for ${userId}:`, row ? JSON.stringify(row) : 'NULL (no row)');

        return row || null;
    } catch (err) {
        console.error('[PREMIUM DB] Query error for ' + userId + ':', err.message);
        return null;
    }
}

// ============================================================
// EXPORT
// ============================================================
module.exports = {
    name: 'premium',
    description: '💎 Premium Access Tier Provisioner',
    category: 'UTILITY',
    usage: '/premium [status | upgrade]',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('💎 Manage your Archon Premium subscription')
        .addSubcommand(sub =>
            sub
                .setName('status')
                .setDescription('📊 View your current premium subscription status')
        )
        .addSubcommand(sub =>
            sub
                .setName('upgrade')
                .setDescription('🚀 Upgrade to Archon Premium and unlock all advanced modules')
        ),

    run: async (client, message, args, db, serverSettings) => {
        return message.reply({
            content: '⚡ Use the slash command `/premium status` or `/premium upgrade` to manage your subscription.'
        });
    },

    execute: async (interaction, client) => {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'status') return handleStatus(interaction, client);
        if (subcommand === 'upgrade') return handleUpgrade(interaction, client);
    }
};

// ============================================================
// SUBCOMMAND: /premium status (FIXED)
// ============================================================
async function handleStatus(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const avatarURL = interaction.user.displayAvatarURL({ dynamic: true });

    console.log(`[PREMIUM] 📊 Status check by ${username} (${userId})`);

    // Verify database is available
    if (!client.db) {
        console.error('[PREMIUM] ❌ client.db is undefined!');
        return interaction.editReply({
            content: '❌ **Database Error:** The premium system cannot connect to the database. Please contact the architect.',
            ephemeral: true
        });
    }

    // Fetch data from the SAME database the webhook writes to
    const premiumData = fetchPremiumData(client.db, userId);

    // DEBUG MODE: If env var DEBUG_PREMIUM=true, show raw data
    if (DEBUG) {
        return interaction.editReply({
            content:
                '**🔍 DEBUG INFO**\n\n' +
                '**Your User ID:** ' + userId + '\n' +
                '**DB Connected:** ' + (!!client.db) + '\n' +
                '**Premium Data:** ' + JSON.stringify(premiumData, null, 2) + '\n' +
                '**Is Active:** ' + (premiumData?.premium_active === 1),
            ephemeral: true
        });
    }

    // NO DATA FOUND — User has never purchased or webhook failed to write
    if (!premiumData) {
        const noDataEmbed = new EmbedBuilder()
            .setColor('#95a5a6')
            .setAuthor({ name: `${username} • Premium Status`, iconURL: avatarURL })
            .setTitle('⚪ No Premium Data Found')
            .setDescription(
                'You don\'t have an active premium subscription on record.\n\n' +
                '**Possible reasons:**\n' +
                '• Purchase is still processing (wait 30 seconds)\n' +
                '• Webhook delivery failed — contact support\n' +
                '• You haven\'t purchased yet\n\n' +
                'Use **`/premium upgrade`** to get started!'
            )
            .setFooter({ text: 'Archon Engine CG-223', iconURL: client.user?.displayAvatarURL() || null })
            .setTimestamp();

        const upgradeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Get Premium')
                .setStyle(ButtonStyle.Primary)
                .setCustomId('premium_upgrade_btn')
                .setEmoji('💎')
        );

        return interaction.editReply({ embeds: [noDataEmbed], components: [upgradeRow] });
    }

    // DATA FOUND — Build proper status display
    const isActive = premiumData.premium_active === 1;
    const tier = formatTier(premiumData.tier);
    const since = formatDate(premiumData.premium_since);
    const expires = formatDate(premiumData.premium_expires);
    const daysLeft = daysRemaining(premiumData.premium_expires);
    const progressBar = buildProgressBar(premiumData.premium_since, premiumData.premium_expires);
    const statusEmoji = getStatusEmoji(premiumData.premium_expires, isActive);
    const cancelled = premiumData.cancelled_at ? formatDate(premiumData.cancelled_at) : null;

    let statusColor, statusTitle, statusDescription;

    if (!isActive) {
        statusColor = '#e74c3c';
        statusTitle = '🔴 Premium Inactive';
        statusDescription = cancelled 
            ? `Your subscription was cancelled on **${cancelled}**.\nReactivate anytime with \`/premium upgrade\`.`
            : 'Your premium subscription has expired or been revoked.';
    } else if (daysLeft !== null && daysLeft <= 7) {
        statusColor = '#f39c12';
        statusTitle = '🟠 Premium Expiring Soon';
        statusDescription = `Your subscription expires in **${daysLeft} day${daysLeft !== 1 ? 's' : ''}**! Renew now to keep your benefits.`;
    } else {
        statusColor = '#00fbff';
        statusTitle = `${statusEmoji} Premium Active`;
        statusDescription = 'Your neural link is fully synchronized. All advanced modules are unlocked.';
    }

    const statusEmbed = new EmbedBuilder()
        .setColor(statusColor)
        .setAuthor({ name: `${username} • ${tier}`, iconURL: avatarURL })
        .setTitle(statusTitle)
        .setDescription(statusDescription)
        .addFields(
            {
                name: '📊 Subscription Details',
                value: [
                    `**Tier:** ${tier}`,
                    `**Status:** ${isActive ? 'ACTIVE' : 'INACTIVE'}`,
                    `**Activated:** ${since}`,
                    premiumData.premium_expires ? `**Expires:** ${expires}` : '**Expires:** Never (Lifetime)',
                    `**Progress:**\n${progressBar}`
                ].join('\n'),
                inline: false
            },
            {
                name: '🧠 Active Modules',
                value: isActive ? [
                    '✅ Uncapped Lydia AI Memory',
                    '✅ Global Multi-Server Log Syncing',
                    '✅ HTML Ticket Transcript Mirrors',
                    '✅ Priority Processing Threads',
                    '✅ Premium Badge & Recognition'
                ].join('\n') : [
                    '❌ Uncapped Lydia AI Memory',
                    '❌ Global Multi-Server Log Syncing',
                    '❌ HTML Ticket Transcript Mirrors',
                    '❌ Priority Processing Threads',
                    '❌ Premium Badge & Recognition'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'Archon Engine CG-223 • Premium Dashboard', iconURL: client.user?.displayAvatarURL() || null })
        .setTimestamp();

    // Add renew button if expiring or inactive
    const components = [];
    if (!isActive || (daysLeft !== null && daysLeft <= 7)) {
        const renewRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel(isActive ? 'Renew Premium' : 'Reactivate Premium')
                .setStyle(ButtonStyle.Link)
                .setURL(DODO_PRODUCT_URL + '?metadata[discord_user_id]=' + userId)
                .setEmoji('💎')
        );
        components.push(renewRow);
    }

    return interaction.editReply({ embeds: [statusEmbed], components });
}

// ============================================================
// SUBCOMMAND: /premium upgrade
// ============================================================
async function handleUpgrade(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const avatarURL = interaction.user.displayAvatarURL({ dynamic: true });

    console.log(`[PREMIUM] 🚀 Upgrade requested by ${username} (${userId})`);

    // Check current status
    const premiumData = fetchPremiumData(client.db, userId);

    if (premiumData?.premium_active === 1) {
        const tierDisplay = formatTier(premiumData.tier);
        const daysLeft = daysRemaining(premiumData.premium_expires);

        const alreadyEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: `${username} • Already Premium`, iconURL: avatarURL })
            .setTitle("🦅 You're Already Premium!")
            .setDescription(
                `You're on the **${tierDisplay}** tier${daysLeft ? ` with **${daysLeft} days** remaining` : ''}.\n\n` +
                'Use **`/premium status`** to view your detailed dashboard.'
            )
            .setFooter({ text: 'Archon Engine CG-223', iconURL: client.user?.displayAvatarURL() || null })
            .setTimestamp();

        return interaction.editReply({ embeds: [alreadyEmbed] });
    }

    const checkoutUrl = DODO_PRODUCT_URL + '?metadata[discord_user_id]=' + userId;

    console.log(`[PREMIUM] 🔗 Checkout: ${DODO_PRODUCT_URL}?metadata[discord_user_id]=${userId.substring(0, 6)}...`);

    const upgradeEmbed = new EmbedBuilder()
        .setColor('#5865f2')
        .setAuthor({ name: `${username} • Upgrade to Premium`, iconURL: avatarURL })
        .setTitle('🦅 ARCHITECT CG-223 • Premium')
        .setDescription(
            '**Unlock the full power of Archon Engine.**\n' +
            'One subscription. Every server you manage. Instant activation.'
        )
        .addFields(
            {
                name: '🧠 Uncapped Lydia AI',
                value: 'Continuous memory matrices. Your AI remembers every context, every conversation, forever.',
                inline: false
            },
            {
                name: '📡 Global Log Syncing',
                value: 'Block a threat in one server — defenses deploy instantly across **all** your servers.',
                inline: false
            },
            {
                name: '📊 HTML Transcripts',
                value: 'Auto-compiled, beautifully formatted ticket archives saved to your domain.',
                inline: false
            },
            {
                name: '⚡ Priority Processing',
                value: 'Your commands jump the queue. Zero latency. Maximum performance.',
                inline: false
            },
            {
                name: '🏷️ Premium Badge',
                value: 'Exclusive recognition across every server. Stand out.',
                inline: false
            },
            {
                name: '🔒 Secure Checkout',
                value: 'Powered by **Dodo Payments**. Enterprise encryption. Your data never touches our servers.',
                inline: false
            }
        )
        .setFooter({ text: 'Archon Engine CG-223 • Dodo Payments', iconURL: client.user?.displayAvatarURL() || null })
        .setTimestamp();

    const upgradeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Unlock Premium')
            .setStyle(ButtonStyle.Link)
            .setURL(checkoutUrl)
            .setEmoji('💎')
    );

    try {
        await interaction.editReply({ embeds: [upgradeEmbed], components: [upgradeRow] });
        console.log(`[PREMIUM] ✅ Upgrade offer sent to ${username}`);
    } catch (err) {
        console.error('[PREMIUM] ❌ Failed to send upgrade embed:', err.message);
        await interaction.editReply({
            content: '💎 **Upgrade to Archon Premium**\n\n' + checkoutUrl,
            ephemeral: true
        }).catch(function() {});
    }
}
*/
