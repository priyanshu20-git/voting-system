import "server-only"
import { createHmac, timingSafeEqual } from "crypto"

const LINK_TTL_MS = 30 * 60 * 1000

function secret() {
    const value = process.env.AUTH_SECRET
    if (!value || value.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters")
    return value
}

const hmac = (purpose: string, data: string) => createHmac("sha256", secret()).update(`${purpose}:${data}`).digest()

/**
 * Lower-cases the address and strips "+tag" aliases, so name+1@college.edu
 * cannot register a second time as a different voter.
 */
export function normaliseEmail(raw: string): string | null {
    const email = raw.trim().toLowerCase()
    const match = /^([^@\s]+)@([^@\s]+\.[^@\s]+)$/.exec(email)
    if (!match) return null
    const local = match[1].split("+")[0]
    return local ? `${local}@${match[2]}` : null
}

const list = (value?: string) =>
    (value || "")
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)

export function isEligible(email: string): boolean {
    const allowlist = list(process.env.VOTER_ALLOWLIST).map((e) => normaliseEmail(e))
    if (allowlist.length > 0) return allowlist.includes(email)

    const domain = email.split("@")[1]
    return list(process.env.ALLOWED_EMAIL_DOMAINS).includes(domain)
}

/** A signed, expiring sign-up token. Stateless, so no database is needed. */
export function createSignupToken(email: string): string {
    const payload = `${Buffer.from(email).toString("base64url")}.${Date.now() + LINK_TTL_MS}`
    return `${payload}.${hmac("signup", payload).toString("base64url")}`
}

export function verifySignupToken(token: string): string | null {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const [emailPart, expiry, signature] = parts
    const payload = `${emailPart}.${expiry}`

    const expected = hmac("signup", payload)
    const given = Buffer.from(signature, "base64url")
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    if (Date.now() > Number(expiry)) return null

    return Buffer.from(emailPart, "base64url").toString()
}

/**
 * Keyed hash stored on-chain to stop one email registering twice.
 * Being keyed, it cannot be reversed into a list of who registered.
 */
export function emailHash(email: string): string {
    return `0x${hmac("email", email).toString("hex")}`
}
