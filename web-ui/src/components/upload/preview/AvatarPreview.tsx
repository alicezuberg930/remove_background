import { LazyLoadImage } from '@/components/lazy-load-image'
import { type CustomFile } from '../types'

type Props = {
  file: CustomFile | string | null
}

export default function AvatarPreview({ file }: Readonly<Props>) {
  if (!file) return null
  const imgUrl = typeof file === 'string' ? file : file.preview

  return (
    <LazyLoadImage
      alt='avatar'
      src={imgUrl}
      className='z-10 overflow-hidden rounded-full absolute w-[calc(100%-16px)] h-[calc(100%-16px)]'
      effect='blur'
    />
  )
}
