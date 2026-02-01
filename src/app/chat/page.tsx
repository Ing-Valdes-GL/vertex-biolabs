'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, ChatMessage, ChatConversation } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Send, Image as ImageIcon, Mic, Paperclip, Check, CheckCheck } from 'lucide-react'

export default function ChatPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [conversation, setConversation] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false) // State for "Support is typing..."
  const [uploading, setUploading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user && conversation) {
      loadMessages()
      const unsubscribe = subscribeToRealtime()
      return () => {
        unsubscribe?.()
      }
    }
  }, [user, conversation])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
    } else {
      setUser(user)
      await loadOrCreateConversation(user.id)
    }
  }

  const loadOrCreateConversation = async (userId: string) => {
    try {
      // Fetch the most recent active conversation to ensure we don't get duplicates errors
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        setConversation(existing)
      } else {
        // Create new conversation if none exists
        const { data: newConv, error } = await supabase
          .from('chat_conversations')
          .insert({
            user_id: userId,
            status: 'active',
            last_message_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        setConversation(newConv)
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    if (!conversation) return

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const subscribeToRealtime = () => {
    if (!conversation || !user) return

    const channel = supabase.channel(`chat:${conversation.id}`)

    channel
      // 1. Listen for new messages (INSERT)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          // Avoid duplicate messages if optimistic UI was used (not the case here but good practice)
          setMessages((current) => {
            if (current.find(m => m.id === newMsg.id)) return current
            return [...current, newMsg]
          })
          
          // If message is from others, stop typing indicator
          if (newMsg.sender_id !== user.id) {
            setIsTyping(false)
          }
        }
      )
      // 2. Listen for Typing Indicators (Broadcast)
      .on(
        'broadcast',
        { event: 'typing' },
        (payload) => {
          if (payload.payload.userId !== user.id) {
            setIsTyping(true)
            // Auto-hide after 3 seconds of inactivity
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
            typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  // Send "I am typing" event
  const sendTypingEvent = async () => {
    if (!conversation || !user) return
    const channel = supabase.channel(`chat:${conversation.id}`)
    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id }
    })
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !conversation) return

    const messageContent = newMessage
    setNewMessage('') // Clear input immediately
    setSending(true)

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          message_type: 'text',
          content: messageContent,
          is_read: false
        })

      if (error) throw error

      // Update conversation timestamp
      await supabase
        .from('chat_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id)

    } catch (error) {
      console.error('Error sending message:', error)
      setNewMessage(messageContent) // Restore message if failed
      alert('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user || !conversation) return

    setUploading(true)
    try {
      // 1. Correct Bucket Name: 'chat-images' (Public bucket)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${fileName}` // Simple path

      const { error: uploadError } = await supabase.storage
        .from('chat-images') // FIXED: Changed from 'chat-files' to 'chat-images'
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath)

      // 3. Send Message
      const messageType = file.type.startsWith('image/') ? 'image' : 'file'
      
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          message_type: messageType,
          file_url: publicUrl,
          content: messageType === 'image' ? 'Image sent' : file.name,
          is_read: false
        })

      if (msgError) throw msgError

      await supabase
        .from('chat_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id)

    } catch (error: any) {
      console.error('Error uploading file:', error)
      alert(`Failed to upload file: ${error.message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'} flex flex-col`}>
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1 flex flex-col">
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl flex-1 flex flex-col max-h-[calc(100vh-200px)]`}>
          {/* Chat Header */}
          <div className={`p-6 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Customer Support
            </h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Chat with our support team
            </p>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-20">
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  No messages yet. Start a conversation!
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwn = message.sender_id === user?.id
                
                return (
                  <div 
                    key={message.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-slide-up`}
                  >
                    <div className={`max-w-xs md:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
                      <div className={`rounded-2xl px-4 py-3 ${
                        isOwn 
                          ? 'bg-blue-600 text-white' 
                          : theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'
                      }`}>
                        {message.message_type === 'text' && (
                          <p className="break-words">{message.content}</p>
                        )}
                        {message.message_type === 'image' && message.file_url && (
                          <div>
                            <img 
                              src={message.file_url} 
                              alt="Attachment" 
                              className="rounded-lg mb-2 max-w-full cursor-pointer hover:opacity-90 transition"
                           onClick={() => message.file_url && window.open(message.file_url, '_blank')}
                            />
                          </div>
                        )}
                        {message.message_type === 'voice' && message.file_url && (
                          <div className="flex items-center space-x-2">
                            <Mic size={16} />
                            <span className="text-sm">Voice message</span>
                          </div>
                        )}
                      </div>
                      <div className={`flex items-center space-x-2 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                          {formatTime(message.created_at)}
                        </span>
                        {isOwn && (
                          message.is_read ? <CheckCheck size={14} className="text-blue-500" /> : <Check size={14} className="text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start animate-pulse">
                <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploading}
                className={`p-3 ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded-lg transition`}
                title="Attach file"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                ) : (
                  <Paperclip size={20} />
                )}
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value)
                  sendTypingEvent()
                }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type your message..."
                className={`flex-1 px-4 py-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
            <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
              Send your order reference code here for confirmation
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
