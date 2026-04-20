/**
 * @param {string} [toastElementId]
 * @returns {(msg: string) => void}
 */
export function createShowToast(toastElementId = 'toast') {
  return function showToast(msg) {
    const toastElement = document.getElementById(toastElementId);
    if (!toastElement) return;
    toastElement.textContent = msg;
    toastElement.classList.add('show');
    setTimeout(() => toastElement.classList.remove('show'), 2500);
  };
}
