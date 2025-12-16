// Ping command - check bot latency
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency and API response time'),
    cooldown: 5,
    async execute(interaction, client) {
        const sent = await interaction.deferReply({ fetchReply: true });
        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        const wsLatency = client.ws.ping;

        const embed = new EmbedBuilder()
            .setColor(wsLatency < 100 ? config.colors.success : wsLatency < 200 ? config.colors.warning : config.colors.error)
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'Roundtrip Latency', value: `\`${roundtrip}ms\``, inline: true },
                { name: 'WebSocket Latency', value: `\`${wsLatency}ms\``, inline: true }
            )
            .setFooter({ text: config.name })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
