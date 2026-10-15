'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Category } from '@/types'
import { Search, ShoppingCart, Trash2, Plus, Minus, DollarSign } from 'lucide-react'

interface CartItem extends Product {
  quantity: number
}

export default function POSPage() {
  const supabase = createClient()
  
  // Estados de datos
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  // Cargar datos desde Supabase
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { data: catData } = await supabase.from('categories').select('*')
      const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true)

      if (catData) setCategories(catData)
      if (prodData) setProducts(prodData)
      setLoading(false)
    }
    fetchData()
  }, [])

  // Filtrado de productos
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory ? product.category_id === selectedCategory : true
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.sku_code.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Operaciones del Carrito
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return

    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) return prevCart
        return prevCart.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prevCart, { ...product, quantity: 1 }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prevCart => {
      const updatedCart = prevCart.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta
          if (newQty > item.stock) return item
          return { ...item, quantity: newQty }
        }
        return item
      })
      return updatedCart.filter(item => item.quantity > 0)
    })
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const totalCart = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      
      {/* SECCIÓN IZQUIERDA: CATÁLOGO DE PRODUCTOS (GRID + BUSCADOR) */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        
        {/* Barra de Búsqueda y Filtros */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar producto o código (ej. SAB-001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Categorías */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === null ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Todas
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grid Visual de Productos */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-1">
          {loading ? (
            <div className="col-span-full text-center py-10 text-gray-500">Cargando productos...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-10 text-gray-400">No se encontraron productos.</div>
          ) : (
            filteredProducts.map(product => {
              const isOutOfStock = product.stock <= 0
              const isLowStock = product.stock > 0 && product.stock <= product.min_stock

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && addToCart(product)}
                  className={`relative flex flex-col justify-between p-3 bg-white rounded-xl border transition-all shadow-sm ${
                    isOutOfStock
                      ? 'opacity-50 cursor-not-allowed border-red-200 bg-red-50/20'
                      : 'hover:shadow-md hover:border-blue-500 cursor-pointer border-gray-200'
                  }`}
                >
                  <div>
                    {/* Badge de Código y Stock */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-mono font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {product.sku_code}
                      </span>
                      {isOutOfStock ? (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">Agotado</span>
                      ) : isLowStock ? (
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                          ¡Quedan {product.stock}!
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Stock: {product.stock}</span>
                      )}
                    </div>

                    {/* Imagen o Placeholder */}
                    <div className="h-24 w-full bg-gray-50 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-full object-contain" />
                      ) : (
                        <span className="text-2xl font-bold text-gray-300">
                          {product.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <h3 className="font-medium text-gray-800 text-sm line-clamp-2">{product.name}</h3>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">${product.price.toFixed(2)}</span>
                    <button
                      disabled={isOutOfStock}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isOutOfStock ? 'bg-gray-200 text-gray-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* SECCIÓN DERECHA: CARRITO Y COBRO */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">
        
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-800">Orden Actual</h2>
          </div>
          <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
            {cart.reduce((a, b) => a + b.quantity, 0)} ítems
          </span>
        </div>

        {/* Lista de Items en el Carrito */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-gray-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
              <ShoppingCart className="w-12 h-12 stroke-1" />
              <p className="text-sm">El carrito está vacío</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-2">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-800 leading-tight">{item.name}</h4>
                  <span className="text-xs text-gray-500">${item.price.toFixed(2)} c/u</span>
                </div>

                {/* Controles de Cantidad */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="p-1 hover:bg-white rounded text-gray-600 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold px-2">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="p-1 hover:bg-white rounded text-gray-600 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right min-w-[60px]">
                  <span className="text-sm font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Resumen y Botón de Cobro */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
          <div className="flex justify-between items-center text-xl font-extrabold text-gray-900">
            <span>Total:</span>
            <span>${totalCart.toFixed(2)}</span>
          </div>

          <button
            disabled={cart.length === 0}
            className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
              cart.length === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'
            }`}
          >
            <DollarSign className="w-5 h-5" />
            Cobrar (${totalCart.toFixed(2)})
          </button>
        </div>

      </div>

    </div>
  )
}
