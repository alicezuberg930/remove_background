import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { CleanedBackground } from '@/@types'
import { LazyLoadImage } from '@/components/lazy-load-image'
import { memo, useCallback } from 'react'
import { fDateTime } from '@/lib/format-time'
import { fData } from '@/lib/format-number'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'

type Props = {
    selectedResult: CleanedBackground | null
    setSelectedResult: React.Dispatch<React.SetStateAction<CleanedBackground | null>>
}

export const DetailsDialog: React.FC<Props> = memo(({ selectedResult, setSelectedResult }) => {
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
        if (typeof value === 'boolean')
            return value ? 'Yes' : 'No'
        if (typeof value === 'number')
            return String(value)
        if (typeof value === 'string')
            return value
        if (typeof value === 'object')
            return JSON.stringify(value)
        return String(value)
    }, [])

    return (
        <Dialog
            open={!!selectedResult}
            onOpenChange={(open) => {
                if (!open) setSelectedResult(null)
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
                            wrapperClassName='rounded-lg border border-primary/50'
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
                            wrapperClassName='rounded-lg border border-primary/50'
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
                <DialogFooter>
                    <Link to={`/result/${selectedResult?.job_id}`}>
                        <Button size='lg'>Compare Diffirences</Button>
                    </Link>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
})