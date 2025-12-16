// Purge command - bulk delete messages
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addModLog, getGuildSettings } = require('../../utils/database');
const config = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk delete messages from a channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Only delete messages from this user')
        )
        .addStringOption(option =>
            option.setName('contains')
                .setDescription('Only delete messages containing this text')
        )
        .addBooleanOption(option =>
            option.setName('bots')
                .setDescription('Only delete messages from bots')
        ),
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.ManageMessages],
    botPermissions: [PermissionFlagsBits.ManageMessages],
    cooldown: 10,
    async execute(interaction, client) {
        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');
        const contains = interaction.options.getString('contains');
        const botsOnly = interaction.options.getBoolean('bots') || false;

        await interaction.deferReply({ ephemeral: true });

        try {
            // Fetch messages
            const messages = await interaction.channel.messages.fetch({ limit: 100 });

            // Filter messages
            let toDelete = messages.filter(msg => {
                // Messages older than 14 days cannot be bulk deleted
                if (Date.now() - msg.createdTimestamp > 14 * 24 * 60 * 60 * 1000) return false;

                if (targetUser && msg.author.id !== targetUser.id) return false;
                if (contains && !msg.content.toLowerCase().includes(contains.toLowerCase())) return false;
                if (botsOnly && !msg.author.bot) return false;

                return true;
            });

            // Limit to requested amount
            toDelete = [...toDelete.values()].slice(0, amount);

            if (toDelete.length === 0) {
                return interaction.editReply({
                    content: `${config.emojis.error} No messages found matching your criteria.`,
                });
            }

            // Bulk delete
            const deleted = await interaction.channel.bulkDelete(toDelete, true);

            // Log to database
            addModLog({
                guildId: interaction.guild.id,
                userId: interaction.user.id,
                moderatorId: interaction.user.id,
                action: 'purge',
                reason: `Deleted ${deleted.size} messages in #${interaction.channel.name}`,
                duration: null,
            });

            // Build filter description
            const filters = [];
            if (targetUser) filters.push(`from ${targetUser.tag}`);
            if (contains) filters.push(`containing "${contains}"`);
            if (botsOnly) filters.push('from bots');
            const filterText = filters.length > 0 ? ` (${filters.join(', ')})` : '';

            const embed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle(`${config.emojis.success} Messages Purged`)
                .setDescription(`Successfully deleted **${deleted.size}** messages${filterText}.`)
                .addFields(
                    { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Send to mod log channel if configured
            const logEmbed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setTitle('🗑️ Messages Purged')
                .addFields(
                    { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Messages Deleted', value: `${deleted.size}`, inline: true },
                    { name: 'Filters', value: filterText || 'None' }
                )
                .setTimestamp();

            await sendModLog(interaction.guild, logEmbed);

        } catch (error) {
            logger.error('Purge error:', error);
            return interaction.editReply({
                content: `${config.emojis.error} Failed to purge messages: ${error.message}`,
            });
        }
    },
};

async function sendModLog(guild, embed) {
    const settings = getGuildSettings(guild.id);
    if (settings.mod_log_channel_id) {
        const channel = guild.channels.cache.get(settings.mod_log_channel_id);
        if (channel) {
            try {
                await channel.send({ embeds: [embed] });
            } catch (err) {
                logger.warn(`Could not send to mod log channel: ${err.message}`);
            }
        }
    }
}
