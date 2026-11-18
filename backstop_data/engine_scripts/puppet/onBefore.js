const USER_AGENTS = {
  Mobile: version => `Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Mobile Safari/537.36`,
  Tablet: version => `Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
};

const { PNG } = require('pngjs');

const frame = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

function stitch(page) {
  const original = page.screenshot.bind(page);
  page.screenshot = async (opts = {}) => {
    if (!opts.fullPage || opts.clip) return original(opts);
    const { path: file, fullPage, captureBeyondViewport, encoding, ...rest } = opts;
    const width = page.viewport().width;
    const info = await page.evaluate(() => {
      const visible = el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
      const all = Array.from(document.body.querySelectorAll('*'));
      const fixed = all.filter(el => getComputedStyle(el).position === 'fixed' && visible(el));
      const sticky = all.filter(el => getComputedStyle(el).position === 'sticky' && visible(el)).length;
      fixed.forEach((el, i) => el.setAttribute('data-stitch-fixed', i));
      const anchors = all.filter(el => el.offsetHeight > 0 && !el.closest('[data-stitch-fixed]'));
      const pick = [];
      const n = Math.min(60, anchors.length);
      for (let i = 0; i < n; i++) pick.push(anchors[Math.floor(i * anchors.length / n)]);
      pick.forEach((el, i) => el.setAttribute('data-stitch-anchor', i));
      return {
        height: document.documentElement.scrollHeight,
        step: window.innerHeight,
        innerWidth: window.innerWidth,
        scale: window.visualViewport ? window.visualViewport.scale : 1,
        fixed: fixed.length,
        sticky,
        anchors: pick.map(el => Math.round(el.getBoundingClientRect().top + window.scrollY))
      };
    });
    const layout = () => page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      anchors: Array.from(document.querySelectorAll('[data-stitch-anchor]')).sort((a, b) => a.getAttribute('data-stitch-anchor') - b.getAttribute('data-stitch-anchor')).map(el => Math.round(el.getBoundingClientRect().top + window.scrollY))
    }));
    const cleanup = () => page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll('[data-stitch-fixed]').forEach(el => { el.style.removeProperty('visibility'); el.removeAttribute('data-stitch-fixed'); });
      document.querySelectorAll('[data-stitch-anchor]').forEach(el => el.removeAttribute('data-stitch-anchor'));
    });
    const fallback = async reason => {
      await cleanup();
      await frame(page);
      console.log(`stitch | fallback fullpage | ${reason}`);
      return original(opts);
    };
    if (Math.abs(info.innerWidth - width) > 1 || info.scale !== 1) return fallback(`innerWidth=${info.innerWidth} | scale=${info.scale}`);
    if (info.sticky) return fallback(`sticky=${info.sticky}`);
    const { height, step } = info;
    const out = new PNG({ width, height });
    let slices = 0;
    for (let y = 0; y < height; y += step) {
      const top = Math.max(0, Math.min(y, height - step));
      const actual = await page.evaluate(t => { window.scrollTo(0, t); return Math.round(window.scrollY); }, top);
      await frame(page);
      await new Promise(r => setTimeout(r, 50));
      const now = await layout();
      const shift = now.anchors.findIndex((v, i) => Math.abs(v - info.anchors[i]) > 1);
      if (now.height !== height || shift >= 0) {
        return fallback(`layout shift at scrollY=${actual} | height ${height}->${now.height} | anchor ${shift >= 0 ? `${info.anchors[shift]}->${now.anchors[shift]}` : '-'}`);
      }
      const png = PNG.sync.read(await original({ ...rest, type: 'png' }));
      const from = y - actual;
      const rows = Math.min(png.height - from, height - y);
      if (from < 0 || rows <= 0) return fallback(`bad slice y=${y} scrollY=${actual}`);
      const w = Math.min(width, png.width) * 4;
      for (let r = 0; r < rows; r++) {
        png.data.copy(out.data, (y + r) * width * 4, (from + r) * png.width * 4, (from + r) * png.width * 4 + w);
      }
      if (slices === 0 && info.fixed) {
        await page.evaluate(() => document.querySelectorAll('[data-stitch-fixed]').forEach(el => el.style.setProperty('visibility', 'hidden', 'important')));
      }
      slices++;
    }
    await cleanup();
    const buffer = PNG.sync.write(out);
    if (file) require('fs').writeFileSync(file, buffer);
    console.log(`stitch | slices=${slices} | ${width}x${height} | fixed=${info.fixed}`);
    return encoding === 'base64' ? buffer.toString('base64') : buffer;
  };
}

module.exports = async (page, scenario, vp, isReference, browserArg, config) => {
  page.__t0 = Date.now();
  if (config && config.captureMode === 'stitched') stitch(page);
  const browser = page.browser();
  const ua = USER_AGENTS[vp.label];
  if (ua) {
    const version = ((await browser.version()).match(/\/(\d+)\./) || [, '127'])[1];
    await page.setUserAgent(ua(`${version}.0.0.0`));
    const touch = { isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
    const setViewport = page.setViewport.bind(page);
    await setViewport({ width: vp.width, height: vp.height, ...touch });
    page.setViewport = next => setViewport({ ...next, ...touch });
  } else {
    await page.setUserAgent((await browser.userAgent()).replace('HeadlessChrome', 'Chrome'));
  }
};
