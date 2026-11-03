const USER_AGENTS = {
  Mobile: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
};

module.exports = async (page, scenario, vp) => {
  const desktopUa = (await page.browser().userAgent()).replace('HeadlessChrome', 'Chrome');
  await page.setUserAgent(USER_AGENTS[vp.label] || desktopUa);
  if (vp.label === 'Mobile') {
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  }
};
