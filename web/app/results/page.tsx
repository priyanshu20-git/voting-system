"use client"

import { useElection } from "@/lib/useElection"

export default function Results() {
    const { election, error } = useElection()

    if (error) return <p className="err">{error}</p>
    if (!election) return <p className="muted">Loading…</p>

    if (!election.results) {
        return (
            <>
                <h1>Results</h1>
                <p>Results are published when voting closes.</p>
                <p className="muted">
                    {election.voters.length} registered voters · {election.totalVotes} votes cast so far
                </p>
            </>
        )
    }

    const counts = election.results.map(Number)
    const total = counts.reduce((a, b) => a + b, 0)
    const top = Math.max(...counts)
    const winners = election.candidates.filter((_, i) => counts[i] === top)

    return (
        <>
            <h1>Results</h1>
            <p>
                {winners.length === 1 ? (
                    <>
                        <strong>{winners[0]}</strong> wins.
                    </>
                ) : (
                    <>Tie between {winners.join(" and ")}.</>
                )}{" "}
                <span className="muted">
                    {total} votes from {election.voters.length} registered voters.
                </span>
            </p>
            <div className="card">
                {election.candidates.map((name, i) => (
                    <div key={name}>
                        <strong>{name}</strong> · {counts[i]} {counts[i] === 1 ? "vote" : "votes"}
                        <div className="bar">
                            <span style={{ width: total ? `${(counts[i] / total) * 100}%` : 0 }} />
                        </div>
                    </div>
                ))}
            </div>
            <p className="muted">
                Verify on-chain: contract <code>{election.address}</code>
            </p>
        </>
    )
}
