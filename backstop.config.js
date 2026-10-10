require('dotenv').config();

const baseUrl = (process.env.BASE_URL || '').replace(/\/+$/, '');
if (!baseUrl) {
  throw new Error('BASE_URL missing in .env');
}

const cookiePath = process.env.AUTH_FILE || undefined;

const ALL_VIEWPORTS = [
  { label: 'Desktop', width: 1920, height: 1080 },
  { label: 'Tablet', width: 1023, height: 700 },
  { label: 'Mobile', width: 412, height: 915, isMobile: true, hasTouch: true }
];

const enabledViewports = (process.env.VIEWPORTS || 'Desktop')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const viewports = ALL_VIEWPORTS.filter(v => enabledViewports.includes(v.label));

const COMMON_HIDE = [
  '.cookie-banner',
  '#feedback-widget',
  '#onetrust-consent-sdk'
];

const pages = [
  { label: 'Homepage', path: '/' },
  { label: 'Hotels', path: '/hotels' },
  { label: 'Locations', path: '/locations' },
  {
    label: 'Alvaston_Hall_Hotel',
    path: '/hotels/alvaston-hall-hotel',
    removeSelectors: ['.hotelDetailPageArea.searchPageContainer']
  },
  { label: 'Entertainment', path: '/discover-warner-breaks/entertainment' },
  { label: 'Dining', path: '/discover-warner-breaks/dining' },
  { label: 'Dining_Market_Kitchen', path: '/discover-warner-breaks/dining/market-kitchen' },
  { label: 'Dining_Brasserie32', path: '/discover-warner-breaks/dining/brasserie32' },
  { label: 'Thoresby_Hall_Blue_Room', path: '/hotels/thoresby-hall-hotel/the-blue-room' },
  { label: 'Breaks', path: '/breaks' },
  {
    label: 'Festive',
    path: '/breaks/festive-breaks',
    removeSelectors: ['.searchPageArea.searchPageContainer']
  },
  { label: 'Spa_and_Wellness', path: '/breaks/spa-and-wellness' },
  { label: 'Spa_Treatments', path: '/discover-warner-breaks/spa-treatments' },
  { label: 'Reserve_Spa_Treatments', path: '/discover-warner-breaks/reserve-spa-treatments' },
  { label: 'Things_To_Do', path: '/discover-warner-breaks/things-to-do-and-activities' },
  { label: 'Heythrop_Park_Golf_Club', path: '/hotels/heythrop-park-hotel/golf-club' },
  { label: 'Celebrations', path: '/discover-warner-breaks/celebrations' },
  { label: 'Deals', path: '/deals' },
  { label: 'About', path: '/discover-warner-breaks' },
  { label: 'All_Inclusive', path: '/breaks/all-inclusive' },
  { label: 'First_Stay_Promise', path: '/first-stay-promise' },
  { label: 'Booking_Options', path: '/discover-warner-breaks/booking-options' },
  { label: 'My_Warner_Stay', path: '/my-warner-stay' }
];

const scenarios = pages.map(({ label, path, hideSelectors = [], removeSelectors = [], ...overrides }) => ({
  label,
  url: `${baseUrl}${path}`,
  cookiePath,
  delay: 0,
  selectors: ['document'],
  misMatchThreshold: 0,
  requireSameDimensions: true,
  hideSelectors: [...COMMON_HIDE, ...hideSelectors],
  removeSelectors,
  ...overrides
}));

module.exports = {
  id: 'warner_test',
  viewports,
  onBeforeScript: 'puppet/onBefore.js',
  onReadyScript: 'puppet/onReady.js',
  scenarios,
  paths: {
    bitmaps_reference: 'backstop_data/bitmaps_reference',
    bitmaps_test: 'backstop_data/bitmaps_test',
    engine_scripts: 'backstop_data/engine_scripts',
    html_report: 'backstop_data/html_report',
    ci_report: 'backstop_data/ci_report'
  },
  resembleOutputOptions: {
    errorColor: { red: 255, green: 0, blue: 255 },
    errorType: 'movement',
    transparency: 0.3,
    largeImageThreshold: 1200,
    useCrossOrigin: false,
    outputDiff: true,
    usePreciseMatching: true
  },
  fileNameTemplate: '{scenarioLabel}_{viewportLabel}',
  report: ['browser', 'CI'],
  engine: 'puppeteer',
  engineOptions: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--force-device-scale-factor=1',
      '--font-render-hinting=none',
      '--hide-scrollbars'
    ],
    waitTimeout: 60000
  },
  asyncCaptureLimit: 4,
  asyncCompareLimit: 20,
  debug: false,
  debugWindow: false
};
