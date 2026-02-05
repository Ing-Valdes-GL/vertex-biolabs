'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, ChatConversation, ChatMessage } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Send, User, Check, CheckCheck, Search, Paperclip, Loader2 } from 'lucide-react'

// Force le rendu dynamique pour éviter les erreurs de build sur les pages admin
export const dynamic = 'force-dynamic';

interface ConversationWithUser extends ChatConversation {
  profiles?: {
    full_name: string
    email: string
    avatar_url: string
  }
  unread_count?: number
}

// 1. LE COMPOSANT DE LOGIQUE (Contient useSearchParams)
function ChatContent() {
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

  // Vérification Auth & Admin
  useEffect(() => {
    const init = async () => {
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
      await loadConversations(currentUser.id)
    }
    init()
  }, [])

  // Restauration via URL (ne s'exécute qu'une fois les conversations chargées)
  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chatId')
    if (chatIdFromUrl && conversations.length > 0 && !selectedConversation) {
      const convToRestore = conversations.find(c => c.id === chatIdFromUrl)
      if (convToRestore) {
        setSelectedConversation(convToRestore)
      }
    }
  }, [conversations, searchParams])

  // Gestion de la conversation active
  useEffect(() => {
    if (!user || !selectedConversation) return

    // 1. Mise à jour URL sans rechargement
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('chatId', selectedConversation.id)
    window.history.pushState({}, '', newUrl)

    // 2. Chargement des messages
    loadMessages()
    markMessagesAsRead()

    // 3. Subscription Realtime
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
          const newMsg = payload.new as ChatMessage
          setMessages((current) => [...current, newMsg])
          if (newMsg.sender_id !== user.id) {
            markMessageAsRead(newMsg.id)
          }
          scrollToBottom()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConversation, user])

  // Scroll automatique lors de nouveaux messages
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadConversations = async (userId: string) => {
    try {
      // Note: Assurez-vous que la relation 'profiles' est bien définie dans Supabase
      const { data, error } = await supabase
        .from('chat_conversations')
        .select(`
          *,
          profiles!chat_conversations_user_id_fkey (full_name, email, avatar_url)
        `)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })

      if (error) throw error

      const validData = (data || []).filter(conv => conv && conv.id)

      // Gestion des doublons et calcul des non-lus
      const processedConversations = await Promise.all(
        validData.map(async (conv: any) => {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', userId)

          return { ...conv, unread_count: count || 0 }
        })
      )

      // Map pour unicité par user_id
      const uniqueMap = new Map()
      processedConversations.forEach(c => {
        if (!uniqueMap.has(c.user_id)) uniqueMap.set(c.user_id, c)
      })
      
      setConversations(Array.from(uniqueMap.values()))
    } catch (error) {
      console.error('Erreur chargement conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    if (!selectedConversation) return
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', selectedConversation.id)
      .order('created_at', { ascending: true })
    
    if (data) setMessages(data)
  }

  const markMessagesAsRead = async () => {
    if (!selectedConversation || !user) return
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('conversation_id', selectedConversation.id)
      .neq('sender_id', user.id)
      .eq('is_read', false)
      
    // Mise à jour locale du compteur pour éviter de recharger toute la liste
    setConversations(prev => prev.map(c => 
      c.id === selectedConversation.id ? { ...c, unread_count: 0 } : c
    ))
  }

  const markMessageAsRead = async (messageId: string) => {
    await supabase.from('chat_messages').update({ is_read: true }).eq('id', messageId)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    setUploading(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName)

      await sendMessage(publicUrl, 'image')
    } catch (error: any) {
      alert(`Erreur upload: ${error.message}`)
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

      // Update timestamp conversation
      await supabase
        .from('chat_conversations')
        .update({ last_message_at: new Date().toISOString(), admin_id: user.id })
        .eq('id', selectedConversation.id)

      if (type === 'text') setNewMessage('')
      
      // On ne recharge pas toutes les conversations pour éviter le saut d'interface,
      // on pourrait juste trier localement, mais loadConversations est plus sûr pour la synchro
      loadConversations(user.id) 
    } catch (error) {
      console.error('Erreur envoi:', error)
    } finally {
      setSending(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const filteredConversations = conversations.filter(conv =>
    conv.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />

      <div className="container mx-auto px-4 py-8">
        <h1 className={`text-3xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Support Client
        </h1>

        <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          
          {/* COLONNE GAUCHE : LISTE CONVERSATIONS */}
          <div className={`${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-sm overflow-hidden flex flex-col`}>
            <div className="p-4 border-b border-inherit">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                    theme === 'dark' ? 'bg-gray-700 text-white focus:bg-gray-600' : 'bg-gray-100 focus:bg-white'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-3">
                  <Loader2 className="animate-spin text-blue-500" size={24} />
                  <p className="text-sm text-gray-500">Chargement des discussions...</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <p className="text-gray-500 text-sm">Aucune conversation trouvée.</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`p-4 border-b border-inherit cursor-pointer transition-colors ${
                      selectedConversation?.id === conv.id
                        ? theme === 'dark' ? 'bg-blue-900/30 border-l-4 border-l-blue-500' : 'bg-blue-50 border-l-4 border-l-blue-500'
                        : theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative flex-shrink-0">
                        {conv.profiles?.avatar_url ? (
                          <img src={conv.profiles.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                            <User size={20} />
                          </div>
                        )}
                        {(conv.unread_count || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-gray-800">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <p className={`font-medium truncate text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
                            {conv.profiles?.full_name || 'Utilisateur Inconnu'}
                          </p>
                          {conv.last_message_at && (
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                           {conv.profiles?.email}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLONNE DROITE : ZONE DE CHAT */}
          <div className={`lg:col-span-2 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-sm flex flex-col overflow-hidden`}>
            {selectedConversation ? (
              <>
                {/* Entête Chat */}
                <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <span className="font-bold text-lg">
                        {selectedConversation.profiles?.full_name?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div>
                      <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {selectedConversation.profiles?.full_name || 'Utilisateur'}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {selectedConversation.profiles?.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50/50'}`}>
                  {messages.map((message) => {
                    const isOwn = message.sender_id === user?.id
                    return (
                      <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] md:max-w-[70%]`}>
                          <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                            isOwn 
                              ? 'bg-blue-600 text-white rounded-br-none' 
                              : theme === 'dark' ? 'bg-gray-700 text-white rounded-bl-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                          }`}>
                            {message.message_type === 'image' && message.file_url ? (
                              <div className="relative group">
                                <img 
                                  src={message.file_url} 
                                  alt="Pièce jointe" 
                                  className="rounded-lg max-h-64 object-contain cursor-pointer bg-black/20 hover:opacity-90 transition"
                                  onClick={() => message.file_url && window.open(message.file_url, '_blank')}
                                />
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                            )}
                          </div>
                          
                          <div className={`flex items-center space-x-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px] text-gray-500">
                              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isOwn && (
                              message.is_read 
                                ? <CheckCheck size={12} className="text-blue-500" /> 
                                : <Check size={12} className="text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Zone */}
                <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                  
                  <div className="flex items-end space-x-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending || uploading}
                      className={`p-3 rounded-xl transition-colors flex-shrink-0 ${
                        theme === 'dark' 
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' 
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                      }`}
                      title="Joindre une image"
                    >
                      {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                    </button>

                    <div className={`flex-1 flex items-center rounded-xl px-4 py-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage(undefined, 'text');
                          }
                        }}
                        placeholder="Écrivez votre réponse..."
                        className={`w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 py-1 text-sm ${
                          theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'
                        }`}
                        rows={1}
                        style={{ minHeight: '24px' }}
                      />
                    </div>

                    <button
                      onClick={() => sendMessage(undefined, 'text')}
                      disabled={sending || (!newMessage.trim() && !uploading)}
                      className={`p-3 rounded-xl flex-shrink-0 shadow-sm transition-all ${
                        sending || (!newMessage.trim() && !uploading)
                          ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500' 
                          : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              // État vide (Aucune conversation sélectionnée)
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center h-full">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'}`}>
                  <Search size={40} className="text-blue-400" />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Sélectionnez une discussion
                </h3>
                <p className={`max-w-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Choisissez un client dans la liste de gauche pour voir l'historique et répondre.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

// 2. LE COMPOSANT PRINCIPAL (Coquille Suspense pour Next.js)
export default function AdminChatPage() {
  const { theme } = useTheme()
  
  return (
    <Suspense fallback={
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <p className="text-gray-500 font-medium">Chargement du dashboard...</p>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}
