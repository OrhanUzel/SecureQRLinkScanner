const { withAppBuildGradle } = require('@expo/config-plugins');
const { withBuildProperties } = require('expo-build-properties');

module.exports = function withUnityAds(config) {
  config = withBuildProperties(config, {
    ios: {
      extraPods: [
        { name: 'GoogleMobileAdsMediationUnity', version: '4.16.4.0' },
      ],
    },
  });

  config = withAppBuildGradle(config, (config) => {
    const gradle = config.modResults.contents;
    const depLine1 = 'implementation("com.unity3d.ads:unity-ads:4.16.4")';
    const depLine2 = 'implementation("com.google.ads.mediation:unity:4.16.4.0")';
    if (!gradle.includes(depLine1) || !gradle.includes(depLine2)) {
      config.modResults.contents = gradle.replace(/dependencies\s*\{/, (m) => `${m}\n    ${depLine1}\n    ${depLine2}`);
    }
    return config;
  });

  return config;
};