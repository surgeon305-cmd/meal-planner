import type { SeedMenu } from '../types';
import { krSeed } from './kr';
import { cnSeed } from './cn';
import { jpSeed } from './jp';
import { wsSeed } from './ws';
import { dineoutSeed } from './dineout';

/**
 * 시드 레시피 풀 — RULES R9. 선지·갱신의 1차 출처(R1-7).
 * 각 요리종류 파일이 SeedMenu[]를 export하고 여기서 합친다.
 * id는 안정적 슬러그(예: kr-jeyuk-bokkeum)이며 풀 전체에서 유일해야 한다.
 */
export const seedPool: SeedMenu[] = [
  ...krSeed,
  ...cnSeed,
  ...jpSeed,
  ...wsSeed,
  ...dineoutSeed,
];

export { krSeed, cnSeed, jpSeed, wsSeed, dineoutSeed };
