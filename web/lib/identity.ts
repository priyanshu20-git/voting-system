"use client"

import { Identity } from "@semaphore-protocol/core"

// The identity's private key never leaves this browser. Only its public
// commitment is sent to the server during registration.
const key = (electionAddress: string) => `anon-vote:identity:${electionAddress.toLowerCase()}`

export function loadIdentity(electionAddress: string): Identity | null {
    try {
        const saved = localStorage.getItem(key(electionAddress))
        return saved ? Identity.import(saved) : null
    } catch {
        return null
    }
}

export function saveIdentity(electionAddress: string, identity: Identity) {
    localStorage.setItem(key(electionAddress), identity.export())
}

export function importIdentity(electionAddress: string, backupKey: string): Identity {
    const identity = Identity.import(backupKey.trim())
    saveIdentity(electionAddress, identity)
    return identity
}

// Only a convenience so the page can say "already voted"; the contract is what enforces it.
export function markVoted(electionAddress: string) {
    try {
        localStorage.setItem(`${key(electionAddress)}:voted`, "1")
    } catch {}
}

export function hasVoted(electionAddress: string): boolean {
    try {
        return localStorage.getItem(`${key(electionAddress)}:voted`) === "1"
    } catch {
        return false
    }
}
