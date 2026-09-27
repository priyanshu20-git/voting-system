"use client"

import Link from "next/link"
import { useElection } from "@/lib/useElection"

export default function Home() {
    const { election, error } = useElection()

    if (error) return <p className="err">{error}</p>
    if (!election) return <p className="muted">Loading election…</p>

    const next = {
        Registration: { href: "/register", label: "Register to vote" },
        Voting: { href: "/vote", label: "Cast your vote" },
        Ended: { href: "/results", label: "See the results" }
    }[election.phase]

    return (
        <>
            <h1>{election.title}</h1>
            <span className="badge">{election.phase === "Ended" ? "Voting closed" : `${election.phase} open`}</span>

            <div className="card">
                <h2>Candidates</h2>
                <ul>
                    {election.candidates.map((c) => (
                        <li key={c}>{c}</li>
                    ))}
                </ul>
                <p className="muted">
                    {election.voters.length} registered voters · {election.totalVotes} votes cast
                </p>
                <Link className="button" href={next.href}>
                    {next.label}
                </Link>
            </div>

            <div className="card">
                <h2>How your vote stays secret</h2>
                <p>
                    When you register, your browser creates a secret voter key that never leaves your device. Your
                    college email only proves you are eligible; it is not linked to your key.
                </p>
                <p>
                    When you vote, your browser sends a zero-knowledge proof that says “I am one of the registered
                    voters and I haven't voted yet” without revealing which one. Nobody, including the organisers
                    and candidates, can see who voted for whom.
                </p>
                <p className="muted">
                    Every vote is recorded on the Base blockchain, so anyone can check the final count. Contract:{" "}
                    <code>{election.address}</code>
                </p>
            </div>
        </>
    )
}
