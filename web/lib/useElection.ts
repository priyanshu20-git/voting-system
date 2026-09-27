"use client"

import { useCallback, useEffect, useState } from "react"
import { ElectionState, fetchElection } from "./election"

export function useElection() {
    const [election, setElection] = useState<ElectionState | null>(null)
    const [error, setError] = useState<string | null>(null)

    const reload = useCallback(async () => {
        try {
            setElection(await fetchElection())
            setError(null)
        } catch (err) {
            setError((err as Error).message)
        }
    }, [])

    useEffect(() => {
        reload()
    }, [reload])

    return { election, error, reload }
}
