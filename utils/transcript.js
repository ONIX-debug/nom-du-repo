/**
 * Generate a Discord-styled HTML transcript for a ticket
 * Replicates Discord's dark theme UI exactly
 */
function generateTranscript(ticketData, messages) {
    const ticketId = ticketData.id || '00000';
    const createdAt = formatDate(ticketData.createdAt);

    const categoryLabels = {
        hwid_reset: 'HWID Reset',
        discord_change: 'Discord Change',
        blacklist_appeal: 'Blacklist Appeal',
        general_support: 'General Support',
    };
    const categoryLabel = categoryLabels[ticketData.category] || ticketData.category;

    // Build ticket info HTML
    let ticketInfoHTML = '';
    if (ticketData.answers) {
        for (const [key, val] of Object.entries(ticketData.answers)) {
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (val && typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
                const isImage = /\.(png|jpg|jpeg|gif|webp)/i.test(val);
                if (isImage) {
                    ticketInfoHTML += `<div class="info-row"><span class="info-key">${esc(label)}</span><img src="${esc(val)}" class="info-img" /></div>`;
                } else {
                    ticketInfoHTML += `<div class="info-row"><span class="info-key">${esc(label)}</span><a href="${esc(val)}" class="info-link">${esc(val)}</a></div>`;
                }
            } else {
                ticketInfoHTML += `<div class="info-row"><span class="info-key">${esc(label)}</span><span class="info-val">${esc(val || 'N/A')}</span></div>`;
            }
        }
    }

    // Build messages HTML
    let messagesHTML = '';
    let prevAuthorId = null;
    let prevTimestamp = null;

    for (const msg of messages) {
        const ts = new Date(msg.timestamp);
        const isNewGroup = msg.authorId !== prevAuthorId ||
            (prevTimestamp && (ts - prevTimestamp) > 420000); // 7 min gap = new group

        prevAuthorId = msg.authorId;
        prevTimestamp = ts;

        const timeStr = formatDate(msg.timestamp);
        const shortTime = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const avatarUrl = msg.authorAvatar || `https://cdn.discordapp.com/embed/avatars/${Math.abs(parseInt(msg.authorId)) % 5}.png`;
        const nameColor = msg.isBot ? '#ff1493' : '#ffffff';

        let body = '';

        // Text content
        if (msg.content) {
            body += `<div class="msg-body">${mdToHtml(esc(msg.content))}</div>`;
        }

        // Embeds (V2 containers from bot)
        if (msg.embeds && msg.embeds.length > 0) {
            for (const emb of msg.embeds) {
                const borderColor = emb.color || '#ff1493';
                body += `<div class="embed" style="border-color:${esc(borderColor)}">`;
                if (emb.title) body += `<div class="embed-title">${esc(emb.title)}</div>`;
                if (emb.description) body += `<div class="embed-desc">${mdToHtml(esc(emb.description))}</div>`;
                body += `</div>`;
            }
        }

        // Attachments
        if (msg.attachments && msg.attachments.length > 0) {
            for (const att of msg.attachments) {
                if (att.contentType && att.contentType.startsWith('image/')) {
                    body += `<div class="msg-attachment"><img src="${esc(att.url)}" alt="${esc(att.filename || 'image')}" /></div>`;
                } else {
                    body += `<div class="msg-file"><svg width="24" height="24" viewBox="0 0 24 24" fill="#b5bac1"><path d="M4 2a2 2 0 00-2 2v16a2 2 0 002 2h16a2 2 0 002-2V8l-6-6H4zm9 1.5L19.5 10H13V3.5zM5 18V6h6v6h6v6H5z"/></svg><a href="${esc(att.url)}">${esc(att.filename || 'file')}</a></div>`;
                }
            }
        }

        // If V2 components data available, show raw content
        if (msg.components && msg.components.length > 0) {
            body += renderV2Components(msg.components);
        }

        if (!body.trim()) continue; // skip empty

        if (isNewGroup) {
            messagesHTML += `
            <div class="msg-group">
                <img class="avatar" src="${esc(avatarUrl)}" alt="" />
                <div class="msg-right">
                    <div class="msg-header">
                        <span class="username" style="color:${nameColor}">${esc(msg.authorName)}</span>
                        ${msg.isBot ? '<span class="bot-badge">BOT</span>' : ''}
                        <span class="ts">${timeStr}</span>
                    </div>
                    ${body}
                </div>
            </div>`;
        } else {
            messagesHTML += `
            <div class="msg-cont" data-time="${shortTime}">
                ${body}
            </div>`;
        }
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transcript — #${esc(ticketId)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#313338;color:#dbdee1;font-family:'Noto Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.375}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:8px}
::-webkit-scrollbar-track{background:#2b2d31}
::-webkit-scrollbar-thumb{background:#1a1b1e;border-radius:4px}

/* ── Channel Header ── */
.channel-header{
    height:48px;background:#313338;border-bottom:1px solid #1e1f22;
    display:flex;align-items:center;padding:0 16px;
    position:sticky;top:0;z-index:10;
}
.channel-header svg{color:#80848e;margin-right:8px;flex-shrink:0}
.channel-header .name{font-weight:600;color:#f2f3f5;font-size:16px}
.channel-header .topic{color:#80848e;font-size:14px;margin-left:16px;padding-left:16px;border-left:1px solid #3f4147}

/* ── Ticket Info Banner ── */
.ticket-banner{
    margin:16px;padding:16px;background:#2b2d31;border-radius:8px;border-left:4px solid #ff1493;
}
.ticket-banner h2{color:#f2f3f5;font-size:20px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.ticket-banner .meta{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:12px;font-size:14px;color:#b5bac1}
.ticket-banner .meta b{color:#f2f3f5}
.info-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;margin-top:12px}
.info-row{display:flex;flex-direction:column;gap:2px;padding:8px 12px;background:#1e1f22;border-radius:6px}
.info-key{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:#80848e}
.info-val{font-size:14px;color:#dbdee1}
.info-img{max-width:280px;max-height:180px;border-radius:4px;margin-top:4px;cursor:pointer}
.info-link{color:#00a8fc;text-decoration:none;font-size:14px;word-break:break-all}
.info-link:hover{text-decoration:underline}

/* ── Messages Area ── */
.messages{padding:0 16px 24px}

/* ── Date Divider ── */
.date-divider{
    display:flex;align-items:center;margin:24px 0 8px;
}
.date-divider span{
    flex-shrink:0;padding:0 8px;font-size:12px;font-weight:600;color:#80848e;
}
.date-divider::before,.date-divider::after{
    content:'';flex:1;height:1px;background:#3f4147;
}

/* ── Message Group ── */
.msg-group{
    display:flex;gap:16px;padding:2px 8px;margin-top:17px;
    position:relative;
}
.msg-group:hover{background:#2e3035;border-radius:4px}
.avatar{
    width:40px;height:40px;border-radius:50%;flex-shrink:0;
    object-fit:cover;cursor:pointer;margin-top:2px;
}
.msg-right{flex:1;min-width:0}
.msg-header{display:flex;align-items:baseline;gap:8px}
.username{font-weight:600;font-size:1rem;cursor:pointer}
.username:hover{text-decoration:underline}
.bot-badge{
    background:#5865f2;color:#fff;font-size:10px;font-weight:600;
    padding:0 4px;border-radius:3px;text-transform:uppercase;
    position:relative;top:-1px;line-height:16px;height:16px;display:inline-flex;align-items:center;
}
.ts{font-size:12px;color:#949ba4;font-weight:400;margin-left:4px}

/* ── Continuation message ── */
.msg-cont{
    padding:2px 8px 2px 72px;position:relative;
}
.msg-cont:hover{background:#2e3035;border-radius:4px}
.msg-cont:hover::before{
    content:attr(data-time);position:absolute;left:12px;top:50%;transform:translateY(-50%);
    font-size:11px;color:#949ba4;
}

/* ── Message body ── */
.msg-body{word-wrap:break-word;white-space:pre-wrap}
.msg-body strong{color:#f2f3f5;font-weight:700}
.msg-body em{font-style:italic}
.msg-body u{text-decoration:underline}
.msg-body code{
    background:#1e1f22;padding:2px 4px;border-radius:3px;
    font-family:'Consolas','Andale Mono',monospace;font-size:14px;
}
.msg-body pre{
    background:#1e1f22;padding:8px 12px;border-radius:4px;margin:4px 0;
    overflow-x:auto;border:1px solid #1a1b1e;
}
.msg-body pre code{background:none;padding:0;font-size:14px}
.msg-body blockquote{
    border-left:4px solid #4e5058;padding-left:12px;margin:2px 0;
}
.msg-body a{color:#00a8fc;text-decoration:none}
.msg-body a:hover{text-decoration:underline}

/* ── Mentions ── */
.mention{
    background:rgba(88,101,242,.3);color:#dee0fc;padding:0 2px;border-radius:3px;
    font-weight:500;cursor:pointer;
}
.mention:hover{background:rgba(88,101,242,.5)}

/* ── Embed ── */
.embed{
    background:#2b2d31;border-left:4px solid #ff1493;border-radius:4px;
    padding:8px 16px 8px 12px;margin:4px 0;max-width:520px;
}
.embed-title{font-weight:700;color:#f2f3f5;margin-bottom:4px}
.embed-desc{font-size:14px;color:#dbdee1;line-height:1.3}

/* ── Attachment ── */
.msg-attachment{margin:4px 0}
.msg-attachment img{
    max-width:400px;max-height:300px;border-radius:8px;cursor:pointer;
    display:block;
}
.msg-file{
    display:inline-flex;align-items:center;gap:8px;background:#2b2d31;
    padding:10px 12px;border-radius:8px;border:1px solid #1e1f22;margin:4px 0;
}
.msg-file a{color:#00a8fc;text-decoration:none;font-weight:500}
.msg-file a:hover{text-decoration:underline}

/* ── Footer ── */
.footer{
    padding:16px;text-align:center;color:#5c5e66;font-size:12px;
    border-top:1px solid #1e1f22;margin-top:24px;
}
.footer strong{color:#80848e}

/* ── Responsive ── */
@media(max-width:600px){
    .msg-group{gap:12px}
    .avatar{width:32px;height:32px}
    .msg-cont{padding-left:60px}
    .msg-attachment img{max-width:100%}
    .info-grid{grid-template-columns:1fr}
}
</style>
</head>
<body>

<!-- Channel Header -->
<div class="channel-header">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z"/></svg>
    <span class="name">ticket-${esc(ticketId)}</span>
    <span class="topic">${esc(categoryLabel)} — ${esc(ticketData.userName || 'Unknown')}</span>
</div>

<!-- Ticket Info Banner -->
<div class="ticket-banner">
    <h2>📩 Ticket #${esc(ticketId)}</h2>
    <div class="meta">
        <span><b>Category:</b> ${esc(categoryLabel)}</span>
        <span><b>User:</b> ${esc(ticketData.userName || 'Unknown')}</span>
        <span><b>Created:</b> ${esc(createdAt)}</span>
        <span><b>Status:</b> ${esc(ticketData.status || 'closed')}</span>
    </div>
    <div class="info-grid">
        ${ticketInfoHTML}
    </div>
</div>

<!-- Messages -->
<div class="messages">
    <div class="date-divider"><span>${formatDateOnly(ticketData.createdAt)}</span></div>
    ${messagesHTML}
</div>

<!-- Footer -->
<div class="footer">
    <strong>Korzen Support</strong> — Transcript generated ${formatDate(new Date().toISOString())} — ${messages.length} messages
</div>

<script>
// Click image to open full size
document.querySelectorAll('.msg-attachment img, .info-img').forEach(img => {
    img.addEventListener('click', () => window.open(img.src, '_blank'));
});
</script>
</body>
</html>`;
}

// ── Helpers ──

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateOnly(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function mdToHtml(text) {
    // Code blocks (multi-line)
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold + italic
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    // Underline
    text = text.replace(/__(.+?)__/g, '<u>$1</u>');
    // Strikethrough
    text = text.replace(/~~(.+?)~~/g, '<s>$1</s>');
    // Blockquotes
    text = text.replace(/^&gt;\s?(.*)$/gm, '<blockquote>$1</blockquote>');
    // Mentions <@id> or <@&id> or <#id>
    text = text.replace(/&lt;@&amp;?(\d+)&gt;/g, '<span class="mention">@mention</span>');
    text = text.replace(/&lt;@!?(\d+)&gt;/g, '<span class="mention">@user</span>');
    text = text.replace(/&lt;#(\d+)&gt;/g, '<span class="mention">#channel</span>');
    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    // Auto-link URLs
    text = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
    // Newlines
    text = text.replace(/\n/g, '<br>');
    return text;
}

function renderV2Components(components) {
    // Simple renderer for V2 component data captured in messages
    let html = '';
    for (const comp of components) {
        if (comp.type === 17) { // Container
            const color = comp.accent_color ? `#${comp.accent_color.toString(16).padStart(6, '0')}` : '#ff1493';
            html += `<div class="embed" style="border-color:${color}">`;
            if (comp.components) {
                for (const child of comp.components) {
                    if (child.type === 10 && child.content) { // Text Display
                        html += `<div class="embed-desc">${mdToHtml(esc(child.content))}</div>`;
                    }
                }
            }
            html += `</div>`;
        }
    }
    return html;
}

module.exports = { generateTranscript };
