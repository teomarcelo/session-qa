/**
 * FormatToolbar — Slack-style formatting buttons + emoji picker.
 * Targets a <textarea> by id (textareaId). Uses vanilla JS for
 * selection manipulation (textarea APIs are DOM-only).
 *
 * The emoji picker panel is portaled to document.body via a
 * <details> element whose shell is moved by the existing
 * vanilla positioning logic in useEffect.
 */
import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

// ── Emoji data ─────────────────────────────────────────────────
const FORMAT_EMOJI_PICKER_RAW = "😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙🥲😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕😟🙁☹😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀☠💩🤡👹👺👻👽👾🤖😺😸😹😻😼😽🙀😿😾👋🤚🖐✋🖖👌🤌🤏✌🤞🤟🤘🤙👈👉👆🖕👇☝👍👎✊👊🤛🤜👏🙌👐🤲🤝🙏✍💅🤳💪🦾🦿🦵🦶👂🦻👃🧠🫀🫁🦷🦴👀👁👅👄❤🧡💛💚💙💜🖤🤍🤎💔❣💕💞💓💗💖💘💝💟☮✝☪🕉☸✡🔯🪄🪅🎴🎭🖼🎨🔮🧿🐵🐒🦍🦧🐶🐕🦮🐩🐺🦊🦝🐱🐈🦁🐯🐅🐆🐴🐎🦄🦓🦌🦬🐮🐂🐃🐄🐷🐖🐗🐽🐏🐑🐐🐪🐫🦙🦒🐘🦣🦏🦛🐭🐁🐀🐹🐰🐇🐿🦫🦔🦇🐻🐨🐼🐾🦃🐔🐓🐣🐤🐥🐦🐧🕊🦅🦆🦢🦉🦤🪶🦩🦚🦜🐸🐊🐢🦎🐍🐲🐉🦕🦖🐳🐋🐬🦭🐟🐠🐡🦈🐙🐚🪸🐌🦋🐛🐜🐝🪲🐞🦗🪳🕷🕸🦂🦟🪰🪱🦠💐🌸💮🌹🥀🌺🌻🌼🌷🪻🌱🪴🌲🌳🌴🌵🌾🌿☘🍀🍁🍂🍃🪹🪺🍄🍇🍈🍉🍊🍋🍌🍍🥭🍎🍏🍐🍑🍒🍓🫐🥝🍅🥥🥑🍆🥔🥕🌽🌶🫑🥒🥬🥦🧄🧅🥜🫘🌰🍞🥐🥖🫓🥨🥯🥞🧇🧀🍖🍗🥩🥓🍔🍟🍕🌭🥪🌮🌯🫔🥙🧆🥚🍳🥘🍲🫕🥣🥗🍿🧈🧂🥫🍱🍘🍙🍚🍛🍜🍝🍠🍢🍣🍤🍥🥮🍡🥟🥠🥡🦀🦞🦐🦑🦪🍦🍧🍨🍩🍪🎂🍰🧁🥧🍫🍬🍭🍮🍯🍼🥛☕🫖🍵🍶🍾🍷🍸🍹🍺🍻🥂🥃🥤🧋🧃🧉🧊🥢🍽🍴🥄🔪🫙🌍🌎🌏🌐🗺🧭🏔⛰🌋🗻🏕🏖🏜🏝🏞🏟🏛🏗🧱🪨🪵🛖🏘🏚🏠🏡🏢🏣🏤🏥🏦🏨🏩🏪🏫🏬🏭🏯🏰💒🗼🗽⛪🕌🛕🕍⛩🕋⛲⛺🌁🌃🌄🌅🌆🌇🌉♨🎠🛝🎡🎢💈🎪🚂🚃🚄🚅🚆🚇🚈🚉🚊🚝🚞🚋🚌🚍🚎🚐🚑🚒🚓🚔🚕🚖🚗🚘🚙🛻🚚🚛🚜🏎🏍🛵🦽🦼🛺🚲🛴🛹🛼🚏🛣🛤⛽🚨🚥🚦🛑🚧⚓🛟⛵🛶🚤🛳⛴🛥🚢✈🛩🛫🛬🪂💺🚁🚟🚠🚡🛰🚀🛸🪐🌠🌌⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🪀🏓🏸🏒🏑🥍🏏🪃🥅⛳🪁🏹🎣🤿🥊🥋🎽🛷⛸🥌🎿⛷🏂🏋🤼🤸🤺⛹🤹🧘🏌🏇🧗🚵🚴🏆🥇🥈🥉🏅🎖🏵🎗🎫🎟🩰🎬🎤🎧🎼🎹🥁🪘🎷🎺🎸🪕🎻🪈🎲♟🎯🎳🎮🕹🎰🧩📱📲☎📞📟📠🔋🪫🔌💻🖥🖨⌨🖱🖲💽💾💿📀🧮🎥🎞📽📺📷📸📹📼🔍🔎🕯💡🔦🏮🪔📔📕📖📗📘📙📚📓📒📃📜📄📰🗞📑🔖🏷💰🪙💴💵💶💷💸💳🧾✉📧📨📩📤📥📦📫📪📬📭📮🗳✏✒🖋🖊🖌🖍📝💼📁📂🗂📅📆🗒🗓📇📈📉📊📋📌📍📎🖇📏📐✂🗃🗄🗑🔒🔓🔏🔐🔑🗝🔨🪓⛏⚒🛠🗡⚔🔫🛡🔧🪛🔩⚙🗜⚖🦯🔗⛓🪝🧰🧲🪜💯💢💥💫💦💨🕳💬🗨🗯💭💤🔔🔕📣📢📿🏧🚮🚰♿🚹🚺🚻🚼🚾🛂🛃🛄🛅⚠🚸⛔🚫🚳🚭🚯🚱🚷📵🔞☢☣⬆↗➡↘⬇↙⬅↖↕↔↩↪⤴⤵🔃🔄🔙🔚🔛🔜🔝🛐⚛☯🕎♈♉♊♋♌♍♎♏♐♑♒♓⛎🔀🔁🔂▶⏩⏭⏯◀⏪⏮🔼⏫🔽⏬⏸⏹⏺⏏🎦🔅🔆📶📳📴♀♂⚧✖➕➖➗🟰♾‼⁉❓❔❕❗〰💱💲⚕♻❇✳❎🆎🆑🆘📛🔠🔡🔢🔣🔤⌚⏰⏱⏲🕰🕛🕧🕐🕜🕑🕝🕒🕞🕓🕟🕔🕠🕕🕡🕖🕢🕗🕣🕘🕤🕙🕥🕚🕦🌑🌒🌓🌔🌕🌖🌗🌘🌙🌚🌛🌜🌝🌞⭐🌟☀🌤⛅🌥☁🌦🌧⛈🌩🌨❄☃⛄🌬🌪🌫🌈☂☔⛱⚡🔥💧🌊🎃🎄🎆🎇🧨✨🎈🎉🎊🎋🎍🎎🎏🎐🎑🧧🎀🎁🧸🪆🃏🀄";
export const FORMAT_EMOJI_PICKER_CHARS = Array.from(FORMAT_EMOJI_PICKER_RAW);

