// utils
import { bgBlur } from '@/lib/css-styles'
import { Download } from 'lucide-react'
import { Button } from '../ui/button'

type Props = {
  onDownload?: VoidFunction
}

export default function DownloadButton({ onDownload }: Readonly<Props>) {
  const blurStyles = bgBlur({
    opacity: 0.6,
    color: '#212121',
  }) as React.CSSProperties

  return (
    <Button
      onClick={onDownload}
      className='absolute top-0 right-0 w-full h-full z-10 opacity-0 hover:opacity-100 rounded-none justify-center bg-gray-800 text-white p-0 transition-opacity'
      style={blurStyles}
    >
      <Download />
    </Button>
  )
}