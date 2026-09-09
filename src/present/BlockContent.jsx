import { marked } from 'marked';
import { classifyVideoUrl } from '../model/media.js';

marked.setOptions({ gfm: true, breaks: true });

/** Inline CSS for a block's outer wrapper (position + style). */
export function blockStyle(block) {
  const s = block.style || {};
  return {
    position: 'absolute',
    left: block.x,
    top: block.y,
    width: block.w,
    height: block.h,
    boxSizing: 'border-box',
    fontSize: s.fontSize || undefined,
    color: s.color || undefined,
    textAlign: s.align || undefined,
    opacity: s.opacity ?? 1,
    background: s.bg || undefined,
    padding: s.padding ? `${s.padding}px` : undefined,
    borderRadius: s.radius ? `${s.radius}px` : undefined,
    overflow: OVERFLOW[block.type] || 'visible',
  };
}

/** Class list for the block wrapper. Fragment classes only apply when presenting. */
export function blockClass(block, present) {
  const cls = ['blk', `blk-${block.type}`];
  if (present && block.fragment) cls.push('fragment', block.fragment);
  return cls.join(' ');
}

/** Extra attributes reveal.js reads off the wrapper. */
export function blockAttrs(block, present) {
  const a = {};
  if (present && block.fragment && block.fragmentIndex != null && block.fragmentIndex !== '') a['data-fragment-index'] = block.fragmentIndex;
  if (block.dataId) a['data-id'] = block.dataId;
  return a;
}

const OVERFLOW = { code: 'auto', markdown: 'auto', list: 'auto', image: 'hidden', video: 'hidden', iframe: 'hidden' };
const fill = { width: '100%', height: '100%', margin: 0 };

/**
 * The inside of a block. `present` = rendering for reveal.js.
 * Text-ish blocks accept `editableProps` (contentEditable handlers) in
 * the editor; leave undefined for presentation.
 */
export function BlockContent({ block, present, editableProps }) {
  const p = block.props || {};
  switch (block.type) {
    case 'heading': {
      const Tag = `h${Math.min(Math.max(p.level || 2, 1), 4)}`;
      return <Tag style={{ margin: 0 }} {...editableProps}>{block.content}</Tag>;
    }
    case 'text':
      return <p style={{ margin: 0, whiteSpace: 'pre-wrap' }} {...editableProps}>{block.content}</p>;
    case 'list': {
      const Tag = p.ordered ? 'ol' : 'ul';
      const items = String(block.content || '').split('\n').filter((l) => l.trim() !== '');
      return (
        <Tag style={{ margin: 0, display: 'inline-block', textAlign: 'left' }}>
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </Tag>
      );
    }
    case 'image':
      return block.content
        ? <img src={block.content} alt={p.alt || ''} style={{ ...fill, objectFit: p.fit || 'contain', display: 'block' }} />
        : <div className="blk-placeholder">Image — set a URL or drop a file</div>;
    case 'code':
      return (
        <pre style={{ ...fill, fontSize: '0.55em', boxShadow: 'none' }}>
          <code
            className={`hljs language-${p.lang || 'plaintext'}`}
            data-trim=""
            data-noescape=""
            {...(present && p.lines ? { 'data-line-numbers': p.lines } : {})}
            style={{ maxHeight: 'none', height: '100%' }}
          >
            {block.content}
          </code>
        </pre>
      );
    case 'markdown':
      return (
        <div
          className="blk-md"
          style={{ textAlign: 'left' }}
          dangerouslySetInnerHTML={{ __html: marked.parse(String(block.content || '')) }}
        />
      );
    case 'math':
      // reveal's KaTeX plugin renders \[ \] and $ $ while presenting
      return <div style={{ whiteSpace: 'pre-wrap' }}>{block.content}</div>;
    case 'video': {
      const info = classifyVideoUrl(block.content);
      if (info.kind === 'none') return <div className="blk-placeholder">Video — paste a YouTube / Vimeo / Drive link or an .mp4 URL</div>;
      if (info.kind === 'iframe') {
        return (
          <iframe
            src={info.src}
            title="video"
            style={{ ...fill, border: 0, display: 'block' }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            {...(present && p.autoplay ? { 'data-autoplay': '' } : {})}
          />
        );
      }
      return (
        <video
          src={info.src}
          style={{ ...fill, objectFit: 'contain', display: 'block' }}
          controls={p.controls !== false}
          loop={!!p.loop}
          muted={!!p.muted}
          playsInline
          preload="metadata"
          {...(present && p.autoplay ? { 'data-autoplay': '' } : {})}
        />
      );
    }
    case 'iframe':
      return block.content
        ? <iframe src={block.content} title="embed" style={{ ...fill, border: 0, display: 'block' }} allow="autoplay; fullscreen" allowFullScreen />
        : <div className="blk-placeholder">Web page — set a URL</div>;
    case 'box':
      return null;
    default:
      return null;
  }
}

/**
 * Whole slide body at native size — the thing that goes inside a
 * reveal <section>. Also used for editor thumbnails.
 */
export function SlideBody({ slide, width, height, present }) {
  return (
    <div className="slide-canvas" style={{ position: 'relative', width, height, margin: '0 auto' }}>
      {slide.blocks.map((blk) => (
        <div key={blk.id} className={blockClass(blk, present)} style={blockStyle(blk)} {...blockAttrs(blk, present)}>
          <BlockContent block={blk} present={present} />
        </div>
      ))}
    </div>
  );
}

/** Inline style for a slide's background in the editor (mirrors reveal's). */
export function editorBackgroundInfo(bg) {
  if (bg?.type !== 'video' || !bg.value) return null;
  return classifyVideoUrl(bg.value);
}

export function editorBackgroundStyle(bg) {
  if (!bg || bg.type === 'none') return {};
  const o = bg.opacity ?? 1;
  switch (bg.type) {
    case 'color': return { background: bg.value, opacity: o };
    case 'gradient': return { background: bg.value, opacity: o };
    case 'image': return { backgroundImage: `url("${bg.value}")`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: o };
    default: return {};
  }
}
