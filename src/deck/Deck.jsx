import { memo, useEffect, useRef } from 'react';
import Reveal from 'reveal.js';
import Markdown from 'reveal.js/plugin/markdown/markdown.esm.js';
import Highlight from 'reveal.js/plugin/highlight/highlight.esm.js';
import Math from 'reveal.js/plugin/math/math.esm.js';
import Search from 'reveal.js/plugin/search/search.esm.js';
import Zoom from 'reveal.js/plugin/zoom/zoom.esm.js';
import Notes from 'reveal.js/plugin/notes/notes.esm.js';
import 'reveal.js/dist/reveal.css';

/**
 * Mounts a reveal.js deck around whatever slides are passed as children.
 *
 * reveal.js takes ownership of the DOM inside .reveal (it adds classes,
 * builds backgrounds, converts markdown sections...). React must never
 * re-render that subtree, so this component is memoized to *never*
 * update after mount. Slide content therefore has to be static JSX.
 */
function DeckInner({ config, printMode, onReady, children }) {
  const rootRef = useRef(null);
  const deckRef = useRef(null);

  useEffect(() => {
    if (deckRef.current) return; // guard against StrictMode double-run

    const deck = new Reveal(rootRef.current, {
      ...config,
      // In the normal app the deck lives inside a sized container under the
      // navbar. In ?print-pdf mode reveal wants to own the whole page.
      embedded: !printMode,
      plugins: [Markdown, Highlight, Math.KaTeX, Search, Zoom, Notes],
    });
    deckRef.current = deck;

    deck.initialize().then(() => onReady?.(deck));

    return () => {
      // Hot reload / unmount
      try { deck.destroy(); } catch { /* not initialized yet */ }
      deckRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="reveal" ref={rootRef}>
      <div className="slides">{children}</div>
    </div>
  );
}

const Deck = memo(DeckInner, () => true);
export default Deck;
