import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Profile {
  id: string
  email: string
  full_name: string | null
  is_admin: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  has_promotion: boolean
  promotion_percentage: number
  main_image_url: string
  secondary_image_1_url: string | null
  secondary_image_2_url: string | null
  stock_quantity: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  user_id: string
  reference_code: string
  total_amount: number
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
  confirmed_at: string | null
  confirmed_by: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  promotion_applied: boolean
  discount_percentage: number
  subtotal: number
  created_at: string
}

export interface CartItem {
  id: string
  user_id: string
  product_id: string
  quantity: number
  created_at: string
  updated_at: string
  products?: Product
}

export interface ChatConversation {
  id: string
  user_id: string
  admin_id: string | null
  status: 'active' | 'closed'
  last_message_at: string
  created_at: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  message_type: 'text' | 'image' | 'voice'
  content: string | null
  file_url: string | null
  is_read: boolean
  created_at: string
  
}