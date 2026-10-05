import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Evaluate heights
    const dimensions = await page.evaluate(() => {
        const root = document.getElementById('root');
        const main = document.querySelector('main');
        const mainChild = main ? main.firstElementChild : null;
        
        return {
            root: { h: root?.clientHeight, w: root?.clientWidth, cssText: root?.style.cssText },
            body: { h: document.body.clientHeight, w: document.body.clientWidth },
            html: { h: document.documentElement.clientHeight, w: document.documentElement.clientWidth },
            main: { h: main?.clientHeight, w: main?.clientWidth, classes: main?.className },
            mainChild: { h: mainChild?.clientHeight, w: mainChild?.clientWidth, classes: mainChild?.className }
        };
    });
    
    console.log(JSON.stringify(dimensions, null, 2));
    await browser.close();
})();
