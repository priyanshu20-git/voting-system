import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    // Voters' browsers never talk to the chain directly; the server reads it and relays votes.
    poweredByHeader: false
}

export default nextConfig
