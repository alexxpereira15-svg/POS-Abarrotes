'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Category, PaymentMethod } from '@/types'
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, DollarSign, UserCheck } from 'lucide-react'

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
        if (existing.quantity >= product.stock) return prevCart // Bloquear si excede stock
        return prevCart.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prevCart, { ...product, quantity: 1 }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta
          if (newQty <= 0) return null
          if (newQty > item.stock) return item // No exceder el stock disponible
          return { ...item, quantity: newQty }
        }
        return item
      }).filter(Boolean) as CartItem[]
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
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
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
                  className={`relative flex flex-col justify-between p-3 bg
