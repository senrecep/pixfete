"use client"

import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import { BarChart3, ImageIcon, LayoutDashboard, LogOut, QrCode, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()

  const navItems = [
    { href: "/admin/dashboard", label: t.admin.layout.nav.dashboard, icon: LayoutDashboard },
    { href: "/admin/moderation", label: t.admin.layout.nav.moderation, icon: ImageIcon },
    { href: "/admin/analytics", label: t.admin.layout.nav.analytics, icon: BarChart3 },
    { href: "/admin/qr", label: t.nav.qr, icon: QrCode },
    { href: "/admin/settings", label: t.admin.layout.nav.settings, icon: Settings },
  ]

  const onLogout = async () => {
    try {
      await api.admin.logout()
    } catch {
      // ignore — clear client state regardless
    }
    toast.success(t.admin.layout.loggedOut)
    router.push("/admin")
  }

  return (
    <div className="flex min-h-screen bg-cream">
      <aside className="hidden w-64 flex-col border-r border-accent-soft bg-white md:flex">
        <div className="px-6 py-6">
          <p className="font-display text-2xl text-accent-dark">{t.admin.layout.brand}</p>
          <p className="text-xs tracking-widest text-ink/40 uppercase">
            {t.admin.layout.management}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent-dark"
                    : "text-ink/60 hover:bg-accent-soft/60",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-ink/60 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <LogOut className="h-5 w-5" />
            {t.admin.layout.logout}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-accent-soft bg-white px-5 py-4 md:hidden">
          <p className="font-display text-xl text-accent-dark">{t.admin.layout.mobileTitle}</p>
          <button
            type="button"
            onClick={onLogout}
            aria-label={t.admin.layout.logoutLabel}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink/60 hover:text-red-500"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-accent-soft bg-white px-3 py-2 md:hidden">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium",
                  active ? "bg-accent-soft text-accent-dark" : "text-ink/60",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  )
}
