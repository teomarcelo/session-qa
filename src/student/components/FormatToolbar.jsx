import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Large Unicode emoji set (~750 emojis). System font renders each glyph. */
const FORMAT_EMOJI_PICKER_RAW =
  "😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙🥲😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕😟🙁☹😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀☠💩🤡👹👺👻👽👾🤖😺😸😹😻😼😽🙀😿😾👋🤚🖐✋🖖👌🤌🤏✌🤞🤟🤘🤙👈👉👆🖕👇☝👍👎✊👊🤛🤜👏🙌👐🤲🤝🙏✍💅🤳💪🦾🦿🦵🦶👂🦻👃🧠🫀🫁🦷🦴👀👁👅👄❤🧡💛💚💙💜🖤🤍🤎💔❣💕💞💓💗💖💘💝💟☮✝☪🕉☸✡🔯🪄🪅🎴🎭🖼🎨🔮🧿🐵🐒🦍🦧🐶🐕🦮🐩🐺🦊🦝🐱🐈🦁🐯🐅🐆🐴🐎🦄🦓🦌🦬🐮🐂🐃🐄🐷🐖🐗🐽🐏🐑🐐🐪🐫🦙🦒🐘🦣🦏🦛🐭🐁🐀🐹🐰🐇🐿🦫🦔🦇🐻🐨🐼🐾🦃🐔🐓🐣🐤🐥🐦🐧🕊🦅🦆🦢🦉🦤🪶🦩🦚🦜🐸🐊🐢🦎🐍🐲🐉🦕🦖🐳🐋🐬🦭🐟🐠🐡🦈🐙🐚🪸🐌🦋🐛🐜🐝🪲🐞🦗🪳🕷🕸🦂🦟🪰🪱🦠💐🌸💮🌹🥀🌺🌻🌼🌷🪻🌱🪴🌲🌳🌴🌵🌾🌿☘🍀🍁🍂🍃🪹🪺🍄🍇🍈🍉🍊🍋🍌🍍🥭🍎🍏🍐🍑🍒🍓🫐🥝🍅🥥🥑🍆🥔🥕🌽🌶🫑🥒🥬🥦🧄🧅🥜🫘🌰🍞🥐🥖🫓🥨🥯🥞🧇🧀🍖🍗🥩🥓🍔🍟🍕🌭🥪🌮🌯🫔🥙🧆🥚🍳🥘🍲🫕🥣🥗🍿🧈🧂🥫🍱🍘🍙🍚🍛🍜🍝🍠🍢🍣🍤🍥🥮🍡🥟🥠🥡🦀🦞🦐🦑🦪🍦🍧🍨🍩🍪🎂🍰🧁🥧🍫🍬🍭🍮🍯🍼🥛☕🫖🍵🍶🍾🍷🍸🍹🍺🍻🥂🥃🥤🧋🧃🧉🧊🥢🍽🍴🥄🔪🫙🌍🌎🌏🌐🗺🧭🏔⛰🌋🗻🏕🏖🏜🏝🏞🏟🏛🏗🧱🪨🪵🛖🏘🏚🏠🏡🏢🏣🏤🏥🏦🏨🏩🏪🏫🏬🏭🏯🏰💒🗼🗽⛪🕌🛕🕍⛩🕋⛲⛺🌁🌃🌄🌅🌆🌇🌉♨🎠🛝🎡🎢💈🎪🚂🚃🚄🚅🚆🚇🚈🚉🚊🚝🚞🚋🚌🚍🚎🚐🚑🚒🚓🚔🚕🚖🚗🚘🚙🛻🚚🚛🚜🏎🏍🛵🦽🦼🛺🚲🛴🛹🛼🚏🛣🛤⛽🚨🚥🚦🛑🚧⚓🛟⛵🛶🚤🛳⛴🛥🚢✈🛩🛫🛬🪂💺🚁🚟🚠🚡🛰🚀🛸🪐🌠🌌⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🪀🏓🏸🏒🏑🥍🏏🪃🥅⛳🪁🏹🎣🤿🥊🥋🎽🛷⛸🥌🎿⛷🏂🏋🤼🤸🤺⛹🤹🧘🏌🏇🧗🚵🚴🏆🥇🥈🥉🏅🎖🏵🎗🎫🎟🩰🎬🎤🎧🎼🎹🥁🪘🎷🎺🎸🪕🎻🪈🎲♟🎯🎳🎮🕹🎰🧩📱📲☎📞📟📠🔋🪫🔌💻🖥🖨⌨🖱🖲💽💾💿📀🧮🎥🎞📽📺📷📸📹📼🔍🔎🕯💡🔦🏮🪔📔📕📖📗📘📙📚📓📒📃📜📄📰🗞📑🔖🏷💰🪙💴💵💶💷💸💳🧾✉📧📨📩📤📥📦📫📪📬📭📮🗳✏✒🖋🖊🖌🖍📝💼📁📂🗂📅📆🗒🗓📇📈📉📊📋📌📍📎🖇📏📐✂🗃🗄🗑🔒🔓🔏🔐🔑🗝🔨🪓⛏⚒🛠🗡⚔🔫🛡🔧🪛🔩⚙🗜⚖🦯🔗⛓🪝🧰🧲🪜💯💢💥💫💦💨🕳💬🗨🗯💭💤🔔🔕📣📢📿🏧🚮🚰♿🚹🚺🚻🚼🚾🛂🛃🛄🛅⚠🚸⛔🚫🚳🚭🚯🚱🚷📵🔞☢☣⬆↗➡↘⬇↙⬅↖↕↔↩↪⤴⤵🔃🔄🔙🔚🔛🔜🔝🛐⚛☯🕎♈♉♊♋♌♍♎♏♐♑♒♓⛎🔀🔁🔂▶⏩⏭⏯◀⏪⏮🔼⏫🔽⏬⏸⏹⏺⏏🎦🔅🔆📶📳📴♀♂⚧✖➕➖➗🟰♾‼⁉❓❔❕❗〰💱💲⚕♻❇✳❎🆎🆑🆘📛🔠🔡🔢🔣🔤⌚⏰⏱⏲🕰🕛🕧🕐🕜🕑🕝🕒🕞🕓🕟🕔🕠🕕🕡🕖🕢🕗🕣🕘🕤🕙🕥🕚🕦🌑🌒🌓🌔🌕🌖🌗🌘🌙🌚🌛🌜🌝🌞⭐🌟☀🌤⛅🌥☁🌦🌧⛈🌩🌨❄☃⛄🌬🌪🌫🌈☂☔⛱⚡🔥💧🌊🎃🎄🎆🎇🧨✨🎈🎉🎊🎋🎍🎎🎏🎐🎑🧧🎀🎁🧸🪆🃏🀄";
