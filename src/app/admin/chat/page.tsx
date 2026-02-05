'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, ChatConversation, ChatMessage } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Send, User, Check, CheckCheck, Search, Paperclip } from 'lucide-react'

export const dynamic = 'force-dynamic';

interface ConversationWithUser extends ChatConversation {
  profiles?: {
    full_name: string
    email: string
    avatar_url: string
  }
  unread_count?: number
}

export default function AdminChatPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [user, setUser] = useState<any>(null)
  const [conversations, setConversations] = useState<ConversationWithUser[]>([])
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithUser | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkAdmin()
  }, [])

  // Restauration de la conversation via URL
  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chatId')
    if (chatIdFromUrl && conversations.length > 0 && !selectedConversation) {
      const convToRestore = conversations.find(c => c.id === chatIdFromUrl)
      if (convToRestore) {
        setSelectedConversation(convToRestore)
      }
    }
  }, [conversations, searchParams])

  useEffect(() => {
    if (user && selectedConversation) {
      // Mise à jour de l'URL
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.set('chatId', selectedConversation.id)
      window.history.pushState({}, '', newUrl)

      loadMessages()
      const unsubscribe = subscribeToMessages()
      markMessagesAsRead()
      return () => {
        if (unsubscribe) unsubscribe()
      }
    }
  }, [user, selectedConversation])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const checkAdmin = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', currentUser.id)
      .single()

    if (!profile?.is_admin) {
      router.push('/home')
      return
    }

    setUser(currentUser)
    loadConversations(currentUser.id)
  }

  const loadConversations = async (currentUserId?: string) => {
    const activeUserId = currentUserId || user?.id
    if (!activeUserId) return

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select(`
          *,
          profiles!chat_conversations_user_id_fkey (full_name, email, avatar_url)
        `)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })

      if (error) throw error

      const validData = (data || []).filter(conv => conv !== null && conv.id)

      // Déduplication : Une seule conversation par utilisateur
      const uniqueConversationsMap = new Map()
      validData.forEach((conv: any) => {
        if (conv.profiles && !uniqueConversationsMap.has(conv.user_id)) {
          uniqueConversationsMap.set(conv.user_id, conv)
        }
      })
      const uniqueConversations = Array.from(uniqueConversationsMap.values()) as ConversationWithUser[]

      const conversationsWithUnread = await Promise.all(
        uniqueConversations.map(async (conv) => {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', activeUserId)

          return { ...conv, unread_count: count || 0 }
        })
      )

      setConversations(conversationsWithUnread)
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    if (!selectedConversation) return

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const subscribeToMessages = () => {
    if (!selectedConversation || !user) return

    const channel = supabase
      .channel(`admin-chat:${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage
          setMessages((current) => [...current, newMessage])
          if (newMessage.sender_id !== user.id) {
            markMessageAsRead(newMessage.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const markMessagesAsRead = async () => {
    if (!selectedConversation || !user) return

    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('conversation_id', selectedConversation.id)
        .neq('sender_id', user.id)
        .eq('is_read', false)

      loadConversations()
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('id', messageId)
    } catch (error) {
      console.error('Error marking message as read:', error)
    }
  }

  // Upload d'image vers Supabase Storage
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    setUploading(true)
    try {
      // Nom de fichier unique pour éviter les conflits
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${fileName}` // Pas de dossier imbriqué pour simplifier

      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath)

      await sendMessage(publicUrl, 'image')
      
    } catch (error: any) {
      console.error('Erreur upload:', error)
      alert(`Erreur d'envoi image: ${error.message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const sendMessage = async (contentOverride?: string, type: 'text' | 'image' = 'text') => {
    const contentToSend = contentOverride || newMessage
    if (!contentToSend.trim() || !user || !selectedConversation) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          message_type: type,
          content: type === 'text' ? contentToSend : 'Image envoyée',
          file_url: type === 'image' ? contentToSend : null,
          is_read: false
        })

      if (error) throw error

      await supabase
        .from('chat_conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          admin_id: user.id
        })
        .eq('id', selectedConversation.id)

      if (type === 'text') setNewMessage('')
      loadConversations() // Rafraîchir la liste pour remonter la conv en haut
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  const filteredConversations = conversations.filter(conv =>
    conv.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />

      <div className="container mx-auto px-4 py-8">
        <h1 className={`text-4xl font-bold mb-8 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Support Client
        </h1>

        <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
          {/* Liste des Conversations */}
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg overflow-hidden flex flex-col`}>
            <div className="p-4 border-b border-gray-700">
              <div className="relative">
                <Search className={`absolute left-3 top-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} size={20} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="text-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-20">
                  <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Aucune conversation
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} cursor-pointer hover:bg-opacity-50 transition ${
                      selectedConversation?.id === conv.id
                        ? theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'
                        : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        {conv.profiles?.avatar_url ? (
                          <img src={conv.profiles.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white">
                            <User size={24} />
                          </div>
                        )}
                        {(conv.unread_count || 0) > 0 && (
                          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {conv.unread_count}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {conv.profiles?.full_name || 'Inconnu'}
                        </p>
                        <p className={`text-sm truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                          {conv.profiles?.email}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Zone de Chat */}
          <div className={`lg:col-span-2 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg flex flex-col`}>
            {selectedConversation ? (
              <>
                <div className={`p-6 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                  <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {selectedConversation.profiles?.full_name || 'Utilisateur'}
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((message) => {
                    const isOwn = message.sender_id === user?.id
                    return (
                      <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md`}>
                          <div className={`rounded-2xl px-4 py-3 ${
                            isOwn ? 'bg-blue-600 text-white' : theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'
                          }`}>
                            {message.message_type === 'image' && message.file_url ? (
                              <img 
                                src={message.file_url} 
                                alt="Image" 
                                className="rounded-lg max-h-60 object-contain cursor-pointer bg-black/10"
                               onClick={() => message.file_url && window.open(message.file_url, '_blank')}
                              />
                            ) : (
                              <p className="break-words">{message.content}</p>
                            )}
                          </div>
                          <div className={`flex items-center space-x-2 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-xs text-gray-500">{formatTime(message.created_at)}</span>
                            {isOwn && (
                              message.is_read ? <CheckCheck size={14} className="text-blue-500" /> : <Check size={14} className="text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending || uploading}
                      className={`p-3 rounded-lg transition ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      {uploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div> : <Paperclip size={20} />}
                    </button>

                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(undefined, 'text')}
                      placeholder="Message..."
                      className={`flex-1 px-4 py-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                    <button
                      onClick={() => sendMessage(undefined, 'text')}
                      disabled={sending || (!newMessage.trim() && !uploading)}
                      className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {sending ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Send size={20} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">Sélectionnez une conversation</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
