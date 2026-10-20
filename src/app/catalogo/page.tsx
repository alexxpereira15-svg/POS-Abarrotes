'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Category } from '@/types'
import { Search, ShoppingBag, Plus, Minus, Trash2, Send, Store, Lightbulb, Tag } from 'lucide-react'

interface CartItem extends Product {
  quantity: number;
  promo_type?: string;
  promo_qty?: number;
  promo_price?: number;
}

// ⚠️ NÚMERO DE WHATSAPP PARA RECIBIR PEDIDOS Y SUGERENCIAS
const WHATSAPP_NUMBER = '529993557616'

export default function CatalogPage() {
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  // Estado para la sugerencia de productos
  const [productSuggestion, setProductSuggestion] = useState('')

  const fetchData = async () => {
    setLoading(true)
    const { data: catData } = await supabase.from('categories').select('*')
    const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true)

    if (catData) setCategories(catData)
    if (prodData) setProducts(prodData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory ? product.category_id === selectedCategory : true
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Cálculo de subtotal considerando promociones de combo
  const calculateItemSubtotal = (item: CartItem) => {
    const { price, quantity, promo_type, promo_qty, promo_price } = item
    if (promo_type === 'COMBO_QTY' && promo_qty && promo_qty > 0 && promo_price && promo_price > 0) {
      const combos = Math.floor(quantity / promo_qty)
      const remainder = quantity % promo_qty
      return (combos * promo_price) + (remainder * price)
    }
    return price * quantity
  }

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

  const totalCart = cart.reduce((acc, item) => acc + calculateItemSubtotal(item), 0)
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0)

  // Enviar pedido por WhatsApp con desgloses de promociones
  const handleSendWhatsAppOrder = (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0) return

    let text = `*¡Hola! Me gustaría hacer el siguiente pedido en Abarrotes el niño:*\n\n`
    if (customerName.trim()) text += `👤 *Cliente:* ${customerName.trim()}\n`
    if (deliveryAddress.trim()) text += `📍 *Ubicación / Notas:* ${deliveryAddress.trim()}\n`
    text += `-----------------------------------\n`

    cart.forEach(item => {
      const subtotal = calculateItemSubtotal(item)
      text += `• ${item.quantity}x ${item.name} - $${subtotal.toFixed(2)}\n`
    })

    text += `-----------------------------------\n`
    text += `💰 *Total Estimado: $${totalCart.toFixed(2)}*\n\n`
    text += `¿Me confirmas disponibilidad para pasar / entregar?`

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  // Enviar sugerencia de producto por WhatsApp
  const handleSendSuggestion = (e: React.FormEvent) => {
    e.preventDefault()
    if (!productSuggestion.trim()) return

    const text = `*¡Hola! Quisiera sugerir que surtan el siguiente producto en Abarrotes el niño:*\n\n💡 *Sugerencia:* ${productSuggestion.trim()}`
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
    setProductSuggestion('')
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-24">
      
      {/* ENCABEZADO PÚBLICO */}
      <header className="bg-blue-700 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-3xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-base leading-tight">Abarrotes el niño</h1>
              <p className="text-[11px] text-blue-200">Catálogo Digital de Productos</p>
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 bg-white text-blue-800 rounded-xl font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-xs"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Mi Pedido</span>
            {totalItems > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        
        {/* BUSCADOR */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar botanas, bebidas, galletas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* FILTRO DE CATEGORÍAS */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
              selectedCategory === null ? 'bg-blue-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                selectedCategory === cat.id ? 'bg-blue-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* LISTADO DE PRODUCTOS CON ETIQUETAS DE PROMOCIÓN */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {loading ? (
            <div className="col-span-full text-center py-12 text-gray-400 text-xs">Cargando productos disponibles...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400 text-xs">No se encontraron productos.</div>
          ) : (
            filteredProducts.map((product: any) => {
              const isOutOfStock = product.stock <= 0
              const cartItem = cart.find(item => item.id === product.id)
              const qtyInCart = cartItem ? cartItem.quantity : 0
              const hasPromo = product.promo_type === 'COMBO_QTY' && product.promo_qty && product.promo_price

              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-2xl border p-3 flex flex-col justify-between shadow-sm transition-all ${
                    isOutOfStock ? 'opacity-50 border-gray-200 bg-gray-50' : 'border-gray-200 hover:border-blue-400'
                  }`}
                >
                  <div>
                    {product.image_url ? (
                      <div className="h-24 w-full bg-gray-50 rounded-xl mb-2 flex items-center justify-center overflow-hidden">
                        <img src={product.image_url} alt={product.name} className="h-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-24 w-full bg-gray-100 rounded-xl mb-2 flex items-center justify-center text-gray-300">
                        <Store className="w-8 h-8 stroke-1" />
                      </div>
                    )}

                    <h3 className="font-bold text-gray-800 text-xs leading-tight line-clamp-2">{product.name}</h3>

                    {/* BADGE VISUAL DE PROMOCIÓN */}
                    {hasPromo && (
                      <div className="mt-1.5 inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-[10px] font-extrabold border border-amber-200">
                        <Tag className="w-3 h-3 text-amber-600" />
                        <span>¡{product.promo_qty}x${product.promo_price.toFixed(2)}!</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-base font-black text-gray-900">${product.price.toFixed(2)}</span>

                    {isOutOfStock ? (
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md">Agotado</span>
                    ) : qtyInCart > 0 ? (
                      <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg p-0.5">
                        <button onClick={() => updateQuantity(product.id, -1)} className="p-0.5 text-blue-700 hover:bg-blue-100 rounded">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black px-1 text-blue-900">{qtyInCart}</span>
                        <button onClick={() => updateQuantity(product.id, 1)} className="p-0.5 text-blue-700 hover:bg-blue-100 rounded">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product)}
                        className="p-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg shadow-sm active:scale-95 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* SECCIÓN SUGERIR PRODUCTOS */}
        <section className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500 text-white rounded-2xl shadow-sm">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-gray-900 text-sm">¿No encontraste lo que buscabas?</h2>
              <p className="text-xs text-gray-600">¡Ayúdanos a mejorar! Sugiérenos qué producto te gustaría que surtamos.</p>
            </div>
          </div>

          <form onSubmit={handleSendSuggestion} className="space-y-2">
            <textarea
              required
              rows={2}
              placeholder="Ej. Cheetos Paminas grandes, Galletas Emperador de Limón, Coca-Cola Sin Azúcar de 600ml..."
              value={productSuggestion}
              onChange={(e) => setProductSuggestion(e.target.value)}
              className="w-full p-3 bg-white border border-amber-200 rounded-2xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none shadow-inner"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-xs transition-all active:scale-[0.98]"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar Sugerencia por WhatsApp
            </button>
          </form>
        </section>

      </main>

      {/* BARRA INFERIOR FLOTANTE DE PEDIDO */}
      {totalItems > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto z-20">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-xl flex items-center justify-between active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="bg-emerald-800 text-emerald-100 text-xs font-black px-2 py-0.5 rounded-full">
                {totalItems}
              </span>
              <span className="text-xs">Ver pedido</span>
            </div>
            <span className="text-base font-black">${totalCart.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* MODAL DEL CARRITO DE PEDIDO */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 shadow-2xl max-h-[90vh] flex flex-col relative space-y-3">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-700" />
                <h3 className="font-extrabold text-gray-900 text-sm">Resumen de tu Pedido</h3>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 max-h-60 pr-1">
              {cart.map(item => {
                const subtotal = calculateItemSubtotal(item)
                const hasPromoApplied = item.promo_type === 'COMBO_QTY' && item.promo_qty && item.quantity >= item.promo_qty

                return (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <h4 className="text-xs font-bold text-gray-800 leading-tight">{item.name}</h4>
                        {hasPromoApplied && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1 rounded">Promo</span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500">${item.price.toFixed(2)} c/u</span>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-white rounded text-gray-700">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold px-1.5">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-white rounded text-gray-700">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-xs font-black text-gray-900 min-w-[50px] text-right">
                      ${subtotal.toFixed(2)}
                    </span>

                    <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>

            <form onSubmit={handleSendWhatsAppOrder} className="pt-2 border-t border-gray-100 space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-0.5">Tu Nombre (Opcional):</label>
                <input
                  type="text"
                  placeholder="Ej. María López"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-0.5">Nota / Ubicación (Opcional):</label>
                <input
                  type="text"
                  placeholder="Ej. Paso a recoger a las 5 pm"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full p-2 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-between items-center pt-1 text-base font-black text-gray-900">
                <span>Total Estimado:</span>
                <span className="text-xl text-emerald-700">${totalCart.toFixed(2)}</span>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs active:scale-[0.98] transition-all"
              >
                <Send className="w-4 h-4" />
                Enviar Pedido por WhatsApp
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
