const { QUESTIONS, COLORS, PANEL_TEMPLATES } = require('../config');
const { getConfig, getNextTicketId, createTicket } = require('../utils/dataManager');
const { sendV2, container, textDisplay, separator, actionRow, button, mediaGallery } = require('../utils/api');
const { PermissionFlagsBits, ChannelType } = require('discord.js');

// Active DM sessions: Map<userId, sessionData>
const activeSessions = new Map();

/**
 * Start a DM questionnaire for a user
 */
async function startDMSession(client, user, categoryId, guild) {
    if (activeSessions.has(user.id)) {
        try {
            const dm = await user.createDM();
            await sendV2(client, dm.id, [
                container(COLORS.WARNING, [
                    textDisplay('⚠️ **Session Active**\n> You already have an active ticket session. Please complete or cancel it first.'),
                ]),
            ]);
        } catch (e) {
            console.error('[DM] Cannot send DM to user:', e.message);
        }
        return;
    }

    const questions = QUESTIONS[categoryId];
    if (!questions) return;

    // Find category info from templates
    let categoryInfo = null;
    for (const tpl of Object.values(PANEL_TEMPLATES)) {
        const found = tpl.categories.find(c => c.id === categoryId);
        if (found) { categoryInfo = found; break; }
    }

    const session = {
        userId: user.id,
        guildId: guild.id,
        categoryId,
        categoryInfo,
        questions,
        currentQuestion: 0,
        answers: {},
        imageUrls: {},
    };

    activeSessions.set(user.id, session);

    try {
        const dm = await user.createDM();

        // Send header message
        await sendV2(client, dm.id, [
            container(COLORS.PRIMARY, [
                textDisplay(`**${categoryInfo?.headerTitle || 'Ticket Request'}**\n> ${categoryInfo?.headerWarning || 'Please answer the following questions.'}`),
                separator(true, 2),
                textDisplay('Please answer the following questions.'),
            ]),
        ]);

        // Send first question
        await sendQuestion(client, dm.id, session);
    } catch (e) {
        console.error('[DM] Failed to start DM session:', e.message);
        activeSessions.delete(user.id);
    }
}

/**
 * Send the current question to the user
 */
async function sendQuestion(client, channelId, session) {
    const q = session.questions[session.currentQuestion];
    const total = session.questions.length;
    const current = session.currentQuestion + 1;

    const components = [
        container(COLORS.PRIMARY, [
            textDisplay(`**Question ${current} of ${total}**\n${q.question}`),
        ]),
    ];

    // If there's a copyable command, add it
    if (q.copyCommand) {
        components.push(
            container(COLORS.DARK, [
                textDisplay(`📋 **Command to copy:**\n\`\`\`\n${q.copyCommand}\n\`\`\``),
            ])
        );
    }

    // Footer hint
    if (q.type === 'image') {
        components.push(
            container(COLORS.INFO, [
                textDisplay('-# 📎 Send an image/screenshot to answer this question'),
            ])
        );
    } else if (q.type === 'image_optional') {
        components.push(
            container(COLORS.INFO, [
                textDisplay('-# 📎 Send an image or type **skip** to skip'),
            ])
        );
    } else if (q.type === 'text_or_image') {
        components.push(
            container(COLORS.INFO, [
                textDisplay('-# 💬 Type your answer or send an image'),
            ])
        );
    } else {
        components.push(
            container(COLORS.INFO, [
                textDisplay('-# 💬 Type your answer below'),
            ])
        );
    }

    await sendV2(client, channelId, components);
}

/**
 * Handle a DM message from a user with an active session
 */
