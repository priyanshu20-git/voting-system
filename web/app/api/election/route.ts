import { NextResponse } from "next/server"
import { signupMode } from "@/lib/auth"
import { PHASES, readElection } from "@/lib/chain"

export const dynamic = "force-dynamic"

/** Public election state, read straight from the contract. */
export async function GET() {
    try {
        const election = readElection()
        const [title, candidates, phaseIndex, groupId, voters, totalVotes] = await Promise.all([
            election.title(),
            election.getCandidates(),
            election.phase(),
            election.groupId(),
            election.getVoters(),
            election.totalVotes()
        ])
        const phase = PHASES[Number(phaseIndex)]
        const results = phase === "Ended" ? (await election.getResults()).map(String) : null

        return NextResponse.json({
            address: await election.getAddress(),
            title,
            candidates: [...candidates],
            phase,
            groupId: groupId.toString(),
            voters: voters.map(String),
            totalVotes: totalVotes.toString(),
            results,
            signup: signupMode()
        })
    } catch (err) {
        console.error("election read failed", (err as Error).message)
        return NextResponse.json({ error: "Could not read the election from the blockchain." }, { status: 502 })
    }
}
