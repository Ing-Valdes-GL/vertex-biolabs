'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Product } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Plus, Edit, Trash2, X, Upload, Save, Eye, EyeOff } from 'lucide-react'

export default function AdminProductsPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  
  // État du formulaire
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    has_promotion: false,
    promotion_percentage: 0,
    main_image_url: '',
    secondary_image_1_url: '',
    secondary_image_2_url: '',
    stock_quantity: 0,
    is_active: true
  })

  useEffect(() => {
    checkAdmin()
    loadProducts()
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
    }
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        created_by: user.id
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)

        if (error) throw error
        alert('Produit mis à jour !')
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData)

        if (error) throw error
        alert('Produit créé !')
      }

      setShowModal(false)
      setEditingProduct(null)
      resetForm()
      loadProducts()
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Erreur lors de l\'enregistrement')
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      has_promotion: product.has_promotion,
      promotion_percentage: product.promotion_percentage,
      main_image_url: product.main_image_url,
      secondary_image_1_url: product.secondary_image_1_url || '',
      secondary_image_2_url: product.secondary_image_2_url || '',
      stock_quantity: product.stock_quantity,
      is_active: product.is_active
    })
    setShowModal(true)
  }

  // --- ACTION DE DÉSACTIVATION ---
  const handleDisable = async (product: Product) => {
    const action = product.is_active ? 'désactiver' : 'réactiver'
    if (!confirm(`Voulez-vous vraiment ${action} ce produit ?`)) return

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id)

      if (error) throw error
      
      alert(`Produit ${product.is_active ? 'désactivé' : 'réactivé'} avec succès !`)
      loadProducts()
    } catch (error) {
      console.error('Error updating product status:', error)
      alert('Échec du changement de statut')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      has_promotion: false,
      promotion_percentage: 0,
      main_image_url: '',
      secondary_image_1_url: '',
      secondary_image_2_url: '',
      stock_quantity: 0,
      is_active: true
    })
  }

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)

      setFormData({ ...formData, [field]: publicUrl })
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Échec de l\'upload')
    }
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className={`text-4xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Gestion des Produits
          </h1>
          <button
            onClick={() => {
              resetForm()
              setEditingProduct(null)
              setShowModal(true)
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            <span>Ajouter un Produit</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div 
                key={product.id}
                className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg overflow-hidden border ${!product.is_active ? 'border-red-500 opacity-60' : 'border-transparent'}`}
              >
                <div className="relative">
                  <img 
                    src={product.main_image_url} 
                    alt={product.name}
                    className="w-full h-48 object-cover"
                  />
                  {!product.is_active && (
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                        <span className="bg-red-600 text-white px-3 py-1 rounded font-bold uppercase tracking-wider">Inactif</span>
                    </div>
                  )}
                  {product.has_promotion && product.is_active && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                      -{product.promotion_percentage}%
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {product.name}
                  </h3>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      ${product.price.toFixed(2)}
                    </span>
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      Stock: {product.stock_quantity}
                    </span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Edit size={18} />
                      <span>Modifier</span>
                    </button>
                    
                    <button
                      onClick={() => handleDisable(product)}
                      className={`px-4 py-2 rounded-lg text-white transition ${product.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                      title={product.is_active ? "Désactiver" : "Réactiver"}
                    >
                      {product.is_active ? <Trash2 size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MODAL COMPLET AVEC TOUS LES CHAMPS --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {editingProduct ? 'Modifier le Produit' : 'Ajouter un Produit'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className={`block mb-2 font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Nom du Produit *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full px-4 py-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>

                  <div>
                    <label className={`block mb-2 font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Prix ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className={`w-full px-4 py-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block mb-2 font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Description
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={`w-full px-4 py-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className={`block mb-2 font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Quantité en Stock
                    </label>
                    <input
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                      className={`w-full px-4 py-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>

                  <div>
                    <label className={`block mb-2 font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Statut
                    </label>
                    <select
                      value={formData.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                      className={`w-full px-4 py-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      <option value="active">Actif (Visible)</option>
                      <option value="inactive">Inactif (Caché)</option>
                    </select>
                  </div>
                </div>

                {/* Gestion Promotion */}
                <div className="flex items-center space-x-4 p-4 border rounded-lg border-gray-200 dark:border-gray-700">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.has_promotion}
                      onChange={(e) => setFormData({ ...formData, has_promotion: e.target.checked })}
                      className="rounded w-5 h-5 text-blue-600"
                    />
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Activer Promotion</span>
                  </label>
                  {formData.has_promotion && (
                    <div className="flex items-center space-x-2">
                        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>Réduction :</span>
                        <input
                        type="number"
                        placeholder="%"
                        value={formData.promotion_percentage}
                        onChange={(e) => setFormData({ ...formData, promotion_percentage: parseInt(e.target.value) || 0 })}
                        className={`w-20 px-2 py-1 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        max={100}
                        />
                        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>%</span>
                    </div>
                  )}
                </div>

                {/* Gestion Images */}
                <div className="space-y-4">
                  <div>
                    <label className={`block mb-2 font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Image Principale * (URL ou Upload)
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="url"
                        required
                        placeholder="https://..."
                        value={formData.main_image_url}
                        onChange={(e) => setFormData({ ...formData, main_image_url: e.target.value })}
                        className={`flex-1 px-4 py-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      <label className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center space-x-2">
                        <Upload size={20} />
                        <span>Upload</span>
                        <input type="file" accept="image/*" onChange={(e) => handleUploadImage(e, 'main_image_url')} className="hidden" />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className={`block mb-2 font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Image Secondaire 1
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="url"
                        placeholder="https://..."
                        value={formData.secondary_image_1_url}
                        onChange={(e) => setFormData({ ...formData, secondary_image_1_url: e.target.value })}
                        className={`flex-1 px-4 py-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      <label className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center space-x-2">
                        <Upload size={20} />
                        <input type="file" accept="image/*" onChange={(e) => handleUploadImage(e, 'secondary_image_1_url')} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold"
                  >
                    <Save size={20} />
                    <span>{editingProduct ? 'Mettre à jour' : 'Créer le Produit'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className={`px-6 py-3 ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} rounded-lg transition`}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}