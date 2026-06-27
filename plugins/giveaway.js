const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionsBitField } = require('discord.js');

// ═══════════════════════════════════════════════════════
// ARCHON CLASSIFIED GIVEAWAY PROTOCOL v2.0
// ═══════════════════════════════════════════════════════
const ARCHON = {
    green: 0x2ecc71, red: 0xe74c3c, gold: 0xf1c40f,
    purple: 0x9b59b6, cyan: 0x00f0ff, orange: 0xe67e22,
    neural: 0x00ff88, steel: 0x708090,
};

// ═══════════════════════════════════════════════════════
// TRANSLATIONS
// ═══════════════════════════════════════════════════════
const T = {
    en: {
        title: 'CLASSIFIED DROP',
        active: '🟢 LIVE',
        ended: '🔴 TERMINATED',
        enter: '🎉 Enter Protocol',
        withdraw: '🚪 Withdraw',
        reroll: '🔄 Reroll',
        terminate: '🗑️ Terminate',
        hostedBy: 'HOST AGENT',
        winners: 'WINNERS',
        entries: 'AGENTS REGISTERED',
        winChance: 'WIN PROBABILITY',
        timeLeft: 'TERMINATES',
        eachWins: 'EACH WINNER RECEIVES',
        pool: 'TOTAL PRIZE POOL',
        requirements: 'ENTRY REQUIREMENTS',
        enterOk: '✅ ENTRY CONFIRMED — Ticket #{ticket} issued. Good luck agent! 🍀',
        leaveOk: '🚪 WITHDRAWAL CONFIRMED — You have exited the protocol.',
        alreadyIn: '⚠️ Already registered in this protocol.',
        notIn: '⚠️ You are not registered in this protocol.',
        cantEnter: '❌ Cannot enter your own giveaway.',
        needLevel: '❌ Minimum level {level} required.',
        needCredits: '❌ Minimum {credits} 🪙 required.',
        noEntries: '❌ No agents participated.',
        winners_announced: '🏆 WINNERS SELECTED',
        rerollOk: '🔄 New winners selected.',
        terminated: '🗑️ Protocol terminated.',
        boosterBonus: '⚡ Server booster — 2x entries applied!',
        footer: 'BAMAKO_223 🇲🇱 • ARCHON CLASSIFIED PROTOCOL',
    },
    fr: {
        title: 'OPÉRATION CLASSIFIÉE',
        active: '🟢 EN COURS',
        ended: '🔴 TERMINÉ',
        enter: '🎉 Rejoindre',
        withdraw: '🚪 Se retirer',
        reroll: '🔄 Nouveau tirage',
        terminate: '🗑️ Terminer',
        hostedBy: 'AGENT HÔTE',
        winners: 'GAGNANTS',
        entries: 'AGENTS INSCRITS',
        winChance: 'PROBABILITÉ',
        timeLeft: 'SE TERMINE',
        eachWins: 'CHAQUE GAGNANT REÇOIT',
        pool: 'PRIZE POOL TOTAL',
        requirements: 'CONDITIONS D\'ENTRÉE',
        enterOk: '✅ INSCRIPTION CONFIRMÉE — Ticket #{ticket} émis. Bonne chance ! 🍀',
        leaveOk: '🚪 RETRAIT CONFIRMÉ — Vous avez quitté le protocole.',
        alreadyIn: '⚠️ Déjà inscrit dans ce protocole.',
        notIn: '⚠️ Vous n\'êtes pas inscrit dans ce protocole.',
        cantEnter: '❌ Vous ne pouvez pas participer à votre propre giveaway.',
        needLevel: '❌ Niveau minimum {level} requis.',
        needCredits: '❌ Minimum {credits} 🪙 requis.',
        noEntries: '❌ Aucun agent n\'a participé.',
        winners_announced: '🏆 GAGNANTS SÉLECTIONNÉS',
        rerollOk: '🔄 Nouveaux gagnants sélectionnés.',
        terminated: '🗑️ Protocole terminé.',
        boosterBonus: '⚡ Booster du serveur — 2x entrées appliquées !',
        footer: 'BAMAKO_223 🇲🇱 • ARCHON PROTOCOLE CLASSIFIÉ',
    }
};

