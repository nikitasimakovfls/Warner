module.exports = async (page, scenario, vp) => {
  if (vp.label === 'Mobile') {
    // Passport for Smartphone
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36');
    console.log(`--- UA set to Mobile for: ${scenario.label}`);
    
  } else if (vp.label === 'Tablet') {
    // Passport for iPad/Tablet
    await page.setUserAgent('Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
    console.log(`--- UA set to Tablet for: ${scenario.label}`);
    
  } else {
    // Passport for Desktop (Windows/Mac)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');
  }
};