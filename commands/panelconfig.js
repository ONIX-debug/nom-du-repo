const { COLORS } = require('../config');
const { sendV2, container, textDisplay, separator, actionRow, button } = require('../utils/api');
const { getConfig } = require('../utils/dataManager');

module.exports = {
    name: 'panelconfig',
    description: 'Open the configuration panel',
    usage: '+panelconfig',

    async execute(client, message, args) {
        try { await message.delete(); } catch (_) {}

        const config = getConfig();

        // Format admin roles display (supports array)
        const adminRoles = config.adminRoleIds || (config.adminRoleId ? [config.adminRoleId] : []);
        const adminRolesDisplay = adminRoles.length > 0
            ? adminRoles.map(id => `<@&${id}>`).join(', ')
            : '❌ Not set';

        const logChannel = config.logChannelId ? `<#${config.logChannelId}>` : '❌ Not set';
        
        const formatRoles = (roleArray, oldRoleString) => {
            const roles = roleArray || (oldRoleString ? [oldRoleString] : []);
            return roles.length > 0 ? roles.map(id => `<@&${id}>`).join(', ') : '❌ Not set';
        };

        const acceptRoles = formatRoles(config.acceptRoleIds, config.acceptRoleId);

        const components = [
            container(COLORS.PRIMARY, [
                textDisplay('# ⚙️ Korzen Support — Configuration'),
                separator(true, 2),
                textDisplay([
                    '### Core Settings',
                    `🛡️ **Global Admins:** ${adminRolesDisplay}`,
                    `📋 **Log Channel:** ${logChannel}`,
                    `📁 **Category Mode:** Auto-Setup ✨`,
                    `🔢 **Total Tickets Created:** ${config.ticketCounter || 0}`,
                    '',
                    '### Button Permissions',
                    `- *Global Admins bypass all restrictions.*`,
                    `- *Claim & Close buttons are restricted to Global Admins.*`,
                    `✅ **Accept HWID:** ${acceptRoles}`,
                ].join('\n')),
                separator(true, 2),
                textDisplay('-# Click a button below to configure a setting'),
                actionRow([
                    button('config_set_admin', '🛡️ Global Admins', 1),
                    button('config_set_log', '📋 Log Channel', 1),
                    button('config_set_accept', '✅ Accept Perms', 2),
                ]),
                actionRow([
                    button('panelconfig_refresh', '🔄 Refresh Menu', 3),
                ]),
            ]),
        ];

        await sendV2(client, message.channel.id, components);
    },
};
