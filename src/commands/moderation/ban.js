// Ban command - ban a user from the server
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addModLog, getGuildSettings } = require('../../utils/database');
const config = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setMaxLength(500)
        )
        .addIntegerOption(option =>
            option.setName('delete_days')
                .setDescription('Number of days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
        )
        .addBooleanOption(option =>
            option.setName('silent')
                .setDescription('Don\'t DM the user about the ban')
        ),
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.BanMembers],
    botPermissions: [PermissionFlagsBits.BanMembers],
    cooldown: 5,
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const deleteDays = interaction.options.getInteger('delete_days') || 0;
        const silent = interaction.options.getBoolean('silent') || false;

        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        // Check if user is in the server
        if (targetMember) {
            // Check role hierarchy
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({
                    content: `${config.emojis.error} You cannot ban someone with equal or higher role than you.`,
                    ephemeral: true,
                });
            }

            // Check if bot can ban
            if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({
                    content: `${config.emojis.error} I cannot ban this user - their role is higher than mine.`,
                    ephemeral: true,
                });
            }

            // Check if user is bannable
            if (!targetMember.bannable) {
                return interaction.reply({
                    content: `${config.emojis.error} I cannot ban this user.`,
                    ephemeral: true,
                });
            }
        }

        // Try to DM the user before banning
        let dmSent = false;
        if (!silent && targetUser) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(config.colors.error)
                    .setTitle(`🔨 You have been banned from ${interaction.guild.name}`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Moderator', value: interaction.user.tag }
                    )
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
                dmSent = true;
            } catch (err) {
                // User has DMs disabled
                logger.debug(`Could not DM ${targetUser.tag} about ban`);
            }
        }

        // Perform the ban
        try {
            await interaction.guild.members.ban(targetUser.id, {
                reason: `${reason} | Banned by ${interaction.user.tag}`,
                deleteMessageSeconds: deleteDays * 24 * 60 * 60,
            });

            // Log to database
            addModLog({
                guildId: interaction.guild.id,
                userId: targetUser.id,
                moderatorId: interaction.user.id,
                action: 'ban',
                reason: reason,
                duration: null,
            });

            // Success embed
            const embed = new EmbedBuilder()
                .setColor(config.colors.error)
                .setTitle(`${config.emojis.success} User Banned`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason },
                    { name: 'Messages Deleted', value: `${deleteDays} day(s)`, inline: true },
                    { name: 'DM Sent', value: dmSent ? 'Yes' : 'No', inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Send to mod log channel if configured
            await sendModLog(interaction.guild, embed);

        } catch (error) {
            logger.error('Ban error:', error);
            return interaction.reply({
                content: `${config.emojis.error} Failed to ban user: ${error.message}`,
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
