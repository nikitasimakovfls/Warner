const PRESETS = {
  desktop: { type: 'desktop', width: 1920, height: 1080 },
  tablet: { type: 'tablet', width: 768, height: 1024 },
  mobile: { type: 'mobile', width: 414, height: 896 }
};

const TYPES = ['desktop', 'tablet', 'mobile'];
const TYPE_RE = '(desktop|tablet|mobile)';
const SPEC_RE = new RegExp(`^${TYPE_RE}(?::(\\d{2,5})x(\\d{2,5}))?$`, 'i');

function parseViewport(spec) {
  const m = SPEC_RE.exec(String(spec || '').trim());
  if (!m) return null;
  const type = m[1].toLowerCase();
  const width = m[2] ? Number(m[2]) : PRESETS[type].width;
  const height = m[3] ? Number(m[3]) : PRESETS[type].height;
  if (width < 200 || width > 7680 || height < 200 || height > 4320) return null;
  return { type, width, height, size: `${width}x${height}`, key: `${type}/${width}x${height}`, spec: `${type}:${width}x${height}` };
}

const LABELS = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };
const viewportLabel = type => LABELS[type] || 'Desktop';
const typeForWidth = width => (width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop');

module.exports = { PRESETS, TYPES, TYPE_RE, parseViewport, viewportLabel, typeForWidth };
