module.exports = async (page, scenario, vp) => {
  console.log('--- Start: ' + scenario.label);

  const userSelector = '#UserName';
  const passSelector = '#Password';
  const submitSelector = '#Submit';
  const cookieAcceptSelector = '#onetrust-accept-btn-handler';
  const user = process.env.WARNER_USER;
  const pass = process.env.WARNER_PASS;

  try {
    // 1. Authorization: Enter credentials and log in
    await page.waitForSelector(userSelector, { visible: true, timeout: 2000 });
    await page.type(userSelector, user);
    await page.type(passSelector, pass);
    await page.click(submitSelector);
    
    // Wait for the initial redirect and page load after login
    await new Promise(r => setTimeout(r, 2000));

    // 2. Cookie handling: Click accept button if the banner appears
    if (await page.$(cookieAcceptSelector)) {
        await page.click(cookieAcceptSelector);
        console.log('Cookie accepted');
    }

    // 3. Force stop animations: Inject CSS to freeze all transitions and keyframes
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          transition-duration: 0s !important;
          animation-duration: 0s !important;
        }
      `
    });
    console.log('CSS Animations frozen.');

    // 4. Smart scroll: Move slowly to trigger lazy-loading for images and heavy components
    console.log('Scrolling slowly to trigger lazy-load images...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 200; // Smaller step for thorough coverage
        let timer = setInterval(() => {
          let scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          // Stop scrolling when the bottom of the page is reached
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 150); // 150ms delay gives the browser time to request and render images
      });
    });

    // Important: Wait at the bottom to ensure the last images are fully downloaded
    //await new Promise(r => setTimeout(r, 2000));

    // 5. Reset position: Scroll back to the top before taking the screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    
    // Technical pause to ensure the top area is repainted after the scroll jump
    await new Promise(r => setTimeout(r, 3000));
    console.log('Ready for capture.');

  } catch (e) {
    console.log('Scenario executed with skipped steps (possibly already logged in).');
  }
};