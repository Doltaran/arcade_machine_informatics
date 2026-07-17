import type { KnowledgeLevel } from "@/lib/placement-test";

export interface DifficultyConfig {
  knowledgeLevel: KnowledgeLevel;
  hintsEnabled: boolean;
  autoHints: boolean;
  extraObstacles: boolean;
  timeLimit: "soft" | null;
  recommendedCommandLimitModifier: number;
  binaryNumberRange: {
    min: number;
    max: number;
  };
  platformNumbers: number[];
}

const difficultyConfig: Record<KnowledgeLevel, DifficultyConfig> = {
  1: {
    knowledgeLevel: 1,
    hintsEnabled: true,
    autoHints: true,
    extraObstacles: false,
    timeLimit: null,
    recommendedCommandLimitModifier: 3,
    binaryNumberRange: { min: 2, max: 15 },
    platformNumbers: [2, 3, 4, 5, 6, 7, 8, 9],
  },
  2: {
    knowledgeLevel: 2,
    hintsEnabled: true,
    autoHints: false,
    extraObstacles: false,
    timeLimit: null,
    recommendedCommandLimitModifier: 0,
    binaryNumberRange: { min: 5, max: 31 },
    platformNumbers: [12, 6, 9, 5, 4, 8, 15, 21],
  },
  3: {
    knowledgeLevel: 3,
    hintsEnabled: false,
    autoHints: false,
    extraObstacles: true,
    timeLimit: "soft",
    recommendedCommandLimitModifier: -2,
    binaryNumberRange: { min: 18, max: 63 },
    platformNumbers: [18, 25, 31, 42, 37, 46, 53, 61],
  },
};

export function getLevelDifficulty(knowledgeLevel: KnowledgeLevel | null | undefined) {
  return difficultyConfig[knowledgeLevel ?? 2];
}
