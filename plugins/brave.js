// plugins/brave.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
    name: 'ask',
    aliases: ['search', 'brave', 'query', 'question'],
    description: 'Ask anything with real-time web search using Brave Search API',
    usage: '.ask <your question>',
    cooldown: 5000, // 5 seconds cooldown in milliseconds
    
    /**
     * Execute the ask command
     * @param {Client} client - Discord client instance
     * @param {Message} message - Message object
     * @param {Array} args - Command arguments
     * @param {Object} database - Database object
     */
    run: async (client, message, args, database) => {
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

        // Send thinking message
        const thinkingMsg = await message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('#f1c40f')
                    .setTitle('🔍 Searching the Web...')
                    .setDescription(`**Question:** ${question}\n\nSearching Brave Search for the most relevant results...`)
                    .setFooter({ text: 'This may take a few seconds' })
                    .setTimestamp()
            ]
        });

        try {
            // Perform Brave Search
            const searchResults = await performBraveSearch(question);
            
            if (!searchResults || searchResults.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setColor('#ffaa44')
                    .setTitle('🔍 No Results Found')
                    .setDescription(`I couldn't find any results for:\n**"${question}"**\n\nTry rephrasing your question or being more specific.`)
                    .setTimestamp();
                
                return thinkingMsg.edit({ embeds: [noResultsEmbed] });
            }

            // Create the main results embed
            const resultsEmbed = createResultsEmbed(question, searchResults, message.author);
            
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

            // Store search results in a temporary cache with TTL
            if (!client.braveCache) client.braveCache = new Map();
            
            // Store with timestamp for automatic cleanup
            client.braveCache.set(message.author.id, {
                results: searchResults,
                question: question,
                currentIndex: 0,
                timestamp: Date.now(),
                messageId: thinkingMsg.id,
                channelId: message.channel.id
            });

            // Send the results
            await thinkingMsg.edit({ 
                embeds: [resultsEmbed], 
                components: [row] 
            });

            // Set automatic cleanup after 5 minutes (in case collector fails)
            setTimeout(() => {
                if (client.braveCache.has(message.author.id)) {
                    const cache = client.braveCache.get(message.author.id);
                    // Only cleanup if it's old (5+ minutes)
                    if (Date.now() - cache.timestamp > 300000) {
                        client.braveCache.delete(message.author.id);
                    }
                }
            }, 300000);

            // Create button collector for navigation and AI summary
            const filter = (interaction) => 
                interaction.user.id === message.author.id && 
                interaction.customId.startsWith('brave_');
            
            const collector = message.channel.createMessageComponentCollector({ 
                filter, 
                time: 60000 // 1 minute active collector
            });

            collector.on('collect', async (interaction) => {
                const cache = client.braveCache.get(message.author.id);
                if (!cache) {
                    await interaction.update({ 
                        content: '⏰ Search session expired. Please run `.ask` again.',
                        components: [],
                        embeds: []
                    });
                    return;
                }

                // Handle AI Summary button
                if (interaction.customId === 'brave_summarize') {
                    await interaction.deferUpdate();
                    
                    const currentResult = cache.results[cache.currentIndex];
                    
                    // Send typing indicator for AI processing
                    await interaction.channel.sendTyping();
                    
                    // Create loading embed
                    const loadingEmbed = new EmbedBuilder()
                        .setColor('#f1c40f')
                        .setTitle('🤖 Lydia is summarizing...')
                        .setDescription(`Analyzing: **${currentResult.title}**\n\nPlease wait while I generate an intelligent summary...`)
                        .setFooter({ text: 'Using Groq AI for analysis' })
                        .setTimestamp();
                    
                    const summaryMsg = await interaction.followUp({ 
                        embeds: [loadingEmbed],
                        ephemeral: true 
                    });
                    
                    try {
                        // Generate AI summary using Groq (Lydia)
                        const summary = await generateAISummary(question, currentResult);
                        
                        const summaryEmbed = new EmbedBuilder()
                            .setColor('#9b59b6')
                            .setAuthor({ 
                                name: '🤖 Lydia AI Summary', 
                                iconURL: client.user.displayAvatarURL()
                            })
                            .setTitle(`📝 Analysis: ${currentResult.title.substring(0, 100)}`)
                            .setDescription(summary)
                            .addFields(
                                { 
                                    name: '🔍 Original Question', 
                                    value: question.length > 200 ? question.substring(0, 197) + '...' : question,
                                    inline: false
                                },
                                { 
                                    name: '🔗 Source', 
                                    value: `[Click to read full article](${currentResult.url})`,
                                    inline: true
                                }
                            )
                            .setFooter({ 
                                text: 'Powered by Groq AI • Summary generated in real-time',
                                iconURL: client.user.displayAvatarURL()
                            })
                            .setTimestamp();
                        
                        await summaryMsg.edit({ embeds: [summaryEmbed] });
                        
                    } catch (error) {
                        console.error('AI Summary Error:', error);
                        
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#ff4444')
                            .setTitle('❌ Summary Failed')
                            .setDescription(`Sorry, I couldn't generate a summary right now.\n\n**Error:** ${error.message.substring(0, 150)}`)
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
                        newIndex
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
                    
                    // Always add AI Summary button if available
                    if (process.env.GROQ_API_KEY) {
                        newRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId('brave_summarize')
                                .setLabel('✨ Summarize with AI')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('🤖')
                        );
                    }
                    
                    await interaction.update({ 
                        embeds: [newEmbed], 
                        components: [newRow] 
                    });
                } else {
                    await interaction.deferUpdate();
                }
            });

            collector.on('end', async () => {
                // Clean up - remove buttons but keep the embed
                const cleanupRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('brave_expired')
                            .setLabel('Session Expired • Run .ask again')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                
                // Add AI button if it was there but now disabled
                if (process.env.GROQ_API_KEY) {
                    cleanupRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId('brave_summary_expired')
                            .setLabel('🤖 AI Summary Available')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                }
                
                try {
                    await thinkingMsg.edit({ components: [cleanupRow] });
                } catch (e) {
                    // Message might have been deleted
                }
                
                // Delete from cache
                client.braveCache.delete(message.author.id);
            });

        } catch (error) {
            console.error('Brave Search Error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ Search Failed')
                .setDescription(`An error occurred while searching:\n\`${error.message}\`\n\nPlease try again later.`)
                .setTimestamp();
            
            await thinkingMsg.edit({ embeds: [errorEmbed] });
        }
    }
};

