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
    
    // Fill the login form
    await page.type('input[type="email"]', 'casadotrem@gmail.com');
    await page.type('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    
    console.log("LOGIN CLICKED. Waiting for dashboard to load...");
    
    // wait 5 seconds
    await new Promise(r => setTimeout(r, 5000));
    
    // Check if #root is empty
    const rootHtml = await page.$eval('#root', el => el.innerHTML);
    const htmlLen = rootHtml.length;
    console.log('ROOT HTML AFTER LOGIN LENGTH:', htmlLen);
    if (htmlLen < 500) {
        console.log('ROOT HTML:', rootHtml);
    } else {
        console.log('Dashboard successfully rendered with length:', htmlLen);
    }
    
    await browser.close();
})();
