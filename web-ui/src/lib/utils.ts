import { clsx, type ClassValue } from 'clsx'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs))
}

const alpha = (color: string, opacity: number): string => {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const r = Number.parseInt(hex.substring(0, 2), 16)
    const g = Number.parseInt(hex.substring(2, 4), 16)
    const b = Number.parseInt(hex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }
  // Handle rgb/rgba colors
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g)
    if (match && match.length >= 3) {
      return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${opacity})`
    }
  }
  return `rgba(0, 0, 0, ${opacity})`
}

const downloadFile = async (id: string, image: string) => {
  try {
    const response = await fetch(image)
    if (!response.ok) {
      throw new Error('Failed to prepare image for download.')
    }
    const blob = await response.blob()
    const contentType = response.headers.get('content-type')?.split(';', 1)[0]
    const extension = contentType === 'image/webp' ? 'webp' : 'png'
    const fileName = `cleaned-background-${id}.${extension}`
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Download started.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Unable to download image.')
  }
}

const getVisiblePages = (currentPage: number, totalPages: number) => {
  const pages = new Set([1, totalPages])

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page > 1 && page < totalPages) pages.add(page)
  }

  return Array.from(pages).sort((a, b) => a - b)
}

export { cn, alpha, downloadFile, getVisiblePages }
