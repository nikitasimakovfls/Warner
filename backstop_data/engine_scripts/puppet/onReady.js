module.exports = async (page, scenario, vp) => {
  console.log('--- Start: ' + scenario.label);

  const userSelector = '#UserName';
  const passSelector = '#Password';
  const submitSelector = '#Submit';
  const cookieAcceptSelector = '#onetrust-accept-btn-handler';
  const user = process.env.WARNER_USER;
  const pass = process.env.WARNER_PASS;

  try {
    // 1. Authorization
    await page.waitForSelector(userSelector, { visible: true, timeout: 3000 });
    await page.type(userSelector, user);
    await page.type(passSelector, pass);
    await page.click(submitSelector);
    
    await new Promise(r => setTimeout(r, 3000));

    // 2. Cookie handling (if present)
    if (await page.$(cookieAcceptSelector)) {
        await page.click(cookieAcceptSelector);
        console.log('Cookie accepted');
    }

    // 3. Force stop animations
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

    // 4. Scroll to calculate full document height and trigger lazy loading
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 400;
        let timer = setInterval(() => {
          let scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 30);
      });
    });

    // 5. Final scroll to top before capture
    await page.evaluate(() => window.scrollTo(0, 0));
    
    // Technical pause (1s) to allow the browser to repaint the top area after scrolling
    await new Promise(r => setTimeout(r, 1000));
    console.log('Ready for capture.');

  } catch (e) {
    console.log('Scenario executed with skipped steps (possibly already logged in).');
  }
};