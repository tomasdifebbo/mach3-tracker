import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;
import { buildClientSideChannelLetter } from './src/utils/letraCaixaEngine.js';

const svg = '<svg><path d="M0,0 L100,0 L100,100 L0,100 Z"/></svg>';
const res = buildClientSideChannelLetter(svg, {parede: 2});
const geom = res.group.children[0].children[0].geometry;
console.log('meshCorpo geometry type:', geom.type);
console.log('meshCorpo vertices count:', geom.attributes.position.count);
const faceGeom = res.group.children[1].children[0].geometry;
console.log('meshFace vertices count:', faceGeom.attributes.position.count);
