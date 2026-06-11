/**
 * Detects an image MIME type from the leading bytes of a file buffer.
 * Returns the canonical MIME string, or null if no known signature matches.
 */
export function detectMimeFromBytes(buffer: Buffer): string | null {
  if (buffer.length < 4) return null

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg"
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png"
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp"
  }

  // TIFF: "II*\0" (little-endian) or "MM\0*" (big-endian)
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) {
    return "image/tiff"
  }

  // HEIC/HEIF: ISO-BMFF "ftyp" box at offset 4, brand at offset 8.
  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    const brand = buffer.toString("ascii", 8, 12)
    const heicBrands = ["heic", "heix", "hevc", "hevx", "heim", "heis"]
    const heifBrands = ["mif1", "msf1", "heif"]
    if (heicBrands.includes(brand)) return "image/heic"
    if (heifBrands.includes(brand)) return "image/heif"
  }

  return null
}

/** True if the detected MIME is one of the allowed image types. */
export function isAllowedImageBuffer(buffer: Buffer): boolean {
  const mime = detectMimeFromBytes(buffer)
  return mime !== null
}
