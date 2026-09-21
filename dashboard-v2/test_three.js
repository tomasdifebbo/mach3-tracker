import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;

import { buildClientSideChannelLetter, exportModelToStlBlob } from './src/utils/letraCaixaEngine.js';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M10,10 L90,10 L90,90 L10,90 Z"/></svg>';

try {
    const res = buildClientSideChannelLetter(svg, {});
    console.log('Success! Group children:', res.group.children.length);
    
    // Simulate blob URL creation to test Blob existence
    const blob = exportModelToStlBlob(res.group);
    console.log('STL Blob size:', blob.size);
} catch (e) {
    console.error('Error during generation:', e);
}
