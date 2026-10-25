const {
    EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder,
    ButtonStyle, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const EMOJIS = require('../config/emojis');
const { resolveEmoji } = require('../lib/emoji-resolver');
const mentions = require('../lib/mentions');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');

function getErrorEmoji(guild) {
    if (!guild) return '❌';
    const found = guild.emojis.cache.find(e => e.name === 'error');
    return found ? found.toString() : '❌';
}

function effectiveSettings(ss, gid) {
    const isOwner = gid === process.env.GUILD_ID;
    const e = (s, k, ek) => { const v = s?.[k]; return v != null ? v : (isOwner ? (process.env[ek] || null) : null); };
    const en = (s, k, ek, fb) => { const v = s?.[k]; return v != null ? v : (isOwner ? (process.env[ek] ? parseInt(process.env[ek]) : fb) : fb); };
    return { ...ss, ticketCategory: e(ss, 'ticketCategory', 'TICKET_CATEGORY_ID'), ticketStaffRole: e(ss, 'ticketStaffRole', 'TICKET_STAFF_ROLE_ID'), ticketTranscriptChannel: e(ss, 'ticketTranscriptChannel', 'TICKET_TRANSCRIPT_CHANNEL_ID'), ticketLogChannel: e(ss, 'ticketLogChannel', 'TICKET_LOG_CHANNEL_ID'), ticketAutoCloseHours: en(ss, 'ticketAutoCloseHours', 'TICKET_AUTO_CLOSE_HOURS', 0), ticketLimitPerUser: en(ss, 'ticketLimitPerUser', 'TICKET_LIMIT_PER_USER', 1) };
}

function setupTicketDB(db) {
    try {
        db.prepare(`CREATE TABLE IF NOT EXISTS tickets (channel_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, creator_id TEXT NOT NULL, creator_tag TEXT, created_at INTEGER, claimed_by TEXT, category TEXT, category_value TEXT, ticket_number INTEGER, participants TEXT, status TEXT DEFAULT 'open', priority TEXT DEFAULT 'normal', closed_at INTEGER, closed_by TEXT, transcript TEXT, issue_desc TEXT)`).run();
        const ticketCols = db.prepare("PRAGMA table_info(tickets)").all().map(c => c.name);
        const newCols = { status: "TEXT DEFAULT 'open'", priority: "TEXT DEFAULT 'normal'", closed_at: "INTEGER", closed_by: "TEXT", transcript: "TEXT", issue_desc: "TEXT" };
        for (const [col, type] of Object.entries(newCols)) {
            if (!ticketCols.includes(col)) {
                try { db.prepare('ALTER TABLE tickets ADD COLUMN ' + col + ' ' + type).run(); } catch(e) {}
            }
        }
        ['status','priority','closed_at','closed_by','transcript','issue_desc'].forEach(col => { try { db.prepare(`ALTER TABLE tickets ADD COLUMN ${col} TEXT`).run(); } catch(e) {} });
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_tg ON tickets(guild_id)`).run();
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_tc ON tickets(creator_id)`).run();
        db.prepare(`CREATE TABLE IF NOT EXISTS ticket_ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, ticket_id TEXT, staff_id TEXT, rater_id TEXT NOT NULL, stars INTEGER NOT NULL, comment TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')))`).run();
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_tr_guild ON ticket_ratings(guild_id)`).run();
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_tr_staff ON ticket_ratings(staff_id)`).run();
    } catch(e) { if (!e.message.includes('duplicate column')) console.error('[TDB] setup:', e.message); }
}

