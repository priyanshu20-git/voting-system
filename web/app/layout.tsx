import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"

export const metadata: Metadata = {
    title: "Anonymous College Vote",
    description: "One person, one vote, and nobody can see who voted for whom."
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <main>
                    <nav>
                        <Link href="/">Home</Link>
                        <Link href="/register">Register</Link>
                        <Link href="/vote">Vote</Link>
                        <Link href="/results">Results</Link>
                    </nav>
                    {children}
                </main>
            </body>
        </html>
    )
}
