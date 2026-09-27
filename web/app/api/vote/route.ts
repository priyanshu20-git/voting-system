import { NextResponse } from "next/server"
import { explainError, organiserElection, sendWithRetry } from "@/lib/chain"

/**
 * Gasless relayer: submits the voter's zero-knowledge proof and pays the gas.
 * The proof carries no identity, so the relayer learns nothing about who voted.
 * Deliberately logs nothing about the request.
 */
export async function POST(req: Request) {
    const { proof } = await req.json().catch(() => ({}))
    if (!isProof(proof)) return NextResponse.json({ error: "Malformed vote." }, { status: 400 })

    try {
        const election = organiserElection()
        // Simulate first so invalid or duplicate votes fail fast without spending gas.
        await election.castVote.staticCall(proof)
        const txHash = await sendWithRetry(() => election.castVote(proof))
        return NextResponse.json({ ok: true, txHash })
    } catch (err) {
        return NextResponse.json({ error: explainError(err) }, { status: 400 })
    }
}

type Proof = {
    merkleTreeDepth: string | number
    merkleTreeRoot: string
    nullifier: string
    message: string
    scope: string
    points: string[]
}

const isNumeric = (v: unknown) => (typeof v === "string" || typeof v === "number") && /^\d+$/.test(String(v))

function isProof(p: unknown): p is Proof {
    const proof = p as Proof
    return (
        !!proof &&
        ["merkleTreeDepth", "merkleTreeRoot", "nullifier", "message", "scope"].every((k) =>
            isNumeric(proof[k as keyof Proof])
        ) &&
        Array.isArray(proof.points) &&
        proof.points.length === 8 &&
        proof.points.every(isNumeric)
    )
}
