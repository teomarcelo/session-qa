import { QUESTIONS_PAGE_SIZE } from '../../constants/app.js';

/**
 * Pagination bar for the question feed.
 * Renders Previous / numbered page buttons / Next.
 * "Phantom" next button shown when there may be more older pages to load.
 */
export default function Pagination({
  questionPages,
  currentPage,
  olderExhausted,
  loading,
  onPrev,
  onNext,
  onGoTo,
}) {
  const numLoaded = questionPages.length;
  if (!numLoaded) return null;

  const cur = questionPages[currentPage];
  const canPrev = currentPage > 0;
  const canNextCached = currentPage < numLoaded - 1;
  const lastPg = questionPages[numLoaded - 1];
  const showPhantomNext =
    !olderExhausted &&
    !!(lastPg && lastPg.endSnap && lastPg.questions.length >= QUESTIONS_PAGE_SIZE);
  const canNextFetch =
    !olderExhausted &&
    !!(cur && cur.endSnap && cur.questions.length >= QUESTIONS_PAGE_SIZE);
  const canNext = canNextCached || canNextFetch;
  const totalSlots = numLoaded + (showPhantomNext ? 1 : 0);

  const maxNums = 5;
  let lo = 0;
  let hi = totalSlots;
  if (totalSlots > maxNums) {
    const half = Math.floor(maxNums / 2);
    lo = Math.max(0, Math.min(currentPage - half, totalSlots - maxNums));
    hi = lo + maxNums;
  }

  const pageButtons = [];
  for (let i = lo; i < hi; i++) {
    const isActive = i === currentPage;
    if (i < numLoaded) {
      pageButtons.push(
        <button
          key={i}
          type="button"
          className={`pagination-page-btn${isActive ? ' active' : ''}`}
          onClick={() => onGoTo(i)}
        >
          {i + 1}
        </button>,
      );
    } else {
      pageButtons.push(
        <button
          key={i}
          type="button"
          className="pagination-page-btn"
          title="Load older questions"
          aria-label={`Go to page ${i + 1}`}
          onClick={onNext}
        >
          {i + 1}
        </button>,
      );
    }
  }

  return (
    <div className="pagination-nav-cluster">
      <button
        type="button"
        className="load-more-btn student-p-prev"
        disabled={!canPrev}
        onClick={onPrev}
      >
        Previous
      </button>
      {pageButtons}
      <button
        type="button"
        className="load-more-btn student-p-next"
        disabled={!canNext || loading}
        onClick={onNext}
      >
        Next
      </button>
    </div>
  );
}
