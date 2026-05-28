/**
 * Inserts Slack-style formatting around the selection in a textarea element.
 * Operates directly on the DOM element (not React state) to preserve cursor position.
 */
export function insertSlackFormat(ta, mode) {
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const v = ta.value;
  const sel = v.slice(start, end);
  let ins, c0, c1;

  if (mode === 'fenced') {
    const openLen = '\n```\n'.length;
    if (sel) {
      ins = '\n```\n' + sel + '\n```\n';
      c0 = start + openLen;
      c1 = c0 + sel.length;
    } else {
      ins = '\n```\n\n```\n';
      c0 = c1 = start + openLen;
    }
    ta.value = v.slice(0, start) + ins + v.slice(end);
    ta.focus();
    ta.setSelectionRange(c0, c1);
    return;
  }

  let before, after, mid;
  switch (mode) {
    case 'bold':   before = '*'; after = '*'; mid = sel || 'bold'; break;
    case 'italic': before = '_'; after = '_'; mid = sel || 'italic'; break;
    case 'strike': before = '~'; after = '~'; mid = sel || 'strikethrough'; break;
    case 'code':   before = '`'; after = '`'; mid = sel || 'code'; break;
    default: return;
  }

  ins = before + mid + after;
  ta.value = v.slice(0, start) + ins + v.slice(end);
  ta.focus();
  const ns = start + before.length;
  const ne = ns + mid.length;
  ta.setSelectionRange(ns, ne);
}

/**
 * Inserts an emoji character at the current cursor position in a textarea element.
 */
export function insertEmoji(ta, ch) {
  if (!ta || ch == null) return;
  ch = String(ch);
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const v = ta.value;
  ta.value = v.slice(0, start) + ch + v.slice(end);
  ta.focus();
  const p = start + ch.length;
  ta.setSelectionRange(p, p);
}
