const {
    EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder,
    ButtonStyle, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder,
    ComponentType
} = require('discord.js');

// ================= ENV FALLBACK HELPERS =================
// These mirror index.js getServerSettings() env detection for standalone usage
function envSetting(settings, key, envKey) {
    const dbVal = settings?.[key];
    if (dbVal !== null && dbVal !== undefined) return dbVal;
    return process.env[envKey] || null;
}
function envNumSetting(settings, key, envKey, fallback) {
    const dbVal = settings?.[key];
    if (dbVal !== null && dbVal !== undefined) return dbVal;
    const envVal = process.env[envKey];
    return envVal ? parseInt(envVal) : fallback;
}

// Build effective settings with env fallback — owner server ONLY
// guildId is needed to prevent credential leakage to other guilds
function effectiveSettings(serverSettings, guildId) {
    const isOwnerServer = guildId === process.env.GUILD_ID;
    // Override env helpers to only read env for owner server
    const ownerEnv = (settings, key, envKey) => {
        const dbVal = settings?.[key];
        if (dbVal !== null && dbVal !== undefined) return dbVal;
        return isOwnerServer ? (process.env[envKey] || null) : null;
    };
    const ownerEnvNum = (settings, key, envKey, fallback) => {
        const dbVal = settings?.[key];
        if (dbVal !== null && dbVal !== undefined) return dbVal;
        if (isOwnerServer) {
            const envVal = process.env[envKey];
            return envVal ? parseInt(envVal) : fallback;
        }
        return fallback;
    };
    return {
        ...serverSettings,
        ticketCategory: ownerEnv(serverSettings, 'ticketCategory', 'TICKET_CATEGORY_ID'),
        ticketStaffRole: ownerEnv(serverSettings, 'ticketStaffRole', 'TICKET_STAFF_ROLE_ID'),
        ticketTranscriptChannel: ownerEnv(serverSettings, 'ticketTranscriptChannel', 'TICKET_TRANSCRIPT_CHANNEL_ID'),
        ticketLogChannel: ownerEnv(serverSettings, 'ticketLogChannel', 'TICKET_LOG_CHANNEL_ID'),
        ticketAutoCloseHours: ownerEnvNum(serverSettings, 'ticketAutoCloseHours', 'TICKET_AUTO_CLOSE_HOURS', 24),
        ticketLimitPerUser: ownerEnvNum(serverSettings, 'ticketLimitPerUser', 'TICKET_LIMIT_PER_USER', 1),
    };
}

// ================= DB PERSISTENCE =================
// Tickets survive bot restarts via SQLite
function setupTicketDB(database) {
    try {
        database.prepare(`
            CREATE TABLE IF NOT EXISTS tickets (
                channel_id TEXT PRIMARY KEY,
                guild_id TEXT NOT NULL,
                creator_id TEXT NOT NULL,
                creator_tag TEXT,
                created_at INTEGER,
                claimed_by TEXT,
                category TEXT,
                category_value TEXT,
                ticket_number INTEGER,
                participants TEXT
            )
        `).run();
        database.prepare(`CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id)`).run();
        database.prepare(`CREATE INDEX IF NOT EXISTS idx_tickets_creator ON tickets(creator_id)`).run();
    } catch (e) {
        console.error('[TICKET DB] Setup failed:', e.message);
    }
}

