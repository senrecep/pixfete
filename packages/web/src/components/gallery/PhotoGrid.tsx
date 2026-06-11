"use client"

import type { Photo } from "@/lib/types"
import { PhotoCard } from "./PhotoCard"

interface PhotoGridProps {
  photos: Photo[]
  onSelect: (index: number) => void
}

export function PhotoGrid({ photos, onSelect }: PhotoGridProps) {
  return (
    <div className="masonry">
      {photos.map((photo, i) => (
        <PhotoCard key={photo.id} photo={photo} onClick={() => onSelect(i)} />
      ))}
    </div>
  )
}