async function handleDMMessage(client, message) {
    const session = activeSessions.get(message.author.id);
    if (!session) return false;

    // If all questions answered, user is on confirmation screen — ignore messages
    if (session.currentQuestion >= session.questions.length) {
        await sendV2(client, message.channel.id, [
            container(COLORS.WARNING, [
                textDisplay('⚠️ **Please use the buttons above** to confirm or cancel your ticket.'),
            ]),
        ]);
        return true;
    }

    const q = session.questions[session.currentQuestion];
    const dmChannelId = message.channel.id;

    // Validate answer based on type
    if (q.type === 'image') {
        if (message.attachments.size === 0) {
            await sendV2(client, dmChannelId, [
                container(COLORS.ERROR, [
                    textDisplay('❌ **Please send an image/screenshot for this question.**'),
                ]),
            ]);
            return true;
        }
        const attachment = message.attachments.first();
        session.answers[q.key] = attachment.url;
        session.imageUrls[q.key] = attachment.url;
    } else if (q.type === 'image_optional') {
        if (message.content.toLowerCase() === 'skip') {
            session.answers[q.key] = 'Skipped';
        } else if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            session.answers[q.key] = attachment.url;
            session.imageUrls[q.key] = attachment.url;
        } else {
            session.answers[q.key] = message.content;
        }
    } else if (q.type === 'text_or_image') {
        if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            session.answers[q.key] = attachment.url;
            session.imageUrls[q.key] = attachment.url;
        } else {
            session.answers[q.key] = message.content;
        }
    } else {
        // text
        session.answers[q.key] = message.content;
    }

    session.currentQuestion++;

    // Check if all questions answered
    if (session.currentQuestion >= session.questions.length) {
        await sendConfirmation(client, dmChannelId, session);
    } else {
        await sendQuestion(client, dmChannelId, session);
    }

    return true;
}

/**
 * Send confirmation message with all answers
 */
async function sendConfirmation(client, channelId, session) {
    const components = [];

    // Build summary
    let summaryText = '## 📋 Ticket Summary\n\n';
    const imageItems = [];

    for (const q of session.questions) {
        const answer = session.answers[q.key] || 'N/A';
        const label = q.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        if (session.imageUrls[q.key]) {
            summaryText += `**${label}:** 🖼️ *Image attached below*\n`;
            imageItems.push({ url: session.imageUrls[q.key], description: label });
        } else {
            summaryText += `**${label}:** ${answer}\n`;
        }
    }

    const containerChildren = [
        textDisplay(summaryText),
    ];

    // Add images as media gallery
    if (imageItems.length > 0) {
        containerChildren.push(separator(true, 1));
        containerChildren.push(mediaGallery(imageItems));
    }

    components.push(container(COLORS.PRIMARY, containerChildren));

    // Send/Cancel buttons
    components.push(
        actionRow([
            button('ticket_confirm_send', '✅ Send', 3),
            button('ticket_confirm_cancel', '❌ Cancel', 4),
        ])
    );

    await sendV2(client, channelId, components);
}

/**
 * Handle ticket confirmation (Send button)
 */
async function confirmTicket(client, interaction) {
    const session = activeSessions.get(interaction.user.id);
    if (!session) {
        try { await interaction.reply({ content: 'No active session found.', flags: 64 }); } catch (_) {}
        return;
    }

    try { await interaction.deferUpdate(); } catch (_) {}

    const guild = client.guilds.cache.get(session.guildId);
    if (!guild) {
        activeSessions.delete(interaction.user.id);
        return;
    }

    const config = getConfig();
    const ticketId = getNextTicketId();
    const categoryLabels = {
        hwid_reset: 'hwid',
        discord_change: 'discord',
        blacklist_appeal: 'appeal',
        general_support: 'support',
    };
    const channelPrefix = categoryLabels[session.categoryId] || 'ticket';
    const channelName = `${channelPrefix}-${ticketId}`;

    try {
        // Create ticket channel
        const permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: interaction.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
            {
                id: client.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages,
                ],
            },
        ];

        // Add admin roles (supports multiple)
        const adminRoles = config.adminRoleIds || (config.adminRoleId ? [config.adminRoleId] : []);
        for (const roleId of adminRoles) {
            if (roleId) {
                permissionOverwrites.push({
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages,
                    ],
                });
            }
        }

        // Add Accept HWID admin roles to the channel if applicable
        const buttonRoles = new Set([
            ...(config.acceptRoleIds || (config.acceptRoleId ? [config.acceptRoleId] : [])),
        ]);

        for (const roleId of buttonRoles) {
            if (roleId) {
                permissionOverwrites.push({
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages,
                    ],
                });
            }
        }

        // Auto-Setup Category
        const fullCategoryLabels = {
            hwid_reset: 'HWID Reset Tickets',
            discord_change: 'Discord Change Tickets',
            blacklist_appeal: 'Appeal Tickets',
            general_support: 'Support Tickets',
        };
        const categoryName = fullCategoryLabels[session.categoryId] || 'Tickets';

        let parentCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === categoryName.toLowerCase());
        
        if (!parentCategory) {
            parentCategory = await guild.channels.create({
                name: categoryName,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    }
                ]
            });
        }

        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: parentCategory.id,
            permissionOverwrites,
        });

        // Save ticket to data
        createTicket(ticketId, {
            userId: interaction.user.id,
            userName: interaction.user.tag,
            userAvatar: interaction.user.displayAvatarURL({ size: 128 }),
            channelId: ticketChannel.id,
            guildId: guild.id,
            category: session.categoryId,
            answers: session.answers,
            imageUrls: session.imageUrls,
        });

        // Send ticket info in channel
        await sendTicketMessage(client, ticketChannel.id, ticketId, session, interaction.user);

        // Send DM confirmation
        const dmChannel = await interaction.user.createDM();
        await sendV2(client, dmChannel.id, [
            container(COLORS.SUCCESS, [
                textDisplay(`## ✅ Ticket Created\n\nYour ticket **#${ticketId}** has been created successfully.\n\n> Your ticket **#${ticketId}** has been created successfully in <#${ticketChannel.id}>. A staff member will assist you shortly.`),
            ]),
        ]);

        activeSessions.delete(interaction.user.id);
    } catch (e) {
        console.error('[DM] Failed to create ticket:', e);
        const dmChannel = await interaction.user.createDM();
        await sendV2(client, dmChannel.id, [
            container(COLORS.ERROR, [
                textDisplay('❌ **Error**\n> Failed to create your ticket. Please try again or contact an admin.'),
            ]),
        ]);
        activeSessions.delete(interaction.user.id);
    }
}

