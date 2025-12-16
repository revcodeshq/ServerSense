const { SlashCommandBuilder } = require('discord.js');
const { generateText } = require('../utils/openai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Ask ServerSense an AI question (dev only)')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Your question or prompt')
                .setRequired(true)
        ),
    async execute(interaction) {
        const prompt = interaction.options.getString('prompt');
        await interaction.deferReply();
        try {
            const reply = await generateText(prompt, { maxOutputTokens: 512 });
            // Trim and reply
            const out = (reply || '').toString().trim().slice(0, 1900);
            await interaction.editReply(out || 'No response from Gemini.');
        } catch (err) {
            console.error('Gemini chat error:', err);
            const msg = (err && err.message) ? err.message : 'Unknown error';
            await interaction.editReply(`Error calling Gemini: ${msg}`);
        }
    },
};
