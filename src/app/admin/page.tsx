'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Order } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
// J'ai ajouté l'icône 'X' ici
import { Users, Package, MessageCircle, TrendingUp, Clock, Check, DollarSign, ShoppingBag, X } from 'lucide-react'

export default function AdminDashboard() {
  const { theme } = useTheme()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    totalRevenue: 0,
    unreadMessages: 0
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      router.push('/home')
      return
    }

    setUser(user)
    setIsAdmin(true)
    loadStats()
    loadRecentOrders()
  }

  const loadStats = async () => {
    try {
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')

      const { data: confirmedOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'confirmed')

      const totalRevenue = confirmedOrders?.reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0) || 0

      const { count: unreadCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)

      setStats({
        totalUsers: usersCount || 0,
        totalProducts: productsCount || 0,
        pendingOrders: pendingOrders?.length || 0,
        confirmedOrders: confirmedOrders?.length || 0,
        totalRevenue,
        unreadMessages: unreadCount || 0
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRecentOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setRecentOrders(data || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    }
  }

  const confirmOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id
        })
        .eq('id', orderId)

      if (error) throw error

      alert('Order confirmed successfully!')
      loadStats()
      loadRecentOrders()
    } catch (error) {
      console.error('Error confirming order:', error)
      alert('Failed to confirm order')
    }
  }

  // --- NOUVELLE FONCTION AJOUTÉE ---
  const cancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)

      if (error) throw error

      alert('Order cancelled successfully!')
      loadStats()
      loadRecentOrders()
    } catch (error) {
      console.error('Error cancelling order:', error)
      alert('Failed to cancel order')
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className={`text-4xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Admin Dashboard
          </h1>
          <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mt-2`}>
            Manage your e-commerce platform
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-lg hover:shadow-xl transition`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total Users</p>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {stats.totalUsers}
                </p>
              </div>
              <Users className="text-blue-600" size={48} />
            </div>
          </div>

          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-lg hover:shadow-xl transition`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total Products</p>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {stats.totalProducts}
                </p>
              </div>
              <Package className="text-green-600" size={48} />
            </div>
          </div>

          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-lg hover:shadow-xl transition`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Pending Orders</p>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {stats.pendingOrders}
                </p>
              </div>
              <Clock className="text-yellow-600" size={48} />
            </div>
          </div>

          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-lg hover:shadow-xl transition`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total Revenue</p>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  ${stats.totalRevenue.toFixed(2)}
                </p>
              </div>
              <DollarSign className="text-purple-600" size={48} />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Link
            href="/admin/products"
            className={`${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} p-6 rounded-xl shadow-lg transition transform hover:-translate-y-1`}
          >
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-blue-100 rounded-lg">
                <Package className="text-blue-600" size={32} />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Manage Products
                </h3>
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Add, edit, or remove products
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/admin/orders"
            className={`${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} p-6 rounded-xl shadow-lg transition transform hover:-translate-y-1`}
          >
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-green-100 rounded-lg">
                <ShoppingBag className="text-green-600" size={32} />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  View Orders
                </h3>
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Process and confirm orders
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/admin/chat"
            className={`${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} p-6 rounded-xl shadow-lg transition transform hover:-translate-y-1 relative`}
          >
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-purple-100 rounded-lg">
                <MessageCircle className="text-purple-600" size={32} />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Customer Chat
                </h3>
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Respond to customer messages
                </p>
              </div>
            </div>
            {stats.unreadMessages > 0 && (
              <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                {stats.unreadMessages}
              </div>
            )}
          </Link>
        </div>

        {/* Recent Orders */}
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-6`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Recent Orders
            </h2>
            <Link href="/admin/orders" className="text-blue-600 hover:text-blue-700 font-semibold">
              View All
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <p className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              No orders yet
            </p>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div 
                  key={order.id}
                  className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'} p-4 rounded-lg flex items-center justify-between`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {order.reference_code}
                      </p>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'pending' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : order.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                      Total: ${parseFloat(order.total_amount.toString()).toFixed(2)} • {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {order.status === 'pending' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => confirmOrder(order.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center space-x-2"
                      >
                        <Check size={18} />
                        <span>Confirm</span>
                      </button>
                      
                      {/* BOUTON D'ANNULATION AJOUTÉ ICI */}
                      <button
                        onClick={() => cancelOrder(order.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center space-x-2"
                      >
                        <X size={18} />
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}