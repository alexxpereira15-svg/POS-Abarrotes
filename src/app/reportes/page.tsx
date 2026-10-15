'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Award, AlertCircle, ShoppingBag, BarChart3, ArrowDownRight } from 'lucide-react'

interface ProductReport {
  productId: string
  name: string
  skuCode: string
  totalQtySold: number
  totalRevenue: number
  totalProfit: number
  currentStock: number
}

export default function ReportsPage() {
  const supabase = createClient()

  const [topProducts, setTopProducts] = useState<ProductReport[]>([])
  const [slowProducts, setSlowProducts] = useState<ProductReport[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReports = async () => {
    setLoading(true)

    try {
      // 1. Obtener todas las ventas con sus items y productos asociados
      const { data: itemsData } = await supabase
        .from('sale_items')
        .select(`
          quantity, subtotal, unit_price, unit_cost, product_id,
          products ( id, name, sku_code, stock )
        `)

      // 2. Obtener todos los productos para identificar los que no han tenido ventas
      const { data: allProducts } = await supabase.from('products').select('*')

      if (itemsData && allProducts) {
        const productStatsMap: { [key: string]: ProductReport } = {}

        // Inicializar mapa con todos los productos registrados
        allProducts.forEach(p => {
          productStatsMap[p.id] = {
            productId: p.id,
            name: p.name,
            skuCode: p.sku_code,
            totalQtySold: 0,
            totalRevenue: 0,
            totalProfit: 0,
            currentStock: p.stock
          }
        })

        // Acumular ventas
        itemsData.forEach((item: any) => {
          const pId = item.product_id
          if (productStatsMap[pId]) {
            const qty = Number(item.quantity) || 0
            const revenue = Number(item.subtotal) || 0
            const cost = (Number(item.unit_cost) || 0) * qty

            productStatsMap[pId].totalQtySold += qty
            productStatsMap[pId].totalRevenue += revenue
            productStatsMap[pId].totalProfit += (revenue - cost)
          }
        })

        const statsList = Object.values(productStatsMap)

        // Ordenar de mayor a menor ventas (Top Vendidos)
        const sortedTop = [...statsList].sort((a, b) => b.totalQtySold - a.totalQtySold)

        // Ordenar de menor a mayor ventas (Lento Movimiento)
        const sortedSlow = [...statsList].sort((a, b) => a.totalQtySold - b.totalQtySold)

        setTopProducts(sortedTop.slice(0, 10))
        setSlowProducts(sortedSlow.slice(0, 10))
      }
    } catch (err) {
      console.error('Error cargando reportes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* ENCABEZADO */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analítica de Rotación de Productos</h1>
        <p className="text-sm text-gray-500">
          Descubre qué productos generan mayor ganancia y cuáles tienen lento movimiento para tomar decisiones inteligentes de compra.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* TOP 10 PRODUCTOS MÁS VENDIDOS */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 bg-emerald-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-gray-800 text-sm">Top 10 Productos Más Vendidos ("Estrella")</h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Alta Rotación</span>
          </div>

          <div className="divide-y divide-gray-100 text-xs">
            {loading ? (
              <p className="p-6 text-center text-gray-400">Analizando historial de ventas...</p>
            ) : topProducts.length === 0 ? (
              <p className="p-6 text-center text-gray-400">Sin datos de ventas aún.</p>
            ) : (
              topProducts.map((p, index) => (
                <div key={p.productId} className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-[11px] ${
                      index === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-100 text-gray-600'
                    }`}>
                      #{index + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-gray-800 text-xs">{p.name}</h4>
                      <span className="text-[10px] font-mono text-gray-400">{p.skuCode} • Stock actual: {p.currentStock}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-gray-900 text-sm block">{p.totalQtySold} piezas</span>
                    <span className="text-[10px] font-bold text-emerald-600">+${p.totalProfit.toFixed(2)} ganancia</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* TOP 10 PRODUCTOS DE LENTO MOVIMIENTO */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 bg-amber-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-gray-800 text-sm">Productos de Lento Movimiento</h3>
            </div>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Baja Demanda</span>
          </div>

          <div className="divide-y divide-gray-100 text-xs">
            {loading ? (
              <p className="p-6 text-center text-gray-400">Analizando historial de ventas...</p>
            ) : slowProducts.length === 0 ? (
              <p className="p-6 text-center text-gray-400">Sin datos de productos.</p>
            ) : (
              slowProducts.map((p, index) => (
                <div key={p.productId} className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-[11px]">
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-gray-800 text-xs">{p.name}</h4>
                      <span className="text-[10px] font-mono text-gray-400">{p.skuCode} • Stock estancado: {p.currentStock}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-gray-600 text-xs block">{p.totalQtySold} vendidas</span>
                    <span className="text-[10px] text-gray-400">${p.totalRevenue.toFixed(2)} cobrados</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  )
}
