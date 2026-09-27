import "server-only"

/**
 * Sends the sign-up link. Returns the link itself only in local development
 * without an email provider, so the flow can be tested end to end.
 */
export async function sendSignupEmail(to: string, link: string, title: string): Promise<{ devLink?: string }> {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
        if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not configured")
        return { devLink: link }
    }

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to,
            subject: `Your sign-up link for ${title}`,
            html: `<p>Open this link <strong>on the phone or laptop you will vote from</strong> to register as a voter for <strong>${escapeHtml(title)}</strong>:</p>
<p><a href="${link}">Register to vote</a></p>
<p>The link works once and expires in 30 minutes. Your vote stays anonymous: this email only proves you are eligible.</p>`
        })
    })
    if (!res.ok) throw new Error(`Email provider returned ${res.status}`)
    return {}
}

function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}
