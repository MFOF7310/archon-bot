const { resolveEmoji } = require('../lib/emoji-resolver');
const i18n = require('../lib/i18n');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, ChannelSelectMenuBuilder, ChannelType, ThumbnailBuilder } = require('discord.js');

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════
function parseDuration(str) {
    const m = str.match(/^(\d+)(s|m|h|d)$/i);
    if (!m) return null;
    const n = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return n * mult[unit];
}

function selectWinners(entries, count) {
    if (entries.length === 0) return [];
    const pool = [...entries];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.min(count, pool.length));
}

function getLang(client, guildId) {
    try {
        const ss = client.settings?.get(guildId);
        return ss?.language === 'fr' ? 'fr' : 'en';
    } catch { return 'en'; }
}

// ═══════════════════════════════════════════════════════
// DATABASE SETUP & SWEEPER
// ═══════════════════════════════════════════════════════
function ensureTables(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS giveaways (
            id TEXT PRIMARY KEY,
            guild_id TEXT,
            channel_id TEXT,
            message_id TEXT,
            host_id TEXT,
            prize TEXT,
            amount INTEGER,
            winners INTEGER,
            end_timestamp INTEGER,
            status TEXT,
            min_level INTEGER DEFAULT 0,
            min_credits INTEGER DEFAULT 0,
            booster_bonus INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS giveaway_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            giveaway_id TEXT,
            user_id TEXT
        );
        CREATE TABLE IF NOT EXISTS giveaway_winners (
            giveaway_id TEXT,
            user_id TEXT,
            PRIMARY KEY (giveaway_id, user_id)
        );
    `);
}

let sweeperInterval = null;
let isListening = false;

function init(client, db) {
    if (sweeperInterval) return;
    ensureTables(db);
    
    // Sweeper to end giveaways on time, even after restarts
    sweeperInterval = setInterval(async () => {
        try {
            const now = Date.now();
            const active = db.prepare('SELECT * FROM giveaways WHERE status = ? AND end_timestamp <= ?').all('active', now);
            for (const row of active) {
                await endGiveawayDb(row.id, client, db);
            }
        } catch (e) {
            console.error('[GIVEAWAY SWEEPER ERROR]', e);
        }
    }, 15000);

    // Global button listener for public messages
    if (!isListening) {
        isListening = true;
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;
            if (!interaction.customId.startsWith('gw_enter_')) return;
            
            try {
                const id = interaction.customId.replace('gw_enter_', '');
                const gw = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
                if (!gw || gw.status !== 'active') {
                    return interaction.reply({ content: '❌ This giveaway has ended.', flags: 64 });
                }

                const userEntries = db.prepare('SELECT id FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').all(id, interaction.user.id);
                
                if (gw.host_id === interaction.user.id) {
                    return interaction.reply({ content: '❌ You cannot enter your own giveaway.', flags: 64 });
                }
                if (userEntries.length > 0) {
                    return interaction.reply({ content: '❌ You are already in this giveaway.', flags: 64 });
                }

                const user = db.prepare('SELECT level, credits FROM users WHERE id = ? AND guild_id = ?').get(interaction.user.id, gw.guild_id);
                if (gw.min_level > 0 && (!user || user.level < gw.min_level)) {
                    return interaction.reply({ content: `❌ You need level ${gw.min_level}+ to enter.`, flags: 64 });
                }
                if (gw.min_credits > 0 && (!user || user.credits < gw.min_credits)) {
                    return interaction.reply({ content: `❌ You need ${gw.min_credits.toLocaleString()} credits to enter.`, flags: 64 });
                }

                // Add entry
                db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(id, interaction.user.id);
                
                const isBooster = interaction.member?.premiumSince != null;
                if (gw.booster_bonus === 1 && isBooster) {
                    db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(id, interaction.user.id);
                }

                const newEntriesCount = db.prepare('SELECT COUNT(*) as c FROM giveaway_entries WHERE giveaway_id = ?').get(id).c;
                
                // Update message
                const channel = await client.channels.fetch(gw.channel_id).catch(() => null);
                const msg = await channel?.messages.fetch(gw.message_id).catch(() => null);
                if (msg) {
                    const hostUser = await client.users.fetch(gw.host_id).catch(() => null);
                    const gwObj = {
                        id: gw.id,
                        guildId: gw.guild_id,
                        channelId: gw.channel_id,
                        messageId: gw.message_id,
                        hostId: gw.host_id,
                        hostName: hostUser ? hostUser.username : 'Host',
                        prize: gw.prize,
                        amount: gw.amount,
                        winners: gw.winners,
                        minLevel: gw.min_level,
                        minCredits: gw.min_credits,
                        boosterBonus: gw.booster_bonus === 1,
                        status: 'active',
                        endTimestamp: gw.end_timestamp,
                        entries: new Array(newEntriesCount).fill(null),
                        lang: getLang(client, gw.guild_id)
                    };
                    const card = buildGiveawayCard(gwObj, client);
                    await msg.edit(card).catch(() => {});
                }

                await interaction.reply({ content: `✅ You're in. Good luck!`, flags: 64 });
            } catch (e) {
                console.error('[GIVEAWAY BUTTON]', e);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '⚠️ Error.', flags: 64 }).catch(() => {});
                }
            }
        });
    }
}

