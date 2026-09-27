import { NextResponse } from "next/server"
import { verifySignupToken, voterIdHash } from "@/lib/auth"
import { explainError, organiserElection, sendWithRetry } from "@/lib/chain"

// Commitments are elements of the BN254 scalar field used by Semaphore.
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n

/** Step 2 of registration: add the voter's anonymous identity commitment on-chain. */
export async function POST(req: Request) {
    const { token, commitment } = await req.json().catch(() => ({}))
    const voterId = typeof token === "string" ? verifySignupToken(token) : null
    if (!voterId) {
        return NextResponse.json({ error: "This sign-up link is invalid or has expired." }, { status: 401 })
    }

    let value: bigint
    try {
        value = BigInt(commitment)
    } catch {
        return NextResponse.json({ error: "Invalid identity." }, { status: 400 })
    }
    if (value <= 0n || value >= SNARK_FIELD) return NextResponse.json({ error: "Invalid identity." }, { status: 400 })

    try {
        const election = organiserElection()
        await election.registerVoter.staticCall(value, voterIdHash(voterId))
        const txHash = await sendWithRetry(() => election.registerVoter(value, voterIdHash(voterId)))
        return NextResponse.json({ ok: true, txHash })
    } catch (err) {
        return NextResponse.json({ error: explainError(err) }, { status: 400 })
    }
}
