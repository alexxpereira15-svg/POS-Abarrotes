'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ShoppingBag, Package, Users, Store, Wallet, BarChart3, LogOut } from 'lucide-react'

export default function Navbar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [pathname])

  // OCULTAR BARRA DE NAVEGACIÓN EN PÁGINAS PÚBLICAS O SIN SESIÓN
  if (pathname === '/catalogo' || pathname === '/login' || !user) {
    return null
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
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
        <div className="flex justify-between h-16 items-center">
          
          <Link href="/pos" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base text-gray-900 tracking-tight block leading-none">
                Abarrotes POS
              </span>
              <span className="text-[10px] text-gray-400 font-semibold tracking-wide uppercase">
                Panel Admin
              </span>
            </div>
          </Link>

          <nav className="flex gap-1 sm:gap-2 items-center">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
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
              className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
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
