// Warnings command - view warnings for a user
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getWarnings, getModLogs, clearWarnings } = require('../../utils/database');
const config = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('View or manage warnings for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check warnings for')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('clear')
                .setDescription('Clear all warnings for this user')
        ),
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    cooldown: 5,
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const shouldClear = interaction.options.getBoolean('clear') || false;

        if (shouldClear) {
            clearWarnings(interaction.guild.id, targetUser.id);

            const embed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle(`${config.emojis.success} Warnings Cleared`)
                .setDescription(`All warnings for ${targetUser.tag} have been cleared.`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // Get warning count and recent warn logs
        const warningCount = getWarnings(interaction.guild.id, targetUser.id);
        const warnLogs = getModLogs(interaction.guild.id, targetUser.id, 10)
            .filter(log => log.action === 'warn');

        const embed = new EmbedBuilder()
            .setColor(warningCount > 0 ? config.colors.warning : config.colors.success)
            .setTitle(`Warnings for ${targetUser.tag}`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: 'Total Warnings', value: `${warningCount}`, inline: true },
                { name: 'User ID', value: targetUser.id, inline: true }
            )
            .setTimestamp();

        if (warnLogs.length > 0) {
            const logText = warnLogs.map((log, i) => {
                const date = new Date(log.created_at).toLocaleDateString();
                return `**${i + 1}.** ${log.reason} - <t:${Math.floor(new Date(log.created_at).getTime() / 1000)}:R>`;
            }).join('\n');

            embed.addFields({ name: 'Recent Warnings', value: logText.slice(0, 1024) });
        } else {
            embed.addFields({ name: 'Recent Warnings', value: 'No warnings on record.' });
        }

        embed.setFooter({ text: 'Use /warnings user:@user clear:true to clear warnings' });

        await interaction.reply({ embeds: [embed] });
    },
};
