const fs = require('fs');
const path = require('path');

const USER_AGENTS = {
  Mobile: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  Tablet: 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
};

let cachedCookies = null;

function loadCookies(scenario) {
  if (cachedCookies) return cachedCookies;
  const file = path.resolve(scenario.cookiePath);
  if (!fs.existsSync(file)) {
    throw new Error(`AUTH: cookie file not found: ${file}. Run: npm run login`);
  }
  const now = Date.now() / 1000;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  cachedCookies = raw.filter(c => !(c.expires > 0 && c.expires < now)).map(c => {
    const cookie = {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      httpOnly: !!c.httpOnly,
      secure: !!c.secure
    };
    if (c.expires > 0) cookie.expires = c.expires;
    if (c.sameSite) cookie.sameSite = c.sameSite;
    return cookie;
  });
  return cachedCookies;
}

module.exports = async (page, scenario, vp) => {
  const desktopUa = (await page.browser().userAgent()).replace('HeadlessChrome', 'Chrome');
  await page.setUserAgent(USER_AGENTS[vp.label] || desktopUa);
  if (scenario.cookiePath) {
    await page.setCookie(...loadCookies(scenario));
  }
};
