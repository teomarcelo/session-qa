/**
 * Filter/sort toolbar for the question feed.
 * Chips: All, Pinned, Unanswered, Answered, Most votes
 * Optional: Instructor notes toggle pill
 */
export default function QuestionToolbar({
  filter,
  sort,
  feedView,
  notesEnabled,
  onSetFilter,
  onToggleSort,
  onToggleNotes,
}) {
  const isNotesView = feedView === 'notes';
  const votesOn = !isNotesView && sort === 'votes';

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pinned', label: 'Pinned' },
    { key: 'unanswered', label: 'Unanswered' },
    { key: 'answered', label: 'Answered' },
  ];

  return (
    <div className="student-q-toolbar" id="student-q-toolbar" aria-label="Sort and filter questions">
      <div className="student-q-toolbar-btns">
        <span className="student-q-toolbar-sublabel" id="student-toolbar-sort-label">Sort</span>
        <div
          className="student-q-toolbar-filters"
          role="group"
          aria-labelledby="student-toolbar-sort-label"
        >
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`filter-btn${!isNotesView && filter === key && sort !== 'votes' ? ' active' : ''}`}
              data-filter={key}
              onClick={() => onSetFilter(key)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={`filter-btn filter-btn--sort${votesOn ? ' active' : ''}`}
            id="student-sort-votes-btn"
            aria-pressed={votesOn ? 'true' : 'false'}
            title="Within the rows above: off = newest first, on = highest votes first."
            onClick={onToggleSort}
          >
            Most votes
          </button>
        </div>
        <span className="student-q-toolbar-sep" aria-hidden="true" />
        <div className="student-q-toolbar-notes" role="group" aria-label="Instructor notes">
          <button
            type="button"
            className={`filter-btn${notesEnabled ? '' : ' is-hidden'}${isNotesView ? ' filter-btn-aux-on' : ''}`}
            id="student-feed-notes-toggle"
            aria-pressed={isNotesView ? 'true' : 'false'}
            aria-controls="student-notes-feed-panel"
            aria-hidden={notesEnabled ? undefined : 'true'}
            onClick={onToggleNotes}
          >
            Instructor notes
          </button>
        </div>
      </div>
    </div>
  );
}
