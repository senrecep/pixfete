import { Spinner } from "@/components/ui/Spinner"

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <Spinner className="h-10 w-10" />
    </div>
  )
}
