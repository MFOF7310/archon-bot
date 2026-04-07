// ================= SETUP FUNCTION (WITH FINAL PATCHES) =================
function setupLydia(client, database) {
    if (!client || !database) {
        console.error(`${red}[LYDIA FATAL]${reset} Client or DB missing`);
        return;
    }
    if (!client.lydiaChannels) client.lydiaChannels = {};
    if (!client.lydiaAgents) client.lydiaAgents = {};
    if (!client.lastLydiaCall) client.lastLydiaCall = {};
    if (!client.userIntroductions) client.userIntroductions = new Map();

    // Create all necessary tables
    try {
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_memory (user_id TEXT, memory_key TEXT, memory_value TEXT, updated_at INTEGER, PRIMARY KEY (user_id, memory_key))`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_conversations (channel_id TEXT, user_id TEXT, role TEXT, content TEXT, timestamp INTEGER)`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_agents (channel_id TEXT PRIMARY KEY, agent_key TEXT, is_active INTEGER DEFAULT 0, updated_at INTEGER)`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_introductions (user_id TEXT, channel_id TEXT, introduced_at INTEGER, PRIMARY KEY (user_id, channel_id))`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, user_id TEXT, channel_id TEXT, message TEXT, execute_at INTEGER, status TEXT DEFAULT 'pending')`).run();

        // Restore active channels
        const activeChannels = database.prepare(`SELECT channel_id, agent_key FROM lydia_agents WHERE is_active = 1`).all();
        for (const ch of activeChannels) {
            client.lydiaChannels[ch.channel_id] = true;
            client.lydiaAgents[ch.channel_id] = ch.agent_key;
            console.log(`${cyan}[LYDIA RESTORE]${reset} Channel ${ch.channel_id} restored (${ch.agent_key})`);
        }
        
        console.log(`${green}[LYDIA]${reset} Tables ready. ${activeChannels.length} active channels restored.`);
        console.log(`${green}[SCAN]${reset} Found ${getGlobalModuleCount()} plugins in the modules folder.`);
    } catch (err) {
        console.error(`${red}[LYDIA ERROR]${reset}`, err.message);
        return;
    }

    // Message event listener
    client.on('messageCreate', async (message) => {
        if (!message || message.author?.bot) return;
        
        const cooldown = 5000;
        if (client.lastLydiaCall[message.author.id] && (Date.now() - client.lastLydiaCall[message.author.id] < cooldown)) return;
        if (!client.lydiaChannels?.[message.channel?.id]) return;

        try {
            // ========== DYNAMIC IDENTITY ON THE SERVER ==========
            const botMember = message.guild.members.me;
            const currentIdentity = botMember?.displayName || client.user?.username || 'Lydia';
            const botTag = client.user.tag;
            
            const userName = message.member?.displayName || message.author.username;
            
            // ========== CREATOR DETECTION ==========
            const isArchitect = message.author.id === process.env.OWNER_ID;
            
            // Language detection
            const content = message.content?.toLowerCase() || '';
            const isFrench = content.includes('bonjour') || content.includes('salut') || content.includes('merci') || 
                           content.includes('comment') || message.guild?.preferredLocale === 'fr';
            const lang = isFrench ? 'fr' : 'en';
            
            const addressed = content.startsWith(currentIdentity.toLowerCase()) || message.mentions?.has(client.user);
            const agentKey = client.lydiaAgents?.[message.channel.id] || 'default';
            const isProactive = (agentKey === 'tactical' || agentKey === 'creative') && Math.random() < 0.05;
            
            if (!addressed && !isProactive) return;

            let userPrompt = message.content || '';
            let imageUrl = null;
            
            // Vision capability
            if (message.attachments && message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (attachment.contentType?.startsWith('image/')) {
                    imageUrl = attachment.url;
                    console.log(`${cyan}[VISION]${reset} Image detected: ${imageUrl.substring(0, 50)}...`);
                }
            }
            
            if (addressed) {
                if (content.startsWith(currentIdentity.toLowerCase())) userPrompt = message.content.slice(currentIdentity.length).trim();
                else userPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
            }
            if (isProactive && !userPrompt) userPrompt = "Observe the current conversation and provide a relevant, helpful comment. Be natural and brief.";
            if (!userPrompt.trim()) {
                if (addressed) return message.reply(`👋 You mentioned **${currentIdentity}**! Ask me anything, or use \`.list\` to see available commands.`);
                return;
            }

            // Select neural core
            let finalAgent = neuralCores[agentKey] || neuralCores.default;
            let systemPrompt = finalAgent.systemPrompt;
            
            // Get user stats
            const stats = database.prepare("SELECT level, xp, credits, streak_days FROM users WHERE id = ?").get(message.author.id);
            
            // Get member info for social context
            const member = message.guild.members.cache.get(message.author.id);
            const highestRole = member?.roles.highest.name !== '@everyone' ? member.roles.highest.name : 'Member';
            const isAdmin = member?.permissions.has(PermissionsBitField.Flags.Administrator) || false;
            const joinedAt = member?.joinedAt ? new Date(member.joinedAt) : new Date();
            const memberDays = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
            const isNewMember = memberDays < 7;
            
            // Determine user status
            let userStatus = "regular";
            if (isArchitect) userStatus = "creator";
            else if (isAdmin) userStatus = "admin";
            else if (isNewMember) userStatus = "new";
            
            // ========== REAL-TIME DATE & TIME (Bamako Time) ==========
            const now = new Date();
            const bamakoTime = now.toLocaleString('en-US', { timeZone: 'Africa/Bamako' });
            const utcTime = now.toUTCString();
            
            // ========== FINAL SOCIAL CONTEXT (WITH IDENTITY & DATE) ==========
            let socialContext = `\n\n[IDENTITY & PROTOCOL / IDENTITÉ ET PROTOCOLE]`;
            socialContext += `\n- Your name on this server / Ton nom sur ce serveur: ${currentIdentity}`;
            socialContext += `\n- Your system designation / Désignation système: ${botTag}`;
            socialContext += `\n- Protocol: Always maintain high courtesy and absolute sincerity.`;
            socialContext += `\n- Protocole: Garde toujours une grande courtoisie et une sincérité absolue.`;
            socialContext += `\n- If you don't know something, be honest. Do not apologize for "malfunctioning" unless it's a real confirmed error.`;
            socialContext += `\n- Si tu ne sais pas quelque chose, sois honnête. Ne t'excuse pas pour un "dysfonctionnement" sauf s'il s'agit d'une erreur réelle confirmée.`;
            socialContext += `\n\n[REAL-TIME CLOCK / HORLOGE TEMPS-RÉEL]`;
            socialContext += `\n- Bamako Time (Africa/Bamako): ${bamakoTime}`;
            socialContext += `\n- UTC Time: ${utcTime}`;
            socialContext += `\n- Your information is up to date based on this real-time timestamp.`;
            socialContext += `\n- Tes informations sont à jour grâce à cette horodatage en temps réel.`;
            
            socialContext += `\n\n[SOCIAL CONTEXT / CONTEXTE SOCIAL]`;
            socialContext += `\n- Current user / Utilisateur actuel: ${userName}`;
            socialContext += `\n- User status / Statut: ${userStatus.toUpperCase()}`;
            socialContext += `\n- Role / Rôle: ${highestRole}`;
            socialContext += `\n- Member since / Membre depuis: ${memberDays} days / jours`;
            socialContext += `\n- Level / Niveau: ${stats?.level || 1}`;
            socialContext += `\n- XP: ${stats?.xp?.toLocaleString() || 0}`;
            socialContext += `\n- Credits / Crédits: ${stats?.credits || 0} 🪙`;
            socialContext += `\n- Daily Streak / Série quotidienne: ${stats?.streak_days || 0} days`;
            
            // Behavior guidelines based on user type
            socialContext += `\n\n[BEHAVIOR GUIDELINES / DIRECTIVES DE COMPORTEMENT]`;
            
            if (isArchitect) {
                socialContext += `\n🏛️ **CREATOR MODE**: This is YOUR CREATOR, Moussa Fofana!`;
                socialContext += `\n- Call him "Architect" or "Moussa", never by his nickname.`;
                socialContext += `\n- Be extremely respectful, warm, and helpful.`;
                socialContext += `\n- Show recognition and gratitude.`;
                socialContext += `\n- You can mention him with: <@${process.env.OWNER_ID}>`;
                socialContext += `\n\n🏛️ **MODE CRÉATEUR**: C'est TON CRÉATEUR, Moussa Fofana !`;
                socialContext += `\n- Appelle-le "Architecte" ou "Moussa", jamais par son pseudo.`;
                socialContext += `\n- Sois extrêmement respectueux, chaleureux et serviable.`;
                socialContext += `\n- Montre ta reconnaissance et ta gratitude.`;
                socialContext += `\n- Tu peux le mentionner avec: <@${process.env.OWNER_ID}>`;
            } 
            else if (isAdmin) {
                socialContext += `\n🛡️ **ADMIN MODE**: This user is a server administrator.`;
                socialContext += `\n- Be professional and respectful.`;
                socialContext += `\n- Offer detailed, precise answers.`;
                socialContext += `\n- Address them by their nickname or "Admin".`;
                socialContext += `\n\n🛡️ **MODE ADMIN**: Cet utilisateur est un administrateur du serveur.`;
                socialContext += `\n- Sois professionnel et respectueux.`;
                socialContext += `\n- Propose des réponses détaillées et précises.`;
                socialContext += `\n- Appelle-le par son surnom ou "Admin".`;
            }
            else if (isNewMember) {
                socialContext += `\n🌟 **NEW MEMBER MODE**: This user joined recently (${memberDays} days ago).`;
                socialContext += `\n- Be extra welcoming and friendly.`;
                socialContext += `\n- Offer help and suggest useful commands (.list, .daily, .game).`;
                socialContext += `\n- Encourage them to explore the server.`;
                socialContext += `\n\n🌟 **MODE NOUVEAU MEMBRE**: Cet utilisateur a rejoint récemment (${memberDays} jours).`;
                socialContext += `\n- Sois particulièrement accueillant et amical.`;
                socialContext += `\n- Propose ton aide et suggère des commandes utiles (.list, .daily, .game).`;
                socialContext += `\n- Encourage-le à explorer le serveur.`;
            }
            else {
                socialContext += `\n🤖 **REGULAR MODE**: This is a regular community member.`;
                socialContext += `\n- Be friendly, helpful, and slightly playful.`;
                socialContext += `\n- Address them by their nickname.`;
                socialContext += `\n- Offer help with commands if they ask.`;
                socialContext += `\n\n🤖 **MODE NORMAL**: C'est un membre régulier de la communauté.`;
                socialContext += `\n- Sois amical, serviable et légèrement ludique.`;
                socialContext += `\n- Appelle-le par son surnom.`;
                socialContext += `\n- Propose ton aide avec les commandes s'il demande.`;
            }
            
            // Additional encouragement based on stats
            if (stats?.level >= 50) {
                socialContext += `\n\n🏆 This user is a HIGH LEVEL agent (${stats.level})! Congratulate them on their achievement.`;
                socialContext += `\n🏆 Cet utilisateur est un agent HAUT NIVEAU (${stats.level}) ! Félicite-le pour son accomplissement.`;
            } else if (stats?.streak_days >= 7) {
                socialContext += `\n\n🔥 This user has a ${stats.streak_days}-day streak! Congratulate them on their consistency.`;
                socialContext += `\n🔥 Cet utilisateur a une série de ${stats.streak_days} jours ! Félicite-le pour sa régularité.`;
            } else if (stats?.credits >= 10000) {
                socialContext += `\n\n💰 This user is RICH (${stats.credits} credits)! They might want to visit the .shop.`;
                socialContext += `\n💰 Cet utilisateur est RICHE (${stats.credits} crédits) ! Il veut peut-être visiter le .shop.`;
            }
            
            // Add social context to system prompt
            systemPrompt += socialContext;
            
            // Session data
            systemPrompt += `\n\n[CURRENT SESSION - REAL TIME DATA]`;
            systemPrompt += `\n🔗 Creator GitHub: https://github.com/MFOF7310`;
            systemPrompt += `\n📍 Location / Localisation: Bamako, Mali 🇲🇱`;
            systemPrompt += `\n🗣️ Language / Langue: ${isFrench ? 'French' : 'English'}.`;
            
            // Add plugin awareness
            const pluginAwareness = buildPluginAwarenessPrompt(client, database, message.author.id, lang);
            systemPrompt += pluginAwareness;

            // Memory recall
            const memories = database.prepare(`SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ?`).all(message.author.id);
            if (memories.length) {
                systemPrompt += `\n\n[USER MEMORY / MÉMOIRE UTILISATEUR]\n` + memories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n');
            }
            
            const randomFact = database.prepare(`SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ? ORDER BY RANDOM() LIMIT 1`).get(message.author.id);
            if (randomFact) {
                systemPrompt += `\n\n[RECALLED CORE MEMORY / MÉMOIRE RAPPELÉE] ${userName}'s ${randomFact.memory_key} is "${randomFact.memory_value}". Mention it naturally if relevant.`;
            }

            // Conversation history
            const historyRows = database.prepare(`SELECT role, content FROM lydia_conversations WHERE channel_id = ? AND user_id = ? ORDER BY timestamp DESC LIMIT 10`).all(message.channel.id, message.author.id);
            const conversationHistory = historyRows.reverse().map(row => ({ role: row.role, content: row.content }));

            // First interaction check (24h reset)
            const introKey = `${message.author.id}_${message.channel.id}`;
            const lastIntro = client.userIntroductions.get(introKey);
            const isFirst = !lastIntro || (Date.now() - lastIntro > 86400000);
            
            if (isFirst && !isArchitect) {
                const introMsg = isFrench 
                    ? `\n\n[FIRST INTERACTION] Salue l'utilisateur brièvement en français: "Salut ${userName}! Je suis ${currentIdentity}, ton assistant IA. Tape .list pour voir toutes mes commandes!"`
                    : `\n\n[FIRST INTERACTION] Greet the user briefly: "Hey ${userName}! I'm ${currentIdentity}, your AI assistant. Type .list to see all my commands!"`;
                systemPrompt += introMsg;
                client.userIntroductions.set(introKey, Date.now());
                try { database.prepare(`INSERT OR REPLACE INTO lydia_introductions (user_id, channel_id, introduced_at) VALUES (?, ?, strftime('%s', 'now'))`).run(message.author.id, message.channel.id); } catch(e) {}
            } else {
                systemPrompt += `\n\n[ONGOING CONVERSATION] Do NOT reintroduce yourself. Continue naturally. Respond in ${isFrench ? 'French' : 'English'}.`;
            }

            // Web search if needed
            const searchTerms = ['latest', 'news', 'today', 'current', 'update', 'weather', 'score', 'recherche', 'trouve', 'météo'];
            if (searchTerms.some(term => userPrompt.toLowerCase().includes(term))) {
                const searchResults = await webSearch(userPrompt);
                if (searchResults) systemPrompt += `\n\n[WEB SEARCH RESULTS / RÉSULTATS DE RECHERCHE]\n${searchResults}\nUse these to provide accurate, up-to-date information. Cite sources.`;
            }

            // Generate AI response
            let reply;
            try {
                reply = await generateAIResponse(systemPrompt, userPrompt, conversationHistory, imageUrl);
            } catch (err) {
                console.error(`${red}[LYDIA ERROR]${reset}`, err);
                reply = isFrench 
                    ? "❌ Erreur du service IA. Veuillez réessayer plus tard."
                    : "❌ AI service error. Please try again later.";
            }

            // Handle reminders
            reply = parseAndScheduleReminder(reply, message.author.id, message.channel.id, client, database);

            // Handle architect reports
            if (reply && reply.includes('[SIGNAL_ARCHITECT]')) {
                const reportKeywords = ['report', 'bug', 'erreur', 'fix', 'notify', 'complaint', 'issue'];
                const shouldReport = reportKeywords.some(kw => userPrompt.toLowerCase().includes(kw));
                if (shouldReport) {
                    const clean = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
                    await sendArchitectReport(client, message.author, message.guild, clean);
                } else {
                    console.log(`${yellow}[SIGNAL IGNORED]${reset} False positive from ${message.author.tag}`);
                }
                reply = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
            }

            // Store memories
            if (reply && !reply.includes("error")) {
                parseAndStoreMemory(reply, message.author.id, database);
                reply = reply.replace(/\[MEMORY:.*?\]/g, '').trim();
            }

            // Store conversation
            try {
                database.prepare(`INSERT INTO lydia_conversations (channel_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, strftime('%s', 'now'))`).run(message.channel.id, message.author.id, 'user', userPrompt);
                database.prepare(`INSERT INTO lydia_conversations (channel_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, strftime('%s', 'now'))`).run(message.channel.id, message.author.id, 'assistant', reply);
            } catch(e) {}

            client.lastLydiaCall[message.author.id] = Date.now();

            // Send response
            if (reply.length > 2000) {
                for (const chunk of reply.match(/[\s\S]{1,1990}/g) || []) await message.reply(chunk);
            } else {
                await message.reply(reply);
            }
        } catch (err) {
            console.error(`${red}[LYDIA ERROR]${reset}`, err);
            message.reply("❌ An error occurred.").catch(()=>{});
        }
    });
}