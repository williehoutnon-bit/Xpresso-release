import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Find the Login button and click it
    const buttons = await page.$$('button');
    for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Login')) {
            console.log('Clicking Login button...');
            await btn.click();
            await new Promise(r => setTimeout(r, 2000));
            break;
        }
    }
    
    await browser.close();
})();
