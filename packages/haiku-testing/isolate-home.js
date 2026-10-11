// Preloaded by test runners (`-r haiku-testing/isolate-home`): points HOME at a throwaway directory
// so tests never read or write the developer's real ~/.haiku (auth, registry, projects, logs).
const fs = require('fs');
const os = require('os');
const path = require('path');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'animator-test-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home;
