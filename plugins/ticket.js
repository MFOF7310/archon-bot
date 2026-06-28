const {
    EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder,
    ButtonStyle, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder
} = require('discord.js');

// ================= ENV FALLBACK (owner server only) =================
function effectiveSettings(ss, gid) {
    const isOwner = gid === process.env.GUILD_ID;
    const e = (s, k, ek) => { const v = s?.[k]; return v != null ? v : (isOwner ? (process.env[ek] || null) : null); };
    const en = (s, k, ek, fb) => { const v = s?.[k]; return v != null ? v : (isOwner ? (process.env[ek] ? parseInt(process.env[ek]) : fb) : fb); };
    return { ...ss, ticketCategory: e(ss, 'ticketCategory', 'TICKET_CATEGORY_ID'), ticketStaffRole: e(ss, 'ticketStaffRole', 'TICKET_STAFF_ROLE_ID'), ticketTranscriptChannel: e(ss, 'ticketTranscriptChannel', 'TICKET_TRANSCRIPT_CHANNEL_ID'), ticketLogChannel: e(ss, 'ticketLogChannel', 'TICKET_LOG_CHANNEL_ID'), ticketAutoCloseHours: en(ss, 'ticketAutoCloseHours', 'TICKET_AUTO_CLOSE_HOURS', 24), ticketLimitPerUser: en(ss, 'ticketLimitPerUser', 'TICKET_LIMIT_PER_USER', 1) };
}

