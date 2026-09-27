import "server-only"
import { createHmac, timingSafeEqual } from "crypto"
import fs from "fs"

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

export function normaliseEnrollment(raw: string): string | null {
    const value = raw.replace(/\s+/g, "").toUpperCase()
    return /^[A-Z0-9/_-]{3,32}$/.test(value) ? value : null
}

let rosterCache: Map<string, string> | null = null

/**
 * The official voter roster from the election committee: one "enrollment,email"
 * line per eligible student. Read from VOTER_ROSTER (the CSV itself) or
 * VOTER_ROSTER_FILE (a path). Returns null when no roster is configured.
 */
export function roster(): Map<string, string> | null {
    if (rosterCache) return rosterCache
    const csv = process.env.VOTER_ROSTER || (process.env.VOTER_ROSTER_FILE && fs.readFileSync(process.env.VOTER_ROSTER_FILE, "utf8"))
    if (!csv) return null

    const map = new Map<string, string>()
    for (const line of csv.split(/\r?\n|;/)) {
        const [rawId, rawEmail] = line.split(",").map((v) => v?.trim() ?? "")
        const id = normaliseEnrollment(rawId || "")
        const email = normaliseEmail(rawEmail || "")
        if (id && email) map.set(id, email) // skips a header row and blank lines
    }
    if (map.size === 0) throw new Error("The voter roster is set but has no valid enrollment,email rows")
    rosterCache = map
    return map
}

export type SignupMode = "enrollment" | "email"

export const signupMode = (): SignupMode => (roster() ? "enrollment" : "email")

export type Voter = { voterId: string; email: string }

/**
 * Resolves what the student typed into who they are and where to send the link.
 *
 * With a roster, the student types their enrollment number and the link always goes
 * to the college email the roster has for that number. Typing someone else's number
 * only sends a link to *their* inbox, so enrollment numbers being sequential or
 * guessable doesn't let anyone register in another student's place.
 *
 * Without a roster, any address on an allowed college domain may register.
 */
export function resolveVoter(input: string): Voter | { error: string } {
    const list = roster()
    if (list) {
        const id = normaliseEnrollment(input)
        const email = id && list.get(id)
        if (!id || !email) return { error: "This enrollment number isn't on the voter list." }
        return { voterId: `enrollment:${id}`, email }
    }

    const email = normaliseEmail(input)
    if (!email) return { error: "Enter a valid college email address." }
    const domains = (process.env.ALLOWED_EMAIL_DOMAINS || "")
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean)
    if (!domains.includes(email.split("@")[1])) return { error: "Use your college email address." }
    return { voterId: `email:${email}`, email }
}

/** "student123@college.edu" -> "st*******@college.edu", to confirm where the link went. */
export function maskEmail(email: string) {
    const [local, domain] = email.split("@")
    return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`
}

/** A signed, expiring sign-up token. Stateless, so no database is needed. */
export function createSignupToken(voterId: string): string {
    const payload = `${Buffer.from(voterId).toString("base64url")}.${Date.now() + LINK_TTL_MS}`
    return `${payload}.${hmac("signup", payload).toString("base64url")}`
}

export function verifySignupToken(token: string): string | null {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const [idPart, expiry, signature] = parts
    const payload = `${idPart}.${expiry}`

    const expected = hmac("signup", payload)
    const given = Buffer.from(signature, "base64url")
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    if (Date.now() > Number(expiry)) return null

    return Buffer.from(idPart, "base64url").toString()
}

/**
 * Keyed hash stored on-chain to stop a student registering twice.
 * Being keyed, it can't be reversed, and sequential enrollment numbers can't be
 * hashed by outsiders to check who has registered.
 */
export function voterIdHash(voterId: string): string {
    return `0x${hmac("voter", voterId).toString("hex")}`
}