const FMT_EMOJI_PICKER_INLINE_STYLE =
  "font-family:'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji','Twemoji Mozilla',emoji,system-ui,sans-serif;" +
  "color:inherit;border:0!important;box-shadow:none!important;background:transparent!important;";

// ── Toolbar insertion helpers (vanilla DOM, not React state) ───

/**
 * setNativeValue — sets a textarea/input value in a way that triggers React's
 * synthetic onChange. React 16+ tracks the internal value via a _valueTracker;
 * we must go through the native setter so React detects the change and fires
 * onChange when we subsequently dispatch the 'input' event.
 */
function setNativeValue(el, value) {
  const descriptor = Object.getOwnPropertyDescriptor(el, 'value') ||
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
}

export function insertSlackFormat(textareaId, mode) {
  const ta = document.getElementById(textareaId);
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const v = ta.value;
  const sel = v.slice(start, end);
  let ins, c0, c1;
  if (mode === 'fenced') {
    const openLen = '\n```\n'.length;
    if (sel) {
      ins = '\n```\n' + sel + '\n```\n';
      c0 = start + openLen;
      c1 = c0 + sel.length;
    } else {
      ins = '\n```\n\n```\n';
      c0 = c1 = start + openLen;
    }
    setNativeValue(ta, v.slice(0, start) + ins + v.slice(end));
    ta.focus();
    ta.setSelectionRange(c0, c1);
    // Trigger React onChange so the store stays in sync
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  let before, after, mid;
  switch (mode) {
    case 'bold': before = '*'; after = '*'; mid = sel || 'bold'; break;
    case 'italic': before = '_'; after = '_'; mid = sel || 'italic'; break;
    case 'strike': before = '~'; after = '~'; mid = sel || 'strikethrough'; break;
    case 'code': before = '`'; after = '`'; mid = sel || 'code'; break;
    default: return;
  }
  ins = before + mid + after;
  setNativeValue(ta, v.slice(0, start) + ins + v.slice(end));
  ta.focus();
  const ns = start + before.length;
  const ne = ns + mid.length;
  ta.setSelectionRange(ns, ne);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

export function insertEmoji(textareaId, ch) {
  const ta = document.getElementById(textareaId);
  if (!ta || ch == null) return;
  ch = String(ch);
  const start = ta.selectionStart, end = ta.selectionEnd;
  const v = ta.value;
  setNativeValue(ta, v.slice(0, start) + ch + v.slice(end));
  ta.focus();
  const p = start + ch.length;
  ta.setSelectionRange(p, p);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

// ── Emoji picker grid portal ───────────────────────────────────

/** EmojiPickerGrid — fills the grid and portals it to body.
 *  Kept as a separate component so it can be portaled. */
function EmojiPickerGrid({ targetId, detailsRef }) {
  const gridRef = useRef(null);

  useEffect(() => {
    // Fill grid with emoji buttons
    const grid = gridRef.current;
    if (!grid) return;
    grid.innerHTML = FORMAT_EMOJI_PICKER_CHARS.map(ch =>
      `<button type="button" class="fmt-btn fmt-emoji fmt-emoji-picker-cell" style="${FMT_EMOJI_PICKER_INLINE_STYLE}" data-emoji-target="${escAttr(targetId)}" data-ch="${escAttr(ch)}" title="Insert" aria-label="Insert emoji"><span class="fmt-emoji-char">${ch}</span></button>`
    ).join('');

    // Ensure shell wrapper exists
    ensureShell(grid, detailsRef.current);
  }, [targetId]);

  return (
    <div
      ref={gridRef}
      className="fmt-emoji-grid"
      data-emoji-picker-autofill
      data-emoji-target-id={targetId}
      role="group"
      aria-label="More emojis"
    />
  );
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function ensureShell(grid, details) {
  if (!grid || !grid.parentNode) return null;
  const existing = grid.closest('.fmt-emoji-grid-shell');
  if (existing) {
    if (details) {
      details._fmtEmojiShell = existing;
      existing._fmtEmojiDetails = details;
    }
    return existing;
  }
  const shell = document.createElement('div');
  shell.className = 'fmt-emoji-grid-shell';
  const top = document.createElement('div');
  top.className = 'fmt-emoji-scroll-hint fmt-emoji-scroll-hint--top is-hidden';
  top.setAttribute('aria-hidden', 'true');
  top.textContent = '▲';
  const bot = document.createElement('div');
  bot.className = 'fmt-emoji-scroll-hint fmt-emoji-scroll-hint--bottom is-hidden';
  bot.setAttribute('aria-hidden', 'true');
  bot.textContent = '▼';
  const parent = grid.parentNode;
  parent.insertBefore(shell, grid);
  shell.appendChild(top);
  shell.appendChild(grid);
  shell.appendChild(bot);
  if (details) {
    details._fmtEmojiShell = shell;
    shell._fmtEmojiDetails = details;
  }
  return shell;
}

// ── Main FormatToolbar component ───────────────────────────────
export default function FormatToolbar({ textareaId, compact = true }) {
  const detailsRef = useRef(null);
  const containerRef = useRef(null);

  // Wire click delegation for this toolbar
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onClick = (e) => {
      const fmtBtn = e.target.closest('.fmt-btn[data-fmt]');
      const emBtn = e.target.closest('.fmt-btn[data-emoji]');
      if (!fmtBtn && !emBtn) return;
      e.preventDefault();
      if (fmtBtn) insertSlackFormat(textareaId, fmtBtn.getAttribute('data-fmt'));
      else insertEmoji(textareaId, emBtn.getAttribute('data-emoji'));
      const det = (fmtBtn || emBtn).closest('details');
      if (det) det.open = false;
    };

    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [textareaId]);

  return (
    <div
      ref={containerRef}
      className={`format-toolbar${compact ? ' format-toolbar--compact' : ''}`}
      data-fmt-target={textareaId}
      role="toolbar"
      aria-label="Insert formatting"
    >
      <span className="format-toolbar-label">Format</span>
      <div className="format-toolbar-rail">
        <button type="button" className="fmt-btn fmt-btn-b" data-fmt="bold" title="Bold" aria-label="Bold"><strong>B</strong></button>
        <button type="button" className="fmt-btn fmt-btn-i" data-fmt="italic" title="Italic" aria-label="Italic"><em>I</em></button>
        <button type="button" className="fmt-btn fmt-btn-s" data-fmt="strike" title="Strikethrough" aria-label="Strikethrough"><span style={{ textDecoration: 'line-through' }}>S</span></button>
        <button type="button" className="fmt-btn fmt-btn-mono" data-fmt="code" title="Inline code" aria-label="Inline code">`</button>
        <button type="button" className="fmt-btn fmt-btn-mono" data-fmt="fenced" title="Code block" aria-label="Code block">{'{ }'}</button>
        <span className="fmt-sep" aria-hidden="true"></span>
        <button type="button" className="fmt-btn fmt-emoji" data-emoji="👍" title="Thumbs up">👍</button>
        <button type="button" className="fmt-btn fmt-emoji" data-emoji="✅" title="Check">✅</button>
        <button type="button" className="fmt-btn fmt-emoji" data-emoji="💡" title="Idea">💡</button>
        <details ref={detailsRef} className="fmt-emoji-more">
          <summary className="fmt-more-summary" title="More emojis — opens below or above to fit (Unicode)">⋯</summary>
          <EmojiPickerGrid targetId={textareaId} detailsRef={detailsRef} />
        </details>
      </div>
    </div>
  );
}
