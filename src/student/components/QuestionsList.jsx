import QuestionCard from './QuestionCard.jsx';
import { filterCorpusByFuseSearch } from '../../lib/questionSearch.js';

/**
 * Sorts and filters the questions array then renders QuestionCard items.
 * Pinned questions always sort to the top regardless of sort mode.
 */
export default function QuestionsList({
  questions,
  allCachedQuestions,
  searchQuery,
  filter,
  sort,
  userId,
  sessionCode,
  lockedIds,
  onUpvote,
  onEdit,
}) {
  // Filtering and vote-sorting only the current page would hide matches that live
  // on other loaded pages (e.g. an answered question or a high-vote question that
  // isn't on the visible page). So when a non-default filter is active, sort is by
  // votes, or a search is running, scan the full loaded corpus (all cached pages) —
  // mirroring the instructor board. The default recent/all view keeps per-page
  // pagination behavior.
  const nonDefaultFilter =
    filter === 'answered' || filter === 'pinned' || filter === 'unanswered';
  const useFullCorpus = !!searchQuery || sort === 'votes' || nonDefaultFilter;
  const corpus = useFullCorpus ? allCachedQuestions : questions;

  let qs = searchQuery
    ? filterCorpusByFuseSearch(corpus, searchQuery, getQuestionSearchHaystack)
    : corpus.slice();

  // Apply filter
  if (filter === 'pinned') qs = qs.filter((q) => q.pinned);
  if (filter === 'answered') qs = qs.filter((q) => q.status === 'answered');
  if (filter === 'unanswered') qs = qs.filter((q) => q.status !== 'answered');

  // Sort: pinned first always, then by votes or newest
  qs.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (sort === 'votes') return (b.votes || 0) - (a.votes || 0);
    const at = a.createdAt
      ? a.createdAt.toDate
        ? a.createdAt.toDate()
        : new Date(a.createdAt)
      : new Date(0);
    const bt = b.createdAt
      ? b.createdAt.toDate
        ? b.createdAt.toDate()
        : new Date(b.createdAt)
      : new Date(0);
    return bt - at;
  });

  if (!qs.length) {
    const emptyMsg = searchQuery
      ? 'No matches in loaded questions. Load more pages or clear the search.'
      : 'No questions here yet.';
    return (
      <div className="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p>{emptyMsg}</p>
      </div>
    );
  }

  return (
    <>
      {qs.map((q) => (
        <QuestionCard
          key={q.id}
          question={q}
          userId={userId}
          sessionCode={sessionCode}
          isLocked={lockedIds.has(q.id)}
          onUpvote={onUpvote}
          onEdit={onEdit}
        />
      ))}
    </>
  );
}

function getQuestionSearchHaystack(q) {
  const bits = [q.text, q.authorName];
  const answers =
    q.answers && q.answers.length
      ? q.answers
      : q.answer
      ? [{ text: q.answer, instructor: 'Instructor' }]
      : [];
  for (let i = 0; i < answers.length; i++) {
    const a = answers[i];
    bits.push(a.text, a.instructor);
    if (Array.isArray(a.imageUrls)) bits.push(a.imageUrls.join(' '));
  }
  return bits.filter(Boolean).join('\n');
}
