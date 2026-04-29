import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationBarProps {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
  label?: string;
  className?: string;
}

export function PaginationBar({ page, pages, total, onChange, label = "items", className = "" }: PaginationBarProps) {
  if (pages <= 1) return null;

  const maxButtons = 7;
  const half = Math.floor(maxButtons / 2);
  let start = Math.max(1, page - half);
  let end = Math.min(pages, start + maxButtons - 1);
  if (end - start + 1 < maxButtons) {
    start = Math.max(1, end - maxButtons + 1);
  }
  const pageNumbers: number[] = [];
  for (let i = start; i <= end; i++) pageNumbers.push(i);

  return (
    <div className={`flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/40 ${className}`}>
      <p className="text-xs text-gray-500">
        Page {page} of {pages} · {total} {label}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="h-7 w-7 p-0"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        {pageNumbers.map((pg) => (
          <Button
            key={pg}
            variant={pg === page ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(pg)}
            className={`h-7 w-7 p-0 text-xs ${pg === page ? "bg-[#1A56DB] border-[#1A56DB] hover:bg-[#1447B4]" : ""}`}
          >
            {pg}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="h-7 w-7 p-0"
          aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
