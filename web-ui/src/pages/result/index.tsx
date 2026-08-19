import { useRouterState } from '@tanstack/react-router'
import { Spinner } from '@/components/ui/spinner'
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider'
import { backgrounds } from '@/lib/queries/background'
import { useQuery } from '@tanstack/react-query'

export const ResultPage = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const jobId = (() => {
    const segments = pathname.split('/').filter(Boolean)
    return segments.at(-1) ?? ''
  })()

  const { data, isLoading } = useQuery(backgrounds().one.queryOptions(jobId))

  return (
    <div className="h-full min-h-0 w-full py-2 bg-primary/50 content-center">
      {isLoading ? (
        <Spinner className='size-24 text-primary mx-auto' />
      ) : (
        <ReactCompareSlider
          className="h-full w-fit mx-auto rounded-lg bg-white"
          itemOne={
            <ReactCompareSliderImage
              src={data?.original_image}
              alt={`Original ${data?.job_id}`}
              style={{ objectFit: 'contain' }}
            />
          }
          itemTwo={
            <ReactCompareSliderImage
              src={data?.cleaned_image}
              alt={`Cleaned ${data?.job_id}`}
              style={{ objectFit: 'contain' }}
            />
          }
        />
      )}
    </div>
  )
}
