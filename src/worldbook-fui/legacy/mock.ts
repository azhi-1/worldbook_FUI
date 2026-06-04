import type { DiskData } from './types';

export const mockDisks: DiskData[] = [
  { uid: 0, name: '世界观概述', enabled: true, strategyType: 'constant', positionType: 'before_character_definition', positionRole: 'system', depth: 0, order: 100 },
  { uid: 1, name: '角色性格', enabled: true, strategyType: 'constant', positionType: 'after_character_definition', positionRole: 'system', depth: 1, order: 90 },
  { uid: 2, name: '战斗系统', enabled: true, strategyType: 'selective', positionType: 'at_depth', positionRole: 'system', depth: 4, order: 80 },
  { uid: 3, name: '对话风格', enabled: true, strategyType: 'constant', positionType: 'before_author_note', positionRole: 'system', depth: 2, order: 70 },
  { uid: 4, name: '场景描写模板', enabled: true, strategyType: 'selective', positionType: 'at_depth', positionRole: 'assistant', depth: 6, order: 60 },
  { uid: 5, name: '情感系统', enabled: true, strategyType: 'selective', positionType: 'at_depth', positionRole: 'system', depth: 3, order: 50 },
  { uid: 6, name: 'NPC行为逻辑', enabled: false, strategyType: 'selective', positionType: 'at_depth', positionRole: 'system', depth: 5, order: 40 },
  { uid: 7, name: '时间系统', enabled: true, strategyType: 'constant', positionType: 'after_example_messages', positionRole: 'system', depth: 1, order: 30 },
  { uid: 8, name: '魔法体系', enabled: true, strategyType: 'selective', positionType: 'at_depth', positionRole: 'user', depth: 7, order: 20 },
  { uid: 9, name: '物品系统', enabled: true, strategyType: 'selective', positionType: 'at_depth', positionRole: 'system', depth: 8, order: 10 },
  { uid: 10, name: '地图与区域', enabled: true, strategyType: 'selective', positionType: 'at_depth', positionRole: 'assistant', depth: 5, order: 15 },
  { uid: 11, name: '任务追踪', enabled: false, strategyType: 'selective', positionType: 'at_depth', positionRole: 'system', depth: 3, order: 25 },
  { uid: 12, name: '角色关系网', enabled: true, strategyType: 'constant', positionType: 'after_character_definition', positionRole: 'system', depth: 2, order: 85 },
  { uid: 13, name: '禁忌与限制', enabled: true, strategyType: 'constant', positionType: 'before_character_definition', positionRole: 'system', depth: 0, order: 95 },
  { uid: 14, name: '回忆触发器', enabled: true, strategyType: 'selective', positionType: 'at_depth', positionRole: 'system', depth: 9, order: 5 },
  { uid: 15, name: '天气与环境', enabled: true, strategyType: 'selective', positionType: 'at_depth', positionRole: 'assistant', depth: 4, order: 35 },
  { uid: 16, name: '经济系统', enabled: true, strategyType: 'selective', positionType: 'at_depth', positionRole: 'system', depth: 6, order: 45 },
  { uid: 17, name: '种族设定', enabled: true, strategyType: 'constant', positionType: 'before_character_definition', positionRole: 'system', depth: 0, order: 88 },
  { uid: 18, name: '音乐与氛围', enabled: true, strategyType: 'selective', positionType: 'at_depth', positionRole: 'assistant', depth: 7, order: 12 },
  { uid: 19, name: '死亡机制', enabled: true, strategyType: 'selective', positionType: 'at_depth', positionRole: 'system', depth: 10, order: 3 },
];
