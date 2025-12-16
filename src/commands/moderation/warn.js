// Warn command - issue a warning to a user
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addWarning, getWarnings, getGuildSettings } = require('../../utils/database');
const config = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issue a warning to a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(true)
                .setMaxLength(500)
        )
        .addBooleanOption(option =>
            option.setName('silent')
                .setDescription('Don\'t DM the user about the warning')
        ),
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    cooldown: 5,
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const silent = interaction.options.getBoolean('silent') || false;

        // Cannot warn bots
        if (targetUser.bot) {
            return interaction.reply({
                content: `${config.emojis.error} You cannot warn bots.`,
                ephemeral: true,
            });
        }

        // Cannot warn yourself
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({
                content: `${config.emojis.error} You cannot warn yourself.`,
                ephemeral: true,
            });
        }

        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        // Check role hierarchy if member exists
        if (targetMember && targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({
                content: `${config.emojis.error} You cannot warn someone with equal or higher role than you.`,
                ephemeral: true,
            });
        }

        // Add warning to database
        const totalWarnings = addWarning(
            interaction.guild.id,
            targetUser.id,
            interaction.user.id,
            reason
        );

        // Try to DM the user
        let dmSent = false;
        if (!silent) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(config.colors.warning)
                    .setTitle(`⚠️ You have received a warning in ${interaction.guild.name}`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Moderator', value: interaction.user.tag },
                        { name: 'Total Warnings', value: `${totalWarnings}` }
                    )
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
                dmSent = true;
            } catch (err) {
                logger.debug(`Could not DM ${targetUser.tag} about warning`);
            }
        }

        // Success embed
        const embed = new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle(`${config.emojis.warning} User Warned`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                { name: 'Moderator', value: interaction.user.tag, inline: true },
                { name: 'Total Warnings', value: `${totalWarnings}`, inline: true },
                { name: 'Reason', value: reason },
                { name: 'DM Sent', value: dmSent ? 'Yes' : 'No', inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Send to mod log channel if configured
        await sendModLog(interaction.guild, embed);

        // Optional: Auto-action on warning thresholds
        const settings = getGuildSettings(interaction.guild.id);
        if (totalWarnings >= 5 && targetMember && targetMember.moderatable) {
            // Auto-timeout at 5 warnings (1 hour)
            try {
                await targetMember.timeout(60 * 60 * 1000, 'Auto-timeout: Reached 5 warnings');
                await interaction.followUp({
                    content: `${config.emojis.warning} ${targetUser.tag} has been automatically timed out for 1 hour (5 warnings threshold).`,
                });
            } catch (err) {
                logger.warn(`Could not auto-timeout ${targetUser.tag}: ${err.message}`);
            }
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