/**
 * Handle ticket cancellation
 */
async function cancelTicket(client, interaction) {
    activeSessions.delete(interaction.user.id);
    await interaction.deferUpdate();

    const dmChannel = await interaction.user.createDM();
    await sendV2(client, dmChannel.id, [
        container(COLORS.ERROR, [
            textDisplay('❌ **Ticket Cancelled**\n> Your ticket request has been cancelled.'),
        ]),
    ]);
}

/**
 * Send the ticket info message inside the ticket channel with action buttons
 */
async function sendTicketMessage(client, channelId, ticketId, session, user) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const categoryLabels = {
        hwid_reset: 'HWID Reset',
        discord_change: 'Discord Change',
        blacklist_appeal: 'Blacklist Appeal',
        general_support: 'General Support',
    };
    const categoryLabel = categoryLabels[session.categoryId] || session.categoryId;

    // Build answers text
    let answersText = '';
    for (const q of session.questions) {
        const label = q.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const val = session.answers[q.key] || 'N/A';

        if (session.imageUrls[q.key]) {
            answersText += `**${label}:** 🖼️ *See image below*\n`;
        } else {
            answersText += `**${label}:** ${val}\n`;
        }
    }

    const containerChildren = [
        textDisplay(`## 📩 Ticket #${ticketId}\n**Category:** ${categoryLabel}\n**Created by:** <@${user.id}> (${user.tag})\n**Date:** ${dateStr} ${timeStr}`),
        { type: 14, divider: true, spacing: 2 },
        textDisplay(`### Submitted Information\n${answersText}`),
    ];

    // Add images
    const imageItems = [];
    for (const [key, url] of Object.entries(session.imageUrls)) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        imageItems.push({ url, description: label });
    }

    if (imageItems.length > 0) {
        containerChildren.push({ type: 14, divider: true, spacing: 1 });
        containerChildren.push(mediaGallery(imageItems));
    }

    containerChildren.push({ type: 14, divider: true, spacing: 2 });
    containerChildren.push(textDisplay(`-# Korzen Support • ${dateStr} ${timeStr}`));

    const components = [
        container(COLORS.PRIMARY, containerChildren),
    ];

    // Action buttons row 1
    const buttons1 = [
        button('ticket_claim', '🎫 Claim Ticket', 1),
        button('ticket_close', '🔒 Close Ticket', 4),
    ];

    // Add Accept button for HWID reset
    if (session.categoryId === 'hwid_reset') {
        buttons1.push(button('ticket_accept', '✅ Accept', 3));
    }

    components.push(actionRow(buttons1));

    await sendV2(client, channelId, components);

    // Ping the user with a V2 embed
    await sendV2(client, channelId, [
        container(COLORS.INFO, [
            textDisplay(`<@${user.id}>\n\n> 💬 A staff member will assist you shortly. Please be patient.`),
        ]),
    ]);
}

function getSession(userId) {
    return activeSessions.get(userId);
}

function hasSession(userId) {
    return activeSessions.has(userId);
}

module.exports = {
    startDMSession,
    handleDMMessage,
    confirmTicket,
    cancelTicket,
    getSession,
    hasSession,
};
