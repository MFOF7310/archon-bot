const {
    EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder,
    ButtonStyle, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder
} = require('discord.js');

// ================= ENV FALLBACK HELPERS =================
function effectiveSettings(serverSettings, guildId) {
    const isOwnerServer = guildId === process.env.GUILD_ID;
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
            creatorId: row.creator_id, creatorTag: row.creator_tag, createdAt: row.created_at,
            claimedBy: row.claimed_by, category: row.category, categoryValue: row.category_value,
            guildId: row.guild_id, number: row.ticket_number,
            participants: JSON.parse(row.participants || '[]')
        };
    } catch (e) {
        console.error('[TICKET DB] Load failed:', e.message);
        return null;
    }
}

function loadAllTicketsFromDB(database, client) {
    try {
        const botGuildIds = client ? Array.from(client.guilds.cache.keys()) : [];
        if (botGuildIds.length === 0) { console.log('[TICKET DB] Bot guild cache empty, skipping restore'); return; }
        const placeholders = botGuildIds.map(() => '?').join(',');
        const rows = database.prepare(`SELECT * FROM tickets WHERE guild_id IN (${placeholders})`).all(...botGuildIds);
        for (const row of rows) {
            activeTickets.set(row.channel_id, {
                creatorId: row.creator_id, creatorTag: row.creator_tag, createdAt: row.created_at,
                claimedBy: row.claimed_by, category: row.category, categoryValue: row.category_value,
                guildId: row.guild_id, number: row.ticket_number,
                participants: JSON.parse(row.participants || '[]')
            });
        }
        const skipped = database.prepare(`SELECT COUNT(*) as c FROM tickets WHERE guild_id NOT IN (${placeholders})`).get(...botGuildIds);
        if (skipped && skipped.c > 0) {
            database.prepare(`DELETE FROM tickets WHERE guild_id NOT IN (${placeholders})`).run(...botGuildIds);
            console.log(`[TICKET DB] Cleaned up ${skipped.c} orphaned tickets`);
        }
        if (rows.length > 0) console.log(`[TICKET DB] Restored ${rows.length} active tickets`);
    } catch (e) { console.error('[TICKET DB] Load all failed:', e.message); }
}

function deleteTicketFromDB(database, channelId) {
    try { database.prepare(`DELETE FROM tickets WHERE channel_id = ?`).run(channelId); }
    catch (e) { console.error('[TICKET DB] Delete failed:', e.message); }
}

// ================= STATE =================
const ticketCounters = new Map();
const activeTickets = new Map();
const autoCloseTimers = new Map();

