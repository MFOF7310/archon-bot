// plugins/brave.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
    name: 'ask',
    aliases: ['search', 'brave', 'query', 'question', 'recherche'],
    description: 'Ask anything with real-time web search using Brave Search API',
    usage: '.ask <your question>',
    cooldown: 10000, // Increased to 10 seconds to respect Brave rate limits
    
    /**
     * Execute the ask command
     * @param {Client} client - Discord client instance
     * @param {Message} message - Message object
     * @param {Array} args - Command arguments
     * @param {Object} database - Database object
     */
    run: async (client, message, args, database) => {
        // Send typing indicator IMMEDIATELY to prevent Discord timeout
        await message.channel.sendTyping();
        
        // Check if user provided a question
        if (!args.length) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❓ Missing Question')
                .setDescription(`Please provide a question!\n\n**Example:** \`${module.exports.usage}\``)
                .setFooter({ text: 'You can ask anything - I\'ll search the web for answers!' })
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }

        const question = args.join(' ');
        
        // Check if Brave API key is configured
        if (!process.env.BRAVE_API_KEY) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('⚠️ Configuration Error')
                .setDescription('Brave Search API key is not configured. Please contact the server administrator.')
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }

        // Initialize cache if it doesn't exist
        if (!client.braveCache) {
            client.braveCache = new Map();
        }
        
        // Run memory sweeper BEFORE adding new data
        const cleanedCount = cleanupOldCache(client.braveCache);
        if (cleanedCount > 0) {
            console.log(`[MEMORY] Cleaned ${cleanedCount} stale search sessions`);
        }

        // Detect if question might be about local Malian content
        const isLocalQuery = detectLocalQuery(question);
        
        // Send thinking message with region info
        const thinkingEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🔍 Searching the Web...')
            .setDescription(`**Question:** ${question}\n\nSearching Brave Search for the most relevant results...`)
            .setFooter({ text: isLocalQuery ? '🇲🇱 Prioritizing Malian content' : '🌍 Global search' })
            .setTimestamp();
        
        const thinkingMsg = await message.reply({ embeds: [thinkingEmbed] });
        
        // Keep typing indicator active during search
        const typingInterval = setInterval(() => {
            message.channel.sendTyping().catch(() => {});
        }, 5000); // Send typing every 5 seconds

        try {
            // Perform Brave Search with country parameter and proper headers
            const searchResults = await performBraveSearch(question, isLocalQuery);
            
            // Clear typing interval
            clearInterval(typingInterval);
            
            if (!searchResults || searchResults.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setColor('#ffaa44')
                    .setTitle('🔍 No Results Found')
                    .setDescription(`I couldn't find any results for:\n**"${question}"**\n\nTry rephrasing your question or being more specific.`)
                    .addFields(
                        { name: '💡 Tip', value: 'Try using French or Bambara keywords for local Malian content!', inline: false },
                        { name: '📝 Example', value: '`.ask actualités Bamako` or `.ask musique malienne`', inline: false }
                    )
                    .setTimestamp();
                
                return thinkingMsg.edit({ embeds: [noResultsEmbed] });
            }

            // Create the main results embed
            const resultsEmbed = createResultsEmbed(question, searchResults, message.author, isLocalQuery);
            
            // Create buttons for navigation and AI summary
            const row = new ActionRowBuilder();
            
            if (searchResults.length > 1) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('brave_prev')
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('brave_next')
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('brave_first')
                        .setLabel('First')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('brave_last')
                        .setLabel('Last')
                        .setStyle(ButtonStyle.Secondary)
                );
            }
            
            // Add AI Summary button if Groq is available
            if (process.env.GROQ_API_KEY) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('brave_summarize')
                        .setLabel('✨ Summarize with AI')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🤖')
                );
            }

            // Store search results with metadata
            client.braveCache.set(message.author.id, {
                results: searchResults,
                question: question,
                currentIndex: 0,
                timestamp: Date.now(),
                messageId: thinkingMsg.id,
                channelId: message.channel.id,
                isLocalQuery: isLocalQuery,
                userId: message.author.id,
                username: message.author.username
            });

            // Log memory usage for debugging (optional)
            if (client.braveCache.size % 10 === 0) {
                console.log(`[MEMORY] Active search sessions: ${client.braveCache.size}`);
            }

            // Send the results
            await thinkingMsg.edit({ 
                embeds: [resultsEmbed], 
                components: [row] 
            });

            // Set multiple cleanup mechanisms
            
            // 1. Quick cleanup after 2 minutes (collector ends anyway)
            setTimeout(() => {
                if (client.braveCache.has(message.author.id)) {
                    const cache = client.braveCache.get(message.author.id);
                    if (cache.messageId === thinkingMsg.id) {
                        client.braveCache.delete(message.author.id);
                        console.log(`[MEMORY] Cleaned session for ${cache.username} (${cache.userId}) - timeout`);
                    }
                }
            }, 120000); // 2 minutes

            // 2. Long-term cleanup after 10 minutes (fail-safe)
            setTimeout(() => {
                if (client.braveCache.has(message.author.id)) {
                    const cache = client.braveCache.get(message.author.id);
                    if (Date.now() - cache.timestamp > 600000) {
                        client.braveCache.delete(message.author.id);
                        console.log(`[MEMORY] Cleaned stale session for ${cache.username} (${cache.userId}) - max age`);
                    }
                }
            }, 600000); // 10 minutes

            // Create button collector with error handling
            const filter = (interaction) => 
                interaction.user.id === message.author.id && 
                interaction.customId.startsWith('brave_');
            
            const collector = message.channel.createMessageComponentCollector({ 
                filter, 
                time: 60000 // 1 minute active collector
            });

            collector.on('collect', async (interaction) => {
                // Defer update immediately to prevent timeout
                await interaction.deferUpdate();
                
                const cache = client.braveCache.get(message.author.id);
                if (!cache) {
                    // Session expired - show helpful message
                    const expiredEmbed = new EmbedBuilder()
                        .setColor('#95a5a6')
                        .setTitle('⏰ Search Session Expired')
                        .setDescription('Your search session has ended to save resources.')
                        .addFields(
                            { name: '🔍 Want to search again?', value: `Type \`.ask ${question.substring(0, 50)}...\` to start a new search!` },
                            { name: '💡 Pro Tip', value: 'Use the AI summary button quickly - sessions last 1 minute!' },
                            { name: '🧹 Memory Management', value: 'Old sessions are automatically cleaned to keep the bot running smoothly.' }
                        )
                        .setFooter({ text: 'ARCHITECT CG-223 • Automatic Memory Sweeper Active' })
                        .setTimestamp();
                    
                    await interaction.editReply({ 
                        embeds: [expiredEmbed],
                        components: [],
                        content: '⏰ **Session Expired** - Please run `.ask` again to search!'
                    });
                    return;
                }

                // Handle AI Summary button
                if (interaction.customId === 'brave_summarize') {
                    // Send typing indicator for AI processing
                    await interaction.channel.sendTyping();
                    
                    const currentResult = cache.results[cache.currentIndex];
                    
                    // Create loading embed with local context
                    const loadingEmbed = new EmbedBuilder()
                        .setColor('#f1c40f')
                        .setTitle('🤖 Lydia is analyzing...')
                        .setDescription(`📄 **Analyzing:** ${currentResult.title.substring(0, 100)}\n\n🔍 Processing with regional context...`)
                        .setFooter({ text: cache.isLocalQuery ? '🇲🇱 Considering Malian context' : '🌍 Global perspective' })
                        .setTimestamp();
                    
                    const summaryMsg = await interaction.followUp({ 
                        embeds: [loadingEmbed],
                        ephemeral: true 
                    });
                    
                    try {
                        // Generate AI summary using Groq with regional awareness
                        const summary = await generateAISummary(question, currentResult, cache.isLocalQuery);
                        
                        const summaryEmbed = new EmbedBuilder()
                            .setColor('#9b59b6')
                            .setAuthor({ 
                                name: '🤖 Lydia AI Analysis', 
                                iconURL: client.user.displayAvatarURL()
                            })
                            .setTitle(`📝 ${currentResult.title.substring(0, 80)}`)
                            .setDescription(summary)
                            .addFields(
                                { 
                                    name: '🔍 Your Question', 
                                    value: question.length > 200 ? question.substring(0, 197) + '...' : question,
                                    inline: false
                                },
                                { 
                                    name: '🔗 Source', 
                                    value: `[Click to read full article](${currentResult.url})`,
                                    inline: true
                                },
                                { 
                                    name: '🌍 Context', 
                                    value: cache.isLocalQuery ? '🇲🇱 Malian-focused results' : '🌐 Global search',
                                    inline: true
                                }
                            )
                            .setFooter({ 
                                text: 'Powered by Groq AI • Real-time analysis',
                                iconURL: client.user.displayAvatarURL()
                            })
                            .setTimestamp();
                        
                        await summaryMsg.edit({ embeds: [summaryEmbed] });
                        
                    } catch (error) {
                        console.error('AI Summary Error:', error);
                        
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#ff4444')
                            .setTitle('❌ Summary Generation Failed')
                            .setDescription('Sorry, I couldn\'t generate a summary right now.')
                            .addFields(
                                { name: '💡 Try', value: '• Click on the source link directly\n• Re-run the search\n• Ask a more specific question' }
                            )
                            .setTimestamp();
                        
                        await summaryMsg.edit({ embeds: [errorEmbed] });
                    }
                    return;
                }
                
                // Handle navigation buttons
                let newIndex = cache.currentIndex;
                
                switch (interaction.customId) {
                    case 'brave_prev':
                        newIndex = Math.max(0, cache.currentIndex - 1);
                        break;
                    case 'brave_next':
                        newIndex = Math.min(cache.results.length - 1, cache.currentIndex + 1);
                        break;
                    case 'brave_first':
                        newIndex = 0;
                        break;
                    case 'brave_last':
                        newIndex = cache.results.length - 1;
                        break;
                }

                if (newIndex !== cache.currentIndex) {
                    cache.currentIndex = newIndex;
                    cache.timestamp = Date.now(); // Update timestamp on activity
                    client.braveCache.set(message.author.id, cache);
                    
                    const newEmbed = createResultsEmbed(
                        cache.question, 
                        cache.results, 
                        message.author,
                        newIndex,
                        cache.isLocalQuery
                    );
                    
                    // Update button states
                    const newRow = new ActionRowBuilder();
                    
                    if (cache.results.length > 1) {
                        newRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId('brave_prev')
                                .setLabel('◀ Previous')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(newIndex === 0),
                            new ButtonBuilder()
                                .setCustomId('brave_next')
                                .setLabel('Next ▶')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(newIndex === cache.results.length - 1),
                            new ButtonBuilder()
                                .setCustomId('brave_first')
                                .setLabel('First')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(newIndex === 0),
                            new ButtonBuilder()
                                .setCustomId('brave_last')
                                .setLabel('Last')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(newIndex === cache.results.length - 1)
                        );
                    }
                    
                    if (process.env.GROQ_API_KEY) {
                        newRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId('brave_summarize')
                                .setLabel('✨ Summarize with AI')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('🤖')
                        );
                    }
                    
                    await interaction.editReply({ 
                        embeds: [newEmbed], 
                        components: [newRow] 
                    });
                }
            });

            collector.on('end', async () => {
                // Professional session expiration message
                const expiredEmbed = new EmbedBuilder()
                    .setColor('#95a5a6')
                    .setTitle('⏰ Search Session Complete')
                    .setDescription('This search session has ended to optimize performance.')
                    .addFields(
                        { 
                            name: '🔍 Start a New Search', 
                            value: `Type \`.ask ${question.substring(0, 50)}...\` to search again`,
                            inline: false
                        },
                        { 
                            name: '💡 Quick Tip', 
                            value: 'Use the AI summary button within 60 seconds for instant analysis!',
                            inline: false
                        },
                        { 
                            name: '🧹 Memory Management', 
                            value: 'ARCHITECT CG-223 automatically cleans up old sessions to keep the bot running smoothly.',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'ARCHITECT CG-223 • Clean Memory Management • Auto-Sweeper Active' })
                    .setTimestamp();
                
                const cleanupRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('brave_new_search')
                            .setLabel('🔍 New Search')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔍'),
                        new ButtonBuilder()
                            .setCustomId('brave_expired')
                            .setLabel('Session Completed')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                
                try {
                    await thinkingMsg.edit({ 
                        embeds: [expiredEmbed], 
                        components: [cleanupRow] 
                    });
                } catch (e) {
                    // Message might have been deleted
                }
                
                // Clean up cache
                if (client.braveCache.has(message.author.id)) {
                    const cache = client.braveCache.get(message.author.id);
                    console.log(`[MEMORY] Cleaned session for ${cache.username} (${cache.userId}) - collector ended`);
                    client.braveCache.delete(message.author.id);
                }
            });

            // Handle the "New Search" button after expiration
            const newSearchFilter = (interaction) => 
                interaction.customId === 'brave_new_search' && 
                interaction.user.id === message.author.id;
            
            const newSearchCollector = message.channel.createMessageComponentCollector({ 
                filter: newSearchFilter, 
                time: 300000 // 5 minutes
            });
            
            newSearchCollector.on('collect', async (interaction) => {
                await interaction.deferUpdate();
                // Trigger a new search with the same query
                module.exports.run(client, message, args, database);
            });

        } catch (error) {
            // Clear typing interval on error
            clearInterval(typingInterval);
            
            // Detailed error logging for debugging
            console.error('=== BRAVE SEARCH ERROR DEBUG ===');
            console.error('Status:', error.response?.status);
            console.error('Status Text:', error.response?.statusText);
            console.error('Error Data:', error.response?.data);
            console.error('Error Message:', error.message);
            console.error('================================');
            
            let errorMessage = '';
            let errorColor = '#ff4444';
            let errorTitle = '❌ Search Failed';
            
            // Handle specific error types
            if (error.response?.status === 422) {
                errorTitle = '⚠️ API Compatibility Error';
                errorMessage = 'The search API requires updated headers. This has been logged and will be fixed soon.';
                errorColor = '#ffaa44';
            } else if (error.response?.status === 429) {
                errorTitle = '⏱️ Rate Limit Reached';
                errorMessage = 'Too many searches right now. Please wait a few seconds and try again.\n\n**Tip:** Use the AI summary feature to get more value from each search!';
                errorColor = '#ffaa44';
            } else if (error.response?.status === 401 || error.response?.status === 403) {
                errorTitle = '🔑 API Key Issue';
                errorMessage = 'The Brave Search API key is invalid or expired. Please contact the server administrator.';
                errorColor = '#ff4444';
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorTitle = '⏰ Request Timeout';
                errorMessage = 'The search took too long to respond. Please try again in a moment.\n\nThis sometimes happens with regional searches in Mali.';
                errorColor = '#ffaa44';
            } else {
                errorMessage = `An error occurred while searching:\n\`${error.message}\`\n\nPlease try again later.`;
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor(errorColor)
                .setTitle(errorTitle)
                .setDescription(errorMessage)
                .addFields(
                    { name: '💡 Troubleshooting', value: '• Wait 10 seconds between searches\n• Try more specific keywords\n• Use `.ask help` for examples', inline: false }
                )
                .setFooter({ text: `Error Code: ${error.response?.status || error.code || 'Unknown'} • Try again in a few seconds` })
                .setTimestamp();
            
            await thinkingMsg.edit({ embeds: [errorEmbed] });
        }
    }
};

