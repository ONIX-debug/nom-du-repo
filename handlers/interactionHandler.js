const { COLORS, API } = require('../config');
const { getConfig, updateConfig, getTicketByChannel, updateTicket, deleteTicket } = require('../utils/dataManager');
const { sendV2, editV2, container, textDisplay, separator, actionRow, button, sendSuccess, sendError } = require('../utils/api');
const { startDMSession, confirmTicket, cancelTicket } = require('./dmCollector');
const { generateTranscript } = require('../utils/transcript');
const { hasAdminRole } = require('../utils/permissions');
const { AttachmentBuilder } = require('discord.js');

/**
 * Handle all interaction events (buttons, selects, modals)
 */
const replyV2Error = async (client, interaction, msg) => {
    try { await interaction.deferUpdate(); } catch(_) {}
    try {
        const res = await sendError(client, interaction.channel.id, msg);
        if (res && res.id) {
            setTimeout(() => {
                client.rest.delete(`/channels/${interaction.channel.id}/messages/${res.id}`).catch(()=>null);
            }, 5000);
        }
    } catch(e) {}
};

async function handleInteraction(client, interaction) {
    try {
        // String Select interactions
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_category_select') {
                return await handleCategorySelect(client, interaction);
            }
            if (interaction.customId === 'panelconfig_select') {
                return await handlePanelConfigSelect(client, interaction);
            }
            
            // Reworked Config Role Selects (now String Selects)
            if (interaction.customId === 'config_admin_role') {
                return await handleConfigRoleSelect(client, interaction, 'adminRoleIds');
            }
            if (interaction.customId.startsWith('config_role_')) {
                const map = {
                    config_role_accept: 'acceptRoleIds',
                };
                if (map[interaction.customId]) {
                    return await handleConfigRoleSelect(client, interaction, map[interaction.customId]);
                }
            }
        }

        // Button interactions
        if (interaction.isButton()) {
            switch (interaction.customId) {
                case 'ticket_confirm_send':
                    return await confirmTicket(client, interaction);
                case 'ticket_confirm_cancel':
                    return await cancelTicket(client, interaction);
                case 'ticket_claim':
                    return await handleClaim(client, interaction);
                case 'ticket_unclaim':
                    return await handleUnclaim(client, interaction);
                case 'ticket_close':
                    return await handleCloseButton(client, interaction);
                case 'ticket_close_confirm':
                    return await handleCloseConfirm(client, interaction);
                case 'ticket_close_cancel':
                    return await handleCloseCancel(client, interaction);
                case 'ticket_accept':
                    return await handleAccept(client, interaction);
                // Panelconfig buttons
                case 'config_set_admin':
                case 'config_set_log':
                case 'config_set_accept':
                    return await handleConfigModal(client, interaction);
                case 'panelconfig_refresh':
                    return await handlePanelRefresh(client, interaction);
            }
        }

        // Modal submissions
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('config_modal_')) {
                return await handleConfigModalSubmit(client, interaction);
            }
        }

        // Channel Select
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'config_category_channel') {
                return await handleConfigChannelSelect(client, interaction, 'ticketCategoryId');
            }
            if (interaction.customId === 'config_log_channel') {
                return await handleConfigChannelSelect(client, interaction, 'logChannelId');
            }
        }

        // Old Role Select removed (moved to String Select)
    } catch (e) {
        console.error('[Interaction] Error:', e);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
            }
        } catch (_) {}
    }
}

// ───── Category Select (from panel) ─────

async function handleCategorySelect(client, interaction) {
    const categoryId = interaction.values[0];
    await interaction.deferUpdate();

    const guild = interaction.guild;
    const user = interaction.user;

    await startDMSession(client, user, categoryId, guild);
}

// ───── Claim / Unclaim ─────

async function handleClaim(client, interaction) {
    const ticket = getTicketByChannel(interaction.channel.id);
    if (!ticket) return replyV2Error(client, interaction, 'This is not a ticket channel.');

    const isGlobalAdmin = hasAdminRole(interaction.member);

    if (!isGlobalAdmin) {
        return replyV2Error(client, interaction, 'You do not have permission to claim tickets.');
    }

    if (ticket.claimedBy) {
        return replyV2Error(client, interaction, `Already claimed by <@${ticket.claimedBy}>.`);
    }

    updateTicket(ticket.id, { claimedBy: interaction.user.id });
    await interaction.deferUpdate();

    // Update the original message buttons
    await rebuildTicketButtons(client, interaction, ticket.id, interaction.user.id);

    await sendV2(client, interaction.channel.id, [
        container(COLORS.INFO, [
            textDisplay(`🎫 **Ticket Claimed**\n> <@${interaction.user.id}> has claimed this ticket.`),
        ]),
    ]);
}

