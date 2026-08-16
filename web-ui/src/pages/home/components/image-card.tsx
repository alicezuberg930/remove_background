import { CleanedBackground } from "@/@types";
import { downloadFile } from "@/lib/utils";
import { memo } from "react";
import { LazyLoadImage } from '@/components/lazy-load-image'
import { Download, Trash } from 'lucide-react'
import { fData } from '@/lib/format-number'
import { Button } from "@/components/ui/button";

type Props = {
    item: CleanedBackground
    deleteBackground: (id: string) => Promise<void>
    setSelectedResult: React.Dispatch<React.SetStateAction<CleanedBackground | null>>
}

export const ImageCard: React.FC<Props> = memo(({ item, deleteBackground, setSelectedResult }) => {
    return (
        <div
            key={item.job_id}
            className='relative border rounded-lg border-primary/50 cursor-pointer hover:bg-primary/30 bg-primary/10'
        >
            <Button
                size='icon-lg'
                className='absolute top-2 right-3 z-10'
                aria-label={`Delete result ${item.job_id}`}
                onClick={() => deleteBackground(item.job_id)}
            >
                <Trash />
            </Button>
            <LazyLoadImage
                onClick={() => setSelectedResult(item)}
                src={item.original_image}
                alt={`Result ${item.job_id}`}
                className='object-cover h-full w-full hover:transform'
                wrapperClassName='aspect-square rounded-t-lg'
            />
            <div className='flex items-center justify-between py-2 px-3'>
                <span className='font-semibold text-xs md:text-sm'>Size: {fData(item.size)}</span>
                <Button onClick={() => downloadFile(item.job_id, item.cleaned_image)}>
                    <Download />
                </Button>
            </div>
        </div>
    )
})