// ================= DEFAULT CATEGORIES =================
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
        setupTitle: '🎫 TICKET SYSTEM SETUP',
        setupComplete: '✅ **Ticket system configured successfully!**\n\nUse the commands below to manage your configuration:',
        setupUsage: (p) => `**Configuration Commands:**\n\`${p}ticket setcategory <category-id>\` — Set ticket archive category\n\`${p}ticket setstaffrole <role-id>\` — Set staff role\n\`${p}ticket settranscript <channel-id>\` — Set transcript channel\n\`${p}ticket setautoclose <hours>\` — Auto-close inactive tickets (default: 24h)\n\`${p}ticket setlimit <1-10>\` — Max tickets per user (default: 1)\n\`${p}ticket config\` — View current configuration\n\n**Next step:** \`${p}ticket panel\` to post the ticket creation embed.`,
        panelTitle: '🎫 SUPPORT CENTER',
        panelDescription: (guild) => `Welcome to **${guild}** Support Center!\n\nOur team is ready to assist you. Please select a category from the dropdown below to open a ticket.\n\n**•** Be clear and detailed about your issue\n**•** One ticket per topic\n**•** Our team will respond as soon as possible`,
        panelFooter: 'Select a category to open a ticket',
        ticketCreated: '✅ Your ticket has been created!',
        ticketWelcomeTitle: '🎫 NEW TICKET OPENED',
        ticketWelcomeDesc: (user, category) => `Welcome <@${user}>!\n\nA support agent will be with you shortly. Please describe your issue in detail so we can assist you as quickly as possible.\n\n**Category:** ${category}`,
        ticketWelcomeFooter: 'Use the buttons below to manage this ticket',
        claimButton: '🙋 Claim', closeButton: '🔒 Close', transcriptButton: '📄 Transcript', addUserButton: '➕ Add User',
        claimSuccess: (user) => `🙋 <@${user}> has claimed this ticket and will be assisting you.`,
        alreadyClaimed: '❌ This ticket is already claimed.', staffOnlyClaim: '❌ Only staff members can claim tickets.',
        closeConfirmTitle: '🔒 Close Ticket?', closeConfirmDesc: 'Are you sure you want to close this ticket? This action cannot be undone.',
        confirmClose: '✅ Yes, Close', cancel: '❌ Cancel', closingTicket: '🔒 Closing ticket in 5 seconds...',
        ticketClosedBy: (user) => `🔒 Ticket closed by <@${user}>`,
        ticketClosedLog: (user, closer, category) => `**Ticket Closed**\n**Creator:** <@${user}>\n**Closed By:** <@${closer}>\n**Category:** ${category}`,
        transcriptSaved: '📄 Transcript saved and uploaded!',
        noPermission: '❌ Only the ticket creator or staff can use this.', staffOnly: '❌ Only staff members can perform this action.',
        noTicketChannel: '❌ This ticket channel no longer exists.',
        categoryNotSet: '⚠️ **Ticket system not configured.**\nAn admin needs to run `.ticket setcategory <category-id>` first.',
        createError: '❌ Failed to create ticket channel. Check bot permissions.',
        maxTickets: (limit) => `❌ You can only have ${limit} active ticket(s) at a time. Please close an existing ticket first.`,
        createdBy: 'Created By', createdAt: 'Created', claimedBy: 'Claimed By', category: 'Category', status: 'Status',
        statusOpen: '🟢 Open', statusClaimed: '🟡 Claimed', statusClosing: '🔴 Closing', ticketNum: 'Ticket #',
        autoCloseWarning: '⚠️ This ticket will auto-close in 1 hour due to inactivity.',
        autoCloseNotice: '🔒 This ticket has been automatically closed due to inactivity.',
        // Config view
        configTitle: '🎫 TICKET SYSTEM CONFIGURATION',
        configCategory: 'Archive Category',
        configStaffRole: 'Staff Role',
        configTranscript: 'Transcript Channel',
        configLog: 'Log Channel',
        configAutoClose: 'Auto-Close',
        configLimit: 'Limit Per User',
        configNotSet: 'Not set',
        configEnabled: 'Enabled',
        configDisabled: 'Disabled',
        configFooter: '🦅 ARCHON CG-223 • Ticket System',
        // Config set responses
        setSuccess: (s, v) => `✅ **${s}** set to ${v}`,
        invalidChannel: '❌ Channel not found.',
        invalidRole: '❌ Role not found.',
        invalidNumber: '❌ Invalid number.',
        needAdmin: '❌ Administrator permission required.',
    },
    fr: {
        setupTitle: '🎫 CONFIGURATION DU SYSTÈME DE TICKETS',
        setupComplete: '✅ **Système de tickets configuré avec succès !**\n\nUtilisez les commandes ci-dessous pour gérer votre configuration :',
        setupUsage: (p) => `**Commandes de Configuration :**\n\`${p}ticket setcategory <id-catégorie>\` — Définir la catégorie\n\`${p}ticket setstaffrole <id-rôle>\` — Définir le rôle staff\n\`${p}ticket settranscript <id-salon>\` — Définir le salon de transcription\n\`${p}ticket setautoclose <heures>\` — Fermeture auto (défaut: 24h)\n\`${p}ticket setlimit <1-10>\` — Max tickets par utilisateur\n\`${p}ticket config\` — Voir la configuration\n\n**Prochaine étape :** \`${p}ticket panel\` pour publier l'embed.`,
        panelTitle: '🎫 CENTRE DE SUPPORT',
        panelDescription: (guild) => `Bienvenue au Centre de Support de **${guild}** !\n\nNotre équipe est prête à vous aider. Sélectionnez une catégorie dans le menu ci-dessous pour ouvrir un ticket.\n\n**•** Soyez clair et précis sur votre problème\n**•** Un ticket par sujet\n**•** Notre équipe répondra dès que possible`,
        panelFooter: 'Sélectionnez une catégorie pour ouvrir un ticket',
        ticketCreated: '✅ Votre ticket a été créé !',
        ticketWelcomeTitle: '🎫 NOUVEAU TICKET OUVERT',
        ticketWelcomeDesc: (user, category) => `Bienvenue <@${user}> !\n\nUn agent de support vous assistera sous peu. Veuillez décrire votre problème en détail pour que nous puissions vous aider le plus rapidement possible.\n\n**Catégorie :** ${category}`,
        ticketWelcomeFooter: 'Utilisez les boutons ci-dessous pour gérer ce ticket',
        claimButton: '🙋 Prendre en charge', closeButton: '🔒 Fermer', transcriptButton: '📄 Transcription', addUserButton: '➕ Ajouter',
        claimSuccess: (user) => `🙋 <@${user}> a pris ce ticket en charge et va vous assister.`,
        alreadyClaimed: '❌ Ce ticket est déjà pris en charge.', staffOnlyClaim: '❌ Seuls les membres du staff peuvent prendre des tickets.',
        closeConfirmTitle: '🔒 Fermer le ticket ?', closeConfirmDesc: 'Êtes-vous sûr de vouloir fermer ce ticket ? Cette action est irréversible.',
        confirmClose: '✅ Oui, Fermer', cancel: '❌ Annuler', closingTicket: '🔒 Fermeture du ticket dans 5 secondes...',
        ticketClosedBy: (user) => `🔒 Ticket fermé par <@${user}>`,
        ticketClosedLog: (user, closer, category) => `**Ticket Fermé**\n**Créateur :** <@${user}>\n**Fermé par :** <@${closer}>\n**Catégorie :** ${category}`,
        transcriptSaved: '📄 Transcription enregistrée et téléchargée !',
        noPermission: '❌ Seul le créateur du ticket ou le staff peut utiliser ceci.', staffOnly: '❌ Seuls les membres du staff peuvent effectuer cette action.',
        noTicketChannel: '❌ Ce salon de ticket n\'existe plus.',
        categoryNotSet: '⚠️ **Système de tickets non configuré.**\nUn administrateur doit d\'abord exécuter `.ticket setcategory <id-catégorie>`.',
        createError: '❌ Échec de création du salon ticket. Vérifiez les permissions du bot.',
        maxTickets: (limit) => `❌ Vous ne pouvez avoir que ${limit} ticket(s) actif(s) à la fois. Veuillez fermer un ticket existant d'abord.`,
        createdBy: 'Créé Par', createdAt: 'Créé', claimedBy: 'Pris Par', category: 'Catégorie', status: 'Statut',
        statusOpen: '🟢 Ouvert', statusClaimed: '🟡 Pris', statusClosing: '🔴 Fermeture', ticketNum: 'Ticket #',
        autoCloseWarning: '⚠️ Ce ticket se fermera automatiquement dans 1 heure pour inactivité.',
        autoCloseNotice: '🔒 Ce ticket a été fermé automatiquement pour inactivité.',
        configTitle: '🎫 CONFIGURATION DU SYSTÈME DE TICKETS',
        configCategory: 'Catégorie d\'Archivage',
        configStaffRole: 'Rôle Staff',
        configTranscript: 'Salon Transcriptions',
        configLog: 'Salon Logs',
        configAutoClose: 'Fermeture Auto',
        configLimit: 'Limite par Utilisateur',
        configNotSet: 'Non défini',
        configEnabled: 'Activé',
        configDisabled: 'Désactivé',
        configFooter: '🦅 ARCHON CG-223 • Système de Tickets',
        setSuccess: (s, v) => `✅ **${s}** défini sur ${v}`,
        invalidChannel: '❌ Salon introuvable.',
        invalidRole: '❌ Rôle introuvable.',
        invalidNumber: '❌ Nombre invalide.',
        needAdmin: '❌ Permission administrateur requise.',
    }
};

