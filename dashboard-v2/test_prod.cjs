import { JSDOM } from 'jsdom';
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;

(async () => {
    try {
        const js = require('fs').readFileSync('../server/public/assets/index-BRR2jteL.js', 'utf8');
        dom.window.eval(js);
        console.log('Script evaluated successfully.');
    } catch (e) {
        console.error('Eval error:', e);
    }
})();
