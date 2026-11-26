// Loads the DM42 codec straight out of DM42EncoderDecoder.html so the tests always run the shipped code.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'DM42EncoderDecoder.html'), 'utf8');
const m = html.match(/<script>\s*(\/\/ DM42 \/ Free42[\s\S]*?)<\/script>/);
if (!m) throw new Error('codec script not found in DM42EncoderDecoder.html');
const ctx = {}; vm.createContext(ctx); vm.runInContext(m[1] + '\nthis.DM42 = DM42;', ctx);
module.exports = ctx.DM42;
