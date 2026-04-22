const { COLORS } = require('../config');

/**
 * Send a Components V2 message to a channel
 */
async function sendV2(client, channelId, components) {
    return client.rest.post(`/channels/${channelId}/messages`, {
        body: {
            flags: 1 << 15,
            components,
        },
    });
}

/**
 * Edit a Components V2 message
 */
async function editV2(client, channelId, messageId, components) {
    return client.rest.patch(`/channels/${channelId}/messages/${messageId}`, {
        body: {
            flags: 1 << 15,
            components,
        },
    });
}

/**
 * Build a Container component (replaces embeds)
 */
function container(accentColor, children) {
    return {
        type: 17,
        accent_color: accentColor,
        components: children,
    };
}

/**
 * Build a Text Display component
 */
function textDisplay(content) {
    return {
        type: 10,
        content,
    };
}

/**
 * Build a Separator component
 */
function separator(divider = true, spacing = 1) {
    return {
        type: 14,
        divider,
        spacing,
    };
}

/**
 * Build a Section component with text + accessory
 */
function section(textComponents, accessory) {
    return {
        type: 9,
        components: textComponents,
        accessory,
    };
}

/**
 * Build a Thumbnail component
 */
function thumbnail(url, description) {
    const t = { type: 11, media: { url } };
    if (description) t.description = description;
    return t;
}

/**
 * Build a Media Gallery component
 */
function mediaGallery(items) {
    return {
        type: 12,
        items: items.map(item => ({
            media: { url: item.url },
            ...(item.description ? { description: item.description } : {}),
        })),
    };
}

/**
 * Build an Action Row component
 */
function actionRow(children) {
    return {
        type: 1,
        components: children,
    };
}

/**
 * Build a Button component
 */
function button(customId, label, style = 2, options = {}) {
    const btn = {
        type: 2,
        custom_id: customId,
        label,
        style,
    };
    if (options.emoji) btn.emoji = options.emoji;
    if (options.disabled) btn.disabled = true;
    if (options.url) {
        btn.url = options.url;
        btn.style = 5;
        delete btn.custom_id;
    }
    return btn;
}

/**
 * Build a String Select component
 */
function stringSelect(customId, placeholder, options) {
    return {
        type: 3,
        custom_id: customId,
        placeholder,
        options: options.map(opt => ({
            label: opt.label,
            value: opt.value,
            description: opt.description || undefined,
            emoji: opt.emoji ? { name: opt.emoji } : undefined,
        })),
    };
}

/**
 * Send a quick error message
 */
async function sendError(client, channelId, message) {
    return sendV2(client, channelId, [
        container(COLORS.ERROR, [
            textDisplay(`❌ **Error**\n> ${message}`),
        ]),
    ]);
}


async function sendSuccess(client, channelId, message) {
    return sendV2(client, channelId, [
        container(COLORS.SUCCESS, [
            textDisplay(`✅ **Success**\n> ${message}`),
        ]),
    ]);
}

/**
 * Send a quick warning message
 */
async function sendWarning(client, channelId, message) {
    return sendV2(client, channelId, [
        container(COLORS.WARNING, [
            textDisplay(`⚠️ **Warning**\n> ${message}`),
        ]),
    ]);
}

module.exports = {
    sendV2,
    editV2,
    container,
    textDisplay,
    separator,
    section,
    thumbnail,
    mediaGallery,
    actionRow,
    button,
    stringSelect,
    sendError,
    sendSuccess,
    sendWarning,
};