function saveTicketToDB(database, channelId, ticket) {
    try {
        database.prepare(`
            INSERT OR REPLACE INTO tickets
            (channel_id, guild_id, creator_id, creator_tag, created_at, claimed_by, category, category_value, ticket_number, participants)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            channelId, ticket.guildId, ticket.creatorId, ticket.creatorTag || '',
            ticket.createdAt, ticket.claimedBy, ticket.category, ticket.categoryValue,
            ticket.number, JSON.stringify(ticket.participants || [ticket.creatorId])
        );
    } catch (e) {
        console.error('[TICKET DB] Save failed:', e.message);
    }
}

function loadTicketFromDB(database, channelId) {
    try {
        const row = database.prepare(`SELECT * FROM tickets WHERE channel_id = ?`).get(channelId);
        if (!row) return null;
        return {
            creatorId: row.creator_id,
            creatorTag: row.creator_tag,
            createdAt: row.created_at,
            claimedBy: row.claimed_by,
            category: row.category,
            categoryValue: row.category_value,
            guildId: row.guild_id,
            number: row.ticket_number,
            participants: JSON.parse(row.participants || '[]')
        };
    } catch (e) {
        console.error('[TICKET DB] Load failed:', e.message);
        return null;
    }
}

function loadAllTicketsFromDB(database, client) {
    try {
        // Get list of guild IDs the bot is currently in
        const botGuildIds = client ? Array.from(client.guilds.cache.keys()) : [];
        if (botGuildIds.length === 0) {
            console.log('[TICKET DB] Bot guild cache empty, skipping ticket restore');
            return;
        }

        // Build placeholders for IN clause
        const placeholders = botGuildIds.map(() => '?').join(',');
        const rows = database.prepare(`SELECT * FROM tickets WHERE guild_id IN (${placeholders})`).all(...botGuildIds);

        for (const row of rows) {
            activeTickets.set(row.channel_id, {
                creatorId: row.creator_id,
                creatorTag: row.creator_tag,
                createdAt: row.created_at,
                claimedBy: row.claimed_by,
                category: row.category,
                categoryValue: row.category_value,
                guildId: row.guild_id,
                number: row.ticket_number,
                participants: JSON.parse(row.participants || '[]')
            });
        }

        // Log any tickets that were skipped (from guilds bot left)
        const skipped = database.prepare(`SELECT COUNT(*) as c FROM tickets WHERE guild_id NOT IN (${placeholders})`).get(...botGuildIds);
        if (skipped && skipped.c > 0) {
            console.log(`[TICKET DB] Skipped ${skipped.c} tickets from guilds bot is no longer in`);
            // Clean up orphaned tickets
            database.prepare(`DELETE FROM tickets WHERE guild_id NOT IN (${placeholders})`).run(...botGuildIds);
            console.log(`[TICKET DB] Cleaned up ${skipped.c} orphaned tickets`);
        }

        if (rows.length > 0) {
            console.log(`[TICKET DB] Restored ${rows.length} active tickets from ${botGuildIds.length} guilds`);
        }
    } catch (e) {
        console.error('[TICKET DB] Load all failed:', e.message);
    }
}

function deleteTicketFromDB(database, channelId) {
    try {
        database.prepare(`DELETE FROM tickets WHERE channel_id = ?`).run(channelId);
    } catch (e) {
        console.error('[TICKET DB] Delete failed:', e.message);
    }
}

// ================= PER-SERVER TICKET STATE =================
const ticketCounters = new Map();  // guildId -> number
const activeTickets = new Map();   // channelId -> { creatorId, createdAt, claimedBy, category, participants }
const userTicketCounts = new Map(); // guildId:userId -> count
const autoCloseTimers = new Map(); // channelId -> timeout

// ================= DEFAULT TICKET CATEGORIES =================
const DEFAULT_CATEGORIES = [
    { emoji: '❓', label: 'General Support', value: 'general', description: 'Get help with any general question or issue' },
    { emoji: '🎮', label: 'Game Support', value: 'game', description: 'Report bugs, get game help, or discuss strategies' },
    { emoji: '🛒', label: 'Purchase Support', value: 'purchase', description: 'Issues with shop items, payments, or refunds' },
    { emoji: '💰', label: 'Economy Help', value: 'economy', description: 'Questions about credits, transfers, or investments' },
    { emoji: '📋', label: 'Report User', value: 'report', description: 'Report a user for rule violations or misconduct' },
    { emoji: '🤝', label: 'Partnership', value: 'partner', description: 'Business or community partnership inquiries' },
];

// ================= TRANSLATIONS =================
const T = {
    en: {
        // Setup
        setupTitle: '🎫 TICKET SYSTEM SETUP',
        setupComplete: '✅ Ticket system configured successfully!\n\n**Next step:** Use `.ticket panel` to post the ticket creation embed.',
        setupUsage: '**Usage:**\n`.serversettings set ticketCategory <category-id>` — Set ticket archive category\n`.serversettings set ticketStaffRole <role-id>` — Set staff role\n`.serversettings set ticketTranscriptChannel <channel-id>` — Set transcript channel\n`.serversettings set ticketAutoClose <hours>` — Auto-close inactive tickets (default: 24h)',
        // Panel
        panelTitle: '🎫 SUPPORT CENTER',
        panelDescription: (guild) => `Welcome to **${guild}** Support Center!\n\nOur team is ready to assist you. Please select a category from the dropdown below to open a ticket.\n\n**\u2022** Be clear and detailed about your issue\n**\u2022** One ticket per topic\n**\u2022** Our team will respond as soon as possible`,
        panelFooter: 'Select a category to open a ticket',
        // Ticket creation
        ticketCreated: '✅ Your ticket has been created!',
        ticketWelcomeTitle: '🎫 NEW TICKET OPENED',
        ticketWelcomeDesc: (user, category) => `Welcome <@${user}>!\n\nA support agent will be with you shortly. Please describe your issue in detail so we can assist you as quickly as possible.\n\n**Category:** ${category}`,
        ticketWelcomeFooter: 'Use the buttons below to manage this ticket',
        // Buttons
        claimButton: '🙋 Claim',
        closeButton: '🔒 Close',
        transcriptButton: '📄 Transcript',
        addUserButton: '➕ Add User',
        // Claim
        claimSuccess: (user) => `🙋 <@${user}> has claimed this ticket and will be assisting you.`,
        alreadyClaimed: '❌ This ticket is already claimed.',
        staffOnlyClaim: '❌ Only staff members can claim tickets.',
        // Close
        closeConfirmTitle: '🔒 Close Ticket?',
        closeConfirmDesc: 'Are you sure you want to close this ticket? This action cannot be undone.',
        confirmClose: '✅ Yes, Close',
        cancel: '❌ Cancel',
        closingTicket: '🔒 Closing ticket in 5 seconds...',
        ticketClosedBy: (user) => `🔒 Ticket closed by <@${user}>`,
        ticketClosedLog: (user, closer, category) => `**Ticket Closed**\n**Creator:** <@${user}>\n**Closed By:** <@${closer}>\n**Category:** ${category}`,
        transcriptSaved: '📄 Transcript saved and uploaded!',
        // Permissions
        noPermission: '❌ Only the ticket creator or staff can use this.',
        staffOnly: '❌ Only staff members can perform this action.',
        noTicketChannel: '❌ This ticket channel no longer exists.',
        // Errors
        categoryNotSet: '⚠️ **Ticket system not configured.**\nAn admin needs to set a ticket category first using `.serversettings set ticketCategory <category-id>`',
        createError: '❌ Failed to create ticket channel. Check bot permissions.',
        maxTickets: (limit) => `❌ You can only have ${limit} active ticket(s) at a time. Please close an existing ticket first.`,
        // Fields
        createdBy: 'Created By',
        createdAt: 'Created',
        claimedBy: 'Claimed By',
        category: 'Category',
        status: 'Status',
        statusOpen: '\ud83d\udfe2 Open',
        statusClaimed: '\ud83d\udfe1 Claimed',
        statusClosing: '\ud83d\udd34 Closing',
        ticketNum: 'Ticket #',
        // Auto-close
        autoCloseWarning: '⚠️ This ticket will auto-close in 1 hour due to inactivity.',
        autoCloseNotice: '🔒 This ticket has been automatically closed due to inactivity.',
    },
    fr: {
        setupTitle: '🎫 CONFIGURATION DU SYSTÈME DE TICKETS',
        setupComplete: '✅ Système de tickets configuré avec succès !\n\n**Prochaine étape :** Utilisez `.ticket panel` pour publier l\'embed de création de tickets.',
        setupUsage: '**Utilisation :**\n`.serversettings set ticketCategory <id-catégorie>` — Définir la catégorie d\'archivage\n`.serversettings set ticketStaffRole <id-rôle>` — Définir le rôle staff\n`.serversettings set ticketTranscriptChannel <id-salon>` — Définir le salon de transcription\n`.serversettings set ticketAutoClose <heures>` — Fermeture auto (défaut: 24h)',
        panelTitle: '🎫 CENTRE DE SUPPORT',
        panelDescription: (guild) => `Bienvenue au Centre de Support de **${guild}** !\n\nNotre équipe est prête à vous aider. Sélectionnez une catégorie dans le menu ci-dessous pour ouvrir un ticket.\n\n**\u2022** Soyez clair et précis sur votre problème\n**\u2022** Un ticket par sujet\n**\u2022** Notre équipe répondra dès que possible`,
        panelFooter: 'Sélectionnez une catégorie pour ouvrir un ticket',
        ticketCreated: '✅ Votre ticket a été créé !',
        ticketWelcomeTitle: '🎫 NOUVEAU TICKET OUVERT',
        ticketWelcomeDesc: (user, category) => `Bienvenue <@${user}> !\n\nUn agent de support vous assistera sous peu. Veuillez décrire votre problème en détail pour que nous puissions vous aider le plus rapidement possible.\n\n**Catégorie :** ${category}`,
        ticketWelcomeFooter: 'Utilisez les boutons ci-dessous pour gérer ce ticket',
        claimButton: '🙋 Prendre en charge',
        closeButton: '🔒 Fermer',
        transcriptButton: '📄 Transcription',
        addUserButton: '➕ Ajouter un utilisateur',
        claimSuccess: (user) => `🙋 <@${user}> a pris ce ticket en charge et va vous assister.`,
        alreadyClaimed: '❌ Ce ticket est déjà pris en charge.',
        staffOnlyClaim: '❌ Seuls les membres du staff peuvent prendre des tickets.',
        closeConfirmTitle: '🔒 Fermer le ticket ?',
        closeConfirmDesc: 'Êtes-vous sûr de vouloir fermer ce ticket ? Cette action est irréversible.',
        confirmClose: '✅ Oui, Fermer',
        cancel: '❌ Annuler',
        closingTicket: '🔒 Fermeture du ticket dans 5 secondes...',
        ticketClosedBy: (user) => `🔒 Ticket fermé par <@${user}>`,
        ticketClosedLog: (user, closer, category) => `**Ticket Fermé**\n**Créateur :** <@${user}>\n**Fermé par :** <@${closer}>\n**Catégorie :** ${category}`,
        transcriptSaved: '📄 Transcription enregistrée et téléchargée !',
        noPermission: '❌ Seul le créateur du ticket ou le staff peut utiliser ceci.',
        staffOnly: '❌ Seuls les membres du staff peuvent effectuer cette action.',
        noTicketChannel: '❌ Ce salon de ticket n\'existe plus.',
        categoryNotSet: '⚠️ **Système de tickets non configuré.**\nUn administrateur doit d\'abord définir une catégorie de tickets avec `.serversettings set ticketCategory <id-catégorie>`',
        createError: '❌ Échec de création du salon ticket. Vérifiez les permissions du bot.',
        maxTickets: (limit) => `❌ Vous ne pouvez avoir que ${limit} ticket(s) actif(s) à la fois. Veuillez fermer un ticket existant d\'abord.`,
        createdBy: 'Créé Par',
        createdAt: 'Créé',
        claimedBy: 'Pris Par',
        category: 'Catégorie',
        status: 'Statut',
        statusOpen: '\ud83d\udfe2 Ouvert',
        statusClaimed: '\ud83d\udfe1 Pris',
        statusClosing: '\ud83d\udd34 Fermeture',
        ticketNum: 'Ticket #',
        autoCloseWarning: '⚠️ Ce ticket se fermera automatiquement dans 1 heure pour inactivité.',
        autoCloseNotice: '🔒 Ce ticket a été fermé automatiquement pour inactivité.',
    }
};

// ================= HELPER: GET CATEGORIES FOR A GUILD =================
function getCategories(settings, lang = 'en') {
    const configured = settings?.ticketCategoriesConfig;
    if (configured && Array.isArray(configured) && configured.length > 0) {
        return configured;
    }
    return DEFAULT_CATEGORIES;
}

// ================= HELPER: CHECK IF USER IS STAFF =================
function isStaff(member, settings) {
    if (!member) return false;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions?.has(PermissionFlagsBits.ManageMessages)) return true;
    if (settings?.ticketStaffRole && member.roles?.cache?.has(settings.ticketStaffRole)) return true;
    return false;
}

