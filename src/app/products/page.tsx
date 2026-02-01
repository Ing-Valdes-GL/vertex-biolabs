'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Product } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { ShoppingCart, Search, Filter, X } from 'lucide-react'

export default function ProductsPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPromoOnly, setShowPromoOnly] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  useEffect(() => {
    checkUser()
    loadProducts()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [searchQuery, showPromoOnly, products])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
      setFilteredProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterProducts = () => {
    let filtered = products

    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (showPromoOnly) {
      filtered = filtered.filter(p => p.has_promotion)
    }

    setFilteredProducts(filtered)
  }

  const addToCart = async (product: Product) => {
    if (!user) {
      router.push('/login')
      return
    }

    try {
      const { data: existingItem } = await supabase
        .from('cart')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .single()

      if (existingItem) {
        await supabase
          .from('cart')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id)
      } else {
        await supabase
          .from('cart')
          .insert({
            user_id: user.id,
            product_id: product.id,
            quantity: 1
          })
      }

      alert('Product added to cart!')
      window.location.reload()
    } catch (error) {
      console.error('Error adding to cart:', error)
      alert('Failed to add product to cart')
    }
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />

      <div className="container mx-auto px-4 py-8">
        <h1 className={`text-4xl font-bold mb-8 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Our Products
        </h1>

        {/* Filters */}
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-lg mb-8`}>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className={`absolute left-3 top-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowPromoOnly(!showPromoOnly)}
                className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition ${
                  showPromoOnly
                    ? 'bg-blue-600 text-white'
                    : theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <Filter size={20} />
                <span>Promotions Only</span>
              </button>
              <div className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {filteredProducts.length} products
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className={`text-center py-20 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            <p className="text-xl">No products found</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const finalPrice = product.has_promotion
                ? product.price * (1 - product.promotion_percentage / 100)
                : product.price

              return (
                <div 
                  key={product.id}
                  className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer`}
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="relative">
                    <img 
                      src={product.main_image_url} 
                      alt={product.name}
                      className="w-full h-48 object-cover"
                    />
                    {product.has_promotion && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                        -{product.promotion_percentage}%
                      </div>
                    )}
                    {product.stock_quantity < 10 && (
                      <div className="absolute top-2 left-2 bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                        Low Stock
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {product.name}
                    </h3>
                    <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-sm mb-4 line-clamp-2`}>
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        {product.has_promotion && (
                          <span className="text-gray-400 line-through text-sm mr-2">
                            ${product.price.toFixed(2)}
                          </span>
                        )}
                        <span className={`text-2xl font-bold ${product.has_promotion ? 'text-green-600' : theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          ${finalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        addToCart(product)
                      }}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2"
                    >
                      <ShoppingCart size={18} />
                      <span>Add to Cart</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedProduct(null)}>
          <div 
            className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition z-10"
              >
                <X size={24} className="text-gray-900" />
              </button>
              
              <div className="grid md:grid-cols-2 gap-8 p-8">
                <div>
                  <img 
                    src={selectedProduct.main_image_url} 
                    alt={selectedProduct.name}
                    className="w-full rounded-xl mb-4"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    {selectedProduct.secondary_image_1_url && (
                      <img 
                        src={selectedProduct.secondary_image_1_url} 
                        alt={`${selectedProduct.name} 2`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    )}
                    {selectedProduct.secondary_image_2_url && (
                      <img 
                        src={selectedProduct.secondary_image_2_url} 
                        alt={`${selectedProduct.name} 3`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <h2 className={`text-3xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {selectedProduct.name}
                  </h2>
                  <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-6`}>
                    {selectedProduct.description}
                  </p>
                  
                  <div className="mb-6">
                    <div className="flex items-baseline space-x-3 mb-2">
                      {selectedProduct.has_promotion && (
                        <span className="text-gray-400 line-through text-xl">
                          ${selectedProduct.price.toFixed(2)}
                        </span>
                      )}
                      <span className={`text-4xl font-bold ${selectedProduct.has_promotion ? 'text-green-600' : theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        ${(selectedProduct.has_promotion
                          ? selectedProduct.price * (1 - selectedProduct.promotion_percentage / 100)
                          : selectedProduct.price).toFixed(2)}
                      </span>
                    </div>
                    {selectedProduct.has_promotion && (
                      <span className="inline-block bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
                        Save {selectedProduct.promotion_percentage}%
                      </span>
                    )}
                  </div>

                  <div className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} p-4 rounded-lg mb-6`}>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      <span className="font-semibold">Stock:</span> {selectedProduct.stock_quantity} units available
                    </p>
                  </div>

                  <button
                    onClick={() => addToCart(selectedProduct)}
                    className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2 text-lg font-semibold"
                  >
                    <ShoppingCart size={24} />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}