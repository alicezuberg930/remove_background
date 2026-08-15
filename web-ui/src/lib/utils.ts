import { clsx, type ClassValue } from "clsx"
import { toast } from "sonner"
import { twMerge } from "tailwind-merge"

const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs))
}

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result as string)
  reader.onerror = () => reject(new Error('Could not read image file.'))
  reader.readAsDataURL(file)
})

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

const downloadFile = async (id: string, imageData: string) => {
  try {
    const response = await fetch(imageData)
    if (!response.ok) {
      throw new Error('Failed to prepare image for download.')
    }
    const blob = await response.blob()
    const extension = (imageData.match(/data:image\/([a-zA-Z0-9.+-]+);base64,/)?.[1] || 'png').split('+')[0]
    const mimeToExtension = extension === 'jpeg' ? 'jpg' : extension
    const fileName = `cleaned-background-${id}.${mimeToExtension}`
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

export { cn, toBase64, alpha, downloadFile }
