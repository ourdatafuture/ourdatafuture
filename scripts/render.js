const fs = require('fs');
const marked = require('marked');
const mustache = require('mustache');

// Render markdown content
const md = fs.readFileSync('content/index.md', 'utf8');
const content = marked(md).replace(/img\//g, '../content/img/');

// Render final index.html (by injecting the markdown content into a template)
const tpl = fs.readFileSync('web/index.mustache', 'utf8');
const output = mustache.render(tpl, { content });
fs.writeFileSync('web/index.html', output);
