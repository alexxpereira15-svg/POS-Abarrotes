'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/types'
import { UserPlus, Search, DollarSign, FileText, Share2, X, CreditCard } from 'lucide-react'

export default function CustomersPage() {
  const supabase = createClient()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Modales
  const [showNewModal, setShowNewModal] = useState(false)
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null)
  const [statementData, setStatementData] = useState<{ sales: any[]; payments: any[] }>({ sales: [], payments: [] })
  const [loadingStatement, setLoadingStatement] = useState(false)

  // Formulario Nuevo Cliente
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [creditLimit, setCreditLimit] = useState('500')

  // Formulario Abono
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

  // Cargar Estado de Cuenta (Compras fiadas + Abonos)
  const openStatement = async (c: Customer) => {
    setStatementCustomer(c)
    setLoadingStatement(true)

    try {
      // 1. Consultar ventas a crédito con sus items
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          id, sale_code, total_amount, created_at,
          sale_items (
            quantity, unit_price, subtotal,
            products ( name )
          )
        `)
        .eq('customer_id', c.id)
        .eq('payment_type', 'CREDITO')
        .order('created_at', { ascending: false })

      // 2. Consultar abonos
      const { data: paymentsData } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('customer_id', c.id)
        .order('created_at', { ascending: false })

      setStatementData({
        sales: salesData || [],
        payments: paymentsData || []
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingStatement(false)
    }
  }

  // Generar WhatsApp con Estado de Cuenta
  const generateStatementWhatsApp = () => {
    if (!statementCustomer) return ''

    let text = `*Estado de Cuenta - La Tiendita*\n`
    text += `Cliente: *${statementCustomer.full_name}*\n`
    text += `Fecha: ${new Date().toLocaleDateString('es-MX')}\n`
    text += `--------------------------------\n`
    text += `*DEUDA ACTUAL PENDIENTE: $${statementCustomer.current_balance.toFixed(2)}*\n`
    text += `--------------------------------\n\n`

    if (statementData.sales.length > 0) {
      text += `*Últimas Compras Fiadas:*\n`
      statementData.sales.forEach(sale => {
        text += `• *${sale.sale_code}* (${new Date(sale.created_at).toLocaleDateString('es-MX')}): $${sale.total_amount.toFixed(2)}\n`
        sale.sale_items?.forEach((item: any) => {
          text += `  - ${item.quantity}x ${item.products?.name || 'Producto'} ($${item.subtotal.toFixed(2)})\n`
        })
      })
    }

    if (statementData.payments.length > 0) {
      text += `\n*Abonos Recientes:*\n`
      statementData.payments.forEach(pay => {
        text += `• ${new Date(pay.created_at).toLocaleDateString('es-MX')}: -$${pay.amount.toFixed(2)} (${pay.payment_method})\n`
      })
    }

    text += `\n¡Gracias por tu preferencia!`

    return `https://wa.me/${statementCustomer.phone ? '521' + statementCustomer.phone : ''}?text=${encodeURIComponent(text)}`
  }

  // Crear Cliente
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

  // Registrar Abono
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
      const { error: payError } = await supabase.from('customer_payments').insert({
        customer_id: selectedCustomer.id,
        amount: amount,
        payment_method: paymentMethod,
        notes: notes.trim() || 'Abono a cuenta'
      })

      if (payError) throw payError

      const newBalance = Math.max(0, selectedCustomer.current_balance - amount)
      const { error: custError } = await supabase
        .from('customers')
        .update({ current_balance: newBalance })
        .eq('id', selectedCustomer.id)

      if (custError) throw custError

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Clientes y Fiados</h1>
          <p className="text-sm text-gray-500">Administra cuentas corrientes, límites de crédito, desgloses y abonos.</p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
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
                  <td className="p-4 text-right space-x-1">
                    <button
                      onClick={() => openStatement(c)}
                      className="py-1.5 px-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-bold text-xs inline-flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Estado de Cuenta
                    </button>
                    <button
                      onClick={() => setSelectedCustomer(c)}
                      className="py-1.5 px-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-xs inline-flex items-center gap-1"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Abonar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: ESTADO DE CUENTA / HISTORIAL DE DEUDA */}
      {statementCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Estado de Cuenta</h3>
                <p className="text-xs text-gray-500">Cliente: <span className="font-bold text-gray-800">{statementCustomer.full_name}</span></p>
              </div>
              <button onClick={() => setStatementCustomer(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-red-700">Deuda Pendiente Total:</span>
              <span className="text-xl font-black text-red-700">${statementCustomer.current_balance.toFixed(2)}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {loadingStatement ? (
                <p className="text-center text-xs text-gray-400 py-6">Cargando desglose de compras...</p>
              ) : (
                <>
                  {/* COMPRAS FIADAS */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Compras Fiadas</h4>
                    {statementData.sales.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Sin registros de compras a crédito.</p>
                    ) : (
                      <div className="space-y-2">
                        {statementData.sales.map(s => (
                          <div key={s.id} className="p-3 bg-gray-50 border rounded-xl space-y-1.5 text-xs">
                            <div className="flex justify-between font-bold text-gray-800">
                              <span>Folio: {s.sale_code}</span>
                              <span className="text-red-600">${s.total_amount.toFixed(2)}</span>
                            </div>
                            <p className="text-[10px] text-gray-400">{new Date(s.created_at).toLocaleString('es-MX')}</p>
                            
                            {/* Desglose de Productos */}
                            <div className="border-t border-gray-200 pt-1 space-y-0.5">
                              {s.sale_items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-gray-600 text-[11px]">
                                  <span>{item.quantity}x {item.products?.name || 'Producto'}</span>
                                  <span>${item.subtotal.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ABONOS REALIZADOS */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Abonos Realizados</h4>
                    {statementData.payments.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Sin abonos registrados.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {statementData.payments.map(p => (
                          <div key={p.id} className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-emerald-800">Abono ({p.payment_method})</span>
                              <p className="text-[10px] text-gray-500">{new Date(p.created_at).toLocaleString('es-MX')}</p>
                            </div>
                            <span className="font-black text-emerald-700">-${p.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="pt-2 border-t flex gap-2">
              <a
                href={generateStatementWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-xs"
              >
                <Share2 className="w-4 h-4" />
                Enviar Estado por WhatsApp
              </a>
              <button
                onClick={() => setStatementCustomer(null)}
                className="py-2.5 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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
