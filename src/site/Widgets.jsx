import { useEffect, useState } from 'react';

/* A single LED. `on` lights it; `tone` picks the color. */
function Led({ on, tone = 'blue', size = 'm', onClick, label }) {
  const cls = `led led-${tone} led-${size}${on ? ' on' : ''}`;
  return onClick
    ? <button type="button" className={cls} onClick={onClick} aria-pressed={on} aria-label={label} />
    : <span className={cls} aria-hidden="true" />;
}

/* ── Bit board: a byte you can poke ──────────────────────────────── */
function BitBoard() {
  const [value, setValue] = useState(42);
  const bits = [...Array(8)].map((_, i) => (value >> (7 - i)) & 1);
  const toggle = (i) => setValue((v) => v ^ (1 << (7 - i)));
  return (
    <div className="widget board">
      <h3>Bit board</h3>
      <p className="w-sub">One byte. Tap the LEDs or type a number.</p>
      <div className="leds">
        {bits.map((b, i) => (
          <div key={i} className="led-col">
            <Led on={b === 1} tone="blue" size="l" onClick={() => toggle(i)} label={`bit ${7 - i}`} />
            <span className="led-cap">{1 << (7 - i)}</span>
          </div>
        ))}
      </div>
      <div className="w-inline">
        <input type="number" min={0} max={255} value={value} onChange={(e) => setValue(Math.max(0, Math.min(255, Number(e.target.value) || 0)))} aria-label="Decimal value" />
        <code className="readout">0b{bits.join('')}</code>
      </div>
      <div className="w-row"><span>hex</span><code>0x{value.toString(16).toUpperCase().padStart(2, '0')}</code></div>
      <div className="w-row"><span>octal</span><code>0o{value.toString(8)}</code></div>
      <div className="w-row"><span>ASCII</span><code>{value >= 32 && value < 127 ? `'${String.fromCharCode(value)}'` : 'non-printable'}</code></div>
    </div>
  );
}

