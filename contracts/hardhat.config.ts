import "@nomicfoundation/hardhat-toolbox"
import "@semaphore-protocol/hardhat"
import "dotenv/config"
import { HardhatUserConfig } from "hardhat/config"

const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 200 } }
    },
    networks: {
        baseSepolia: {
            url: process.env.RPC_URL || "https://sepolia.base.org",
            chainId: 84532,
            accounts
        },
        base: {
            url: process.env.RPC_URL || "https://mainnet.base.org",
            chainId: 8453,
            accounts
        }
    },
    mocha: { timeout: 180000 }
}

export default config