/**
 * Clean up old cache entries to prevent memory bloat
 * Runs as a sweeper on every new search
 * @param {Map} cache - The cache map
 * @returns {number} Number of entries cleaned
 */
function cleanupOldCache(cache) {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [userId, data] of cache.entries()) {
        // Remove sessions older than 5 minutes
        if (now - data.timestamp > 300000) { // 5 minutes
            cache.delete(userId);
            cleanedCount++;
            console.log(`[MEMORY SWEEPER] Removed stale session for ${data.username || userId} (${userId}) - age: ${Math.floor((now - data.timestamp) / 1000)}s`);
        }
    }
    
    // Log current cache size if we have many active sessions
    if (cache.size > 20) {
        console.log(`[MEMORY SWEEPER] Active sessions: ${cache.size} - Consider cleanup if sustained`);
    }
    
    return cleanedCount;
}

/**
 * Detect if query might be about local Malian content
 * @param {string} query - Search query
 * @returns {boolean} True if likely local content
 */
function detectLocalQuery(query) {
    const localKeywords = [
        'mali', 'bamako', 'malien', 'malienne', 'bambara', 'djoliba',
        'ségou', 'sikasso', 'mopti', 'gao', 'timbuktu', 'tombouctou',
        'kayes', 'koulikoro', 'dogon', 'bandiagara', 'niger river',
        'mandé', 'mandingue', 'sankoré', 'djenné', 'music mali',
        'salif keita', 'ali farka toure', 'oumou sangaré', 'habib koité',
        'actualités mali', 'infos bamako', 'maliweb', 'malijet'
    ];
    
    const lowerQuery = query.toLowerCase();
    return localKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Perform Brave Search API request with country optimization and proper headers
 * @param {string} query - Search query
 * @param {boolean} isLocalQuery - Whether to prioritize local results
 * @returns {Promise<Array>} Array of search results
 */
async function performBraveSearch(query, isLocalQuery = false) {
    try {
        const params = {
            q: query,
            count: 5,
            safesearch: 'moderate'
        };
        
        // Add country parameter for local relevance
        if (isLocalQuery) {
            params.country = 'ML'; // Mali country code
            params.search_lang = 'fr'; // Prefer French results for Mali
        }
        
        const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache', // Critical for 2026 Brave API
                'X-Subscription-Token': process.env.BRAVE_API_KEY,
                'User-Agent': 'CloudGaming-223-Discord-Bot/1.0 (Malian Community)'
            },
            params: params,
            timeout: 10000 // 10 second timeout
        });

        const results = [];
        
        // Process web results
        if (response.data.web && response.data.web.results) {
            for (const result of response.data.web.results) {
                results.push({
                    title: result.title || 'No Title',
                    description: result.description || 'No description available',
                    url: result.url,
                    age: result.age || 'Unknown',
                    type: 'web',
                    language: result.meta_url?.hostname?.includes('.ml') ? '🇲🇱' : '🌐'
                });
            }
        }
        
        // Process news results for local content
        if (results.length < 3 && response.data.news && response.data.news.results) {
            for (const result of response.data.news.results) {
                results.push({
                    title: result.title || 'No Title',
                    description: result.description || 'No description available',
                    url: result.url,
                    age: result.age || 'Unknown',
                    type: 'news',
                    source: result.source?.name || 'Unknown Source',
                    language: result.language || 'fr'
                });
            }
        }
        
        return results.slice(0, 5);
        
    } catch (error) {
        console.error('Brave Search API Error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
}

/**
 * Generate AI summary using Groq (Lydia) with regional awareness
 * @param {string} question - Original user question
 * @param {Object} result - Search result object
 * @param {boolean} isLocalQuery - Whether this is a local query
 * @returns {Promise<string>} AI-generated summary
 */
async function generateAISummary(question, result, isLocalQuery = false) {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const contextHint = isLocalQuery ? 
        'This user is in Mali/Bamako region. Consider local context and relevance.' : 
        'This is a global search query.';
    
    const prompt = `
You are Lydia, an intelligent AI assistant for the Cloud Gaming-223 Discord server (Malian community).

${contextHint}

**User's Question:** ${question}

**Article Title:** ${result.title}
**Article Content:** ${result.description.substring(0, 1500)}
**Source:** ${result.url}

Please provide:
1. A 2-3 sentence summary that directly answers the user's question
2. Key takeaways (max 3 bullet points)
3. ${isLocalQuery ? 'Local relevance assessment (is this useful for Malian users?)' : 'Global relevance assessment'}

Keep the response friendly, concise, and under 500 characters. Use simple language.
`;

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { 
                    role: 'system', 
                    content: 'You are Lydia, an AI assistant for a Malian Discord gaming community. Be helpful, concise, and culturally aware.' 
                },
                { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.7,
            timeout: 15000 // 15 second timeout for Groq
        });
        
        return completion.choices[0].message.content.trim();
        
    } catch (error) {
        console.error('Groq Summary Error:', error);
        throw new Error('Failed to generate AI summary');
    }
}

