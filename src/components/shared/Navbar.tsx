'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ShoppingBag, Package, Users, Store, Wallet, BarChart3, LogOut, Copy, Check, Share2 } from 'lucide-react'

export default function Navbar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [pathname])

  // Ocultar Navbar en páginas públicas o sin sesión
  if (pathname === '/catalogo' || pathname === '/login' || !user) {
    return null
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Copiar el link del catálogo al portapapeles
  const handleCopyCatalogLink = () => {
    const catalogUrl = `${window.location.origin}/catalogo`
    navigator.clipboard.writeText(catalogUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Abrir WhatsApp para enviar el link directamente
  const handleShareWhatsApp = () => {
    const catalogUrl = `${window.location.origin}/catalogo`
    const text = `*¡Hola!* Te comparto el catálogo digital de *Abarrotes el niño* para que consultes nuestros productos y hagas tu pedido:\n\n👉 ${catalogUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const navItems = [
    { name: 'Caja / POS', href: '/pos', icon: ShoppingBag },
    { name: 'Productos', href: '/productos', icon: Package },
    { name: 'Clientes & Fiados', href: '/clientes', icon: Users },
    { name: 'Corte / Caja', href: '/caja', icon: Wallet },
    { name: 'Reportes', href: '/reportes', icon: BarChart3 },
  ]

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center gap-4">
          
          {/* LOGO E IDENTIDAD */}
          <Link href="/pos" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity shrink-0">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base text-gray-900 tracking-tight block leading-none">
                Abarrotes el niño
              </span>
              <span className="text-[10px] text-gray-400 font-semibold tracking-wide uppercase">
                Panel Admin
              </span>
            </div>
          </Link>

          {/* BOTONES RÁPIDOS PARA COMPARTIR CATÁLOGO */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 p-1 rounded-xl">
            <button
              onClick={handleCopyCatalogLink}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                copied
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
              title="Copiar enlace del catálogo"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
              <span>{copied ? '¡Copiado!' : 'Copiar Catálogo'}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors border border-emerald-200"
              title="Compartir directo por WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* MENÚ DE NAVEGACIÓN */}
          <nav className="flex gap-1 sm:gap-2 items-center overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span>{item.name}</span>
                </Link>
              )
            })}

            <button
              onClick={handleLogout}
              className="ml-1 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </nav>

        </div>
      </div>
    </header>
  )
}
