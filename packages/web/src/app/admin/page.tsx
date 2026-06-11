"use client"

import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useApiError } from "@/hooks/useApiError"
import { api } from "@/lib/api"
import { useI18n } from "@/providers/I18nProvider"
import { motion } from "framer-motion"
import { Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function AdminLoginPage() {
  const router = useRouter()
  const { t } = useI18n()
  const { getErrorMessage } = useApiError()

  const [password, setPassword] = useState("")
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      setError(t.admin.login.passwordRequired)
      return
    }
    setError(undefined)
    setLoading(true)
    try {
      await api.admin.login(password)
      router.push("/admin/dashboard")
    } catch (err) {
      setError(getErrorMessage(err) ?? t.admin.login.loginFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-accent-soft to-cream px-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-accent-soft bg-white p-8 shadow-lg"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
            <Lock className="h-7 w-7 text-accent" />
          </div>
          <h1 className="font-display text-3xl text-accent-dark">{t.admin.login.title}</h1>
          <p className="mt-1 text-sm text-ink/50">{t.admin.login.subtitle}</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input
            type="password"
            label={t.admin.login.passwordLabel}
            placeholder={t.admin.login.passwordPlaceholder}
            value={password}
            error={error}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <Button type="submit" size="lg" loading={loading} className="w-full">
            {t.admin.login.loginBtn}
          </Button>
        </form>
      </motion.div>
    </main>
  )
}
