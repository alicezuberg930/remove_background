import { type CustomFile } from '../types'
import { fileFormat, fileThumb } from '@/components/file-thumbnail'

type Props = {
  file: CustomFile | string | null
}

export default function SingleFilePreview({ file }: Readonly<Props>) {
  if (!file) return null
  let format = ''
  let imgUrl = ''
  if (typeof file === 'string') {
    imgUrl = file
    format = 'image'
  } else {
    format = fileFormat(file.path)
    imgUrl = format === 'image' ? file.preview! : fileThumb(format)
  }

  return (
    <img
      alt='file preview'
      src={imgUrl}
      className={`top-2 left-2 z-10 rounded-lg absolute w-[calc(100%-16px)] h-[calc(100%-16px)] ${format !== 'image' ? 'object-contain p-8' : 'object-cover'}`}
    />
  )
}