// ================= HELPER: COUNT USER'S ACTIVE TICKETS =================
function countUserTickets(guildId, userId) {
    let count = 0;
    for (const [_, ticket] of activeTickets) {
        if (ticket.guildId === guildId && ticket.creatorId === userId) count++;
    }
    return count;
}

// ================= HELPER: RESET AUTO-CLOSE TIMER =================
function resetAutoCloseTimer(channelId, client, settings) {
    // Clear existing timer
    const existing = autoCloseTimers.get(channelId);
    if (existing) { clearTimeout(existing); autoCloseTimers.delete(channelId); }

    const hours = settings?.ticketAutoCloseHours || 24;
    if (hours <= 0) return; // auto-close disabled

    const ms = hours * 3600000;
    const warningMs = ms - 3600000; // 1 hour warning before close

    // Warning timer
    if (warningMs > 0) {
        setTimeout(async () => {
            try {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (channel && activeTickets.has(channelId)) {
                    const t = T['en']; // default for system messages
                    await channel.send({ embeds: [new EmbedBuilder().setColor('#f39c12').setDescription(t.autoCloseWarning)] }).catch(() => {});
                }
            } catch (e) {}
        }, warningMs);
    }

    // Close timer
    const timer = setTimeout(async () => {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel && activeTickets.has(channelId)) {
                const t = T['en'];
                await channel.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(t.autoCloseNotice)] }).catch(() => {});
                activeTickets.delete(channelId);
                setTimeout(async () => {
                    try { await channel.delete('Auto-closed due to inactivity'); } catch (e) {}
                }, 5000);
            }
        } catch (e) {}
        autoCloseTimers.delete(channelId);
    }, ms);

    autoCloseTimers.set(channelId, timer);
}

