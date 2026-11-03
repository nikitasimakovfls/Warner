const PRESETS = {
  desktop: { type: 'desktop', width: 1920, height: 1080 },
  mobile: { type: 'mobile', width: 414, height: 896 }
};

const TYPES = ['desktop', 'mobile'];
const SPEC_RE = /^(desktop|mobile)(?::(\d{2,5})x(\d{2,5}))?$/i;

function parseViewport(spec) {
  const m = SPEC_RE.exec(String(spec || '').trim());
  if (!m) return null;
  const type = m[1].toLowerCase();
  const width = m[2] ? Number(m[2]) : PRESETS[type].width;
  const height = m[3] ? Number(m[3]) : PRESETS[type].height;
  if (width < 200 || width > 7680 || height < 200 || height > 4320) return null;
  return { type, width, height, size: `${width}x${height}`, key: `${type}/${width}x${height}`, spec: `${type}:${width}x${height}` };
}

const viewportLabel = type => (type === 'mobile' ? 'Mobile' : 'Desktop');

module.exports = { PRESETS, TYPES, parseViewport, viewportLabel };
