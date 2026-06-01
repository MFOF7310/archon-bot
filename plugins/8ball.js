const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const RESPONSES = [
    '🎱 It is certain.',
    '🎱 It is decidedly so.',
    '🎱 Without a doubt.',
    '🎱 Yes, definitely.',
    '🎱 You may rely on it.',
    '🎱 As I see it, yes.',
    '🎱 Most likely.',
    '🎱 Outlook good.',
    '🎱 Yes.',
    '🎱 Signs point to yes.',
    '🎱 Reply hazy, try again.',
    '🎱 Ask again later.',
    '🎱 Better not tell you now.',
    '🎱 Cannot predict now.',
    '🎱 Concentrate and ask again.',
    '🎱 Don\'t count on it.',
    '🎱 My reply is no.',
    '🎱 My sources say no.',
    '🎱 Outlook not so good.',
    '🎱 Very doubtful.',
];

module.exports = {
    name: '8ball',
    aliases: ['eightball', 'ask'],
    description: '🎱 Ask the magic 8-ball a question',
    category: 'Fun',
    cooldown: 2,
    
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the magic 8-ball a question')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('What do you want to ask?')
                .setRequired(true)),
    
    run: async (client, message, args) => {
        const question = args.join(' ');
        
        if (!question) {
            return message.reply('❓ You need to ask a question! Example: `.8ball Will I win the lottery?`');
        }
        
        const response = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
        
        const embed = new EmbedBuilder()
            .setColor(0x4B0082)
            .setTitle('🎱 Magic 8-Ball')
            .addFields(
                { name: 'Question', value: question },
                { name: 'Answer', value: response }
            )
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    },
    
    execute: async (interaction) => {
        const question = interaction.options.getString('question');
        const response = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
        
        const embed = new EmbedBuilder()
            .setColor(0x4B0082)
            .setTitle('🎱 Magic 8-Ball')
            .addFields(
                { name: 'Question', value: question },
                { name: 'Answer', value: response }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};