/* ── Logic gate lab: a drawn gate with live wires ────────────────── */
const GATES = {
  AND: (a, b) => a && b, OR: (a, b) => a || b, XOR: (a, b) => a !== b,
  NAND: (a, b) => !(a && b), NOR: (a, b) => !(a || b), XNOR: (a, b) => a === b,
};
function GateShape({ name }) {
  const base = name === 'XNOR' ? 'XOR' : name.replace(/^N/, '');
  const isNot = name.startsWith('N') || name === 'XNOR';
  return (
    <g className="gate-body">
      {base === 'AND' && <path d="M 100 40 H 130 A 30 30 0 0 1 130 100 H 100 Z" />}
      {base === 'OR' && <path d="M 98 40 Q 130 40 160 70 Q 130 100 98 100 Q 115 70 98 40 Z" />}
      {base === 'XOR' && (<>
        <path d="M 104 40 Q 136 40 166 70 Q 136 100 104 100 Q 121 70 104 40 Z" />
        <path d="M 94 40 Q 111 70 94 100" fill="none" />
      </>)}
      {isNot && <circle cx={base === 'XOR' ? 172 : 166} cy="70" r="6" />}
    </g>
  );
}
function LogicLab() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [gate, setGate] = useState('AND');
  const out = GATES[gate](a, b);
  const isX = gate === 'XOR' || gate === 'XNOR';
  const isNot = gate.startsWith('N') || gate === 'XNOR';
  const outX = (isX ? 166 : 160) + (isNot ? 12 : 0);
  return (
    <div className="widget board">
      <h3>Logic gate lab</h3>
      <p className="w-sub">Flip the inputs. Lit wires carry a 1.</p>
      <div className="gate-picker">
        {Object.keys(GATES).map((g) => (
          <button key={g} type="button" className={g === gate ? 'on' : ''} onClick={() => setGate(g)}>{g}</button>
        ))}
      </div>
      <svg className="gate-svg" viewBox="0 0 240 130" aria-label={`${gate} gate, inputs ${+a} and ${+b}, output ${+out}`}>
        <path className={`wire${a ? ' hot' : ''}`} d="M 40 50 H 100" />
        <path className={`wire${b ? ' hot' : ''}`} d="M 40 90 H 100" />
        <path className={`wire${out ? ' hot' : ''}`} d={`M ${outX} 70 H 208`} />
        <GateShape name={gate} />
        <g className={`sw${a ? ' on' : ''}`} onClick={() => setA(!a)} role="button" tabIndex={0} aria-label={`Input A is ${+a}`} onKeyDown={(e) => e.key === 'Enter' && setA(!a)}>
          <rect x="8" y="38" width="32" height="24" rx="6" /><text x="24" y="55">A</text>
        </g>
        <g className={`sw${b ? ' on' : ''}`} onClick={() => setB(!b)} role="button" tabIndex={0} aria-label={`Input B is ${+b}`} onKeyDown={(e) => e.key === 'Enter' && setB(!b)}>
          <rect x="8" y="78" width="32" height="24" rx="6" /><text x="24" y="95">B</text>
        </g>
        <circle className={`out${out ? ' on' : ''}`} cx="220" cy="70" r="10" />
        <text className="out-cap" x="220" y="112">{out ? 1 : 0}</text>
      </svg>
      <table className="truth">
        <thead><tr><th>A</th><th>B</th><th>out</th></tr></thead>
        <tbody>
          {[[0, 0], [0, 1], [1, 0], [1, 1]].map(([x, y]) => (
            <tr key={`${x}${y}`} className={x === +a && y === +b ? 'now' : ''}>
              <td>{x}</td><td>{y}</td><td>{+GATES[gate](!!x, !!y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Color lab: channels as LED bars ─────────────────────────────── */
function hexToRgb(hex) {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? m.slice(1).map((h) => parseInt(h, 16)) : [0, 0, 0];
}
function ColorLab() {
  const [hex, setHex] = useState('#1f3fae');
  const [r, g, b] = hexToRgb(hex);
  const Bar = ({ label, v, tone }) => (
    <div className="bar">
      <span className="bar-cap">{label}</span>
      <div className="bar-leds">
        {[...Array(8)].map((_, i) => <Led key={i} tone={tone} size="s" on={v >= (i + 1) * 32 - 16} />)}
      </div>
      <code>{v}</code>
    </div>
  );
  return (
    <div className="widget board">
      <h3>Color lab</h3>
      <p className="w-sub">Every color is three numbers.</p>
      <div className="w-inline">
        <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} aria-label="Pick a color" />
        <div className="w-swatch" style={{ background: hex, boxShadow: `0 0 28px ${hex}` }} />
      </div>
      <Bar label="R" v={r} tone="red" />
      <Bar label="G" v={g} tone="green" />
      <Bar label="B" v={b} tone="blue" />
      <div className="w-row"><span>hex</span><code>{hex.toUpperCase()}</code></div>
      <div className="w-row"><span>rgb</span><code>rgb({r}, {g}, {b})</code></div>
    </div>
  );
}

/* ── Text → bytes, every bit an LED ──────────────────────────────── */
function TextBytes() {
  const [text, setText] = useState('HSCT');
  const chars = [...text].slice(0, 12);
  return (
    <div className="widget board">
      <h3>Text → bytes</h3>
      <p className="w-sub">What the computer actually stores.</p>
      <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Text" maxLength={12} />
      <div className="bytes">
        {chars.map((ch, i) => {
          const c = ch.codePointAt(0) & 255;
          return (
            <div key={i} className="byte">
              <b>{ch === ' ' ? '␣' : ch}</b>
              <div className="byte-leds">{[...Array(8)].map((_, j) => <Led key={j} tone="blue" size="xs" on={((c >> (7 - j)) & 1) === 1} />)}</div>
              <span>{c}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Binary clock ────────────────────────────────────────────────── */
function BinaryClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const pad = (n) => String(n).padStart(2, '0');
  const digits = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('').split('').map(Number);
  return (
    <div className="widget board">
      <h3>Binary clock</h3>
      <p className="w-sub">Each column is one digit of HH:MM:SS in binary — 8·4·2·1, top to bottom.</p>
      <div className="bclock">
        {digits.map((d, i) => (
          <div key={i} className={`bcol${i % 2 === 1 && i < 5 ? ' gap' : ''}`}>
            {[8, 4, 2, 1].map((w) => <Led key={w} tone={i < 2 ? 'red' : i < 4 ? 'blue' : 'green'} size="m" on={(d & w) === w} />)}
            <span className="led-cap">{d}</span>
          </div>
        ))}
      </div>
      <div className="w-row"><span>unix</span><code>{Math.floor(now.getTime() / 1000)}</code></div>
      <div className="w-row"><span>ISO</span><code>{now.toISOString()}</code></div>
    </div>
  );
}

export default function Widgets() {
  return (
    <div className="widget-grid">
      <BitBoard />
      <LogicLab />
      <ColorLab />
      <TextBytes />
      <BinaryClock />
    </div>
  );
}
