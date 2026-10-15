'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingBag, Package, Users, Store } from 'lucide-react'

export default function Navbar() {
  const pathname = usePathname()

  const navItems = [
    { name: 'Caja / POS', href: '/pos', icon: ShoppingBag },
    { name: 'Productos', href: '/productos', icon: Package },
    { name: 'Clientes & Fiados', href: '/clientes', icon: Users },
  ]

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* LOGO TIENDA */}
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg text-gray-900 tracking-tight">
              Abarrotes POS
            </span>
          </div>

          {/* ENLACES DE NAVEGACIÓN */}
          <nav className="flex gap-1 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

        </div>
      </div>
    </header>
  )
}
