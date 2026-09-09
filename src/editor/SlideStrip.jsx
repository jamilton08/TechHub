import { useState } from 'react';
import { SlideSurface } from './Canvas.jsx';

const THUMB_W = 150;

export default function SlideStrip({ doc, width, height, cur, onSelect, onReorder, onAddSlide, onAddSubslide }) {
  const scale = THUMB_W / width;
  const [dragFrom, setDragFrom] = useState(null);
  const [over, setOver] = useState(null);

  return (
    <aside className="strip" aria-label="Slides">
      <div className="strip-list">
        {doc.slides.map((slide, h) => (
          <div
            key={slide.id}
            className={`strip-group${over === h && dragFrom !== null && dragFrom !== h ? ' is-over' : ''}`}
            draggable
            onDragStart={(e) => { setDragFrom(h); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(h)); }}
            onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setOver(h); } }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) onReorder(dragFrom, h); setDragFrom(null); setOver(null); }}
            onDragEnd={() => { setDragFrom(null); setOver(null); }}
          >
            <Thumb
              slide={slide}
              label={`${h + 1}`}
              width={width} height={height} scale={scale}
              active={cur.h === h && cur.v === 0}
              onClick={() => onSelect(h, 0)}
            />
            {slide.subslides.map((sub, i) => (
              <Thumb
                key={sub.id}
                slide={sub}
                label={`${h + 1}.${i + 1}`}
                width={width} height={height} scale={scale * 0.85}
                sub
                active={cur.h === h && cur.v === i + 1}
                onClick={() => onSelect(h, i + 1)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="strip-actions">
        <button type="button" onClick={onAddSlide}>+ Slide</button>
        <button type="button" onClick={onAddSubslide} title="Adds a slide below the current one (vertical stack)">+ Vertical</button>
      </div>
    </aside>
  );
}

function Thumb({ slide, label, width, height, scale, active, sub, onClick }) {
  return (
    <button
      type="button"
      className={`thumb${active ? ' is-active' : ''}${sub ? ' is-sub' : ''}${slide.hidden ? ' is-hidden' : ''}`}
      onClick={onClick}
      title={slide.hidden ? 'Hidden slide' : undefined}
    >
      <span className="thumb-label">{label}</span>
      <SlideSurface slide={slide} width={width} height={height} scale={scale} className="thumb-surface" />
    </button>
  );
}
