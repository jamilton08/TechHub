import { SlideBody } from './BlockContent.jsx';
import { classifyVideoUrl, backgroundEmbedUrl } from '../model/media.js';

function sectionAttrs(slide) {
  const a = {};
  const bg = slide.bg || {};
  if (bg.type === 'color') a['data-background-color'] = bg.value;
  if (bg.type === 'gradient') a['data-background-gradient'] = bg.value;
  if (bg.type === 'image') { a['data-background-image'] = bg.value; a['data-background-size'] = 'cover'; }
  if (bg.type === 'video') {
    const info = classifyVideoUrl(bg.value);
    if (info.kind === 'iframe') a['data-background-iframe'] = backgroundEmbedUrl(info);
    else { a['data-background-video'] = info.src; a['data-background-video-loop'] = ''; a['data-background-video-muted'] = ''; }
  }
  if (bg.type === 'iframe') { a['data-background-iframe'] = bg.value; a['data-background-interactive'] = ''; }
  if (bg.type !== 'none' && bg.opacity != null && bg.opacity !== 1) a['data-background-opacity'] = bg.opacity;
  if (slide.transition) a['data-transition'] = slide.transition;
  if (slide.autoAnimate) a['data-auto-animate'] = '';
  if (slide.autoslide) a['data-autoslide'] = slide.autoslide;
  if (slide.hidden) a['data-visibility'] = 'hidden';
  return a;
}

function Section({ slide, width, height }) {
  return (
    <section {...sectionAttrs(slide)}>
      <SlideBody slide={slide} width={width} height={height} present />
      {slide.notes && <aside className="notes">{slide.notes}</aside>}
    </section>
  );
}

/**
 * Static JSX for the whole deck. Must be rendered inside <Deck>, which
 * never re-renders — so remount Deck (change its key) to pick up edits.
 */
export default function SlidesFromModel({ doc, width, height }) {
  return (
    <>
      {doc.slides.map((slide) =>
        slide.subslides?.length ? (
          <section key={slide.id}>
            <Section slide={slide} width={width} height={height} />
            {slide.subslides.map((sub) => <Section key={sub.id} slide={sub} width={width} height={height} />)}
          </section>
        ) : (
          <Section key={slide.id} slide={slide} width={width} height={height} />
        )
      )}
    </>
  );
}
