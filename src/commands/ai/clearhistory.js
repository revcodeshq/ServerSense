// Clear AI memory command
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { clearConversationHistory } = require('../../utils/database');
const config = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearhistory')
        .setDescription('Clear your AI conversation history in this channel'),
    cooldown: 10,
    async execute(interaction, client) {
        const guildId = interaction.guild?.id || 'dm';
        const channelId = interaction.channel.id;
        const userId = interaction.user.id;

        clearConversationHistory(guildId, channelId, userId);

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle(`${config.emojis.success} History Cleared`)
            .setDescription('Your AI conversation history in this channel has been cleared.')
            .setFooter({ text: 'ServerSense will no longer remember previous messages.' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
