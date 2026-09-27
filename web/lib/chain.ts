import "server-only"
import { Contract, JsonRpcProvider, Wallet } from "ethers"

export const ELECTION_ABI = [
    "function title() view returns (string)",
    "function groupId() view returns (uint256)",
    "function phase() view returns (uint8)",
    "function totalVotes() view returns (uint256)",
    "function voterCount() view returns (uint256)",
    "function getCandidates() view returns (string[])",
    "function getVoters() view returns (uint256[])",
    "function getResults() view returns (uint256[])",
    "function emailRegistered(bytes32) view returns (bool)",
    "function registerVoter(uint256 identityCommitment, bytes32 emailHash)",
    "function castVote((uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] points) proof)",
    "error NotOrganiser()",
    "error WrongPhase(uint8 expected, uint8 actual)",
    "error EmailAlreadyRegistered()",
    "error InvalidCandidate()",
    "error InvalidScope()",
    "error ResultsNotPublished()",
    // Errors bubbled up from the Semaphore contract.
    "error Semaphore__GroupHasNoMembers()",
    "error Semaphore__MerkleTreeDepthIsNotSupported()",
    "error Semaphore__MerkleTreeRootIsExpired()",
    "error Semaphore__MerkleTreeRootIsNotPartOfTheGroup()",
    "error Semaphore__YouAreUsingTheSameNullifierTwice()",
    "error Semaphore__InvalidProof()",
    "error LeanIMT__LeafAlreadyExists()"
]

export const PHASES = ["Registration", "Voting", "Ended"] as const
export type Phase = (typeof PHASES)[number]

function requireEnv(name: string) {
    const value = process.env[name]
    if (!value) throw new Error(`Missing environment variable ${name}`)
    return value
}

const provider = () => new JsonRpcProvider(process.env.RPC_URL || "https://sepolia.base.org")

export function readElection() {
    return new Contract(requireEnv("ELECTION_ADDRESS"), ELECTION_ABI, provider())
}

export function organiserElection() {
    const wallet = new Wallet(requireEnv("RELAYER_PRIVATE_KEY"), provider())
    return new Contract(requireEnv("ELECTION_ADDRESS"), ELECTION_ABI, wallet)
}

const FRIENDLY_ERRORS: Record<string, string> = {
    Semaphore__YouAreUsingTheSameNullifierTwice: "This identity has already voted.",
    Semaphore__MerkleTreeRootIsNotPartOfTheGroup: "This identity is not on the voter list.",
    Semaphore__MerkleTreeRootIsExpired: "The voter list changed; reload the page and try again.",
    Semaphore__InvalidProof: "The vote proof is invalid.",
    EmailAlreadyRegistered: "This email is already registered.",
    LeanIMT__LeafAlreadyExists: "This identity is already registered.",
    InvalidCandidate: "Unknown candidate.",
    InvalidScope: "This vote was made for a different election.",
    WrongPhase: "That isn't possible in the election's current phase."
}

/** Turns a contract revert into a message safe to show voters. */
export function explainError(err: unknown): string {
    const e = err as { revert?: { name?: string }; shortMessage?: string }
    const name = e?.revert?.name
    if (name && FRIENDLY_ERRORS[name]) return FRIENDLY_ERRORS[name]
    return "Something went wrong submitting to the blockchain. Please try again."
}

/** Sends a transaction, retrying if concurrent requests raced for the same nonce. */
export async function sendWithRetry(send: () => Promise<{ wait: () => Promise<unknown>; hash: string }>) {
    for (let attempt = 0; ; attempt++) {
        try {
            const tx = await send()
            await tx.wait()
            return tx.hash
        } catch (err) {
            const code = (err as { code?: string }).code
            const retryable = code === "NONCE_EXPIRED" || code === "REPLACEMENT_UNDERPRICED"
            if (!retryable || attempt >= 3) throw err
        }
    }
}
