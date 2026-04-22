const { getConfig } = require('./dataManager');
const { ADMIN_ROLE_ID } = require('../config');

/**
 * Check if a member has admin permissions (has any of the admin roles)
 */
function hasAdminRole(member) {
    const config = getConfig();

    // Support both old (adminRoleId string) and new (adminRoleIds array) format
    let roleIds = [];

    if (config.adminRoleIds && Array.isArray(config.adminRoleIds)) {
        roleIds = config.adminRoleIds;
    } else if (config.adminRoleId) {
        roleIds = [config.adminRoleId];
    }

    // Always include the hardcoded ADMIN_ROLE_ID from config.js if it exists
    if (ADMIN_ROLE_ID && !roleIds.includes(ADMIN_ROLE_ID)) {
        roleIds.push(ADMIN_ROLE_ID);
    }

    return roleIds.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Send a permission denied message using Components V2
 */
async function sendNoPermission(client, channelId) {
    const { COLORS } = require('../config');
    try {
        await client.rest.post(`/channels/${channelId}/messages`, {
            body: {
                flags: 1 << 15,
                components: [
                    {
                        type: 17,
                        accent_color: COLORS.ERROR,
                        components: [
                            {
                                type: 10,
                                content: '❌ **Access Denied**\n> You do not have permission to use this command.',
                            },
                        ],
                    },
                ],
            },
        });
    } catch (e) {
        console.error('[Permissions] Error sending no permission message:', e.message);
    }
}

module.exports = { hasAdminRole, sendNoPermission };