/**
 * Create an embed for search results with regional indicators
 * @param {string} question - Original question
 * @param {Array} results - Search results array
 * @param {User} author - Message author
 * @param {number} index - Current result index (0-based)
 * @param {boolean} isLocalQuery - Whether local search was prioritized
 * @returns {EmbedBuilder} Discord embed
 */
function createResultsEmbed(question, results, author, index = 0, isLocalQuery = false) {
    const result = results[index];
    const totalResults = results.length;
    
    const typeEmoji = {
        web: '🌐',
        news: '📰',
        video: '🎥',
        image: '🖼️'
    }[result.type] || '🔍';
    
    let description = result.description;
    if (description.length > 500) {
        description = description.substring(0, 497) + '...';
    }
    
    const embed = new EmbedBuilder()
        .setColor(isLocalQuery ? '#ff6b35' : '#4a90e2')
        .setAuthor({ 
            name: isLocalQuery ? '🇲🇱 Brave Search • Malian Results' : '🌍 Brave Search • Global Results', 
            iconURL: 'https://brave.com/static-assets/images/brave-logo.svg',
            url: 'https://search.brave.com'
        })
        .setTitle(`${typeEmoji} ${result.title.substring(0, 256)}`)
        .setURL(result.url)
        .setDescription(description)
        .addFields(
            { 
                name: '🔗 Source', 
                value: result.url.length > 60 ? result.url.substring(0, 57) + '...' : result.url,
                inline: false
            },
            { 
                name: '📊 Result Info', 
                value: `Result ${index + 1} of ${totalResults}\nType: ${result.type.toUpperCase()}`,
                inline: true
            }
        )
        .setFooter({ 
            text: `${author.username} • ${totalResults} results • ${isLocalQuery ? '🇲🇱 Malian context prioritized' : '🌍 Global search'} ${process.env.GROQ_API_KEY ? '• Click 🤖 for AI summary' : ''}`,
            iconURL: author.displayAvatarURL()
        })
        .setTimestamp();
    
    if (result.age && result.age !== 'Unknown') {
        embed.addFields({ name: '📅 Age', value: result.age, inline: true });
    }
    
    if (result.type === 'news' && result.source) {
        embed.addFields({ name: '📰 Source', value: result.source, inline: true });
    }
    
    if (result.language) {
        embed.addFields({ name: '🌍 Language/Region', value: result.language, inline: true });
    }
    
    embed.addFields({ 
        name: '❓ Your Question', 
        value: question.length > 100 ? question.substring(0, 97) + '...' : question,
        inline: false 
    });
    
    return embed;
}