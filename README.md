# Anonymous College Voting

A web app for student elections where every eligible student votes **once**, **nobody can see who voted for whom** (not the organisers, not the candidates), and **anyone can verify the final count** on the blockchain.

Voters need no crypto wallet and pay nothing. They sign up with their enrollment number (verified through their college email) and vote from their phone or laptop.

## How it works

1. **Register:** a student enters their enrollment number. The app looks it up in the committee's official roster and emails a sign-up link to the college address on record for that number. Opening the link creates a secret voter key *inside their browser*. Only a public fingerprint of that key (a Semaphore identity commitment) is added to the on-chain voter list. The enrollment number is only used to check eligibility and to stop anyone registering twice.
2. **Vote:** the browser produces a [Semaphore](https://semaphore.pse.dev) zero-knowledge proof: "I am one of the registered voters, here is my vote", without revealing which voter. A nullifier, derived from the secret key and this election, makes a second vote from the same key fail.
3. **Relay:** the server submits the proof to the contract and pays the gas, so voters never touch crypto. The proof carries no identity, so the server can't tell who voted either.
4. **Results:** the contract keeps the count and publishes it only after the organiser closes voting.

```
contracts/   Solidity Election contract (Hardhat) + tests + deploy/phase scripts
web/         Next.js app: register, vote, results pages and the email + relayer API
```

## Run it locally

```bash
# 1. Chain + contract
cd contracts
npm install
npx hardhat node                          # leave running
CANDIDATES="Alice,Bob" npx hardhat run scripts/deploy.ts --network localhost

# 2. Web app (new terminal)
cd web
npm install
cp .env.example .env.local
#   RPC_URL=http://127.0.0.1:8545
#   ELECTION_ADDRESS=<printed by deploy>
#   RELAYER_PRIVATE_KEY=<"Account #0" private key printed by `hardhat node`>
#   AUTH_SECRET=<any 32+ character string>
#   VOTER_ROSTER="enrollment,email;22BCS001,alice@college.edu;22BCS002,bob@college.edu"
npm run dev
```

Without `RESEND_API_KEY`, the register page shows the sign-up link on screen instead of emailing it, so you can click through the whole flow. Move between phases with:

```bash
ACTION=start npx hardhat run scripts/phase.ts --network localhost   # open voting
ACTION=end   npx hardhat run scripts/phase.ts --network localhost   # close voting and publish results
ACTION=status npx hardhat run scripts/phase.ts --network localhost
```

Contract tests: `cd contracts && npm test` (downloads the zero-knowledge circuit files on first run).

## Deploy for the real election

1. **Organiser wallet.** Create a fresh wallet (e.g. in MetaMask) used only for this election. Fund it with a little ETH on **Base Sepolia** (free from a faucet) or **Base mainnet** (a few dollars covers hundreds of votes). This wallet deploys the contract, registers voters and pays for votes.
2. **Deploy the contract:**
   ```bash
   cd contracts
   cp .env.example .env        # set DEPLOYER_PRIVATE_KEY, ELECTION_TITLE, CANDIDATES
   npx hardhat run scripts/deploy.ts --network baseSepolia   # or --network base
   ```
3. **Email sending.** Create a free [Resend](https://resend.com) account, verify a domain you own (or use their test sender while trying it out) and get an API key.
4. **Host the web app on Vercel** (free): import this GitHub repo, set the root directory to `web`, and add the variables from `web/.env.example`:
   `RPC_URL`, `ELECTION_ADDRESS`, `RELAYER_PRIVATE_KEY`, `VOTER_ROSTER`, `AUTH_SECRET`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`.
5. **Voter roster.** Ask the election committee for a CSV of eligible students with two columns, `enrollment,email`, and paste it into `VOTER_ROSTER`. Keep it out of git. Without a roster the app falls back to `ALLOWED_EMAIL_DOMAINS`, where anyone with a college address can register with their email.

## Why enrollment numbers alone aren't enough

Enrollment numbers are sequential, so anyone can guess a classmate's. If typing a number were enough to register, someone could register (and vote) in a classmate's place. So the number is only used to *look up* the student. The sign-up link always goes to the college email the roster has for that number, and only someone who can open that inbox can finish registering.

- Typing someone else's number just sends a link to *their* inbox. The email tells them what happened, and they can still use it to register themselves.
- Each enrollment number can register once. The contract stores a keyed hash of it, so outsiders can't hash sequential numbers to see who has registered.
- If a student sees "already registered" and it wasn't them, their college email has been compromised or someone had access to their device. They should tell the committee immediately. Because votes are anonymous, a stolen registration can't be traced to its vote afterwards, so the committee should treat this as a reason to rerun the election if the margin is close.

## Rolling it out

1. Get the election committee's agreement first: the result only counts if they accept it. Show them this README and a mock run.
2. Get the official `enrollment,email` roster from them.
3. Do a mock election with 5 to 10 friends on Base Sepolia.
4. Deploy a fresh contract for the real election and announce the link with the dates.
5. **Registration window** (1 to 2 days): students register on the device they'll vote from. Remind them to download their backup key.
6. `ACTION=start`: **voting window** (1 day). Keep it at least a few hours so many people vote at overlapping times.
7. `ACTION=end`: results appear on `/results`. Share the contract address so anyone can check it on [basescan](https://sepolia.basescan.org).

## What is and isn't private

Protected:
- No one can link a vote to a person, enrollment number or email: votes are zero-knowledge proofs, and enrollment numbers are only stored on-chain as keyed hashes.
- One vote per registered student, enforced by the contract.
- The count is public and can't be changed after the fact.

Things to be aware of:
- **Same server for sign-up and voting.** The app never logs who calls it, but a host's access logs could in principle match a sign-up and a vote by IP address and time. Separate registration and voting windows, voting on college Wi-Fi (shared IPs), and not keeping hosting logs all make this impractical. Only the organiser has access to those logs.
- **Live counts.** The page hides results until voting ends, but a determined person can read the contract storage during voting. With few votes, "my friend just voted and B's count went up" is possible. A long voting window makes this meaningless.
- **Organiser trust.** The organiser wallet could register fake voters. The home page shows the number of registered voters; compare it with the real class size. The on-chain list of registrations is public.
- **Lost key.** A student who clears their browser without saving the backup key can't vote, and can't re-register with the same email (that's what stops double voting).
- **Key sharing.** Like any remote election, a student can hand their key to someone else.
