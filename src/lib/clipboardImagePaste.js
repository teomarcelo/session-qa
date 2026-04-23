import { isHttpsUrl } from './richText.js';

export function normalizeClipboardImageHttps(src) {
  let s = String(src || '').trim();
  if (!s) return '';
  if (s.indexOf('//') === 0) s = 'https:' + s;
  return s;
}

export function looksLikeImageUrl(u) {
  const s = String(u || '').toLowerCase();
  if (!s || s.indexOf('data:') === 0) return false;
  if (/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(s)) return true;
  if (s.indexOf('gstatic.com') >= 0) return true;
  if (s.indexOf('googleusercontent.com') >= 0) return true;
  if (s.indexOf('ggpht.com') >= 0) return true;
  if (s.indexOf('twimg.com') >= 0) return true;
  if (s.indexOf('cdn.') >= 0 && /\/(image|img|photo|media)\//i.test(s)) return true;
  return false;
}

function extractImageSrcFromUriListPaste(e) {
  const cd = e.clipboardData;
  if (!cd) return '';
  const raw = (cd.getData('text/uri-list') || '').trim();
  if (!raw) return '';
  let u = raw.split(/\r?\n/)[0].trim();
  if (u.indexOf('file:') === 0) return '';
  u = normalizeClipboardImageHttps(u);
  return isHttpsUrl(u) && looksLikeImageUrl(u) ? u : '';
}

function extractImageSrcFromPlainPaste(e) {
  const cd = e.clipboardData;
  if (!cd) return '';
  const t = (cd.getData('text/plain') || '').trim();
  if (!t || t.length > 12000) return '';
  const lines = t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^https:\/\/[^\s<>"']+$/);
    if (!m) continue;
    const u = normalizeClipboardImageHttps(m[0]);
    if (isHttpsUrl(u) && looksLikeImageUrl(u)) return u;
  }
  return '';
}

function extractImageSrcFromHtmlPaste(e) {
  const cd = e.clipboardData;
  if (!cd) return '';
  const html = cd.getData('text/html');
  if (!html || !html.trim()) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const imgs = doc.querySelectorAll('img[src]');
    for (let i = 0; i < imgs.length; i++) {
      let src = (imgs[i].getAttribute('src') || '').trim();
      if (!src || src.indexOf('data:') === 0) continue;
      src = normalizeClipboardImageHttps(src);
      if (isHttpsUrl(src)) return src;
    }
    return '';
  } catch (er) {
    return '';
  }
}

/** When the clipboard has image files, skip URL extraction (caller uploads files instead). */
export function extractImageUrlForQuestionPaste(e, hasFiles) {
  if (hasFiles) return '';
  return extractImageSrcFromHtmlPaste(e) || extractImageSrcFromUriListPaste(e) || extractImageSrcFromPlainPaste(e);
}
