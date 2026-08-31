import type { Metadata, Viewport } from 'next'
import { Open_Sans, Roboto_Condensed } from 'next/font/google'
import { OfflineStatus } from '@/components/offline-status'
import { AppLaunchGate } from '@/components/brand/app-launch-gate'
import {
  ThemeProvider,
  THEME_INIT_SCRIPT,
} from '@/components/theme/theme-provider'
import './globals.css'

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
})

const robotoCondensed = Roboto_Condensed({
  subsets: ['latin'],
  variable: '--font-flow-heading',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Ellwood Flow', template: '%s · Ellwood Flow' },
  description:
    'Ellwood Systems operational control from release intake through shipment.',
  applicationName: 'Ellwood Flow',
  manifest: '/manifest.webmanifest',
  category: 'business',
  creator: 'Ellwood Systems Corporation',
  publisher: 'Ellwood Systems Corporation',
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    title: 'Ellwood Flow',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1B334F' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1725' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${openSans.variable} ${robotoCondensed.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full w-full max-w-full flex-col overflow-x-hidden font-sans">
        <ThemeProvider defaultTheme="system">
          <AppLaunchGate />
          <OfflineStatus />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
