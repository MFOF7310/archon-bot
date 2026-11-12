const { resolveEmoji } = require('../lib/emoji-resolver');
const i18n = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, ChannelSelectMenuBuilder, ChannelType, ThumbnailBuilder } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const { toV2 } = require('../lib/v2convert');   // classic embeds -> Components V2 cards

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

// Boosters have two tickets: they are more likely to win, but nobody can win twice
// (the same person used to be drawn twice and paid twice, leaving fewer winners)
function selectWinners(entries, count) {
    const pool = [...entries], out = [];
    while (pool.length && out.length < count) {
        const pick = pool[require('crypto').randomInt(pool.length)];
        out.push(pick);
        for (let i = pool.length - 1; i >= 0; i--) if (pool[i] === pick) pool.splice(i, 1);
    }
    return out;
}

// Credits go through the bot's cache-aware helpers: writing the users table directly was undone by the next cache flush
const pay = (client, uid, gid, n) => { if (n > 0) client.addCredits?.(uid, gid, n); };
const charge = (client, uid, gid, n) => client.removeCredits ? client.removeCredits(uid, gid, n) : { ok: false };
const people = (db, id) => db.prepare('SELECT COUNT(DISTINCT user_id) AS c FROM giveaway_entries WHERE giveaway_id = ?').get(id).c;

// The card is edited at most once every 4 s per giveaway, so 100 people entering at once don't hit Discord's limits
const _pendingEdit = new Map();
function refreshCardSoon(id, client, db) {
    if (_pendingEdit.has(id)) return;
    _pendingEdit.set(id, setTimeout(async () => {
        _pendingEdit.delete(id);
        const gw = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
        if (!gw || gw.status !== 'active') return;
        const channel = await client.channels.fetch(gw.channel_id).catch(() => null);
        const msg = await channel?.messages.fetch(gw.message_id).catch(() => null);
        if (!msg) return;
        const hostUser = await client.users.fetch(gw.host_id).catch(() => null);
        await msg.edit(buildGiveawayCard({
            id: gw.id, guildId: gw.guild_id, channelId: gw.channel_id, messageId: gw.message_id, hostId: gw.host_id,
            hostName: hostUser ? hostUser.username : 'Host', prize: gw.prize, amount: gw.amount, winners: gw.winners,
            minLevel: gw.min_level, minCredits: gw.min_credits, boosterBonus: gw.booster_bonus === 1, status: 'active',
            endTimestamp: gw.end_timestamp, entryCount: people(db, gw.id),
        }, client)).catch(() => {});
    }, 4000));
}

// getLang removed in favor of pickLang

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
                const lang = pickLang(client, gw?.guild_id || interaction.guildId, interaction);
                const t = (k, v) => i18n.t('giveaway.' + k, lang, v);

                if (!gw || gw.status !== 'active') {
                    return interaction.reply({ content: t('endedError'), flags: 64 });
                }

                const userEntries = db.prepare('SELECT id FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').all(id, interaction.user.id);
                
                if (gw.host_id === interaction.user.id) {
                    return interaction.reply({ content: t('cantEnter'), flags: 64 });
                }
                if (userEntries.length > 0) {
                    return interaction.reply({ content: t('alreadyIn'), flags: 64 });
                }

                const user = client.userDataCache?.get(`${interaction.user.id}:${gw.guild_id}`) || db.prepare('SELECT level, credits FROM users WHERE id = ? AND guild_id = ?').get(interaction.user.id, gw.guild_id);
                if (gw.min_level > 0 && (!user || user.level < gw.min_level)) {
                    return interaction.reply({ content: t('needLevel').replace('{level}', gw.min_level), flags: 64 });
                }
                if (gw.min_credits > 0 && (!user || user.credits < gw.min_credits)) {
                    return interaction.reply({ content: t('needCredits').replace('{credits}', gw.min_credits.toLocaleString()), flags: 64 });
                }

                // Add entry
                db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(id, interaction.user.id);
                
                const isBooster = interaction.member?.premiumSince != null;
                if (gw.booster_bonus === 1 && isBooster) {
                    db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(id, interaction.user.id);
                }

                refreshCardSoon(id, client, db);

                await interaction.reply({ content: t('enterOk'), flags: 64 });
            } catch (e) {
                console.error('[GIVEAWAY BUTTON]', e);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: i18n.t('genericError', pickLang(client, interaction.guildId, interaction)), flags: 64 }).catch(() => {});
                }
            }
        });
    }
}

