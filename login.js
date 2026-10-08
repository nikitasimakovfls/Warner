require('dotenv').config();
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const baseUrl = process.env.BASE_URL;
const authFile = path.resolve(process.env.AUTH_FILE || '.auth/cookies.json');
const timeoutMs = Number(process.env.LOGIN_TIMEOUT_MS || 300000);

if (!baseUrl) {
  console.error('ERROR: BASE_URL missing in .env');
  process.exit(1);
}

const baseHost = new URL(baseUrl).host;

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--window-size=1280,900']
  });
  const [page] = await browser.pages();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  const deadline = Date.now() + timeoutMs;
  let stableSince = 0;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000));
    let url;
    try { url = new URL(page.url()); } catch { continue; }
    const onBase = url.host === baseHost;
    const hasLoginForm = onBase && await page.$('#UserName, input[type="password"]').catch(() => null);
    if (onBase && !hasLoginForm) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= 3000) break;
    } else {
      stableSince = 0;
    }
  }

  if (!stableSince) {
    console.error(`ERROR: login timeout ${timeoutMs} ms, url: ${page.url()}`);
    await browser.close();
    process.exit(1);
  }

  await page.waitForNetworkIdle({ idleTime: 1000, timeout: 15000 }).catch(() => {});
  const cookies = await page.cookies(baseUrl);
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  fs.writeFileSync(authFile, JSON.stringify(cookies, null, 2));

  const expiring = cookies.filter(c => c.expires > 0).map(c => c.expires);
  const minExpiry = expiring.length ? new Date(Math.min(...expiring) * 1000).toISOString() : 'session';
  console.log(`cookies: ${cookies.length}`);
  console.log(`file: ${authFile}`);
  console.log(`earliest expiry: ${minExpiry}`);
  await browser.close();
})().catch(e => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});
