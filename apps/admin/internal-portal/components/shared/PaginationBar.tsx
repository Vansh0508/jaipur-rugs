"use client";

import { Pagination } from "@jaipur-rugs/ui-kit";

export const DETAIL_PAGE_SIZE = 10;

/** Numbered Previous/Next pager for the detail pages' lists; renders nothing for one page. */
export function PaginationBar({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-4 flex justify-center">
      <Pagination size="sm">
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous isDisabled={page <= 1} onPress={() => onPageChange(page - 1)}>
              Previous
            </Pagination.Previous>
          </Pagination.Item>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <Pagination.Item key={n}>
              <Pagination.Link isActive={n === page} onPress={() => onPageChange(n)}>
                {n}
              </Pagination.Link>
            </Pagination.Item>
          ))}
          <Pagination.Item>
            <Pagination.Next isDisabled={page >= pageCount} onPress={() => onPageChange(page + 1)}>
              Next
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    </div>
  );
}
