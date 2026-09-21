import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;

import { buildClientSideChannelLetter } from './src/utils/letraCaixaEngine.js';

const svg = '<svg><path d="M0,0 L100,0 L100,100 L0,100 Z M25,25 L75,25 L75,75 L25,75 Z"/></svg>';
try {
    const res = buildClientSideChannelLetter(svg, {parede: 2});
    console.log('Group children:', res.group.children.length);
    res.group.children.forEach(c => {
        console.log('Child meshes:', c.children.length);
        if (c.children.length > 0) {
            console.log('Mesh geom depth:', c.children[0].geometry.parameters.options.depth);
        }
    });
} catch (e) {
    console.error(e);
}
