import { Fragment, type MouseEvent } from "react"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { getVisiblePages } from "@/lib/utils"

type ItemPaginationProps = {
  currentPage: number
  totalPages: number
  disabled?: boolean
  onPageChange: (page: number) => void
}

export const ItemPagination = ({
  currentPage,
  totalPages,
  disabled = false,
  onPageChange,
}: ItemPaginationProps) => {
  if (totalPages <= 1) return null
  const visiblePages = getVisiblePages(currentPage, totalPages)
  const canGoPrevious = currentPage > 1 && !disabled
  const canGoNext = currentPage < totalPages && !disabled

  const handlePageChange = (
    event: MouseEvent<HTMLAnchorElement>,
    nextPage: number
  ) => {
    event.preventDefault()
    if (disabled || nextPage === currentPage || nextPage < 1 || nextPage > totalPages) return
    onPageChange(nextPage)
  }

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={!canGoPrevious}
            className={!canGoPrevious ? "pointer-events-none opacity-50" : undefined}
            onClick={(event) => handlePageChange(event, currentPage - 1)}
          />
        </PaginationItem>

        {visiblePages.map((page, index) => (
          <Fragment key={page}>
            {index > 0 && page - visiblePages[index - 1] > 1 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            <PaginationItem>
              <PaginationLink
                href="#"
                isActive={page === currentPage}
                onClick={(event) => handlePageChange(event, page)}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          </Fragment>
        ))}

        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={!canGoNext}
            className={!canGoNext ? "pointer-events-none opacity-50" : undefined}
            onClick={(event) => handlePageChange(event, currentPage + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
