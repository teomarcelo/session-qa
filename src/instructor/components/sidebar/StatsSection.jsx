import useInstructorStore from '../../store/useInstructorStore.js';

export default function StatsSection() {
  const stats = useInstructorStore(s => s.stats);

  return (
    <div className="stats-grid">
      <div className="stat-tile">
        <div className="stat-num" id="stat-total">{stats.total}</div>
        <div className="stat-lbl">Total</div>
      </div>
      <div className="stat-tile">
        <div className="stat-num" id="stat-answered" style={{ color: 'var(--success)' }}>{stats.answered}</div>
        <div className="stat-lbl">Answered</div>
      </div>
      <div className="stat-tile">
        <div className="stat-num" id="stat-pending" style={{ color: 'var(--warn)' }}>{stats.pending}</div>
        <div className="stat-lbl">Pending</div>
      </div>
      <div className="stat-tile">
        <div className="stat-num" id="stat-pinned" style={{ color: 'var(--pin)' }}>{stats.pinned}</div>
        <div className="stat-lbl">Pinned</div>
      </div>
    </div>
  );
}