const EMOJI_CHARS = Array.from(FORMAT_EMOJI_PICKER_RAW);

/** Inline font so embedded hosts cannot strip emojis with button { font-family } !important. */
const EMOJI_CELL_STYLE =
  "font-family:'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji','Twemoji Mozilla',emoji,system-ui,sans-serif;" +
  'color:inherit;border:0!important;box-shadow:none!important;background:transparent!important;';

const EMOJI_PANEL_PREFERRED_PX = 380;

/**
 * FormatToolbar — bold/italic/strike/code/fenced + quickemoji + emoji picker.
 *
 * The emoji picker opens as a fixed-position panel portaled to document.body
 * to avoid z-index / overflow clipping from ancestor containers.
 *
 * Positioning (getBoundingClientRect, flip above/below, IntersectionObserver,
 * ResizeObserver) is kept as vanilla JS inside a useEffect — this is intentional
 * because the layout math depends on live viewport geometry that React's render
 * cycle doesn't expose.
 */
export default function FormatToolbar({ targetId, targetRef, onInsertFormat, onInsertEmoji }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const summaryRef = useRef(null);
  const shellRef = useRef(null);
  const gridRef = useRef(null);
  const ioRef = useRef(null);
  const roRef = useRef(null);
  const [pickerStyle, setPickerStyle] = useState({});
  const [flipAbove, setFlipAbove] = useState(false);
  const [gridScrollState, setGridScrollState] = useState({ hasOverflow: false, atStart: true, atEnd: false });

  // --- Position the picker panel ---
  function positionPicker() {
    if (!pickerOpen || !summaryRef.current) return;
    const sum = summaryRef.current;
    const rect = sum.getBoundingClientRect();
    const gap = 8;
    const vwPad = 8;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const belowSlice = vh - rect.bottom - gap - vwPad;
    const aboveSlice = rect.top - gap - vwPad;
    const panelMax = Math.min(480, vh * 0.62);
    const preferBelow =
      belowSlice >= Math.min(panelMax, 220) ||
      (belowSlice >= aboveSlice && belowSlice >= 100);
    const w = Math.min(380, vw - vwPad * 2);
    let left = rect.right - w;
    left = Math.max(vwPad, Math.min(left, vw - w - vwPad));
    const preferredH = Math.min(EMOJI_PANEL_PREFERRED_PX, panelMax);
    let capPx, topVal, bottomVal;
    if (preferBelow) {
      capPx = Math.max(48, Math.min(preferredH, belowSlice));
      topVal = rect.bottom + gap;
      bottomVal = 'auto';
      setFlipAbove(false);
    } else {
      capPx = Math.max(48, Math.min(preferredH, aboveSlice));
      topVal = 'auto';
      bottomVal = vh - rect.top + gap;
      setFlipAbove(true);
    }
    setPickerStyle({
      position: 'fixed',
      left: left + 'px',
      right: 'auto',
      width: w + 'px',
      top: typeof topVal === 'number' ? topVal + 'px' : topVal,
      bottom: typeof bottomVal === 'number' ? bottomVal + 'px' : bottomVal,
      maxHeight: capPx + 'px',
      zIndex: 12000,
      margin: 0,
    });
    updateScrollState();
  }

  function updateScrollState() {
    const grid = gridRef.current;
    if (!grid) return;
    const sh = grid.scrollHeight;
    const ch = grid.clientHeight;
    const EPS = 4;
    const hasOverflow = sh > ch + EPS;
    const atEnd = grid.scrollTop + ch >= sh - EPS;
    const atStart = grid.scrollTop <= EPS;
    setGridScrollState({ hasOverflow, atStart, atEnd });
  }

  // --- Open / close effects ---
  useEffect(() => {
    if (!pickerOpen) {
      // Clean up observers
      if (ioRef.current) { ioRef.current.disconnect(); ioRef.current = null; }
      if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
      return;
    }

    // Position immediately after open
    requestAnimationFrame(() => {
      positionPicker();
      // IntersectionObserver to reposition when summary scrolls out of view
      if (summaryRef.current && typeof IntersectionObserver !== 'undefined') {
        const thresholds = [];
        for (let i = 0; i <= 20; i++) thresholds.push(i / 20);
        ioRef.current = new IntersectionObserver(
          () => { requestAnimationFrame(positionPicker); },
          { root: null, threshold: thresholds },
        );
        ioRef.current.observe(summaryRef.current);
      }
      // ResizeObserver to reposition when panel size changes
      if (gridRef.current && typeof ResizeObserver !== 'undefined') {
        roRef.current = new ResizeObserver(() => {
          positionPicker();
          updateScrollState();
        });
        roRef.current.observe(gridRef.current);
        if (shellRef.current) roRef.current.observe(shellRef.current);
      }
    });

    // Scroll / resize repositioning
    const scheduleRepos = () => requestAnimationFrame(positionPicker);
    const capOpts = { passive: true, capture: true };
    window.addEventListener('scroll', scheduleRepos, capOpts);
    document.addEventListener('scroll', scheduleRepos, capOpts);
    window.addEventListener('resize', scheduleRepos);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('scroll', scheduleRepos, { passive: true });
      window.visualViewport.addEventListener('resize', scheduleRepos, { passive: true });
    }

    // Close when clicking outside
    function onPointerDown(e) {
      const t = e.target;
      if (!t || typeof t.closest !== 'function') return;
      if (summaryRef.current && summaryRef.current.contains(t)) return;
      if (shellRef.current && shellRef.current.contains(t)) return;
      setPickerOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener(
      'touchstart',
      onPointerDown,
      { capture: true, passive: true },
    );

    return () => {
      window.removeEventListener('scroll', scheduleRepos, capOpts);
      document.removeEventListener('scroll', scheduleRepos, capOpts);
      window.removeEventListener('resize', scheduleRepos);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('scroll', scheduleRepos);
        window.visualViewport.removeEventListener('resize', scheduleRepos);
      }
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
      if (ioRef.current) { ioRef.current.disconnect(); ioRef.current = null; }
      if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  // Close picker on ESC
  useEffect(() => {
    if (!pickerOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setPickerOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pickerOpen]);

  function handleEmojiClick(ch) {
    onInsertEmoji(ch);
    setPickerOpen(false);
  }

  const { hasOverflow, atStart, atEnd } = gridScrollState;

  const pickerPortal = pickerOpen
    ? createPortal(
        <div
          ref={shellRef}
          className={`fmt-emoji-grid-shell${flipAbove ? ' fmt-emoji-grid-shell--flip-above' : ''}`}
          style={pickerStyle}
        >
          <div
            className={`fmt-emoji-scroll-hint fmt-emoji-scroll-hint--top${!hasOverflow ? ' is-hidden' : ''}${hasOverflow && atStart ? ' fmt-emoji-scroll-hint--dim' : ''}`}
            aria-hidden="true"
            title={hasOverflow && atStart ? 'Top of the list' : 'More emojis above — scroll up'}
          >
            ▲
          </div>
          <div
            ref={gridRef}
            className={[
              'fmt-emoji-grid',
              flipAbove ? 'fmt-emoji-grid--flip-above' : '',
              hasOverflow ? 'fmt-emoji-grid--has-overflow' : '',
              hasOverflow && !atEnd ? 'fmt-emoji-grid--hint-down' : '',
              hasOverflow && !atStart ? 'fmt-emoji-grid--hint-up' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="group"
            aria-label="More emojis"
            onScroll={updateScrollState}
          >
            {EMOJI_CHARS.map((ch, i) => (
              <button
                key={i}
                type="button"
                className="fmt-btn fmt-emoji fmt-emoji-picker-cell"
                style={{ cssText: EMOJI_CELL_STYLE } /* applied as inline styles below */}
                title="Insert"
                aria-label="Insert emoji"
                onClick={() => handleEmojiClick(ch)}
              >
                <span
                  className="fmt-emoji-char"
                  style={{
                    fontFamily:
                      "'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji','Twemoji Mozilla',emoji,system-ui,sans-serif",
                  }}
                >
                  {ch}
                </span>
              </button>
            ))}
          </div>
          <div
            className={`fmt-emoji-scroll-hint fmt-emoji-scroll-hint--bottom${!hasOverflow ? ' is-hidden' : ''}${hasOverflow && atEnd ? ' fmt-emoji-scroll-hint--dim' : ''}`}
            aria-hidden="true"
            title={hasOverflow && atEnd ? 'End of the list' : 'More emojis below — scroll down'}
          >
            ▼
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="format-toolbar" role="toolbar" aria-label="Insert formatting">
      <span className="format-toolbar-label">Format</span>
      <div className="format-toolbar-rail">
        <button type="button" className="fmt-btn fmt-btn-b" title="Bold (*text*)" aria-label="Bold" onClick={() => onInsertFormat('bold')}>
          <strong>B</strong>
        </button>
        <button type="button" className="fmt-btn fmt-btn-i" title="Italic (_text_)" aria-label="Italic" onClick={() => onInsertFormat('italic')}>
          <em>I</em>
        </button>
        <button type="button" className="fmt-btn fmt-btn-s" title="Strikethrough (~text~)" aria-label="Strikethrough" onClick={() => onInsertFormat('strike')}>
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </button>
        <button type="button" className="fmt-btn fmt-btn-mono" title="Inline code (`text`)" aria-label="Inline code" onClick={() => onInsertFormat('code')}>
          `
        </button>
        <button type="button" className="fmt-btn fmt-btn-mono" title="Code block (triple backticks)" aria-label="Code block" onClick={() => onInsertFormat('fenced')}>
          {'{ }'}
        </button>
        <span className="fmt-sep" aria-hidden="true" />
        <button type="button" className="fmt-btn fmt-emoji" title="Thumbs up" aria-label="Insert thumbs up" onClick={() => onInsertEmoji('👍')}>
          👍
        </button>
        <button type="button" className="fmt-btn fmt-emoji" title="Clap" aria-label="Insert clap" onClick={() => onInsertEmoji('👏')}>
          👏
        </button>
        <button type="button" className="fmt-btn fmt-emoji" title="Check" aria-label="Insert check mark" onClick={() => onInsertEmoji('✅')}>
          ✅
        </button>
        <button type="button" className="fmt-btn fmt-emoji" title="Light bulb" aria-label="Insert light bulb" onClick={() => onInsertEmoji('💡')}>
          💡
        </button>
        <button type="button" className="fmt-btn fmt-emoji" title="Question" aria-label="Insert question mark" onClick={() => onInsertEmoji('❓')}>
          ❓
        </button>
        <button
          ref={summaryRef}
          type="button"
          className="fmt-more-summary"
          title="More emojis — opens below or above to fit (Unicode)"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((o) => !o)}
        >
          ⋯
        </button>
      </div>
      {pickerPortal}
    </div>
  );
}
