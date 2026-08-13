import { Link, useRouterState } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useResults } from '@/providers/result-provider'

function ResultPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { getResult } = useResults()

  const resultId = (() => {
    const segments = pathname.split('/').filter(Boolean)
    return segments.at(-1) ?? ''
  })()

  const result = getResult(resultId)

  if (!resultId || !result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Result not found</CardTitle>
          <CardDescription>
            The requested result id is missing or has not been generated in this session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/">
            <Button variant="outline">Back to home</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Result image</CardTitle>
        <CardDescription>
          Opened from the saved result entry{" "}
          <span className="font-mono text-xs">{result.id}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <img
          src={result.imageUrl}
          alt="Background removed result"
          className="w-full rounded-lg border border-border object-contain"
        />
        <Link to="/">
          <Button variant="outline">Back to home</Button>
        </Link>
      </CardContent>
    </Card>
  )
}

export { ResultPage }
