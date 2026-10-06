/**
 * Studyling widgets + study-session Live Activity (WidgetKit / ActivityKit).
 * Bundle identifier: com.focusling.app.widgets (legacy Focusling prefix kept for signing stability).
 * UNTESTED until an EAS development build runs on a device.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'StudylingWidgets',
  displayName: 'Studyling',
  bundleIdentifier: '.widgets',
  deploymentTarget: '16.4',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  colors: {
    $accent: '#7B5CFF',
    $widgetBackground: '#FFFDF9',
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
