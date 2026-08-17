import { useEffect, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { CleanedBackground, Response } from '@/@types'
import { Spinner } from '@/components/ui/spinner'
import { httpClient } from '@/lib/repository/http-client'
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider'

export const ResultPage = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [result, setResult] = useState<CleanedBackground | null>(null)
  const [loading, setLoading] = useState(true)

  const jobId = (() => {
    const segments = pathname.split('/').filter(Boolean)
    return segments.at(-1) ?? ''
  })()

  useEffect(() => {
    let active = true

    const fetchResult = async () => {
      if (!jobId) {
        throw new Error('Not found')
      }

      setLoading(true)

      try {
        const response = await httpClient.get<Response<CleanedBackground>>(`/cleaned-backgrounds/${jobId}`)
        if (!active) return

        if (!response.data) {
          setResult(null)
          throw new Error('Not found')
        }

        setResult(response.data)
      } catch (err) {
        if (!active) return
        setResult(null)
        throw new Error('Unable to load result.')
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchResult()

    return () => {
      active = false
    }
  }, [jobId])

  return (
    <div className="h-full min-h-0 w-full py-2 bg-primary/50 content-center">
      {loading ? (
        <Spinner className='size-24 text-primary mx-auto' />
      ) : (
        <ReactCompareSlider
          className="h-full w-fit mx-auto rounded-lg bg-white"
          itemOne={
            <ReactCompareSliderImage
              src={result?.original_image}
              alt={`Original ${result?.job_id}`}
              style={{ objectFit: 'contain' }}
            />
          }
          itemTwo={
            <ReactCompareSliderImage
              src={result?.cleaned_image}
              alt={`Cleaned ${result?.job_id}`}
              style={{ objectFit: 'contain' }}
            />
          }
        />
      )}
    </div>
  )
}
