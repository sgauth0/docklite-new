import type { Metadata } from 'next'
import './globals.css'
import ThemeInit from './theme-init'

export const metadata: Metadata = {
  title: 'DockLite - Docker Control Panel',
  description: 'Simple Docker-based web hosting control panel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeInit />
        {children}
      </body>
    </html>
  )
}
