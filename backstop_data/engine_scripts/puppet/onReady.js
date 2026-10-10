const FREEZE_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
  #onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark-filter {
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
`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = async (page, scenario, vp) => {
  const expectedHost = new URL(scenario.url).host;
  const actualUrl = page.url();
  const actualHost = new URL(actualUrl).host;
  const hasLoginForm = await page.$('#UserName, input[type="password"]');

  if (actualHost !== expectedHost || hasLoginForm) {
    throw new Error(`AUTH: redirected to login (${actualUrl}). Run: npm run login`);
  }

  console.log(`${scenario.label} | ${vp.label} | ${actualUrl}`);

  await page.addStyleTag({ content: FREEZE_CSS });

  if (Array.isArray(scenario.removeSelectors) && scenario.removeSelectors.length) {
    await page.addStyleTag({
      content: `${scenario.removeSelectors.join(', ')} { display: none !important; }`
    });
  }

  await page.evaluate(async () => {
    const step = 300;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });

  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter(img => !img.complete)
        .map(img => new Promise(r => {
          img.addEventListener('load', r, { once: true });
          img.addEventListener('error', r, { once: true });
          setTimeout(r, 10000);
        }))
    );
  });

  await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {});

  await page.evaluate(() => {
    document.querySelectorAll('video').forEach(v => {
      v.pause();
      v.currentTime = 0;
    });
    window.dispatchEvent(new Event('resize'));
  });
  await sleep(1000);

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
  console.log(`${scenario.label} | sliderTrack | stable=${tracks.stable} | ${tracks.value}`);
  await sleep(scenario.settleMs ?? 1000);
};
