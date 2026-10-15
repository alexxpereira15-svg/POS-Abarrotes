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
  
  // Estados de datos
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  // Estados del Modal de Cobro
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO')
  const [amountPaid, setAmountPaid] = useState<string>('')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [processing, setProcessing] = useState(false)
  const [completedSale, setCompletedSale] = useState<any | null>(null)

  // Cargar datos desde Supabase
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
  const changeDue = Math.max(0, (parseFloat(amountPaid) || 0) - totalCart)

  // Datos del cliente seleccionado para validación de crédito
  const activeCustomer = customers.find(c => c.id === selectedCustomer)
  const isCreditExceeded = paymentMethod === 'CREDITO' && activeCustomer && 
    (activeCustomer.current_balance + totalCart > activeCustomer.credit_limit)

  // Procesar Venta en Supabase
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
      
      // 1. Insertar Encabezado de Venta
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

      // 2. Insertar Detalle de Venta
      const saleItems = cart.map(item => ({
        sale_id: saleData.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity
      }))

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
      if (itemsError) throw itemsError

      // 3. Actualizar Stock de Productos
      for (const item of cart) {
        await supabase
          .from('products')
          .update({ stock: item.stock - item.quantity })
          .eq('id', item.id)
      }

      // 4. Si fue en Efectivo, registrar movimiento de caja
      if (paymentMethod === 'EFECTIVO') {
        await supabase.from('cash_movements').insert({
          type: 'VENTA_EFECTIVO',
          amount: totalCart,
          concept: `Venta en efectivo ${saleCode}`
        })
      }

      // 5. Si fue Fiado, actualizar saldo del cliente
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

      // Recargar catálogo y limpiar carrito
      fetchData()
      setCart([])
    } catch (error) {
      console.error('Error al procesar la venta:', error)
      alert('Ocurrió un error al guardar la venta.')
    } finally {
      setProcessing(false)
    }
  }

  // Generar mensaje para WhatsApp
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
    <div className="flex h-screen bg-gray-100 font-sans">
      
      {/* SECCIÓN IZQUIERDA: CATÁLOGO DE PRODUCTOS (GRID + BUSCADOR) */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        
        {/* Barra de Búsqueda */}
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

      {/* SECCIÓN DERECHA: CARRITO Y BOTÓN DE COBRO */}
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

        {/* Lista de Items */}
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

                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-white rounded text-gray-600">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold px-2">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-white rounded text-gray-600">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right min-w-[60px]">
                  <span className="text-sm font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
                </div>

                <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Resumen y Botón de Abrir Cobro */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
          <div className="flex justify-between items-center text-xl font-extrabold text-gray-900">
            <span>Total:</span>
            <span>${totalCart.toFixed(2)}</span>
          </div>

          <button
            disabled={cart.length === 0}
            onClick={() => setIsCheckoutOpen(true)}
            className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
              cart.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'
            }`}
          >
            <DollarSign className="w-5 h-5" />
            Cobrar (${totalCart.toFixed(2)})
          </button>
        </div>
      </div>

      {/* MODAL DE COBRO Y PAGO */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
            
            {completedSale ? (
              /* PANTALLA DE ÉXITO Y TICKET */
              <div className="text-center space-y-4 py-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                <h3 className="text-2xl font-extrabold text-gray-900">¡Venta Exitosa!</h3>
                <p className="text-sm text-gray-500">Folio de venta: <span className="font-mono font-bold">{completedSale.code}</span></p>
                <div className="bg-gray-50 p-4 rounded-xl text-left border border-gray-200 space-y-1 text-sm">
                  <p className="flex justify-between font-bold text-gray-800">
                    <span>Total Cobrado:</span>
                    <span>${completedSale.total.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-gray-500">Método: {completedSale.paymentMethod}</p>
                </div>

                <div className="flex gap-2">
                  <a
                    href={generateWhatsAppLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    Enviar Ticket por WhatsApp
                  </a>
                  <button
                    onClick={resetCheckout}
                    className="py-3 px-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-sm"
                  >
                    Nueva Venta
                  </button>
                </div>
              </div>
            ) : (
              /* FORMULARIO DE PAGO */
              <div>
                <div className="flex justify-between items-center pb-3 border-b mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Procesar Pago</h3>
                  <button onClick={resetCheckout} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center bg-blue-50 py-3 rounded-xl mb-4">
                  <span className="text-xs text-blue-600 font-semibold uppercase">Monto Total</span>
                  <p className="text-3xl font-black text-blue-900">${totalCart.toFixed(2)}</p>
                </div>

                {/* Selección de Método de Pago */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <button
                    onClick={() => setPaymentMethod('EFECTIVO')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 ${
                      paymentMethod === 'EFECTIVO' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    Efectivo
                  </button>
                  <button
                    onClick={() => setPaymentMethod('TRANSFERENCIA')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 ${
                      paymentMethod === 'TRANSFERENCIA' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Transferencia
                  </button>
                  <button
                    onClick={() => setPaymentMethod('CREDITO')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 ${
                      paymentMethod === 'CREDITO' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Fiado / Crédito
                  </button>
                </div>

                {/* Vista según Método seleccionado */}
                {paymentMethod === 'EFECTIVO' && (
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Paga con ($):</label>
                      <input
                        type="number"
                        placeholder="Ej. 100"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="w-full mt-1 p-2.5 bg-gray-50 border rounded-lg font-bold text-gray-800 text-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {parseFloat(amountPaid) > 0 && (
                      <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg text-sm font-bold">
                        <span>Cambio a devolver:</span>
                        <span className={changeDue >= 0 ? 'text-green-600 font-extrabold text-base' : 'text-red-500'}>
                          ${changeDue.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'CREDITO' && (
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Seleccionar Cliente:</label>
                      <select
                        value={selectedCustomer}
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                        className="w-full mt-1 p-2.5 bg-gray-50 border rounded-lg font-medium text-gray-800 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Elige un cliente --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.full_name} (Deuda actual: ${c.current_balance.toFixed(2)} / Límite: ${c.credit_limit.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {isCreditExceeded && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>¡Atención! La compra supera el límite de crédito disponible de este cliente.</span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  disabled={processing || (paymentMethod === 'EFECTIVO' && parseFloat(amountPaid) < totalCart) || isCreditExceeded}
                  onClick={handleProcessSale}
                  className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md transition-all ${
                    processing || (paymentMethod === 'EFECTIVO' && parseFloat(amountPaid) < totalCart) || isCreditExceeded
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'
                  }`}
                >
                  {processing ? 'Guardando Venta...' : 'Confirmar Venta'}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