// ================= HELPERS =================
function getCategories(settings, lang = 'en') {
    const configured = settings?.ticketCategoriesConfig;
    if (configured && Array.isArray(configured) && configured.length > 0) return configured;
    return DEFAULT_CATEGORIES;
}

function isStaff(member, settings) {
    if (!member) return false;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions?.has(PermissionFlagsBits.ManageMessages)) return true;
    if (settings?.ticketStaffRole && member.roles?.cache?.has(settings.ticketStaffRole)) return true;
    return false;
}

function countUserTickets(guildId, userId) {
    let count = 0;
    for (const [_, ticket] of activeTickets) {
        if (ticket.guildId === guildId && ticket.creatorId === userId) count++;
    }
    return count;
}

function resetAutoCloseTimer(channelId, client, settings) {
    const existing = autoCloseTimers.get(channelId);
    if (existing) { clearTimeout(existing); autoCloseTimers.delete(channelId); }

    const hours = settings?.ticketAutoCloseHours || 24;
    if (hours <= 0) return;

    const ms = hours * 3600000;
    const warningMs = ms - 3600000;

    if (warningMs > 0) {
        setTimeout(async () => {
            try {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (channel && activeTickets.has(channelId)) {
                    await channel.send({ embeds: [new EmbedBuilder().setColor('#f39c12').setDescription(T.en.autoCloseWarning)] }).catch(() => {});
                }
            } catch (e) {}
        }, warningMs);
    }

    const timer = setTimeout(async () => {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel && activeTickets.has(channelId)) {
                await channel.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(T.en.autoCloseNotice)] }).catch(() => {});
                activeTickets.delete(channelId);
                setTimeout(async () => { try { await channel.delete('Auto-closed due to inactivity'); } catch (e) {} }, 5000);
            }
        } catch (e) {}
        autoCloseTimers.delete(channelId);
    }, ms);

    autoCloseTimers.set(channelId, timer);
}

async function saveTranscript(channel, ticket, closerId, client, settings) {
    const t = T.en;
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

        const transcriptChanId = settings?.ticketTranscriptChannel;
        if (transcriptChanId) {
            try {
                const transcriptChan = await client.channels.fetch(transcriptChanId);
                if (transcriptChan?.guildId !== ticket.guildId) {
                    console.log(`[TICKET TRANSCRIPT] BLOCKED: Cross-guild channel attempt`);
                } else if (transcriptChan && (transcriptChan.type === ChannelType.GuildText || transcriptChan.type === 5)) {
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
                }
            } catch (e) { console.log(`[TICKET TRANSCRIPT] Could not send: ${e.message}`); }
        }
        return { buffer: Buffer.from(transcript), filename: `ticket-${ticket.number || channel.id}.txt` };
    } catch (e) { console.error('[TICKET TRANSCRIPT]', e.message); return false; }
}