// ═══════════════════════════════════════════════════════
// ACTIVE GIVEAWAYS MAP
// ═══════════════════════════════════════════════════════
const activeGiveaways = new Map();

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

function progressBar(entries, max = 50, len = 16) {
    const fill = max > 0 ? Math.min(len, Math.round((entries / max) * len)) : 0;
    return '▓'.repeat(fill) + '░'.repeat(len - fill);
}

function winChance(entries, winners) {
    if (entries === 0) return 'N/A';
    return `${Math.min(100, ((winners / entries) * 100).toFixed(1))}%`;
}

function getLang(client, guildId) {
    try {
        const ss = client.settings?.get(guildId);
        return ss?.language === 'fr' ? 'fr' : 'en';
    } catch { return 'en'; }
}

// ═══════════════════════════════════════════════════════
// BUILD GIVEAWAY EMBED
// ═══════════════════════════════════════════════════════
function buildEmbed(gw, client) {
    const t = T[gw.lang || 'en'];
    const entries = gw.entries.length;
    const isActive = gw.status === 'active';
    const bar = progressBar(entries, Math.max(entries + 10, 50));
    const chance = winChance(entries, gw.winners);
    const each = Math.floor(gw.amount / gw.winners);
    const statusLine = isActive ? t.active : t.ended;

    const embed = new EmbedBuilder()
        .setColor(isActive ? ARCHON.cyan : ARCHON.steel)
        .setAuthor({
            name: `🦅 ARCHON ENGINE • ${t.title}`,
            iconURL: gw.hostIcon || client.user.displayAvatarURL()
        })
        .setDescription(
            `## 🎁 ${gw.prize}\n` +
            `${statusLine} • Hosted by **${gw.hostName}**\n\n` +
            `\`\`\`ansi\n` +
            `\u001b[1;36m${bar}\u001b[0m \u001b[1;33m${entries} agents\u001b[0m\n` +
            `\`\`\``
        )
        .addFields(
            { name: `⏰ ${t.timeLeft}`, value: `<t:${Math.floor(gw.endTimestamp / 1000)}:R>`, inline: true },
            { name: `🏆 ${t.winners}`, value: `\`${gw.winners}\``, inline: true },
            { name: `🎲 ${t.winChance}`, value: `\`${chance}\``, inline: true },
            { name: `💰 ${t.eachWins}`, value: `\`${each.toLocaleString()} 🪙\``, inline: true },
            { name: `💎 ${t.pool}`, value: `\`${gw.amount.toLocaleString()} 🪙\``, inline: true },
            { name: `👥 ${t.entries}`, value: `\`${entries}\``, inline: true },
        );

    // Requirements
    const reqs = [];
    if (gw.minLevel > 0) reqs.push(`📊 Level ${gw.minLevel}+`);
    if (gw.minCredits > 0) reqs.push(`🪙 ${gw.minCredits.toLocaleString()} credits`);
    if (gw.boosterBonus) reqs.push(`⚡ Boosters get 2x entries`);
    if (reqs.length > 0) {
        embed.addFields({ name: `🔒 ${t.requirements}`, value: reqs.join('\n'), inline: false });
    }

    // Winners
    if (!isActive && gw.winnersList?.length > 0) {
        embed.addFields({
            name: `🏆 ${t.winners_announced}`,
            value: gw.winnersList.map(w => `<@${w}> +${each.toLocaleString()} 🪙`).join('\n'),
            inline: false
        });
        embed.setColor(ARCHON.gold);
    }

    embed.setFooter({ text: t.footer }).setTimestamp();
    return embed;
}

// ═══════════════════════════════════════════════════════
// BUILD BUTTONS
// ═══════════════════════════════════════════════════════
function buildButtons(gw) {
    const t = T[gw.lang || 'en'];
    const isActive = gw.status === 'active';
    const row = new ActionRowBuilder();

    if (isActive) {
        row.addComponents(
            new ButtonBuilder().setCustomId(`gw_enter_${gw.id}`).setLabel(t.enter).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`gw_leave_${gw.id}`).setLabel(t.withdraw).setStyle(ButtonStyle.Secondary),
        );
    } else {
        row.addComponents(
            new ButtonBuilder().setCustomId(`gw_reroll_${gw.id}`).setLabel(t.reroll).setStyle(ButtonStyle.Primary),
        );
    }

    row.addComponents(
        new ButtonBuilder().setCustomId(`gw_end_${gw.id}`).setLabel(t.terminate).setStyle(ButtonStyle.Danger),
    );

    return row;
}

