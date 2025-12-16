// Timeout command - timeout a user (mute)
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addModLog, getGuildSettings } = require('../../utils/database');
const config = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout (mute) a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to timeout')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g., 10m, 1h, 1d, 1w)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the timeout')
                .setMaxLength(500)
        )
        .addBooleanOption(option =>
            option.setName('silent')
                .setDescription('Don\'t DM the user about the timeout')
        ),
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    botPermissions: [PermissionFlagsBits.ModerateMembers],
    cooldown: 5,
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const durationStr = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const silent = interaction.options.getBoolean('silent') || false;

        // Parse duration
        const duration = parseDuration(durationStr);
        if (!duration) {
            return interaction.reply({
                content: `${config.emojis.error} Invalid duration. Use format like: 10m, 1h, 1d, 1w`,
                ephemeral: true,
            });
        }

        // Max timeout is 28 days
        const maxDuration = 28 * 24 * 60 * 60 * 1000;
        if (duration > maxDuration) {
            return interaction.reply({
                content: `${config.emojis.error} Maximum timeout duration is 28 days.`,
                ephemeral: true,
            });
        }

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
                content: `${config.emojis.error} You cannot timeout someone with equal or higher role than you.`,
                ephemeral: true,
            });
        }

        // Check if bot can timeout
        if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({
                content: `${config.emojis.error} I cannot timeout this user - their role is higher than mine.`,
                ephemeral: true,
            });
        }

        // Check if user is moderatable
        if (!targetMember.moderatable) {
            return interaction.reply({
                content: `${config.emojis.error} I cannot timeout this user.`,
                ephemeral: true,
            });
        }

        // Try to DM the user before timeout
        let dmSent = false;
        if (!silent) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(config.colors.warning)
                    .setTitle(`🔇 You have been timed out in ${interaction.guild.name}`)
                    .addFields(
                        { name: 'Duration', value: durationStr },
                        { name: 'Reason', value: reason },
                        { name: 'Moderator', value: interaction.user.tag }
                    )
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
                dmSent = true;
            } catch (err) {
                logger.debug(`Could not DM ${targetUser.tag} about timeout`);
            }
        }

        // Perform the timeout
        try {
            await targetMember.timeout(duration, `${reason} | Timed out by ${interaction.user.tag}`);

            // Log to database
            addModLog({
                guildId: interaction.guild.id,
                userId: targetUser.id,
                moderatorId: interaction.user.id,
                action: 'timeout',
                reason: reason,
                duration: durationStr,
            });

            // Calculate end time
            const endTime = Math.floor((Date.now() + duration) / 1000);

            // Success embed
            const embed = new EmbedBuilder()
                .setColor(config.colors.warning)
                .setTitle(`${config.emojis.success} User Timed Out`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Duration', value: durationStr, inline: true },
                    { name: 'Expires', value: `<t:${endTime}:R>`, inline: true },
                    { name: 'Reason', value: reason },
                    { name: 'DM Sent', value: dmSent ? 'Yes' : 'No', inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Send to mod log channel if configured
            await sendModLog(interaction.guild, embed);

        } catch (error) {
            logger.error('Timeout error:', error);
            return interaction.reply({
                content: `${config.emojis.error} Failed to timeout user: ${error.message}`,
                ephemeral: true,
            });
        }
    },
};

function parseDuration(str) {
    const match = str.match(/^(\d+)(s|m|h|d|w)$/i);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000,
        'w': 7 * 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
}

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
