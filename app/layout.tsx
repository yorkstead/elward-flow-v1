import type { Metadata } from 'next'
import { OfflineStatus } from '@/components/offline-status'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Elward Flow', template: '%s · Elward Flow' },
  description:
    'Operational source of truth from release intake through shipment.',
  applicationName: 'Elward Flow',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Elward Flow',
    statusBarStyle: 'default',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <OfflineStatus />
        {children}
      </body>
    </html>
  )
}
