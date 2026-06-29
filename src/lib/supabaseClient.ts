import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // 개발 편의를 위한 경고. 실제 호출 시 .env 설정 필요.
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env 를 확인하세요."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "");
