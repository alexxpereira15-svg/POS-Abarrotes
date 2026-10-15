import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Navbar from '@/components/shared/Navbar'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Abarrotes el niño',
  description: 'Sistema POS Beta 1.0',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-100 min-h-screen text-gray-900`}>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
