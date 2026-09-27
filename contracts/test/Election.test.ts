import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { Group, Identity, generateProof as semaphoreProof } from "@semaphore-protocol/core"
import { expect } from "chai"
import { ethers, run } from "hardhat"

// Proof artifacts are downloaded from snark-artifacts.pse.dev by default.
// Set SEMAPHORE_ARTIFACTS_DIR to a local folder (e.g. from @zk-kit/semaphore-artifacts) to work offline.
const generateProof = (identity: Identity, group: Group, message: number, scope: bigint) => {
    const dir = process.env.SEMAPHORE_ARTIFACTS_DIR
    const depth = Math.max(group.depth, 1)
    return semaphoreProof(
        identity,
        group,
        message,
        scope,
        depth,
        dir ? { wasm: `${dir}/semaphore-${depth}.wasm`, zkey: `${dir}/semaphore-${depth}.zkey` } : undefined
    )
}

const emailHash = (email: string) => ethers.keccak256(ethers.toUtf8Bytes(email))

describe("Election", () => {
    async function deployFixture() {
        const { semaphore } = await run("deploy:semaphore", { logs: false })
        const Election = await ethers.getContractFactory("Election")
        const election = await Election.deploy(await semaphore.getAddress(), "Internship Coordinator 2026", [
            "Alice",
            "Bob"
        ])
        const [organiser, stranger] = await ethers.getSigners()
        const groupId = await election.groupId()
        const identities = [new Identity(), new Identity(), new Identity()]

        return { election, organiser, stranger, groupId, identities }
    }

    async function votingFixture() {
        const ctx = await deployFixture()
        const { election, identities } = ctx
        for (const [i, id] of identities.entries()) {
            await election.registerVoter(id.commitment, emailHash(`student${i}@college.edu`))
        }
        await election.startVoting()
        const group = new Group(identities.map((id) => id.commitment))
        return { ...ctx, group }
    }

    describe("registration", () => {
        it("registers voters and exposes their commitments", async () => {
            const { election, identities } = await loadFixture(deployFixture)
            await expect(election.registerVoter(identities[0].commitment, emailHash("a@college.edu")))
                .to.emit(election, "VoterRegistered")
                .withArgs(identities[0].commitment)
            expect(await election.getVoters()).to.deep.equal([identities[0].commitment])
        })

        it("rejects the same email twice", async () => {
            const { election, identities } = await loadFixture(deployFixture)
            await election.registerVoter(identities[0].commitment, emailHash("a@college.edu"))
            await expect(
                election.registerVoter(identities[1].commitment, emailHash("a@college.edu"))
            ).to.be.revertedWithCustomError(election, "EmailAlreadyRegistered")
        })

        it("only lets the organiser register voters and change phase", async () => {
            const { election, stranger, identities } = await loadFixture(deployFixture)
            await expect(
                election.connect(stranger).registerVoter(identities[0].commitment, emailHash("a@college.edu"))
            ).to.be.revertedWithCustomError(election, "NotOrganiser")
            await expect(election.connect(stranger).startVoting()).to.be.revertedWithCustomError(
                election,
                "NotOrganiser"
            )
        })

        it("closes registration once voting starts", async () => {
            const { election, identities } = await loadFixture(votingFixture)
            await expect(
                election.registerVoter(new Identity().commitment, emailHash("late@college.edu"))
            ).to.be.revertedWithCustomError(election, "WrongPhase")
            expect(identities.length).to.equal(3)
        })
    })

    describe("voting", () => {
        it("counts an anonymous vote submitted by anyone", async () => {
            const { election, stranger, identities, group, groupId } = await loadFixture(votingFixture)
            const proof = await generateProof(identities[0], group, 1, groupId)

            await expect(election.connect(stranger).castVote(proof))
                .to.emit(election, "VoteCast")
                .withArgs(proof.nullifier)
            expect(await election.totalVotes()).to.equal(1)
        })

        it("rejects a second vote from the same identity", async () => {
            const { election, identities, group, groupId } = await loadFixture(votingFixture)
            await election.castVote(await generateProof(identities[0], group, 0, groupId))
            const again = await generateProof(identities[0], group, 1, groupId)

            await expect(election.castVote(again)).to.be.revertedWithCustomError(
                await ethers.getContractAt("ISemaphore", await election.semaphore()),
                "Semaphore__YouAreUsingTheSameNullifierTwice"
            )
        })

        it("rejects a non-member", async () => {
            const { election, identities, groupId } = await loadFixture(votingFixture)
            const outsider = new Identity()
            const fakeGroup = new Group([...identities.map((id) => id.commitment), outsider.commitment])
            const proof = await generateProof(outsider, fakeGroup, 0, groupId)

            await expect(election.castVote(proof)).to.be.revertedWithCustomError(
                await ethers.getContractAt("ISemaphore", await election.semaphore()),
                "Semaphore__MerkleTreeRootIsNotPartOfTheGroup"
            )
        })

        it("rejects an unknown candidate or a proof for another scope", async () => {
            const { election, identities, group, groupId } = await loadFixture(votingFixture)
            await expect(
                election.castVote(await generateProof(identities[0], group, 2, groupId))
            ).to.be.revertedWithCustomError(election, "InvalidCandidate")
            await expect(
                election.castVote(await generateProof(identities[0], group, 0, groupId + 1n))
            ).to.be.revertedWithCustomError(election, "InvalidScope")
        })

        it("hides results until voting ends, then publishes the tally", async () => {
            const { election, identities, group, groupId } = await loadFixture(votingFixture)
            await election.castVote(await generateProof(identities[0], group, 0, groupId))
            await election.castVote(await generateProof(identities[1], group, 1, groupId))
            await election.castVote(await generateProof(identities[2], group, 1, groupId))

            await expect(election.getResults()).to.be.revertedWithCustomError(election, "ResultsNotPublished")
            await election.endVoting()
            expect(await election.getResults()).to.deep.equal([1n, 2n])

            await expect(
                election.castVote(await generateProof(identities[0], group, 0, groupId))
            ).to.be.revertedWithCustomError(election, "WrongPhase")
        })
    })
})