async function handleUnclaim(client, interaction) {
    const ticket = getTicketByChannel(interaction.channel.id);
    if (!ticket) return replyV2Error(client, interaction, 'This is not a ticket channel.');

    const isGlobalAdmin = hasAdminRole(interaction.member);

    if (ticket.claimedBy !== interaction.user.id && !isGlobalAdmin) {
        return replyV2Error(client, interaction, 'Only the claimer or a global admin can unclaim.');
    }

    updateTicket(ticket.id, { claimedBy: null });
    await interaction.deferUpdate();

    await rebuildTicketButtons(client, interaction, ticket.id, null);

    await sendV2(client, interaction.channel.id, [
        container(COLORS.WARNING, [
            textDisplay(`🎫 **Ticket Unclaimed**\n> <@${interaction.user.id}> has unclaimed this ticket.`),
        ]),
    ]);
}

async function rebuildTicketButtons(client, interaction, ticketId, claimedBy) {
    const ticket = getTicketByChannel(interaction.channel.id);
    const buttons1 = [];

    if (claimedBy) {
        buttons1.push(button('ticket_unclaim', '🔓 Unclaim Ticket', 2));
    } else {
        buttons1.push(button('ticket_claim', '🎫 Claim Ticket', 1));
    }

    buttons1.push(button('ticket_close', '🔒 Close Ticket', 4));

    if (ticket && ticket.category === 'hwid_reset') {
        buttons1.push(button('ticket_accept', '✅ Accept', 3));
    }

    try {
        // Keep all existing components EXCEPT action rows (type 1), then add the new button row
        const existingComponents = interaction.message.components || [];
        const preserved = [];

        for (const comp of existingComponents) {
            const raw = comp.toJSON ? comp.toJSON() : comp;
            // Keep everything that is NOT an action row (type 1)
            if (raw.type !== 1) {
                preserved.push(raw);
            }
        }

        // Add the new action row at the end
        preserved.push({ type: 1, components: buttons1 });

        await interaction.message.edit({ components: preserved });
    } catch (e) {
        console.error('[Interaction] Failed to edit buttons:', e.message);
    }
}

// ───── Close ─────

async function handleCloseButton(client, interaction) {
    const isGlobalAdmin = hasAdminRole(interaction.member);

    // Only authorized users can close tickets
    if (!isGlobalAdmin) {
        return replyV2Error(client, interaction, 'Only global admins can close tickets.');
    }

    await interaction.deferUpdate();
    await sendV2(client, interaction.channel.id, [
        container(COLORS.WARNING, [
            textDisplay('⚠️ **Close Ticket**\n> Are you sure you want to close this ticket? This action cannot be undone.'),
        ]),
        actionRow([
            button('ticket_close_confirm', '✅ Confirm Close', 4),
            button('ticket_close_cancel', '❌ Cancel', 2),
        ]),
    ]);
}

async function handleCloseCancel(client, interaction) {
    await interaction.deferUpdate();
    try {
        await interaction.message.delete();
    } catch (_) {}
}

async function handleCloseConfirm(client, interaction) {
    const isGlobalAdmin = hasAdminRole(interaction.member);

    // Only authorized users can close tickets
    if (!isGlobalAdmin) {
        return replyV2Error(client, interaction, 'Only global admins can close tickets.');
    }

    await interaction.deferUpdate();
    await closeTicketChannel(client, interaction.channel, interaction.user);
}

/**
 * Close a ticket channel: generate transcript, DM user, log, delete channel
 */
