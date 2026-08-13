import { ChangeEvent, useCallback, useState } from 'react'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { httpClient } from './lib/repository/http-client'
import { Response } from './@types'
import { toBase64 } from './lib/utils'

interface RemoveBgResponse {
  foreground_image?: string
  engine?: string
}

function App() {
  const [previewImage, setPreviewImage] = useState<string>('')
  const [resultImage, setResultImage] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [engineName, setEngineName] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [responseText, setResponseText] = useState<string>('')

  const onPickImage = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0] ?? null
    if (!file) {
      setSelectedFile(null)
      setPreviewImage('')
      return
    }
    setSelectedFile(file)
    const localPreview = URL.createObjectURL(file)
    setPreviewImage(localPreview)
  }

  const removeBackground = useCallback(async () => {
    if (!selectedFile) {
      setError('Please choose an image first.')
      return
    }

    setLoading(true)
    setError('')
    setResponseText('')
    setResultImage('')
    setEngineName('')

    try {
      const image_base64 = await toBase64(selectedFile)
      const res = await httpClient.post<Response<RemoveBgResponse>>('/remove-background', { image_base64 })

      if (!res?.data?.foreground_image) {
        throw new Error('Backend response did not include foreground_image.')
      }

      setResultImage(res.data.foreground_image)
      setEngineName(res.data.engine || '')
      setResponseText(JSON.stringify(res.data, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove background.')
    } finally {
      setLoading(false)
    }
  }, [selectedFile])

  return (
    <Card className="max-w-5xl mx-auto p-4 shadow-lg bg-white">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">Remove Background</CardTitle>
        <CardDescription className="text-slate-600">
          Upload an image and call your local BiRefNet service at <code>/remove-background</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3">
          <Label htmlFor="image-file" className="text-sm font-semibold text-slate-900">
            Input image
          </Label>
          <Input
            id="image-file"
            type="file"
            accept="image/*"
            onChange={onPickImage}
          />

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
            {previewImage ? (
              <img src={previewImage} alt="Selected input" />
            ) : (
              <div className="grid min-h-55 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600">
                No file selected yet.
              </div>
            )}
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h3 className="mb-2 flex items-center text-sm text-slate-800">
              Output image
              {engineName ? <Badge variant="secondary">{engineName}</Badge> : null}
            </h3>
            {resultImage ? (
              <img src={resultImage} alt="Removed background result" />
            ) : (
              <div className="grid min-h-55 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600">
                {loading ? 'Working on your image...' : 'Result will appear here after removal.'}
              </div>
            )}
          </article>
        </div>

        {responseText && (
          <details className="mt-4 border border-slate-200 rounded-lg overflow-hidden bg-slate-950 text-slate-200">
            <summary>API raw response</summary>
            <pre className="m-0 overflow-x-auto p-4 text-xs leading-6 text-slate-200">
              {responseText}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

export default App