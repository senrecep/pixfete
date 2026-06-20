"use client"

import { Button } from "@/components/ui/Button"
import { useI18n } from "@/providers/I18nProvider"
import { AnimatePresence, motion } from "framer-motion"
import { Crop as CropIcon, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"

interface ImageCropCardProps {
  file: File
  onCropped: (file: File) => void
  onSkip: () => void
  onCancel: () => void
}

export function ImageCropCard({ file, onCropped, onSkip, onCancel }: ImageCropCardProps) {
  const { t } = useI18n()
  const ic = t.upload.imageCrop

  const [crop, setCrop] = useState<Crop | undefined>(undefined)
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>(undefined)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [isCropping, setIsCropping] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget
    const c = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, 4 / 3, width, height),
      width,
      height,
    )
    setCrop(c)
  }

  async function getCroppedFile(): Promise<File | null> {
    if (!completedCrop || !imgRef.current) return null
    const canvas = document.createElement("canvas")
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height
    canvas.width = Math.round(completedCrop.width * scaleX)
    canvas.height = Math.round(completedCrop.height * scaleY)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    return new Promise<File | null>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null)
            return
          }
          const name = file.name.replace(/\.[^.]+$/, ".cropped.jpg")
          resolve(new File([blob], name, { type: "image/jpeg" }))
        },
        "image/jpeg",
        0.92,
      )
    })
  }

  async function handleCrop() {
    setIsCropping(true)
    const cropped = await getCroppedFile().catch(() => null)
    setIsCropping(false)
    if (cropped) {
      onCropped(cropped)
    } else {
      onSkip()
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm">
        <motion.div
          className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl pb-safe"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div className="flex items-center gap-2">
              <CropIcon className="h-5 w-5 text-accent" aria-hidden />
              <h2 className="text-base font-semibold text-ink">{ic.title}</h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label={ic.closeLabel}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink/50 hover:bg-ink/5 hover:text-ink transition-colors"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {/* Image crop area */}
          <div className="px-5 pb-2">
            {objectUrl && crop ? (
              <div className="flex justify-center max-h-64 overflow-hidden rounded-xl">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  className="max-h-64"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={objectUrl}
                    alt={file.name}
                    onLoad={onImageLoad}
                    className="max-h-64 w-full object-contain"
                  />
                </ReactCrop>
              </div>
            ) : objectUrl ? (
              <div className="flex justify-center max-h-64 overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={objectUrl}
                  alt={file.name}
                  onLoad={onImageLoad}
                  className="max-h-64 w-full object-contain"
                />
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 px-5 pt-3 pb-5">
            <Button
              variant="primary"
              size="md"
              loading={isCropping}
              disabled={isCropping}
              onClick={handleCrop}
              className="w-full min-h-[44px]"
            >
              {ic.cropBtn}
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={isCropping}
              onClick={onSkip}
              className="w-full min-h-[44px]"
            >
              {ic.skipBtn}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
