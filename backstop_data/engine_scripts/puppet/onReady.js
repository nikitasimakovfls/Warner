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

  await page.evaluate(() => {
    document.querySelectorAll('video').forEach(v => {
      v.pause();
      v.currentTime = 0;
    });
  });

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

  await page.evaluate(() => {
    document.querySelectorAll('.swiper, .swiper-container').forEach(el => {
      const sw = el.swiper;
      if (!sw) return;
      if (sw.autoplay && sw.autoplay.stop) sw.autoplay.stop();
      if (sw.params && sw.params.loop && sw.slideToLoop) sw.slideToLoop(0, 0, false);
      else if (sw.slideTo) sw.slideTo(0, 0, false);
      if (sw.update) sw.update();
    });
    const $ = window.jQuery;
    if ($ && $.fn) {
      if ($.fn.slick) {
        $('.slick-initialized').each((_, el) => {
          $(el).slick('slickPause');
          $(el).slick('slickGoTo', 0, true);
        });
      }
      if ($.fn.owlCarousel) {
        $('.owl-carousel').trigger('stop.owl.autoplay').trigger('to.owl.carousel', [0, 0]);
      }
    }
    if (window.Splide && window.Splide.instances) {
      Object.values(window.Splide.instances).forEach(sp => {
        if (sp.Components && sp.Components.Autoplay) sp.Components.Autoplay.pause();
        sp.go(0);
      });
    }
    window.dispatchEvent(new Event('resize'));
  });

  await sleep(300);
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {});
  await sleep(scenario.settleMs ?? 1000);
};
