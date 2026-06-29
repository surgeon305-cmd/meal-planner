import { useState } from "react";

interface ChipInputProps {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

/** 칩(태그) 입력 컴포넌트. Enter로 추가, × 로 삭제. */
export default function ChipInput({ values, onChange, placeholder }: ChipInputProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };

  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  return (
    <div>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-sm text-gray-700"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                aria-label={`${v} 삭제`}
                className="text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          추가
        </button>
      </div>
    </div>
  );
}
