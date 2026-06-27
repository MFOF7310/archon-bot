const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Slap messages for variety
const SLAP_MESSAGES = [
    '{from} slaps {to} across the face! 👋',
    '{from} gives {to} a reality check slap! 🫲',
    '{from} slaps {to} with a wet fish! 🐟',
    '{from} delivers a legendary slap to {to}! 💥',
    '{from} slaps {to} into next week! 🚀',
    '{from} sneak attacks {to} with a surprise slap! 😱',
    '{from} slaps {to} so hard they see stars! ⭐',
    '{from} gently slaps {to}... just kidding, it was hard! 💢',
];

// Track slap counts per user (resets on bot restart — use DB for permanent storage)
const slapCounts = new Map();

module.exports = {
    name: 'slap',
    aliases: ['smack', 'hit'],
    description: '👋 Slap someone interactively',
    category: 'Fun',
    cooldown: 3,
    
    data: new SlashCommandBuilder()
        .setName('slap')
        .setDescription('Slap someone with style')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Who deserves a slap?')
                .setRequired(true)),
    
    run: async (client, message, args) => {
        const target = message.mentions.users.first();
        
        if (!target) {
            return message.reply('❓ Mention someone to slap! Example: `.slap @user`');
        }
        
        if (target.id === message.author.id) {
            return message.reply("🤔 You can't slap yourself... or can you? Use the button to try!");
        }
        
        if (target.bot) {
            return message.reply('🤖 Slapping bots? What did they ever do to you?');
        }
        
        try {
    const { embed, row } = createSlapResponse(message.author, target);
    const reply = await message.reply({ content: `👋 <@${target.id}>, you got slapped!`, embeds: [embed], components: [row] });
            
            // Button collector
            const collector = reply.createMessageComponentCollector({ time: 300000 }); // 5 minutes
            
            collector.on('collect', async (interaction) => {
                // Only the slapped user can slap back
                if (interaction.user.id !== target.id) {
                    return interaction.reply({
                        content: '❌ Only the slapped user can slap back!',
                        flags: 64
                    });
                }
                
                const { embed: slapBackEmbed } = createSlapResponse(target, message.author, true);
                await interaction.update({ embeds: [slapBackEmbed], components: [] });
                collector.stop();
            });
            
            collector.on('end', () => {
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('slapback')
                            .setLabel('👋 Slap Back')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true)
                    );
                reply.edit({ components: [disabledRow] }).catch(() => null);
            });
            
        } catch (err) {
            console.error('Slap command error:', err.message);
            await message.reply('❌ The slap missed! Try again later.');
        }
    },
    
    execute: async (interaction) => {
        await interaction.deferReply();
        
        const target = interaction.options.getUser('user');
        
        if (target.id === interaction.user.id) {
            return interaction.editReply("🤔 You can't slap yourself... or can you?");
        }
        
        if (target.bot) {
            return interaction.editReply('🤖 Slapping bots? What did they ever do to you?');
        }
        
        try {
            const { embed, row } = createSlapResponse(interaction.user, target);
            const reply = await interaction.editReply({ embeds: [embed], components: [row] });
    await interaction.followUp({ content: `👋 <@${target.id}>, ${interaction.user.username} slapped you!`, ephemeral: false });
            
            const collector = reply.createMessageComponentCollector({ time: 300000 });
            
            collector.on('collect', async (btnInteraction) => {
                if (btnInteraction.user.id !== target.id) {
                    return btnInteraction.reply({
                        content: '❌ Only the slapped user can slap back!',
                        flags: 64
                    });
                }
                
                const { embed: slapBackEmbed } = createSlapResponse(target, interaction.user, true);
                await btnInteraction.update({ embeds: [slapBackEmbed], components: [] });
                collector.stop();
            });
            
            collector.on('end', () => {
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('slapback')
                            .setLabel('👋 Slap Back')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true)
                    );
                interaction.editReply({ components: [disabledRow] }).catch(() => null);
            });
            
        } catch (err) {
            console.error('Slash slap error:', err.message);
            await interaction.editReply('❌ The slap missed! Try again later.');
        }
    }
};

function createSlapResponse(from, to, isSlapBack = false) {
    // Track slap counts
    const key = to.id;
    const count = (slapCounts.get(key) || 0) + 1;
    slapCounts.set(key, count);
    
    // Random slap message
    const template = SLAP_MESSAGES[Math.floor(Math.random() * SLAP_MESSAGES.length)];
    const message = template.replace('{from}', `**${from.username}**`).replace('{to}', `**${to.username}**`);
    
    const title = isSlapBack 
        ? '🔄 Slap Back!' 
        : '👋 Slap!';
    
    const embed = new EmbedBuilder()
        .setColor(isSlapBack ? 0xFFA500 : 0xFF4444)
        .setTitle(title)
        .setDescription(
            `${message}\n\n` +
            `📊 **${to.username}** has been slapped **${count}** time${count > 1 ? 's' : ''}!`
        )
        .setFooter({ 
            text: isSlapBack ? 'Revenge is sweet! 🍬' : `${from.username} started it! 👀`,
            iconURL: from.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('slapback')
                .setLabel('👋 Slap Back')
                .setStyle(ButtonStyle.Danger)
        );
    
    return { embed, row: isSlapBack ? null : row };
}