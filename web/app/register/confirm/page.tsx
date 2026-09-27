"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Identity } from "@semaphore-protocol/core"
import { fetchElection, postJson } from "@/lib/election"
import { loadIdentity, saveIdentity } from "@/lib/identity"

type State =
    | { step: "working" }
    | { step: "done"; backupKey: string; alreadyRegistered: boolean }
    | { step: "error"; message: string }

export default function ConfirmRegistration() {
    const [state, setState] = useState<State>({ step: "working" })
    const started = useRef(false)

    useEffect(() => {
        if (started.current) return
        started.current = true

        ;(async () => {
            try {
                const token = window.location.hash.slice(1)
                if (!token) throw new Error("This page needs the sign-up link from your email.")

                const election = await fetchElection()
                const existing = loadIdentity(election.address)
                if (existing && election.voters.includes(existing.commitment.toString())) {
                    setState({ step: "done", backupKey: existing.export(), alreadyRegistered: true })
                    return
                }

                // Created locally; only the public commitment is sent.
                const identity = existing ?? new Identity()
                saveIdentity(election.address, identity)
                await postJson("/api/register/confirm", { token, commitment: identity.commitment.toString() })

                // Remove the token from the address bar and history.
                history.replaceState(null, "", window.location.pathname)
                setState({ step: "done", backupKey: identity.export(), alreadyRegistered: false })
            } catch (err) {
                setState({ step: "error", message: (err as Error).message })
            }
        })()
    }, [])

    if (state.step === "working") return <p className="muted">Creating your secret voter key and registering it…</p>
    if (state.step === "error") return <p className="err">{state.message}</p>

    return (
        <>
            <h1>{state.alreadyRegistered ? "You're already registered" : "You're registered"}</h1>
            <p>
                Your secret voter key is saved in this browser. Come back to this site on this device when voting
                opens.
            </p>
            <div className="card">
                <h2>Back up your key</h2>
                <p className="muted">
                    If you clear your browser or switch devices you'll need this key to vote. Keep it private: anyone
                    with it can cast your vote. It is never sent to us.
                </p>
                <textarea readOnly rows={3} value={state.backupKey} onFocus={(e) => e.target.select()} />
                <button
                    className="secondary"
                    onClick={() => {
                        const blob = new Blob([state.backupKey], { type: "text/plain" })
                        const a = document.createElement("a")
                        a.href = URL.createObjectURL(blob)
                        a.download = "voter-key.txt"
                        a.click()
                    }}
                >
                    Download key
                </button>
            </div>
            <Link href="/">Back to the election</Link>
        </>
    )
}
