{
  "name": "<%= cloudFnName %>",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {},
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@cloudbase/node-sdk": "2.4.7"<%= Object.keys(cloudFnDeps).length ? ",":'' %>
    <% Object.keys(cloudFnDeps).forEach((k,index,arr) => { %>
    "<%= k %>": "<%= cloudFnDeps[k] %>"<%= index == arr.length-1?"":',' %>
    <% }) %>
  }
}