// ═══════════════════════════════════════════════════════
// BUILD GIVEAWAY CARD (PUBLIC)
// ═══════════════════════════════════════════════════════
function buildGiveawayCard(gw, client) {
    const t = (k, v) => i18n.t('giveaway.' + k, gw.lang || 'en', v);
    const entries = gw.entries ? gw.entries.length : 0;
    const isActive = gw.status === 'active';
    const each = gw.winners > 0 ? Math.floor(gw.amount / gw.winners) : 0;
    
    const title = gw.amount > 0 ? t('mockLiveDrop', { amount: gw.amount.toLocaleString() }) : gw.prize;
    const c = new ContainerBuilder().setAccentColor(isActive ? 0x00f0ff : 0xf1c40f);

    // Header & Host
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}${!isActive ? ' `' + t('mockEnded') + '`' : ''}`));
    
    const hostUser = client.users.cache.get(gw.hostId);
    const hostAvatar = hostUser ? hostUser.displayAvatarURL({ extension: 'png', size: 64 }) : client.user.displayAvatarURL();
    
    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`👤 ${t('mockHostedBy', { host: gw.hostName })}`))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(hostAvatar))
    );

    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    if (isActive) {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`⏰ ${t('mockEndsIn', { time: `<t:${Math.floor(gw.endTimestamp / 1000)}:R>` })}`));
        if (gw.amount > 0) {
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`🏆 ${t('mockWinnersEach', { winners: gw.winners, each: each.toLocaleString() })}`));
        } else {
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`🏆 ${gw.winners} winners`));
        }
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`👥 ${t('mockPeopleEntered', { count: entries })}`));
        
        let reqText = '';
        if (gw.minLevel > 0) reqText += `Needs level ${gw.minLevel}+. `;
        if (gw.boosterBonus) reqText += `Boosters get double entries.`;
        if (reqText) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`🔒 ${reqText.trim()}`));
        
        c.addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gw_enter_${gw.id}`).setLabel(t('mockEnterBtn')).setStyle(ButtonStyle.Primary)
        ));
    } else {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Winners**`));
        let winText = '';
        for (const uid of gw.winnersList) {
            const user = client.users.cache.get(uid);
            const name = user ? user.username : 'Unknown';
            winText += `**${name.charAt(0).toUpperCase()}** ${name} ${gw.amount > 0 ? `+${each.toLocaleString()} credits` : ''}\n`;
        }
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(winText || 'No valid entries.'));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('mockEntriesHosted', { count: entries, host: gw.hostName })}`));
        
        // NO BUTTONS on ended cards, as requested in the mockup.
    }

    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

