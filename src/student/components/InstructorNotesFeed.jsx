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
  const linkUrls = rawLinks
    .map((l) => String((l && (l.url || l.href)) || '').trim())
    .filter((u) => /^https?:\/\//i.test(u));

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
            <a key={u} href={u} target="_blank" rel="noopener noreferrer">
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

      {linkUrls.length > 0 && (
        <ul className="session-note-links-plain">
          {linkUrls.map((url) => {
            let display = url;
            try {
              const parsed = new URL(url);
              display = parsed.hostname + parsed.pathname.replace(/\/$/, '');
            } catch (e) {}
            if (display.length > 72) display = display.slice(0, 69) + '...';

            if (/^https:\/\//i.test(url)) {
              return (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {display}
                  </a>
                </li>
              );
            }
            return (
              <li key={url} className="session-note-link-http">
                {display}{' '}
                <span className="session-note-link-http-hint">(use https for a clickable link)</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