// ═══════════════════════════════════════════════════════
// SELECT WINNERS
// ═══════════════════════════════════════════════════════
function selectWinners(entries, count) {
    if (entries.length === 0) return [];
    const pool = [...entries].sort(() => Math.random() - 0.5);
    return [...new Set(pool)].slice(0, Math.min(count, pool.length));
}

// ═══════════════════════════════════════════════════════
// CREDIT WINNERS
// ═══════════════════════════════════════════════════════
async function creditWinners(client, db, winners, amount, guildId) {
    const each = Math.floor(amount / winners.length);
    for (const uid of winners) {
        try {
            const existing = db.prepare('SELECT id FROM users WHERE id = ? AND guild_id = ?').get(uid, guildId);
            if (!existing) {
                db.prepare('INSERT INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, ?)').run(uid, guildId, 'Agent', each);
            } else {
                db.prepare('UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?').run(each, uid, guildId);
            }
        } catch(e) {}
    }
}

// ═══════════════════════════════════════════════════════
// END GIVEAWAY
// ═══════════════════════════════════════════════════════
async function endGiveaway(gw, client, db) {
    if (gw.status !== 'active') return;
    gw.status = 'ended';
    clearTimeout(gw.timer);

    const t = T[gw.lang || 'en'];
    const winners = selectWinners(gw.entries, gw.winners);
    gw.winnersList = winners;

    if (winners.length > 0) {
        await creditWinners(client, db, winners, gw.amount, gw.guildId);
    }

    try {
        const channel = await client.channels.fetch(gw.channelId).catch(() => null);
        if (!channel) return;
        const msg = await channel.messages.fetch(gw.messageId).catch(() => null);
        if (!msg) return;

        const embed = buildEmbed(gw, client);
        await msg.edit({ embeds: [embed], components: [buildButtons(gw)] }).catch(() => {});

        const each = Math.floor(gw.amount / gw.winners);
        if (winners.length > 0) {
            const announce = new EmbedBuilder()
                .setColor(ARCHON.gold)
                .setAuthor({ name: '🦅 ARCHON ENGINE • GIVEAWAY RESULTS', iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    `## 🎊 ${gw.prize}\n\n` +
                    `**${winners.length} winner${winners.length > 1 ? 's' : ''} selected!**\n\n` +
                    winners.map(w => `🏆 <@${w}> — +**${each.toLocaleString()} 🪙**`).join('\n')
                )
                .addFields(
                    { name: '👥 Total Entries', value: `\`${gw.entries.length}\``, inline: true },
                    { name: '💎 Prize Pool', value: `\`${gw.amount.toLocaleString()} 🪙\``, inline: true },
                    { name: '🎲 Host', value: `**${gw.hostName}**`, inline: true },
                )
                .setFooter({ text: t.footer })
                .setTimestamp();

            const mention = winners.map(w => `<@${w}>`).join(' ');
            await channel.send({ content: `${mention} 🎊`, embeds: [announce] }).catch(() => {});

            // DM winners
            for (const uid of winners) {
                try {
                    const user = await client.users.fetch(uid).catch(() => null);
                    if (!user) continue;
                    const dm = new EmbedBuilder()
                        .setColor(ARCHON.gold)
                        .setTitle('🎊 You won a giveaway!')
                        .setDescription(
                            `**Prize:** ${gw.prize}\n` +
                            `**Amount:** +${each.toLocaleString()} 🪙\n` +
                            `**Server:** ${gw.guildName}\n\n` +
                            `Credits have been added to your account!`
                        )
                        .setFooter({ text: t.footer })
                        .setTimestamp();
                    await user.send({ embeds: [dm] }).catch(() => {});
                } catch(e) {}
            }
        } else {
            await channel.send({ content: t.noEntries }).catch(() => {});
        }
    } catch(e) {
        console.error('[GIVEAWAY] End error:', e.message);
    }

    activeGiveaways.delete(gw.id);
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

    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎁 Start a classified giveaway')
        .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 10m, 2h, 1d)').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('Total credit prize pool').setRequired(true).setMinValue(100))
        .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (1-20)').setRequired(true).setMinValue(1).setMaxValue(20))
        .addStringOption(o => o.setName('prize').setDescription('Prize description').setRequired(true))
        .addIntegerOption(o => o.setName('min_level').setDescription('Minimum level to enter').setRequired(false).setMinValue(0))
        .addIntegerOption(o => o.setName('min_credits').setDescription('Minimum credits to enter').setRequired(false).setMinValue(0))
        .addBooleanOption(o => o.setName('booster_bonus').setDescription('Give boosters 2x entries').setRequired(false)),

    run: async (client, message, args, db) => {
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

        await startGiveaway({ message, client, db, duration, amount, winners, prize, minLevel: 0, minCredits: 0, boosterBonus: false });
    },

    execute: async (interaction, client, db) => {
        if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '❌ You need Manage Server permission.', flags: 64 });
        }

        const duration = parseDuration(interaction.options.getString('duration'));
        if (!duration) return interaction.reply({ content: '❌ Invalid duration. Use: `10s`, `5m`, `2h`, `1d`', flags: 64 });

        const amount = interaction.options.getInteger('amount');
        const winners = interaction.options.getInteger('winners');
        const prize = interaction.options.getString('prize');
        const minLevel = interaction.options.getInteger('min_level') || 0;
        const minCredits = interaction.options.getInteger('min_credits') || 0;
        const boosterBonus = interaction.options.getBoolean('booster_bonus') || false;

        await interaction.deferReply({ flags: 64 });
        await startGiveaway({ interaction, client, db, duration, amount, winners, prize, minLevel, minCredits, boosterBonus });
        await interaction.editReply({ content: '✅ Giveaway launched!' }).catch(() => {});
    },
};

