// Kick command - kick a user from the server
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addModLog, getGuildSettings } = require('../../utils/database');
const config = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setMaxLength(500)
        )
        .addBooleanOption(option =>
            option.setName('silent')
                .setDescription('Don\'t DM the user about the kick')
        ),
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.KickMembers],
    botPermissions: [PermissionFlagsBits.KickMembers],
    cooldown: 5,
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const silent = interaction.options.getBoolean('silent') || false;

        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return interaction.reply({
                content: `${config.emojis.error} User is not in this server.`,
                ephemeral: true,
            });
        }

        // Check role hierarchy
        if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({
                content: `${config.emojis.error} You cannot kick someone with equal or higher role than you.`,
                ephemeral: true,
            });
        }

        // Check if bot can kick
        if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({
                content: `${config.emojis.error} I cannot kick this user - their role is higher than mine.`,
                ephemeral: true,
            });
        }

        // Check if user is kickable
        if (!targetMember.kickable) {
            return interaction.reply({
                content: `${config.emojis.error} I cannot kick this user.`,
                ephemeral: true,
            });
        }

        // Try to DM the user before kicking
        let dmSent = false;
        if (!silent) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(config.colors.warning)
                    .setTitle(`👢 You have been kicked from ${interaction.guild.name}`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Moderator', value: interaction.user.tag }
                    )
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
                dmSent = true;
            } catch (err) {
                logger.debug(`Could not DM ${targetUser.tag} about kick`);
            }
        }

        // Perform the kick
        try {
            await targetMember.kick(`${reason} | Kicked by ${interaction.user.tag}`);

            // Log to database
            addModLog({
                guildId: interaction.guild.id,
                userId: targetUser.id,
                moderatorId: interaction.user.id,
                action: 'kick',
                reason: reason,
                duration: null,
            });

            // Success embed
            const embed = new EmbedBuilder()
                .setColor(config.colors.warning)
                .setTitle(`${config.emojis.success} User Kicked`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason },
                    { name: 'DM Sent', value: dmSent ? 'Yes' : 'No', inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Send to mod log channel if configured
            await sendModLog(interaction.guild, embed);

        } catch (error) {
            logger.error('Kick error:', error);
            return interaction.reply({
                content: `${config.emojis.error} Failed to kick user: ${error.message}`,
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
