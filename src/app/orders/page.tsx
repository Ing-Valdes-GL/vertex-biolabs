'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Package, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, ShoppingBag, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export default function ClientOrdersPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  useEffect(() => {
    checkUserAndLoadOrders()
  }, [])

  const checkUserAndLoadOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    try {
      // On récupère la commande ET les articles ET les infos produits liées
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            price_at_time,
            products (
              name,
              main_image_url
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleOrder = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-green-500 bg-green-500/10 border-green-500/20'
      case 'cancelled': return 'text-red-500 bg-red-500/10 border-red-500/20'
      default: return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle size={16} />
      case 'cancelled': return <XCircle size={16} />
      default: return <Clock size={16} />
    }
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <Header />

      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
            <Package size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">My Orders</h1>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
              Track and manage your purchase history
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-24 rounded-xl animate-pulse ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className={`text-center py-20 rounded-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <ShoppingBag size={64} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold mb-2">No orders yet</h2>
            <p className="text-gray-500 mb-6">Looks like you haven't made any purchases yet.</p>
            <Link 
              href="/products" 
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-2"
            >
              Browse Products <ExternalLink size={18} />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <motion.div 
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl overflow-hidden border transition-all ${
                  theme === 'dark' 
                    ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
                    : 'bg-white border-gray-200 hover:border-blue-300'
                } shadow-sm hover:shadow-md`}
              >
                {/* Order Header (Clickable) */}
                <div 
                  onClick={() => toggleOrder(order.id)}
                  className="p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm text-gray-500">#{order.reference_code}</span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Placed on {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6">
                    <div className="text-right">
                      <span className="block text-xs text-gray-500">Total Amount</span>
                      <span className="text-xl font-bold text-blue-500">£{order.total_amount.toFixed(2)}</span>
                    </div>
                    <div className={`p-2 rounded-full ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      {expandedOrder === order.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Order Details (Expandable) */}
                <AnimatePresence>
                  {expandedOrder === order.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className={`border-t ${theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'}`}
                    >
                      <div className="p-6">
                        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-gray-500">Order Items</h3>
                        <div className="space-y-4">
                          {order.order_items?.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                                <img 
                                  src={item.products?.main_image_url} 
                                  alt={item.products?.name} 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1">
                                <h4 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {item.products?.name || 'Unknown Product'}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  Qty: {item.quantity} × £{item.price_at_time.toFixed(2)}
                                </p>
                              </div>
                              <div className="font-bold">
                                ${(item.quantity * item.price_at_time).toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Footer info (Shipping, etc could go here) */}
                        <div className="mt-6 pt-4 border-t border-dashed border-gray-500/20 text-xs text-gray-500 text-center">
                           Thank you for shopping with Alluvi
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