async function closeTicketChannel(client, channel, closedBy) {
    const ticket = getTicketByChannel(channel.id);
    if (!ticket) return;

    // Notify in channel
    await sendV2(client, channel.id, [
        container(COLORS.ERROR, [
            textDisplay(`🔒 **Ticket Closing**\n> Ticket closed by <@${closedBy.id}>. Generating transcript...`),
        ]),
    ]);

    // Fetch messages for transcript
    const messages = [];
    let lastId = null;
    let fetching = true;

    while (fetching) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetched = await channel.messages.fetch(options);
        if (fetched.size === 0) {
            fetching = false;
            break;
        }

        for (const msg of fetched.values()) {
            messages.push({
                authorId: msg.author.id,
                authorName: msg.author.tag,
                authorAvatar: msg.author.displayAvatarURL({ size: 64 }),
                isBot: msg.author.bot,
                content: msg.content || '',
                timestamp: msg.createdAt.toISOString(),
                embeds: msg.embeds.map(e => ({
                    title: e.title,
                    description: e.description,
                    color: e.hexColor || '#FF1493',
                })),
                attachments: msg.attachments.map(a => ({
                    url: a.url,
                    filename: a.name,
                    contentType: a.contentType,
                })),
            });
        }

        lastId = fetched.last().id;
        if (fetched.size < 100) fetching = false;
    }

    messages.reverse();

    // Generate HTML transcript
    const html = generateTranscript(ticket, messages);
    const buffer = Buffer.from(html, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, {
        name: `transcript-${ticket.id}.html`,
    });

    // DM transcript to ticket creator
    try {
        const user = await client.users.fetch(ticket.userId);
        const dm = await user.createDM();

        await sendV2(client, dm.id, [
            container(COLORS.ERROR, [
                textDisplay(`## 🔒 Ticket Closed\n\nYour ticket **#${ticket.id}** has been closed by <@${closedBy.id}>.\n\n> The transcript is attached below.`),
            ]),
        ]);

        await dm.send({ files: [attachment] });
    } catch (e) {
        console.error('[Close] Failed to DM transcript:', e.message);
    }

    // Log channel
    const config = getConfig();
    if (config.logChannelId) {
        try {
            const logChannel = await client.channels.fetch(config.logChannelId);
            if (logChannel) {
                const logAttachment = new AttachmentBuilder(Buffer.from(html, 'utf-8'), {
                    name: `transcript-${ticket.id}.html`,
                });

                await sendV2(client, logChannel.id, [
                    container(COLORS.DARK, [
                        textDisplay(`## 📄 Ticket Closed — #${ticket.id}\n**User:** <@${ticket.userId}> (${ticket.userName})\n**Category:** ${ticket.category}\n**Closed by:** <@${closedBy.id}>\n**Date:** ${new Date().toLocaleDateString('en-GB')}`),
                    ]),
                ]);

                await logChannel.send({ files: [logAttachment] });
            }
        } catch (e) {
            console.error('[Close] Failed to log transcript:', e.message);
        }
    }

    // Update ticket status
    updateTicket(ticket.id, { status: 'closed', closedAt: new Date().toISOString(), closedBy: closedBy.id });

    // Delete channel after delay
    setTimeout(async () => {
        try {
            await channel.delete('Ticket closed');
        } catch (e) {
            console.error('[Close] Failed to delete channel:', e.message);
        }
    }, 5000);
}

// ───── Accept (HWID Reset) ─────

async function handleAccept(client, interaction) {
    const ticket = getTicketByChannel(interaction.channel.id);
    if (!ticket) return replyV2Error(client, interaction, 'Not a ticket channel.');

    const config = getConfig();

    // Check permissions: ONLY HWID Accept Admin or Global Admin
    const acceptAdmins = config.acceptRoleIds || (config.acceptRoleId ? [config.acceptRoleId] : []);
    const isAcceptAdmin = acceptAdmins.some(roleId => interaction.member.roles.cache.has(roleId));
    const isGlobalAdmin = hasAdminRole(interaction.member);

    if (!isAcceptAdmin && !isGlobalAdmin) {
        return replyV2Error(client, interaction, 'You must have the specific Accept HWID role to process this request.');
    }

    // Call Korzen API to reset HWID
    const licenseKey = ticket.answers?.license_key;
    const productName = ticket.answers?.product || 'KorzenGen'; // Default if not found
    
    // Normalize product name for URL (Remove spaces, handle capitalization if needed)
    const normalizedProduct = productName.trim().replace(/\s+/g, '');
    
    if (!licenseKey) {
        return replyV2Error(client, interaction, 'No license key found in ticket data. Cannot reset HWID automatically.');
    }

    const apiUrl = `${API.BASE_URL}/${normalizedProduct}/reset_hwid`;
    console.log(`[API] DEBUG - Attempting HWID reset for ${normalizedProduct}...`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-App-Secret': API.SECRET,
            },
            body: JSON.stringify({ key: licenseKey }),
        });

        console.log(`[API] DEBUG - Status: ${response.status} ${response.statusText}`);
        const rawResponse = await response.text();
        console.log(`[API] DEBUG - Response Body: ${rawResponse}`);

        let result;
        try {
            result = JSON.parse(rawResponse);
        } catch (e) {
            result = { message: rawResponse };
        }

        if (!response.ok || result.success === false) {
            console.error('[API] Reset HWID failed:', result);
            return replyV2Error(client, interaction, `API Error: ${result?.message || result?.error || 'Failed to reset HWID via API.'}`);
        }

        console.log('[API] HWID reset successful:', result);
    } catch (apiErr) {
        console.error('[API] Connection error:', apiErr);
        return replyV2Error(client, interaction, `Could not connect to the Korzen API: ${apiErr.message}`);
    }

    updateTicket(ticket.id, { status: 'accepted' });
    try { await interaction.deferUpdate(); } catch (_) {}

    await sendV2(client, interaction.channel.id, [
        container(COLORS.SUCCESS, [
            textDisplay(`## ✅ HWID Reset Processed\n\n> The HWID reset request for <@${ticket.userId}> has been **approved and processed** by <@${interaction.user.id}>.\n\n**Action Complete** — Please close the ticket when finished.`),
        ]),
    ]);

    // DM the user
    try {
        const user = await client.users.fetch(ticket.userId);
        const dm = await user.createDM();
        await sendV2(client, dm.id, [
            container(COLORS.SUCCESS, [
                textDisplay(`## ✅ HWID Reset Successful\n\n> Hello <@${user.id}>,\n\nYour hardware ID reset request has been **approved** by our team.\n\nYour HWID has been successfully reset. You can now re-activate and use your product on your new system.`),
            ]),
        ]);
    } catch (e) {
        console.error('[Accept] Failed to DM user:', e.message);
    }
}

