// plugins/buypremium.js
// Archon Premium Gateway - Legendary Edition (env-ready)

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');

module.exports = {
    name: 'buypremium',
    aliases: ['subscribe', 'upgrade', 'vip'],
    category: '💎 ECONOMY',
    description: 'Generate a secure, trackable checkout link for Archon Premium with royal treatment.',

    async run(client, message, args, db, usedCommand, serverSettings) {
        const userId = message.author.id;
        const username = message.author.username;
        const avatar = message.author.displayAvatarURL({ dynamic: true, size: 1024 });
        const lang = client.detectLanguage?.(message.content) || 'en';

        // 🔥 Read from environment variable
        const baseUrl = process.env.DODO_PRODUCT_URL;
        if (!baseUrl) {
            console.error('[buypremium] ❌ DODO_PRODUCT_URL is missing from .env');
            return message.reply({ 
                content: '⚠️ The payment gateway is not configured correctly. Please contact an administrator.', 
                ephemeral: true 
            });
        }

        // Smart URL concatenation: preserve existing query params
        const separator = baseUrl.includes('?') ? '&' : '?';
        const trackableUrl = `${baseUrl}${separator}metadata[discord_user_id]=${userId}`;

        // ✨ Legendary welcoming message embed
        const welcomeEmbed = new EmbedBuilder()
            .setColor(Colors.Gold)
            .setAuthor({ 
                name: `⚜️ ARCHON PREMIUM • THE NEURAL ASCENSION ⚜️`, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle(`💎 WELCOME, NOBLE ${username.toUpperCase()} 💎`)
            .setDescription(
                lang === 'fr'
                    ? `**Salutations, Élu.**\nVotre chemin vers la puissance sans limite commence ici. Cliquez sur le bouclier doré ci-dessous pour sceller votre destinée.\n\n` +
                      `🔮 *Votre identifiant Discord sera lié automatiquement – l’activation sera instantanée dans vos messages privés.*`
                    : `**Hail, Chosen One.**\nYour journey to limitless neural sovereignty begins now. Click the golden shield below to seal your ascension.\n\n` +
                      `🔮 *Your Discord ID is automatically bound – instant activation will arrive via DM.*`
            )
            .addFields(
                { 
                    name: '🧠 UNLOCKED ABILITIES', 
                    value: '```yaml\n• Uncapped Lydia AI Memory Banks\n• Global Multi‑Server Log Mirroring\n• HTML Ticket Transcript Exporter\n• Priority Processing Threads\n• Legendary Role & Badge\n```', 
                    inline: false 
                },
                { 
                    name: '⚡ ACTIVATION RITUAL', 
                    value: `1️⃣ Click the **Secure Checkout** button\n2️⃣ Complete payment (sandbox or live)\n3️⃣ Receive your **Divine DM** within 5 seconds\n\n*Your glory awaits, ${username}.*`, 
                    inline: false 
                }
            )
            .setThumbnail(avatar)
            .setImage('https://media.discordapp.net/attachments/placeholder_banner.gif') // replace with your banner URL
            .setFooter({ 
                text: `🛡️ Node: BAMAKO_223 🇲🇱 • Royal Billing Pipeline • ID: ${userId}`, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // 💳 Secure payment button
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('💳  PROCEED TO SECURE CHECKOUT  💳')
                .setStyle(ButtonStyle.Link)
                .setURL(trackableUrl)
                .setEmoji('🔒')
        );

        return message.reply({ embeds: [welcomeEmbed], components: [actionRow] });
    }
};