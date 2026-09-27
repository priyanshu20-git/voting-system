export type ElectionState = {
    address: string
    title: string
    candidates: string[]
    phase: "Registration" | "Voting" | "Ended"
    groupId: string
    voters: string[]
    totalVotes: string
    results: string[] | null
    signup: "enrollment" | "email"
}

export async function fetchElection(): Promise<ElectionState> {
    const res = await fetch("/api/election", { cache: "no-store" })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || "Could not load the election.")
    return body
}

export async function postJson(url: string, data: unknown) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || "Request failed.")
    return body
}
