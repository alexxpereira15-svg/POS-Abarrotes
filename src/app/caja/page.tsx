'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, ArrowUpRight, ArrowDownLeft, Plus, History } from 'lucide-react'

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

  // Estado para nuevo movimiento manual
  const [showModal, setShowModal] = useState(false)
  const [movementType, setMovementType] = useState<'ENTRADA_EFECTIVO' | 'RETIRO_EFECTIVO'>('RETIRO_EFECTIVO')
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchMovements = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cash_movements')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setMovements(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchMovements()
  }, [])

  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0 || !concept.trim()) {
      alert('Ingresa un monto válido y un concepto.')
      return
    }

    setProcessing(true)

    try {
      const { error } = await supabase.from('cash_movements').insert({
        type: movementType,
        amount: parsedAmount,
        concept: concept.trim()
      })

      if (error) throw error

      setShowModal(false)
      setAmount('')
      setConcept('')
      fetchMovements()
    } catch (err) {
      console.error(err)
      alert('Error al registrar movimiento.')
    } finally {
      setProcessing(false)
    }
  }

  // Cálculos de Caja
  const totalIn = movements
    .filter(m => m.type !== 'RETIRO_EFECTIVO')
    .reduce((acc, m) => acc + m.amount, 0)

  const totalOut = movements
    .filter(m => m.type === 'RETIRO_EFECTIVO')
    .reduce((acc, m) => acc + m.amount, 0)

  const cashBalance = totalIn - totalOut

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Caja</h1>
          <p className="text-sm text-gray-500">Administra retiros, entradas de efectivo y arqueo acumulado.</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          Registrar Retiro / Entrada
        </button>
      </div>

      {/* TARJETAS RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Balance Actual en Caja</span>
          <p className="text-3xl font-black text-gray-900 mt-1">${cashBalance.toFixed(2)}</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-green-600 uppercase flex items-center gap-1">
            <ArrowDownLeft className="w-4 h-4" /> Entradas Totales
          </span>
          <p className="text-2xl font-bold text-green-700 mt-1">${totalIn.toFixed(2)}</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-red-600 uppercase flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" /> Retiros Totales
          </span>
          <p className="text-2xl font-bold text-red-700 mt-1">${totalOut.toFixed(2)}</p>
        </div>
      </div>

      {/* TABLA DE MOVIMIENTOS */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <History className="w-5 h-5 text-gray-500" />
          <h3 className="font-bold text-gray-800">Historial de Movimientos de Caja</h3>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
              <th className="p-4">Fecha / Hora</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Concepto</th>
              <th className="p-4 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {loading ? (
              <tr><td colSpan={4} className="p-6 text-center text-gray-400">Cargando movimientos...</td></tr>
            ) : movements.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-gray-400">No hay movimientos registrados.</td></tr>
            ) : (
              movements.map(m => {
                const isWithdrawal = m.type === 'RETIRO_EFECTIVO'
                return (
                  <tr key={m.id} className="hover:bg-gray-50/50">
                    <td className="p-4 text-xs text-gray-500">
                      {new Date(m.created_at).toLocaleString('es-MX')}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        isWithdrawal ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {m.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-gray-800">{m.concept}</td>
                    <td className={`p-4 text-right font-extrabold ${isWithdrawal ? 'text-red-600' : 'text-green-600'}`}>
                      {isWithdrawal ? '-' : '+'}${m.amount.toFixed(2)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL REGISTRAR MOVIMIENTO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Registrar Movimiento de Caja</h3>

            <form onSubmit={handleRegisterMovement} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Tipo de Movimiento</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setMovementType('RETIRO_EFECTIVO')}
                    className={`py-2 rounded-lg border text-xs font-bold ${
                      movementType === 'RETIRO_EFECTIVO' ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200'
                    }`}
                  >
                    Retiro (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('ENTRADA_EFECTIVO')}
                    className={`py-2 rounded-lg border text-xs font-bold ${
                      movementType === 'ENTRADA_EFECTIVO' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200'
                    }`}
                  >
                    Entrada (+)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Monto ($) *</label>
                <input
                  type="number"
                  required
                  step="0.5"
                  placeholder="Ej. 200"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-lg font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Concepto / Motivo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Retiro de ganancias / Pago a proveedor"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  {processing ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
