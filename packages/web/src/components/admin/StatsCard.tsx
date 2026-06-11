import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatsCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  accent?: "purple" | "amber" | "green" | "red" | "blue"
}

const accentClasses: Record<NonNullable<StatsCardProps["accent"]>, string> = {
  purple: "bg-accent-soft text-accent",
  amber: "bg-amber-100 text-amber-600",
  green: "bg-green-100 text-green-600",
  red: "bg-red-100 text-red-500",
  blue: "bg-blue-100 text-blue-600",
}

export function StatsCard({ label, value, icon: Icon, accent = "purple" }: StatsCardProps) {
  return (
    <div className="rounded-2xl border border-accent-soft bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink/50">{label}</span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            accentClasses[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 font-display text-4xl font-semibold text-ink">{value}</p>
    </div>
  )
}
