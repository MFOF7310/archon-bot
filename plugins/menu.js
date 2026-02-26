const { 

  getUptime, 

  getRam, 

  getDate, 

  getPlatform, 

  bot, 

  lang 

} = require('../lib/');

const { 

  EmbedBuilder, 

  ActionRowBuilder, 

  StringSelectMenuBuilder, 

  ButtonBuilder, 

  ButtonStyle, 

  ComponentType 

} = require('discord.js');

const PREFIX = ',';

bot(

  {

    pattern: 'menu ?(.*)',

    dontAddCommandList: true,

  },

  async (message, match, ctx) => {

    const categories = {};

    ctx.commands.forEach((cmd) => {

      if (!cmd.dontAddCommandList && cmd.pattern !== undefined) {

        let type = (cmd.type || 'General').toLowerCase();

        if (!categories[type]) categories[type] = [];

        categories[type].push(`\`${cmd.name}\``);

      }

    });

    const sortedCats = Object.keys(categories).sort();

    const [date, time] = getDate();

    // Search Logic if match exists

    if (match) {

      const term = match.toLowerCase().trim();

      const command = ctx.commands.find(c => c.name.toLowerCase() === term);

      if (command) {

        const searchEmbed = new EmbedBuilder()

          .setColor('#FFD700')

          .setTitle(`🔍 Command: ${command.name.toUpperCase()}`)

          .addFields(

            { name: 'Description', value: command.desc || 'No description available.', inline: false },

            { name: 'Category', value: command.type || 'General', inline: true },

            { name: 'Usage', value: `\`${PREFIX}${command.name}\``, inline: true }

          )

          .setFooter({ text: 'Search Result' });

        return await message.send({ embeds: [searchEmbed] });

      }

    }

    const createMainEmbed = () => {

      return new EmbedBuilder()

        .setColor('#5865F2')

        .setTitle('🚀 Command Menu')

        .setThumbnail(message.client.user.displayAvatarURL())

        .setDescription(

          `Hello **${message.pushName}**!\n\n` +

          `⌚ **Time:** ${time}\n` +

          `📅 **Date:** ${date.toLocaleDateString()}\n` +

          `🚀 **Uptime:** ${getUptime('t')}\n` +

          `📊 **RAM:** ${getRam()}\n\n` +

          `*Current Prefix:* \`${PREFIX}\`\n` +

          `*Search Tip:* Type \`${PREFIX}menu name\` to find a specific command.`

        )

        .setFooter({ text: `Version: ${ctx.VERSION} | Total: ${ctx.pluginsCount} plugins` });

    };

    const createComponents = (disabled = false) => {

      if (sortedCats.length === 0) return [];

      const selectMenu = new StringSelectMenuBuilder()

        .setCustomId('select_category')

        .setPlaceholder('Choose a category...')

        .setDisabled(disabled)

        .addOptions(

          sortedCats.map(cat => ({

            label: cat.toUpperCase(),

            value: cat,

            description: `View ${cat} commands`,

            emoji: '📂'

          }))

        );

      const btnHome = new ButtonBuilder()

        .setCustomId('go_home')

        .setLabel('Home')

        .setEmoji('🏠')

        .setStyle(ButtonStyle.Danger)

        .setDisabled(disabled);

      return [

        new ActionRowBuilder().addComponents(selectMenu),

        new ActionRowBuilder().addComponents(btnHome)

      ];

    };

    const response = await message.send({

      embeds: [createMainEmbed()],

      components: createComponents(),

    });

    const collector = response.createMessageComponentCollector({

      componentType: ComponentType.Any,

      time: 60000,

    });

    collector.on('collect', async (interaction) => {

      if (interaction.user.id !== message.author.id) {

        return interaction.reply({ content: "This menu is not for you. ❌", ephemeral: true });

      }

      if (interaction.customId === 'go_home') {

        return await interaction.update({ 

          embeds: [createMainEmbed()], 

          components: createComponents() 

        });

      }

      if (interaction.customId === 'select_category') {

        const selected = interaction.values[0];

        const catEmbed = new EmbedBuilder()

          .setColor('#2ecc71')

          .setTitle(`📂 Category: ${selected.toUpperCase()}`)

          .setDescription(`Available commands:\n\n${categories[selected].sort().join(', ')}`)

          .setFooter({ text: `Type ${PREFIX}help [command] for more info` });

        await interaction.update({ 

          embeds: [catEmbed], 

          components: createComponents() 

        });

      }

    });

    collector.on('end', () => {

      response.edit({ components: createComponents(true) }).catch(() => null);

    });

  }

);

bot(

  {

    pattern: 'list ?(.*)',

    dontAddCommandList: true,

  },

  async (message, match, ctx) => {

    const sorted = ctx.commands

      .slice()

      .sort((a, b) => (a.name && b.name ? a.name.localeCompare(b.name) : 0));

    const embed = new EmbedBuilder()

      .setColor('#5865F2')

      .setTitle('📖 Command List');

    let description = "";

    sorted

      .filter((command) => !command.dontAddCommandList && command.pattern !== undefined)

      .forEach((command) => {

        description += `**${PREFIX}${command.name}**\n*${command.desc || 'No description'}*\n\n`;

      });

    embed.setDescription(description || "No commands found.");

    await message.send({ embeds: [embed] });

  }

);

bot(

  {

    pattern: 'help ?(.*)',

    dontAddCommandList: true,

  },

  async (message, match, ctx) => {

    const sorted = ctx.commands

      .slice()

      .sort((a, b) => (a.name && b.name ? a.name.localeCompare(b.name) : 0));

    const [date, time] = getDate();

    

    let commandText = '```\n╭────────────────\n';

    sorted.forEach((command, i) => {

      if (!command.dontAddCommandList && command.pattern !== undefined) {

        commandText += `│ ${i + 1} ${command.name.toUpperCase()}\n`;

      }

    });

    commandText += '╰────────────────\n```';

    const embed = new EmbedBuilder()

      .setColor('#0099ff')

      .setTitle('📜 Help Menu')

      .setDescription(`Prefix: \`${PREFIX}\`\n${commandText}`)

      .setFooter({ text: `Total Plugins: ${ctx.pluginsCount}` });

    return await message.send({ embeds: [embed] });

  }

);

