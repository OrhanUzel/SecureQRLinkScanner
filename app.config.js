module.exports = ({ config }) => {
  return {
    ...config,
    expo: {
      ...(config.expo || {}),
      name: config?.expo?.name || 'Secure QR & Link Scanner',
      slug: config?.expo?.slug || 'secure-qr-link-scanner',
      plugins: [
        './plugins/withUnityAds/app.plugin.js',
        ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
        [
          'react-native-google-mobile-ads',
          {
            androidAppId: process.env.ADMOB_ANDROID_APP_ID,
            iosAppId: process.env.ADMOB_IOS_APP_ID,
            skAdNetworkItems: [
              'cstr6suwn9.skadnetwork',
              '4fzdc2evr5.skadnetwork'
            ]
          }
        ]
      ],
      extra: {
        ...(config.expo?.extra || {}),
        admob: {
          rewardedInterstitial: process.env.ADMOB_REWARDED_INTERSTITIAL || null,
          rewarded: process.env.ADMOB_REWARDED || null,
          interstitial: process.env.ADMOB_INTERSTITIAL || null,
          native: process.env.ADMOB_NATIVE || null,
          banner: process.env.ADMOB_BANNER || null,
        }
      }
    }
  };
};