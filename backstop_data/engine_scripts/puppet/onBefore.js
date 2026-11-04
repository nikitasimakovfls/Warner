const USER_AGENTS = {
  Mobile: version => `Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Mobile Safari/537.36`,
  Tablet: version => `Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
};

module.exports = async (page, scenario, vp) => {
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
