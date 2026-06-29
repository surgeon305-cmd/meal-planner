import type { CuisineCode } from "../lib/viewTypes";
import { CUISINE_CHIP_CLASS, CUISINE_LABELS } from "../lib/uiConstants";

interface CuisineChipProps {
  cuisine: CuisineCode;
  className?: string;
}

/** 요리종류(cuisine) 색상 칩. tailwind.config.js 의 cuisine.* 테마 색을 사용. */
export default function CuisineChip({ cuisine, className = "" }: CuisineChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CUISINE_CHIP_CLASS[cuisine]} ${className}`}
    >
      {CUISINE_LABELS[cuisine]}
    </span>
  );
}
