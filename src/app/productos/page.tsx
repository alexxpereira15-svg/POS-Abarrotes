'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Category } from '@/types'
import { Plus, Edit, Trash2, Search, Package, Tag, ArrowUpRight } from 'lucide-react'

export default function ProductsPage() {
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  // Modal Surtir Stock
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false)
  const [restockProduct, setRestockProduct] = useState<Product | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [restockUnitCost, setRestockUnitCost] = useState('')
  const [newSellingPrice, setNewSellingPrice] = useState('')
  const [restockProcessing, setRestockProcessing] = useState(false)

  // Formulario Producto
  const [name, setName] = useState('')
  const [skuCode, setSkuCode] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [stock, setStock] = useState('')
  const [minStock, setMinStock] = useState('5')
  const [imageUrl, setImageUrl] = useState('')

  // Campos de Promoción
  const [promoType, setPromoType] = useState<'NONE' | 'COMBO_QTY'>('NONE')
  const [promoQty, setPromoQty] = useState('')
  const [promoPrice, setPromoPrice] = useState('')

  const fetchData = async () => {
    setLoading(true)
    const { data: catData } = await supabase.from('categories').select('*').order('name')
    const { data: prodData } = await supabase.from('products').select('*').order('name')

    if (catData) setCategories(catData)
    if (prodData) setProducts(prodData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setName(product.name)
      setSkuCode(product.sku_code)
      setCategoryId(product.category_id || '')
      setPrice(product.price.toString())
      setCostPrice(product.cost_price ? product.cost_price.toString() : '')
      setStock(product.stock.toString())
      setMinStock(product.min_stock.toString())
      setImageUrl(product.image_url || '')

      const p = product as any
      setPromoType(p.promo_type === 'COMBO_QTY' ? 'COMBO_QTY' : 'NONE')
      setPromoQty(p.promo_qty ? p.promo_qty.toString() : '')
      setPromoPrice(p.promo_price ? p.promo_price.toString() : '')
    } else {
      setEditingProduct(null)
      setName('')
      setSkuCode(`PROD-${Math.floor(1000 + Math.random() * 9000)}`)
      setCategoryId(categories[0]?.id || '')
      setPrice('')
      setCostPrice('')
      setStock('0')
      setMinStock('5')
      setImageUrl('')

      setPromoType('NONE')
      setPromoQty('')
      setPromoPrice('')
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingProduct(null)
  }

  // Abrir modal de Surtir Stock
  const openRestockModal = (product: Product) => {
    setRestockProduct(product)
    setRestockQty('')
    setRestockUnitCost(product.cost_price ? product.cost_price.toString() : '')
    setNewSellingPrice(product.price.toString())
    setIsRestockModalOpen(true)
  }

  // Guardar Surtido con Costo Promedio Ponderado
  const handleSaveRestock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restockProduct) return

    const qtyToAdd = parseInt(restockQty) || 0
    const newUnitCost = parseFloat(restockUnitCost) || 0
    const updatedSalePrice = parseFloat(newSellingPrice) || restockProduct.price

    if (qtyToAdd <= 0) {
      alert('Ingresa una cantidad válida mayor a 0.')
      return
    }

    setRestockProcessing(true)

    try {
      const currentStock = restockProduct.stock || 0
      const currentCost = restockProduct.cost_price || 0

      // Cálculo de Costo Promedio Ponderado
      const totalNewStock = currentStock + qtyToAdd
      const weightedCost = totalNewStock > 0 
        ? ((currentStock * currentCost) + (qtyToAdd * newUnitCost)) / totalNewStock 
        : newUnitCost

      const { error } = await supabase
        .from('products')
        .update({
          stock: totalNewStock,
          cost_price: parseFloat(weightedCost.toFixed(2)),
          price: updatedSalePrice
        })
        .eq('id', restockProduct.id)

      if (error) throw error

      setIsRestockModalOpen(false)
      fetchData()
    } catch (err) {
      console.error(err)
      alert('Error al surtir inventario.')
    } finally {
      setRestockProcessing(false)
    }
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !price || !stock) {
      alert('Por favor completa los campos obligatorios.')
      return
    }

    setSaving(true)

    const productPayload = {
      name: name.trim(),
      sku_code: skuCode.trim(),
      category_id: categoryId || null,
      price: parseFloat(price) || 0,
      cost_price: parseFloat(costPrice) || 0,
      stock: parseInt(stock) || 0,
      min_stock: parseInt(minStock) || 5,
      image_url: imageUrl.trim() || null,
      is_active: true,

      promo_type: promoType,
      promo_qty: promoType === 'COMBO_QTY' ? (parseInt(promoQty) || null) : null,
      promo_price: promoType === 'COMBO_QTY' ? (parseFloat(promoPrice) || null) : null
    }

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', editingProduct.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productPayload)

        if (error) throw error
      }

      closeModal()
      fetchData()
    } catch (err) {
      console.error(err)
      alert('Error al guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return

    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err) {
      console.error(err)
      alert('Error al eliminar producto.')
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory ? product.category_id === selectedCategory : true
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.sku_code.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Productos</h1>
          <p className="text-sm text-gray-500">Administra tus precios, inventario, surtidos y promociones</p>
        </div>

        <button
          onClick={() => openModal()}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm flex items-center gap-2 text-sm transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          + Agregar Producto
        </button>
      </div>

      {/* FILTROS Y BUSCADOR */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por nombre o código SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-gray-50 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedCategory || ''}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          className="p-1.5 bg-gray-50 border rounded-xl text-xs font-semibold text-gray-700"
        >
          <option value="">Todas las Categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase">
                <th className="p-3">Producto</th>
                <th className="p-3">Código</th>
                <th className="p-3">Precio Venta</th>
                <th className="p-3">Costo Promedio</th>
                <th className="p-3">Promoción</th>
                <th className="p-3">Stock</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">Cargando productos...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">No hay productos registrados.</td></tr>
              ) : (
                filteredProducts.map((p: any) => {
                  const isLow = p.stock <= p.min_stock
                  const hasPromo = p.promo_type === 'COMBO_QTY' && p.promo_qty && p.promo_price

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 font-bold text-gray-800 flex items-center gap-2">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <span>{p.name}</span>
                      </td>
                      <td className="p-3 font-mono text-gray-500">{p.sku_code}</td>
                      <td className="p-3 font-extrabold text-gray-900">${p.price.toFixed(2)}</td>
                      <td className="p-3 text-gray-500">${(p.cost_price || 0).toFixed(2)}</td>
                      <td className="p-3">
                        {hasPromo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-black text-[10px]">
                            <Tag className="w-3 h-3" />
                            {p.promo_qty}x${p.promo_price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10px]">Sin Promo</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          p.stock <= 0 ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {p.stock} unidades
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end items-center gap-1">
                          {/* BOTÓN SURTIR STOCK */}
                          <button
                            onClick={() => openRestockModal(p)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[10px] flex items-center gap-1 transition-colors border border-emerald-200"
                            title="Surtir o ingresar nuevo lote"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            Surtir
                          </button>

                          <button onClick={() => openModal(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL SURTIR STOCK */}
      {isRestockModalOpen && restockProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="border-b pb-2">
              <h3 className="text-base font-bold text-gray-900">📦 Surtir Mercancía</h3>
              <p className="text-xs text-blue-600 font-semibold">{restockProduct.name}</p>
            </div>

            <form onSubmit={handleSaveRestock} className="space-y-3 text-xs">
              <div className="p-2.5 bg-gray-50 rounded-xl flex justify-between text-gray-600">
                <span>Stock Actual: <strong className="text-gray-900">{restockProduct.stock} pzas</strong></span>
                <span>Costo Actual: <strong className="text-gray-900">${(restockProduct.cost_price || 0).toFixed(2)}</strong></span>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Cantidad comprada (Piezas nuevas) *</label>
                <input
                  type="number"
                  required
                  placeholder="Ej. 12"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Costo Unitario de Compra ($) *</label>
                <input
                  type="number"
                  required
                  step="0.10"
                  placeholder="Ej. 10.50"
                  value={restockUnitCost}
                  onChange={(e) => setRestockUnitCost(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold text-emerald-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Precio de Venta al Público ($)</label>
                <input
                  type="number"
                  step="0.50"
                  value={newSellingPrice}
                  onChange={(e) => setNewSellingPrice(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl font-black text-gray-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={restockProcessing}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition-all active:scale-[0.98]"
                >
                  {restockProcessing ? 'Guardando...' : 'Confirmar Surtido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR PRODUCTO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sabritas Sal 45g"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Código / SKU</label>
                  <input
                    type="text"
                    value={skuCode}
                    onChange={(e) => setSkuCode(e.target.value)}
                    className="w-full p-2 bg-gray-50 border rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Categoría</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full p-2 bg-gray-50 border rounded-xl"
                  >
                    <option value="">Sin Categoría</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Precio Público ($) *</label>
                  <input
                    type="number"
                    required
                    step="0.50"
                    placeholder="18.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full p-2 bg-gray-50 border rounded-xl font-bold text-gray-900 text-sm"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Costo Proveedor ($)</label>
                  <input
                    type="number"
                    step="0.50"
                    placeholder="12.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full p-2 bg-gray-50 border rounded-xl"
                  />
                </div>
              </div>

              {/* SECCIÓN PROMOCIÓN */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <label className="font-bold text-amber-900 flex items-center gap-1 text-xs">
                  <Tag className="w-4 h-4 text-amber-600" /> Promoción Especial / Oferta
                </label>

                <div>
                  <select
                    value={promoType}
                    onChange={(e: any) => setPromoType(e.target.value)}
                    className="w-full p-2 bg-white border rounded-xl text-xs font-semibold"
                  >
                    <option value="NONE">Sin Promoción</option>
                    <option value="COMBO_QTY">Combo por Cantidad (Ej. 2 por $10)</option>
                  </select>
                </div>

                {promoType === 'COMBO_QTY' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="font-bold text-amber-800 block mb-1">Piezas necesarias</label>
                      <input
                        type="number"
                        placeholder="2"
                        value={promoQty}
                        onChange={(e) => setPromoQty(e.target.value)}
                        className="w-full p-2 bg-white border rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-amber-800 block mb-1">Precio del Combo ($)</label>
                      <input
                        type="number"
                        step="0.50"
                        placeholder="10.00"
                        value={promoPrice}
                        onChange={(e) => setPromoPrice(e.target.value)}
                        className="w-full p-2 bg-white border rounded-xl font-bold text-emerald-700"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Stock Actual *</label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full p-2 bg-gray-50 border rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full p-2 bg-gray-50 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">URL de la Imagen (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://ejemplo.com/imagen.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full p-2 bg-gray-50 border rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition-all active:scale-[0.98]"
                >
                  {saving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
