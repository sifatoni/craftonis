import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Craftonis — HR Intelligence Platform',
  description: 'Hire Smart. Manage Better. Grow Faster.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  )
}
