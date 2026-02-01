'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, CartItem } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react'

// Function to generate a unique order reference
const generateOrderReference = () => {
  const datePart = Date.now().toString().slice(-6);
  const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `ORD-${datePart}-${randomPart}`;
}

export default function CartPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
    } else {
      setUser(user)
      loadCart(user.id)
    }
  }

  const loadCart = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('cart')
        .select(`
          *,
          products (*)
        `)
        .eq('user_id', userId)

      if (error) throw error
      setCartItems(data || [])
    } catch (error) {
      console.error('Error loading cart:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    try {
      const { error } = await supabase
        .from('cart')
        .update({ quantity: newQuantity })
        .eq('id', itemId)

      if (error) throw error
      if (user) loadCart(user.id)
    } catch (error) {
      console.error('Error updating quantity:', error)
    }
  }

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('cart')
        .delete()
        .eq('id', itemId)

      if (error) throw error
      if (user) loadCart(user.id)
    } catch (error) {
      console.error('Error removing item:', error)
    }
  }

  const calculateItemPrice = (item: CartItem) => {
    if (!item.products) return 0
    const price = item.products.has_promotion
      ? item.products.price * (1 - item.products.promotion_percentage / 100)
      : item.products.price
    return price * item.quantity
  }

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + calculateItemPrice(item), 0)
  }

  const handleCheckout = async () => {
    if (cartItems.length === 0 || !user) return

    try {
      // Generate unique reference code
      const referenceCode = generateOrderReference();

      // 1. Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          total_amount: calculateTotal(),
          status: 'pending',
          reference_code: referenceCode
        })
        .select()
        .single()

      if (orderError) {
        console.error("❌ Error Step 1 (Create Order):", orderError);
        throw orderError;
      }

      // 2. Create order items
      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.products?.name || '',
        quantity: item.quantity,
        unit_price: item.products?.price || 0,
        promotion_applied: item.products?.has_promotion || false,
        discount_percentage: item.products?.promotion_percentage || 0,
        subtotal: calculateItemPrice(item)
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        console.error("❌ Error Step 2 (Insert Items):", itemsError);
        throw itemsError;
      }

      // 3. Clear cart
      const { error: clearError } = await supabase
        .from('cart')
        .delete()
        .eq('user_id', user.id)

      if (clearError) {
        console.error("❌ Error Step 3 (Clear Cart):", clearError);
        throw clearError;
      }

      // --- AUTOMATICALLY SEND REFERENCE CODE TO CHAT START ---
      try {
        // A. Find existing conversation or create new one
        let conversationId = null;

        const { data: existingConv } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          const { data: newConv } = await supabase
            .from('chat_conversations')
            .insert({
              user_id: user.id,
              status: 'active',
              last_message_at: new Date().toISOString()
            })
            .select('id')
            .single()
          
          if (newConv) conversationId = newConv.id;
        }

        // B. Send the message with the reference code
        if (conversationId) {
          await supabase
            .from('chat_messages')
            .insert({
              conversation_id: conversationId,
              sender_id: user.id,
              message_type: 'text',
              content: `Hello, I just placed a new order. Here is my Reference Code: ${order.reference_code}`,
              is_read: false
            })

          // Update conversation timestamp
          await supabase
            .from('chat_conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId)
        }
      } catch (chatError) {
        console.error("Auto-send to chat failed (non-critical):", chatError);
      }
      // --- AUTOMATICALLY SEND REFERENCE CODE TO CHAT END ---

      alert(`Order created successfully!\n\nReference Code: ${order.reference_code}\n\nThis code has been automatically sent to the support chat. Redirecting you there now...`)
      router.push('/chat')

    } catch (error: any) {
      console.error('🔴 CRITICAL CHECKOUT ERROR:', error)
      console.error('👉 Error Message:', error.message)
      console.error('👉 Error Details:', error.details)
      console.error('👉 Error Hint:', error.hint)
      console.error('👉 Error Code:', error.code)

      alert(`Failed to create order. Reason: ${error.message || "Please try again."}`)
    }
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />

      <div className="container mx-auto px-4 py-8">
        <h1 className={`text-4xl font-bold mb-8 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Shopping Cart
        </h1>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : cartItems.length === 0 ? (
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-12 text-center`}>
            <ShoppingBag className={`mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} size={64} />
            <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Your cart is empty
            </h2>
            <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
              Start shopping to add items to your cart
            </p>
            <button
              onClick={() => router.push('/products')}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <span>Browse Products</span>
              <ArrowRight size={20} />
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => {
                if (!item.products) return null
                
                const finalPrice = item.products.has_promotion
                  ? item.products.price * (1 - item.products.promotion_percentage / 100)
                  : item.products.price

                return (
                  <div 
                    key={item.id}
                    className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-lg`}
                  >
                    <div className="flex items-center space-x-4">
                      <img 
                        src={item.products.main_image_url} 
                        alt={item.products.name}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h3 className={`text-xl font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {item.products.name}
                        </h3>
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                          {item.products.description}
                        </p>
                        <div className="flex items-center space-x-2">
                          {item.products.has_promotion && (
                            <span className="text-gray-400 line-through text-sm">
                              ${item.products.price.toFixed(2)}
                            </span>
                          )}
                          <span className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            ${finalPrice.toFixed(2)}
                          </span>
                          {item.products.has_promotion && (
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">
                              -{item.products.promotion_percentage}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className={`p-2 ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded-lg transition`}
                        >
                          <Minus size={20} />
                        </button>
                        <span className={`text-xl font-bold w-12 text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className={`p-2 ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded-lg transition`}
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                    <div className={`mt-4 pt-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} flex justify-between items-center`}>
                      <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Subtotal:</span>
                      <span className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        ${calculateItemPrice(item).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Order Summary */}
            <div>
              <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-lg sticky top-24`}>
                <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Order Summary
                </h2>
                
                <div className="space-y-3 mb-6">
                  <div className={`flex justify-between ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span>Items ({cartItems.reduce((sum, item) => sum + item.quantity, 0)}):</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span>Shipping:</span>
                    <span className="text-green-600 font-semibold">FREE</span>
                  </div>
                  <div className={`pt-3 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} flex justify-between text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    <span>Total:</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition font-bold text-lg flex items-center justify-center space-x-2"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={20} />
                </button>

                <p className={`text-xs text-center mt-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  You will receive a reference code to send to our support team
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}