function saveTicket(db, cid, t) { try { db.prepare(`INSERT OR REPLACE INTO tickets (channel_id, guild_id, creator_id, creator_tag, created_at, claimed_by, category, category_value, ticket_number, participants, status, priority, closed_at, closed_by, transcript, issue_desc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(cid, t.guildId, t.creatorId, t.creatorTag||'', t.createdAt, t.claimedBy||null, t.category||null, t.categoryValue||null, t.number||0, JSON.stringify(t.participants||[t.creatorId]), t.status||'open', t.priority||'normal', t.closedAt||null, t.closedBy||null, t.transcript||null, t.issueDesc||null); } catch(e) { console.error('[TDB] save:', e.message); } }
function loadTicket(db, cid) { try { const r = db.prepare(`SELECT * FROM tickets WHERE channel_id=?`).get(cid); if(!r) return null; return { creatorId:r.creator_id, creatorTag:r.creator_tag, createdAt:r.created_at, claimedBy:r.claimed_by, category:r.category, categoryValue:r.category_value, guildId:r.guild_id, number:r.ticket_number, participants:JSON.parse(r.participants||'[]'), issueDesc:r.issue_desc }; } catch(e) { return null; } }
function loadAllTicketsFromDB(db, client) { try { const gids = client ? [...client.guilds.cache.keys()] : []; if(!gids.length) return; const ph = gids.map(()=>'?').join(','); const rows = db.prepare(`SELECT * FROM tickets WHERE guild_id IN (${ph})`).all(...gids); rows.forEach(r => active.set(r.channel_id, { creatorId:r.creator_id, creatorTag:r.creator_tag, createdAt:r.created_at, claimedBy:r.claimed_by, category:r.category, categoryValue:r.category_value, guildId:r.guild_id, number:r.ticket_number, participants:JSON.parse(r.participants||'[]'), issueDesc:r.issue_desc })); if (rows.length) setTimeout(() => rearmTimers(db, client), 60000); } catch(e) {} }

async function rearmTimers(db, client) {
    for (const [cid, tk] of active) {
        try {
            const guild = client.guilds.cache.get(tk.guildId);
            if (!guild) continue;
            const ch = await client.channels.fetch(cid).catch(() => null);
            if (!ch) { active.delete(cid); try { db.prepare('DELETE FROM tickets WHERE channel_id=?').run(cid); } catch {} continue; }
            const s = effectiveSettings(client.getServerSettings?.(tk.guildId) || {}, tk.guildId);
            const hRaw = s?.ticketAutoCloseHours;
            const h = (hRaw !== undefined && hRaw !== null && hRaw !== '') ? Number(hRaw) : 0;
            if (h <= 0) continue;
            const recent = await ch.messages.fetch({ limit: 50 }).catch(() => null);
            const human = recent?.find(m => !m.author.bot);
            const lastAt = human?.createdTimestamp || Number(tk.createdAt) || Date.now();
            const idleMs = Date.now() - lastAt;
            if (idleMs >= h * 3600000) {
                setTimeout(() => resetACTimerAt(cid, client, s, 60000), 30000);
            } else {
                resetACTimerAt(cid, client, s, h * 3600000 - idleMs);
            }
        } catch (e) {}
    }
}
function delTicket(db, cid) { try { db.prepare(`DELETE FROM tickets WHERE channel_id=?`).run(cid); } catch(e) {} }

const counters = new Map();
const active = new Map();
const timers = new Map();

const CATS = [
    { emoji:'❓', label:'Support', value:'support', desc:'General help & questions' },
    { emoji:'🛡️', label:'Report', value:'report', desc:'Report users or appeal' },
    { emoji:'💰', label:'Billing', value:'billing', desc:'Payments & shop issues' },
];

const getCats = (s) => s?.ticketCategoriesConfig?.length ? s.ticketCategoriesConfig : CATS;
const isStaff = (m, s) => m && (m.permissions?.has(PermissionFlagsBits.Administrator) || m.permissions?.has(PermissionFlagsBits.ManageMessages) || (s?.ticketStaffRole && m.roles?.cache?.has(s.ticketStaffRole)));
const countUserTix = (gid, uid) => { let c=0; for(const[,t]of active)if(t.guildId===gid&&t.creatorId===uid)c++; return c; };

function resetACTimerAt(cid, client, s, remainingMs) { return resetACTimer(cid, client, s, remainingMs); }

function resetACTimer(cid, client, s, remainingMs) {
    const lang = pickLang(client, s?.guildId, null) || 'en';
    const existing = timers.get(cid);
    if (existing) { if (existing.warn) clearTimeout(existing.warn); if (existing.close) clearTimeout(existing.close); timers.delete(cid); }
    
    const hRaw = s?.ticketAutoCloseHours;
    const h = (hRaw !== undefined && hRaw !== null && hRaw !== '') ? Number(hRaw) : 0;
    if (h <= 0) return;

    let ms = (typeof remainingMs === 'number' && remainingMs > 0) ? remainingMs : h * 3600000;
    if (ms > 2147483647) ms = 2147483647;
    if (ms < 60000) ms = 60000;

    const warnMs = ms - 3600000;
    const timersForCid = {};

    if (warnMs > 0) {
        timersForCid.warn = setTimeout(async () => {
            try {
                const ch = await client.channels.fetch(cid).catch(() => null);
                if (ch && active.has(cid)) await ch.send({ embeds: [new EmbedBuilder().setColor('#f39c12').setDescription(t('ticket.acWarn', lang) || '⏰ This ticket will auto-close in 1 hour.')] }).catch(() => {});
            } catch (e) {}
        }, warnMs);
    }

    timersForCid.close = setTimeout(async () => {
        try {
            const ch = await client.channels.fetch(cid).catch(() => null);
            const tk = active.get(cid);
            if (!tk) { timers.delete(cid); return; }
            const txResult = await saveTx(ch, tk, null, client, s);
            if (ch) await ch.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(t('ticket.acDone', lang) || '🔒 Ticket auto-closed.')] }).catch(() => {});
            active.delete(cid);
            if (client.db) delTicket(client.db, cid);
            timers.delete(cid);
            setTimeout(() => ch?.delete('Auto-closed').catch(() => {}), 5000);
        } catch (e) { timers.delete(cid); }
    }, ms);

    timers.set(cid, timersForCid);
}

async function saveTx(ch, tk, closer, client, s) {
    const lang = pickLang(client, s?.guildId, null) || 'en';
    try {
        const msgs = await ch.messages.fetch({limit:100}).catch(()=>new Map());
        const lines=[]; lines.push(`= TICKET LOG =`,`#${tk.number||'?'} | ${tk.category||'?'}`,`By: ${tk.creatorTag||'?'} | ${new Date(tk.createdAt).toISOString()}`,`Claimed: ${tk.claimedBy?`<@${tk.claimedBy}>`:'No'} | Closed: ${closer?`<@${closer}>`:'?'}`,`${'='.repeat(40)}`);
        msgs.reverse().forEach(m=>{const d=new Date(m.createdTimestamp).toISOString().slice(0,19).replace('T',' ');lines.push(`[${d}] ${m.author.tag}: ${m.content||'(file)'}`);});
        const tx=lines.join('\n'); const tcid=s?.ticketTranscriptChannel;
        if(tcid){try{const tc=await client.channels.fetch(tcid);if(tc?.guildId===tk.guildId&&(tc.type===ChannelType.GuildText||tc.type===5)){const e=new EmbedBuilder().setColor('#3498db').setTitle(`#${tk.number||'?'} Closed`).setDescription(t('ticket.closedLog', lang, {user: tk.creatorId, number: tk.number, cat: tk.category||'?'})).setTimestamp();await tc.send({embeds:[e],files:[{attachment:Buffer.from(tx),name:`ticket-${tk.number||ch.id}.txt`}]});return true;}}catch(e){}}
        return {buffer:Buffer.from(tx),filename:`ticket-${tk.number||ch.id}.txt`};
    }catch(e){return false;}
}

async function createCh(g, uid, uname, cat, s, client) {
    const gid=g.id, n=(counters.get(gid)||0)+1; counters.set(gid,n);
    const cd=typeof cat==='object'?cat:{emoji:'🎫',label:'Support',value:'support'};
    const name=`ticket-${n}-${uname}`.toLowerCase().replace(/[^a-z0-9-]/g,'').substring(0,100);
    const tcid=s?.ticketCategory;
    const ow=[{id:g.id,deny:[PermissionFlagsBits.ViewChannel]},{id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.EmbedLinks,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.ManageMessages,PermissionFlagsBits.ReadMessageHistory]},{id:uid,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.ReadMessageHistory]}];
    if(s?.ticketStaffRole){const r=g.roles.cache.get(s.ticketStaffRole);if(r)ow.push({id:r.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageMessages,PermissionFlagsBits.EmbedLinks,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.ReadMessageHistory]});}
    const ar=g.roles.cache.find(r=>r.permissions?.has(PermissionFlagsBits.Administrator));if(ar&&!ow.some(o=>o.id===ar.id))ow.push({id:ar.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageMessages]});
    const opts={name,type:ChannelType.GuildText,permissionOverwrites:ow,topic:`#${n} | ${cd.emoji} ${cd.label}`};
    if(tcid&&g.channels.cache.get(tcid))opts.parent=tcid;
    return g.channels.create(opts);
}

