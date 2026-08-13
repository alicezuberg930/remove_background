import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FC,
} from 'react'

export type ResultItem = {
  id: string
  imageUrl: string
  createdAt: number
  sourceName?: string
}

type ResultContextValue = {
  results: ResultItem[]
  addResult: (input: Omit<ResultItem, 'id' | 'createdAt'>) => ResultItem
  getResult: (id: string) => ResultItem | undefined
}

const STORAGE_KEY = 'remove-background-results-v1'

const readStoredResults = (): ResultItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (item): item is ResultItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ResultItem).id === 'string' &&
        typeof (item as ResultItem).imageUrl === 'string' &&
        typeof (item as ResultItem).createdAt === 'number'
    )
  } catch {
    return []
  }
}

const ResultContext = createContext<ResultContextValue | null>(null)

const sortByMostRecent = (results: ResultItem[]) =>
  [...results].sort((a, b) => b.createdAt - a.createdAt)

export const ResultProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [results, setResults] = useState<ResultItem[]>(() => {
    if (typeof window === 'undefined') {
      return []
    }
    return sortByMostRecent(readStoredResults())
  })

  const persist = useCallback((next: ResultItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore storage errors (private mode, quota, or denied permissions).
    }
  }, [])

  const addResult = useCallback(
    (input: Omit<ResultItem, 'id' | 'createdAt'>) => {
      const id = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 10)}`
      const nextResult: ResultItem = {
        ...input,
        id,
        createdAt: Date.now(),
      }

      setResults((prev) => {
        const next = sortByMostRecent([nextResult, ...prev])
        persist(next)
        return next
      })

      return nextResult
    },
    [persist]
  )

  const getResult = useCallback(
    (id: string) => results.find((item) => item.id === id),
    [results]
  )

  const value = useMemo(
    () => ({
      results,
      addResult,
      getResult,
    }),
    [results, addResult, getResult]
  )

  return <ResultContext.Provider value={value}>{children}</ResultContext.Provider>
}

export const useResults = () => {
  const context = useContext(ResultContext)
  if (!context) {
    throw new Error('useResults must be used within ResultProvider')
  }
  return context
}