async function createTicketChannel(guild, userId, username, category, settings, client) {
    const guildId = guild.id;
    const counter = (ticketCounters.get(guildId) || 0) + 1;
    ticketCounters.set(guildId, counter);
    const categoryData = typeof category === 'object' ? category : { emoji: '🎫', label: 'Support', value: 'general' };
    const channelName = `ticket-${counter}-${username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 100);
    const ticketCategoryId = settings?.ticketCategory;

    const overwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] }
    ];

    if (settings?.ticketStaffRole) {
        const role = guild.roles.cache.get(settings.ticketStaffRole);
        if (role) {
            overwrites.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] });
        }
    }

    const adminRole = guild.roles.cache.find(r => r.permissions?.has(PermissionFlagsBits.Administrator));
    if (adminRole && !overwrites.some(o => o.id === adminRole.id)) {
        overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] });
    }

    const options = {
        name: channelName, type: ChannelType.GuildText,
        permissionOverwrites: overwrites,
        topic: `Ticket #${counter} | ${categoryData.emoji} ${categoryData.label} | Created by ${username}`,
    };
    if (ticketCategoryId && guild.channels.cache.get(ticketCategoryId)) options.parent = ticketCategoryId;
    return guild.channels.create(options);
}

function buildPanelEmbed(settings, guildName, lang = 'en') {
    const t = T[lang] || T.en;
    const categories = getCategories(settings, lang);
    const catList = categories.map(c => `${c.emoji} **${c.label}** — ${c.description}`).join('\n');
    return new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: t.panelTitle, iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.webp' })
        .setDescription(t.panelDescription(guildName) + '\n\n**Available Categories:**\n' + catList)
        .addFields(
            { name: '📋 How it Works', value: 'Select a category below to create a private support channel. Only you and our support team can see it.', inline: false },
            { name: '⏰ Response Time', value: 'Our team typically responds within a few minutes during active hours.', inline: true },
            { name: '💾 Transcripts', value: 'All ticket conversations are saved and can be downloaded as transcripts.', inline: true }
        )
        .setFooter({ text: t.panelFooter })
        .setTimestamp();
}

function buildSelectMenu(settings, disabled = false) {
    const categories = getCategories(settings);
    const select = new StringSelectMenuBuilder()
        .setCustomId('ticket_create_select')
        .setPlaceholder('🎫 Select a category to open a ticket...')
        .setDisabled(disabled);
    for (const cat of categories) {
        select.addOptions({ label: `${cat.emoji} ${cat.label}`, description: cat.description.substring(0, 100), value: cat.value, emoji: cat.emoji });
    }
    return select;
}

async function buildTicketWelcome(channel, user, category, ticketNum, settings, lang = 'en') {
    const t = T[lang] || T.en;
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
        new ButtonBuilder().setCustomId(`ticket_claim_${channel.id}_${user.id}`).setLabel(t.claimButton).setStyle(ButtonStyle.Primary).setEmoji('🙋'),
        new ButtonBuilder().setCustomId(`ticket_close_${channel.id}_${user.id}`).setLabel(t.closeButton).setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId(`ticket_transcript_${channel.id}_${user.id}`).setLabel(t.transcriptButton).setStyle(ButtonStyle.Secondary).setEmoji('📄')
    );
    await channel.send({ content: `<@${user.id}>`, embeds: [embed], components: [row1] });
}

