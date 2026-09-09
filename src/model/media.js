/**
 * Video URL handling. People paste YouTube / Vimeo / Google Drive links;
 * a <video> tag can't play those, they need an <iframe> embed. Direct
 * files (.mp4/.webm/.ogg/.mov, blob:, data:) play in a <video>.
 */
export function classifyVideoUrl(url = '') {
  const u = String(url).trim();
  if (!u) return { kind: 'none', src: '' };

  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) return { kind: 'iframe', provider: 'youtube', src: `https://www.youtube.com/embed/${m[1]}?rel=0` };

  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: 'iframe', provider: 'vimeo', src: `https://player.vimeo.com/video/${m[1]}` };

  m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (m) return { kind: 'iframe', provider: 'gdrive', src: `https://drive.google.com/file/d/${m[1]}/preview` };

  if (/^(blob:|data:video)/.test(u) || /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(u)) return { kind: 'file', src: u };

  // Unknown http URL — assume it's a page that embeds a player
  if (/^https?:\/\//.test(u)) return { kind: 'iframe', provider: 'unknown', src: u };
  return { kind: 'file', src: u };
}

/** Embed URL with autoplay/mute/loop params for background use. */
export function backgroundEmbedUrl(info) {
  if (info.provider === 'youtube') {
    const id = info.src.match(/embed\/([\w-]+)/)?.[1];
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&rel=0`;
  }
  if (info.provider === 'vimeo') return `${info.src}?autoplay=1&muted=1&loop=1&background=1`;
  return info.src;
}
