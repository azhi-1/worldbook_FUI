export function getRoleCategory(entry: WorldbookEntry): 'system' | 'user' | 'char' {
  if (entry.position.type === 'at_depth') {
    return 'system';
  }
  switch (entry.position.type) {
    case 'before_character_definition':
    case 'after_character_definition':
    case 'outlet':
      return 'char';
    default:
      return 'user';
  }
}

export function getToneCategory(entry: WorldbookEntry): 'system' | 'user' | 'char' | 'conditional-system' {
  const role = getRoleCategory(entry);
  const isDepth = entry.position.type === 'at_depth';
  const isPromptBoundary = [
    'before_example_messages',
    'after_example_messages',
    'before_author_note',
    'after_author_note',
  ].includes(entry.position.type);
  if ((isDepth && entry.strategy.type === 'selective') || isPromptBoundary) return 'conditional-system';
  return role;
}

export function getWaveDepth(index: number): number {
  return (Math.sin(index / 8) * 4) + (Math.sin(index / 3) * 2) + 6;
}

export function formatKeys(keys: (string | RegExp)[]): string {
  return keys.map(k => (k instanceof RegExp ? k.source : k)).join(', ');
}

export function getPositionLabel(type: string, depth: number): string {
  const labels: Record<string, string> = {
    before_character_definition: 'BEFORE_CHAR',
    after_character_definition: 'AFTER_CHAR',
    before_example_messages: 'BEFORE_EX',
    after_example_messages: 'AFTER_EX',
    before_author_note: 'BEFORE_AN',
    after_author_note: 'AFTER_AN',
    at_depth: `DEPTH_${depth}`,
    outlet: 'OUTLET',
  };
  return labels[type] ?? type;
}

export function highlightContent(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(#.*)$/gm, '<span class="hl-comment">$1</span>')
    .replace(/(["'])(.*?)\1/g, '<span class="hl-string">$1$2$1</span>')
    .replace(/^([\s-]*)([\w_一-鿿]+)(:)/gm, '$1<span class="hl-key">$2</span>$3')
    .replace(/\b(\d+(\.\d+)?)\b/g, '<span class="hl-number">$1</span>')
    .replace(/\b(true|false)\b/g, '<span class="hl-bool">$1</span>');
}
