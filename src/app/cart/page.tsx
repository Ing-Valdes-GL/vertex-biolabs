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

      if (orderError) throw orderError;

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

      if (itemsError) throw itemsError;

      // 3. Clear cart
      await supabase.from('cart').delete().eq('user_id', user.id)

      // --- AUTO-SEND TO CHAT ---
      try {
        let conversationId = null;
        const { data: existingConv } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          const { data: newConv } = await supabase
            .from('chat_conversations')
            .insert({ user_id: user.id, status: 'active' })
            .select('id').single()
          if (newConv) conversationId = newConv.id;
        }

        if (conversationId) {
          await supabase.from('chat_messages').insert({
            conversation_id: conversationId,
            sender_id: user.id,
            message_type: 'text',
            content: `Hello, I just placed a new order. Reference Code: ${order.reference_code}`
          })
        }
      } catch (e) { console.error(e) }

      alert(`Order created! Reference: ${order.reference_code}`)
      router.push('/chat')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
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
          <div className="text-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div>
        ) : cartItems.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
            <button onClick={() => router.push('/products')} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Browse Products</button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => {
                if (!item.products) return null
                const finalPrice = item.products.has_promotion
                  ? item.products.price * (1 - item.products.promotion_percentage / 100)
                  : item.products.price

                return (
                  <div key={item.id} className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-lg`}>
                    <div className="flex items-center space-x-4">
                      <img src={item.products.main_image_url} alt={item.products.name} className="w-24 h-24 object-cover rounded-lg" />
                      <div className="flex-1">
                        <h3 className="font-bold">{item.products.name}</h3>
                        <div className="flex items-center space-x-2">
                          {item.products.has_promotion && (
                            <span className="text-gray-400 line-through text-sm">£{item.products.price.toFixed(2)}</span>
                          )}
                          <span className="font-bold">£{finalPrice.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2 bg-gray-100 rounded">-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 bg-gray-100 rounded">+</button>
                        <button onClick={() => removeItem(item.id)} className="text-red-500"><Trash2 size={20}/></button>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-bold">£{calculateItemPrice(item).toFixed(2)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-lg h-fit`}>
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>
              <div className="flex justify-between mb-2">
                <span>Total:</span>
                <span className="text-2xl font-bold">£{calculateTotal().toFixed(2)}</span>
              </div>
              <button onClick={handleCheckout} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
