// Analytics are disabled: this fork sends no telemetry. The module keeps the
// API of the former Mixpanel wrapper so existing call sites keep working.
const noop = () => {};

module.exports = {
  token: null,
  track: noop,
  haikuTrack: noop,
  haikuTrackOnce: noop,
  mergeToPayload: (payload) => Object.assign({}, payload),
};