// ═══════════════════════════════════════════════════════
// START GIVEAWAY
// ═══════════════════════════════════════════════════════
async function startGiveaway({ message, interaction, client, db, duration, amount, winners, prize, minLevel, minCredits, boosterBonus }) {
    const guild = message?.guild || interaction?.guild;
    const channel = message?.channel || interaction?.channel;
    const author = message?.author || interaction?.user;
    const member = message?.member || interaction?.member;
    const lang = getLang(client, guild.id);
    const t = T[lang];

    const id = `${guild.id}_${Date.now()}`;
    const endTimestamp = Date.now() + duration;

    const gw = {
        id,
        guildId: guild.id,
        guildName: guild.name,
        channelId: channel.id,
        messageId: null,
        hostId: author.id,
        hostName: author.username,
        hostIcon: author.displayAvatarURL(),
        prize,
        amount,
        winners,
        minLevel,
        minCredits,
        boosterBonus,
        entries: [],
        tickets: {},
        winnersList: [],
        status: 'active',
        endTimestamp,
        lang,
        timer: null,
    };

    activeGiveaways.set(id, gw);

    const embed = buildEmbed(gw, client);
    const row = buildButtons(gw);

    const msg = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (!msg) return;

    gw.messageId = msg.id;

    // Auto-end timer
    gw.timer = setTimeout(() => endGiveaway(gw, client, db), duration);

    // Button collector
    const collector = msg.createMessageComponentCollector({ time: duration + 60000 });

    collector.on('collect', async (i) => {
        const gwNow = activeGiveaways.get(id);
        const userLang = getLang(client, guild.id);
        const ut = T[userLang];

        if (i.customId === `gw_enter_${id}`) {
            await i.deferReply({ ephemeral: true }).catch(() => {});

            if (!gwNow || gwNow.status !== 'active') return i.editReply({ content: '❌ Giveaway has ended.' }).catch(() => {});
            if (i.user.id === gwNow.hostId) return i.editReply({ content: ut.cantEnter }).catch(() => {});
            if (gwNow.entries.includes(i.user.id)) return i.editReply({ content: ut.alreadyIn }).catch(() => {});

            // Check requirements
            if (gwNow.minLevel > 0 || gwNow.minCredits > 0) {
                const userData = db.prepare('SELECT level, credits FROM users WHERE id = ? AND guild_id = ?').get(i.user.id, guild.id);
                if (gwNow.minLevel > 0 && (!userData || userData.level < gwNow.minLevel)) {
                    return i.editReply({ content: ut.needLevel.replace('{level}', gwNow.minLevel) }).catch(() => {});
                }
                if (gwNow.minCredits > 0 && (!userData || userData.credits < gwNow.minCredits)) {
                    return i.editReply({ content: ut.needCredits.replace('{credits}', gwNow.minCredits.toLocaleString()) }).catch(() => {});
                }
            }

            // Booster bonus — add twice
            const isBooster = i.member?.premiumSince != null;
            gwNow.entries.push(i.user.id);
            if (gwNow.boosterBonus && isBooster) gwNow.entries.push(i.user.id);

            const ticket = Math.random().toString(36).substring(2, 8).toUpperCase();
            gwNow.tickets[i.user.id] = ticket;

            // Update embed
            const newEmbed = buildEmbed(gwNow, client);
            await msg.edit({ embeds: [newEmbed], components: [buildButtons(gwNow)] }).catch(() => {});

            let reply = ut.enterOk.replace('{ticket}', ticket);
            if (gwNow.boosterBonus && isBooster) reply += `\n${ut.boosterBonus}`;
            await i.editReply({ content: reply }).catch(() => {});

        } else if (i.customId === `gw_leave_${id}`) {
            await i.deferReply({ ephemeral: true }).catch(() => {});
            if (!gwNow || gwNow.status !== 'active') return i.editReply({ content: '❌ Giveaway has ended.' }).catch(() => {});
            if (!gwNow.entries.includes(i.user.id)) return i.editReply({ content: ut.notIn }).catch(() => {});

            gwNow.entries = gwNow.entries.filter(e => e !== i.user.id);
            delete gwNow.tickets[i.user.id];

            const newEmbed = buildEmbed(gwNow, client);
            await msg.edit({ embeds: [newEmbed], components: [buildButtons(gwNow)] }).catch(() => {});
            await i.editReply({ content: ut.leaveOk }).catch(() => {});

        } else if (i.customId === `gw_reroll_${id}`) {
            if (i.user.id !== gwNow?.hostId && !i.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return i.reply({ content: '❌ Only the host or moderators can reroll.', flags: 64 }).catch(() => {});
            }
            await i.deferReply({ ephemeral: true }).catch(() => {});
            const newWinners = selectWinners(gwNow.entries, gwNow.winners);
            gwNow.winnersList = newWinners;
            if (newWinners.length > 0) await creditWinners(client, db, newWinners, gwNow.amount, guild.id);
            const newEmbed = buildEmbed(gwNow, client);
            await msg.edit({ embeds: [newEmbed], components: [buildButtons(gwNow)] }).catch(() => {});
            const mention = newWinners.map(w => `<@${w}>`).join(' ');
            await channel.send({ content: `🔄 **Reroll!** New winners: ${mention || 'None'}` }).catch(() => {});
            await i.editReply({ content: ut.rerollOk }).catch(() => {});

        } else if (i.customId === `gw_end_${id}`) {
            if (i.user.id !== gwNow?.hostId && !i.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return i.reply({ content: '❌ Only the host or moderators can end this.', flags: 64 }).catch(() => {});
            }
            await i.deferReply({ ephemeral: true }).catch(() => {});
            if (gwNow?.status === 'active') {
                await endGiveaway(gwNow, client, db);
            } else {
                // Delete
                activeGiveaways.delete(id);
                await msg.delete().catch(() => {});
            }
            await i.editReply({ content: ut.terminated }).catch(() => {});
        }
    });

    collector.on('end', () => {
        const gwNow = activeGiveaways.get(id);
        if (gwNow?.status === 'active') endGiveaway(gwNow, client, db);
    });
}
