import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const loader = new SVGLoader();
const svg = '<svg><path d="M0,0 L100,0 L100,100 L0,100 Z M25,25 L75,25 L75,75 L25,75 Z"/></svg>';
const svgData = loader.parse(svg);
svgData.paths.forEach(p => {
    const s1 = p.toShapes(true);
    console.log('toShapes(true):', s1.length, 'shapes, holes in first:', s1[0] ? s1[0].holes.length : 0);
    const s2 = p.toShapes();
    console.log('toShapes():', s2.length, 'shapes, holes in first:', s2[0] ? s2[0].holes.length : 0);
    const s3 = p.toShapes(false);
    console.log('toShapes(false):', s3.length, 'shapes, holes in first:', s3[0] ? s3[0].holes.length : 0);
});