// ================= DB =================
function setupTicketDB(db) {
    try {
        db.prepare(`CREATE TABLE IF NOT EXISTS tickets (channel_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, creator_id TEXT NOT NULL, creator_tag TEXT, created_at INTEGER, claimed_by TEXT, category TEXT, category_value TEXT, ticket_number INTEGER, participants TEXT, status TEXT DEFAULT 'open', priority TEXT DEFAULT 'normal', closed_at INTEGER, closed_by TEXT, transcript TEXT)`).run();
        // Add missing columns safely
        const ticketCols = db.prepare("PRAGMA table_info(tickets)").all().map(c => c.name);
        const newCols = { status: "TEXT DEFAULT 'open'", priority: "TEXT DEFAULT 'normal'", closed_at: "INTEGER", closed_by: "TEXT", transcript: "TEXT" };
        for (const [col, type] of Object.entries(newCols)) {
            if (!ticketCols.includes(col)) {
                try { db.prepare('ALTER TABLE tickets ADD COLUMN ' + col + ' ' + type).run(); } catch(e) {}
            }
        }
        db.prepare(`ALTER TABLE tickets ADD COLUMN status TEXT DEFAULT 'open'`).prepare = undefined;
        ['status','priority','closed_at','closed_by','transcript'].forEach(col => { try { db.prepare(`ALTER TABLE tickets ADD COLUMN ${col} TEXT`).run(); } catch(e) { /* column exists */ } });
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_tg ON tickets(guild_id)`).run();
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_tc ON tickets(creator_id)`).run();
    } catch(e) { console.error('[TDB] setup:', e.message); }
}
function saveTicket(db, cid, t) { try { db.prepare(`INSERT OR REPLACE INTO tickets (channel_id, guild_id, creator_id, creator_tag, created_at, claimed_by, category, category_value, ticket_number, participants, status, priority, closed_at, closed_by, transcript) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(cid, t.guildId, t.creatorId, t.creatorTag||'', t.createdAt, t.claimedBy||null, t.category||null, t.categoryValue||null, t.number||0, JSON.stringify(t.participants||[t.creatorId]), t.status||'open', t.priority||'normal', t.closedAt||null, t.closedBy||null, t.transcript||null); } catch(e) { console.error('[TDB] save:', e.message); } }
function loadTicket(db, cid) { try { const r = db.prepare(`SELECT * FROM tickets WHERE channel_id=?`).get(cid); if(!r) return null; return { creatorId:r.creator_id, creatorTag:r.creator_tag, createdAt:r.created_at, claimedBy:r.claimed_by, category:r.category, categoryValue:r.category_value, guildId:r.guild_id, number:r.ticket_number, participants:JSON.parse(r.participants||'[]') }; } catch(e) { return null; } }
function loadAllTicketsFromDB(db, client) { try { const gids = client ? [...client.guilds.cache.keys()] : []; if(!gids.length) return; const ph = gids.map(()=>'?').join(','); const rows = db.prepare(`SELECT * FROM tickets WHERE guild_id IN (${ph})`).all(...gids); rows.forEach(r => active.set(r.channel_id, { creatorId:r.creator_id, creatorTag:r.creator_tag, createdAt:r.created_at, claimedBy:r.claimed_by, category:r.category, categoryValue:r.category_value, guildId:r.guild_id, number:r.ticket_number, participants:JSON.parse(r.participants||'[]') })); const sk = db.prepare(`SELECT COUNT(*) as c FROM tickets WHERE guild_id NOT IN (${ph})`).get(...gids); if(sk?.c) { db.prepare(`DELETE FROM tickets WHERE guild_id NOT IN (${ph})`).run(...gids); console.log(`[TDB] cleaned ${sk.c} orphans`); } if(rows.length) console.log(`[TDB] restored ${rows.length} tickets`); } catch(e) {} }
function delTicket(db, cid) { try { db.prepare(`DELETE FROM tickets WHERE channel_id=?`).run(cid); } catch(e) {} }

// ================= STATE =================
const counters = new Map();
const active = new Map();
const timers = new Map();

// ================= CATEGORIES (3 ESSENTIAL ONLY) =================
const CATS = [
    { emoji:'❓', label:'Support', value:'support', desc:'General help & questions' },
    { emoji:'🛡️', label:'Report', value:'report', desc:'Report users or appeal' },
    { emoji:'💰', label:'Billing', value:'billing', desc:'Payments & shop issues' },
];

// ================= I18N =================
const TX = {
    en: {
        sTitle:'🎫 TICKET SYSTEM', sDesc:'**Configure your ticket system.**',
        sUsage:p=>`\`/channels set\` — Set ticket category & log channel\n\`/roles set type:Staff/Ticket Role\` — Set staff role\n\`/ticket setautoclose\` — Auto-close hours\n\`/ticket setlimit\` — Max tickets per user\n\`/ticket config\` — View config`,
        pTitle:'🎫 Support', pDesc:g=>`Need help? Select a category below to open a private ticket.`, pFooter:'🦅 ARCHON CG-223',
        made:'✅ Ticket created', welcome:'🎫 NEW TICKET',
        wDesc:(u,c)=>`Hi <@${u}>, staff will assist you shortly.\n**Category:** ${c}`,
        claim:'🙋 Claim', close:'🔒 Close', transcript:'📄 Log',
        claimed:u=>`🙋 <@${u}> claimed this.`, already:'❌ Already claimed.', staffOnlyClaim:'❌ Staff only.',
        closeQ:'🔒 Close ticket?', closeD:'This cannot be undone.', closeY:'Yes, Close', closeN:'Cancel',
        closing:'🔒 Closing in 5s...', closedBy:u=>`🔒 Closed by <@${u}>`,
        closedLog:(u,c,cat)=>`Ticket #${c} closed | Creator: <@${u}> | ${cat}`,
        txSaved:'📄 Log saved!', noPerm:'❌ Staff or creator only.', staffOnly:'❌ Staff only.',
        notSet:'⚠️ **Not configured.** Use `/ticket setup` → `/channels set` and `/roles set` to configure.',
        createErr:'❌ Failed to create ticket.', maxT:l=>`❌ Max ${l} ticket(s).`,
        by:'By', at:'Created', claimed:'Claimed', cat:'Category', st:'Status',
        open:'🟢 Open', claimed2:'🟡 Claimed', closing2:'🔴 Closing',
        acWarn:'⚠️ Auto-closing in 1h.', acDone:'🔒 Auto-closed.',
        cfgTitle:'🎫 TICKET CONFIG', cfgCat:'📁 Category', cfgStaff:'🛡️ Staff Role',
        cfgTx:'📄 Log Channel', cfgLog:'📋 Extra Log', cfgAC:'⏰ Auto-Close', cfgLim:'🔢 Limit',
        cfgNS:'Not set', cfgOff:'Off', cfgFoot:'🦅 ARCHON CG-223',
        setOK:(s,v)=>`✅ **${s}** → ${v}`, badCh:'❌ Channel not found.', badRole:'❌ Role not found.', badNum:'❌ Invalid number.', needAdmin:'❌ Admin required.',
        helpCmds:p=>`\`${p}ticket panel\` — Post panel\n\`${p}ticket close\` — Close\n\`${p}ticket config\` — View config\n\`/channels set\` — Set ticket channels\n\`/roles set\` — Set staff role\n\`/ticket setautoclose\` — Auto-close hours\n\`/ticket setlimit\` — Max tickets per user`,
    },
    fr: {
        sTitle:'🎫 SYSTÈME DE TICKETS', sDesc:'**Configurez votre système.**',
        sUsage:p=>`\`${p}//channels set type:Ticket category\` — Catégorie\n\`${p}/roles set type:Staff/Ticket Role <id>\` — Rôle staff\n\`${p}/channels set type:Ticket Logs <id>\` — Salon log\n\`${p}ticket setautoclose <h>\` — Fermeture auto\n\`${p}ticket setlimit <1-10>\` — Max par user\n\`${p}ticket config\` — Voir config`,
        pTitle:'🎫 Support', pDesc:g=>`Besoin d'aide ? Sélectionnez une catégorie ci-dessous.`, pFooter:'🦅 ARCHON CG-223',
        made:'✅ Ticket créé', welcome:'🎫 NOUVEAU TICKET',
        wDesc:(u,c)=>`Bonjour <@${u}>, un staff va vous aider.\n**Catégorie :** ${c}`,
        claim:'🙋 Prendre', close:'🔒 Fermer', transcript:'📄 Log',
        claimed:u=>`🙋 <@${u}> a pris ce ticket.`, already:'❌ Déjà pris.', staffOnlyClaim:'❌ Staff uniquement.',
        closeQ:'🔒 Fermer ?', closeD:'Action irréversible.', closeY:'Oui, Fermer', closeN:'Annuler',
        closing:'🔒 Fermeture dans 5s...', closedBy:u=>`🔒 Fermé par <@${u}>`,
        closedLog:(u,c,cat)=>`Ticket #${c} fermé | Créateur : <@${u}> | ${cat}`,
        txSaved:'📄 Log enregistré !', noPerm:'❌ Staff ou créateur.', staffOnly:'❌ Staff uniquement.',
        notSet:'⚠️ **Non configuré.** Utilisez `.ticket setup` puis `.//channels set type:Ticket category`',
        createErr:'❌ Échec.', maxT:l=>`❌ Max ${l} ticket(s).`,
        by:'Créé par', at:'Créé', claimed:'Pris par', cat:'Catégorie', st:'Statut',
        open:'🟢 Ouvert', claimed2:'🟡 Pris', closing2:'🔴 Fermeture',
        acWarn:'⚠️ Fermeture auto dans 1h.', acDone:'🔒 Fermé automatiquement.',
        cfgTitle:'🎫 CONFIG', cfgCat:'📁 Catégorie', cfgStaff:'🛡️ Rôle Staff',
        cfgTx:'📄 Salon Log', cfgLog:'📋 Log Extra', cfgAC:'⏰ Fermeture Auto', cfgLim:'🔢 Limite',
        cfgNS:'Non défini', cfgOff:'Désactivé', cfgFoot:'🦅 ARCHON CG-223',
        setOK:(s,v)=>`✅ **${s}** → ${v}`, badCh:'❌ Salon introuvable.', badRole:'❌ Rôle introuvable.', badNum:'❌ Nombre invalide.', needAdmin:'❌ Admin requis.',
        helpCmds:p=>`\`${p}ticket panel\` — Panel\n\`${p}ticket close\` — Fermer\n\`${p}ticket config\` — Config\n\`${p}//channels set type:Ticket category\` — Catégorie\n\`${p}/roles set type:Staff/Ticket Role <id>\` — Rôle staff\n\`${p}/channels set type:Ticket Logs <id>\` — Salon log\n\`${p}ticket setautoclose <h>\` — Auto-close\n\`${p}ticket setlimit <1-10>\` — Max par user`,
    }
};

// ================= HELPERS =================
const getCats = (s) => s?.ticketCategoriesConfig?.length ? s.ticketCategoriesConfig : CATS;
const isStaff = (m, s) => m && (m.permissions?.has(PermissionFlagsBits.Administrator) || m.permissions?.has(PermissionFlagsBits.ManageMessages) || (s?.ticketStaffRole && m.roles?.cache?.has(s.ticketStaffRole)));
const countUserTix = (gid, uid) => { let c=0; for(const[,t]of active)if(t.guildId===gid&&t.creatorId===uid)c++; return c; };

function resetACTimer(cid, client, s) {
    const ex = timers.get(cid); if(ex){clearTimeout(ex);timers.delete(cid);}
    const h = s?.ticketAutoCloseHours||24; if(h<=0)return;
    const ms=h*3600000, wm=ms-3600000;
    if(wm>0)setTimeout(async()=>{try{const ch=await client.channels.fetch(cid).catch(()=>null);if(ch&&active.has(cid))await ch.send({embeds:[new EmbedBuilder().setColor('#f39c12').setDescription(TX.en.acWarn)]}).catch(()=>{});}catch(e){}},wm);
    timers.set(cid,setTimeout(async()=>{try{const ch=await client.channels.fetch(cid).catch(()=>null);if(ch&&active.has(cid)){await ch.send({embeds:[new EmbedBuilder().setColor('#e74c3c').setDescription(TX.en.acDone)]}).catch(()=>{});active.delete(cid);setTimeout(()=>ch.delete('Auto-closed').catch(()=>{}),5000);}}catch(e){}timers.delete(cid);},ms));
}

async function saveTx(ch, t, closer, client, s) {
    try {
        const msgs = await ch.messages.fetch({limit:100}).catch(()=>new Map());
        const lines=[]; lines.push(`= TICKET LOG =`,`#${t.number||'?'} | ${t.category||'?'}`,`By: ${t.creatorTag||'?'} | ${new Date(t.createdAt).toISOString()}`,`Claimed: ${t.claimedBy?`<@${t.claimedBy}>`:'No'} | Closed: ${closer?`<@${closer}>`:'?'}`,`${'='.repeat(40)}`);
        msgs.reverse().forEach(m=>{const d=new Date(m.createdTimestamp).toISOString().slice(0,19).replace('T',' ');lines.push(`[${d}] ${m.author.tag}: ${m.content||'(file)'}`);});
        const tx=lines.join('\n'); const tcid=s?.ticketTranscriptChannel;
        if(tcid){try{const tc=await client.channels.fetch(tcid);if(tc?.guildId===t.guildId&&(tc.type===ChannelType.GuildText||tc.type===5)){const e=new EmbedBuilder().setColor('#3498db').setTitle(`#${t.number||'?'} Closed`).setDescription(TX.en.closedLog(t.creatorId,t.number,t.category||'?')).setTimestamp();await tc.send({embeds:[e],files:[{attachment:Buffer.from(tx),name:`ticket-${t.number||ch.id}.txt`}]});return true;}}catch(e){}}
        return {buffer:Buffer.from(tx),filename:`ticket-${t.number||ch.id}.txt`};
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

// ================= UI BUILDERS =================
function panelEmbed(s, gn, lang='en') {
    const t=TX[lang]||TX.en, cats=getCats(s);
    return new EmbedBuilder()
        .setColor(0x00f0ff)
        .setAuthor({ name: '🦅 ARCHON ENGINE • SUPPORT PROTOCOL', iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.webp' })
        .setTitle('🎫 CLASSIFIED SUPPORT SYSTEM')
        .setDescription(
            `\`\`\`ansi
` +
            `[1;36m▸ SERVER   [0m ${gn}
` +
            `[1;36m▸ STATUS   [0m [1;32mOPERATIONAL[0m
` +
            `[1;36m▸ PROTOCOL [0m NEURAL TICKET v2.0
` +
            `\`\`\`
` +
            `${cats.map(c => `${c.emoji} **${c.label}** — *${c.desc}*`).join('\n')}

` +
            `> Select a category below to open a private support channel.`
        )
        .addFields({ name: '📋 AVAILABLE CATEGORIES', value: `\`${cats.length}\` categories`, inline: true },
                   { name: '⏰ AUTO-CLOSE', value: `\`${s?.ticketAutoCloseHours || 24}h\``, inline: true },
                   { name: '🔒 PRIVATE', value: '`Staff + You only`', inline: true })
        .setFooter({ text: 'BAMAKO_223 🇲🇱 • ARCHON CLASSIFIED PROTOCOL' })
        .setTimestamp();
}
function panelMenu(s) {
    const sel=new StringSelectMenuBuilder().setCustomId('ticket_category_select').setPlaceholder('Select category...');
    getCats(s).forEach(c=>sel.addOptions({label:`${c.emoji} ${c.label}`,description:c.desc.substring(0,100),value:c.value,emoji:c.emoji}));
    return sel;
}
async function welcomeMsg(ch, u, cat, n, lang='en', isPremium=false) {
    const t=TX[lang]||TX.en, cl=typeof cat==='object'?`${cat.emoji} ${cat.label}`:'🎫 Support';
    const e=new EmbedBuilder()
        .setColor(isPremium ? 0xf1c40f : 0x00f0ff)
        .setAuthor({name:`🦅 ARCHON SUPPORT • TICKET #${n}`,iconURL:u.displayAvatarURL()})
        .setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;36m▸ AGENT    \u001b[0m ${u.username}\n` +
            `\u001b[1;36m▸ CATEGORY \u001b[0m ${cl}\n` +
            `\u001b[1;36m▸ PRIORITY \u001b[0m ${isPremium ? '\u001b[1;33mPREMIUM\u001b[0m' : '\u001b[1;32mSTANDARD\u001b[0m'}\n` +
            `\u001b[1;36m▸ STATUS   \u001b[0m \u001b[1;32mOPEN\u001b[0m\n` +
            `\`\`\`\n${t.wDesc(u.id,cl)}`
        )
        .addFields(
            {name:'👤 Agent',value:`<@${u.id}>`,inline:true},
            {name:'⏰ Opened',value:`<t:${Math.floor(Date.now()/1000)}:R>`,inline:true},
            {name:'📁 Category',value:cl,inline:true}
        )
        .setFooter({text:'BAMAKO_223 🇲🇱 • ARCHON CLASSIFIED PROTOCOL'})
        .setTimestamp();
    const r=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_claim_${ch.id}_${u.id}`).setLabel(t.claim).setStyle(ButtonStyle.Primary).setEmoji('🙋'),
        new ButtonBuilder().setCustomId(`ticket_close_${ch.id}_${u.id}`).setLabel(t.close).setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId(`ticket_transcript_${ch.id}_${u.id}`).setLabel(t.transcript).setStyle(ButtonStyle.Secondary).setEmoji('📄')
    );
    await ch.send({content:`<@${u.id}>`,embeds:[e],components:[r]});
}
function cfgEmbed(s, g, c, lang='en') {
    const t=TX[lang]||TX.en, io=g.id===process.env.GUILD_ID;
    const fch=(id,ek)=>id?`<#${id}>`:(io&&process.env[ek]?`<#${process.env[ek]}> 🔹 env`:`*${t.cfgNS}*`);
    const fr=(id,ek)=>id?`<@&${id}>`:(io&&process.env[ek]?`<@&${process.env[ek]}> 🔹 env`:`*${t.cfgNS}*`);
    const ac=s?.ticketAutoCloseHours??24, lm=s?.ticketLimitPerUser??1;
    return new EmbedBuilder().setColor('#00fbff').setAuthor({name:`🦅 ${t.cfgTitle}`,iconURL:g.iconURL({dynamic:true})||c.user.displayAvatarURL()}).setThumbnail(g.iconURL({dynamic:true,size:256})).addFields({name:t.cfgCat,value:fch(s?.ticketCategory,'TICKET_CATEGORY_ID'),inline:true},{name:t.cfgStaff,value:fr(s?.ticketStaffRole,'TICKET_STAFF_ROLE_ID'),inline:true},{name:t.cfgTx,value:fch(s?.ticketTranscriptChannel,'TICKET_TRANSCRIPT_CHANNEL_ID'),inline:true},{name:t.cfgLog,value:fch(s?.ticketLogChannel,'TICKET_LOG_CHANNEL_ID'),inline:true},{name:t.cfgAC,value:ac===0?`❌ ${t.cfgOff}`:`\`${ac}h\``,inline:true},{name:t.cfgLim,value:`\`${lm}\` / user`,inline:true}).setFooter({text:`${t.cfgFoot} • ${g.name}`,iconURL:c.user.displayAvatarURL()}).setTimestamp();
}
async function saveSetting(client, gid, key, val, lang='en') { const t=TX[lang]||TX.en; try { const ok=client.updateServerSetting(gid,key,val); if(ok){client.settings?.delete(gid);return{ok:true,msg:t.setOK(key,val)};} return{ok:false,err:'❌ DB error.'};}catch(e){return{ok:false,err:'❌ DB error.'};} }

// ================= MODULE =================
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
        addSubcommand(s=>s.setName('setlimit').setDescription('Max tickets per user').addIntegerOption(o=>o.setName('limit').setDescription('1-10').setRequired(true).setMinValue(1).setMaxValue(10))),

    // ================= PREFIX =================
    run: async(client,msg,args,db,ss)=>{
        const lang=client.detectLanguage?client.detectLanguage(args[0]||''):'en', t=TX[lang]||TX.en, sub=args[0]?.toLowerCase(), g=msg.guild, p=ss?.prefix||'.';
        if(!g)return msg.reply('❌ Servers only.').catch(()=>{});
        const adm=msg.member.permissions.has(PermissionFlagsBits.Administrator);
        const needAdm=['setcategory','setstaffrole','settranscript','setautoclose','setlimit','panel'].includes(sub);
        if(needAdm&&!adm)return msg.reply(t.needAdmin).catch(()=>{});
        const es=effectiveSettings(ss,g.id);

        // Config setters
        if(sub==='setcategory'){const id=args[1]?.replace(/[<#>]/g,'');if(!id)return msg.reply('⚠️ `.//channels set type:Ticket category`').catch(()=>{});const c=g.channels.cache.get(id);if(!c||c.type!==ChannelType.GuildCategory)return msg.reply(t.badCh).catch(()=>{});const r=await saveSetting(client,g.id,'ticketcategory',id,lang);return msg.reply(r.ok?r.msg:r.err).catch(()=>{});}
        if(sub==='setstaffrole'){const id=args[1]?.replace(/[<@&>]/g,'');if(!id)return msg.reply('⚠️ `./roles set type:Staff/Ticket Role <id>`').catch(()=>{});const r=g.roles.cache.get(id);if(!r)return msg.reply(t.badRole).catch(()=>{});const rs=await saveSetting(client,g.id,'ticketstaffrole',id,lang);return msg.reply(rs.ok?rs.msg:rs.err).catch(()=>{});}
        if(sub==='settranscript'){const id=args[1]?.replace(/[<#>]/g,'');if(!id)return msg.reply('⚠️ `./channels set type:Ticket Logs <id>`').catch(()=>{});const c=g.channels.cache.get(id);if(!c)return msg.reply(t.badCh).catch(()=>{});const r=await saveSetting(client,g.id,'tickettranscriptchannel',id,lang);return msg.reply(r.ok?r.msg:r.err).catch(()=>{});}
        if(sub==='setautoclose'){const h=parseInt(args[1]);if(isNaN(h)||h<0||h>168)return msg.reply(t.badNum).catch(()=>{});const r=await saveSetting(client,g.id,'ticketautoclose',String(h),lang);return msg.reply(r.ok?r.msg:r.err).catch(()=>{});}
        if(sub==='setlimit'){const l=parseInt(args[1]);if(isNaN(l)||l<1||l>10)return msg.reply(t.badNum).catch(()=>{});const r=await saveSetting(client,g.id,'ticketlimit',String(l),lang);return msg.reply(r.ok?r.msg:r.err).catch(()=>{});}
        if(sub==='config'){const e=cfgEmbed(es,g,client,lang);return msg.reply({embeds:[e]}).catch(()=>{});}

        if(!es?.ticketCategory&&sub!=='setup')return msg.reply(t.notSet).catch(()=>{});

        if(sub==='setup'){const e=new EmbedBuilder().setColor('#00fbff').setAuthor({name:`🦅 ${t.sTitle}`,iconURL:client.user.displayAvatarURL()}).setDescription(t.sDesc+'\n\n'+t.sUsage(p)).setFooter({text:`🦅 ARCHON CG-223 • ${g.name}`,iconURL:client.user.displayAvatarURL()}).setTimestamp();return msg.reply({embeds:[e]}).catch(()=>{});}
        if(sub==='panel'){const e=panelEmbed(es,g.name,lang),m=panelMenu(es),r=new ActionRowBuilder().addComponents(m);const s=await msg.channel.send({embeds:[e],components:[r]}).catch(()=>null);if(s){await msg.react('✅').catch(()=>{});try{db.prepare(`INSERT OR REPLACE INTO server_settings (guild_id,ticket_panel_channel) VALUES (?,?)`).run(g.id,s.id);}catch(e){}}return;}
        if(sub==='close'){const ch=msg.channel,tk=active.get(ch.id);if(!tk)return msg.reply('❌ Not a ticket.').catch(()=>{});if(msg.author.id!==tk.creatorId&&!isStaff(msg.member,es))return msg.reply(t.noPerm).catch(()=>{});await saveTx(ch,tk,msg.author.id,client,es);await msg.reply(t.closing).catch(()=>{});active.delete(ch.id);if(db)delTicket(db,ch.id);const ex=timers.get(ch.id);if(ex){clearTimeout(ex);timers.delete(ch.id);}setTimeout(()=>ch.delete(`By ${msg.author.tag}`).catch(()=>{}),5000);return;}

        // Help
        const e=new EmbedBuilder().setColor('#00fbff').setAuthor({name:`🦅 ${t.pTitle}`,iconURL:client.user.displayAvatarURL()}).setDescription(`**🎫 Commands**\n\n${t.helpCmds(p)}\n\nUsers create tickets via the panel.`).setFooter({text:`🦅 ARCHON CG-223 • ${g.name}`,iconURL:client.user.displayAvatarURL()}).setTimestamp();
        msg.reply({embeds:[e]}).catch(()=>{});
    },

    // ================= SLASH =================
    execute: async(ix,client)=>{
        const lang=ix.locale?.startsWith('fr')?'fr':'en', t=TX[lang]||TX.en, sc=ix.options.getSubcommand(), g=ix.guild,u=ix.user,db=client.db,ss=effectiveSettings(client.getServerSettings?.(g?.id)||{},g?.id);
        if(!g)return ix.reply({content:'❌ Servers only.',flags:1<<6});
        const adm=ix.member.permissions?.has(PermissionFlagsBits.Administrator);
        const need=['setcategory','setstaffrole','settranscript','setautoclose','setlimit','panel'].includes(sc);
        if(need&&!adm)return ix.reply({content:t.needAdmin,flags:1<<6});

        if(sc==='setcategory'){const c=ix.options.getChannel('category');if(!c||c.type!==ChannelType.GuildCategory)return ix.reply({content:t.badCh,flags:1<<6});const r=await saveSetting(client,g.id,'ticketcategory',c.id,lang);return ix.reply({content:r.ok?r.msg:r.err,flags:1<<6});}
        if(sc==='setstaffrole'){const r=ix.options.getRole('role');if(!r)return ix.reply({content:t.badRole,flags:1<<6});const rs=await saveSetting(client,g.id,'ticketstaffrole',r.id,lang);return ix.reply({content:rs.ok?rs.msg:rs.err,flags:1<<6});}
        if(sc==='settranscript'){const c=ix.options.getChannel('channel');if(!c)return ix.reply({content:t.badCh,flags:1<<6});const r=await saveSetting(client,g.id,'tickettranscriptchannel',c.id,lang);return ix.reply({content:r.ok?r.msg:r.err,flags:1<<6});}
        if(sc==='setautoclose'){const h=ix.options.getInteger('hours');const r=await saveSetting(client,g.id,'ticketautoclose',String(h),lang);return ix.reply({content:r.ok?r.msg:r.err,flags:1<<6});}
        if(sc==='setlimit'){const l=ix.options.getInteger('limit');const r=await saveSetting(client,g.id,'ticketlimit',String(l),lang);return ix.reply({content:r.ok?r.msg:r.err,flags:1<<6});}
        if(sc==='config'){const e=cfgEmbed(ss,g,client,lang);return ix.reply({embeds:[e],flags:1<<6});}
        if(!ss?.ticketCategory&&sc!=='setup')return ix.reply({content:t.notSet,flags:1<<6});

        if(sc==='setup'){const e=new EmbedBuilder().setColor('#00fbff').setAuthor({name:`🦅 ${t.sTitle}`,iconURL:client.user.displayAvatarURL()}).setDescription(t.sDesc+'\n\n'+t.sUsage('/')).setFooter({text:`🦅 ARCHON CG-223 • ${g.name}`,iconURL:client.user.displayAvatarURL()}).setTimestamp();return ix.reply({embeds:[e],flags:1<<6});}
        if(sc==='panel'){const e=panelEmbed(ss,g.name,lang),m=panelMenu(ss),r=new ActionRowBuilder().addComponents(m);await ix.reply({content:'Posting...',flags:1<<6});const s=await ix.channel.send({embeds:[e],components:[r]}).catch(()=>null);if(s){await ix.editReply({content:'✅ Posted!'}).catch(()=>{});try{db.prepare(`UPDATE server_settings SET ticket_panel_channel=? WHERE guild_id=?`).run(s.id,g.id);}catch(e){}}else await ix.editReply({content:'❌ Failed.'}).catch(()=>{});return;}
        if(sc==='close'){const ch=ix.channel,tk=active.get(ch.id);if(!tk)return ix.reply({content:'❌ Not a ticket.',flags:1<<6});if(u.id!==tk.creatorId&&!isStaff(ix.member,ss))return ix.reply({content:t.noPerm,flags:1<<6});await ix.deferReply();await saveTx(ch,tk,u.id,client,ss);await ix.editReply({content:t.closing}).catch(()=>{});active.delete(ch.id);if(db)delTicket(db,ch.id);const ex=timers.get(ch.id);if(ex){clearTimeout(ex);timers.delete(ch.id);}setTimeout(()=>ch.delete(`By ${u.tag}`).catch(()=>{}),5000);return;}
    },

    // ================= COMPONENT HANDLER =================
    handleComponent: async(ix,client)=>{
        const lang=ix.locale?.startsWith('fr')?'fr':'en', t=TX[lang]||TX.en, db=client.db, ss=effectiveSettings(client.getServerSettings?.(ix.guild?.id)||{},ix.guild?.id);

        // SELECT MENU - CREATE TICKET (CRITICAL: uses 'ticket_category_select' to match index.js router!)
        if(ix.isStringSelectMenu()&&ix.customId==='ticket_category_select'){
            const g=ix.guild,u=ix.user,cv=ix.values[0],cats=getCats(ss),cat=cats.find(c=>c.value===cv)||cats[0];
            await ix.deferReply({flags:1<<6});
            const lim=ss?.ticketLimitPerUser||1;
            if(countUserTix(g.id,u.id)>=lim)return ix.editReply({content:t.maxT(lim)}).catch(()=>{});
            if(!ss?.ticketCategory)return ix.editReply({content:t.notSet}).catch(()=>{});
            try{
                const tc=await createCh(g,u.id,u.username,cat,ss,client);
                const n=counters.get(g.id)||1;
                const td={creatorId:u.id,creatorTag:u.tag,createdAt:Date.now(),claimedBy:null,category:`${cat.emoji} ${cat.label}`,categoryValue:cat.value,guildId:g.id,number:n,participants:[u.id]};
                active.set(tc.id,td); saveTicket(db,tc.id,td);
                await welcomeMsg(tc,u,cat,n,lang);
                resetACTimer(tc.id,client,ss);
                const e=new EmbedBuilder().setColor('#2ecc71').setDescription(`${t.made}\n👉 <#${tc.id}>`).setTimestamp();
                await ix.editReply({embeds:[e]}).catch(()=>{});
            }catch(err){console.error('[TIX]',err);await ix.editReply({content:t.createErr}).catch(()=>{});}
            return true;
        }

        if(!ix.isButton()||!ix.customId.startsWith('ticket_'))return false;
        const p=ix.customId.split('_'),act=p[1],cid=p[2],crid=p[3],uid=ix.user.id;
        let tk=active.get(cid); if(!tk&&db){tk=loadTicket(db,cid);if(tk)active.set(cid,tk);}
        if(tk&&ix.guildId!==tk.guildId)return ix.reply({content:'❌ Wrong server.',flags:1<<6}).catch(()=>{});
        const isC=uid===crid, isS=isStaff(ix.member,ss);

        // CLAIM
        if(act==='claim'){if(!isS)return ix.reply({content:t.staffOnlyClaim,flags:1<<6}).catch(()=>{});if(tk?.claimedBy)return ix.reply({content:t.already,flags:1<<6}).catch(()=>{});tk.claimedBy=uid;if(db)saveTicket(db,cid,tk);try{const msgs=await ix.channel.messages.fetch({limit:10});const wm=msgs.find(m=>m.author.id===client.user.id&&m.embeds?.[0]?.author?.name?.includes('TICKET'));if(wm&&wm.embeds[0]){const ne=EmbedBuilder.from(wm.embeds[0]).spliceFields(3,1,{name:t.st,value:`${t.claimed2}\n${t.claimed}: <@${uid}>`,inline:true});await wm.edit({embeds:[ne]}).catch(()=>{});}}catch(e){}await ix.channel.send(typeof t.claimed === 'function' ? t.claimed(uid) : `🙋 <@${uid}> claimed this ticket.`);await ix.reply({content:'✅ Claimed.',flags:1<<6}).catch(()=>{});resetACTimer(cid,client,ss);return true;}

        // CLOSE (confirm)
        if(act==='close'){if(!isC&&!isS)return ix.reply({content:t.noPerm,flags:1<<6}).catch(()=>{});const e=new EmbedBuilder().setColor('#e74c3c').setTitle(t.closeQ).setDescription(t.closeD);const r=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_confirmclose_${cid}_${crid}_${uid}`).setLabel(t.closeY).setStyle(ButtonStyle.Danger).setEmoji('✅'),new ButtonBuilder().setCustomId(`ticket_cancelclose_${cid}_${crid}`).setLabel(t.closeN).setStyle(ButtonStyle.Secondary).setEmoji('❌'));await ix.reply({embeds:[e],components:[r],flags:1<<6}).catch(()=>{});return true;}

        // CONFIRM CLOSE
        if(act==='confirmclose'){
            const cl=p[4]||uid;
            await ix.update({content:t.closing,embeds:[],components:[]}).catch(()=>{});
            const ch=ix.channel;
            if(tk) await saveTx(ch,tk,cl,client,ss);
            await ch.send(t.closedBy(cl)).catch(()=>{});
            active.delete(cid);
            if(db) delTicket(db,cid);
            const ex=timers.get(cid);
            if(ex){clearTimeout(ex);timers.delete(cid);}
            
            // Send rating request to ticket creator
            try {
                const creator = await client.users.fetch(tk?.creatorId || crid).catch(()=>null);
                if (creator && creator.id !== cl) {
                    const ratingEmbed = new EmbedBuilder()
                        .setColor(0x00f0ff)
                        .setAuthor({ name: '🦅 ARCHON ENGINE • SUPPORT FEEDBACK' })
                        .setDescription(
                            `**Your ticket has been closed.**

` +
                            `How would you rate your support experience?
` +
                            `*Server: ${ix.guild?.name}*`
                        )
                        .setFooter({ text: 'BAMAKO_223 🇲🇱 • Your feedback helps us improve' });
                    const ratingRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`ticket_rate_1_${ix.guild?.id}`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`ticket_rate_2_${ix.guild?.id}`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`ticket_rate_3_${ix.guild?.id}`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`ticket_rate_4_${ix.guild?.id}`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`ticket_rate_5_${ix.guild?.id}`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Success),
                    );
                    await creator.send({ embeds: [ratingEmbed], components: [ratingRow] }).catch(()=>{});
                }
            } catch(e) {}
            
            setTimeout(()=>ch.delete(`By ${ix.user.tag}`).catch(()=>{}),5000);
            return true;
        }

        // CANCEL CLOSE
        if(act==='cancelclose'){await ix.deleteReply().catch(()=>{});return true;}

        // TRANSCRIPT
        if(act==='transcript'){if(!isC&&!isS)return ix.reply({content:t.noPerm,flags:1<<6}).catch(()=>{});await ix.deferReply({flags:1<<6});const ch=ix.channel;if(!tk)return ix.editReply({content:'❌ Data not found.'}).catch(()=>{});const r=await saveTx(ch,tk,null,client,ss);if(r===true)await ix.editReply({content:t.txSaved}).catch(()=>{});else if(r&&r.buffer)await ix.editReply({content:t.txSaved,files:[{attachment:r.buffer,name:r.filename}]}).catch(()=>{});else await ix.editReply({content:'❌ Failed.'}).catch(()=>{});resetACTimer(cid,client,ss);return true;}

        // RATING
        if(act==='rate'){
            const stars = parseInt(p[2]) || 0;
            const gid = p[3];
            const starEmoji = '⭐'.repeat(stars);
            await ix.update({ 
                embeds: [new EmbedBuilder().setColor(0x2ecc71)
                    .setDescription(`✅ **Thank you for your feedback!**

You rated: ${starEmoji}

*Your feedback helps improve ARCHON support.*`)],
                components: [] 
            }).catch(()=>{});
            // Log rating
            try {
                const ss2 = client.getServerSettings?.(gid) || {};
                const txCh = ss2?.ticketTranscriptChannel;
                if (txCh) {
                    const logCh = await client.channels.fetch(txCh).catch(()=>null);
                    if (logCh) {
                        await logCh.send({ embeds: [new EmbedBuilder().setColor(0xf1c40f)
                            .setDescription(`⭐ **Support Rating** — ${starEmoji} (${stars}/5)
From: <@${ix.user.id}>`)
                            .setTimestamp()] }).catch(()=>{});
                    }
                }
            } catch(e) {}
            return true;
        }

        return false;
    },

    setupTicketDB,loadAllTicketsFromDB
};
