'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Category } from '@/types'
import { Plus, Search, Package, AlertTriangle, Edit3, ArrowUpCircle } from 'lucide-react'

export default function ProductsPage() {
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Estados para Modal de Nuevo Producto
  const [showNewModal, setShowNewModal] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [stock, setStock] = useState('10')
  const [minStock, setMinStock] = useState('5')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)

  // Estados para Ajuste de Stock
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [addStockAmount, setAddStockAmount] = useState('')

  const fetchData = async () => {
    setLoading(true)
    const { data: catData } = await supabase.from('categories').select('*')
    const { data: prodData } = await supabase.from('products').select('*').order('created_at', { ascending: false })

    if (catData) setCategories(catData)
    if (prodData) setProducts(prodData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Guardar nuevo producto con autogeneración de SKU
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !categoryId) {
      alert('Por favor selecciona una categoría e ingresa el nombre.')
      return
    }

    setSaving(true)

    try {
      const selectedCat = categories.find(c => c.id === categoryId)
      const prefix = selectedCat ? selectedCat.code_prefix : 'GEN'

      // Contar cuántos productos existen con ese prefijo para generar el consecutivo
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', categoryId)

      const nextNumber = (count || 0) + 1
      const skuCode = `${prefix}-${nextNumber.toString().padStart(3, '0')}`

      const { error } = await supabase.from('products').insert({
        category_id: categoryId,
        sku_code: skuCode,
        name: name.trim(),
        price: parseFloat(price) || 0,
        cost_price: parseFloat(costPrice) || 0,
        stock: parseInt(stock) || 0,
        min_stock: parseInt(minStock) || 5,
        image_url: imageUrl.trim() || null
      })

      if (error) throw error

      setShowNewModal(false)
      setName('')
      setPrice('')
      setCostPrice('')
      setStock('10')
      setMinStock('5')
      setImageUrl('')
      fetchData()
    } catch (err) {
      console.error(err)
      alert('Error al guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  // Sumar existencias de mercancía
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return

    const added = parseInt(addStockAmount)
    if (isNaN(added) || added <= 0) return

    try {
      const newStock = selectedProduct.stock + added
      const { error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', selectedProduct.id)

      if (error) throw error

      setSelectedProduct(null)
      setAddStockAmount('')
      fetchData()
    } catch (err) {
      console.error(err)
      alert('Error al actualizar stock.')
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku_code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo e Inventario</h1>
          <p className="text-sm text-gray-500">Maneja productos, entradas de mercancía y existencias.</p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar producto por nombre o código..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* TABLA DE PRODUCTOS */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="p-4">Código</th>
              <th className="p-4">Producto</th>
              <th className="p-4">Precio Venta</th>
              <th className="p-4">Stock Actual</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">Cargando inventario...</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">No hay productos en el catálogo.</td></tr>
            ) : (
              filteredProducts.map(p => {
                const isOutOfStock = p.stock <= 0
                const isLowStock = p.stock > 0 && p.stock <= p.min_stock

                return (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="p-4 font-mono text-xs font-bold text-gray-600">{p.sku_code}</td>
                    <td className="p-4 font-bold text-gray-900 flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      {p.name}
                    </td>
                    <td className="p-4 font-extrabold text-gray-900">${p.price.toFixed(2)}</td>
                    <td className="p-4">
                      {isOutOfStock ? (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2.5 py-1 rounded-full">Agotado (0)</span>
                      ) : isLowStock ? (
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" />
                          ¡Bajo ({p.stock})!
                        </span>
                      ) : (
                        <span className="font-semibold text-gray-700">{p.stock} unidades</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="py-1.5 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-xs inline-flex items-center gap-1"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        Surtir Stock
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: NUEVO PRODUCTO */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Agregar Producto al Catálogo</h3>
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Categoría *</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm"
                >
                  <option value="">-- Selecciona una categoría --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code_prefix})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Doritos Nacho 58g"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Precio Venta ($) *</label>
                  <input
                    type="number"
                    required
                    step="0.5"
                    placeholder="20.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Costo Compra ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="15.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Stock Inicial *</label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Stock Mínimo (Alerta)</label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">URL Imagen (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
                >
                  {saving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SURTIR STOCK */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Surtir Mercancía</h3>
            <p className="text-xs text-gray-500">Producto: <span className="font-bold text-gray-800">{selectedProduct.name}</span></p>
            <p className="text-xs text-gray-600">Stock actual: <span className="font-bold">{selectedProduct.stock} unidades</span></p>

            <form onSubmit={handleAddStock} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Piezas a agregar (+)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ej. 12"
                  value={addStockAmount}
                  onChange={(e) => setAddStockAmount(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-gray-50 border rounded-lg text-lg font-bold text-blue-700"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
                >
                  Agregar Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
