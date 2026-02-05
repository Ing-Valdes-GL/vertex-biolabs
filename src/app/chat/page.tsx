'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, ChatMessage, ChatConversation } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Send, Paperclip, Check, CheckCheck, Loader2, Info } from 'lucide-react'

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [conversation, setConversation] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
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
      markMessagesAsRead()
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
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    if (!conversation) return
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
    
    if (data) setMessages(data)
  }

  const markMessagesAsRead = async () => {
    if (!conversation || !user) return
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversation.id)
      .neq('sender_id', user.id)
      .eq('is_read', false)
  }

  const subscribeToRealtime = () => {
    if (!conversation || !user) return

    const channel = supabase.channel(`chat:${conversation.id}`)
      .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages((current) => {
            if (current.find(m => m.id === newMsg.id)) return current
            return [...current, newMsg]
          })
          if (newMsg.sender_id !== user.id) {
            setIsTyping(false)
            markMessagesAsRead()
          }
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== user.id) {
          setIsTyping(true)
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  const sendTypingEvent = async () => {
    if (!conversation || !user) return
    supabase.channel(`chat:${conversation.id}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id }
    })
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !conversation) return
    const content = newMessage
    setNewMessage('')
    setSending(true)

    try {
      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        message_type: 'text',
        content,
        is_read: false
      })
      if (error) throw error
      await supabase.from('chat_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id)
    } catch (error) {
      setNewMessage(content)
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
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)

      await supabase.from('chat_messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        message_type: 'image',
        file_url: publicUrl,
        content: 'Image sent',
        is_read: false
      })
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'} flex flex-col`}>
      <Header />

      <main className="container mx-auto px-4 py-6 flex-1 flex flex-col max-w-4xl">
        <div className={`flex-1 flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          
          {/* Chat Header */}
          <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg">
                <span className="font-bold">V</span>
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">Vertex Support</h2>
                <div className="flex items-center text-xs text-green-500 font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                  Online & Ready to help
                </div>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <p className="text-sm text-gray-500">Connecting to secure server...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
                  <Info className="text-blue-600" size={32} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Welcome to Support</h3>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Ask your questions here. Our Vertex Biolabs experts will get back to you as soon as possible.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isOwn = message.sender_id === user?.id
                return (
                  <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`group max-w-[85%] md:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                        isOwn 
                          ? 'bg-blue-600 text-white rounded-br-none' 
                          : theme === 'dark' ? 'bg-gray-800 text-gray-100 rounded-bl-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'
                      }`}>
                        {message.message_type === 'image' && message.file_url ? (
                          <img 
                            src={message.file_url} 
                            alt="Sent" 
                            className="rounded-lg max-h-60 cursor-pointer hover:opacity-95 transition"
                            onClick={() => window.open(message.file_url!, '_blank')}
                          />
                        ) : (
                          <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                      <div className="flex items-center mt-1.5 space-x-1.5 px-1">
                        <span className="text-[10px] text-gray-500 font-medium">
                          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isOwn && (
                          message.is_read 
                            ? <CheckCheck size={14} className="text-blue-500" /> 
                            : <Check size={14} className="text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {isTyping && (
              <div className="flex justify-start">
                <div className={`rounded-full px-4 py-2 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <div className="flex space-x-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white'}`}>
            <div className="flex items-end space-x-2">
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
                className={`p-3 rounded-xl transition-all ${
                  theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                }`}
              >
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
              </button>

              <div className={`flex-1 rounded-2xl border transition-all focus-within:ring-2 focus-within:ring-blue-500/50 ${
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
              }`}>
                <textarea
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value)
                    sendTypingEvent()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="Type your message..."
                  rows={1}
                  className="w-full bg-transparent border-none focus:ring-0 p-3 text-sm resize-none max-h-32"
                />
              </div>

              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                className={`p-3 rounded-xl shadow-lg transition-all ${
                  !newMessage.trim() || sending
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-800'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'
                }`}
              >
                {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-center space-x-1">
               <span className="text-[10px] text-gray-400 font-medium italic">
                 Vertex Biolabs encrypted support channel
               </span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
