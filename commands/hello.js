// Example command: hello.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hello')
        .setDescription('Say hello'),
    async execute(interaction) {
        await interaction.reply('Hello! I am ServerSense, your AI-powered assistant.');
    },
};