// ═══════════════════════════════════════════════════════
// END / REROLL LOGIC
// ═══════════════════════════════════════════════════════
async function endGiveawayDb(id, client, db) {
    const gwRow = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
    if (!gwRow || gwRow.status !== 'active') return;

    db.prepare('UPDATE giveaways SET status = ? WHERE id = ?').run('ended', id);
    
    const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(id).map(e => e.user_id);
    const winners = selectWinners(entries, gwRow.winners);
    
    for (const w of winners) {
        db.prepare('INSERT OR IGNORE INTO giveaway_winners (giveaway_id, user_id) VALUES (?, ?)').run(id, w);
    }

    const hostUser = await client.users.fetch(gwRow.host_id).catch(() => null);
    const gw = {
        id: gwRow.id,
        guildId: gwRow.guild_id,
        channelId: gwRow.channel_id,
        messageId: gwRow.message_id,
        hostId: gwRow.host_id,
        hostName: hostUser ? hostUser.username : 'Host',
        prize: gwRow.prize,
        amount: gwRow.amount,
        winners: gwRow.winners,
        minLevel: gwRow.min_level,
        minCredits: gwRow.min_credits,
        boosterBonus: gwRow.booster_bonus === 1,
        status: 'ended',
        endTimestamp: gwRow.end_timestamp,
        lang: getLang(client, gwRow.guild_id),
        entries: entries,
        winnersList: winners
    };

    if (winners.length > 0 && gw.amount > 0) {
        const each = Math.floor(gw.amount / winners.length);
        for (const uid of winners) {
            const existing = db.prepare('SELECT id FROM users WHERE id = ? AND guild_id = ?').get(uid, gw.guildId);
            if (!existing) {
                db.prepare('INSERT INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, ?)').run(uid, gw.guildId, 'Agent', each);
            } else {
                db.prepare('UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?').run(each, uid, gw.guildId);
            }
        }
    }

    try {
        const channel = await client.channels.fetch(gw.channelId).catch(() => null);
        if (!channel) return;
        const msg = await channel.messages.fetch(gw.messageId).catch(() => null);
        if (!msg) return;

        const card = buildGiveawayCard(gw, client);
        await msg.edit(card).catch(() => {});

        if (winners.length > 0) {
            const each = Math.floor(gw.amount / gw.winners);
            const mention = winners.map(w => `<@${w}>`).join(' ');
            const announce = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle('🎊 Giveaway Results')
                .setDescription(`**${gw.amount > 0 ? gw.amount.toLocaleString() + ' credits drop' : gw.prize}**\n\n` +
                    winners.map(w => `🏆 <@${w}>${gw.amount > 0 ? ` — +${each.toLocaleString()} 🪙` : ''}`).join('\n'))
                .setFooter({ text: `Hosted by ${gw.hostName}` });
            await channel.send({ content: `${mention} 🎊`, embeds: [announce] }).catch(() => {});

            for (const uid of winners) {
                const user = await client.users.fetch(uid).catch(() => null);
                if (!user) continue;
                const guildName = client.guilds.cache.get(gw.guildId)?.name || 'Unknown';
                const dm = new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setTitle('🎊 You won a giveaway!')
                    .setDescription(
                        `**Prize:** ${gw.amount > 0 ? gw.amount.toLocaleString() + ' credits' : gw.prize}\n` +
                        `**Server:** ${guildName}\n\n` +
                        (gw.amount > 0 ? `Credits have been added to your account!` : `You won the custom prize! Contact the host to claim it.`)
                    );
                await user.send({ embeds: [dm] }).catch(() => {});
            }
        } else {
            await channel.send({ content: 'No one entered the giveaway.' }).catch(() => {});
        }
    } catch (e) {
        console.error('[GIVEAWAY END ERROR]', e);
    }
}

async function rerollGiveaway(id, client, db) {
    const gwRow = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
    if (!gwRow || gwRow.status !== 'ended' || gwRow.amount > 0) return null;

    db.prepare('DELETE FROM giveaway_winners WHERE giveaway_id = ?').run(id);
    
    const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(id).map(e => e.user_id);
    const winners = selectWinners(entries, gwRow.winners);
    
    for (const w of winners) {
        db.prepare('INSERT OR IGNORE INTO giveaway_winners (giveaway_id, user_id) VALUES (?, ?)').run(id, w);
    }

    const channel = await client.channels.fetch(gwRow.channel_id).catch(() => null);
    if (!channel) return null;
    const msg = await channel.messages.fetch(gwRow.message_id).catch(() => null);
    if (!msg) return null;

    const hostUser = await client.users.fetch(gwRow.host_id).catch(() => null);
    const gw = { ...gwRow, entries, winnersList: winners, status: 'ended', endTimestamp: gwRow.end_timestamp, hostName: hostUser ? hostUser.username : 'Host', lang: getLang(client, gwRow.guild_id) };

    const card = buildGiveawayCard(gw, client);
    await msg.edit(card).catch(() => {});

    const mention = winners.map(w => `<@${w}>`).join(' ');
    await channel.send({ content: `🔄 **Reroll!** New winners: ${mention || 'None'}` }).catch(() => {});

    return winners;
}

