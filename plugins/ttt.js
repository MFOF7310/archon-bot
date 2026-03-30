const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'ttt',
    aliases: ['tictactoe', 'morpion'],
    run: async (client, message, args) => {
        const opponent = message.mentions.users.first();
        if (!opponent || opponent.bot || opponent.id === message.author.id) {
            return message.reply("⚠️ **Invalid Target.** Mention a friend to challenge! (Ex: `.ttt @User`)");
        }

        let board = Array(9).fill(null);
        let turn = message.author.id; // X starts (Challenger)

        const createBoard = () => {
            const rows = [];
            for (let i = 0; i < 3; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 3; j++) {
                    const index = i * 3 + j;
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ttt_${index}`)
                            .setLabel(board[index] || '-')
                            .setStyle(board[index] === 'X' ? ButtonStyle.Danger : board[index] === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                            .setDisabled(!!board[index])
                    );
                }
                rows.push(row);
            }
            return rows;
        };

        const checkWinner = () => {
            const wins = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
            for (const [a, b, c] of wins) {
                if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
            }
            return board.includes(null) ? null : 'tie';
        };

        const msg = await message.channel.send({
            content: `⚔️ **TIC-TAC-TOE**\n**${message.author.username}** (X) vs **${opponent.username}** (O)\n\nCurrent Turn: <@${turn}>`,
            components: createBoard()
        });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== turn) {
                return i.reply({ content: "🚫 It's not your turn!", ephemeral: true });
            }

            const index = parseInt(i.customId.split('_')[1]);
            board[index] = turn === message.author.id ? 'X' : 'O';
            
            const result = checkWinner();
            if (result) {
                collector.stop();
                const resultText = result === 'tie' ? "🤝 **It's a Draw!**" : `🏆 **${i.user.username} WON!**`;
                return i.update({ content: resultText, components: createBoard() });
            }

            turn = turn === message.author.id ? opponent.id : message.author.id;
            await i.update({
                content: `⚔️ **TIC-TAC-TOE**\nTurn: <@${turn}>`,
                components: createBoard()
            });
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') msg.edit({ content: "⏰ **Game Timeout.** The Architect has closed the match.", components: [] });
        });
    }
};
