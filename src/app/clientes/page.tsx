'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/types'
import { UserPlus, Search, DollarSign, History, CheckCircle, CreditCard } from 'lucide-react'

export default function CustomersPage() {
  const supabase = createClient()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Estados para nuevo cliente
  const [showNewModal, setShowNewModal] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [creditLimit, setCreditLimit] = useState('500')

  // Estados para registrar abono
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchCustomers = async () => {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    if (data) setCustomers(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  // Guardar nuevo cliente
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return

    const { error } = await supabase.from('customers').insert({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      credit_limit: parseFloat(creditLimit) || 500
    })

    if (error) {
      alert('Error al guardar cliente.')
    } else {
      setShowNewModal(false)
      setFullName('')
      setPhone('')
      setCreditLimit('500')
      fetchCustomers()
    }
  }

  // Registrar abono
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer) return

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Ingresa un monto válido para abonar.')
      return
    }

    setProcessing(true)

    try {
      // 1. Insertar abono en la tabla customer_payments
      const { error: payError } = await supabase.from('customer_payments').insert({
        customer_id: selectedCustomer.id,
        amount: amount,
        payment_method: paymentMethod,
        notes: notes.trim() || 'Abono a cuenta'
      })

      if (payError) throw payError

      // 2. Restar deuda en la tabla customers
      const newBalance = Math.max(0, selectedCustomer.current_balance - amount)
      const { error: custError } = await supabase
        .from('customers')
        .update({ current_balance: newBalance })
        .eq('id', selectedCustomer.id)

      if (custError) throw custError

      // 3. Registrar entrada en caja si fue en efectivo
      if (paymentMethod === 'EFECTIVO') {
        await supabase.from('cash_movements').insert({
          type: 'ABONO_EFECTIVO',
          amount: amount,
          concept: `Abono de ${selectedCustomer.full_name}`
        })
      }

      alert('¡Abono registrado con éxito!')
      setSelectedCustomer(null)
      setPaymentAmount('')
      setNotes('')
      fetchCustomers()
    } catch (err) {
      console.error(err)
      alert('Ocurrió un error al procesar el abono.')
    } finally {
      setProcessing(false)
    }
  }

  const filteredCustomers = customers.filter(c =>
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery))
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Clientes y Fiados</h1>
          <p className="text-sm text-gray-500">Administra cuentas corrientes, límites de crédito y abonos.</p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* TABLA DE CLIENTES */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="p-4">Cliente</th>
              <th className="p-4">Teléfono</th>
              <th className="p-4">Deuda Actual</th>
              <th className="p-4">Límite de Crédito</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">Cargando clientes...</td></tr>
            ) : filteredCustomers.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">No hay clientes registrados.</td></tr>
            ) : (
              filteredCustomers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="p-4 font-bold text-gray-900">{c.full_name}</td>
                  <td className="p-4 text-gray-500">{c.phone || 'Sin número'}</td>
                  <td className="p-4">
                    <span className={`font-extrabold ${c.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${c.current_balance.toFixed(2)}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">${c.credit_limit.toFixed(2)}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedCustomer(c)}
                      className="py-1.5 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-xs inline-flex items-center gap-1"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Registrar Abono
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: NUEVO CLIENTE */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Registrar Nuevo Cliente</h3>
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Teléfono (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. 9991234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Límite de Crédito ($)</label>
                <input
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm font-bold"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR ABONO */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Registrar Abono</h3>
              <p className="text-xs text-gray-500">Cliente: <span className="font-bold text-gray-800">{selectedCustomer.full_name}</span></p>
              <p className="text-xs text-red-600 font-bold mt-1">Deuda actual: ${selectedCustomer.current_balance.toFixed(2)}</p>
            </div>

            <form onSubmit={handleRegisterPayment} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Monto a Abonar ($)</label>
                <input
                  type="number"
                  required
                  step="0.50"
                  placeholder="Ej. 100"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-gray-50 border rounded-lg text-lg font-extrabold text-green-700"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Método de Pago</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('EFECTIVO')}
                    className={`py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 ${
                      paymentMethod === 'EFECTIVO' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TRANSFERENCIA')}
                    className={`py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 ${
                      paymentMethod === 'TRANSFERENCIA' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Transferencia
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Nota / Concepto (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Abono a cuenta de la semana"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border rounded-lg text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  {processing ? 'Guardando...' : 'Confirmar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
