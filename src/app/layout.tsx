import './globals.css'
import { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

// Utilisation du type Metadata pour une meilleure autocomplétion et validation
export const metadata: Metadata = {
  title: 'Alluvi - Quality Pharmaceutical Products',
  description: 'Alluvi develops and evaluates premium peptides and supplements',
  icons: { 
    icon: '/favicon.ico' 
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        {/* ThemeProvider configuré pour correspondre à l'utilisation de class (dark:...) 
          dans Tailwind et éviter les flashs de couleur au chargement.
        */}
        <ThemeProvider 
          attribute="class" 
          defaultTheme="system" 
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
