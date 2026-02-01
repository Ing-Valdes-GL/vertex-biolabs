'use client'

import * as React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  attribute?: string    // Indispensable pour corriger ts(2322)
  enableSystem?: boolean // Indispensable pour corriger ts(2322)
}

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system',
  storageKey = 'theme-preference',
  attribute = 'class',
  enableSystem = true,
  ...props 
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)

  useEffect(() => {
    const root = window.document.documentElement
    
    // Récupérer le thème sauvegardé ou utiliser le défaut
    const savedTheme = localStorage.getItem(storageKey) as Theme | null
    const activeTheme = savedTheme || defaultTheme

    const applyTheme = (t: Theme) => {
      root.classList.remove('light', 'dark')
      
      if (t === 'system' && enableSystem) {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        root.classList.add(systemTheme)
      } else {
        root.classList.add(t)
      }
    }

    setTheme(activeTheme)
    applyTheme(activeTheme)
  }, [defaultTheme, storageKey, enableSystem])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme)
      setTheme(newTheme)
      
      // Application immédiate au DOM
      const root = window.document.documentElement
      root.classList.remove('light', 'dark')
      if (newTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        root.classList.add(systemTheme)
      } else {
        root.classList.add(newTheme)
      }
    },
    toggleTheme: () => {
      const nextTheme = theme === 'light' ? 'dark' : 'light'
      localStorage.setItem(storageKey, nextTheme)
      setTheme(nextTheme)
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(nextTheme)
    }
  }

  return (
    <ThemeContext.Provider value={value} {...props}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}