import { useState } from 'react';
import {
  formatRichMessage,
  isHttpsUrl,
  richSourceToPlainText,
  writeTextToClipboard,
} from '../../lib/richText.js';
import { getStudentVisibleSessionNotes } from '../../lib/sessionNotes.js';
import { isStudentInstructorNotesDashboardEnabled } from '../../lib/sessionNotes.js';

/**
 * Instructor notes feed panel.
 * Shown when feedView === 'notes' and notes are enabled on the session.
 *
 * dangerouslySetInnerHTML is used for note titles and bodies rendered through
 * formatRichMessage — all user content is escaped via esc() inside the formatter.
 */
export default function InstructorNotesFeed({ currentSession, visible, showToast }) {
  const notes = currentSession ? getStudentVisibleSessionNotes(currentSession) : [];
  const enabled = isStudentInstructorNotesDashboardEnabled(currentSession);

  return (
    <div
      id="student-notes-feed-panel"
      className={`student-notes-feed-panel${visible ? '' : ' is-hidden'}`}
      role="region"
      aria-labelledby="student-feed-notes-toggle"
      aria-live="polite"
    >
      <div id="session-notes-list" className="session-notes-list">
        {!notes.length && enabled ? (
          <div className="empty-state session-notes-empty">
            <p>No instructor notes yet. Check back after the host posts an update.</p>
          </div>
        ) : (
          notes.map((n, i) => (
            <NoteCard key={n.id || i} note={n} showToast={showToast} />
          ))
        )}
      </div>
    </div>
  );
}

/** Assemble clean, copyable plain text for a note: title, body, then links. */
function buildNoteCopyText({ title, body, links }) {
  const parts = [];
  const t = richSourceToPlainText(title);
  const b = richSourceToPlainText(body);
  if (t) parts.push(t);
  if (b) parts.push(b);
  if (Array.isArray(links) && links.length) {
    const linkLines = links.map((l) => (l.label ? `${l.label}: ${l.url}` : l.url));
    parts.push(linkLines.join('\n'));
  }
  return parts.join('\n\n').trim();
}

function NoteCard({ note: n, showToast }) {
  const [copied, setCopied] = useState(false);
  const who = String(n.instructor || '').trim();
  const t = String(n.title || '').trim();
  const b = String(n.body || '').trim();

  const urlsAll = Array.isArray(n.imageUrls)
    ? n.imageUrls.map((u) => String(u || '').trim()).filter(Boolean)
    : [];
  const urls = urlsAll.filter(isHttpsUrl);
  const urlsHttpOnly = urlsAll.filter((u) => /^http:\/\//i.test(u) && !isHttpsUrl(u));

  const rawLinks = Array.isArray(n.links) ? n.links : [];
  const links = rawLinks
    .map((l) => ({
      url: String((l && (l.url || l.href)) || '').trim(),
      label: String((l && (l.label || l.name)) || '').trim(),
    }))
    .filter((l) => /^https?:\/\//i.test(l.url));

  const copyText = buildNoteCopyText({ title: t, body: b, links });

  function handleCopy() {
    if (!copyText) return;
    writeTextToClipboard(copyText)
      .then(() => {
        setCopied(true);
        if (typeof showToast === 'function') showToast('Note copied to clipboard');
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {
        if (typeof showToast === 'function') showToast('Could not copy');
      });
  }

  return (
    <div className="session-note-card">
      {(who || copyText) && (
        <div className="session-note-header">
          {who ? <div className="session-note-byline">{who}</div> : <span />}
          {copyText && (
            <button
              type="button"
              className={`session-note-copy-btn${copied ? ' session-note-copy-btn--done' : ''}`}
              onClick={handleCopy}
              aria-label="Copy note text"
              title="Copy note text"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
      )}

      {t && (
        /* dangerouslySetInnerHTML: formatRichMessage escapes all user content via esc() before adding markup */
        <div
          className="session-note-title rich-message"
          dangerouslySetInnerHTML={{ __html: formatRichMessage(t) }}
        />
      )}

      {b && (
        /* dangerouslySetInnerHTML: formatRichMessage escapes all user content via esc() before adding markup */
        <div
          className="session-note-body rich-message"
          dangerouslySetInnerHTML={{ __html: formatRichMessage(b) }}
        />
      )}

      {(urls.length > 0 || urlsHttpOnly.length > 0) && (
        <div className="session-note-images">
          {urls.map((u) => (
            <a key={u} className="attachment-img-link" href={u} target="_blank" rel="noopener noreferrer">
              <img src={u} alt="" loading="lazy" referrerPolicy="no-referrer" />
            </a>
          ))}
          {urlsHttpOnly.map((u) => (
            <div key={u} className="session-note-image-fallback">
              <a href={u} target="_blank" rel="noopener noreferrer">
                Open image link
              </a>{' '}
              <span className="session-note-link-http-hint">(https images embed above)</span>
            </div>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="session-note-links">
          {links.map((link, i) => {
            let host = link.url;
            try {
              const parsed = new URL(link.url);
              host = parsed.hostname + parsed.pathname.replace(/\/$/, '');
            } catch (e) {}
            if (host.length > 72) host = host.slice(0, 69) + '...';
            // Prefer the instructor-provided button label; fall back to the host.
            const text = link.label || host;

            if (/^https:\/\//i.test(link.url)) {
              return (
                <a
                  key={i}
                  className="session-note-link-btn"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.url}
                >
                  {text}
                </a>
              );
            }
            return (
              <span key={i} className="session-note-link-btn session-note-link-btn--http" title={link.url}>
                {text}{' '}
                <span className="session-note-link-http-hint">(needs https)</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
