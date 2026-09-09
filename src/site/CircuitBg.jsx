/**
 * Decorative circuit traces for the hero — echoes the resistor/node
 * drawing on the department shield. Draws itself once on load; static
 * if the visitor prefers reduced motion (handled in CSS).
 */
export default function CircuitBg() {
  const paths = [
    'M 0 120 H 180 V 60 H 340 V 200 H 520',
    'M 0 260 H 120 V 330 H 300 V 260 H 460 V 380 H 600',
    'M 220 0 V 90 H 420 V 0',
    'M 640 40 V 140 H 760 V 300 H 700 V 420',
    'M 560 480 H 700 V 360 H 820',
    'M 80 460 H 260 V 420 H 380',
  ];
  const nodes = [[180, 120], [340, 60], [520, 200], [120, 260], [300, 330], [460, 260], [600, 380], [420, 90], [760, 140], [700, 420], [700, 360], [820, 300], [380, 420]];
  return (
    <svg className="circuit" viewBox="0 0 840 500" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      {paths.map((d, i) => <path key={i} d={d} style={{ animationDelay: `${i * 0.18}s` }} />)}
      {/* a couple of resistors, like on the shield */}
      <path className="res" d="M 340 130 l 8 -10 l 8 20 l 8 -20 l 8 20 l 8 -20 l 8 20 l 8 -10" />
      <path className="res" d="M 230 300 l 8 -10 l 8 20 l 8 -20 l 8 20 l 8 -20 l 8 20 l 8 -10" />
      {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" style={{ animationDelay: `${0.9 + i * 0.05}s` }} />)}
    </svg>
  );
}
