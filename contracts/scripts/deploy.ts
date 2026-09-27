import fs from "fs"
import { ethers, network, run } from "hardhat"

// Usage: ELECTION_TITLE="..." CANDIDATES="Alice,Bob" npx hardhat run scripts/deploy.ts --network baseSepolia
async function main() {
    const title = process.env.ELECTION_TITLE || "Internship Coordinator Election"
    const candidates = (process.env.CANDIDATES || "Candidate A,Candidate B")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)

    let semaphoreAddress = process.env.SEMAPHORE_ADDRESS
    if (!semaphoreAddress) {
        const { semaphore } = await run("deploy:semaphore", { logs: true })
        semaphoreAddress = await semaphore.getAddress()
    }

    const election = await (await ethers.getContractFactory("Election")).deploy(semaphoreAddress!, title, candidates)
    await election.waitForDeployment()
    const address = await election.getAddress()
    const deployBlock = (await election.deploymentTransaction()?.wait())?.blockNumber

    console.info(`Election "${title}" deployed to ${address} on ${network.name}`)
    console.info(`Candidates: ${candidates.join(", ")}`)
    console.info(`Set ELECTION_ADDRESS=${address} in the web app.`)

    fs.mkdirSync("deployments", { recursive: true })
    fs.writeFileSync(
        `deployments/${network.name}.json`,
        JSON.stringify({ address, semaphore: semaphoreAddress, title, candidates, deployBlock }, null, 2)
    )
}

main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
