/** Live session codes use this prefix (see `genCode` in instructor app). */
export const SESSION_JOIN_PREFIX = 'SQA-';

/** Total length e.g. `SQA-A7K2` (prefix + four alnum). */
export const JOIN_CODE_MAX_LEN = 8;

/** Wrapper around the suffix `<input>` (student + instructor join UIs). */
export const JOIN_CODE_ROW_CLASS = 'join-code-row';

/** Suffix field holds a full legacy `TDX-…` code; hide the fixed `SQA-` chip. */
export const JOIN_CODE_ROW_LEGACY_TDX_CLASS = 'join-code-row--legacy-tdx';

/**
 * Normalize join UI input for Firestore lookup.
 * Prepends `SQA-` when the host only typed the suffix; preserves legacy `TDX-` codes.
 */
export function normalizeSessionCodeFromJoinInput(raw) {
  let s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  if (!s) return '';
  if (s.startsWith('TDX-')) return s.slice(0, JOIN_CODE_MAX_LEN);
  if (s.startsWith(SESSION_JOIN_PREFIX)) return s.slice(0, JOIN_CODE_MAX_LEN);
  return (SESSION_JOIN_PREFIX + s).slice(0, JOIN_CODE_MAX_LEN);
}

/**
 * Suffix-only field next to a fixed `SQA-` label: keep up to four alnum after the label,
 * or switch to legacy mode when the value starts with `TDX-`.
 */
export function syncJoinSuffixInput(el) {
  if (!el) return;
  const row = el.closest('.' + JOIN_CODE_ROW_CLASS);
  if (!row) return;
  let v = String(el.value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  if (v.startsWith('TDX-')) {
    el.value = v.slice(0, JOIN_CODE_MAX_LEN);
    row.classList.add(JOIN_CODE_ROW_LEGACY_TDX_CLASS);
    return;
  }
  row.classList.remove(JOIN_CODE_ROW_LEGACY_TDX_CLASS);
  if (v.startsWith(SESSION_JOIN_PREFIX)) {
    v = v.slice(SESSION_JOIN_PREFIX.length);
  }
  el.value = v.replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

/** Build the Firestore session id from the split join row (suffix input element). */
export function buildSessionCodeFromJoinRow(suffixEl) {
  if (!suffixEl) return '';
  const row = suffixEl.closest('.' + JOIN_CODE_ROW_CLASS);
  if (row && row.classList.contains(JOIN_CODE_ROW_LEGACY_TDX_CLASS)) {
    return normalizeSessionCodeFromJoinInput(suffixEl.value);
  }
  const suf = String(suffixEl.value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
  return (SESSION_JOIN_PREFIX + suf).slice(0, JOIN_CODE_MAX_LEN);
}

/** Fill the join row from a stored / known full code (auto-rejoin, leave, open modal). */
export function setJoinRowFromSessionCode(suffixEl, fullCode) {
  if (!suffixEl) return;
  const row = suffixEl.closest('.' + JOIN_CODE_ROW_CLASS);
  if (!row) return;
  const c = normalizeSessionCodeFromJoinInput(String(fullCode || '').trim());
  if (!c) {
    suffixEl.value = '';
    row.classList.remove(JOIN_CODE_ROW_LEGACY_TDX_CLASS);
    return;
  }
  if (c.startsWith('TDX-')) {
    suffixEl.value = c;
    row.classList.add(JOIN_CODE_ROW_LEGACY_TDX_CLASS);
    return;
  }
  if (c.startsWith(SESSION_JOIN_PREFIX)) {
    suffixEl.value = c.slice(SESSION_JOIN_PREFIX.length);
    row.classList.remove(JOIN_CODE_ROW_LEGACY_TDX_CLASS);
  } else {
    suffixEl.value = '';
    row.classList.remove(JOIN_CODE_ROW_LEGACY_TDX_CLASS);
  }
}
