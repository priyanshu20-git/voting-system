import { NextResponse } from "next/server"
import { createSignupToken, emailHash, isEligible, normaliseEmail } from "@/lib/auth"
import { PHASES, readElection } from "@/lib/chain"
import { sendSignupEmail } from "@/lib/mail"

/** Step 1 of registration: email a signed sign-up link to an eligible student. */
export async function POST(req: Request) {
    const { email: raw } = await req.json().catch(() => ({}))
    const email = typeof raw === "string" ? normaliseEmail(raw) : null
    if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    if (!isEligible(email)) {
        return NextResponse.json({ error: "This email isn't on the eligible voter list." }, { status: 403 })
    }

    const election = readElection()
    const [phase, alreadyRegistered, title] = await Promise.all([
        election.phase(),
        election.emailRegistered(emailHash(email)),
        election.title()
    ])
    if (PHASES[Number(phase)] !== "Registration") {
        return NextResponse.json({ error: "Registration is closed." }, { status: 409 })
    }
    if (alreadyRegistered) {
        return NextResponse.json({ error: "This email is already registered." }, { status: 409 })
    }

    // The token travels in the URL fragment, which browsers never send to the server.
    const link = `${process.env.APP_URL}/register/confirm#${createSignupToken(email)}`
    try {
        const { devLink } = await sendSignupEmail(email, link, title)
        return NextResponse.json({ ok: true, devLink })
    } catch (err) {
        console.error("sign-up email failed", (err as Error).message)
        return NextResponse.json({ error: "Could not send the email. Please try again." }, { status: 502 })
    }
}
