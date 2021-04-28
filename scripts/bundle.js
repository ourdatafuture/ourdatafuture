const fs = require('fs');
const path = require('path');
const Parcel = require('@parcel/core').default;

const distDir = path.join(__dirname, '../dist');

fs.rmdirSync(distDir, { recursive: true });

(async () => {
  let bundler = new Parcel({
    entries: path.join(__dirname, '../web/index.html'),
    defaultConfig: require.resolve('@parcel/config-default'),
    defaultTargetOptions: {
      distDir: distDir,
      publicUrl: '.',
    },
    mode: 'production',
  });
  await bundler.run();
})();
