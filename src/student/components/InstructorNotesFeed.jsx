import { esc, formatRichMessage, isHttpsUrl } from '../../lib/richText.js';
import { getStudentVisibleSessionNotes } from '../../lib/sessionNotes.js';
import { isStudentInstructorNotesDashboardEnabled } from '../../lib/sessionNotes.js';

/**
 * Instructor notes feed panel.
 * Shown when feedView === 'notes' and notes are enabled on the session.
 *
 * dangerouslySetInnerHTML is used for note titles and bodies rendered through
 * formatRichMessage — all user content is escaped via esc() inside the formatter.
 */
export default function InstructorNotesFeed({ currentSession, visible }) {
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
            <NoteCard key={n.id || i} note={n} />
          ))
        )}
      </div>
    </div>
  );
}

function NoteCard({ note: n }) {
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

  return (
    <div className="session-note-card">
      {who && <div className="session-note-byline">{who}</div>}

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
