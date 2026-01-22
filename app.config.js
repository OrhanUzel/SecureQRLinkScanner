// Load locale files for dynamic iOS permission texts
const tr = require('./src/i18n/locales/tr.json');
const en = require('./src/i18n/locales/en.json');
const es = require('./src/i18n/locales/es.json');
const ar = require('./src/i18n/locales/ar.json');

module.exports = {
  expo: {
    name: "Secure QR & Link Scanner",
    slug: "secure-qr-link-scanner",
    owner: "orhanuzell",
    version: "1.7.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    extra: {
      apiBaseUrl: "https://riskapi.orhanuzel.com.tr",
      adsFallbackToTestIds: process.env.EXPO_PUBLIC_ENABLE_AD_TEST_FALLBACK === 'true',
      eas: {
        projectId: "33ff4554-c1e4-4082-bba2-5a6914037696"
      },
      adUnits: {
        androidBanner: process.env.ANDROID_BANNER_ID,
        iosBanner: process.env.IOS_BANNER_ID,
        androidInterstitial: process.env.ANDROID_INTERSTITIAL_ID,
        iosInterstitial: process.env.IOS_INTERSTITIAL_ID,
        androidRewarded: process.env.ANDROID_REWARDED_ID,
        iosRewarded: process.env.IOS_REWARDED_ID,
        androidRewardedInterstitial: process.env.ANDROID_REWARDED_INTERSTITIAL_ID,
        iosRewardedInterstitial: process.env.IOS_REWARDED_INTERSTITIAL_ID,
        androidNative: process.env.ANDROID_NATIVE_ID,
        iosNative: process.env.IOS_NATIVE_ID
      }
    },
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    // Dynamic iOS permission strings per locale
    locales: {
      tr: {
        NSCameraUsageDescription: tr.permissions?.camera,
        NSUserTrackingUsageDescription: tr.permissions?.tracking,
        NSPhotoLibraryUsageDescription: tr.permissions?.photoLibrary,
        NSPhotoLibraryAddUsageDescription: tr.permissions?.photoLibraryAdd
      },
      en: {
        NSCameraUsageDescription: en.permissions?.camera,
        NSUserTrackingUsageDescription: en.permissions?.tracking,
        NSPhotoLibraryUsageDescription: en.permissions?.photoLibrary,
        NSPhotoLibraryAddUsageDescription: en.permissions?.photoLibraryAdd
      },
      es: {
        NSCameraUsageDescription: es.permissions?.camera,
        NSUserTrackingUsageDescription: es.permissions?.tracking,
        NSPhotoLibraryUsageDescription: es.permissions?.photoLibrary,
        NSPhotoLibraryAddUsageDescription: es.permissions?.photoLibraryAdd
      },
      ar: {
        NSCameraUsageDescription: ar.permissions?.camera,
        NSUserTrackingUsageDescription: ar.permissions?.tracking,
        NSPhotoLibraryUsageDescription: ar.permissions?.photoLibrary,
        NSPhotoLibraryAddUsageDescription: ar.permissions?.photoLibraryAdd
      }
    },
    ios: {
      buildNumber: "6",
      supportsTablet: true,
      bundleIdentifier: "com.orhanuzel.secureqrlinkscanner",
      "appleTeamId": process.env.APPLE_TEAM_ID,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
        // Fallback to English if locale-specific strings fail
        NSCameraUsageDescription: en.permissions?.camera,
        NSUserTrackingUsageDescription: en.permissions?.tracking,
        NSPhotoLibraryUsageDescription: en.permissions?.photoLibrary,
        NSPhotoLibraryAddUsageDescription: en.permissions?.photoLibraryAdd
      }
    },
    android: {
      versionCode: 20,
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      package: "com.orhanuzel.secureqrlinkscanner",
      intentFilters: [
        {
          action: "VIEW",
          data: [
            { scheme: "http" },
            { scheme: "https" }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        },
        {
          action: "SEND",
          category: ["DEFAULT"],
          data: [{ mimeType: "text/plain" }]
        },
        {
          action: "SEND",
          category: ["DEFAULT"],
          data: [{ mimeType: "image/*" }]
        }
      ]
    },
    scheme: "secureqrlinkscanner",
    web: {
      favicon: "./assets/icon.png"
    },
    plugins: [
      "expo-mail-composer",
      "./plugins/withShareIntent/app.plugin.js",

      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: true,
          },
          ios: {
            useFrameworks: "static",
            deploymentTarget: "16.0",
            
          }
        }
      ],
      "expo-font",
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-2533405439201612~1382783323",
          "iosAppId": "ca-app-pub-2533405439201612~4853548374",
          "skAdNetworkItems": [
            "cstr6suwn9.skadnetwork",
            "4fzdc2evr5.skadnetwork",
            "4pfyvq9l8r.skadnetwork",
            "2fnua5tdw4.skadnetwork",
            "ydx93a7ass.skadnetwork",
            "5a6flpkh64.skadnetwork",
            "p78axxw29g.skadnetwork",
            "v72qych5uu.skadnetwork",
            "ludvb6z3bs.skadnetwork",
            "cp8zw746q7.skadnetwork",
            "c6k4g5qg8m.skadnetwork",
            "s39g8kddbm.skadnetwork",
            "3qy4746246.skadnetwork",
            "3sh42y64q3.skadnetwork",
            "f38h382jlk.skadnetwork",
            "hs6bdukanm.skadnetwork",
            "prcb7njmu6.skadnetwork",
            "v4nxqhlyqp.skadnetwork",
            "wzmmz9fp6w.skadnetwork",
            "yclnxrl5pm.skadnetwork",
            "t38b2kh725.skadnetwork",
            "7ug5zh24hu.skadnetwork",
            "9rd848q2bz.skadnetwork",
            "y5ghdn5j9k.skadnetwork",
            "n6fk4nfna4.skadnetwork",
            "v9wttpbfk9.skadnetwork",
            "n38lu8286q.skadnetwork",
            "47vhws6wlr.skadnetwork",
            "kbd757ywx3.skadnetwork",
            "9t245vhmpl.skadnetwork",
            "a2p9lx4jpn.skadnetwork",
            "22mmun2rn5.skadnetwork",
            "4468km3ulz.skadnetwork",
            "2u9pt9hc89.skadnetwork",
            "8s468mfl3y.skadnetwork",
            "av6w8kgt66.skadnetwork",
            "klf5c3l5u5.skadnetwork",
            "ppxm28t8ap.skadnetwork",
            "424m5254lk.skadnetwork",
            "ecpz2srf59.skadnetwork",
            "uw77j35x4d.skadnetwork",
            "mlmmfzh3r3.skadnetwork",
            "578prtvx9j.skadnetwork",
            "4dzt52r2t5.skadnetwork",
            "gta9lk7p23.skadnetwork",
            "e5fvkxwrpn.skadnetwork",
            "8c4e2ghe7u.skadnetwork",
            "zq492l623r.skadnetwork",
            "3rd42ekr43.skadnetwork",
            "3q84641662.skadnetwork"
          ]
        }
      ],
      "expo-secure-store",
      "expo-tracking-transparency",
      "expo-quick-actions",
      "@bacons/apple-targets"
    ]
  }
};
