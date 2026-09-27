import { NextResponse } from "next/server"
import { createSignupToken, maskEmail, resolveVoter, voterIdHash } from "@/lib/auth"
import { PHASES, readElection } from "@/lib/chain"
import { sendSignupEmail } from "@/lib/mail"

/**
 * Step 1 of registration: email a signed sign-up link to the student's official
 * college address. Owning that inbox is what proves who the student is.
 */
export async function POST(req: Request) {
    const { id } = await req.json().catch(() => ({}))
    const voter = typeof id === "string" ? resolveVoter(id) : { error: "Enter your details." }
    if ("error" in voter) return NextResponse.json({ error: voter.error }, { status: 403 })

    const election = readElection()
    const [phase, alreadyRegistered, title] = await Promise.all([
        election.phase(),
        election.voterIdRegistered(voterIdHash(voter.voterId)),
        election.title()
    ])
    if (PHASES[Number(phase)] !== "Registration") {
        return NextResponse.json({ error: "Registration is closed." }, { status: 409 })
    }
    if (alreadyRegistered) {
        return NextResponse.json(
            {
                error: "This student is already registered. If that wasn't you, tell the election committee right away."
            },
            { status: 409 }
        )
    }

    // The token travels in the URL fragment, which browsers never send to the server.
    const link = `${process.env.APP_URL}/register/confirm#${createSignupToken(voter.voterId)}`
    try {
        const { devLink } = await sendSignupEmail(voter.email, link, title)
        return NextResponse.json({ ok: true, sentTo: maskEmail(voter.email), devLink })
    } catch (err) {
        console.error("sign-up email failed", (err as Error).message)
        return NextResponse.json({ error: "Could not send the email. Please try again." }, { status: 502 })
    }
}
