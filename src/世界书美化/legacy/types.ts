export interface DiskData {
  uid: number;
  name: string;
  enabled: boolean;
  strategyType: 'constant' | 'selective' | 'vectorized';
  positionType: string;
  positionRole: 'system' | 'assistant' | 'user';
  depth: number;
  order: number;
}

export type StrategyCategory =
  | 'system'
  | 'user'
  | 'assistant'
  | 'char'
  | 'example'
  | 'author'
  | 'constant'
  | 'default';

export function categorizeStrategy(disk: DiskData): StrategyCategory {
  if (disk.strategyType === 'constant') return 'constant';
  switch (disk.positionType) {
    case 'before_character_definition':
    case 'after_character_definition':
      return 'char';
    case 'before_example_messages':
    case 'after_example_messages':
      return 'example';
    case 'before_author_note':
    case 'after_author_note':
      return 'author';
    case 'at_depth':
      return disk.positionRole;
    default:
      return 'default';
  }
}

export function getEffectiveDepth(disk: DiskData): number {
  if (disk.positionType === 'at_depth') return disk.depth;
  return Math.round((100 - Math.min(disk.order, 100)) / 10);
}

export function depthToOffset(depth: number): number {
  const t = Math.min(Math.max(depth, 0), 10) / 10;
  return -7 + t * 19;
}
