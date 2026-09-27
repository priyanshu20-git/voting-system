# Anonymous College Voting

A web app for student elections where every eligible student votes **once**, **nobody can see who voted for whom** (not the organisers, not the candidates), and **anyone can verify the final count** on the blockchain.

Voters need no crypto wallet and pay nothing. They sign up with their college email and vote from their phone or laptop.

## How it works

1. **Register:** a student enters their college email and gets a sign-up link. Opening it creates a secret voter key *inside their browser*. Only a public fingerprint of that key (a Semaphore identity commitment) is added to the on-chain voter list. The email is only used to check eligibility and to stop anyone registering twice.
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
#   ALLOWED_EMAIL_DOMAINS=college.edu
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
   `RPC_URL`, `ELECTION_ADDRESS`, `RELAYER_PRIVATE_KEY`, `ALLOWED_EMAIL_DOMAINS` (or `VOTER_ALLOWLIST`), `AUTH_SECRET`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`.
5. **Eligibility.** Best: get the official voter list from the election committee and put it in `VOTER_ALLOWLIST`. Otherwise `ALLOWED_EMAIL_DOMAINS` lets anyone with a college address register.

## Rolling it out

1. Get the election committee's agreement first: the result only counts if they accept it. Show them this README and a mock run.
2. Do a mock election with 5 to 10 friends on Base Sepolia.
3. Deploy a fresh contract for the real election and announce the link with the dates.
4. **Registration window** (1 to 2 days): students register on the device they'll vote from. Remind them to download their backup key.
5. `ACTION=start`: **voting window** (1 day). Keep it at least a few hours so many people vote at overlapping times.
6. `ACTION=end`: results appear on `/results`. Share the contract address so anyone can check it on [basescan](https://sepolia.basescan.org).

## What is and isn't private

Protected:
- No one can link a vote to a person or email: votes are zero-knowledge proofs, and emails are only stored on-chain as keyed hashes.
- One vote per registered student, enforced by the contract.
- The count is public and can't be changed after the fact.

Things to be aware of:
- **Same server for sign-up and voting.** The app never logs who calls it, but a host's access logs could in principle match a sign-up and a vote by IP address and time. Separate registration and voting windows, voting on college Wi-Fi (shared IPs), and not keeping hosting logs all make this impractical. Only the organiser has access to those logs.
- **Live counts.** The page hides results until voting ends, but a determined person can read the contract storage during voting. With few votes, "my friend just voted and B's count went up" is possible. A long voting window makes this meaningless.
- **Organiser trust.** The organiser wallet could register fake voters. The home page shows the number of registered voters; compare it with the real class size. The on-chain list of registrations is public.
- **Lost key.** A student who clears their browser without saving the backup key can't vote, and can't re-register with the same email (that's what stops double voting).
- **Key sharing.** Like any remote election, a student can hand their key to someone else.
