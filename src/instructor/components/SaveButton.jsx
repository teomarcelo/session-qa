/**
 * SaveButton — a commit button with inline success/failure feedback.
 *
 * On click it runs the async `onClick` handler and shows a spinner, then a green
 * check (success) or red X (failure), which fades back to the normal label after
 * a moment. The handler signals failure by returning `false` (or throwing);
 * anything else is treated as success.
 *
 * Pass `dirty` to add a subtle "unsaved changes" pulse so users know the button
 * still needs to be clicked to commit.
 */
import { useEffect, useRef, useState } from 'react';

export default function SaveButton({
  onClick,
  className = '',
  children,
  disabled = false,
  dirty = false,
  resetDelay = 1500,
  ...rest
}) {
  const [status, setStatus] = useState('idle'); // idle | saving | success | error
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = async (e) => {
    if (status === 'saving' || disabled) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setStatus('saving');
    let ok = true;
    try {
      const res = await onClick?.(e);
      ok = res !== false;
    } catch (err) {
      ok = false;
    }
    if (!mountedRef.current) return;
    setStatus(ok ? 'success' : 'error');
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) setStatus('idle');
    }, resetDelay);
  };

  const stateClass = status !== 'idle' ? ` is-${status}` : '';
  const dirtyClass = dirty && status === 'idle' ? ' is-dirty' : '';

  return (
    <button
      type="button"
      className={`save-status-btn${stateClass}${dirtyClass} ${className}`.trim()}
      onClick={handleClick}
      disabled={disabled || status === 'saving'}
      data-status={status}
      {...rest}
    >
      <span className="ssb-label">{children}</span>
      <span className="ssb-status" aria-hidden={status === 'idle'}>
        {status === 'saving' && <span className="ssb-spinner" />}
        {status === 'success' && (
          <svg className="ssb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
        {status === 'error' && (
          <svg className="ssb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        )}
      </span>
    </button>
  );
}
