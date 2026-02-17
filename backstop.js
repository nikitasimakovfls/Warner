require('dotenv').config();

const baseUrl = "https://inte.warnerleisurehotels.co.uk/nick-tests/automation";

// List of the testing pages
const pages = [
  { label: "Promo Block Page", path: "/how-it-works-container/basic-content-page" },

];

// Testing scenario generator
const scenarios = pages.map(page => ({
  label: page.label,
  url: `${baseUrl}${page.path}`,
  readySelector: "body",
  onReadyScript: "puppet/onReady.js",
  delay: 2000,
  postInteractionWait: 1000,
  selectors: ["document"],
  misMatchThreshold: 0.1,
  requireSameDimensions: true,
  hideSelectors: [
    ".cookie-banner",
    "#feedback-widget",
    "#onetrust-consent-sdk"
  ],
  removeSelectors: []
}));

module.exports = {
  id: "warner_test",
  viewports: [
    { label: "Desktop", width: 1920, height: 1080 },
    { label: "Tablet", width: 1023, height: 700 },
    { label: "Mobile", width: 412, height: 915 }
  ],
  onBeforeScript: "",
  onReadyScript: "puppet/onReady.js",
  scenarios: scenarios,
  paths: {
    bitmaps_reference: "backstop_data/bitmaps_reference",
    bitmaps_test: "backstop_data/bitmaps_test",
    engine_scripts: "backstop_data/engine_scripts",
    html_report: "backstop_data/html_report",
    ci_report: "backstop_data/ci_report"
  },
  report: ["browser"],
  engine: "puppeteer",
  engineOptions: {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--force-device-scale-factor=1",
      "--js-flags=\"--max-old-space-size=512\""
    ],
    headless: "new",
    waitTimeout: 60000
  },
  asyncCaptureLimit: 1,
  asyncCompareLimit: 50,
  debug: false,
  debugWindow: false
};