function panelCard(s, gn, lang='en', actionRow = null, client = null) {
    const cats = getCats(s) || [];
    const catLines = cats.map(c => `> ${c.emoji || '🎫'} **${c.label || 'Support'}** — *${c.desc || 'Open a ticket'}*`).join('\n');
    const _v2 = require('../lib/games/v2');
    const ticketEmoji = resolveEmoji('ticket', client) || '🎫';
    const items = [
        { text: `## ${ticketEmoji} ${t('ticket.panel_title', lang)}` },
        { text: `**SERVER** · ${gn}\n**STATUS** · ${t('ticket.panel_status', lang)}\n**PROTOCOL** · ${t('ticket.panel_protocol', lang)}` },
        { rule: true },
        { text: t('ticket.panel_how_it_works', lang) },
        { rule: true },
        { text: `${t('ticket.panel_available', lang)}\n${catLines}` },
        { text: t('ticket.panel_response_time', lang) }
    ];
    if (actionRow) items.push({ row: actionRow });
    return _v2.card(0x00f0ff, items);
}

function panelMenu(s) {
    const sel=new StringSelectMenuBuilder().setCustomId('ticket_category_select').setPlaceholder('Select category...');
    getCats(s).forEach(c=>sel.addOptions({label:`${c.emoji} ${c.label}`,description:c.desc.substring(0,100),value:c.value,emoji:c.emoji}));
    return sel;
}

async function welcomeMsg(ch, u, cat, n, lang='en', isPremium=false, s=null, issueDesc=null) {
    const catObj = typeof cat === 'object' ? cat : { emoji: '🎫', label: 'Support' };
    const cl = `${catObj.emoji} ${catObj.label}`;
    const _v2 = require('../lib/games/v2');
    
    const r = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_claim_${ch.id}_${u.id}`).setLabel(t('ticket.claim', lang)).setStyle(ButtonStyle.Primary).setEmoji(resolveEmoji('claim', ch.client) || '✋'),
        new ButtonBuilder().setCustomId(`ticket_close_${ch.id}_${u.id}`).setLabel(t('ticket.close', lang)).setStyle(ButtonStyle.Danger).setEmoji(resolveEmoji('lock', ch.client) || '🔒'),
        new ButtonBuilder().setCustomId(`ticket_transcript_${ch.id}_${u.id}`).setLabel(t('ticket.transcript', lang)).setStyle(ButtonStyle.Secondary).setEmoji(resolveEmoji('ticket', ch.client) || '📄')
    );
    
    const staffPing = s?.ticketStaffRole ? `<@&${s.ticketStaffRole}>` : '';
    
    const view = _v2.card(isPremium ? 0xf1c40f : 0x00f0ff, [
        { text: `## ${catObj.emoji || '🎫'} Ticket #${n}` },
        { text: t('ticket.welcome_msg', lang, { user: `<@${u.id}>` }) || `Welcome <@${u.id}>!` },
        { rule: true },
        { text: t('ticket.welcome_info', lang, { cat: cl, time: `<t:${Math.floor(Date.now() / 1000)}:R>` }) || `**Category** · ${cl}` },
        { rule: true },
        ...(issueDesc ? [{ text: t('ticket.welcome_inquiry', lang, { desc: issueDesc }) || `**Initial Inquiry**\n> *"${issueDesc}"*` }, { rule: true }] : []),
        { text: `-# ${t('ticket.wDesc', lang, {user: u.id, cat: cl}).replace(`<@${u.id}>`, '').trim() || 'Our team has been notified.'}` },
        { row: r }
    ]);
    
    await ch.send({ content: `${staffPing}`, ...view }).catch(err => console.error('[TICKET] welcomeMsg send failed:', err.message));
}

function cfgCard(s, g, c, lang='en') {
    const _v2 = require('../lib/games/v2');
    const io = g.id === process.env.GUILD_ID;
    const fch = (id, ek) => id ? `<#${id}>` : (io && process.env[ek] ? `<#${process.env[ek]}> 🔹 env` : `*${t('ticket.cfgNS', lang) || 'Not Set'}*`);
    const fr = (id, ek) => id ? `<@&${id}>` : (io && process.env[ek] ? `<@&${process.env[ek]}> 🔹 env` : `*${t('ticket.cfgNS', lang) || 'Not Set'}*`);
    
    const acRaw = s?.ticketAutoCloseHours;
    const ac = (acRaw !== undefined && acRaw !== null && acRaw !== '') ? Number(acRaw) : 0;
    const lmRaw = s?.ticketLimitPerUser;
    const lm = (lmRaw !== undefined && lmRaw !== null && lmRaw !== '') ? Number(lmRaw) : 1;

    const body = `**${t('ticket.cfgCat', lang) || 'Category'}** · ${fch(s?.ticketCategory, 'TICKET_CATEGORY_ID')}\n` +
                 `**${t('ticket.cfgStaff', lang) || 'Staff Role'}** · ${fr(s?.ticketStaffRole, 'TICKET_STAFF_ROLE_ID')}\n` +
                 `**${t('ticket.cfgTx', lang) || 'Log Channel'}** · ${fch(s?.ticketTranscriptChannel, 'TICKET_TRANSCRIPT_CHANNEL_ID')}\n` +
                 `**${t('ticket.cfgLog', lang) || 'Extra Log'}** · ${fch(s?.ticketLogChannel, 'TICKET_LOG_CHANNEL_ID')}\n` +
                 `**${t('ticket.cfgAC', lang) || 'Auto-Close'}** · ${ac <= 0 || isNaN(ac) ? `❌ ${t('ticket.cfgOff', lang) || 'Off'}` : `\`${ac}h\``}\n` +
                 `**${t('ticket.cfgLim', lang) || 'Limit'}** · \`${lm}\` / user`;

    return _v2.card(0x00fbff, [
        { text: `## 🦅 ${t('ticket.cfgTitle', lang) || 'TICKET CONFIG'}` },
        { rule: true },
        { text: body },
        { rule: true },
        { text: `-# ${t('ticket.cfgFoot', lang) || 'ARCHON CG-223'} • ${g.name || 'Server'}` }
    ]);
}

