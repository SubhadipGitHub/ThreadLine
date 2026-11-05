// Loads CORE() (parser + stats) out of index.html so it can be unit-tested in Node
// without a browser and without splitting the app into modules.
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = html.indexOf('function CORE(){');
const b = html.indexOf('\nconst CORE_API=CORE();');
if (a < 0 || b < 0) throw new Error('Could not locate CORE() in index.html');
module.exports = new Function(html.slice(a, b) + '\nreturn CORE();')();
