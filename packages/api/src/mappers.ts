import type { Photo, StorageProvider } from "@pixfete/shared"
import type { PhotoRow, UploadSessionRow } from "./db/schema"

/** Maps a photos row joined with its uploader session into the shared Photo shape. */
export function toPhoto(row: PhotoRow, session: Pick<UploadSessionRow, "uploaderName" | "uploaderPhone">): Photo {
  return {
    id: row.id,
    uploaderSessionId: row.uploaderSessionId,
    uploaderName: session.uploaderName,
    uploaderPhone: session.uploaderPhone ?? null,
    fileName: row.fileName,
    originalSize: row.originalSize,
    storageType: row.storageType as StorageProvider,
    storageKey: row.storageKey,
    publicUrl: row.publicUrl ?? null,
    status: row.status as Photo["status"],
    mimeType: row.mimeType,
    width: row.width ?? null,
    height: row.height ?? null,
    uploadedAt: row.uploadedAt,
    approvedAt: row.approvedAt ?? null,
    rejectedAt: row.rejectedAt ?? null,
    rejectionReason: row.rejectionReason ?? null,
  }
}
