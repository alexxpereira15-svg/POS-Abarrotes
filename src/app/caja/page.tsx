'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, ArrowUpRight, ArrowDownLeft, Plus, History, TrendingUp, ShieldCheck, RefreshCw, PieChart, Calendar } from 'lucide-react'

interface CashMovement {
  id: string
  type: 'ENTRADA_EFECTIVO' | 'RETIRO_EFECTIVO' | 'VENTA_EFECTIVO' | 'ABONO_EFECTIVO'
  amount: number
  concept: string
  created_at: string
}

export default function CashPage() {
  const supabase = createClient()

  const [movements, setMovements] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(true)

  // Filtro de Período
  const [periodFilter, setPeriodFilter] = useState<'HOY' | 'ESTE_MES' | 'DESDE_ULTIMO_RETIRO' | 'HISTORICO'>('DESDE_ULTIMO_RETIRO')

  // Métricas Financieras
  const [totalSalesVolume, setTotalSalesVolume] = useState(0)
  const [totalCostVolume, setTotalCostVolume] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalSalesCount, setTotalSalesCount] = useState(0)

  // Estado para nuevo movimiento manual
  const [showModal, setShowModal] = useState(false)
  const [movementType, setMovementType] = useState<'ENTRADA_EFECTIVO' | 'RETIRO_EFECTIVO'>('RETIRO_EFECTIVO')
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('Retiro de Ganancias (Cierre de Ciclo)')
  const [customConcept, setCustomConcept] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchData = async () => {
    setLoading(true)

    try {
      // 1. Obtener todos los movimientos de caja
      const { data: movData } = await supabase
        .from('cash_movements')
        .select('*')
        .order('created_at', { ascending: false })

      const allMovements = movData || []
      setMovements(allMovements)

      // 2. Determinar la fecha filtro
      let startDateIso: string | null = null

      if (periodFilter === 'HOY') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        startDateIso = today.toISOString()
      } else if (periodFilter === 'ESTE_MES') {
        const firstDay = new Date()
        firstDay.setDate(1)
        firstDay.setHours(0, 0, 0, 0)
        startDateIso = firstDay.toISOString()
      } else if (periodFilter === 'DESDE_ULTIMO_RETIRO') {
        const lastWithdrawal = allMovements.find(m => 
          m.type === 'RETIRO_EFECTIVO' && 
          (m.concept.includes('Cierre') || m.concept.includes('Ganancias'))
        )
        if (lastWithdrawal) {
          startDateIso = lastWithdrawal.created_at
        }
      }

      // 3. Consultar las ventas filtrando por la tabla de ventas (sales)
      let salesQuery = supabase.from('sales').select('id, created_at')
      if (startDateIso && periodFilter !== 'HISTORICO') {
        salesQuery = salesQuery.gte('created_at', startDateIso)
      }

      const { data: salesData } = await salesQuery

      if (salesData && salesData.length > 0) {
        const saleIds = salesData.map(s => s.id)

        // Traer los items pertenecientes a esas ventas filtradas
        const { data: itemsData } = await supabase
          .from('sale_items')
          .select('quantity, subtotal, unit_price, unit_cost')
          .in('sale_id', saleIds)

        if (itemsData) {
          let salesSum = 0
          let costSum = 0

          itemsData.forEach((item: any) => {
            const subtotal = Number(item.subtotal) || 0
            const frozenCostUnit = item.unit_cost !== null && item.unit_cost !== undefined ? Number(item.unit_cost) : 0
            const itemCost = frozenCostUnit * (Number(item.quantity) || 1)

            salesSum += subtotal
            costSum += itemCost
          })

          setTotalSalesVolume(salesSum)
          setTotalCostVolume(costSum)
          setTotalProfit(salesSum - costSum)
          setTotalSalesCount(itemsData.length)
        }
      } else if (periodFilter === 'HISTORICO') {
        // Fallback en caso de seleccionar HISTORICO si no trae IDs explícitos
        const { data: itemsData } = await supabase
          .from('sale_items')
          .select('quantity, subtotal, unit_price, unit_cost')

        if (itemsData) {
          let salesSum = 0
          let costSum = 0

          itemsData.forEach((item: any) => {
            const subtotal = Number(item.subtotal) || 0
            const frozenCostUnit = item.unit_cost !== null && item.unit_cost !== undefined ? Number(item.unit_cost) : 0
            const itemCost = frozenCostUnit * (Number(item.quantity) || 1)

            salesSum += subtotal
            costSum += itemCost
          })

          setTotalSalesVolume(salesSum)
          setTotalCostVolume(costSum)
          setTotalProfit(salesSum - costSum)
          setTotalSalesCount(itemsData.length)
        }
      } else {
        // No hay ventas dentro del rango filtrado
        setTotalSalesVolume(0)
        setTotalCostVolume(0)
        setTotalProfit(0)
        setTotalSalesCount(0)
      }
    } catch (err) {
      console.error('Error en fetchData:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [periodFilter])

  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    const finalConcept = concept === 'OTRO' ? customConcept.trim() : concept

    if (isNaN(parsedAmount) || parsedAmount <= 0 || !finalConcept) {
      alert('Por favor ingresa un monto válido y especifica el concepto.')
      return
    }

    setProcessing(true)

    try {
      const { error } = await supabase.from('cash_movements').insert({
        type: movementType,
        amount: parsedAmount,
        concept: finalConcept
      })

      if (error) throw error

      setShowModal(false)
      setAmount('')
      setConcept('Retiro de Ganancias (Cierre de Ciclo)')
      setCustomConcept('')
      fetchData()
    } catch (err) {
      console.error('Error registrando movimiento:', err)
      alert('Error al registrar el movimiento en caja.')
    } finally {
      setProcessing(false)
    }
  }

  // Cálculos de Flujo de Efectivo
  const totalIn = movements
    .filter(m => m.type !== 'RETIRO_EFECTIVO')
    .reduce((acc, m) => acc + Number(m.amount), 0)

  const totalOut = movements
    .filter(m => m.type === 'RETIRO_EFECTIVO')
    .reduce((acc, m) => acc + Number(m.amount), 0)

  const cashBalance = totalIn - totalOut
  const profitMarginPercent = totalSalesVolume > 0 ? ((totalProfit / totalSalesVolume) * 100) : 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* ENCABEZADO Y FILTROS DE PERÍODO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Caja y Balance Financiero</h1>
          <p className="text-sm text-gray-500">
            Supervisa tus ventas, la recuperación de inversión basada en costos congelados y la utilidad real por período.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Período */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm text-xs font-bold">
            <Calendar className="w-3.5 h-3.5 text-gray-400 ml-2 mr-1" />
            <button
              onClick={() => setPeriodFilter('HOY')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${periodFilter === 'HOY' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Hoy
            </button>
            <button
              onClick={() => setPeriodFilter('DESDE_ULTIMO_RETIRO')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${periodFilter === 'DESDE_ULTIMO_RETIRO' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Ciclo Actual
            </button>
            <button
              onClick={() => setPeriodFilter('ESTE_MES')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${periodFilter === 'ESTE_MES' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setPeriodFilter('HISTORICO')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${periodFilter === 'HISTORICO' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Todo
            </button>
          </div>

          <button
            onClick={fetchData}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm text-xs transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Registrar Retiro / Cierre
          </button>
        </div>
      </div>

      {/* PANEL FINANCIERO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Ventas Totales */}
        <div className="p-5 bg-gradient-to-br from-blue-900 to-blue-800 text-white rounded-2xl shadow-sm space-y-1 relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 opacity-10 text-white">
            <DollarSign className="w-24 h-24 stroke-1" />
          </div>
          <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider block">Ventas en Período</span>
          <p className="text-3xl font-black">${totalSalesVolume.toFixed(2)}</p>
          <p className="text-[10px] text-blue-300">Ingreso bruto ({totalSalesCount} ítems)</p>
        </div>

        {/* Inversión Recuperada */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Inversión Recuperada
          </span>
          <p className="text-3xl font-extrabold text-gray-800">${totalCostVolume.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400">Costo exacto registrado al vender</p>
        </div>

        {/* Utilidad Neta */}
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Ganancia / Utilidad Neta
          </span>
          <p className="text-3xl font-black text-emerald-700">${totalProfit.toFixed(2)}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">
              {profitMarginPercent.toFixed(1)}% margen
            </span>
          </div>
        </div>

        {/* Efectivo Disponibilidad */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Efectivo en Cajón</span>
          <p className="text-3xl font-extrabold text-gray-900">${cashBalance.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400">Disponible tras retiros y entradas</p>
        </div>

      </div>

      {/* HISTORIAL Y BALANCE DE EFECTIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-gray-500" />
              <h3 className="font-bold text-gray-800 text-sm">Historial de Movimientos de Caja</h3>
            </div>
            <span className="text-xs text-gray-400 font-medium">{movements.length} registros</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase">
                  <th className="p-3">Fecha / Hora</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Concepto / Motivo</th>
                  <th className="p-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {loading ? (
                  <tr><td colSpan={4} className="p-6 text-center text-gray-400">Cargando movimientos...</td></tr>
                ) : movements.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-gray-400">No hay movimientos registrados.</td></tr>
                ) : (
                  movements.map(m => {
                    const isWithdrawal = m.type === 'RETIRO_EFECTIVO'
                    return (
                      <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 text-gray-500 whitespace-nowrap">
                          {new Date(m.created_at).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="p-3">
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            isWithdrawal ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {m.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-gray-800">{m.concept}</td>
                        <td className={`p-3 text-right font-black ${isWithdrawal ? 'text-red-600' : 'text-green-600'}`}>
                          {isWithdrawal ? '-' : '+'}${Number(m.amount).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen Lateral */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2 border-b pb-2">
              <PieChart className="w-4 h-4 text-blue-600" />
              Desglose de Flujo en Efectivo
            </h4>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50/50 rounded-xl border border-green-100">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-xs font-bold text-gray-800">Entradas de Efectivo</p>
                    <p className="text-[10px] text-gray-500">Ventas + Abonos + Capital</p>
                  </div>
                </div>
                <span className="font-black text-green-700 text-sm">+${totalIn.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-100">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-red-600" />
                  <div>
                    <p className="text-xs font-bold text-gray-800">Retiros de Efectivo</p>
                    <p className="text-[10px] text-gray-500">Proveedores + Ganancias</p>
                  </div>
                </div>
                <span className="font-black text-red-700 text-sm">-${totalOut.toFixed(2)}</span>
              </div>

              <div className="pt-2 border-t flex justify-between items-center">
                <span className="text-xs font-bold text-gray-600">Efectivo Neto:</span>
                <span className="text-lg font-black text-gray-900">${cashBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL REGISTRAR MOVIMIENTO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 relative">
            <h3 className="text-lg font-bold text-gray-900">Registrar Movimiento / Cierre</h3>

            <form onSubmit={handleRegisterMovement} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Tipo de Movimiento</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => { setMovementType('RETIRO_EFECTIVO'); setConcept('Retiro de Ganancias (Cierre de Ciclo)'); }}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                      movementType === 'RETIRO_EFECTIVO' ? 'border-red-600 bg-red-50 text-red-700 shadow-sm' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    Retiro (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMovementType('ENTRADA_EFECTIVO'); setConcept('Aportación de Capital'); }}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                      movementType === 'ENTRADA_EFECTIVO' ? 'border-green-600 bg-green-50 text-green-700 shadow-sm' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    Entrada (+)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Concepto / Motivo</label>
                <select
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {movementType === 'RETIRO_EFECTIVO' ? (
                    <>
                      <option value="Retiro de Ganancias (Cierre de Ciclo)">Retiro de Ganancias (Cierre de Ciclo)</option>
                      <option value="Pago a Proveedor (Surtido)">Pago a Proveedor (Surtido)</option>
                      <option value="Gasto de Operación / Servicios">Gasto de Operación / Servicios</option>
                      <option value="OTRO">Otro concepto...</option>
                    </>
                  ) : (
                    <>
                      <option value="Aportación de Capital">Aportación de Capital</option>
                      <option value="Fondo de Caja Inicial">Fondo de Caja Inicial</option>
                      <option value="OTRO">Otro concepto...</option>
                    </>
                  )}
                </select>
              </div>

              {concept === 'OTRO' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600">Escribe el concepto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pago de flete"
                    value={customConcept}
                    onChange={(e) => setCustomConcept(e.target.value)}
                    className="w-full mt-1 p-2 bg-gray-50 border rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-600">Monto ($) *</label>
                <input
                  type="number"
                  required
                  step="0.50"
                  placeholder="Ej. 200"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-gray-50 border rounded-xl text-lg font-bold text-gray-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.98]"
                >
                  {processing ? 'Guardando...' : 'Guardar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
