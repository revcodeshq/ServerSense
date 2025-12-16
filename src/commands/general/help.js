// Help command - list all commands
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('List all available commands')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('Get info about a specific command')
                .setRequired(false)
        ),
    cooldown: 5,
    async execute(interaction, client) {
        const commandName = interaction.options.getString('command');

        if (commandName) {
            // Show specific command info
            const command = client.commands.get(commandName.toLowerCase());
            if (!command) {
                return interaction.reply({
                    content: `${config.emojis.error} Command \`${commandName}\` not found.`,
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setColor(config.colors.primary)
                .setTitle(`Command: /${command.data.name}`)
                .setDescription(command.data.description || 'No description available.')
                .addFields(
                    { name: 'Category', value: command.category || 'General', inline: true },
                    { name: 'Cooldown', value: `${command.cooldown || config.defaultCooldown}s`, inline: true },
                    { name: 'Dev Only', value: command.devOnly ? 'Yes' : 'No', inline: true }
                )
                .setFooter({ text: config.name })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // Show all commands grouped by category
        const categories = new Map();
        client.commands.forEach(cmd => {
            const cat = cmd.category || 'general';
            if (!categories.has(cat)) categories.set(cat, []);
            categories.get(cat).push(cmd.data.name);
        });

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle(`${config.name} Commands`)
            .setDescription(`Use \`/help <command>\` for detailed info about a command.`)
            .setFooter({ text: `${client.commands.size} commands available` })
            .setTimestamp();

        categories.forEach((commands, category) => {
            embed.addFields({
                name: `📁 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
                value: commands.map(c => `\`${c}\``).join(', '),
            });
        });

        await interaction.reply({ embeds: [embed] });
    },
};
