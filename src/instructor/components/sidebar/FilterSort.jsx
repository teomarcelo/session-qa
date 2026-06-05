import useInstructorStore from '../../store/useInstructorStore.js';

export default function FilterSort() {
  const currentFilter = useInstructorStore(s => s.currentFilter);
  const setCurrentFilter = useInstructorStore(s => s.setCurrentFilter);
  const stats = useInstructorStore(s => s.stats);

  const filters = [
    { key: 'all', label: 'All questions', count: stats.total, id: 'fc-all' },
    { key: 'pinned', label: '📌 Pinned', count: stats.pinned, id: 'fc-pinned' },
    { key: 'pending', label: '⏳ Pending', count: stats.pending, id: 'fc-pending' },
    { key: 'answered', label: '✅ Answered', count: stats.answered, id: 'fc-answered' },
  ];

  return (
    <div className="filter-group">
      {filters.map(f => (
        <button
          key={f.key}
          className={`filter-item${currentFilter === f.key ? ' active' : ''}`}
          onClick={() => setCurrentFilter(f.key)}
        >
          {f.label}{' '}
          <span className="filter-count" id={f.id}>{f.count}</span>
        </button>
      ))}
    </div>
  );
}
