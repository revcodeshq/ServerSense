// Modlogs command - view moderation history
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getModLogs, getGuildModLogs } = require('../../utils/database');
const config = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modlogs')
        .setDescription('View moderation history')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View logs for a specific user')
        )
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of logs to show (default: 10)')
                .setMinValue(1)
                .setMaxValue(25)
        ),
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    cooldown: 10,
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const limit = interaction.options.getInteger('limit') || 10;

        let logs;
        let title;

        if (targetUser) {
            logs = getModLogs(interaction.guild.id, targetUser.id, limit);
            title = `Moderation History for ${targetUser.tag}`;
        } else {
            logs = getGuildModLogs(interaction.guild.id, limit);
            title = `Recent Moderation Actions`;
        }

        if (logs.length === 0) {
            return interaction.reply({
                content: `${config.emojis.info} No moderation logs found.`,
                ephemeral: true,
            });
        }

        const actionEmojis = {
            'ban': '🔨',
            'kick': '👢',
            'timeout': '🔇',
            'warn': '⚠️',
            'purge': '🗑️',
            'unban': '🔓',
            'untimeout': '🔊',
        };

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle(title)
            .setTimestamp();

        if (targetUser) {
            embed.setThumbnail(targetUser.displayAvatarURL());
        }

        const logEntries = logs.map((log, i) => {
            const emoji = actionEmojis[log.action] || '📋';
            const timestamp = Math.floor(new Date(log.created_at).getTime() / 1000);
            const duration = log.duration ? ` (${log.duration})` : '';
            const reason = log.reason ? log.reason.slice(0, 100) : 'No reason';

            if (targetUser) {
                return `${emoji} **${log.action.toUpperCase()}**${duration} - <t:${timestamp}:R>\n└ ${reason} | Mod: <@${log.moderator_id}>`;
            } else {
                return `${emoji} **${log.action.toUpperCase()}** <@${log.user_id}>${duration} - <t:${timestamp}:R>\n└ ${reason} | Mod: <@${log.moderator_id}>`;
            }
        }).join('\n\n');

        embed.setDescription(logEntries.slice(0, 4000));
        embed.setFooter({ text: `Showing ${logs.length} log(s)` });

        await interaction.reply({ embeds: [embed] });
    },
};
