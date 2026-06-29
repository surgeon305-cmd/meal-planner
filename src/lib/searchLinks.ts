// =============================================================================
// 외부 검색 딥링크 (RULES R4). URL 템플릿은 이 파일에서 단일 관리.
// =============================================================================

export interface SearchLink {
  label: string;
  url: string;
}

/** RULES R4 — 쿠팡 / 마켓컬리 / 네이버쇼핑. 기본은 셋 다 노출. */
export function buildShoppingLinks(query: string): SearchLink[] {
  const q = encodeURIComponent(query);
  return [
    { label: "쿠팡", url: `https://www.coupang.com/np/search?q=${q}` },
    { label: "마켓컬리", url: `https://www.kurly.com/search?sword=${q}` },
    {
      label: "네이버쇼핑",
      url: `https://search.shopping.naver.com/search/all?query=${q}`,
    },
  ];
}

/** 외식 메뉴용 맛집/배달 검색 링크. */
export function buildDineoutLinks(keyword: string): SearchLink[] {
  const q = encodeURIComponent(keyword);
  return [
    { label: "네이버 검색", url: `https://search.naver.com/search.naver?query=${q}` },
    { label: "구글 지도", url: `https://www.google.com/maps/search/${q}` },
    { label: "배달의민족", url: `https://www.baemin.com/` },
  ];
}