// ═══════════════════════════════════════════════════════
// BUILD GIVEAWAY CARD (PUBLIC)
// ═══════════════════════════════════════════════════════
function buildGiveawayCard(gw, client) {
    const lang = pickLang(client, gw.guildId, null);
    const t = (k, v) => i18n.t('giveaway.' + k, lang, v);
    const entries = gw.entryCount ?? (gw.entries ? new Set(gw.entries).size : 0);
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
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`🏆 ${t('gxWinnersN', { n: gw.winners })}`));
        }
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`👥 ${t('mockPeopleEntered', { count: entries })}`));
        
        let reqText = '';
        if (gw.minLevel > 0) reqText += t('gxNeedsLevel', { n: gw.minLevel }) + ' ';
        if (gw.boosterBonus) reqText += t('gxBoosters');
        if (reqText) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`🔒 ${reqText.trim()}`));
        
        c.addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gw_enter_${gw.id}`).setLabel(t('mockEnterBtn')).setStyle(ButtonStyle.Primary)
        ));
    } else {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('gxWinnersTitle')}**`));
        const paidEach = gw.each ?? each;
        const winText = (gw.winnersList || []).map((uid) => `🏆 <@${uid}>${gw.amount > 0 ? ` · +${paidEach.toLocaleString()} ${t('gxCredits')}` : ''}`).join('\n');
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(winText || t('gxNoEntries')));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('mockEntriesHosted', { count: entries, host: gw.hostName })}`));
        
        // NO BUTTONS on ended cards, as requested in the mockup.
    }

    return { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
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

    const lang = pickLang(client, gwRow.guild_id, null);
    const t = (k, v) => i18n.t('giveaway.' + k, lang, v);
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
        lang: lang,
        entries: entries,
        winnersList: winners
    };

    // Fewer people than winners: the pot is split between those who entered, nothing is lost.
    // Nobody entered: the host gets the credits back (they used to vanish).
    const each = winners.length ? Math.floor(gw.amount / winners.length) : 0;
    if (gw.amount > 0) {
        if (winners.length) for (const uid of winners) pay(client, uid, gw.guildId, each);
        else pay(client, gw.hostId, gw.guildId, gw.amount);
    }
    gw.each = each;

    try {
        const channel = await client.channels.fetch(gw.channelId).catch(() => null);
        if (!channel) {
            // the giveaway's channel was deleted: the winners still got their credits, the admins get told (lib/postProblems)
            const _g = client.guilds.cache.get(gw.guildId);
            if (_g) require('../lib/postProblems').failed(_g, 'giveaway', gw.channelId, { ok: false, reason: 'gone', missing: [] });
            return;
        }
        const msg = await channel.messages.fetch(gw.messageId).catch(() => null);
        if (!msg) return;

        const card = buildGiveawayCard(gw, client);
        await msg.edit(card).catch(() => {});

        if (winners.length > 0) {
            const mention = winners.map(w => `<@${w}>`).join(' ');
            const prizeTxt = gw.amount > 0 ? t('gxCreditsDrop', { n: gw.amount.toLocaleString() }) : gw.prize;
            await require('../lib/safeSend').safeSend('giveaway', channel, {
                content: `🎊 ${t('gxCongrats', { users: mention, prize: prizeTxt })}${gw.amount > 0 ? `\n-# ${t('gxEachPaid', { n: each.toLocaleString() })}` : ''}`,
                allowedMentions: { users: winners },
            });

            for (const uid of winners) {
                const user = await client.users.fetch(uid).catch(() => null);
                if (!user) continue;
                const guildName = client.guilds.cache.get(gw.guildId)?.name || '';
                const dm = new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setTitle(`🎊 ${t('gxDmTitle')}`)
                    .setDescription(gw.amount > 0
                        ? t('gxDmCredits', { n: each.toLocaleString(), server: guildName })
                        : t('gxDmPrize', { prize: gw.prize, server: guildName, host: gw.hostName }));
                await user.send(toV2({ embeds: [dm] })).catch(() => {});
            }
        } else {
            await require('../lib/safeSend').safeSend('giveaway', channel, { content: t(gw.amount > 0 ? 'gxNobodyRefund' : 'gxNobody'), allowedMentions: { parse: [] } });
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

    const lang = pickLang(client, gwRow.guild_id, null);
    const t = (k, v) => i18n.t('giveaway.' + k, lang, v);
    const hostUser = await client.users.fetch(gwRow.host_id).catch(() => null);
    const gw = { ...gwRow, entries, winnersList: winners, status: 'ended', endTimestamp: gwRow.end_timestamp, hostName: hostUser ? hostUser.username : 'Host', lang: lang };

    const card = buildGiveawayCard(gw, client);
    await msg.edit(card).catch(() => {});

    const mention = winners.map(w => `<@${w}>`).join(' ');
    await channel.send({ content: `🔄 ${t('gxRerolled', { users: mention || '—' })}`, allowedMentions: { users: winners } }).catch(() => {});

    return winners;
}

async function startGiveaway({ client, db, hostId, hostName, guildId, channel, amount, prizeName, winners, duration, minLevel, minCredits, boosterBonus }) {
    const id = `${guildId}_${Date.now()}`;
    const endTimestamp = Date.now() + duration;
    const lang = pickLang(client, guildId, null);
    
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
    description: '🎁 Run a credits giveaway',
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
        
        if (!message.guild) return;
        const guildId = message.guild.id;
        const tp = (k, v) => i18n.t('giveaway.' + k, pickLang(client, guildId, null, message.author.id), v);
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply(em('ic_off', '❌') + ' ' + tp('gxNeedPerm')).catch(() => {});
        }
        const usage = tp('gxUsage');
        if (args.length < 4) return message.reply(usage).catch(() => {});

        const duration = parseDuration(args[0]);
        if (!duration) return message.reply(em('ic_off', '❌') + ' ' + tp('gxBadTime')).catch(() => {});
        const amount = parseInt(args[1]);
        const winners = parseInt(args[2]);
        const prize = args.slice(3).join(' ');
        if (isNaN(amount) || amount < 100) return message.reply(em('ic_off', '❌') + ' ' + tp('gxBadAmount')).catch(() => {});
        if (isNaN(winners) || winners < 1 || winners > 20) return message.reply(em('ic_off', '❌') + ' ' + tp('gxBadWinners')).catch(() => {});

        const paid = charge(client, message.author.id, guildId, amount);
        if (!paid.ok) {
            return message.reply(`${em('ic_off', '❌')} ${tp('noCredits', { have: (paid.previous || 0).toLocaleString(), need: amount.toLocaleString() })}`).catch(() => {});
        }

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
        const tt = (k, v) => i18n.t('giveaway.' + k, pickLang(client, guildId, interaction, interaction.user.id), v);
        const no = (k) => ({ content: em('ic_off', '❌') + ' ' + tt(k), flags: 64 });

        if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply(no('gxNeedPerm'));
        }

        if (sub === 'end') {
            const msgId = interaction.options.getString('message_id');
            let gw;
            if (msgId) {
                gw = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(msgId, guildId);
            } else {
                gw = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND status = ? ORDER BY end_timestamp ASC LIMIT 1').get(guildId, 'active');
            }

            if (!gw) return interaction.reply(no('gxNoneActive'));
            if (interaction.user.id !== gw.host_id && !interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply(no('gxOnlyHost'));
            }

            await interaction.deferReply({ flags: 64 });
            await endGiveawayDb(gw.id, client, db);
            await interaction.editReply({ content: em('ic_ok', '✅') + ' ' + tt('gxEndedOk') });
        }
        else if (sub === 'reroll') {
            const msgId = interaction.options.getString('message_id');
            const gw = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(msgId, guildId);
            if (!gw || gw.status !== 'ended') {
                return interaction.reply(no('gxNoneEnded'));
            }
            if (gw.amount > 0) {
                return interaction.reply(no('gxRerollCustom'));
            }
            if (interaction.user.id !== gw.host_id && !interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply(no('gxOnlyHost'));
            }

            await interaction.deferReply({ flags: 64 });
            const newWinners = await rerollGiveaway(gw.id, client, db);
            if (newWinners) {
                await interaction.editReply({ content: em('ic_ok', '✅') + ' ' + tt('gxRerollOk') });
            } else {
                await interaction.editReply(no('gxRerollFail'));
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

            if (!gw) return interaction.reply(no('gxNoneActive'));
            if (interaction.user.id !== gw.host_id && !interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply(no('gxOnlyHost'));
            }

            await interaction.deferReply({ flags: 64 });

            if (gw.status !== 'active') return interaction.editReply({ content: em('ic_off', '❌') + ' ' + tt('gxNoneActive') });
            db.prepare('UPDATE giveaways SET status = ? WHERE id = ?').run('cancelled', gw.id);
            if (gw.amount > 0) pay(client, gw.host_id, gw.guild_id, gw.amount);
            
            const channel = await client.channels.fetch(gw.channel_id).catch(() => null);
            const msg = await channel?.messages.fetch(gw.message_id).catch(() => null);
            if (msg) {
                const c = new ContainerBuilder().setAccentColor(0x95a5a6).addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${gw.amount > 0 ? tt('gxCreditsDrop', { n: gw.amount.toLocaleString() }) : gw.prize}\n${tt('gxCancelledCard')}`));
                await msg.edit({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }

            await interaction.editReply({ content: em('ic_ok', '✅') + ' ' + tt(gw.amount > 0 ? 'gxCancelledRefund' : 'gxCancelledOk') });
        }
        else if (sub === 'start') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

            const guild = interaction.guild;
            const lang = pickLang(client, guild.id, interaction);
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
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockAmount')}**\n${t('gxAmountEach', { n: session.amount.toLocaleString(), each: each.toLocaleString() })}`))
                            .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_amount').setLabel(t('gxEdit')).setStyle(ButtonStyle.Secondary))
                    );
                } else {
                    c.addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockCustom')}**\n${session.prizeName || t('gxNotSet')}`))
                            .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_custom_name').setLabel(t('gxEdit')).setStyle(ButtonStyle.Secondary))
                    );
                }
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Duration
                c.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockDuration')}**\n${session.durationStr}`))
                        .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_dur').setLabel(t('gxEdit')).setStyle(ButtonStyle.Secondary))
                );
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Winners
                c.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockWinners')}**\n${session.winners}`))
                        .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_win').setLabel(t('gxEdit')).setStyle(ButtonStyle.Secondary))
                );
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Channel
                c.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockChannel')}**\n<#${session.channelId}>`))
                        .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_channel').setLabel(t('gxEdit')).setStyle(ButtonStyle.Secondary))
                );
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Requirements
                let reqText = '';
                if (session.minLevel > 0) reqText += t('gxNeedsLevel', { n: session.minLevel }) + ' ';
                if (session.boosterBonus) reqText += t('gxBoosters');
                if (session.minLevel === 0 && !session.boosterBonus) reqText += t('gxNone');
                
                c.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('mockReqs')}**\n${reqText.trim()}`))
                        .setButtonAccessory(new ButtonBuilder().setCustomId('gw_set_reqs').setLabel(t('gxEdit')).setStyle(ButtonStyle.Secondary))
                );
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

                // Disclaimer & Launch
                if (session.prizeType === 'credits') {
                     c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('mockDisclaimer', { amount: session.amount.toLocaleString() })));
                }
                
                const rowLaunch = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('gw_launch').setLabel(t('gxLaunch')).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('gw_cancel_setup').setLabel(t('gxCancel')).setStyle(ButtonStyle.Secondary)
                );
                c.addActionRowComponents(rowLaunch);

                return { components: [c], flags: MessageFlags.IsComponentsV2 };
            };

            await interaction.editReply(buildDashboard());
            const msg = await interaction.fetchReply();

            const collector = msg.createMessageComponentCollector({ time: 15 * 60 * 1000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: t('gxNotYours'), flags: 64 }).catch(() => {});
                }

                try {
                    if (i.customId === 'gw_cancel_setup') {
                        collector.stop();
                        const c = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(t('gxSetupCancelled')));
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
                            .setPlaceholder(t('gxPickChannel'))
                            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

                        await i.reply({ components: [new ActionRowBuilder().addComponents(channelSelect)], flags: 64 });

                        const res = await i.channel.awaitMessageComponent({
                            filter: x => x.user.id === interaction.user.id && x.customId === 'gw_channel_select',
                            time: 60000
                        }).catch(() => null);

                        if (res) {
                            session.channelId = res.values[0];
                            await res.update({ content: em('ic_ok', '✅') + ' ' + t('gxChannelOk'), components: [] });
                            await msg.edit(buildDashboard());
                        }
                        return;
                    }

                    if (i.customId === 'gw_set_amount') {
                        const modal = new ModalBuilder().setCustomId('modal_amount').setTitle(t('mockAmount').slice(0, 45))
                            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel(t('mockAmount').slice(0, 45)).setPlaceholder('50000').setStyle(TextInputStyle.Short).setRequired(true)));
                        await i.showModal(modal);
                        const res = await i.awaitModalSubmit({ time: 60000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
                        if (res) {
                            const val = parseInt(res.fields.getTextInputValue('val'));
                            if (isNaN(val) || val < 100) { await res.reply({ content: em('ic_off', '❌') + ' ' + t('gxBadAmount'), flags: 64 }); return; }
                            session.amount = val;
                            await res.update(buildDashboard());
                        }
                        return;
                    }
                    
                    if (i.customId === 'gw_set_custom_name') {
                        const modal = new ModalBuilder().setCustomId('modal_name').setTitle(t('mockCustom').slice(0, 45))
                            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel(t('mockCustom').slice(0, 45)).setMaxLength(100).setStyle(TextInputStyle.Short).setRequired(true)));
                        await i.showModal(modal);
                        const res = await i.awaitModalSubmit({ time: 60000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
                        if (res) {
                            session.prizeName = res.fields.getTextInputValue('val');
                            await res.update(buildDashboard());
                        }
                        return;
                    }

                    if (i.customId === 'gw_set_dur') {
                        const modal = new ModalBuilder().setCustomId('modal_dur').setTitle(t('mockDuration').slice(0, 45))
                            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel(t('mockDuration').slice(0, 45)).setPlaceholder('2h · 30m · 1d').setStyle(TextInputStyle.Short).setRequired(true)));
                        await i.showModal(modal);
                        const res = await i.awaitModalSubmit({ time: 60000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
                        if (res) {
                            const val = res.fields.getTextInputValue('val');
                            const ms = parseDuration(val);
                            if (!ms) { await res.reply({ content: em('ic_off', '❌') + ' ' + t('gxBadTime'), flags: 64 }); return; }
                            session.durationStr = val;
                            session.durationMs = ms;
                            await res.update(buildDashboard());
                        }
                        return;
                    }

                    if (i.customId === 'gw_set_win') {
                        const modal = new ModalBuilder().setCustomId('modal_win').setTitle(t('mockWinners').slice(0, 45))
                            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel(t('mockWinners').slice(0, 45)).setPlaceholder('1-20').setStyle(TextInputStyle.Short).setRequired(true)));
                        await i.showModal(modal);
                        const res = await i.awaitModalSubmit({ time: 60000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
                        if (res) {
                            const val = parseInt(res.fields.getTextInputValue('val'));
                            if (isNaN(val) || val < 1 || val > 20) { await res.reply({ content: em('ic_off', '❌') + ' ' + t('gxBadWinners'), flags: 64 }); return; }
                            session.winners = val;
                            await res.update(buildDashboard());
                        }
                        return;
                    }
                    
                    if (i.customId === 'gw_set_reqs') {
                        const modal = new ModalBuilder().setCustomId('modal_reqs').setTitle(t('mockReqs').slice(0, 45))
                            .addComponents(
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('level').setLabel(t('gxMinLevel').slice(0, 45)).setValue(String(session.minLevel)).setStyle(TextInputStyle.Short).setRequired(true)),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('booster').setLabel(t('gxBoosterQ').slice(0, 45)).setValue(session.boosterBonus ? t('gxYes') : t('gxNo')).setStyle(TextInputStyle.Short).setRequired(true))
                            );
                        await i.showModal(modal);
                        const res = await i.awaitModalSubmit({ time: 60000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
                        if (res) {
                            const lvl = parseInt(res.fields.getTextInputValue('level'));
                            if (!isNaN(lvl) && lvl >= 0) session.minLevel = lvl;
                            const bst = res.fields.getTextInputValue('booster').toLowerCase();
                            session.boosterBonus = ['yes', 'y', 'true', 'oui', 'o', '是', 'نعم', '1'].includes(bst.trim());
                            await res.update(buildDashboard());
                        }
                        return;
                    }

                    if (i.customId === 'gw_launch') {
                        if (session.prizeType === 'credits') {
                            const have = (client.userDataCache?.get(`${interaction.user.id}:${guild.id}`) || db.prepare('SELECT credits FROM users WHERE id = ? AND guild_id = ?').get(interaction.user.id, guild.id))?.credits || 0;
                            if (have < session.amount) {
                                return await i.reply({ content: `${em('ic_off', '❌')} ${t('noCredits', { have: have.toLocaleString(), need: session.amount.toLocaleString() })}`, flags: 64 });
                            }
                        } else {
                            if (!session.prizeName) {
                                return await i.reply({ content: em('ic_off', '❌') + ' ' + t('gxNeedPrize'), flags: 64 });
                            }
                        }

                        const targetChannel = guild.channels.cache.get(session.channelId);
                        if (!targetChannel) {
                            return await i.reply({ content: em('ic_off', '❌') + ' ' + t('gxChannelGone'), flags: 64 });
                        }
                        
                        await i.deferUpdate();
                        collector.stop();

                        if (session.prizeType === 'credits') {
                            const paid = charge(client, interaction.user.id, guild.id, session.amount);
                            if (!paid.ok) return await i.editReply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`${em('ic_off', '❌')} ${t('noCredits', { have: (paid.previous || 0).toLocaleString(), need: session.amount.toLocaleString() })}`))], flags: MessageFlags.IsComponentsV2 });
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

                        const c = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(em('ic_ok', '✅') + ' ' + t('gxLaunched')));
                        await i.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
                    }
                } catch (err) {
                    console.error('[DASHBOARD ERROR]', err);
                    if (!i.replied && !i.deferred) await i.reply({ content: i18n.t('genericError', lang), flags: 64 }).catch(() => {});
                }
            });
        }
    },
};
