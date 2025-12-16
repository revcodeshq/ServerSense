const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuildSettings, updateGuildSetting } = require('../../utils/database');
const config = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Configure AI-powered auto-moderation')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Enable auto-moderation'))
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Disable auto-moderation'))
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('View current auto-moderation settings'))
        .addSubcommand(sub =>
            sub.setName('threshold')
                .setDescription('Set the minimum severity to trigger actions')
                .addIntegerOption(opt =>
                    opt.setName('level')
                        .setDescription('Severity threshold (1-10)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10)))
        .addSubcommand(sub =>
            sub.setName('maxaction')
                .setDescription('Set the maximum action automod can take')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Maximum action allowed')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Warn only', value: 'warn' },
                            { name: 'Delete messages', value: 'delete' },
                            { name: 'Timeout users', value: 'timeout' },
                            { name: 'Kick users', value: 'kick' },
                            { name: 'Ban users', value: 'ban' }
                        )))
        .addSubcommand(sub =>
            sub.setName('ignorechannel')
                .setDescription('Add or remove a channel from automod ignore list')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel to ignore/unignore')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(sub =>
            sub.setName('ignorerole')
                .setDescription('Add or remove a role from automod ignore list')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role to ignore/unignore')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('logchannel')
                .setDescription('Set the channel for automod logs')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Log channel (leave empty to disable)')
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(sub =>
            sub.setName('dm')
                .setDescription('Toggle DM notifications to users')
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Send DMs to users when actioned')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('modimmunity')
                .setDescription('Toggle whether moderators are immune to automod')
                .addBooleanOption(opt =>
                    opt.setName('immune')
                        .setDescription('Should mods be immune?')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const settings = getGuildSettings(interaction.guild.id);

        switch (subcommand) {
            case 'enable': {
                updateGuildSetting(interaction.guild.id, 'automod_enabled', true);
                
                const embed = new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('🛡️ AutoMod Enabled')
                    .setDescription('AI-powered auto-moderation is now active!')
                    .addFields(
                        { name: 'What it does', value: 
                            '• Scans messages for toxicity, spam, slurs, NSFW content\n' +
                            '• Uses AI to understand context and intent\n' +
                            '• Takes automatic action based on severity' },
                        { name: 'Recommended Setup', value: 
                            '`/automod logchannel` - Set a log channel\n' +
                            '`/automod threshold` - Adjust sensitivity\n' +
                            '`/automod ignorechannel` - Exclude channels' }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'disable': {
                updateGuildSetting(interaction.guild.id, 'automod_enabled', false);
                
                const embed = new EmbedBuilder()
                    .setColor(config.colors.warning)
                    .setTitle('🛡️ AutoMod Disabled')
                    .setDescription('AI-powered auto-moderation has been disabled.')
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'status': {
                // Parse ignored channels and roles
                let ignoredChannels = [];
                let ignoredRoles = [];
                try {
                    ignoredChannels = JSON.parse(settings.automod_ignored_channels || '[]');
                    ignoredRoles = JSON.parse(settings.automod_ignored_roles || '[]');
                } catch (e) {}

                const embed = new EmbedBuilder()
                    .setColor(config.colors.primary)
                    .setTitle('🛡️ AutoMod Configuration')
                    .addFields(
                        { 
                            name: 'Status', 
                            value: settings.automod_enabled ? '✅ Enabled' : '❌ Disabled', 
                            inline: true 
                        },
                        { 
                            name: 'Severity Threshold', 
                            value: `${settings.automod_threshold || 3}/10`, 
                            inline: true 
                        },
                        { 
                            name: 'Max Action', 
                            value: settings.automod_max_action || 'timeout', 
                            inline: true 
                        },
                        { 
                            name: 'Log Channel', 
                            value: settings.log_channel ? `<#${settings.log_channel}>` : 'Not set', 
                            inline: true 
                        },
                        { 
                            name: 'DM Users', 
                            value: settings.automod_dm !== false ? '✅ Yes' : '❌ No', 
                            inline: true 
                        },
                        { 
                            name: 'Mod Immunity', 
                            value: settings.automod_mods ? '❌ No' : '✅ Yes', 
                            inline: true 
                        },
                        { 
                            name: 'Ignored Channels', 
                            value: ignoredChannels.length > 0 
                                ? ignoredChannels.map(c => `<#${c}>`).join(', ')
                                : 'None', 
                            inline: false 
                        },
                        { 
                            name: 'Ignored Roles', 
                            value: ignoredRoles.length > 0 
                                ? ignoredRoles.map(r => `<@&${r}>`).join(', ')
                                : 'None', 
                            inline: false 
                        }
                    )
                    .setFooter({ text: 'AI-powered content moderation by ServerSense' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'threshold': {
                const level = interaction.options.getInteger('level');
                updateGuildSetting(interaction.guild.id, 'automod_threshold', level);

                const descriptions = {
                    1: 'Very sensitive - may flag normal conversation',
                    2: 'Sensitive - catches most mild issues',
                    3: 'Balanced - recommended for most servers',
                    4: 'Relaxed - only moderate issues',
                    5: 'Very relaxed - only clear violations',
                    6: 'Permissive - serious issues only',
                    7: 'Very permissive - obvious violations only',
                    8: 'Minimal - severe content only',
                    9: 'Almost off - extreme content only',
                    10: 'Strictest filter - maximum severity only'
                };

                const embed = new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('🎚️ Threshold Updated')
                    .setDescription(`AutoMod will now trigger on severity **${level}** and above.`)
                    .addFields({ name: 'Sensitivity', value: descriptions[level] || 'Custom' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'maxaction': {
                const action = interaction.options.getString('action');
                updateGuildSetting(interaction.guild.id, 'automod_max_action', action);

                const descriptions = {
                    warn: 'AutoMod will only warn users, no other actions',
                    delete: 'AutoMod can delete messages and warn users',
                    timeout: 'AutoMod can timeout users (recommended)',
                    kick: 'AutoMod can kick users for severe violations',
                    ban: 'AutoMod can ban users for extreme violations'
                };

                const embed = new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('⚡ Max Action Updated')
                    .setDescription(`Maximum action set to: **${action}**`)
                    .addFields({ name: 'Description', value: descriptions[action] })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'ignorechannel': {
                const channel = interaction.options.getChannel('channel');
                
                let ignoredChannels = [];
                try {
                    ignoredChannels = JSON.parse(settings.automod_ignored_channels || '[]');
                } catch (e) {}

                const index = ignoredChannels.indexOf(channel.id);
                let action;
                
                if (index > -1) {
                    ignoredChannels.splice(index, 1);
                    action = 'removed from';
                } else {
                    ignoredChannels.push(channel.id);
                    action = 'added to';
                }

                updateGuildSetting(interaction.guild.id, 'automod_ignored_channels', JSON.stringify(ignoredChannels));

                const embed = new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('📝 Ignored Channels Updated')
                    .setDescription(`${channel} has been **${action}** the ignore list.`)
                    .addFields({ 
                        name: 'Currently Ignored', 
                        value: ignoredChannels.length > 0 
                            ? ignoredChannels.map(c => `<#${c}>`).join(', ')
                            : 'None' 
                    })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'ignorerole': {
                const role = interaction.options.getRole('role');
                
                let ignoredRoles = [];
                try {
                    ignoredRoles = JSON.parse(settings.automod_ignored_roles || '[]');
                } catch (e) {}

                const index = ignoredRoles.indexOf(role.id);
                let action;
                
                if (index > -1) {
                    ignoredRoles.splice(index, 1);
                    action = 'removed from';
                } else {
                    ignoredRoles.push(role.id);
                    action = 'added to';
                }

                updateGuildSetting(interaction.guild.id, 'automod_ignored_roles', JSON.stringify(ignoredRoles));

                const embed = new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('📝 Ignored Roles Updated')
                    .setDescription(`${role} has been **${action}** the ignore list.`)
                    .addFields({ 
                        name: 'Currently Ignored', 
                        value: ignoredRoles.length > 0 
                            ? ignoredRoles.map(r => `<@&${r}>`).join(', ')
                            : 'None' 
                    })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'logchannel': {
                const channel = interaction.options.getChannel('channel');
                
                if (channel) {
                    updateGuildSetting(interaction.guild.id, 'log_channel', channel.id);
                    
                    const embed = new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setTitle('📋 Log Channel Set')
                        .setDescription(`AutoMod logs will be sent to ${channel}`)
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                } else {
                    updateGuildSetting(interaction.guild.id, 'log_channel', null);
                    
                    const embed = new EmbedBuilder()
                        .setColor(config.colors.warning)
                        .setTitle('📋 Log Channel Disabled')
                        .setDescription('AutoMod logging has been disabled.')
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                }
                break;
            }

            case 'dm': {
                const enabled = interaction.options.getBoolean('enabled');
                updateGuildSetting(interaction.guild.id, 'automod_dm', enabled);

                const embed = new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('📨 DM Notifications Updated')
                    .setDescription(enabled 
                        ? 'Users will now receive DM notifications when actioned by AutoMod.'
                        : 'Users will no longer receive DM notifications from AutoMod.')
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'modimmunity': {
                const immune = interaction.options.getBoolean('immune');
                // Note: automod_mods = true means mods ARE scanned (not immune)
                updateGuildSetting(interaction.guild.id, 'automod_mods', !immune);

                const embed = new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle('👮 Moderator Immunity Updated')
                    .setDescription(immune 
                        ? 'Moderators (with Manage Messages permission) are now **immune** to AutoMod.'
                        : 'Moderators will now be **scanned** by AutoMod like regular users.')
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }
        }
    }
};
