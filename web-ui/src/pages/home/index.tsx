import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CleanedBackground, imageSizes, models, ApiResponse } from '@/@types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { Upload, CustomFile } from '@/components/upload'
import { DetailsDialog } from './components/details-dialog'
import { ImageCard } from './components/image-card'
import { ItemPagination } from './components/item-pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMutation, useQuery } from '@tanstack/react-query'
import { backgrounds } from '@/lib/queries/background'

export const HomePage = () => {
  const [selectedFile, setSelectedFile] = useState<CustomFile | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<string>(imageSizes[0])
  const [selectedResult, setSelectedResult] = useState<CleanedBackground | null>(null)
  const [page, setPage] = useState<number>(1)

  const { data, isLoading } = useQuery(backgrounds().all.queryOptions({
    page,
    page_size: 8,
    sort: 'created_at_desc',
  }))

  const { mutate: mutateDelete } = useMutation(backgrounds().delete.mutationOptions())
  const { isPending: isCreating, mutate: mutateCreate } = useMutation(backgrounds().create.mutationOptions())

  const handleDeleteBackground = async (id: string) => {
    mutateDelete(id, {
      onSuccess(data) {
        toast.success(data.message)
      },
    })
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

  const handleRemoveBackground = useCallback(async () => {
    if (!selectedFile) {
      toast.error('Please choose an image first.')
      return
    }
    if (!selectedModelId) {
      toast.error('Please choose a modelId.')
      return
    }
    const formData = new FormData()
    formData.append('image', selectedFile, selectedFile.name)
    formData.append('image_size', imageSize)
    formData.append('model_id', selectedModelId)
    mutateCreate(formData, {
      onSuccess(data) {
        toast.success(data.message)
      },
    })
  }, [imageSize, page, selectedFile, selectedModelId])

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
              <h3 className='text-sm'>Image size</h3>
              <Select
                value={imageSize}
                onValueChange={(value) => {
                  if (value !== null) setImageSize(value)
                }}
                disabled={isCreating}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select image size' />
                </SelectTrigger>
                <SelectContent align='start' className='max-h-72'>
                  {imageSizes.map(size => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </article>
            <article className='space-y-2'>
              <h3 className='text-sm'>Model</h3>
              <Select
                value={selectedModelId}
                onValueChange={(value) => {
                  if (value !== null) setSelectedModelId(value)
                }}
                disabled={isCreating}
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
                disabled={isCreating}
                helperText={isCreating ? 'Currently working on your image' : 'Choose an image to remove your background'}
              />
            </article>

            <div className='flex justify-end mt-4'>
              <Button
                size='lg'
                onClick={handleRemoveBackground}
                disabled={isCreating || !selectedFile}
              >
                {isCreating ? <Spinner /> : 'Remove Background'}
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
          {isLoading && (
            <div className='w-full h-full content-center'>
              <Spinner className='size-12 mx-auto' />
            </div>
          )}
          <ScrollArea className='h-full w-full **:data-[slot=scroll-area-scrollbar]:hidden'>
            {data?.data?.length === 0 && !isLoading && (
              <div className='h-full text-center content-center'>
                <h3 className='text-lg font-semibold'>No results saved yet.</h3>
              </div>
            )}
            <div className='grid grid-cols-2 gap-3'>
              {data?.data?.map((item) => (
                <ImageCard
                  item={item}
                  key={item.job_id}
                  deleteBackground={handleDeleteBackground}
                  setSelectedResult={setSelectedResult}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
        {data?.paginate && (
          <CardFooter className='border-none bg-transparent'>
            <ItemPagination
              currentPage={data?.paginate?.page}
              totalPages={data?.paginate?.total_page}
              disabled={isLoading}
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
