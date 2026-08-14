import { useDropzone } from 'react-dropzone'
// assets
import { UploadIllustration } from '@/lib/illustrations'
//
import { CircleX } from 'lucide-react'
//
import { cn } from '@/lib/utils'
import { type UploadProps } from './types'
// components
import RejectionFiles from './errors/RejectionFiles'
import MultiFilePreview from './preview/MultiFilePreview'
import SingleFilePreview from './preview/SingleFilePreview'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export default function Upload({
  disabled,
  multiple = false,
  error,
  helperText,
  //
  file,
  onDelete,
  //
  files,
  thumbnail,
  onUpload,
  onRemove,
  onRemoveAll,
  ...other
}: Readonly<UploadProps>) {
  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({ multiple, disabled, ...other })

  const hasFile = !!file && !multiple

  const hasFiles = files && multiple && files.length > 0

  const isError = isDragReject || !!error

  return (
    <div className="w-full relative">
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer relative p-10 rounded-lg transition-all bg-gray-100 border border-dashed border-gray-400 hover:opacity-70",
          isDragActive && "opacity-70",
          isError && "text-red-600 bg-red-50 border-red-300",
          disabled && "opacity-50 pointer-events-none",
          hasFile && "aspect-4/3"
        )}
      >
        <input {...getInputProps()} />

        <Placeholder className={cn(hasFile && "opacity-0")} />

        {hasFile && <SingleFilePreview file={file} />}
      </div>

      {helperText}

      <RejectionFiles fileRejections={fileRejections} />

      {hasFile && onDelete && (
        <Button
          size='sm'
          onClick={onDelete}
          className="absolute top-4 right-4 z-10 text-white/80 bg-gray-900/70 hover:bg-gray-900/50"
        >
          <CircleX width={18} />
        </Button>
      )}

      {hasFiles && (
        <>
          <div className="my-3">
            <MultiFilePreview files={files} thumbnail={thumbnail} onRemove={onRemove} />
          </div>

          <div className="flex justify-end gap-1.5">
            {onRemoveAll && (
              <Button variant='outline' size='sm' onClick={onRemoveAll}>
                Remove all
              </Button>
            )}

            {onUpload && (
              <Button size='sm' onClick={onUpload}>
                Upload files
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Placeholder({ className, ...other }: Readonly<React.HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "w-full flex flex-col md:flex-row items-center justify-center gap-5 text-center md:text-left",
        className
      )}
      {...other}
    >
      <UploadIllustration style={{ width: 220 }} />
      <div>
        <Typography variant='h5'>
          Drop or select a file
        </Typography>
        <Typography variant='p' className='text-sm text-gray-700'>
          Drop files here or click
          <Typography
            variant='span'
            className='mx-1 underline text-main-500 inline-block lg:text-sm'
          >
            browse
          </Typography>
          on your device.
        </Typography>
      </div>
    </div>
  )
}
