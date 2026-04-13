const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    page.on('requestfailed', request => {
        console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
    });

    await page.goto('https://mach3-tracker-production.up.railway.app/', { waitUntil: 'networkidle0' });
    
    // Check if #root is empty
    const rootHtml = await page.$eval('#root', el => el.innerHTML);
    console.log('ROOT HTML:', rootHtml);
    
    await browser.close();
})();
