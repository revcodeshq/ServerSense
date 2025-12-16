// Chat command - AI-powered conversation using OpenAI
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { generateText } = require('../../utils/openai');
const { getGuildSettings, addConversationMessage, getConversationHistory } = require('../../utils/database');
const config = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Ask ServerSense an AI question')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Your question or prompt')
                .setRequired(true)
                .setMaxLength(1000)
        ),
    cooldown: 5,
    async execute(interaction, client) {
        const prompt = interaction.options.getString('prompt');
        const guildId = interaction.guild?.id || 'dm';
        const channelId = interaction.channel.id;
        const userId = interaction.user.id;

        // Get guild-specific AI settings
        const settings = interaction.guild ? getGuildSettings(guildId) : {};

        // Check if AI is disabled for this guild
        if (interaction.guild && !settings.ai_enabled) {
            return interaction.reply({
                content: `${config.emojis.error} AI features are disabled in this server.`,
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        try {
            // Get conversation history for context
            const history = getConversationHistory(guildId, channelId, userId, 10);

            // Generate response with context
            const response = await generateText(prompt, {
                model: settings.ai_model || 'gpt-4o-mini',
                maxTokens: settings.ai_max_tokens || 1024,
                temperature: settings.ai_temperature || 0.7,
                systemPrompt: settings.ai_system_prompt || undefined,
                conversationHistory: history,
            });

            const trimmedResponse = (response || '').toString().trim().slice(0, 1900);

            // Save conversation to history
            addConversationMessage(guildId, channelId, userId, 'user', prompt);
            addConversationMessage(guildId, channelId, userId, 'assistant', trimmedResponse);

            const embed = new EmbedBuilder()
                .setColor(config.colors.primary)
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .addFields(
                    { name: '💬 Prompt', value: prompt.slice(0, 1024) },
                    { name: '🤖 Response', value: trimmedResponse || 'No response generated.' }
                )
                .setFooter({ text: `Powered by ${config.name} • Use /clearhistory to reset memory` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const errorMessage = error.message || 'Unknown error occurred';

            const embed = new EmbedBuilder()
                .setColor(config.colors.error)
                .setTitle(`${config.emojis.error} Error`)
                .setDescription(`Failed to generate response: ${errorMessage}`)
                .setFooter({ text: config.name })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    },
};
