"use client"

import { FormEvent, useState } from "react"
import { postJson } from "@/lib/election"
import { useElection } from "@/lib/useElection"

export default function Register() {
    const { election, error } = useElection()
    const [id, setId] = useState("")
    const [sentTo, setSentTo] = useState<string | null>(null)
    const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle")
    const [message, setMessage] = useState<string | null>(null)
    const [devLink, setDevLink] = useState<string | null>(null)

    async function submit(e: FormEvent) {
        e.preventDefault()
        setStatus("sending")
        setMessage(null)
        try {
            const res = await postJson("/api/register/request", { id })
            setSentTo(res.sentTo ?? null)
            setDevLink(res.devLink ?? null)
            setStatus("sent")
        } catch (err) {
            setMessage((err as Error).message)
            setStatus("idle")
        }
    }

    if (error) return <p className="err">{error}</p>
    if (!election) return <p className="muted">Loading…</p>
    if (election.phase !== "Registration") {
        return <p>Registration is closed. {election.phase === "Voting" ? "Voting is open now." : ""}</p>
    }

    const byEnrollment = election.signup === "enrollment"

    return (
        <>
            <h1>Register to vote</h1>
            <p className="muted">
                {byEnrollment
                    ? "Enter your enrollment number. We'll send a sign-up link to the college email on record for it."
                    : "Enter your college email. We'll send you a sign-up link."}{" "}
                Open the link on the phone or laptop you'll vote from, because your secret voter key is created and
                stored there.
            </p>

            {status === "sent" ? (
                <div className="card">
                    <p className="ok">
                        We sent a sign-up link to {sentTo ?? "your college email"}. It expires in 30 minutes.
                    </p>
                    {devLink && (
                        <p className="muted">
                            Local dev (no email provider configured): <a href={devLink}>open sign-up link</a>
                        </p>
                    )}
                </div>
            ) : (
                <form className="card" onSubmit={submit}>
                    <label htmlFor="voter-id">{byEnrollment ? "Enrollment number" : "College email"}</label>
                    <input
                        id="voter-id"
                        type={byEnrollment ? "text" : "email"}
                        required
                        autoComplete={byEnrollment ? "off" : "email"}
                        placeholder={byEnrollment ? "e.g. 22BCS1042" : "you@college.edu"}
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                    />
                    <button disabled={status === "sending"}>
                        {status === "sending" ? "Sending…" : "Email me a sign-up link"}
                    </button>
                    {message && <p className="err">{message}</p>}
                </form>
            )}
        </>
    )
}
