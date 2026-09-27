"use client"

import { useEffect, useState } from "react"
import type { Identity } from "@semaphore-protocol/core"
import { postJson } from "@/lib/election"
import { hasVoted, importIdentity, loadIdentity, markVoted } from "@/lib/identity"
import { useElection } from "@/lib/useElection"

export default function Vote() {
    const { election, error } = useElection()
    const [identity, setIdentity] = useState<Identity | null>(null)
    const [backupKey, setBackupKey] = useState("")
    const [choice, setChoice] = useState<number | null>(null)
    const [status, setStatus] = useState<"idle" | "proving" | "sending" | "done">("idle")
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!election) return
        setIdentity(loadIdentity(election.address))
        if (hasVoted(election.address)) setStatus("done")
    }, [election])

    if (error) return <p className="err">{error}</p>
    if (!election) return <p className="muted">Loading…</p>
    if (election.phase === "Registration") return <p>Voting hasn't opened yet. Make sure you've registered.</p>
    if (election.phase === "Ended") return <p>Voting has closed. See the results page.</p>

    if (!identity) {
        return (
            <>
                <h1>Vote</h1>
                <p>
                    No voter key found in this browser. Open this site on the device you registered with, or paste
                    your backup key.
                </p>
                <div className="card">
                    <textarea rows={3} value={backupKey} onChange={(e) => setBackupKey(e.target.value)} />
                    <button
                        onClick={() => {
                            try {
                                setIdentity(importIdentity(election.address, backupKey))
                                setMessage(null)
                            } catch {
                                setMessage("That doesn't look like a valid voter key.")
                            }
                        }}
                    >
                        Use this key
                    </button>
                    {message && <p className="err">{message}</p>}
                </div>
            </>
        )
    }

    if (!election.voters.includes(identity.commitment.toString())) {
        return <p className="err">This voter key isn't on the voter list for this election.</p>
    }

    async function castVote() {
        if (choice === null || !election || !identity) return
        setMessage(null)
        try {
            setStatus("proving")
            const { Group, generateProof } = await import("@semaphore-protocol/core")
            const group = new Group(election.voters.map(BigInt))
            // message = candidate index, scope = this election's group, so the
            // nullifier is the same for any second attempt and gets rejected.
            const proof = await generateProof(identity, group, choice, election.groupId)

            setStatus("sending")
            await postJson("/api/vote", { proof })
            markVoted(election.address)
            setStatus("done")
        } catch (err) {
            setMessage((err as Error).message)
            setStatus("idle")
        }
    }

    if (status === "done") {
        return (
            <>
                <h1 className="ok">Your vote is in</h1>
                <p>It was recorded anonymously. Results will be published when voting closes.</p>
            </>
        )
    }

    const busy = status !== "idle"
    return (
        <>
            <h1>{election.title}</h1>
            <p className="muted">Pick one candidate. You can vote only once and it can't be changed.</p>
            <div className="card">
                {election.candidates.map((name, i) => (
                    <label className="choice" key={name}>
                        <input
                            type="radio"
                            name="candidate"
                            checked={choice === i}
                            disabled={busy}
                            onChange={() => setChoice(i)}
                        />
                        {name}
                    </label>
                ))}
                <button disabled={choice === null || busy} onClick={castVote}>
                    {status === "proving"
                        ? "Creating anonymous proof…"
                        : status === "sending"
                          ? "Submitting…"
                          : "Cast anonymous vote"}
                </button>
                {message && <p className="err">{message}</p>}
            </div>
        </>
    )
}
