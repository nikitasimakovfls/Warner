const ENVIRONMENTS = require('./environments');
const { parseViewport, viewportLabel } = require('./viewports');

const target = process.env.TARGET;
if (!ENVIRONMENTS[target]) {
  throw new Error(`TARGET must be one of: ${Object.keys(ENVIRONMENTS).join(', ')}. Run: npm run test <target>`);
}
const baseUrl = ENVIRONMENTS[target].replace(/\/+$/, '');

const viewport = parseViewport(process.env.VIEWPORT || 'desktop');
if (!viewport) {
  throw new Error('VIEWPORT must be desktop, mobile, desktop:WxH or mobile:WxH');
}

const viewports = [{
  label: viewportLabel(viewport.type),
  width: viewport.width,
  height: viewport.height
}];

const COMMON_HIDE = [
  '.cookie-banner',
  '#feedback-widget'
];

const COMMON_REMOVE = [
  '.searchPageContainer'
];

const HEADER = 'header.pageHeader';
const FOOTER = 'footer.pageFooter';
const PROMO = '.promoBannerBar';

const components = [
  { label: 'Global_Promo_Banner', path: '/hotels', selector: PROMO },
  { label: 'Global_Header_Global', path: '/hotels', selector: HEADER },
  { label: 'Global_Header_Warner', path: '/hotels/hotels', selector: HEADER },
  { label: 'Global_Header_Reserve', path: '/hotels/reserve', selector: HEADER },
  { label: 'Global_Header_Comfort', path: '/hotels/comfort', selector: HEADER },
  { label: 'Global_Header_Hotel_Warner', path: '/hotels/alvaston-hall-hotel', selector: HEADER },
  { label: 'Global_Header_Hotel_Reserve', path: '/hotels/thoresby-hall-hotel/the-blue-room', selector: HEADER },
  { label: 'Global_Footer', path: '/hotels', selector: FOOTER, hideSelectors: [HEADER] }
];

const pages = [
  { label: 'Homepage', path: '/' },
  { label: 'Hotels', path: '/hotels' },
  { label: 'Locations', path: '/locations' },
  { label: 'Hotels_Reserve', path: '/hotels/reserve' },
  { label: 'Hotels_Warner', path: '/hotels/hotels' },
  { label: 'Hotels_Comfort', path: '/hotels/comfort' },
  { label: 'Alvaston_Hall_Hotel', path: '/hotels/alvaston-hall-hotel' },
  { label: 'Entertainment', path: '/discover-warner-breaks/entertainment' },
  { label: 'Dining', path: '/discover-warner-breaks/dining' },
  { label: 'Dining_Market_Kitchen', path: '/discover-warner-breaks/dining/market-kitchen' },
  { label: 'Dining_Brasserie32', path: '/discover-warner-breaks/dining/brasserie32' },
  { label: 'Thoresby_Hall_Blue_Room', path: '/hotels/thoresby-hall-hotel/the-blue-room' },
  { label: 'Breaks', path: '/breaks' },
  { label: 'Festive', path: '/breaks/festive-breaks' },
  { label: 'Weekend_Breaks', path: '/breaks/short-breaks/weekend-breaks' },
  { label: 'Couples_Breaks', path: '/breaks/couples-breaks' },
  { label: 'Singles_Breaks', path: '/breaks/short-breaks/singles-breaks' },
  { label: 'Midweek_Breaks', path: '/breaks/short-breaks/midweek-breaks' },
  { label: 'Two_Night_Breaks', path: '/breaks/short-breaks/2-night-breaks' },
  { label: 'Three_Night_Breaks', path: '/breaks/3-night-breaks', targets: ['prod'] },
  { label: 'Drinks_Inclusive_Breaks', path: '/breaks/drinks-inclusive-breaks' },
  { label: 'Seasonal_Breaks', path: '/breaks/seasonal-breaks' },
  { label: 'Spa_and_Wellness', path: '/breaks/spa-and-wellness' },
  { label: 'Spa_Treatments', path: '/discover-warner-breaks/spa-treatments' },
  { label: 'Reserve_Spa_Treatments', path: '/discover-warner-breaks/reserve-spa-treatments' },
  { label: 'Things_To_Do', path: '/discover-warner-breaks/things-to-do-and-activities' },
  { label: 'Heythrop_Park_Golf_Club', path: '/hotels/heythrop-park-hotel/golf-club', engineOptions: { gotoParameters: { waitUntil: 'domcontentloaded' } } },
  { label: 'Celebrations', path: '/discover-warner-breaks/celebrations' },
  { label: 'Deals', path: '/deals' },
  { label: 'About', path: '/discover-warner-breaks' },
  { label: 'All_Inclusive', path: '/breaks/all-inclusive' },
  { label: 'First_Stay_Promise', path: '/first-stay-promise' },
  { label: 'Booking_Options', path: '/discover-warner-breaks/booking-options' },
  { label: 'My_Warner_Stay', path: '/my-warner-stay' }
];

const build = ({ label, path, targets, selector, hideSelectors = [], removeSelectors = [], ...overrides }, layoutHide) => ({
  label,
  url: `${baseUrl}${path}`,
  delay: 0,
  selectors: [selector || 'document'],
  misMatchThreshold: 0,
  requireSameDimensions: true,
  hideSelectors: [...COMMON_HIDE, ...layoutHide, ...hideSelectors],
  removeSelectors: [...COMMON_REMOVE, ...removeSelectors],
  ...overrides
});

const forTarget = p => !p.targets || p.targets.includes(target);

const scenarios = [
  ...components.filter(forTarget).map(c => build(c, [])),
  ...pages.filter(forTarget).map(p => build(p, [PROMO, HEADER, FOOTER]))
];

module.exports = {
  id: `warner_${target}`,
  viewportKey: viewport.key,
  viewports,
  onBeforeScript: 'puppet/onBefore.js',
  onReadyScript: 'puppet/onReady.js',
  scenarios,
  paths: {
    bitmaps_reference: `backstop_data/bitmaps_reference/${target}/${viewport.key}`,
    bitmaps_test: `backstop_data/bitmaps_test/${target}/${viewport.key}`,
    engine_scripts: 'backstop_data/engine_scripts',
    html_report: `backstop_data/html_report/${target}/${viewport.key}`,
    ci_report: `backstop_data/ci_report/${target}/${viewport.key}`
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
  report: process.env.UI_RUN ? ['CI'] : ['browser', 'CI'],
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
