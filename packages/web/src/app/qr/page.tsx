import { redirect } from "next/navigation"

// The public QR/invitation download page moved to the admin panel
// (/admin/qr) so guests can't download it in public. Bookmarked links to
// /qr are redirected home, where the QR remains visible for scanning.
export default function QrRedirect() {
  redirect("/")
}
