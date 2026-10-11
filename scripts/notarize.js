// electron-builder afterSign hook: notarizes macOS builds when Apple credentials are provided, otherwise skips.
// Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID (and a signing identity for electron-builder,
// e.g. CSC_LINK / CSC_KEY_PASSWORD) to produce signed, notarized builds. Unsigned builds still work locally.
const {notarize} = require('@electron/notarize');

exports.default = async function notarizing (context) {
  const {electronPlatformName, appOutDir} = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const {APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID} = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log('[notarize] Apple credentials not set; skipping notarization');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  await notarize({
    appPath: `${appOutDir}/${appName}.app`,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });
};
