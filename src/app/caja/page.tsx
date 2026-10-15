'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, ArrowUpRight, ArrowDownLeft, Plus, History, TrendingUp, ShieldCheck, RefreshCw, Landmark, Wallet, CheckCircle2 } from 'lucide-react'

interface CashMovement {
  id: string
  type: 'ENTRADA_EFECTIVO' | 'RETIRO_EFECTIVO' | 'VENTA_EFECTIVO' | 'ABONO_EFECTIVO'
  account_type?: 'EFECTIVO' | 'BANCO'
  amount: number
  concept: string
  created_at: string
}

export default function CashPage() {
  const supabase = createClient()

  const [movements, setMovements] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(true)

  // Métricas Financieras del Ciclo Actual
  const [totalSalesVolume, setTotalSalesVolume] = useState(0)
  const [totalCostVolume, setTotalCostVolume] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalSalesCount, setTotalSalesCount] = useState(0)

  // Modales
  const [showModal, setShowModal] = useState(false)
  const [withdrawalMode, setWithdrawalMode] = useState<'GANANCIAS' | 'CIERRE_TOTAL' | 'PROVEEDOR' | 'ENTRADA'>('GANANCIAS')
  const [accountType, setAccountType] = useState<'EFECTIVO' | 'BANCO'>('EFECTIVO')
  const [amount, setAmount] = useState('')
  const [customConcept, setCustomConcept] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchData = async () => {
    setLoading(true)

    try {
      // 1. Obtener movimientos de caja
      const { data: movData } = await supabase
        .from('cash_movements')
        .select('*')
        .order('created_at', { ascending: false })

      const allMovements = movData || []
      setMovements(allMovements)

      // Encontrar la fecha del último "Cierre de Ciclo"
      const lastCycleClosure = allMovements.find(m => 
        m.type === 'RETIRO_EFECTIVO' && m.concept.includes('CIERRE DE CICLO')
      )

      let cycleStartDateIso: string | null = null
      if (lastCycleClosure) {
        cycleStartDateIso = lastCycleClosure.created_at
      }

      // 2. Consultar ventas a partir del último cierre de ciclo
      let salesQuery = supabase.from('sales').select('id, created_at')
      if (cycleStartDateIso) {
        salesQuery = salesQuery.gt('created_at', cycleStartDateIso)
      }

      const { data: salesData } = await salesQuery

      if (salesData && salesData.length > 0) {
        const saleIds = salesData.map(s => s.id)

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
      } else {
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
  }, [])

  // Registrar Retiro o Entrada
  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault()

    let finalAmount = parseFloat(amount)
    let finalConcept = ''

    if (withdrawalMode === 'CIERRE_TOTAL') {
      finalAmount = totalSalesVolume
      finalConcept = `CIERRE DE CICLO (Inversión: $${totalCostVolume.toFixed(2)} + Ganancia: $${totalProfit.toFixed(2)})`
    } else if (withdrawalMode === 'GANANCIAS') {
      finalAmount = parseFloat(amount) || totalProfit
      finalConcept = `Retiro de Ganancias Limpias`
    } else if (withdrawalMode === 'PROVEEDOR') {
      finalAmount = parseFloat(amount)
      finalConcept = `Pago a Proveedor (Surtido)`
    } else {
      finalAmount = parseFloat(amount)
      finalConcept = customConcept.trim() || 'Aportación de Capital / Entrada'
    }

    if (isNaN(finalAmount) || finalAmount <= 0) {
      alert('Ingresa un monto válido para registrar.')
      return
    }

    setProcessing(true)

    try {
      const type = withdrawalMode === 'ENTRADA' ? 'ENTRADA_EFECTIVO' : 'RETIRO_EFECTIVO'

      const { error } = await supabase.from('cash_movements').insert({
        type,
        account_type: accountType,
        amount: finalAmount,
        concept: `${finalConcept} [${accountType}]`
      })

      if (error) throw error

      setShowModal(false)
      setAmount('')
      setCustomConcept('')
      fetchData()
    } catch (err) {
      console.error(err)
      alert('Error al registrar movimiento.')
    } finally {
      setProcessing(false)
    }
  }

  // CÁLCULOS SEPARADOS: CAJÓN VS. BANCO
  const cashIn = movements
    .filter(m => (m.account_type === 'EFECTIVO' || !m.account_type) && m.type !== 'RETIRO_EFECTIVO')
    .reduce((acc, m) => acc + Number(m.amount), 0)

  const cashOut = movements
    .filter(m => (m.account_type === 'EFECTIVO' || !m.account_type) && m.type === 'RETIRO_EFECTIVO')
    .reduce((acc, m) => acc + Number(m.amount), 0)

  const bankIn = movements
    .filter(m => m.account_type === 'BANCO' && m.type !== 'RETIRO_EFECTIVO')
    .reduce((acc, m) => acc + Number(m.amount), 0)

  const bankOut = movements
    .filter(m => m.account_type === 'BANCO' && m.type === 'RETIRO_EFECTIVO')
    .reduce((acc, m) => acc + Number(m.amount), 0)

  const cashBalance = cashIn - cashOut
  const bankBalance = bankIn - bankOut
  const totalBalance = cashBalance + bankBalance

  const profitMarginPercent = totalSalesVolume > 0 ? ((totalProfit / totalSalesVolume) * 100) : 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Caja y Ciclos de Venta</h1>
          <p className="text-sm text-gray-500">
            Supervisa tus ganancias, la reinversión y los saldos independientes en efectivo y transferencias.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setWithdrawalMode('GANANCIAS')
              setAmount(totalProfit > 0 ? totalProfit.toFixed(2) : '')
              setShowModal(true)
            }}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm text-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Registrar Retiro / Cierre
          </button>
        </div>
      </div>

      {/* PANEL DEL CICLO ACTUAL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Ventas Totales del Ciclo */}
        <div className="p-5 bg-gradient-to-br from-blue-900 to-blue-800 text-white rounded-2xl shadow-sm space-y-1 relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 opacity-10 text-white">
            <DollarSign className="w-24 h-24 stroke-1" />
          </div>
          <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider block">Ventas en Ciclo Actual</span>
          <p className="text-3xl font-black">${totalSalesVolume.toFixed(2)}</p>
          <p className="text-[10px] text-blue-300">Ingreso acumulado ({totalSalesCount} ítems)</p>
        </div>

        {/* Inversión Recuperada */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Fondo de Reinversión
          </span>
          <p className="text-3xl font-extrabold text-gray-800">${totalCostVolume.toFixed(2)}</p>
          <p className="text-[10px] text-gray-400">Costo destinado a reponer inventario</p>
        </div>

        {/* Utilidad Neta del Ciclo */}
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Ganancia Neta Acumulada
          </span>
          <p className="text-3xl font-black text-emerald-700">${totalProfit.toFixed(2)}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">
              {profitMarginPercent.toFixed(1)}% margen
            </span>
          </div>
        </div>

      </div>

      {/* RECUADROS INDEPENDIENTES: EFECTIVO VS BANCOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Cajón de Efectivo */}
        <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase block">Efectivo Físico en Cajón</span>
              <p className="text-xl font-black text-gray-900">${cashBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Banco / Transferencias */}
        <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase block">Banco / Transferencias</span>
              <p className="text-xl font-black text-gray-900">${bankBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Total General */}
        <div className="p-4 bg-gray-900 text-white rounded-2xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gray-800 text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase block">Total Disponible</span>
              <p className="text-xl font-black text-white">${totalBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>

      </div>

      {/* HISTORIAL DE MOVIMIENTOS */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-500" />
            <h3 className="font-bold text-gray-800 text-sm">Historial de Entradas, Retiros y Cierres</h3>
          </div>
          <span className="text-xs text-gray-400 font-medium">{movements.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase">
                <th className="p-3">Fecha / Hora</th>
                <th className="p-3">Origen</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Concepto / Motivo</th>
                <th className="p-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">Cargando movimientos...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">No hay movimientos registrados.</td></tr>
              ) : (
                movements.map(m => {
                  const isWithdrawal = m.type === 'RETIRO_EFECTIVO'
                  const isBank = m.account_type === 'BANCO'

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
                          isBank ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isBank ? 'BANCO' : 'EFECTIVO'}
                        </span>
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

      {/* MODAL REGISTRAR MOVIMIENTO / CIERRE DE CICLO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <h3 className="text-lg font-bold text-gray-900">Registrar Retiro o Cierre</h3>

            <form onSubmit={handleRegisterMovement} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Selecciona el Tipo de Movimiento</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawalMode('GANANCIAS')
                      setAmount(totalProfit > 0 ? totalProfit.toFixed(2) : '')
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      withdrawalMode === 'GANANCIAS' ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <span className="font-bold text-xs block">Retirar Ganancias</span>
                    <span className="text-[10px] text-gray-500">Solo utilidades limpias</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawalMode('CIERRE_TOTAL')
                      setAmount(totalSalesVolume.toFixed(2))
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      withdrawalMode === 'CIERRE_TOTAL' ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <span className="font-bold text-xs block">Cierre de Ciclo</span>
                    <span className="text-[10px] text-gray-500">Retiro general + reiniciar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setWithdrawalMode('PROVEEDOR'); setAmount(''); }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      withdrawalMode === 'PROVEEDOR' ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-sm' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <span className="font-bold text-xs block">Pago a Proveedor</span>
                    <span className="text-[10px] text-gray-500">Surtido de mercancía</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setWithdrawalMode('ENTRADA'); setAmount(''); }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      withdrawalMode === 'ENTRADA' ? 'border-green-600 bg-green-50 text-green-900 shadow-sm' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <span className="font-bold text-xs block">Entrada de Capital</span>
                    <span className="text-[10px] text-gray-500">Aportación a caja</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">¿De qué cuenta sale / entra?</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setAccountType('EFECTIVO')}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                      accountType === 'EFECTIVO' ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    💵 Cajón de Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('BANCO')}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                      accountType === 'BANCO' ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    🏦 Cuenta Bancaria
                  </button>
                </div>
              </div>

              {/* RESUMEN DEL CIERRE DE CICLO SI SE SELECCIONA CIERRE TOTAL */}
              {withdrawalMode === 'CIERRE_TOTAL' ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 text-xs">
                  <p className="font-bold text-blue-900 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" /> Desglose del Cierre
                  </p>
                  <div className="flex justify-between text-blue-800">
                    <span>Inversión a Reponer:</span>
                    <span className="font-bold">${totalCostVolume.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>Ganancia Limpia:</span>
                    <span>+${totalProfit.toFixed(2)}</span>
                  </div>
                  <div className="pt-1 border-t border-blue-200 flex justify-between font-black text-blue-900 text-sm">
                    <span>Monto Total Retirado:</span>
                    <span>${totalSalesVolume.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-blue-600 italic">
                    Al confirmar, el marcador del ciclo actual se reiniciará a $0.00.
                  </p>
                </div>
              ) : (
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
              )}

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
                  {processing ? 'Guardando...' : 'Confirmar y Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
