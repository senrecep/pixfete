"use client"

import { cn } from "@/lib/utils"
import { useEvent } from "@/providers/EventProvider"
import { useI18n } from "@/providers/I18nProvider"
import { Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

export function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { t } = useI18n()
  const { event } = useEvent()

  const navItems = [
    { href: "/", label: t.nav.home },
    { href: "/gallery", label: t.nav.gallery },
    { href: "/upload", label: t.nav.upload },
  ]

  return (
    <header className="sticky top-0 z-30 border-b border-accent-soft/80 bg-cream/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="font-display text-2xl font-medium tracking-wide text-accent-dark">
          {event.title}
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-accent-soft text-accent-dark"
                  : "text-ink/60 hover:bg-accent-soft hover:text-accent-dark",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            className="rounded-full p-2.5 text-accent-dark"
            aria-label={open ? t.nav.menuClose : t.nav.menuOpen}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-accent-soft/80 bg-cream px-5 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-accent-soft text-accent-dark"
                    : "text-ink/70 hover:bg-accent-soft",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  )
}
