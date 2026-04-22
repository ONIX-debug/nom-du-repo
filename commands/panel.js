const { PANEL_TEMPLATES, COLORS } = require('../config');
const { sendV2, container, textDisplay, separator, actionRow, stringSelect } = require('../utils/api');

module.exports = {
    name: 'panel',
    description: 'Send a ticket panel',
    usage: '+panel <template>',

    async execute(client, message, args) {
        const templateName = args[0] || 'conf1';
        const template = PANEL_TEMPLATES[templateName];

        if (!template) {
            const available = Object.keys(PANEL_TEMPLATES).join(', ');
            return sendV2(client, message.channel.id, [
                container(COLORS.ERROR, [
                    textDisplay(`❌ **Template not found:** \`${templateName}\`\n> Available templates: ${available}`),
                ]),
            ]);
        }

        // Delete the command message
        try { await message.delete(); } catch (_) {}

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        // Build panel sections
        const sectionTexts = template.sections.map(s => `${s.title}\n${s.desc}`).join('\n\n');

        // Build select options from categories
        const selectOptions = template.categories.map(cat => ({
            label: cat.label,
            value: cat.id,
            description: cat.description,
            emoji: cat.emoji,
        }));

        // Build the V2 panel message
        const components = [
            container(COLORS.PRIMARY, [
                textDisplay(`# ${template.title}`),
                separator(true, 1),
                textDisplay(template.description),
                separator(true, 2),
                textDisplay(sectionTexts),
                separator(true, 2),
                textDisplay(`-# ${template.title} • ${dateStr} ${timeStr}`),
                actionRow([
                    stringSelect('ticket_category_select', 'Select Ticket Category', selectOptions),
                ]),
            ]),
        ];

        await sendV2(client, message.channel.id, components);
    },
};
