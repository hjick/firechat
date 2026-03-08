// Proxy file for Metro bundler (React Native) compatibility
// Metro doesn't fully support package.json "exports" field
module.exports = require('./dist/react.js');
