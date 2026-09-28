import { runnerSrc } from '../runner/RunnerHost.js';

/**
 * The game screen: an iframe holding the runner page (canvas + Python).
 * The iframe is never unmounted — Python lives inside it — the panel just
 * grows when a program opens a window and shrinks for console programs.
 */
export default function GamePanel({ iframeRef, screen, big, onToggleBig, runner }) {
  const fullscreen = () => {
    const el = iframeRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().then(() => el.focus()).catch(() => {});
  };
  const hasScreen = screen.width > 0;
  return (
    <section className={`arc-screen${big ? ' is-big' : ''}`} aria-label="Game screen">
      <header className="arc-panel-head">
        <h2>
          <span className={`led led-s ${ledTone(runner.state)}${ledOn(runner.state) ? ' on' : ''}`} aria-hidden="true" />
          {hasScreen ? (screen.caption || 'Game') : 'Game screen'}
          {hasScreen && <small>{screen.width}×{screen.height}</small>}
        </h2>
        <div className="arc-panel-tools">
          <button type="button" className="arc-chip" onClick={onToggleBig} aria-pressed={big} title={big ? 'Make the screen smaller' : 'Make the screen bigger'}>
            {big ? 'Smaller' : 'Bigger'}
          </button>
          <button type="button" className="arc-chip" onClick={fullscreen} title="Full screen (Esc to leave)">Full screen</button>
        </div>
      </header>
      <div className="arc-screen-frame">
        <iframe
          ref={iframeRef}
          src={runnerSrc()}
          title="Game screen"
          allow="autoplay; fullscreen; cross-origin-isolated"
        />
      </div>
    </section>
  );
}

export const ledTone = (state) => ({ running: 'led-green', input: 'led-green', error: 'led-red', crashed: 'led-red' }[state] || 'led-blue');
export const ledOn = (state) => !['stopping'].includes(state);