// ================= HELPER: SAVE TRANSCRIPT =================
async function saveTranscript(channel, ticket, closerId, client, settings) {
    const t = T['en'];
    try {
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => new Map());
        const lines = [];
        lines.push(`= TICKET TRANSCRIPT =`);
        lines.push(`Ticket #${ticket.number || '?'}`);
        lines.push(`Category: ${ticket.category || 'Unknown'}`);
        lines.push(`Created by: ${ticket.creatorTag || 'Unknown'}`);
        lines.push(`Created at: ${new Date(ticket.createdAt).toISOString()}`);
        lines.push(`Claimed by: ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Unclaimed'}`);
        lines.push(`Closed by: ${closerId ? `<@${closerId}>` : 'Unknown'}`);
        lines.push(`=`.repeat(50));
        lines.push('');

        messages.reverse().forEach(m => {
            const time = new Date(m.createdTimestamp).toISOString().slice(0, 19).replace('T', ' ');
            lines.push(`[${time}] ${m.author.tag}: ${m.content || '(embed/attachment)'}`);
        });

        const transcript = lines.join('\n');

        // Send to transcript channel if configured
        const transcriptChanId = settings?.ticketTranscriptChannel;
        if (transcriptChanId) {
            try {
                const transcriptChan = await client.channels.fetch(transcriptChanId);
                // CROSS-SERVER GUARD: Verify transcript channel belongs to SAME guild as ticket
                if (transcriptChan?.guildId !== ticket.guildId) {
                    console.log(`[TICKET TRANSCRIPT] BLOCKED: Channel ${transcriptChanId} guild (${transcriptChan?.guildId}) !== ticket guild (${ticket.guildId}). Possible misconfiguration or malicious setting.`);
                } else if (transcriptChan && (transcriptChan.type === ChannelType.GuildText || transcriptChan.type === 5) && typeof transcriptChan.send === 'function') {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#3498db')
                        .setTitle(`🎫 Ticket #${ticket.number || '?'} Closed`)
                        .setDescription(t.ticketClosedLog(ticket.creatorId, closerId, ticket.category || 'Unknown'))
                        .setTimestamp();

                    await transcriptChan.send({
                        embeds: [logEmbed],
                        files: [{ attachment: Buffer.from(transcript), name: `ticket-${ticket.number || channel.id}.txt` }]
                    });
                    return true;
                } else if (transcriptChan) {
                    console.log(`[TICKET TRANSCRIPT] Channel ${transcriptChanId} is type ${transcriptChan.type}, not a text channel`);
                }
            } catch (e) {
                console.log(`[TICKET TRANSCRIPT] Could not send to transcript channel ${transcriptChanId}: ${e.message}`);
            }
        }

        // If no transcript channel, return the buffer for the ticket channel
        return { buffer: Buffer.from(transcript), filename: `ticket-${ticket.number || channel.id}.txt` };
    } catch (e) {
        console.error('[TICKET TRANSCRIPT]', e.message);
        return false;
    }
}

