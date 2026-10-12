const USER_AGENTS = {
  Mobile: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  Tablet: 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
};

module.exports = async (page, scenario, vp) => {
  const desktopUa = (await page.browser().userAgent()).replace('HeadlessChrome', 'Chrome');
  await page.setUserAgent(USER_AGENTS[vp.label] || desktopUa);
};
