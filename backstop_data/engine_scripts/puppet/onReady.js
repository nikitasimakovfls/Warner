const FREEZE_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
  #onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark-filter,
  #usercentrics-cmp-ui, #usercentrics-root {
    display: none !important;
  }
  html, body {
    overflow: auto !important;
  }
  html {
    scrollbar-width: none !important;
  }
  ::-webkit-scrollbar {
    display: none !important;
  }
  .apiVideoBlock iframe {
    display: none !important;
  }
  .apiVideoBlock .apiVideoBlockLink,
  .apiVideoBlock .apiVideoBlockLink img {
    visibility: visible !important;
  }
`;

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');
const started = new Date(Date.now() - process.uptime() * 1000);
const RUN_STAMP = `${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}-${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}`;

module.exports = async (page, scenario, vp, isReference, browserArg, config) => {
  const t = { start: Date.now() };
  const phases = [];
  let last = t.start;
  const mark = name => { const now = Date.now(); phases.push(`${name}=${now - last}`); last = now; };
  if (page.__t0) phases.push(`goto=${t.start - page.__t0}`);
  const expectedHost = new URL(scenario.url).host;
  const actualUrl = page.url();
  const actualHost = new URL(actualUrl).host;
  if (actualHost !== expectedHost) {
    throw new Error(`REDIRECT: ${scenario.url} -> ${actualUrl}`);
  }

  console.log(`${scenario.label} | ${vp.label} | ${actualUrl}`);

  await page.addStyleTag({ content: FREEZE_CSS });

  await page.evaluate(() => {
    document.querySelectorAll('.apiVideoBlock').forEach(block => {
      block.querySelectorAll('iframe').forEach(f => f.remove());
      block.classList.remove('videoPlaying');
    });
  });

  if (Array.isArray(scenario.removeSelectors) && scenario.removeSelectors.length) {
    await page.addStyleTag({
      content: `${scenario.removeSelectors.join(', ')} { display: none !important; }`
    });
  }

  mark('prep');

  const height = await page.evaluate(async () => {
    const step = 300;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    return document.body.scrollHeight;
  });
  mark('scroll');

  const { pending, skipped, stuck } = await page.evaluate(async () => {
    await document.fonts.ready;
    const vw = window.innerWidth;
    const visible = img => {
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > 0 && r.left < vw;
    };
    const all = Array.from(document.images).filter(img => !img.complete);
    const list = all.filter(img => img.loading !== 'lazy' || visible(img));
    list.forEach(img => { if (img.loading === 'lazy') img.loading = 'eager'; });
    await Promise.all(
      list
        .map(img => new Promise(r => {
          img.addEventListener('load', r, { once: true });
          img.addEventListener('error', r, { once: true });
          setTimeout(r, 10000);
        }))
    );
    const stuck = list.filter(img => !img.complete).map(img => {
      const r = img.getBoundingClientRect();
      const src = (img.currentSrc || img.getAttribute('src') || '-').split('?')[0];
      const parent = img.parentElement ? (img.parentElement.className || img.parentElement.tagName).toString().slice(0, 40) : '-';
      return `${src.slice(-80)}:loading=${img.loading},rect=${Math.round(r.left)},${Math.round(r.top + window.scrollY)},${Math.round(r.width)}x${Math.round(r.height)},parent=${parent}`;
    });
    return { pending: list.length, skipped: all.length - list.length, stuck };
  });
  mark('images');
  if (stuck.length) console.log(`${scenario.label} | stuckImages | count=${stuck.length} | ${stuck.slice(0, 5).join(' | ')}`);

  const idleTimeout = await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).then(() => 0, () => 1);
  mark('idle');

  await page.evaluate(() => {
    document.querySelectorAll('video').forEach(v => {
      v.pause();
      v.currentTime = 0;
    });
    window.dispatchEvent(new Event('resize'));
  });
  await sleep(1000);
  mark('pause');

  const tracks = await page.evaluate(async () => {
    const snapshot = () => Array.from(document.querySelectorAll('.sliderTrack')).map(track => {
      const container = track.closest('.gallerySliderContainerBlock');
      const items = track.querySelectorAll('.sliderItem');
      const active = Array.from(items).findIndex(i => i.classList.contains('active'));
      const leftAligned = container && container.classList.contains('leftAligned') &&
        (container.closest('.promoHowItWorksContainer') || container.classList.contains('hotel-promo-carousel'));
      if (leftAligned && active >= 0) {
        track.style.transform = `translateX(-${items[active].offsetLeft - items[0].offsetLeft}px)`;
      }
      return track.style.transform;
    }).join('|');
    let prev = snapshot();
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 300));
      const next = snapshot();
      if (next === prev) return { stable: true, value: next };
      prev = next;
    }
    return { stable: false, value: prev };
  });
  mark('sliders');
  console.log(`${scenario.label} | sliderTrack | stable=${tracks.stable} | ${tracks.value}`);
  await sleep(scenario.settleMs ?? 1000);
  mark('settle');
  const final = await page.evaluate(async () => {
    const vw = window.innerWidth;
    const visible = img => {
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > 0 && r.left < vw;
    };
    const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
    const imgs = Array.from(document.images).filter(visible);
    const late = imgs.filter(img => !img.complete);
    late.forEach(img => { if (img.loading === 'lazy') img.loading = 'eager'; });
    await timeout(Promise.all(late.map(img => new Promise(r => {
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
    }))), 5000);
    await timeout(Promise.all(imgs.map(img => img.decode().catch(() => {}))), 3000);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { late: late.length, stillLate: late.filter(img => !img.complete).length };
  });
  mark('final');
  const paintSteps = await page.evaluate(async () => {
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const step = window.innerHeight;
    const height = document.documentElement.scrollHeight;
    let n = 0;
    for (let y = 0; y < height; y += step) {
      window.scrollTo(0, y);
      await frame();
      await new Promise(r => setTimeout(r, 60));
      n++;
    }
    window.scrollTo(0, 0);
    await frame();
    await new Promise(r => setTimeout(r, 60));
    return n;
  });
  mark('paint');
  const imgState = await page.evaluate(() => {
    const vw = window.innerWidth;
    return Array.from(document.images).map(img => {
      const r = img.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0 && r.right > 0 && r.left < vw)) return null;
      const src = img.currentSrc || img.src || '';
      const m = /width=(\d+)/.exec(src);
      return {
        file: src.split('?')[0].split('/').pop(),
        requested: m ? Number(m[1]) : null,
        natural: img.naturalWidth,
        rendered: Math.round(r.width),
        x: Math.round(r.left),
        y: Math.round(r.top + window.scrollY),
        sizes: img.getAttribute('sizes') || null
      };
    }).filter(Boolean);
  });
  const imgSig = crypto.createHash('md5').update(JSON.stringify(imgState.map(i => [i.file, i.requested, i.natural, i.rendered, i.x, i.y]))).digest('hex').slice(0, 8);
  try {
    const target = (scenario.url.match(/^https?:\/\/([^/]+)/) || [, 'unknown'])[1];
    const dir = path.join(process.cwd(), 'reports', 'imgstate', target, `${vp.label}_${vp.width}x${vp.height}`, RUN_STAMP);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${scenario.label}.json`), JSON.stringify(imgState, null, 1));
  } catch (e) {}
  const lowres = await page.evaluate(() => {
    const vw = window.innerWidth;
    const dpr = window.devicePixelRatio || 1;
    return Array.from(document.images).filter(img => {
      const r = img.getBoundingClientRect();
      return img.complete && img.naturalWidth > 0 && r.width > 0 && r.height > 0 && r.right > 0 && r.left < vw && img.naturalWidth < r.width * dpr * 0.9;
    }).map(img => {
      const src = img.currentSrc || img.src;
      const m = /width=(\d+)/.exec(src);
      const file = src.split('?')[0].split('/').pop();
      return `${file}:natural=${img.naturalWidth},rendered=${Math.round(img.getBoundingClientRect().width)},requested=${m ? m[1] : '-'},vw=${vw}`;
    });
  });
  if (lowres.length) console.log(`${scenario.label} | lowres | count=${lowres.length} | ${lowres.slice(0, 10).join(' | ')}`);
  console.log(`${scenario.label} | timing | ${phases.join(' | ')} | total=${Date.now() - (page.__t0 || t.start)} | height=${height} | pendingImages=${pending} | skippedImages=${skipped} | idleTimeout=${idleTimeout} | lowresImages=${lowres.length} | lateImages=${final.late} | stillLateImages=${final.stillLate} | imgSig=${imgSig} | paintSteps=${paintSteps}`);
};
