'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, Product } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { 
  Package, MessageCircle, TrendingUp, Shield, 
  Clock, Star, ArrowRight, ShoppingCart, LogIn 
} from 'lucide-react'
import Link from 'next/link'

const ModernLandingPage = () => {
  const { theme } = useTheme()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    loadRealProducts()
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const loadRealProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .limit(4) // Show top 4 for the landing page
      
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const features = [
    { icon: Package, title: 'Quality Products', desc: 'Certified medications and laboratory-tested supplements.' },
    { icon: MessageCircle, title: 'Expert Support', desc: 'Direct access to pharmaceutical guidance and support.' },
    { icon: TrendingUp, title: 'Global Standards', desc: 'Compliance with international health and safety protocols.' },
    { icon: Shield, title: 'Secure Access', desc: 'Advanced encryption for your medical data and transactions.' },
    { icon: Clock, title: 'Rapid Logistics', desc: 'Priority processing for all time-sensitive orders.' },
    { icon: Star, title: 'Premium Care', desc: 'A legacy of excellence in specialized biolab services.' },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  }

  return (
    <div className={`relative min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} overflow-x-hidden`}>
      <Header />

      {/* BACKGROUND LOGO WATERMARK */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden flex items-center justify-center">
        <motion.img 
          src="/favicon.ico" 
          alt="Watermark"
          className="w-[800px] h-[800px] opacity-[0.03] dark:opacity-[0.05] grayscale"
          animate={{
            rotate: [0, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.15) 0%, transparent 40%)`,
          }}
        />
      </div>

      {/* HERO SECTION */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-20">
        <div className="container mx-auto px-4 py-20 relative z-10">
          <motion.div 
            className="text-center max-w-5xl mx-auto"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="flex justify-center mb-6">
              <span className="px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-sm font-bold tracking-widest uppercase">
                Next-Gen Pharmaceutical Hub
              </span>
            </motion.div>

            <motion.h1 
              className="text-6xl md:text-8xl font-black mb-8 tracking-tighter"
              variants={itemVariants}
            >
              Vertex <span className="text-blue-600">Biolabs</span>
            </motion.h1>

            <motion.p 
              className={`text-xl ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-12 max-w-2xl mx-auto`}
              variants={itemVariants}
            >
              Access premium laboratory products and medical supplies with the security of blockchain-grade verification.
            </motion.p>

            <motion.div className="flex flex-col sm:flex-row gap-6 justify-center" variants={itemVariants}>
              <button
                onClick={handleGoogleSignIn}
                className="flex items-center justify-center gap-3 px-8 py-4 bg-white text-black rounded-xl font-bold shadow-xl hover:bg-gray-100 transition-all transform hover:-translate-y-1"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                Sign in with Google
              </button>
              <Link
                href="/products"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all transform hover:-translate-y-1 shadow-lg shadow-blue-500/25"
              >
                Browse Products <ArrowRight size={20} />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES - BENTO GRID */}
      <section className="py-24 bg-black/5 dark:bg-white/5">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`p-8 rounded-2xl border ${theme === 'dark' ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'} backdrop-blur-sm hover:border-blue-500/50 transition-colors group`}
              >
                <f.icon className="w-12 h-12 text-blue-500 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-4">{f.title}</h3>
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* REAL PRODUCTS SECTION */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-4xl font-bold mb-4">Current Availability</h2>
              <p className="text-blue-500 font-medium">Real-time inventory from our biolabs</p>
            </div>
            <Link href="/products" className="text-blue-500 hover:underline flex items-center gap-2">
              View All <ArrowRight size={16}/>
            </Link>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-80 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-2xl" />
              ))
            ) : (
              products.map((product) => (
                <motion.div 
                  key={product.id}
                  whileHover={{ y: -10 }}
                  className={`rounded-2xl overflow-hidden border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-lg`}
                >
                  <img src={product.main_image_url} alt={product.name} className="w-full h-48 object-cover" />
                  <div className="p-6">
                    <h3 className="font-bold text-lg mb-2 truncate">{product.name}</h3>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-blue-500 font-bold text-xl">${product.price}</span>
                      {product.stock_quantity > 0 ? (
                        <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded">In Stock</span>
                      ) : (
                        <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded">Out of Stock</span>
                      )}
                    </div>
                    <button 
                      onClick={handleGoogleSignIn}
                      className="w-full py-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      <LogIn size={16} /> Sign in to Buy
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

export default ModernLandingPage