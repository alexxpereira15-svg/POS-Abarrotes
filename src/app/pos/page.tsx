'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Category, Customer, PaymentMethod } from '@/types'
import { Search, ShoppingCart, Trash2, Plus, Minus, DollarSign, X, CheckCircle, Share2, CreditCard, User, AlertTriangle } from 'lucide-react'

interface CartItem extends Product {
  quantity: number
}

export default function POSPage() {
  const supabase = createClient()
  
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO')
  const [amountPaid, setAmountPaid] = useState<string>('')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [processing, setProcessing] = useState(false)
  const [completedSale, setCompletedSale] = useState<any | null>(null)

  const fetchData = async () => {
    setLoading(true)
    const { data: catData } = await supabase.from('categories').select('*')
    const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true)
    const { data: custData } = await supabase.from('customers').select('*')

    if (catData) setCategories(catData)
    if (prodData) setProducts(prodData)
    if (custData) setCustomers(custData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory ? product.category_id === selectedCategory : true
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.sku_code.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

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
  const changeDue = Math.max(0, (parseFloat(amountPaid) || 0) - totalCart)

  const activeCustomer = customers.find(c => c.id === selectedCustomer)
  const isCreditExceeded = paymentMethod === 'CREDITO' && activeCustomer && 
    (activeCustomer.current_balance + totalCart > activeCustomer.credit_limit)

  const handleProcessSale = async () => {
    if (cart.length === 0 || processing) return
    if (paymentMethod === 'CREDITO' && !selectedCustomer) {
      alert('Por favor selecciona un cliente para fiar la compra.')
      return
    }
    if (paymentMethod === 'CREDITO' && isCreditExceeded) {
      alert('El monto excede el límite de crédito del cliente.')
      return
    }

    setProcessing(true)

    try {
      const saleCode = `VTA-${Math.floor(100000 + Math.random() * 900000)}`
      
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          sale_code: saleCode,
          customer_id: selectedCustomer || null,
          payment_type: paymentMethod,
          total_amount: totalCart,
          status: paymentMethod === 'CREDITO' ? 'PENDIENTE_PAGO' : 'PAGADA'
        })
        .select()
        .single()

      if (saleError) throw saleError

      const saleItems = cart.map(item => ({
        sale_id: saleData.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        unit_cost: item.cost_price || 0,
        subtotal: item.price * item.quantity
      }))

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
      if (itemsError) throw itemsError

      for (const item of cart) {
        await supabase
          .from('products')
          .update({ stock: item.stock - item.quantity })
          .eq('id', item.id)
      }

      // REGISTRO DE MOVIMIENTO DE CAJA SEGÚN MÉTODO DE PAGO
      if (paymentMethod === 'EFECTIVO') {
        await supabase.from('cash_movements').insert({
          type: 'VENTA_EFECTIVO',
          account_type: 'EFECTIVO',
          amount: totalCart,
          concept: `Venta en efectivo ${saleCode}`
        })
      } else if (paymentMethod === 'TRANSFERENCIA') {
        await supabase.from('cash_movements').insert({
          type: 'VENTA_EFECTIVO',
          account_type: 'BANCO',
          amount: totalCart,
          concept: `Venta por transferencia ${saleCode}`
        })
      }

      if (paymentMethod === 'CREDITO' && activeCustomer) {
        await supabase
          .from('customers')
          .update({ current_balance: activeCustomer.current_balance + totalCart })
          .eq('id', activeCustomer.id)
      }

      setCompletedSale({
        code: saleCode,
        total: totalCart,
        cart: [...cart],
        paymentMethod,
        customerName: activeCustomer?.full_name
      })

      fetchData()
      setCart([])
    } catch (error) {
      console.error('Error al procesar la venta:', error)
      alert('Ocurrió un error al guardar la venta.')
    } finally {
      setProcessing(false)
    }
  }

  const generateWhatsAppLink = () => {
    if (!completedSale) return ''
    let text = `*Ticket de Compra - La Tiendita*\n`
    text += `Folio: ${completedSale.code}\n`
    text += `--------------------------------\n`
    completedSale.cart.forEach((item: CartItem) => {
      text += `${item.quantity}x ${item.name} - $${(item.price * item.quantity).toFixed(2)}\n`
    })
    text += `--------------------------------\n`
    text += `*Total: $${completedSale.total.toFixed(2)}*\n`
    text += `Método de Pago: ${completedSale.paymentMethod}\n`
    if (completedSale.customerName) {
      text += `Cliente: ${completedSale.customerName}\n`
    }
    text += `\n¡Gracias por tu compra!`

    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  const resetCheckout = () => {
    setIsCheckoutOpen(false)
    setCompletedSale(null)
    setAmountPaid('')
    setSelectedCustomer('')
    setPaymentMethod('EFECTIVO')
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-100 font-sans">
      
      {/* CATÁLOGO DE PRODUCTOS (GRID COMPACTO) */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        
        {/* Buscador */}
        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar producto o código (ej. SAB-001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Categorías */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCategory === null ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Todas
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grid Ajustado (Compacto) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-1 align-content-start">
          {loading ? (
            <div className="col-span-full text-center py-10 text-gray-500 text-sm">Cargando productos...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-10 text-gray-400 text-sm">No se encontraron productos.</div>
          ) : (
            filteredProducts.map(product => {
              const isOutOfStock = product.stock <= 0
              const isLowStock = product.stock > 0 && product.stock <= product.min_stock

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && addToCart(product)}
                  className={`h-fit flex flex-col justify-between p-2.5 bg-white rounded-xl border transition-all shadow-sm ${
                    isOutOfStock
                      ? 'opacity-50 cursor-not-allowed border-red-200 bg-red-50/20'
                      : 'hover:shadow-md hover:border-blue-500 cursor-pointer border-gray-200 active:scale-[0.98]'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {product.sku_code}
                      </span>
                      {isOutOfStock ? (
                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">Agotado</span>
                      ) : isLowStock ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                          ¡{product.stock}!
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">Stock: {product.stock}</span>
                      )}
                    </div>

                    {product.image_url && (
                      <div className="h-16 w-full bg-gray-50 rounded-md mb-1.5 flex items-center justify-center overflow-hidden">
                        <img src={product.image_url} alt={product.name} className="h-full object-contain" />
                      </div>
                    )}

                    <h3 className="font-semibold text-gray-800 text-xs line-clamp-2 leading-tight">{product.name}</h3>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-base font-extrabold text-gray-900">${product.price.toFixed(2)}</span>
                    <button
                      disabled={isOutOfStock}
                      className={`p-1 rounded-md transition-colors ${
                        isOutOfStock ? 'bg-gray-200 text-gray-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* CARRITO Y COBRO */}
      <div className="w-80 md:w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">
        <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-gray-800 text-sm">Orden Actual</h2>
          </div>
          <span className="text-[11px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
            {cart.reduce((a, b) => a + b.quantity, 0)} ítems
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 divide-y divide-gray-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-1">
              <ShoppingCart className="w-10 h-10 stroke-1" />
              <p className="text-xs">El carrito está vacío</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                <div className="flex-1">
                  <h4 className="text-xs font-semibold text-gray-800 leading-tight">{item.name}</h4>
                  <span className="text-[11px] text-gray-500">${item.price.toFixed(2)} c/u</span>
                </div>

                <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-0.5 hover:bg-white rounded text-gray-600">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold px-1.5">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-0.5 hover:bg-white rounded text-gray-600">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right min-w-[50px]">
                  <span className="text-xs font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
                </div>

                <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 p-0.5">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-gray-200 bg-gray-50 space-y-2">
          <div className="flex justify-between items-center text-lg font-black text-gray-900">
            <span>Total:</span>
            <span>${totalCart.toFixed(2)}</span>
          </div>

          <button
            disabled={cart.length === 0}
            onClick={() => setIsCheckoutOpen(true)}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all text-sm ${
              cart.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Cobrar (${totalCart.toFixed(2)})
          </button>
        </div>
      </div>

      {/* MODAL DE COBRO */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
            {completedSale ? (
              <div className="text-center space-y-4 py-2">
                <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
                <h3 className="text-xl font-extrabold text-gray-900">¡Venta Exitosa!</h3>
                <p className="text-xs text-gray-500">Folio: <span className="font-mono font-bold">{completedSale.code}</span></p>
                <div className="bg-gray-50 p-3 rounded-xl text-left border border-gray-200 space-y-1 text-xs">
                  <p className="flex justify-between font-bold text-gray-800">
                    <span>Total Cobrado:</span>
                    <span>${completedSale.total.toFixed(2)}</span>
                  </p>
                  <p className="text-[11px] text-gray-500">Método: {completedSale.paymentMethod}</p>
                </div>

                <div className="flex gap-2">
                  <a
                    href={generateWhatsAppLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                  <button
                    onClick={resetCheckout}
                    className="py-2.5 px-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-xs"
                  >
                    Nueva Venta
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center pb-3 border-b mb-3">
                  <h3 className="text-base font-bold text-gray-900">Procesar Pago</h3>
                  <button onClick={resetCheckout} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center bg-blue-50 py-2.5 rounded-xl mb-3">
                  <span className="text-[10px] text-blue-600 font-bold uppercase">Monto Total</span>
                  <p className="text-2xl font-black text-blue-900">${totalCart.toFixed(2)}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    onClick={() => setPaymentMethod('EFECTIVO')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 ${
                      paymentMethod === 'EFECTIVO' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" /> Efectivo
                  </button>
                  <button
                    onClick={() => setPaymentMethod('TRANSFERENCIA')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 ${
                      paymentMethod === 'TRANSFERENCIA' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" /> Transferencia
                  </button>
                  <button
                    onClick={() => setPaymentMethod('CREDITO')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 ${
                      paymentMethod === 'CREDITO' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <User className="w-4 h-4" /> Fiado / Crédito
                  </button>
                </div>

                {paymentMethod === 'EFECTIVO' && (
                  <div className="space-y-2 mb-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Paga con ($):</label>
                      <input
                        type="number"
                        placeholder="Ej. 100"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="w-full mt-1 p-2 bg-gray-50 border rounded-lg font-bold text-gray-800 text-base focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {parseFloat(amountPaid) > 0 && (
                      <div className="flex justify-between items-center p-2.5 bg-gray-100 rounded-lg text-xs font-bold">
                        <span>Cambio:</span>
                        <span className={changeDue >= 0 ? 'text-green-600 font-extrabold text-sm' : 'text-red-500'}>
                          ${changeDue.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'CREDITO' && (
                  <div className="space-y-2 mb-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Seleccionar Cliente:</label>
                      <select
                        value={selectedCustomer}
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                        className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Elige un cliente --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.full_name} (Deuda: ${c.current_balance.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {isCreditExceeded && (
                      <div className="flex items-center gap-1.5 p-2 bg-red-50 border border-red-200 text-red-700 text-[11px] rounded-lg font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Supera el límite de crédito del cliente.</span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  disabled={processing || (paymentMethod === 'EFECTIVO' && parseFloat(amountPaid) < totalCart) || isCreditExceeded}
                  onClick={handleProcessSale}
                  className={`w-full py-3 rounded-xl font-bold text-white shadow-md text-sm transition-all ${
                    processing || (paymentMethod === 'EFECTIVO' && parseFloat(amountPaid) < totalCart) || isCreditExceeded
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'
                  }`}
                >
                  {processing ? 'Guardando...' : 'Confirmar Venta'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
