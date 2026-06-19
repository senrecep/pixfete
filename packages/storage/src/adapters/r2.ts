import { readFile, writeFile } from "node:fs/promises"
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { PRESIGNED_URL_EXPIRY_SECONDS } from "@pixfete/shared"
import type { StorageProvider } from "@pixfete/shared"
import { nameToSlug } from "../pathUtils"
import type { PrepareUploadOpts, PreparedUpload, StorageAdapter } from "../types"

export interface R2StorageConfig {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl: string
}

export class R2StorageAdapter implements StorageAdapter {
  readonly provider: StorageProvider = "r2"
  private readonly client: S3Client
  private readonly bucket: string
  private readonly publicUrl: string

  constructor(config: R2StorageConfig) {
    this.bucket = config.bucket
    this.publicUrl = config.publicUrl.replace(/\/$/, "")
    this.client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }

  async prepareUpload(opts: PrepareUploadOpts): Promise<PreparedUpload> {
    const slug = nameToSlug(opts.uploaderName)
    // Key: photos/{name-slug}/{photoId}/{fileName}
    const storageKey = `photos/${slug}/${opts.photoId}/${opts.fileName}`
    const expiresIn = PRESIGNED_URL_EXPIRY_SECONDS

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: opts.mimeType,
      ContentLength: opts.fileSize,
    })

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn })

    return {
      photoId: opts.photoId,
      storageKey,
      uploadUrl,
      uploadMethod: "PUT",
      uploadHeaders: {
        "Content-Type": opts.mimeType,
        "Content-Length": String(opts.fileSize),
      },
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
    }
  }

  async verifyUpload(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch {
      return false
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async downloadToPath(key: string, destPath: string): Promise<boolean> {
    const obj = await this.client
      .send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
      .catch(() => null)
    if (!obj?.Body) return false
    const bytes = await (obj.Body as { transformToByteArray(): Promise<Uint8Array> })
      .transformToByteArray()
      .catch(() => null)
    if (!bytes) return false
    return writeFile(destPath, bytes)
      .then(() => true)
      .catch(() => false)
  }

  async uploadFromPath(
    destKey: string,
    srcPath: string,
    mimeType: string,
    _originalKey: string,
  ): Promise<string | null> {
    const bytes = await readFile(srcPath).catch(() => null)
    if (!bytes) return null
    const ok = await this.client
      .send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: destKey,
          Body: bytes,
          ContentType: mimeType,
        }),
      )
      .then(() => true)
      .catch(() => false)
    return ok ? destKey : null
  }
}
