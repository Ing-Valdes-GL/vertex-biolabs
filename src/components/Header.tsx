'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { ShoppingCart, Sun, Moon, Home, Package, MessageCircle, LogOut, Users, Menu, X, ClipboardList } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme } from './ThemeProvider'
import Image from 'next/image';

export default function Header() {
  const { theme, toggleTheme } = useTheme()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    getUser()
    getCartCount()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          checkAdmin(session.user.email!)
          getCartCount()
        } else {
          setUser(null)
          setIsAdmin(false)
          setCartCount(0)
        }
      }
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      checkAdmin(user.email!)
    }
  }

  const checkAdmin = async (email: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('email', email)
      .single()
    
    if (data) {
      setIsAdmin(data.is_admin)
    }
  }

  const getCartCount = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('cart')
        .select('*')
        .eq('user_id', user.id)
      
      if (data) {
        setCartCount(data.reduce((sum, item) => sum + item.quantity, 0))
      }
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className={`sticky top-0 z-50 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'} shadow-lg transition-all duration-300`}>
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
           <div className={`w-12 h-12 rounded-lg ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'} flex items-center justify-center shadow-lg transition-transform hover:scale-105`}>
              <Image 
                src="/favicon.ico" 
                alt="Logo" 
                width={24} 
                height={24} 
                className="object-contain"
              />
            </div>
            <span className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Vertex Biolabs
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link 
              href="/home" 
              className={`${pathname === '/home' ? 'text-blue-600' : theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-blue-600'} transition flex items-center space-x-2`}
            >
              <Home size={20} />
              <span>Home</span>
            </Link>
            <Link 
              href="/products" 
              className={`${pathname === '/products' ? 'text-blue-600' : theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-blue-600'} transition flex items-center space-x-2`}
            >
              <Package size={20} />
              <span>Products</span>
            </Link>

            {/* Link to Order History (Visible for logged-in non-admins) */}
            {user && !isAdmin && (
              <Link 
                href="/orders" 
                className={`${pathname === '/orders' ? 'text-blue-600' : theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-blue-600'} transition flex items-center space-x-2`}
              >
                <ClipboardList size={20} />
                <span>My Orders</span>
              </Link>
            )}

            {user && (
              <Link 
                href="/chat" 
                className={`${pathname === '/chat' ? 'text-blue-600' : theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-blue-600'} transition flex items-center space-x-2`}
              >
                <MessageCircle size={20} />
                <span>Support</span>
              </Link>
            )}
            
            {isAdmin && (
              <Link 
                href="/admin" 
                className={`${pathname === '/admin' ? 'text-blue-600' : theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-blue-600'} transition flex items-center space-x-2`}
              >
                <Users size={20} />
                <span>Admin</span>
              </Link>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            <button 
              onClick={toggleTheme} 
              className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800 text-yellow-400' : 'bg-gray-100 text-gray-700'} hover:scale-110 transition`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            {user && !isAdmin && (
              <Link href="/cart" className="relative p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                <ShoppingCart size={20} />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                    {cartCount}
                  </span>
                )}
              </Link>
            )}

            {user ? (
              <div className="hidden md:flex items-center space-x-3">
                <img 
                  src={user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full border-2 border-blue-500"
                />
                <button 
                  onClick={handleSignOut} 
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white transition`}
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <Link href="/login" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Login
              </Link>
            )}

            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="md:hidden"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className={`md:hidden mt-4 pb-4 space-y-3 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg p-4`}>
            <Link href="/home" className="block py-2">Home</Link>
            <Link href="/products" className="block py-2">Products</Link>
            {user && !isAdmin && <Link href="/orders" className="block py-2">My Orders</Link>}
            {user && <Link href="/chat" className="block py-2">Support</Link>}
            {isAdmin && <Link href="/admin" className="block py-2">Admin</Link>}
            {user && (
              <button onClick={handleSignOut} className="w-full text-left py-2 text-red-600">
                Logout
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}