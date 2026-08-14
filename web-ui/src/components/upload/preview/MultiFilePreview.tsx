import { m, AnimatePresence } from 'framer-motion'
// utils
import { fData } from '@/lib/format-number'
//
import { varFade } from '@/components/animate'
import FileThumbnail, { fileData } from '@/components/file-thumbnail'
//
import { type UploadProps } from '../types'
import { CircleX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export default function MultiFilePreview({ thumbnail, files, onRemove }: UploadProps) {
  if (!files?.length) return null

  return (
    <AnimatePresence initial={false}>
      {files.map((file) => {
        const { key, name = '', size = 0 } = fileData(file)
        const isNotFormatFile = typeof file === 'string'

        if (thumbnail) {
          return (
            <m.div
              key={key}
              className='inline-flex items-center justify-center border border-border m-1 w-20 h-20 rounded-xl overflow-hidden relative'
              variants={varFade().inUp}
            >
              <FileThumbnail
                tooltip
                imageView
                file={file}
                imageProps={{ className: 'absolute' }}
                fileProps={{ className: 'absolute' }}
              />

              {onRemove && (
                <Button
                  size={'icon-sm'} variant='ghost'
                  className="absolute top-1 right-1 rounded-full bg-gray-900/60 hover:bg-gray-900/70"
                  onClick={() => onRemove(file)}
                >
                  <CircleX className='size-5 stroke-white' />
                </Button>
              )}
            </m.div>
          )
        }

        return (
          <m.div
            key={key}
            className='inline-flex items-center my-2 px-2 py-1.5 border border-border rounded-lg'
            variants={varFade().inUp}
          >
            <FileThumbnail file={file} />

            <div className='grow min-w-0'>
              <Typography variant="caption" className='font-semibold text-ellipsis line-clamp-1 overflow-hidden'>
                {isNotFormatFile ? file : name}
              </Typography>

              <Typography variant='caption' className='text-gray-600'>
                {isNotFormatFile ? '' : fData(size)}
              </Typography>
            </div>

            {onRemove && (
              <Button
                size={'icon-sm'} variant='ghost'
                className="absolute top-1 right-1 rounded-full h-8 w-8 bg-gray-900/60 hover:bg-gray-900/70"
                onClick={() => onRemove(file)}
              >
                <CircleX className='size-4 stroke-white' />
              </Button>
            )}
          </m.div>
        )
      })}
    </AnimatePresence>
  )
}