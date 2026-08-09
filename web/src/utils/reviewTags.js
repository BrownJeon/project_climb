export const REVIEW_TAG_GROUPS = [
  {
    key: 'positive',
    label: '기억에 남은 이유',
    color: 'var(--success)',
    softBg: 'rgba(34,197,94,.12)',
    tags: [
      ['pos_beta',    '잘된 베타'],
      ['pos_foot',    '발기술 성공'],
      ['pos_read',    '루트 리딩'],
      ['pos_power',   '파워 활용'],
      ['pos_balance', '밸런스 성공'],
    ],
  },
  {
    key: 'improve',
    label: '다음에 고칠 점',
    color: 'var(--warn)',
    softBg: 'rgba(245,158,11,.12)',
    tags: [
      ['imp_foot',    '발 위치'],
      ['imp_balance', '밸런스/코어'],
      ['imp_reach',   '리치/손잡기'],
      ['imp_grip',    '그립력'],
      ['imp_power',   '파워 부족'],
      ['imp_read',    '루트 리딩'],
    ],
  },
];

export const LEGACY_TAG_MAP = {
  footwork: 'imp_foot',
  balance: 'imp_balance',
  reach: 'imp_reach',
  grip: 'imp_grip',
  power: 'imp_power',
  reading: 'imp_read',
  other: 'other',
};

/**
 * Parse comma-separated review tags string to array.
 * @param {string} s - Comma-separated tags string
 * @returns {string[]} Array of tag keys
 */
export function parseReviewTags(s) {
  if (!s) return [];
  return String(s).split(',').map((x) => x.trim()).filter(Boolean);
}

/**
 * Join array of review tags to comma-separated string.
 * @param {string[]} arr - Array of tag keys
 * @returns {string} Comma-separated tags
 */
export function joinReviewTags(arr) {
  return (arr || []).join(',');
}

/**
 * Get Korean label for a review tag key.
 * @param {string} key - Tag key (e.g., 'pos_beta', 'imp_foot')
 * @returns {string} Korean label or key if not found
 */
export function reviewTagLabel(key) {
  for (const group of REVIEW_TAG_GROUPS) {
    const found = group.tags.find(([k]) => k === key);
    if (found) {
      return found[1];
    }
  }
  return key;
}

/**
 * Get CSS color variable for a review tag key.
 * @param {string} key - Tag key
 * @returns {string} CSS color variable (success, warn, or ink-3)
 */
export function reviewTagColor(key) {
  if (key.startsWith('pos_')) {
    return 'var(--success)';
  }
  if (key.startsWith('imp_')) {
    return 'var(--warn)';
  }
  return 'var(--ink-3)';
}