async function startGiveaway({ client, db, hostId, hostName, guildId, channel, amount, prizeName, winners, duration, minLevel, minCredits, boosterBonus }) {
    const id = `${guildId}_${Date.now()}`;
    const endTimestamp = Date.now() + duration;
    const lang = getLang(client, guildId);
    
    db.prepare(`INSERT INTO giveaways (id, guild_id, channel_id, host_id, prize, amount, winners, end_timestamp, status, min_level, min_credits, booster_bonus) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, guildId, channel.id, hostId, prizeName || 'Credits Drop', amount, winners, endTimestamp, 'active', minLevel, minCredits, boosterBonus ? 1 : 0
    );

    const gwObj = {
        id, guildId, channelId: channel.id, hostId, hostName,
        prize: prizeName || 'Credits Drop', amount, winners, minLevel, minCredits,
        boosterBonus, endTimestamp, lang, status: 'active', entries: []
    };

    const card = buildGiveawayCard(gwObj, client);
    const msg = await channel.send(card).catch(() => null);
    if (!msg) return;

    db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(msg.id, id);
}

// ═══════════════════════════════════════════════════════
// MODULE EXPORT
// ═══════════════════════════════════════════════════════
module.exports = {
    name: 'giveaway',
    aliases: ['gw', 'giveway', 'concours'],
    description: '🎁 ARCHON Classified Giveaway Protocol',
    category: 'ECONOMY',
    cooldown: 5000,
    init: init,

    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎁 Manage giveaways')
        .addSubcommand(sub => sub.setName('start').setDescription('Open the live dashboard to create a giveaway'))
        .addSubcommand(sub => sub
            .setName('end')
            .setDescription('End a giveaway early')
            .addStringOption(opt => opt.setName('message_id').setDescription('The message ID of the giveaway').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('reroll')
            .setDescription('Reroll winners for an ended custom prize giveaway')
            .addStringOption(opt => opt.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('cancel')
            .setDescription('Cancel a running giveaway and refund the host')
            .addStringOption(opt => opt.setName('message_id').setDescription('The message ID of the giveaway').setRequired(false))
        ),

    run: async (client, message, args, dbArg) => {
        const db = dbArg || client.db;
        init(client, db);
        
        const guildId = message.guild?.id ?? 'DM';
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ You need Manage Server permission.').catch(() => {});
        }
        const usage = '`.giveaway <time> <amount> <winners> <prize>`\nExample: `.giveaway 1h 50000 3 Neural Credits Drop`';
        if (args.length < 4) return message.reply(usage).catch(() => {});

        const duration = parseDuration(args[0]);
        if (!duration) return message.reply('❌ Invalid time. Use: `10s`, `5m`, `2h`, `1d`').catch(() => {});
        const amount = parseInt(args[1]);
        const winners = parseInt(args[2]);
        const prize = args.slice(3).join(' ');
        if (isNaN(amount) || amount < 100) return message.reply('❌ Invalid amount (min 100).').catch(() => {});
        if (isNaN(winners) || winners < 1 || winners > 20) return message.reply('❌ Winners must be 1-20.').catch(() => {});

        const user = db.prepare('SELECT credits FROM users WHERE id = ? AND guild_id = ?').get(message.author.id, guildId);
        if (!user || user.credits < amount) {
            return message.reply(`❌ You do not have enough credits to host this giveaway. You have ${user?.credits?.toLocaleString() || 0}, need ${amount.toLocaleString()}.`).catch(() => {});
        }
        
        db.prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ?').run(amount, message.author.id, guildId);

        await startGiveaway({
            client, db,
            hostId: message.author.id, hostName: message.author.username,
            guildId, channel: message.channel,
            amount, prizeName: prize, winners, duration,
            minLevel: 0, minCredits: 0, boosterBonus: false
        });
    },

    execute: async (interaction, client, dbArg) => {
        const db = dbArg || client.db;
        init(client, db);

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '❌ You need Manage Server permission.', flags: 64 });
        }

        if (sub === 'end') {
            const msgId = interaction.options.getString('message_id');
            let gw;
            if (msgId) {
                gw = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(msgId, guildId);
            } else {
                gw = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND status = ? ORDER BY end_timestamp ASC LIMIT 1').get(guildId, 'active');
            }

            if (!gw) return interaction.reply({ content: '❌ No active giveaway found.', flags: 64 });
            if (interaction.user.id !== gw.host_id && !interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({ content: '❌ Only the host or moderators can end this.', flags: 64 });
            }

            await interaction.deferReply({ flags: 64 });
            await endGiveawayDb(gw.id, client, db);
            await interaction.editReply({ content: '✅ Giveaway ended.' });
        }
        else if (sub === 'reroll') {
            const msgId = interaction.options.getString('message_id');
            const gw = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(msgId, guildId);
            if (!gw || gw.status !== 'ended') {
                return interaction.reply({ content: '❌ Ended giveaway not found.', flags: 64 });
            }
            if (gw.amount > 0) {
                return interaction.reply({ content: '❌ Reroll is only available for custom prizes.', flags: 64 });
            }
            if (interaction.user.id !== gw.host_id && !interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({ content: '❌ Only the host or moderators can reroll.', flags: 64 });
            }

            await interaction.deferReply({ flags: 64 });
            const newWinners = await rerollGiveaway(gw.id, client, db);
            if (newWinners) {
                await interaction.editReply({ content: '✅ Rerolled successfully!' });
            } else {
                await interaction.editReply({ content: '❌ Failed to reroll.' });
            }
        }
        else if (sub === 'cancel') {
            const msgId = interaction.options.getString('message_id');
            let gw;
            if (msgId) {
                gw = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(msgId, guildId);
            } else {
                gw = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND status = ? ORDER BY end_timestamp ASC LIMIT 1').get(guildId, 'active');
            }

            if (!gw) return interaction.reply({ content: '❌ No active giveaway found.', flags: 64 });
            if (interaction.user.id !== gw.host_id && !interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({ content: '❌ Only the host or moderators can cancel this.', flags: 64 });
            }

            await interaction.deferReply({ flags: 64 });

            if (gw.amount > 0) {
                const user = db.prepare('SELECT id FROM users WHERE id = ? AND guild_id = ?').get(gw.host_id, gw.guild_id);
                if (!user) {
                    db.prepare('INSERT INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, ?)').run(gw.host_id, gw.guild_id, 'Agent', gw.amount);
                } else {
                    db.prepare('UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?').run(gw.amount, gw.host_id, gw.guild_id);
                }
            }

            db.prepare('UPDATE giveaways SET status = ? WHERE id = ?').run('cancelled', gw.id);
            
            const channel = await client.channels.fetch(gw.channel_id).catch(() => null);
            const msg = await channel?.messages.fetch(gw.message_id).catch(() => null);
            if (msg) {
                const c = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ❌ Giveaway Cancelled\nThis giveaway was cancelled by the host.`));
                await msg.edit({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }

            await interaction.editReply({ content: '✅ Giveaway cancelled and credits refunded.' });
        }
        else if (sub === 'start') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

            const guild = interaction.guild;
            const lang = getLang(client, guild.id);
            const t = (k, v) => i18n.t('giveaway.' + k, lang, v);

            const session = {
                prizeType: 'credits',
                amount: 50000,
                prizeName: '',
                durationStr: '2h',
                durationMs: 2 * 60 * 60 * 1000,
                winners: 3,
                channelId: interaction.channel.id,
                minLevel: 0,
                minCredits: 0,
                boosterBonus: false
            };

            const buildDashboard = () => {
                const c = new ContainerBuilder().setAccentColor(0xf1c40f);

                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${t('mockSetupTitle')}`));
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${t('mockSetupDesc')}`));
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Prize Type
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockPrizeType')}**`));
                c.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('gw_type_credits').setLabel(t('mockCredits')).setStyle(session.prizeType === 'credits' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('gw_type_custom').setLabel(t('mockCustom')).setStyle(session.prizeType === 'custom' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                ));
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Amount / Prize Name
                if (session.prizeType === 'credits') {
                    const each = session.winners > 0 ? Math.floor(session.amount / session.winners) : 0;
                    c.addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockAmount')}**\n${session.amount.toLocaleString()} credits, ${each.toLocaleString()} each`))
                            .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_amount').setLabel('Edit').setStyle(ButtonStyle.Secondary))
                    );
                } else {
                    c.addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockCustom')}**\n${session.prizeName || 'Not set'}`))
                            .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_custom_name').setLabel('Edit').setStyle(ButtonStyle.Secondary))
                    );
                }
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Duration
                c.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockDuration')}**\n${session.durationStr}`))
                        .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_dur').setLabel('Edit').setStyle(ButtonStyle.Secondary))
                );
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Winners
                c.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockWinners')}**\n${session.winners}`))
                        .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_win').setLabel('Edit').setStyle(ButtonStyle.Secondary))
                );
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Channel
                c.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockChannel')}**\n<#${session.channelId}>`))
                        .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_channel').setLabel('Edit').setStyle(ButtonStyle.Secondary))
                );
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Requirements
                let reqText = '';
                if (session.minLevel > 0) reqText += `Level ${session.minLevel}+, `;
                if (session.boosterBonus) reqText += `boosters get double entries`;
                if (session.minLevel === 0 && !session.boosterBonus) reqText += `None`;
                
                c.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockReqs')}**\n${reqText.trim()}`))
                        .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_reqs').setLabel('Edit').setStyle(ButtonStyle.Secondary))
                );
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Disclaimer & Launch
                if (session.prizeType === 'credits') {
                     c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('mockDisclaimer', { amount: session.amount.toLocaleString() })));
                }
                
                const rowLaunch = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('gw_launch').setLabel('Launch giveaway').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('gw_cancel_setup').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                );
                c.addActionRowComponents(rowLaunch);

                return { components: [c], flags: MessageFlags.IsComponentsV2 };
            };

            await interaction.editReply(buildDashboard());
            const msg = await interaction.fetchReply();

            const collector = msg.createMessageComponentCollector({ time: 15 * 60 * 1000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'Not your setup.', flags: 64 }).catch(() => {});
                }

                try {
                    if (i.customId === 'gw_cancel_setup') {
                        collector.stop();
                        const c = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(t('dashExpired') || 'Setup cancelled.'));
                        return await i.update({ components: [c], flags: MessageFlags.IsComponentsV2 });
                    }

                    if (i.customId === 'gw_type_credits') {
                        session.prizeType = 'credits';
                        return await i.update(buildDashboard());
                    }
                    if (i.customId === 'gw_type_custom') {
                        session.prizeType = 'custom';
                        return await i.update(buildDashboard());
                    }

                    if (i.customId === 'gw_set_channel') {
                        const channelSelect = new ChannelSelectMenuBuilder()
                            .setCustomId('gw_channel_select')
                            .setPlaceholder('Select a channel')
                            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

                        await i.reply({ components: [new ActionRowBuilder().addComponents(channelSelect)], flags: 64 });

                        const res = await i.channel.awaitMessageComponent({
                            filter: x => x.user.id === interaction.user.id && x.customId === 'gw_channel_select',
                            time: 60000
                        }).catch(() => null);

                        if (res) {
                            session.channelId = res.values[0];
                            await res.update({ content: '✅ Channel updated!', components: [] });
                            await msg.edit(buildDashboard());
                        }
                        return;
                    }

                    if (i.customId === 'gw_set_amount') {
                        const modal = new ModalBuilder().setCustomId('modal_amount').setTitle('Set Amount')
                            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Amount').setPlaceholder('e.g. 50000').setStyle(TextInputStyle.Short).setRequired(true)));
                        await i.showModal(modal);
                        const res = await i.awaitModalSubmit({ time: 60000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
                        if (res) {
                            const val = parseInt(res.fields.getTextInputValue('val'));
                            if (isNaN(val) || val < 100) { await res.reply({ content: '❌ Invalid amount (min 100).', flags: 64 }); return; }
                            session.amount = val;
                            await res.update(buildDashboard());
                        }
                        return;
                    }
                    
                    if (i.customId === 'gw_set_custom_name') {
                        const modal = new ModalBuilder().setCustomId('modal_name').setTitle('Set Prize Name')
                            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Prize Name').setStyle(TextInputStyle.Short).setRequired(true)));
                        await i.showModal(modal);
                        const res = await i.awaitModalSubmit({ time: 60000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
                        if (res) {
                            session.prizeName = res.fields.getTextInputValue('val');
                            await res.update(buildDashboard());
                        }
                        return;
                    }

                    if (i.customId === 'gw_set_dur') {
                        const modal = new ModalBuilder().setCustomId('modal_dur').setTitle('Set Duration')
                            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Duration').setPlaceholder('e.g. 2h, 30m, 1d').setStyle(TextInputStyle.Short).setRequired(true)));
                        await i.showModal(modal);
                        const res = await i.awaitModalSubmit({ time: 60000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
                        if (res) {
                            const val = res.fields.getTextInputValue('val');
                            const ms = parseDuration(val);
                            if (!ms) { await res.reply({ content: '❌ Invalid duration. Use 10s, 5m, 2h, 1d.', flags: 64 }); return; }
                            session.durationStr = val;
                            session.durationMs = ms;
                            await res.update(buildDashboard());
                        }
                        return;
                    }

                    if (i.customId === 'gw_set_win') {
                        const modal = new ModalBuilder().setCustomId('modal_win').setTitle('Set Winners')
                            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Number of Winners').setStyle(TextInputStyle.Short).setRequired(true)));
                        await i.showModal(modal);
                        const res = await i.awaitModalSubmit({ time: 60000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
                        if (res) {
                            const val = parseInt(res.fields.getTextInputValue('val'));
                            if (isNaN(val) || val < 1 || val > 20) { await res.reply({ content: '❌ Winners must be 1-20.', flags: 64 }); return; }
                            session.winners = val;
                            await res.update(buildDashboard());
                        }
                        return;
                    }
                    
                    if (i.customId === 'gw_set_reqs') {
                        const modal = new ModalBuilder().setCustomId('modal_reqs').setTitle('Set Requirements')
                            .addComponents(
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('level').setLabel('Minimum Level (0 for none)').setValue(String(session.minLevel)).setStyle(TextInputStyle.Short).setRequired(true)),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('booster').setLabel('Boosters get 2x entries? (yes/no)').setValue(session.boosterBonus ? 'yes' : 'no').setStyle(TextInputStyle.Short).setRequired(true))
                            );
                        await i.showModal(modal);
                        const res = await i.awaitModalSubmit({ time: 60000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
                        if (res) {
                            const lvl = parseInt(res.fields.getTextInputValue('level'));
                            if (!isNaN(lvl) && lvl >= 0) session.minLevel = lvl;
                            const bst = res.fields.getTextInputValue('booster').toLowerCase();
                            session.boosterBonus = bst === 'yes' || bst === 'y' || bst === 'true';
                            await res.update(buildDashboard());
                        }
                        return;
                    }

                    if (i.customId === 'gw_launch') {
                        if (session.prizeType === 'credits') {
                            const user = db.prepare('SELECT credits FROM users WHERE id = ? AND guild_id = ?').get(interaction.user.id, guild.id);
                            if (!user || user.credits < session.amount) {
                                return await i.reply({ content: `❌ You don't have enough credits. You have ${user?.credits?.toLocaleString() || 0}, need ${session.amount.toLocaleString()}.`, flags: 64 });
                            }
                        } else {
                            if (!session.prizeName) {
                                return await i.reply({ content: '❌ Please set a custom prize name.', flags: 64 });
                            }
                        }

                        const targetChannel = guild.channels.cache.get(session.channelId);
                        if (!targetChannel) {
                            return await i.reply({ content: '❌ The selected channel no longer exists.', flags: 64 });
                        }
                        
                        await i.deferUpdate();
                        collector.stop();

                        if (session.prizeType === 'credits') {
                            db.prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ?').run(session.amount, interaction.user.id, guild.id);
                        }

                        await startGiveaway({
                            client, db,
                            hostId: interaction.user.id,
                            hostName: interaction.user.username,
                            guildId: guild.id,
                            channel: targetChannel,
                            amount: session.prizeType === 'credits' ? session.amount : 0,
                            prizeName: session.prizeType === 'custom' ? session.prizeName : '',
                            winners: session.winners,
                            duration: session.durationMs,
                            minLevel: session.minLevel,
                            minCredits: session.minCredits,
                            boosterBonus: session.boosterBonus
                        });

                        const c = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('✅ Giveaway launched!'));
                        await i.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
                    }
                } catch (err) {
                    console.error('[DASHBOARD ERROR]', err);
                    if (!i.replied && !i.deferred) await i.reply({ content: '⚠️ Error.', flags: 64 }).catch(() => {});
                }
            });
        }
    },
};
