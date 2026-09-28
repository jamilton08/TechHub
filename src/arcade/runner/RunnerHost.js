/**
 * The /play page's handle on the runner iframe. Everything goes through
 * postMessage, so the runner can live on another origin (config RUNNER_URL).
 */
import { TAG } from './protocol.js';
import { RUNNER_URL } from '../config.js';

export const runnerSrc = () => new URL(RUNNER_URL, window.location.href).href;

export class RunnerHost {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.iframe = null;
    this.origin = new URL(runnerSrc()).origin;
    this.runId = 0;
    this.isolated = null;
    this.ready = false;
    this.info = {};
    this._onMessage = this._onMessage.bind(this);
    window.addEventListener('message', this._onMessage);
  }

  attach(iframe) {
    this.iframe = iframe;
    if (!iframe) return;
    const hello = () => this._post({ type: 'hello' });
    iframe.addEventListener('load', hello);
    hello();
  }

  dispose() {
    window.removeEventListener('message', this._onMessage);
  }

  _post(msg, transfer) {
    const win = this.iframe?.contentWindow;
    if (!win) return false;
    win.postMessage({ [TAG]: 1, ...msg }, this.origin, transfer || []);
    return true;
  }

  _emit(name, data) {
    const fn = this.handlers[name];
    if (fn) fn(data);
  }

  _onMessage(e) {
    if (!this.iframe || e.source !== this.iframe.contentWindow || e.origin !== this.origin) return;
    const m = e.data;
    if (!m || m[TAG] !== 1) return;
    switch (m.type) {
      case 'hello':
        this.isolated = m.isolated;
        if (m.ready) { this.ready = true; this.info = m; }
        this._emit('onHello', m);
        break;
      case 'ready': this.ready = true; this.info = m; this._emit('onReady', m); break;
      case 'boot-failed': this.ready = false; this._emit('onBootFailed', m); break;
      case 'shortcut': this._emit('onShortcut', m); break;
      case 'status': this._emit('onStatus', m); break;
      default:
        if (m.runId != null && m.runId !== this.runId) {
          // An older run. Its final report can still carry files it saved on
          // the way out (the polite QUIT), so pass that on separately.
          if (m.type === 'done') this._emit('onStaleDone', m);
          return;
        }
        if (m.type === 'out') this._emit('onOut', m);
        else if (m.type === 'input') this._emit('onInput', m);
        else if (m.type === 'display') this._emit('onDisplay', m);
        else if (m.type === 'caption') this._emit('onCaption', m);
        else if (m.type === 'done') this._emit('onDone', m);
    }
  }

  /**
   * files:  [{ name, content }]
   * assets: [{ name, type, data: ArrayBuffer }]  (copied, not transferred)
   */
  run({ entry = 'main.py', files, assets = [] }) {
    this.runId += 1;
    this._post({ type: 'run', runId: this.runId, entry, files, assets });
    return this.runId;
  }

  stop() { this._post({ type: 'stop', runId: this.runId }); }
  /** Stop, and treat anything the old run still sends as stale (switching projects). */
  abandon() { this.stop(); this.runId += 1; }
  stdin(line) { this._post({ type: 'stdin', runId: this.runId, line }); }
  focus() {
    try { this.iframe?.focus(); } catch { /* cross-origin */ }
    this._post({ type: 'focus' });
  }
  restart() { this._post({ type: 'restart' }); }
}