/**
 * Perform Brave Search API request
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of search results
 */
async function performBraveSearch(query) {
    try {
        const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': process.env.BRAVE_API_KEY
            },
            params: {
                q: query,
                count: 5,
                safesearch: 'moderate'
            }
        });

        const results = [];
        
        if (response.data.web && response.data.web.results) {
            for (const result of response.data.web.results) {
                results.push({
                    title: result.title || 'No Title',
                    description: result.description || 'No description available',
                    url: result.url,
                    age: result.age || 'Unknown',
                    type: 'web'
                });
            }
        }
        
        if (results.length < 3 && response.data.news && response.data.news.results) {
            for (const result of response.data.news.results) {
                results.push({
                    title: result.title || 'No Title',
                    description: result.description || 'No description available',
                    url: result.url,
                    age: result.age || 'Unknown',
                    type: 'news',
                    source: result.source?.name || 'Unknown Source'
                });
            }
        }
        
        return results.slice(0, 5);
        
    } catch (error) {
        console.error('Brave Search API Error:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Generate AI summary using Groq (Lydia)
 * @param {string} question - Original user question
 * @param {Object} result - Search result object
 * @returns {Promise<string>} AI-generated summary
 */
async function generateAISummary(question, result) {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const prompt = `
You are Lydia, an intelligent AI assistant. Provide a concise, informative summary of the following search result.

**User's Question:** ${question}

**Article Title:** ${result.title}
**Article Content:** ${result.description.substring(0, 1500)}

Please provide:
1. A 2-3 sentence summary that directly answers the user's question
2. Key takeaways (bullet points, max 3)
3. A verdict on the reliability/source (if applicable)

Keep the response friendly, informative, and under 500 characters total.
`;

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { 
                    role: 'system', 
                    content: 'You are Lydia, an AI assistant that provides concise, accurate summaries. Be helpful and direct.' 
                },
                { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.7
        });
        
        return completion.choices[0].message.content.trim();
        
    } catch (error) {
        console.error('Groq Summary Error:', error);
        throw new Error('Failed to generate AI summary');
    }
}

/**
 * Create an embed for search results
 * @param {string} question - Original question
 * @param {Array} results - Search results array
 * @param {User} author - Message author
 * @param {number} index - Current result index (0-based)
 * @returns {EmbedBuilder} Discord embed
 */
function createResultsEmbed(question, results, author, index = 0) {
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
        .setColor('#4a90e2')
        .setAuthor({ 
            name: 'Brave Search Results', 
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
            text: `Asked by ${author.username} • ${totalResults} results found • Powered by Brave Search${process.env.GROQ_API_KEY ? ' • Click 🤖 for AI summary' : ''}`,
            iconURL: author.displayAvatarURL()
        })
        .setTimestamp();
    
    if (result.age && result.age !== 'Unknown') {
        embed.addFields({ name: '📅 Age', value: result.age, inline: true });
    }
    
    if (result.type === 'news' && result.source) {
        embed.addFields({ name: '📰 Source', value: result.source, inline: true });
    }
    
    embed.addFields({ 
        name: '❓ Your Question', 
        value: question.length > 100 ? question.substring(0, 97) + '...' : question,
        inline: false 
    });
    
    return embed;
}