// ================= CONFIG EMBED BUILDER =================
function buildConfigEmbed(settings, guild, client, lang = 'en') {
    const t = T[lang] || T.en;
    const isOwnerServer = guild.id === process.env.GUILD_ID;

    const fmtChannel = (id, envKey) => {
        if (id) return `<#${id}>`;
        if (isOwnerServer && envKey && process.env[envKey]) return `<#${process.env[envKey]}> 🔹 .env`;
        return `*${t.configNotSet}*`;
    };
    const fmtRole = (id, envKey) => {
        if (id) return `<@&${id}>`;
        if (isOwnerServer && envKey && process.env[envKey]) return `<@&${process.env[envKey]}> 🔹 .env`;
        return `*${t.configNotSet}*`;
    };
    const autoClose = settings?.ticketAutoCloseHours ?? 24;
    const limit = settings?.ticketLimitPerUser ?? 1;

    return new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: `🦅 ${t.configTitle}`, iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() })
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
        .addFields(
            { name: '📁 ' + t.configCategory, value: fmtChannel(settings?.ticketCategory, 'TICKET_CATEGORY_ID'), inline: true },
            { name: '🛡️ ' + t.configStaffRole, value: fmtRole(settings?.ticketStaffRole, 'TICKET_STAFF_ROLE_ID'), inline: true },
            { name: '📄 ' + t.configTranscript, value: fmtChannel(settings?.ticketTranscriptChannel, 'TICKET_TRANSCRIPT_CHANNEL_ID'), inline: true },
            { name: '📋 ' + t.configLog, value: fmtChannel(settings?.ticketLogChannel, 'TICKET_LOG_CHANNEL_ID'), inline: true },
            { name: '⏰ ' + t.configAutoClose, value: autoClose === 0 ? `❌ ${t.configDisabled}` : `\`${autoClose}h\``, inline: true },
            { name: '🔢 ' + t.configLimit, value: `\`${limit}\` per user`, inline: true }
        )
        .setFooter({ text: `${t.configFooter} • ${guild.name}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
}

// ================= SAVE TICKET SETTING HELPER =================
async function saveTicketSetting(client, guildId, key, value, lang = 'en') {
    const t = T[lang] || T.en;
    try {
        const success = client.updateServerSetting(guildId, key, value);
        if (success) {
            client.settings?.delete(guildId);
            return { success: true, message: t.setSuccess(key, value) };
        }
        return { success: false, error: '❌ Database error.' };
    } catch (e) {
        return { success: false, error: '❌ Database error.' };
    }
}

// ================= MODULE =================
module.exports = {
    name: 'ticket',
    aliases: ['tickets', 'support'],
    description: '🎫 Professional ticket system with panel, dropdown categories, auto-close, transcripts, and independent config.',
    category: 'UTILITY',
    cooldown: 5000,
    usage: '.ticket [panel|close|setup|config|setcategory|setstaffrole|settranscript|setautoclose|setlimit]',
    examples: ['.ticket panel', '.ticket setup', '.ticket close', '.ticket config', '.ticket setcategory 123456', '/ticket'],

    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('🎫 Professional ticket system — create, manage, and configure support tickets')
        .addSubcommand(sub => sub.setName('panel').setDescription('Post the ticket creation panel'))
        .addSubcommand(sub => sub.setName('close').setDescription('Close the current ticket'))
        .addSubcommand(sub => sub.setName('setup').setDescription('Show setup instructions'))
        .addSubcommand(sub => sub.setName('config').setDescription('View current ticket configuration'))
        .addSubcommand(sub => sub.setName('setcategory').setDescription('Set ticket archive category')
            .addChannelOption(opt => opt.setName('category').setDescription('Category to create tickets under').setRequired(true).addChannelTypes(ChannelType.GuildCategory)))
        .addSubcommand(sub => sub.setName('setstaffrole').setDescription('Set staff role for ticket access')
            .addRoleOption(opt => opt.setName('role').setDescription('Role that can manage tickets').setRequired(true)))
        .addSubcommand(sub => sub.setName('settranscript').setDescription('Set transcript/log channel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel for ticket transcripts').setRequired(true).addChannelTypes(ChannelType.GuildText, 5)))
        .addSubcommand(sub => sub.setName('setautoclose').setDescription('Set auto-close hours for inactive tickets')
            .addIntegerOption(opt => opt.setName('hours').setDescription('Hours before auto-close (0=disabled)').setRequired(true).setMinValue(0).setMaxValue(168)))
        .addSubcommand(sub => sub.setName('setlimit').setDescription('Set max tickets per user')
            .addIntegerOption(opt => opt.setName('limit').setDescription('Max active tickets per user (1-10)').setRequired(true).setMinValue(1).setMaxValue(10))),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings) => {
        const lang = client.detectLanguage ? client.detectLanguage(args[0] || '') : 'en';
        const t = T[lang] || T.en;
        const sub = args[0]?.toLowerCase();
        const guild = message.guild;
        const user = message.author;
        const prefix = serverSettings?.prefix || '.';

        if (!guild) return message.reply('❌ Tickets only work in servers.').catch(() => {});

        // Admin check for config commands
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
        const needsAdmin = ['setcategory', 'setstaffrole', 'settranscript', 'setautoclose', 'setlimit', 'panel'].includes(sub);
        if (needsAdmin && !isAdmin) {
            return message.reply({ content: t.needAdmin, allowedMentions: { parse: [] } }).catch(() => {});
        }

        // Apply env fallback
        const effSettings = effectiveSettings(serverSettings, guild.id);

        // ---- SETCATEGORY ----
        if (sub === 'setcategory') {
            const catId = args[1]?.replace(/[<#>]/g, '');
            if (!catId) return message.reply('⚠️ Usage: `.ticket setcategory <category-id>`').catch(() => {});
            const category = guild.channels.cache.get(catId);
            if (!category || category.type !== ChannelType.GuildCategory) return message.reply(t.invalidChannel).catch(() => {});
            const result = await saveTicketSetting(client, guild.id, 'ticketcategory', catId, lang);
            return message.reply(result.success ? result.message : result.error).catch(() => {});
        }

        // ---- SETSTAFFROLE ----
        if (sub === 'setstaffrole') {
            const roleId = args[1]?.replace(/[<@&>]/g, '');
            if (!roleId) return message.reply('⚠️ Usage: `.ticket setstaffrole <role-id>`').catch(() => {});
            const role = guild.roles.cache.get(roleId);
            if (!role) return message.reply(t.invalidRole).catch(() => {});
            const result = await saveTicketSetting(client, guild.id, 'ticketstaffrole', roleId, lang);
            return message.reply(result.success ? result.message : result.error).catch(() => {});
        }

        // ---- SETTRANSCRIPT ----
        if (sub === 'settranscript') {
            const chanId = args[1]?.replace(/[<#>]/g, '');
            if (!chanId) return message.reply('⚠️ Usage: `.ticket settranscript <channel-id>`').catch(() => {});
            const channel = guild.channels.cache.get(chanId);
            if (!channel) return message.reply(t.invalidChannel).catch(() => {});
            const result = await saveTicketSetting(client, guild.id, 'tickettranscriptchannel', chanId, lang);
            return message.reply(result.success ? result.message : result.error).catch(() => {});
        }

        // ---- SETAUTOCLOSE ----
        if (sub === 'setautoclose') {
            const hours = parseInt(args[1]);
            if (isNaN(hours) || hours < 0 || hours > 168) return message.reply(t.invalidNumber + ' (0-168)').catch(() => {});
            const result = await saveTicketSetting(client, guild.id, 'ticketautoclose', String(hours), lang);
            return message.reply(result.success ? result.message : result.error).catch(() => {});
        }

        // ---- SETLIMIT ----
        if (sub === 'setlimit') {
            const limit = parseInt(args[1]);
            if (isNaN(limit) || limit < 1 || limit > 10) return message.reply(t.invalidNumber + ' (1-10)').catch(() => {});
            const result = await saveTicketSetting(client, guild.id, 'ticketlimit', String(limit), lang);
            return message.reply(result.success ? result.message : result.error).catch(() => {});
        }

        // ---- CONFIG (view) ----
        if (sub === 'config') {
            const embed = buildConfigEmbed(effSettings, guild, client, lang);
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // Check if ticket category is set (for panel/close operations)
        if (!effSettings?.ticketCategory) {
            if (sub !== 'setup') {
                return message.reply({ content: t.categoryNotSet, allowedMentions: { parse: [] } }).catch(() => {});
            }
        }

        // ---- SETUP ----
        if (sub === 'setup') {
            const embed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: `🦅 ${t.setupTitle}`, iconURL: client.user.displayAvatarURL() })
                .setDescription(t.setupComplete + '\n\n' + t.setupUsage(prefix))
                .setFooter({ text: `🦅 ARCHON CG-223 • ${guild.name}`, iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
            return message.reply({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
        }

        // ---- PANEL ----
        if (sub === 'panel') {
            const embed = buildPanelEmbed(effSettings, guild.name, lang);
            const select = buildSelectMenu(effSettings);
            const row = new ActionRowBuilder().addComponents(select);
            const sent = await message.channel.send({ embeds: [embed], components: [row] }).catch(() => null);
            if (sent) {
                await message.react('✅').catch(() => {});
                try { db.prepare(`INSERT OR REPLACE INTO server_settings (guild_id, ticket_panel_channel) VALUES (?, ?)`).run(guild.id, sent.id); } catch (e) {}
            }
            return;
        }

        // ---- CLOSE ----
        if (sub === 'close') {
            const channel = message.channel;
            const ticket = activeTickets.get(channel.id);
            if (!ticket) return message.reply({ content: '❌ This is not an active ticket channel.', allowedMentions: { parse: [] } }).catch(() => {});
            const isCreator = message.author.id === ticket.creatorId;
            const isStaffMember = isStaff(message.member, effSettings);
            if (!isCreator && !isStaffMember) return message.reply({ content: t.noPermission, allowedMentions: { parse: [] } }).catch(() => {});
            await saveTranscript(channel, ticket, message.author.id, client, effSettings);
            await message.reply({ content: t.closingTicket, allowedMentions: { parse: [] } }).catch(() => {});
            activeTickets.delete(channel.id);
            if (db) deleteTicketFromDB(db, channel.id);
            const existingTimer = autoCloseTimers.get(channel.id);
            if (existingTimer) { clearTimeout(existingTimer); autoCloseTimers.delete(channel.id); }
            setTimeout(async () => { try { await channel.delete(`Ticket closed by ${message.author.tag}`); } catch (e) {} }, 5000);
            return;
        }

        // Default: show help
        const helpEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: `🦅 ${t.panelTitle}`, iconURL: client.user.displayAvatarURL() })
            .setDescription(
                `**🎫 Ticket System Commands**\n\n` +
                `\`${prefix}ticket panel\` — Post the ticket panel embed\n` +
                `\`${prefix}ticket setup\` — Show setup instructions\n` +
                `\`${prefix}ticket close\` — Close current ticket\n` +
                `\`${prefix}ticket config\` — View ticket configuration\n` +
                `\`${prefix}ticket setcategory <id>\` — Set archive category\n` +
                `\`${prefix}ticket setstaffrole <id>\` — Set staff role\n` +
                `\`${prefix}ticket settranscript <id>\` — Set transcript channel\n` +
                `\`${prefix}ticket setautoclose <hours>\` — Set auto-close timer\n` +
                `\`${prefix}ticket setlimit <1-10>\` — Set max tickets per user\n\n` +
                `Users create tickets via the panel dropdown.`
            )
            .setFooter({ text: `🦅 ARCHON CG-223 • ${guild.name}`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        message.reply({ embeds: [helpEmbed], allowedMentions: { parse: [] } }).catch(() => {});
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const user = interaction.user;
        const db = client.db;
        const serverSettings = effectiveSettings(client.getServerSettings?.(guild?.id) || {}, guild?.id);

        if (!guild) return interaction.reply({ content: '❌ Tickets only work in servers.', ephemeral: true });

        // Admin check for config commands
        const isAdmin = interaction.member.permissions?.has(PermissionFlagsBits.Administrator);
        const needsAdmin = ['setcategory', 'setstaffrole', 'settranscript', 'setautoclose', 'setlimit', 'panel'].includes(subcommand);
        if (needsAdmin && !isAdmin) return interaction.reply({ content: t.needAdmin, ephemeral: true });

        // ---- SETCATEGORY ----
        if (subcommand === 'setcategory') {
            const category = interaction.options.getChannel('category');
            if (!category || category.type !== ChannelType.GuildCategory) return interaction.reply({ content: t.invalidChannel, ephemeral: true });
            const result = await saveTicketSetting(client, guild.id, 'ticketcategory', category.id, lang);
            return interaction.reply({ content: result.success ? result.message : result.error, ephemeral: true });
        }

        // ---- SETSTAFFROLE ----
        if (subcommand === 'setstaffrole') {
            const role = interaction.options.getRole('role');
            if (!role) return interaction.reply({ content: t.invalidRole, ephemeral: true });
            const result = await saveTicketSetting(client, guild.id, 'ticketstaffrole', role.id, lang);
            return interaction.reply({ content: result.success ? result.message : result.error, ephemeral: true });
        }

        // ---- SETTRANSCRIPT ----
        if (subcommand === 'settranscript') {
            const channel = interaction.options.getChannel('channel');
            if (!channel) return interaction.reply({ content: t.invalidChannel, ephemeral: true });
            const result = await saveTicketSetting(client, guild.id, 'tickettranscriptchannel', channel.id, lang);
            return interaction.reply({ content: result.success ? result.message : result.error, ephemeral: true });
        }

        // ---- SETAUTOCLOSE ----
        if (subcommand === 'setautoclose') {
            const hours = interaction.options.getInteger('hours');
            const result = await saveTicketSetting(client, guild.id, 'ticketautoclose', String(hours), lang);
            return interaction.reply({ content: result.success ? result.message : result.error, ephemeral: true });
        }

        // ---- SETLIMIT ----
        if (subcommand === 'setlimit') {
            const limit = interaction.options.getInteger('limit');
            const result = await saveTicketSetting(client, guild.id, 'ticketlimit', String(limit), lang);
            return interaction.reply({ content: result.success ? result.message : result.error, ephemeral: true });
        }

        // ---- CONFIG (view) ----
        if (subcommand === 'config') {
            const embed = buildConfigEmbed(serverSettings, guild, client, lang);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Check ticket category is set
        if (!serverSettings?.ticketCategory && subcommand !== 'setup') {
            return interaction.reply({ content: t.categoryNotSet, ephemeral: true });
        }

        // ---- SETUP ----
        if (subcommand === 'setup') {
            const embed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: `🦅 ${t.setupTitle}`, iconURL: client.user.displayAvatarURL() })
                .setDescription(t.setupComplete + '\n\n' + t.setupUsage('/'))
                .setFooter({ text: `🦅 ARCHON CG-223 • ${guild.name}`, iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // ---- PANEL ----
        if (subcommand === 'panel') {
            const embed = buildPanelEmbed(serverSettings, guild.name, lang);
            const select = buildSelectMenu(serverSettings);
            const row = new ActionRowBuilder().addComponents(select);
            await interaction.reply({ content: 'Posting ticket panel...', ephemeral: true });
            const sent = await interaction.channel.send({ embeds: [embed], components: [row] }).catch(() => null);
            if (sent) {
                await interaction.editReply({ content: '✅ Ticket panel posted!' }).catch(() => {});
                try { db.prepare(`UPDATE server_settings SET ticket_panel_channel = ? WHERE guild_id = ?`).run(sent.id, guild.id); } catch (e) {}
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
            if (!isCreator && !isStaffMember) return interaction.reply({ content: t.noPermission, ephemeral: true });
            await interaction.deferReply();
            await saveTranscript(channel, ticket, user.id, client, serverSettings);
            await interaction.editReply({ content: t.closingTicket }).catch(() => {});
            activeTickets.delete(channel.id);
            if (db) deleteTicketFromDB(db, channel.id);
            const existingTimer = autoCloseTimers.get(channel.id);
            if (existingTimer) { clearTimeout(existingTimer); autoCloseTimers.delete(channel.id); }
            setTimeout(async () => { try { await channel.delete(`Ticket closed by ${user.tag}`); } catch (e) {} }, 5000);
            return;
        }
    },

    // ================= SELECT MENU + BUTTON HANDLER =================
    handleComponent: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang] || T.en;
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

            const limit = serverSettings?.ticketLimitPerUser || 1;
            const userTicketCount = countUserTickets(guild.id, user.id);
            if (userTicketCount >= limit) return interaction.editReply({ content: t.maxTickets(limit) }).catch(() => {});

            if (!serverSettings?.ticketCategory) return interaction.editReply({ content: t.categoryNotSet }).catch(() => {});

            try {
                const ticketChannel = await createTicketChannel(guild, user.id, user.username, category, serverSettings, client);
                const counter = ticketCounters.get(guild.id) || 1;
                const ticketData = {
                    creatorId: user.id, creatorTag: user.tag, createdAt: Date.now(),
                    claimedBy: null, category: `${category.emoji} ${category.label}`,
                    categoryValue: category.value, guildId: guild.id, number: counter,
                    participants: [user.id]
                };
                activeTickets.set(ticketChannel.id, ticketData);
                saveTicketToDB(db, ticketChannel.id, ticketData);
                await buildTicketWelcome(ticketChannel, user, category, counter, serverSettings, lang);
                resetAutoCloseTimer(ticketChannel.id, client, serverSettings);
                const replyEmbed = new EmbedBuilder().setColor('#2ecc71').setDescription(`${t.ticketCreated}\n\n👉 <#${ticketChannel.id}>`).setTimestamp();
                await interaction.editReply({ embeds: [replyEmbed] }).catch(() => {});
            } catch (err) {
                console.error('[TICKET CREATE]', err);
                await interaction.editReply({ content: t.createError }).catch(() => {});
            }
            return true;
        }

        // ---- BUTTON HANDLERS ----
        if (!interaction.isButton()) return false;
        if (!interaction.customId.startsWith('ticket_')) return false;

        const parts = interaction.customId.split('_');
        const action = parts[1];
        const channelId = parts[2];
        const creatorId = parts[3];
        const userId = interaction.user.id;

        let ticket = activeTickets.get(channelId);
        if (!ticket && db) {
            ticket = loadTicketFromDB(db, channelId);
            if (ticket) activeTickets.set(channelId, ticket);
        }

        if (ticket && interaction.guildId !== ticket.guildId) {
            console.log(`[TICKET] BLOCKED cross-guild interaction: user ${userId}`);
            return interaction.reply({ content: '❌ This ticket does not belong to this server.', ephemeral: true }).catch(() => {});
        }

        const isCreator = userId === creatorId;
        const isStaffMember = isStaff(interaction.member, serverSettings);

        // ---- CLAIM ----
        if (action === 'claim') {
            if (!isStaffMember) return interaction.reply({ content: t.staffOnlyClaim, ephemeral: true }).catch(() => {});
            if (ticket?.claimedBy) return interaction.reply({ content: t.alreadyClaimed, ephemeral: true }).catch(() => {});
            ticket.claimedBy = userId;
            if (db) saveTicketToDB(db, channelId, ticket);
            try {
                const messages = await interaction.channel.messages.fetch({ limit: 10 });
                const welcomeMsg = messages.find(m => m.author.id === client.user.id && m.embeds?.[0]?.author?.name?.includes('NEW TICKET'));
                if (welcomeMsg && welcomeMsg.embeds[0]) {
                    const newEmbed = EmbedBuilder.from(welcomeMsg.embeds[0]).spliceFields(3, 1, { name: t.status, value: `${t.statusClaimed}\n${t.claimedBy}: <@${userId}>`, inline: true });
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
            if (!isCreator && !isStaffMember) return interaction.reply({ content: t.noPermission, ephemeral: true }).catch(() => {});
            const confirmEmbed = new EmbedBuilder().setColor('#e74c3c').setTitle(t.closeConfirmTitle).setDescription(t.closeConfirmDesc);
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ticket_confirmclose_${channelId}_${creatorId}_${userId}`).setLabel(t.confirmClose).setStyle(ButtonStyle.Danger).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`ticket_cancelclose_${channelId}_${creatorId}`).setLabel(t.cancel).setStyle(ButtonStyle.Secondary).setEmoji('❌')
            );
            await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true }).catch(() => {});
            return true;
        }

        // ---- CONFIRM CLOSE ----
        if (action === 'confirmclose') {
            const closerId = parts[4] || userId;
            await interaction.update({ content: t.closingTicket, embeds: [], components: [] }).catch(() => {});
            const channel = interaction.channel;
            if (ticket) await saveTranscript(channel, ticket, closerId, client, serverSettings);
            await channel.send(t.ticketClosedBy(closerId)).catch(() => {});
            activeTickets.delete(channelId);
            if (db) deleteTicketFromDB(db, channelId);
            const existingTimer = autoCloseTimers.get(channelId);
            if (existingTimer) { clearTimeout(existingTimer); autoCloseTimers.delete(channelId); }
            setTimeout(async () => { try { await channel.delete(`Ticket closed by ${interaction.user.tag}`); } catch (e) {} }, 5000);
            return true;
        }

        // ---- CANCEL CLOSE ----
        if (action === 'cancelclose') {
            await interaction.deleteReply().catch(() => {});
            return true;
        }

        // ---- TRANSCRIPT ----
        if (action === 'transcript') {
            if (!isCreator && !isStaffMember) return interaction.reply({ content: t.noPermission, ephemeral: true }).catch(() => {});
            await interaction.deferReply({ ephemeral: true });
            const channel = interaction.channel;
            if (!ticket) return interaction.editReply({ content: '❌ Ticket data not found.' }).catch(() => {});
            const result = await saveTranscript(channel, ticket, null, client, serverSettings);
            if (result === true) await interaction.editReply({ content: t.transcriptSaved }).catch(() => {});
            else if (result && result.buffer) await interaction.editReply({ content: t.transcriptSaved, files: [{ attachment: result.buffer, name: result.filename }] }).catch(() => {});
            else await interaction.editReply({ content: '❌ Failed to generate transcript.' }).catch(() => {});
            resetAutoCloseTimer(channelId, client, serverSettings);
            return true;
        }

        return false;
    },

    // DB persistence
    setupTicketDB,
    loadAllTicketsFromDB
};
