export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function linkify(text) {
  return String(text).replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;word-break:break-all;">$1</a>',
  );
}

/** Slack-style: *bold*, _italic_, ~strike~, `inline code`, fenced ``` blocks, [label](url) links. */
export function formatRichMessage(raw) {
  let s = String(raw || '');
  const chunks = [];
  const PH = '\uFFF0';
  const PH2 = '\uFFF1';
  const copySvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  s = s.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_m, _lang, code) => {
    const i = chunks.length;
    chunks.push(
      '<div class="rich-pre-wrap">' +
        '<div class="rich-pre-toolbar"><button type="button" class="rich-copy-btn" aria-label="Copy code" title="Copy code">' +
        copySvg +
        '</button></div>' +
        '<pre class="rich-pre"><code>' +
        esc(code) +
        '</code></pre></div>',
    );
    return PH + 'R' + i + PH2;
  });
  s = s.replace(/`([^`\n]+)`/g, (_m, code) => {
    const i = chunks.length;
    chunks.push(
      '<span class="rich-code-line-wrap" role="group">' +
        '<code class="rich-code">' +
        esc(code) +
        '</code>' +
        '<button type="button" class="rich-copy-btn rich-copy-btn--inline" aria-label="Copy code" title="Copy code">' +
        copySvg +
        '</button></span>',
    );
    return PH + 'R' + i + PH2;
  });
  // Extract [label](url) links before esc so the href doesn't get double-escaped
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label, url) => {
    const i = chunks.length;
    chunks.push(
      `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;word-break:break-all;">${esc(label)}</a>`
    );
    return PH + 'R' + i + PH2;
  });
  s = esc(s);
  s = s.replace(/\*(?!\*)([\s\S]*?)\*(?!\*)/g, '<strong>$1</strong>');
  s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  s = s.replace(/~([^~\n]+)~/g, '<del>$1</del>');
  s = linkify(s);
  s = s.replace(/\uFFF0R(\d+)\uFFF1/g, (_m, n) => chunks[parseInt(n, 10)] || '');
  return s;
}

/**
 * Convert the raw rich-text source (Slack-style markup) to readable plain text
 * for copying: strips emphasis markers, unwraps code, and renders
 * [label](url) as "label (url)". Preserves newlines.
 */
export function richSourceToPlainText(raw) {
  let s = String(raw || '');
  s = s.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, (_m, code) => String(code).replace(/\n+$/, ''));
  s = s.replace(/`([^`\n]+)`/g, '$1');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)');
  s = s.replace(/\*(?!\*)([\s\S]*?)\*(?!\*)/g, '$1');
  s = s.replace(/_([^_\n]+)_/g, '$1');
  s = s.replace(/~([^~\n]+)~/g, '$1');
  return s.trim();
}

/**
 * Write text to the clipboard with a graceful execCommand fallback.
 * @param {string} txt
 * @returns {Promise<void>}
 */
export function writeTextToClipboard(txt) {
  const text = String(txt == null ? '' : txt);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  }
  return legacyCopy(text);
}

function legacyCopy(text) {
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

export function isHttpsUrl(u) {
  return !!u && /^https:\/\//i.test(String(u).trim());
}

/** Session launch links that allow Salesforce short links (e.g. OrgClaim). */
export function isHttpOrHttpsUrl(u) {
  return !!u && /^https?:\/\//i.test(String(u).trim());
}

/**
 * @param {HTMLElement} button
 * @param {(msg: string) => void} showToast
 */
export function copyRichCodeBlock(button, showToast) {
  const wrap =
    button &&
    button.closest &&
    (button.closest('.rich-pre-wrap') || button.closest('.rich-code-line-wrap'));
  const codeEl =
    wrap && (wrap.querySelector('.rich-pre code') || wrap.querySelector('code.rich-code'));
  if (!codeEl) return;
  const txt = codeEl.textContent || '';
  function done() {
    showToast('Copied to clipboard');
    button.classList.add('rich-copy-btn--done');
    setTimeout(() => button.classList.remove('rich-copy-btn--done'), 1600);
  }
  writeTextToClipboard(txt).then(done).catch(() => showToast('Could not copy'));
}
