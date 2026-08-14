import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { httpClient } from '@/lib/repository/http-client'
import { CleanedBackground, Response } from '@/@types'
import { toBase64 } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { LazyLoadImage } from '@/components/lazy-load-image'
import { Download, Trash } from 'lucide-react'
import { toast } from 'sonner'
import { fData } from '@/lib/format-number'
import Upload from '@/components/upload/Upload'

function HomePage() {
  const [previewImage, setPreviewImage] = useState<string>('')
  const [resultImage, setResultImage] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [engineName, setEngineName] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [results, setResults] = useState<Response<CleanedBackground[]> | null>(null)
  const [resultsError, setResultsError] = useState<string>('')
  const [resultsLoading, setResultsLoading] = useState<boolean>(false)

  const deleteBackground = async (id: string) => {
    if (!id) {
      toast.error('Unable to delete: missing result id.')
      return
    }

    try {
      const res = await httpClient.delete<Response>(`/cleaned-backgrounds/${id}`)
      if (res.statusCode === 200) {
        toast.success(res.message || 'Deleted successfully.')
        await fetchResults()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete this result.')
    }
  }

  const onPickImage = (acceptedFiles: File[]): void => {
    const file = acceptedFiles[0] ?? null
    if (!file) {
      setSelectedFile(null)
      if (previewImage) {
        URL.revokeObjectURL(previewImage)
      }
      setPreviewImage('')
      return
    }

    if (previewImage) {
      URL.revokeObjectURL(previewImage)
    }

    const fileWithPreview = file as File & { preview: string }
    fileWithPreview.preview = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewImage(fileWithPreview.preview)
  }

  const clearInputImage = (): void => {
    if (previewImage) {
      URL.revokeObjectURL(previewImage)
    }
    setSelectedFile(null)
    setPreviewImage('')
  }

  const removeBackground = useCallback(async () => {
    if (!selectedFile) {
      setError('Please choose an image first.')
      return
    }

    setLoading(true)
    setError('')
    setResultImage('')
    setEngineName('')

    try {
      const image_base64 = await toBase64(selectedFile)
      const res = await httpClient.post<Response<CleanedBackground>>('/remove-background', { image_base64 })

      const cleanedImage = res?.data?.cleaned_image
      if (!cleanedImage) {
        throw new Error('Backend response did not include cleaned_image.')
      }

      setResultImage(cleanedImage)
      setEngineName(res?.data?.engine || '')

      await fetchResults()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove background.')
    } finally {
      setLoading(false)
    }
  }, [selectedFile])

  const fetchResults = useCallback(async () => {
    setResultsLoading(true)
    setResultsError('')
    try {
      const res = await httpClient.get<Response<CleanedBackground[]>>('/cleaned-backgrounds', {
        page: 1,
        page_size: 20,
        sort: 'created_at_desc',
      })

      setResults(res)
    }
    catch (err) {
      setResultsError(err instanceof Error ? err.message : 'Unable to load results.')
      setResults(null)
    } finally {
      setResultsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchResults().catch(() => { })
  }, [fetchResults])

  return (
    <div className="grid h-full w-full max-w-full gap-4 grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch">
      <Card className="min-w-0 min-h-0 h-full p-4 shadow-lg bg-white">
        <CardHeader className="shrink-0">
          <CardTitle className="text-2xl tracking-tight">Remove Background</CardTitle>
          <CardDescription className="text-slate-600">
            Upload an image and remove background
          </CardDescription>
        </CardHeader>
        <CardContent className="shrink-0 gap-4 space-y-4">
          <div className="grid gap-3">
            <Button
              className='w-fit'
              size="lg"
              onClick={removeBackground}
              disabled={loading || !selectedFile}
            >
              {loading ? 'Processing...' : 'Remove Background'}
            </Button>
          </div>

          {error && <p className="mt-1 text-sm font-semibold text-red-700">{error}</p>}

          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="mb-2 text-sm text-slate-800">Input image</h3>
              <Upload
                file={selectedFile || previewImage}
                onDrop={onPickImage}
                onDelete={clearInputImage}
                disabled={loading}
                helperText={'Choose an image to remove your background'}
              />
            </article>

            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="mb-2 flex items-center text-sm text-slate-800">
                Output image
                {engineName ? <Badge variant="secondary">{engineName}</Badge> : null}
              </h3>
              <Upload
                file={resultImage}
                onDelete={() => {
                  setResultImage('')
                  setEngineName('')
                }}
                disabled
                helperText={loading ? 'Working on your image...' : 'Result will appear here after removal.'}
              />
            </article>
          </div>
        </CardContent>
      </Card>
      <Card className="w-full min-w-0 min-h-0 h-full p-4 shadow-lg bg-white">
        <CardHeader className="shrink-0">
          <CardTitle className="text-2xl tracking-tight">Saved results</CardTitle>
          <CardDescription className="text-slate-600">
            Your results are saved here
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 h-full">
          {resultsError ? <p className="mb-2 text-sm font-semibold text-red-700">{resultsError}</p> : null}
          {resultsLoading && (
            <div className='w-full h-full content-center'>
              <Spinner className='size-12 mx-auto' />
            </div>
          )}
          <ScrollArea className="h-full w-full pr-2">
            <div className="grid grid-cols-2 gap-3 pr-2">
              {results?.data?.length === 0 && !resultsLoading ? (
                <p className="text-sm text-slate-600">No results saved yet.</p>
              ) : null}
              {results?.data?.map((item) => (
                <div className='relative border rounded-lg border-primary/50' key={item.job_id}>
                  <Button
                    type="button"
                    size="icon-lg"
                    variant="destructive"
                    className="absolute top-2 right-2 z-10"
                    aria-label={`Delete result ${item.job_id}`}
                    onClick={() => deleteBackground(item.job_id)}
                  >
                    <Trash />
                  </Button>
                  <LazyLoadImage
                    src={item.cleaned_image}
                    alt={`Result ${item.job_id}`}
                    className="object-contain h-full w-full"
                    wrapperClassName='aspect-[4/3]'
                  />
                  <div className='flex items-center justify-between py-1 px-3'>
                    <span className='font-semibold'>Size: {fData(item.size)}</span>
                    <Button>
                      <Download />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

export { HomePage }