async function saveSetting(client, gid, key, val, lang='en') { try { const ok=client.updateServerSetting(gid,key,val); if(ok){client.settings?.delete(gid);return{ok:true,msg:t('ticket.setOK', lang, {setting: key, value: val})};} return{ok:false,err:`${getErrorEmoji(g)} DB error.`};}catch(e){return{ok:false,err:`${getErrorEmoji(g)} DB error.`};} }

function onMessageActivity(message, client, s) {
    if (message.author?.bot) return;
    const cid = message.channel.id;
    if (!active.has(cid)) return;
    resetACTimer(cid, client, s);
}

module.exports = {
    name:'ticket', aliases:['tickets','support'], category:'UTILITY', cooldown:5000,
    description:'🎫 Professional ticket system — panel, categories, auto-close, logs.',
    usage:'.ticket [panel|close|setup|config|setcategory|setstaffrole|settranscript|setautoclose|setlimit]',

    data: new SlashCommandBuilder().setName('ticket').setDescription('🎫 Ticket system').
        addSubcommand(s=>s.setName('panel').setDescription('Post ticket panel')).
        addSubcommand(s=>s.setName('close').setDescription('Close current ticket')).
        addSubcommand(s=>s.setName('setup').setDescription('Show setup guide')).
        addSubcommand(s=>s.setName('config').setDescription('View configuration')).
        addSubcommand(s=>s.setName('setcategory').setDescription('Set archive category').addChannelOption(o=>o.setName('category').setDescription('Archive category').setRequired(true).addChannelTypes(ChannelType.GuildCategory))).
        addSubcommand(s=>s.setName('setstaffrole').setDescription('Set staff role').addRoleOption(o=>o.setName('role').setDescription('Staff role').setRequired(true))).
        addSubcommand(s=>s.setName('settranscript').setDescription('Set log channel').addChannelOption(o=>o.setName('channel').setDescription('Log channel').setRequired(true).addChannelTypes(ChannelType.GuildText,5))).
        addSubcommand(s=>s.setName('setautoclose').setDescription('Auto-close hours').addIntegerOption(o=>o.setName('hours').setDescription('Hours (0=off)').setRequired(true).setMinValue(0).setMaxValue(168))).
        addSubcommand(s=>s.setName('setlimit').setDescription('Max tickets per user').addIntegerOption(o=>o.setName('limit').setDescription('1-10').setRequired(true).setMinValue(1).setMaxValue(10))).
        addSubcommand(s=>s.setName('leaderboard').setDescription('🏆 Top staff by rating')).
        addSubcommand(s=>s.setName('stats').setDescription('📊 Ticket system analytics')).
        addSubcommand(s=>s.setName('myrating').setDescription('⭐ Your rating history')),

    run: async(client,msg,args,db,ss)=>{
        const lang = pickLang(client, msg.guild?.id, msg), sub=args[0]?.toLowerCase(), g=msg.guild, p=ss?.prefix||'.';
        if(!g)return msg.reply(t('ticket.servers_only', lang)).catch(()=>{});
        const adm=msg.member.permissions.has(PermissionFlagsBits.Administrator);
        const needAdm=['setcategory','setstaffrole','settranscript','setautoclose','setlimit','panel','config','setup'].includes(sub);
        if(needAdm&&!adm)return msg.reply(t('ticket.needAdmin', lang, { error: getErrorEmoji(g) })).catch(()=>{});
        const es=effectiveSettings(ss,g.id);

        if(sub==='setcategory'){const id=args[1]?.replace(/[<#>]/g,'');if(!id)return msg.reply(`${EMOJIS.warning} ${mentions(client, 'channels', 'set')} type:Ticket category`).catch(()=>{});const c=g.channels.cache.get(id);if(!c||c.type!==ChannelType.GuildCategory)return msg.reply(t('ticket.badCh', lang)).catch(()=>{});const r=await saveSetting(client,g.id,'ticketCategory',id,lang);return msg.reply(r.ok?r.msg:r.err).catch(()=>{});}
        if(sub==='setstaffrole'){const id=args[1]?.replace(/[<@&>]/g,'');if(!id)return msg.reply(`${EMOJIS.warning} ${mentions(client, 'roles', 'set')} type:Staff/Ticket Role <id>`).catch(()=>{});const r=g.roles.cache.get(id);if(!r)return msg.reply(t('ticket.badRole', lang)).catch(()=>{});const rs=await saveSetting(client,g.id,'ticketStaffRole',id,lang);return msg.reply(rs.ok?rs.msg:rs.err).catch(()=>{});}
        if(sub==='settranscript'){const id=args[1]?.replace(/[<#>]/g,'');if(!id)return msg.reply(`${EMOJIS.warning} ${mentions(client, 'channels', 'set')} type:Ticket Logs <id>`).catch(()=>{});const c=g.channels.cache.get(id);if(!c)return msg.reply(t('ticket.badCh', lang)).catch(()=>{});const r=await saveSetting(client,g.id,'ticketTranscriptChannel',id,lang);return msg.reply(r.ok?r.msg:r.err).catch(()=>{});}
        if(sub==='setautoclose'){const h=parseInt(args[1]);if(isNaN(h)||h<0||h>168)return msg.reply(t('ticket.badNum', lang)).catch(()=>{});const r=await saveSetting(client,g.id,'ticketAutoCloseHours',String(h),lang);return msg.reply(r.ok?r.msg:r.err).catch(()=>{});}
        if(sub==='setlimit'){const l=parseInt(args[1]);if(isNaN(l)||l<1||l>10)return msg.reply(t('ticket.badNum', lang)).catch(()=>{});const r=await saveSetting(client,g.id,'ticketLimitPerUser',String(l),lang);return msg.reply(r.ok?r.msg:r.err).catch(()=>{});}
        if(sub==='config'){const e=cfgCard(es,g,client,lang);return msg.reply(e).catch(()=>{});}

        if(!es?.ticketCategory&&sub!=='setup')return msg.reply(t('ticket.notSet', lang)).catch(()=>{});

        if(sub==='setup'){
            let setupUsage = '';
            try {
                setupUsage = [
                    mentions(client, 'channels', 'set') + ' — ' + (t('ticket.cmd_channels', lang) || 'Set category & log channel'),
                    mentions(client, 'roles', 'set') + ' — ' + (t('ticket.cmd_roles', lang) || 'Set staff role'),
                    mentions(client, 'ticket', 'setautoclose') + ' — ' + (t('ticket.cmd_autoclose', lang) || 'Auto-close hours'),
                    mentions(client, 'ticket', 'setlimit') + ' — ' + (t('ticket.cmd_limit', lang) || 'Max tickets per user'),
                    mentions(client, 'ticket', 'config') + ' — ' + (t('ticket.cmd_config', lang) || 'View config')
                ].join('\n\n');
            } catch(e) { setupUsage = 'Use `/ticket config` to view settings.'; }
            const _v2 = require('../lib/games/v2');
            const setupCard = _v2.card(0x00fbff, [
                { text: '## 🦅 ' + (t('ticket.sTitle', lang) || 'Ticket System') },
                { text: t('ticket.sDesc', lang) || 'Configure your ticket system.' },
                { rule: true },
                { text: setupUsage },
                { rule: true },
                { text: '-# 🦅 ARCHON CG-223 • ' + (g.name || 'Server') }
            ]);
            return msg.reply(setupCard).catch(()=>{});
        }
        if(sub==='panel'){const e=panelCard(es,g.name,lang,null,client),m=panelMenu(es),r=new ActionRowBuilder().addComponents(m);e.components[0].addActionRowComponents(r);const s=await msg.channel.send(e).catch(()=>null);if(s){await msg.react(`${EMOJIS.check}`).catch(()=>{});try{db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(g.id);db.prepare(`UPDATE server_settings SET ticket_panel_channel=?,ticket_panel_channel_name=? WHERE guild_id=?`).run(msg.channel.id,msg.channel.name||String(msg.channel.id),g.id);}catch(e){}}return;}
        if(sub==='close'){const ch=msg.channel,tk=active.get(ch.id);if(!tk)return msg.reply(t('ticket.not_a_ticket', lang)).catch(()=>{});if(msg.author.id!==tk.creatorId&&!isStaff(msg.member,es))return msg.reply(t('ticket.noPerm', lang)).catch(()=>{});await saveTx(ch,tk,msg.author.id,client,es);await msg.reply(t('ticket.closing', lang)).catch(()=>{});active.delete(ch.id);if(db)delTicket(db,ch.id);const ex=timers.get(ch.id);if(ex){if(ex.warn)clearTimeout(ex.warn);if(ex.close)clearTimeout(ex.close);timers.delete(ch.id);}setTimeout(()=>ch.delete(`By ${msg.author.tag}`).catch(()=>{}),5000);return;}

        const _v2 = require('../lib/games/v2');
        const helpCard = _v2.card(0x00fbff, [
            { text: '## 🦅 ' + (t('ticket.pTitle', lang) || 'Ticket Commands') },
            { text: '**🎫 Commands**\n\n' + (t('ticket.helpCmds', lang, {prefix: p}) || 'Use /ticket panel to get started.') + '\n\nUsers create tickets via the panel.' },
            { rule: true },
            { text: '-# 🦅 ARCHON CG-223 • ' + (g.name || 'Server') }
        ]);
        msg.reply(helpCard).catch(()=>{});
    },

    execute: async(ix,client)=>{
        const lang = pickLang(client, ix.guildId, ix), sc=ix.options.getSubcommand(), g=ix.guild,u=ix.user,db=client.db,ss=effectiveSettings(client.getServerSettings?.(g?.id)||{},g?.id);
        if(!g)return ix.reply({content:t('ticket.servers_only', lang),flags:1<<6});
        const adm=ix.member.permissions?.has(PermissionFlagsBits.Administrator);
        const need=['setcategory','setstaffrole','settranscript','setautoclose','setlimit','panel','config','setup'].includes(sc);
        if(need&&!adm)return ix.reply({content:t('ticket.needAdmin', lang, { error: getErrorEmoji(g) }),flags:1<<6});

        if(sc==='setcategory'){const c=ix.options.getChannel('category');if(!c||c.type!==ChannelType.GuildCategory)return ix.reply({content:t('ticket.badCh', lang),flags:1<<6});const r=await saveSetting(client,g.id,'ticketCategory',c.id,lang);return ix.reply({content:r.ok?r.msg:r.err,flags:1<<6});}
        if(sc==='setstaffrole'){const r=ix.options.getRole('role');if(!r)return ix.reply({content:t('ticket.badRole', lang),flags:1<<6});const rs=await saveSetting(client,g.id,'ticketStaffRole',r.id,lang);return ix.reply({content:rs.ok?rs.msg:rs.err,flags:1<<6});}
        if(sc==='settranscript'){const c=ix.options.getChannel('channel');if(!c)return ix.reply({content:t('ticket.badCh', lang),flags:1<<6});const r=await saveSetting(client,g.id,'ticketTranscriptChannel',c.id,lang);return ix.reply({content:r.ok?r.msg:r.err,flags:1<<6});}
        if(sc==='setautoclose'){const h=ix.options.getInteger('hours');const r=await saveSetting(client,g.id,'ticketAutoCloseHours',String(h),lang);return ix.reply({content:r.ok?r.msg:r.err,flags:1<<6});}
        if(sc==='setlimit'){const l=ix.options.getInteger('limit');const r=await saveSetting(client,g.id,'ticketLimitPerUser',String(l),lang);return ix.reply({content:r.ok?r.msg:r.err,flags:1<<6});}
        if(sc==='config'){const e=cfgCard(ss,g,client,lang);return ix.reply({...e, flags:1<<6 | 32768});}
        if(!ss?.ticketCategory&&sc!=='setup')return ix.reply({content:t('ticket.notSet', lang),flags:1<<6});

        if(sc==='setup'){
            let setupUsage = '';
            try {
                setupUsage = [
                    mentions(client, 'channels', 'set') + ' — ' + (t('ticket.cmd_channels', lang) || 'Set category & log channel'),
                    mentions(client, 'roles', 'set') + ' — ' + (t('ticket.cmd_roles', lang) || 'Set staff role'),
                    mentions(client, 'ticket', 'setautoclose') + ' — ' + (t('ticket.cmd_autoclose', lang) || 'Auto-close hours'),
                    mentions(client, 'ticket', 'setlimit') + ' — ' + (t('ticket.cmd_limit', lang) || 'Max tickets per user'),
                    mentions(client, 'ticket', 'config') + ' — ' + (t('ticket.cmd_config', lang) || 'View config')
                ].join('\n\n');
            } catch(e) { setupUsage = 'Use `/ticket config` to view settings.'; }
            const _v2 = require('../lib/games/v2');
            const setupCard = _v2.card(0x00fbff, [
                { text: '## 🦅 ' + (t('ticket.sTitle', lang) || 'Ticket System') },
                { text: t('ticket.sDesc', lang) || 'Configure your ticket system.' },
                { rule: true },
                { text: setupUsage },
                { rule: true },
                { text: '-# 🦅 ARCHON CG-223 • ' + (g.name || 'Server') }
            ]);
            return ix.reply({ ...setupCard, flags: 1 << 6 | 32768 });
        }
        if(sc==='panel'){const _cp=require('../lib/canPost'),_me=g.members.me,_d=_cp.diagnose(g,ix.channel,_me);if(!_d.ok)return ix.reply({content:t('ticket.'+_d.key,lang,{ch:String(ix.channel),role:_d.role||'',perms:_cp.localize(_d.missing||[],lang).join(', '),bot:_me.roles.botRole?.name||_me.displayName,cmd: mentions(ix.client, ix.commandName, 'panel')}),flags:1<<6}).catch(()=>{});const e=panelCard(ss,g.name,lang,null,client),m=panelMenu(ss),r=new ActionRowBuilder().addComponents(m);e.components[0].addActionRowComponents(r);await ix.reply({content:t('ticket.posting', lang),flags:1<<6});const s=await ix.channel.send(e).catch(err=>{console.error('[TICKET] panel send failed:',err.message);return null;});if(s){await ix.editReply({content:t('ticket.posted', lang)}).catch(()=>{});try{db.prepare('UPDATE server_settings SET ticket_panel_channel=?,ticket_panel_channel_name=? WHERE guild_id=?').run(ix.channel.id,ix.channel.name||String(ix.channel.id),g.id);}catch(e){}}else await ix.editReply({content:t('ticket.failed_generic', lang)}).catch(()=>{});return;}
        if(sc==='close'){const ch=ix.channel,tk=active.get(ch.id);if(!tk)return ix.reply({content:t('ticket.not_a_ticket', lang),flags:1<<6});if(u.id!==tk.creatorId&&!isStaff(ix.member,ss))return ix.reply({content:t('ticket.noPerm', lang),flags:1<<6});await ix.deferReply();await saveTx(ch,tk,u.id,client,ss);await ix.editReply({content:t('ticket.closing', lang)}).catch(()=>{});active.delete(ch.id);if(db)delTicket(db,ch.id);const ex=timers.get(ch.id);if(ex){if(ex.warn)clearTimeout(ex.warn);if(ex.close)clearTimeout(ex.close);timers.delete(ch.id);}setTimeout(()=>ch.delete(`By ${u.tag}`).catch(()=>{}),5000);return;}
        if(sc==='leaderboard'){
            await ix.deferReply({flags:1<<6});
            try {
                const rows = db.prepare('SELECT staff_id, AVG(stars) as avg, COUNT(*) as total FROM ticket_ratings WHERE guild_id = ? GROUP BY staff_id ORDER BY avg DESC, total DESC LIMIT 10').all(g.id);
                if(!rows.length) return ix.editReply({content:t('ticket.no_ratings', lang) || 'No ratings found.'});
                const desc = rows.map((r,i) => {
                    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'•';
                    const stars = '⭐'.repeat(Math.round(r.avg));
                    return medal + ' <@' + r.staff_id + '> — ' + stars + ' `' + r.avg.toFixed(1) + '` (' + r.total + ' reviews)';
                }).join('\n');
                const _v2 = require('../lib/games/v2');
                const lbCard = _v2.card(0xffd700, [
                    { text: '## 🦅 ' + (t('ticket.lb_title', lang) || 'Staff Leaderboard') },
                    { text: '**' + (t('ticket.lb_top', lang) || 'Top Staff by Rating') + '**\n\n' + desc },
                    { rule: true },
                    { text: '-# ' + (t('ticket.lb_footer', lang) || 'Based on user ratings') }
                ]);
                return ix.editReply({ ...lbCard, flags: 1 << 6 | 32768 });
            }catch(e){return ix.editReply({content:t('ticket.lb_error', lang, { error: getErrorEmoji(g) })});}
        }
        if(sc==='stats'){
            await ix.deferReply({flags:1<<6});
            try {
                const total = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE guild_id = ?').get(g.id)?.c || 0;
                const open = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND status = ?').get(g.id, 'open')?.c || 0;
                const rated = db.prepare('SELECT COUNT(*) as c FROM ticket_ratings WHERE guild_id = ?').get(g.id)?.c || 0;
                const avg = db.prepare('SELECT AVG(stars) as a FROM ticket_ratings WHERE guild_id = ?').get(g.id)?.a || 0;
                const _v2 = require('../lib/games/v2');
                const statsCard = _v2.card(0x00f0ff, [
                    { text: '## 📊 Ticket Analytics' },
                    { rule: true },
                    { text: '**🎫 Total Tickets** · `' + total + '`\n**📊 Rated** · `' + rated + '`\n**⭐ Avg Rating** · `' + avg.toFixed(1) + '`\n**🟢 Open** · `' + open + '`' },
                    { rule: true },
                    { text: '-# ' + (t('ticket.stats_footer', lang) || 'Ticket System Analytics') }
                ]);
                return ix.editReply({ ...statsCard, flags: 1 << 6 | 32768 });
            }catch(e){return ix.editReply({content:t('ticket.stats_error', lang) || 'Failed to load stats.'});}
        }
        if(sc==='myrating'){
            await ix.deferReply({flags:1<<6});
            try {
                const rows = db.prepare('SELECT stars, comment, created_at FROM ticket_ratings WHERE rater_id = ? ORDER BY created_at DESC LIMIT 10').all(u.id);
                if(!rows.length) return ix.editReply({content:t('ticket.no_my_ratings', lang) || 'No ratings yet.'});
                const desc = rows.map(r => {
                    const stars = '⭐'.repeat(r.stars);
                    const note = r.comment ? '\n> *"' + r.comment.substring(0,60) + (r.comment.length>60?'...':'') + '"*' : '';
                    return stars + note;
                }).join('\n\n');
                const _v2 = require('../lib/games/v2');
                const ratingCard = _v2.card(0x9b59b6, [
                    { text: '## ⭐ Your Rating History' },
                    { rule: true },
                    { text: desc },
                    { rule: true },
                    { text: '-# ' + (t('ticket.rating_footer', lang) || 'Thank you for your feedback!') }
                ]);
                return ix.editReply({ ...ratingCard, flags: 1 << 6 | 32768 });
            }catch(e){return ix.editReply({content:t('ticket.ratings_error', lang) || 'Failed to load ratings.'});}
        }
    },

    handleComponent: async(ix,client)=>{
        const lang = pickLang(client, ix.guildId, ix), db=client.db, ss=effectiveSettings(client.getServerSettings?.(ix.guild?.id)||{},ix.guild?.id);

        if(ix.isStringSelectMenu()&&ix.customId==='ticket_category_select'){
            const g=ix.guild,u=ix.user,cv=ix.values[0],cats=getCats(ss),cat=cats.find(c=>c.value===cv)||cats[0];
            const lim=ss?.ticketLimitPerUser||1;
            if(countUserTix(g.id,u.id)>=lim)return ix.reply({content:t('ticket.maxT', lang, {limit: lim}), flags: 64}).catch(()=>{});
            if(!ss?.ticketCategory)return ix.reply({content:t('ticket.notSet', lang), flags: 64}).catch(()=>{});
            
            const modal = new ModalBuilder()
                .setCustomId(`ticket_modal_create_${cat.value}`)
                .setTitle((t('ticket.intake_title', lang, { cat: cat.label }) || `New Ticket: ${cat.label}`).substring(0, 45))
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('issue_desc')
                            .setLabel(t('ticket.intake_label', lang) || 'What do you need help with?')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder(t('ticket.intake_placeholder', lang) || 'Provide as much detail as possible...')
                            .setRequired(true)
                            .setMaxLength(1000)
                    )
                );
            return await ix.showModal(modal).catch((e) => console.error('[TIX MODAL]', e));
        }

        if (ix.isModalSubmit() && ix.customId.startsWith('ticket_modal_create_')) {
            const catValue = ix.customId.replace('ticket_modal_create_', '');
            const cats = getCats(ss);
            const cat = cats.find(c => c.value === catValue) || cats[0];
            const issueDesc = ix.fields.getTextInputValue('issue_desc');
            const g = ix.guild, u = ix.user;

            await ix.deferReply({ flags: 64 });

            try {
                const tc = await createCh(g, u.id, u.username, cat, ss, client);
                const n = counters.get(g.id) || 1;
                const td = { creatorId: u.id, creatorTag: u.tag, createdAt: Date.now(), claimedBy: null, category: `${cat.emoji} ${cat.label}`, categoryValue: cat.value, guildId: g.id, number: n, participants: [u.id], issueDesc };
                active.set(tc.id, td); saveTicket(db, tc.id, td);
                await welcomeMsg(tc, u, cat, n, lang, false, ss, issueDesc);
                resetACTimer(tc.id, client, ss);
                
                const _v2 = require('../lib/games/v2');
                const e = _v2.card(0x2ecc71, [
                    { text: t('ticket.modal_created_title', lang) || '✅ **All set!**' },
                    { text: t('ticket.modal_created_desc', lang, { channel: `<#${tc.id}>` }) || `Your private support channel is ready: <#${tc.id}>.` }
                ]);
                await ix.editReply(e).catch(()=>{});
            } catch(err) {
                console.error('[TIX MODAL]', err.message);
                await ix.editReply({ content: t('ticket.createErr', lang) || 'Failed to create ticket.' }).catch(()=>{});
            }
            return true;
        }

        if(!ix.isButton()||!ix.customId.startsWith('ticket_'))return false;
        const p=ix.customId.split('_'),act=p[1],cid=p[2],crid=p[3],uid=ix.user.id;
        let tk=active.get(cid); if(!tk&&db){tk=loadTicket(db,cid);if(tk)active.set(cid,tk);}
        if(tk&&ix.guildId!==tk.guildId)return ix.reply({content:t('ticket.wrong_server', lang),flags:1<<6}).catch(()=>{});
        const isC=uid===crid, isS=isStaff(ix.member,ss);

        if(act==='claim'){
            if(!isS)return ix.reply({content:t('ticket.staffOnlyClaim', lang),flags:1<<6}).catch(()=>{});
            if(tk?.claimedBy)return ix.reply({content:t('ticket.already', lang),flags:1<<6}).catch(()=>{});
            await ix.deferReply({flags:1<<6}).catch(()=>{});
            tk.claimedBy=uid; if(db)saveTicket(db,cid,tk);
            try{
                const msgs=await ix.channel.messages.fetch({limit:10});
                const wm=msgs.find(m=>m.author.id===client.user.id&&m.embeds?.[0]?.author?.name?.includes('TICKET'));
                if(wm&&wm.embeds[0]){
                    const ne=EmbedBuilder.from(wm.embeds[0]).spliceFields(3,1,{name:t('ticket.st', lang),value:`${t('ticket.claimed2', lang)}\n${t('ticket.claimed', lang)}: <@${uid}>`,inline:true});
                    await wm.edit({embeds:[ne]}).catch(()=>{});
                }
            }catch(e){}
            await ix.channel.send(t('ticket.claimed_msg', lang, {user: uid}));
            await ix.editReply({content:t('ticket.claimed_generic', lang)}).catch(()=>{});
            resetACTimer(cid,client,ss);
            return true;
        }

        if(act==='close'){
            if(!isC&&!isS)return ix.reply({content:t('ticket.noPerm', lang),flags:1<<6}).catch(()=>{});
            await ix.deferReply({flags:1<<6}).catch(()=>{});
            const e=new EmbedBuilder().setColor('#e74c3c').setTitle(t('ticket.closeQ', lang)).setDescription(t('ticket.closeD', lang));
            const r=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_confirmclose_${cid}_${crid}_${uid}`).setLabel(t('ticket.closeY', lang)).setStyle(ButtonStyle.Danger).setEmoji(resolveEmoji('small_check', client) || '✅'),new ButtonBuilder().setCustomId(`ticket_cancelclose_${cid}_${crid}`).setLabel(t('ticket.closeN', lang)).setStyle(ButtonStyle.Secondary).setEmoji(resolveEmoji('small_cross', client) || '❌'));
            await ix.editReply({embeds:[e],components:[r]}).catch(()=>{});
            return true;
        }

        if(act==='confirmclose'){
            const cl=p[4]||uid;
            await ix.update({content:t('ticket.closing', lang),embeds:[],components:[]}).catch(()=>{});
            const ch=ix.channel;
            if(tk) await saveTx(ch,tk,cl,client,ss);
            await ch.send(t('ticket.closedBy', lang, {user: cl})).catch(()=>{});
            active.delete(cid);
            if(db) delTicket(db,cid);
            const ex=timers.get(cid);
            if(ex){clearTimeout(ex);timers.delete(cid);}
            
            try {
                const creator = await client.users.fetch(tk?.creatorId || crid).catch(()=>null);
                if (creator && creator.id !== cl) {
                    const _v2 = require('../lib/games/v2');
                    const ratingRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`ticket_rate_1_${ix.guild?.id}`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`ticket_rate_2_${ix.guild?.id}`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`ticket_rate_3_${ix.guild?.id}`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`ticket_rate_4_${ix.guild?.id}`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`ticket_rate_5_${ix.guild?.id}`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Success),
                    );
                    const ratingCard = _v2.card(0x00f0ff, [
                        { text: `## ⭐ ${t('ticket.rating_closed', lang)}` },
                        { text: `${t('ticket.rating_how', lang)}\n*${t('ticket.rating_server', lang)} ${ix.guild?.name}*` },
                        { rule: true },
                        { row: ratingRow }
                    ]);
                    await creator.send(ratingCard).catch(()=>{});
                }
            } catch(e) {}
            
            setTimeout(()=>ch.delete(`By ${ix.user.tag}`).catch(()=>{}),5000);
            return true;
        }

        if(act==='cancelclose'){await ix.deleteReply().catch(()=>{});return true;}

        if(act==='transcript'){if(!isC&&!isS)return ix.reply({content:t('ticket.noPerm', lang),flags:1<<6}).catch(()=>{});await ix.deferReply({flags:1<<6});const ch=ix.channel;if(!tk)return ix.editReply({content:t('ticket.data_not_found', lang)}).catch(()=>{});const r=await saveTx(ch,tk,null,client,ss);if(r===true)await ix.editReply({content:t('ticket.txSaved', lang)}).catch(()=>{});else if(r&&r.buffer)await ix.editReply({content:t('ticket.txSaved', lang),files:[{attachment:r.buffer,name:r.filename}]}).catch(()=>{});else await ix.editReply({content:t('ticket.failed_generic', lang)}).catch(()=>{});resetACTimer(cid,client,ss);return true;}

        if(act==='rate'){
            const stars = parseInt(p[2]) || 0;
            const gid = p[3];
            const starEmoji = '⭐'.repeat(stars);
            await ix.update({ 
                embeds: [new EmbedBuilder().setColor(0x2ecc71)
                    .setDescription(t('ticket.rating_thanks', lang, {stars: starEmoji}))],
                components: [] 
            }).catch(()=>{});
            try {
                const ss2 = client.getServerSettings?.(gid) || {};
                const txCh = ss2?.ticketTranscriptChannel;
                if (txCh) {
                    const logCh = await client.channels.fetch(txCh).catch(()=>null);
                    if (logCh) {
                        await logCh.send({ embeds: [new EmbedBuilder().setColor(0xf1c40f)
                            .setDescription(t('ticket.rating_log', lang, {stars: starEmoji, count: stars, user: `<@${ix.user.id}>`}))
                            .setTimestamp()] }).catch(()=>{});
                    }
                }
            } catch(e) {}
            return true;
        }

        return false;
    },

    setupTicketDB, loadAllTicketsFromDB, onMessageActivity
};