// ───── Panelconfig interactions ─────

async function handleConfigModal(client, interaction) {
    const configMap = {
        config_set_log: { key: 'logChannelId', title: 'Set Log Channel', type: 'channel' },
        config_set_admin: { key: 'adminRoleIds', title: 'Set Global Admins', type: 'role_multi', id: 'config_admin_role' },
        config_set_accept: { key: 'acceptRoleIds', title: 'Set Accept Perms', type: 'role_multi', id: 'config_role_accept' },
    };

    const cfg = configMap[interaction.customId];
    if (!cfg) return;

    if (cfg.type === 'channel') {
        // Send a follow-up with channel select
        await interaction.reply({
            content: `Select a channel for **${cfg.title}**:`,
            components: [
                {
                    type: 1,
                    components: [{
                        type: 8, // Channel Select
                        custom_id: 'config_log_channel',
                        placeholder: 'Select a channel',
                        channel_types: [0], // 0=text
                    }],
                },
            ],
            ephemeral: true,
        });
    } else if (cfg.type === 'role_multi') {
        const roles = interaction.guild.roles.cache
            .filter(r => r.id !== interaction.guild.id && !r.managed)
            .sort((a, b) => b.position - a.position)
            .first(25);

        if (roles.length === 0) {
            return interaction.reply({ content: '❌ No valid roles found on this server.', flags: 64 });
        }

        const options = roles.map(r => ({
            label: r.name.substring(0, 100),
            value: r.id,
            description: `Role ID: ${r.id}`
        }));

        await interaction.reply({
            content: `Select roles for **${cfg.title}** (you can select multiple):`,
            components: [
                {
                    type: 1,
                    components: [{
                        type: 3, // String Select
                        custom_id: cfg.id,
                        placeholder: `Select ${cfg.title}`,
                        min_values: 1,
                        max_values: Math.min(roles.length, 10),
                        options: options
                    }],
                },
            ],
            flags: 64,
        });
    }
}

async function handleConfigChannelSelect(client, interaction, configKey) {
    const channelId = interaction.values[0];
    updateConfig(configKey, channelId);
    await interaction.update({
        content: `✅ Updated **${configKey}** to <#${channelId}>`,
        components: [],
    });
}

async function handleConfigRoleSelect(client, interaction, configKey) {
    if (interaction.values) {
        const roleIds = interaction.values;
        updateConfig(configKey, roleIds);
        const display = roleIds.map(id => `<@&${id}>`).join(', ');
        await interaction.update({
            content: `✅ Updated successfully to: ${display}`,
            components: [],
        });
    }
}

async function handlePanelRefresh(client, interaction) {
    const config = getConfig();
    const { container, textDisplay, separator, actionRow, button } = require('../utils/api');
    const { COLORS } = require('../config');

    const formatRoles = (roleArray, oldRoleString) => {
        const roles = roleArray || (oldRoleString ? [oldRoleString] : []);
        return roles.length > 0 ? roles.map(id => `<@&${id}>`).join(', ') : '❌ Not set';
    };

    const adminDisplay = formatRoles(config.adminRoleIds, config.adminRoleId);
    const acceptRoles = formatRoles(config.acceptRoleIds, config.acceptRoleId);
    const logChannel = config.logChannelId ? `<#${config.logChannelId}>` : '❌ Not set';

    const components = [
        container(COLORS.PRIMARY, [
            textDisplay('# ⚙️ Korzen Support — Configuration'),
            separator(true, 2),
            textDisplay([
                '### Core Settings',
                `🛡️ **Global Admins:** ${adminDisplay}`,
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

    await interaction.update({ components });
}

module.exports = {
    handleInteraction,
    closeTicketChannel,
};