// ================= TICKET CHANNEL CREATION =================
async function createTicketChannel(guild, userId, username, category, settings, client) {
    const guildId = guild.id;
    const counter = (ticketCounters.get(guildId) || 0) + 1;
    ticketCounters.set(guildId, counter);

    const categoryData = typeof category === 'object' ? category : { emoji: '🎫', label: 'Support', value: 'general' };
    const channelName = `ticket-${counter}-${username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 100);
    const ticketCategoryId = settings?.ticketCategory;

    // Build permission overwrites
    const overwrites = [
        {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
        },
        {
            id: client.user.id,
            allow: [
                PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ReadMessageHistory
            ]
        },
        {
            id: userId,
            allow: [
                PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory
            ]
        }
    ];

    // Add staff role
    if (settings?.ticketStaffRole) {
        const role = guild.roles.cache.get(settings.ticketStaffRole);
        if (role) {
            overwrites.push({
                id: role.id,
                allow: [
                    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory
                ]
            });
        }
    }

    // Fallback: add admin/mod roles
    const adminRole = guild.roles.cache.find(r => r.permissions?.has(PermissionFlagsBits.Administrator));
    if (adminRole && !overwrites.some(o => o.id === adminRole.id)) {
        overwrites.push({
            id: adminRole.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
        });
    }

    const options = {
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: overwrites,
        topic: `Ticket #${counter} | ${categoryData.emoji} ${categoryData.label} | Created by ${username}`,
    };

    if (ticketCategoryId && guild.channels.cache.get(ticketCategoryId)) {
        options.parent = ticketCategoryId;
    }

    return guild.channels.create(options);
}

// ================= BUILD TICKET PANEL EMBED =================
function buildPanelEmbed(settings, guildName, lang = 'en') {
    const t = T[lang] || T['en'];
    const categories = getCategories(settings, lang);

    const catList = categories.map(c => `${c.emoji} **${c.label}** — ${c.description}`).join('\n');

    return new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: t.panelTitle, iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.webp' })
        .setDescription(t.panelDescription(guildName) + '\n\n**Available Categories:**\n' + catList)
        .addFields(
            { name: '\ud83d\udccb How it Works', value: 'Select a category below to create a private support channel. Only you and our support team can see it.', inline: false },
            { name: '\u23f0 Response Time', value: 'Our team typically responds within a few minutes during active hours.', inline: true },
            { name: '\ud83d\udcbe Transcripts', value: 'All ticket conversations are saved and can be downloaded as transcripts.', inline: true }
        )
        .setFooter({ text: t.panelFooter })
        .setTimestamp();
}

// ================= BUILD SELECT MENU =================
function buildSelectMenu(settings, disabled = false) {
    const categories = getCategories(settings);

    const select = new StringSelectMenuBuilder()
        .setCustomId('ticket_create_select')
        .setPlaceholder('🎫 Select a category to open a ticket...')
        .setDisabled(disabled);

    for (const cat of categories) {
        select.addOptions({
            label: `${cat.emoji} ${cat.label}`,
            description: cat.description.substring(0, 100),
            value: cat.value,
            emoji: cat.emoji
        });
    }

    return select;
}

