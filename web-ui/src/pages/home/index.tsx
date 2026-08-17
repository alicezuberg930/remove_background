import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { httpClient } from '@/lib/repository/http-client'
import { CleanedBackground, models, Response } from '@/@types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { Upload, CustomFile } from '@/components/upload'
import { DetailsDialog } from './components/details-dialog'
import { ImageCard } from './components/image-card'
import { ItemPagination } from './components/item-pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const HomePage = () => {
  const [selectedFile, setSelectedFile] = useState<CustomFile | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [results, setResults] = useState<Response<CleanedBackground[]> | null>(null)
  const [resultsLoading, setResultsLoading] = useState<boolean>(false)
  const [selectedResult, setSelectedResult] = useState<CleanedBackground | null>(null)
  const [page, setPage] = useState<number>(1)

  const fetchResults = useCallback(async () => {
    setResultsLoading(true)
    try {
      const res = await httpClient.get<Response<CleanedBackground[]>>('/cleaned-backgrounds', {
        page,
        page_size: 8,
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
  }, [page])

  const deleteBackground = async (id: string) => {
    if (!id) {
      toast.error('Unable to delete: missing result id.')
      return
    }
    try {
      const res = await httpClient.delete<Response>(`/cleaned-backgrounds/${id}`)
      if (res.statusCode === 200) {
        toast.success(res.message || 'Deleted successfully.')
        if ((results?.data?.length ?? 0) === 1 && page > 1) {
          setPage(page - 1)
        } else {
          await fetchResults()
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete this result.')
    }
  }

  const onDrop = (acceptedFiles: File[]): void => {
    const file = acceptedFiles[0] ?? null
    if (!file) {
      setSelectedFile(null)
      if (selectedFile?.preview) {
        URL.revokeObjectURL(selectedFile?.preview)
      }
      return
    }
    if (selectedFile?.preview) URL.revokeObjectURL(selectedFile?.preview)
    const fileWithPreview = file as File & { preview: string }
    fileWithPreview.preview = URL.createObjectURL(file)
    setSelectedFile(fileWithPreview)
  }

  const onDelete = (): void => {
    if (selectedFile?.preview) URL.revokeObjectURL(selectedFile?.preview)
    setSelectedFile(null)
  }

  const removeBackground = useCallback(async () => {
    if (!selectedFile) {
      toast.error('Please choose an image first.')
      return
    }
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', selectedFile, selectedFile.name)
      if (selectedModelId) formData.append('model_id', selectedModelId)
      const res = await httpClient.post<Response<CleanedBackground>>('/remove-background', formData)

      const cleanedImage = res?.data?.cleaned_image
      if (!cleanedImage) {
        throw new Error('Backend response did not include cleaned_image.')
      }
      if (page === 1) {
        await fetchResults()
      } else {
        setPage(1)
      }
      setSelectedFile(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove background.')
    } finally {
      setLoading(false)
    }
  }, [fetchResults, page, selectedFile, selectedModelId])

  useEffect(() => {
    fetchResults().catch(() => { })
  }, [fetchResults])

  return (
    <div className='grid h-full w-full max-w-full gap-4 grid-cols-1 md:grid-cols-[minmax(0,2.7fr)_minmax(0,2.3fr)] items-stretch p-3'>
      <Card className='min-w-0 min-h-0 p-4 shadow-lg shadow-primary/20'>
        <CardHeader className='shrink-0'>
          <CardTitle className='text-2xl tracking-tight'>Remove Background</CardTitle>
          <CardDescription>
            Upload an image and remove background
          </CardDescription>
        </CardHeader>
        <CardContent className='min-h-0 flex-1 h-full'>
          <ScrollArea className='h-full w-full **:data-[slot=scroll-area-scrollbar]:hidden'>
            <article className='space-y-2'>
              <h3 className='text-sm'>Model</h3>
              <Select
                value={selectedModelId}
                onValueChange={(value) => {
                  if (value !== null) setSelectedModelId(value)
                }}
                disabled={loading}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select model' />
                </SelectTrigger>
                <SelectContent align='start' className='max-h-72'>
                  {Array.from(models.entries()).map(([modelId, label]) => (
                    <SelectItem key={modelId} value={modelId}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </article>
            <article className='space-y-2'>
              <h3 className='text-sm'>Input image</h3>
              <Upload
                file={selectedFile}
                onDrop={onDrop}
                onDelete={onDelete}
                disabled={loading}
                helperText={loading ? 'Currently working on your image' : 'Choose an image to remove your background'}
              />
            </article>

            <div className='flex justify-end mt-4'>
              <Button
                size='lg'
                onClick={removeBackground}
                disabled={loading || !selectedFile}
              >
                {loading ? <Spinner /> : 'Remove Background'}
              </Button>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <Card className='min-w-0 min-h-0 p-4 shadow-lg shadow-primary/20'>
        <CardHeader className='shrink-0'>
          <CardTitle className='text-2xl tracking-tight'>Saved results</CardTitle>
          <CardDescription>
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
            {results?.data?.length === 0 && !resultsLoading && (
              <div className='h-full text-center content-center'>
                <h3 className='text-lg font-semibold'>No results saved yet.</h3>
              </div>
            )}
            <div className='grid grid-cols-2 gap-3'>
              {results?.data?.map((item) => (
                <ImageCard
                  item={item}
                  key={item.job_id}
                  deleteBackground={deleteBackground}
                  setSelectedResult={setSelectedResult}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
        {results?.paginate && (
          <CardFooter className='border-none bg-transparent'>
            <ItemPagination
              currentPage={results?.paginate?.page}
              totalPages={results?.paginate?.total_page}
              disabled={resultsLoading}
              onPageChange={setPage}
            />
          </CardFooter>
        )}
      </Card>
      <DetailsDialog
        selectedResult={selectedResult}
        setSelectedResult={setSelectedResult}
      />
    </div >
  )
}
