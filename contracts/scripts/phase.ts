import fs from "fs"
import { ethers, network } from "hardhat"

// Usage: ACTION=start|end|status npx hardhat run scripts/phase.ts --network baseSepolia
const PHASES = ["Registration", "Voting", "Ended"]

async function main() {
    const address = process.env.ELECTION_ADDRESS || JSON.parse(fs.readFileSync(`deployments/${network.name}.json`, "utf8")).address
    const election = await ethers.getContractAt("Election", address)
    const action = process.env.ACTION || "status"

    if (action === "start") await (await election.startVoting()).wait()
    else if (action === "end") await (await election.endVoting()).wait()
    else if (action !== "status") throw new Error(`Unknown ACTION "${action}"`)

    const phase = Number(await election.phase())
    console.info(`Phase: ${PHASES[phase]}`)
    console.info(`Registered voters: ${await election.voterCount()}`)
    console.info(`Votes cast: ${await election.totalVotes()}`)
    if (phase === 2) {
        const names = await election.getCandidates()
        const results = await election.getResults()
        names.forEach((name, i) => console.info(`  ${name}: ${results[i]}`))
    }
}

main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