// ================= BUILD TICKET WELCOME MESSAGE =================
async function buildTicketWelcome(channel, user, category, ticketNum, settings, lang = 'en') {
    const t = T[lang] || T['en'];
    const categoryLabel = typeof category === 'object' ? `${category.emoji} ${category.label}` : '🎫 Support';

    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: `${t.ticketWelcomeTitle} #${ticketNum}`, iconURL: user.displayAvatarURL() })
        .setDescription(t.ticketWelcomeDesc(user.id, categoryLabel))
        .addFields(
            { name: t.createdBy, value: `<@${user.id}>`, inline: true },
            { name: t.createdAt, value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
            { name: t.category, value: categoryLabel, inline: true },
            { name: t.status, value: t.statusOpen, inline: true }
        )
        .setFooter({ text: t.ticketWelcomeFooter })
        .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket_claim_${channel.id}_${user.id}`)
            .setLabel(t.claimButton)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🙋'),
        new ButtonBuilder()
            .setCustomId(`ticket_close_${channel.id}_${user.id}`)
            .setLabel(t.closeButton)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒'),
        new ButtonBuilder()
            .setCustomId(`ticket_transcript_${channel.id}_${user.id}`)
            .setLabel(t.transcriptButton)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📄')
    );

    await channel.send({
        content: `<@${user.id}>`,
        embeds: [embed],
        components: [row1]
    });
}

// ================= MODULE =================
module.exports = {
    name: 'ticket',
    aliases: ['tickets', 'support'],
    description: '🎫 Professional ticket system with panel, dropdown categories, auto-close, and transcripts.',
    category: 'UTILITY',
    cooldown: 5000,
    usage: '.ticket [panel|close|setup]',
    examples: ['.ticket panel', '.ticket setup', '.ticket close', '/ticket'],

    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('🎫 Ticket system')
        .addSubcommand(sub => sub.setName('panel').setDescription('Post the ticket creation panel'))
        .addSubcommand(sub => sub.setName('close').setDescription('Close the current ticket'))
        .addSubcommand(sub => sub.setName('setup').setDescription('Show ticket setup instructions')),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand) : 'en';
        const t = T[lang] || T['en'];
        const sub = args[0]?.toLowerCase();
        const guild = message.guild;
        const user = message.author;

        if (!guild) return message.reply('❌ Tickets only work in servers.').catch(() => {});

        // Apply env fallback — owner server only
        serverSettings = effectiveSettings(serverSettings, guild.id);

        // Check if ticket category is set
        if (!serverSettings?.ticketCategory) {
            if (sub !== 'setup') {
                return message.reply({ content: t.categoryNotSet, allowedMentions: { parse: [] } }).catch(() => {});
            }
        }

        // ---- SETUP ----
        if (sub === 'setup') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply({ content: t.staffOnly, allowedMentions: { parse: [] } }).catch(() => {});
            }

            const embed = new EmbedBuilder()
                .setColor('#00fbff')
                .setTitle(t.setupTitle)
                .setDescription(t.setupComplete + '\n\n' + t.setupUsage)
                .setTimestamp();

            return message.reply({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
        }

        // ---- PANEL ----
        if (sub === 'panel') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply({ content: t.staffOnly, allowedMentions: { parse: [] } }).catch(() => {});
            }

            const embed = buildPanelEmbed(serverSettings, guild.name, lang);
            const select = buildSelectMenu(serverSettings);
            const row = new ActionRowBuilder().addComponents(select);

            const sent = await message.channel.send({ embeds: [embed], components: [row] }).catch(() => null);
            if (sent) {
                await message.react('✅').catch(() => {});
                // Store panel message ID for reference
                try {
                    db.prepare(`INSERT OR REPLACE INTO server_settings (guild_id, ticket_panel_channel) VALUES (?, ?)`).run(guild.id, sent.id);
                } catch (e) {}
            }
            return;
        }

        // ---- CLOSE (prefix) ----
        if (sub === 'close') {
            const channel = message.channel;
            const ticket = activeTickets.get(channel.id);
            if (!ticket) return message.reply({ content: '❌ This is not an active ticket channel.', allowedMentions: { parse: [] } }).catch(() => {});

            const isCreator = message.author.id === ticket.creatorId;
            const isStaffMember = isStaff(message.member, serverSettings);
            if (!isCreator && !isStaffMember) {
                return message.reply({ content: t.noPermission, allowedMentions: { parse: [] } }).catch(() => {});
            }

            // Save transcript
            await saveTranscript(channel, ticket, message.author.id, client, serverSettings);

            await message.reply({ content: t.closingTicket, allowedMentions: { parse: [] } }).catch(() => {});
            activeTickets.delete(channel.id);
            if (db) deleteTicketFromDB(db, channel.id);
            const existingTimer = autoCloseTimers.get(channel.id);
            if (existingTimer) { clearTimeout(existingTimer); autoCloseTimers.delete(channel.id); }

            setTimeout(async () => {
                try { await channel.delete(`Ticket closed by ${message.author.tag}`); } catch (e) {}
            }, 5000);
            return;
        }

        // Default: show help
        const helpEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setTitle(t.panelTitle)
            .setDescription(
                `**Usage:**\n` +
                `\`.ticket panel\` — Post the ticket panel embed\n` +
                `\`.ticket setup\` — Show setup instructions\n` +
                `\`.ticket close\` — Close current ticket\n\n` +
                `Users create tickets via the panel dropdown.`
            )
            .setTimestamp();
        message.reply({ embeds: [helpEmbed], allowedMentions: { parse: [] } }).catch(() => {});
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T['en'];
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const user = interaction.user;
        const db = client.db;
        const serverSettings = effectiveSettings(client.getServerSettings?.(guild?.id) || {}, guild?.id);

        if (!guild) return interaction.reply({ content: '❌ Tickets only work in servers.', ephemeral: true });

        // Check ticket category is set
        if (!serverSettings?.ticketCategory && subcommand !== 'setup') {
            return interaction.reply({ content: t.categoryNotSet, ephemeral: true });
        }

        // ---- SETUP ----
        if (subcommand === 'setup') {
            if (!interaction.member.permissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: t.staffOnly, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor('#00fbff')
                .setTitle(t.setupTitle)
                .setDescription(t.setupComplete + '\n\n' + t.setupUsage)
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // ---- PANEL ----
        if (subcommand === 'panel') {
            if (!interaction.member.permissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: t.staffOnly, ephemeral: true });
            }

            const embed = buildPanelEmbed(serverSettings, guild.name, lang);
            const select = buildSelectMenu(serverSettings);
            const row = new ActionRowBuilder().addComponents(select);

            await interaction.reply({ content: 'Posting ticket panel...', ephemeral: true });
            const sent = await interaction.channel.send({ embeds: [embed], components: [row] }).catch(() => null);

            if (sent) {
                await interaction.editReply({ content: '✅ Ticket panel posted!' }).catch(() => {});
                try {
                    db.prepare(`UPDATE server_settings SET ticket_panel_channel = ? WHERE guild_id = ?`).run(sent.id, guild.id);
                } catch (e) {}
            } else {
                await interaction.editReply({ content: '❌ Failed to post panel.' }).catch(() => {});
            }
            return;
        }

        // ---- CLOSE ----
        if (subcommand === 'close') {
            const channel = interaction.channel;
            const ticket = activeTickets.get(channel.id);
            if (!ticket) return interaction.reply({ content: '❌ This is not an active ticket channel.', ephemeral: true });

            const isCreator = user.id === ticket.creatorId;
            const isStaffMember = isStaff(interaction.member, serverSettings);
            if (!isCreator && !isStaffMember) {
                return interaction.reply({ content: t.noPermission, ephemeral: true });
            }

            await interaction.deferReply();

            // Save transcript
            await saveTranscript(channel, ticket, user.id, client, serverSettings);

            await interaction.editReply({ content: t.closingTicket }).catch(() => {});
            activeTickets.delete(channel.id);
            if (db) deleteTicketFromDB(db, channel.id);
            const existingTimer = autoCloseTimers.get(channel.id);
            if (existingTimer) { clearTimeout(existingTimer); autoCloseTimers.delete(channel.id); }

            setTimeout(async () => {
                try { await channel.delete(`Ticket closed by ${user.tag}`); } catch (e) {}
            }, 5000);
            return;
        }
    },

    // ================= SELECT MENU + BUTTON HANDLER =================
    handleComponent: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T['en'];
        const db = client.db;
        const serverSettings = effectiveSettings(client.getServerSettings?.(interaction.guild?.id) || {}, interaction.guild?.id);

        // ---- SELECT MENU: CREATE TICKET ----
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_create_select') {
            const guild = interaction.guild;
            const user = interaction.user;
            const categoryValue = interaction.values[0];
            const categories = getCategories(serverSettings, lang);
            const category = categories.find(c => c.value === categoryValue) || categories[0];

            await interaction.deferReply({ ephemeral: true });

            // Check ticket limit
            const limit = serverSettings?.ticketLimitPerUser || 1;
            const userTicketCount = countUserTickets(guild.id, user.id);
            if (userTicketCount >= limit) {
                return interaction.editReply({ content: t.maxTickets(limit) }).catch(() => {});
            }

            // Check category is configured
            if (!serverSettings?.ticketCategory) {
                return interaction.editReply({ content: t.categoryNotSet }).catch(() => {});
            }

            try {
                const ticketChannel = await createTicketChannel(
                    guild, user.id, user.username, category, serverSettings, client
                );

                const counter = ticketCounters.get(guild.id) || 1;

                // Store ticket data (memory + DB)
                const ticketData = {
                    creatorId: user.id,
                    creatorTag: user.tag,
                    createdAt: Date.now(),
                    claimedBy: null,
                    category: `${category.emoji} ${category.label}`,
                    categoryValue: category.value,
                    guildId: guild.id,
                    number: counter,
                    participants: [user.id]
                };
                activeTickets.set(ticketChannel.id, ticketData);
                saveTicketToDB(db, ticketChannel.id, ticketData);

                // Send welcome message in ticket channel
                await buildTicketWelcome(ticketChannel, user, category, counter, serverSettings, lang);

                // Set auto-close timer
                resetAutoCloseTimer(ticketChannel.id, client, serverSettings);

                // Reply to user
                const replyEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setDescription(`${t.ticketCreated}\n\n👉 <#${ticketChannel.id}>`)
                    .setTimestamp();

                await interaction.editReply({ embeds: [replyEmbed] }).catch(() => {});

            } catch (err) {
                console.error('[TICKET CREATE]', err);
                await interaction.editReply({ content: t.createError }).catch(() => {});
            }

            return true; // handled
        }

        // ---- BUTTON HANDLERS ----
        if (!interaction.isButton()) return false;
        if (!interaction.customId.startsWith('ticket_')) return false;

        const parts = interaction.customId.split('_');
        const action = parts[1]; // claim, close, transcript
        const channelId = parts[2];
        const creatorId = parts[3];
        const userId = interaction.user.id;

        // Load ticket from memory, fallback to DB (survives restarts)
        let ticket = activeTickets.get(channelId);
        if (!ticket && db) {
            ticket = loadTicketFromDB(db, channelId);
            if (ticket) activeTickets.set(channelId, ticket);
        }

        // CROSS-SERVER GUARD: Verify interaction is happening in the ticket's guild
        // This prevents processed interactions from leaked messages or cross-posted embeds
        if (ticket && interaction.guildId !== ticket.guildId) {
            console.log(`[TICKET] BLOCKED cross-guild interaction: user ${userId} in guild ${interaction.guildId} tried to access ticket from guild ${ticket.guildId}`);
            return interaction.reply({ content: '❌ This ticket does not belong to this server.', ephemeral: true }).catch(() => {});
        }

        const isCreator = userId === creatorId;
        const isStaffMember = isStaff(interaction.member, serverSettings);

        // ---- CLAIM ----
        if (action === 'claim') {
            if (!isStaffMember) {
                return interaction.reply({ content: t.staffOnlyClaim, ephemeral: true }).catch(() => {});
            }
            if (ticket?.claimedBy) {
                return interaction.reply({ content: t.alreadyClaimed, ephemeral: true }).catch(() => {});
            }

            ticket.claimedBy = userId;
            if (db) saveTicketToDB(db, channelId, ticket);

            // Update welcome embed
            try {
                const messages = await interaction.channel.messages.fetch({ limit: 10 });
                const welcomeMsg = messages.find(m =>
                    m.author.id === client.user.id &&
                    m.embeds?.[0]?.author?.name?.includes('NEW TICKET')
                );
                if (welcomeMsg && welcomeMsg.embeds[0]) {
                    const oldEmbed = welcomeMsg.embeds[0];
                    const newEmbed = EmbedBuilder.from(oldEmbed)
                        .spliceFields(3, 1, { name: t.status, value: `${t.statusClaimed}\n${t.claimedBy}: <@${userId}>`, inline: true });
                    await welcomeMsg.edit({ embeds: [newEmbed] }).catch(() => {});
                }
            } catch (e) {}

            await interaction.channel.send(t.claimSuccess(userId));
            await interaction.reply({ content: `✅ You claimed this ticket.`, ephemeral: true }).catch(() => {});
            resetAutoCloseTimer(channelId, client, serverSettings);
            return true;
        }

        // ---- CLOSE (confirmation) ----
        if (action === 'close') {
            if (!isCreator && !isStaffMember) {
                return interaction.reply({ content: t.noPermission, ephemeral: true }).catch(() => {});
            }

            const confirmEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle(t.closeConfirmTitle)
                .setDescription(t.closeConfirmDesc);

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_confirmclose_${channelId}_${creatorId}_${userId}`)
                    .setLabel(t.confirmClose)
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`ticket_cancelclose_${channelId}_${creatorId}`)
                    .setLabel(t.cancel)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );

            await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true }).catch(() => {});
            return true;
        }

        // ---- CONFIRM CLOSE ----
        if (action === 'confirmclose') {
            const closerId = parts[4] || userId;
            await interaction.update({ content: t.closingTicket, embeds: [], components: [] }).catch(() => {});

            const channel = interaction.channel;

            // Save transcript before deleting
            if (ticket) {
                await saveTranscript(channel, ticket, closerId, client, serverSettings);
            }

            await channel.send(t.ticketClosedBy(closerId)).catch(() => {});
            activeTickets.delete(channelId);
            if (db) deleteTicketFromDB(db, channelId);

            const existingTimer = autoCloseTimers.get(channelId);
            if (existingTimer) { clearTimeout(existingTimer); autoCloseTimers.delete(channelId); }

            setTimeout(async () => {
                try { await channel.delete(`Ticket closed by ${interaction.user.tag}`); } catch (e) {}
            }, 5000);
            return true;
        }

        // ---- CANCEL CLOSE ----
        if (action === 'cancelclose') {
            await interaction.deleteReply().catch(() => {});
            return true;
        }

        // ---- TRANSCRIPT ----
        if (action === 'transcript') {
            if (!isCreator && !isStaffMember) {
                return interaction.reply({ content: t.noPermission, ephemeral: true }).catch(() => {});
            }

            await interaction.deferReply({ ephemeral: true });

            const channel = interaction.channel;
            if (!ticket) {
                return interaction.editReply({ content: '❌ Ticket data not found.' }).catch(() => {});
            }

            const result = await saveTranscript(channel, ticket, null, client, serverSettings);
            if (result === true) {
                await interaction.editReply({ content: t.transcriptSaved }).catch(() => {});
            } else if (result && result.buffer) {
                await interaction.editReply({
                    content: t.transcriptSaved,
                    files: [{ attachment: result.buffer, name: result.filename }]
                }).catch(() => {});
            } else {
                await interaction.editReply({ content: '❌ Failed to generate transcript.' }).catch(() => {});
            }

            resetAutoCloseTimer(channelId, client, serverSettings);
            return true;
        }

        return false;
    },

    // DB persistence
    setupTicketDB,
    loadAllTicketsFromDB
};