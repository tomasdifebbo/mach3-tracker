const { SVGLoader } = require('three/addons/loaders/SVGLoader.js'); 
const loader = new SVGLoader(); 
const { JSDOM } = require('jsdom'); 
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>'); 
global.window = dom.window; 
global.document = dom.window.document; 
global.DOMParser = dom.window.DOMParser; 
global.XMLSerializer = dom.window.XMLSerializer; 

const svg = '<svg><path d="M0,0 L100,0 L100,100 L0,100 Z M25,25 L75,25 L75,75 L25,75 Z"/></svg>'; 
const data = loader.parse(svg); 

console.log('Paths found:', data.paths.length);
if (data.paths.length > 0) {
    const shapesDefault = data.paths[0].toShapes(); 
    const shapesCCW = data.paths[0].toShapes(true); 
    const shapesFalse = data.paths[0].toShapes(false); 
    console.log('Default holes:', shapesDefault[0]?.holes?.length);
    console.log('CCW holes:', shapesCCW[0]?.holes?.length);
    console.log('False holes:', shapesFalse[0]?.holes?.length);
}
