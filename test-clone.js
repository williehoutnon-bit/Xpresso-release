const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html>
<div id="root">
  <span data-node-id="1">a</span>
  <span data-node-id="2">b</span>
  <span data-node-id="3">c</span>
</div>`);
const document = dom.window.document;
const range = document.createRange();
const root = document.getElementById('root');
range.setStart(root.childNodes[1].firstChild, 0); // start at 'a'
range.setEnd(root.childNodes[5].firstChild, 1);   // end at 'c'
const clone = range.cloneContents();
const ids = Array.from(clone.querySelectorAll('[data-node-id]')).map(el => el.getAttribute('data-node-id'));
console.log("Selected IDs:", ids);
