import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { httpClient } from '@/lib/repository/http-client'
import { CleanedBackground, Response } from '@/@types'
import { downloadFile, toBase64 } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { LazyLoadImage } from '@/components/lazy-load-image'
import { Download, Trash } from 'lucide-react'
import { toast } from 'sonner'
import { fData } from '@/lib/format-number'
import Upload from '@/components/upload/Upload'
import { fDateTime } from '@/lib/format-time'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

export const HomePage = () => {
  const [previewImage, setPreviewImage] = useState<string>('')
  const [resultImage, setResultImage] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [engineName, setEngineName] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [results, setResults] = useState<Response<CleanedBackground[]> | null>(null)
  const [resultsLoading, setResultsLoading] = useState<boolean>(false)
  const [selectedResult, setSelectedResult] = useState<CleanedBackground | null>(null)

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
      toast.error('Please choose an image first.')
      return
    }

    setLoading(true)
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
      toast.error(err instanceof Error ? err.message : 'Could not remove background.')
    } finally {
      setLoading(false)
    }
  }, [selectedFile])

  const fetchResults = useCallback(async () => {
    setResultsLoading(true)
    try {
      const res = await httpClient.get<Response<CleanedBackground[]>>('/cleaned-backgrounds', {
        page: 1,
        page_size: 20,
        sort: 'created_at_desc',
      })

      setResults(res)
    }
    catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load results.')
      setResults(null)
    } finally {
      setResultsLoading(false)
    }
  }, [])

  const formatResultValue = useCallback((key: string, value: unknown): string => {
    if (value === null || value === undefined) return '-'

    if (key === 'created_at') {
      const createdAt = new Date(String(value))
      return Number.isNaN(createdAt.getTime()) ? String(value) : fDateTime(createdAt, 'DD/MM/YYYY - hh:mm')
    }

    if (key === 'size' || key === 'original_size') {
      if (typeof value !== 'number') return String(value)
      return `${fData(value)}`
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No'
    }

    if (typeof value === 'number') {
      return String(value)
    }

    if (typeof value === 'string') {
      return value
    }

    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return String(value)
  }, [])

  useEffect(() => {
    fetchResults().catch(() => { })
  }, [fetchResults])

  return (
    <div className='grid h-full w-full max-w-full gap-4 grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch'>
      <Card className='min-w-0 min-h-0 p-4 shadow-lg shadow-primary/20 h-fit'>
        <CardHeader className='shrink-0'>
          <CardTitle className='text-2xl tracking-tight'>Remove Background</CardTitle>
          <CardDescription className='text-slate-600'>
            Upload an image and remove background
          </CardDescription>
        </CardHeader>
        <CardContent className='gap-4 space-y-4'>
          <div className='grid gap-3 md:grid-cols-2'>
            <article className='rounded-xl border border-primary/50 p-3'>
              <h3 className='mb-2 text-sm text-slate-800'>Input image</h3>
              <Upload
                file={selectedFile || previewImage}
                onDrop={onPickImage}
                onDelete={clearInputImage}
                disabled={loading}
                helperText={'Choose an image to remove your background'}
              />
            </article>

            <article className='rounded-xl border border-primary/50 p-3'>
              <h3 className='mb-2 flex items-center text-sm text-slate-800'>
                Output image
                {engineName ? <Badge variant='secondary'>{engineName}</Badge> : null}
              </h3>
              <Upload
                file={resultImage}
                disabled
                helperText={loading ? 'Working on your image...' : 'Result will appear here after removal.'}
              />
            </article>
          </div>

          <div className='flex justify-end'>
            <Button
              size='lg'
              onClick={removeBackground}
              disabled={loading || !selectedFile}
            >
              {loading ? 'Processing...' : 'Remove Background'}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className='min-w-0 min-h-0 p-4 shadow-lg shadow-primary/20'>
        <CardHeader className='shrink-0'>
          <CardTitle className='text-2xl tracking-tight'>Saved results</CardTitle>
          <CardDescription className='text-slate-600'>
            Your results are saved here
          </CardDescription>
        </CardHeader>
        <CardContent className='min-h-0 flex-1 h-full'>
          {resultsLoading && (
            <div className='w-full h-full content-center'>
              <Spinner className='size-12 mx-auto' />
            </div>
          )}
          <ScrollArea className='h-full w-full **:data-[slot=scroll-area-scrollbar]:hidden'>
            <div className='grid grid-cols-2 gap-3'>
              {results?.data?.length === 0 && !resultsLoading && (
                <p className='text-sm text-slate-600'>No results saved yet.</p>
              )}
              {results?.data?.map((item) => (
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
                    className='object-cover h-full w-full'
                    wrapperClassName='aspect-square rounded-t-lg'
                  />
                  <div className='flex items-center justify-between py-1 px-3'>
                    <span className='font-semibold'>Size: {fData(item.size)}</span>
                    <Button onClick={() => downloadFile(item.job_id, item.cleaned_image)}>
                      <Download />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <Dialog
        open={!!selectedResult}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedResult(null)
          }
        }}
      >
        <DialogContent className='w-full max-w-5xl sm:max-w-6xl overflow-y-auto h-[calc(100vh-3rem)]'>
          <DialogHeader>
            <DialogTitle>Saved result details</DialogTitle>
            <DialogDescription>
              Click outside or press close to return.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Badge>
                Original Image
              </Badge>
              <LazyLoadImage
                src={selectedResult?.original_image}
                alt={selectedResult?.job_id ? `Result ${selectedResult.job_id}` : 'Result'}
                className='object-contain h-full w-full'
                wrapperClassName='aspect-square rounded-lg border border-primary/50'
              />
            </div>

            <div className='space-y-2'>
              <Badge>
                Cleaned Image
              </Badge>
              <LazyLoadImage
                src={selectedResult?.cleaned_image}
                alt={selectedResult?.job_id ? `Result ${selectedResult.job_id}` : 'Result'}
                className='object-contain h-full w-full'
                wrapperClassName='aspect-square rounded-lg border border-primary/50'
              />
            </div>
          </div>
          <div className='rounded-md border border-primary/50'>
            <Table>
              <TableBody>
                {selectedResult && Object.entries(selectedResult)
                  .filter(([key]) => key !== 'cleaned_image' && key !== 'original_image')
                  .map(([key, value]) => (
                    <TableRow key={key} className='border-primary/50'>
                      <TableCell className='w-36 font-semibold text-slate-500 capitalize'>
                        {key.replace(/_/g, ' ')}
                      </TableCell>

                      <TableCell className='break-all'>
                        <Badge>{formatResultValue(key, value)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  )
}