// Unban command - unban a user from the server
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addModLog, getGuildSettings } = require('../../utils/database');
const config = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('The user ID to unban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the unban')
                .setMaxLength(500)
        ),
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.BanMembers],
    botPermissions: [PermissionFlagsBits.BanMembers],
    cooldown: 5,
    async execute(interaction, client) {
        const userId = interaction.options.getString('user_id');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        // Validate user ID format
        if (!/^\d{17,19}$/.test(userId)) {
            return interaction.reply({
                content: `${config.emojis.error} Invalid user ID format.`,
                ephemeral: true,
            });
        }

        // Check if user is banned
        let bannedUser;
        try {
            bannedUser = await interaction.guild.bans.fetch(userId);
        } catch (err) {
            return interaction.reply({
                content: `${config.emojis.error} This user is not banned.`,
                ephemeral: true,
            });
        }

        // Perform the unban
        try {
            await interaction.guild.members.unban(userId, `${reason} | Unbanned by ${interaction.user.tag}`);

            // Log to database
            addModLog({
                guildId: interaction.guild.id,
                userId: userId,
                moderatorId: interaction.user.id,
                action: 'unban',
                reason: reason,
                duration: null,
            });

            // Success embed
            const embed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle(`${config.emojis.success} User Unbanned`)
                .setThumbnail(bannedUser.user.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${bannedUser.user.tag} (${userId})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Send to mod log channel if configured
            await sendModLog(interaction.guild, embed);

        } catch (error) {
            logger.error('Unban error:', error);
            return interaction.reply({
                content: `${config.emojis.error} Failed to unban user: ${error.message}`,
                ephemeral: true,
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
