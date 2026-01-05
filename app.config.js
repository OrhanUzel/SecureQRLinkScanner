import 'dotenv/config';

export default{
  "expo": {
    "name": "Secure QR & Link Scanner",
    "slug": "secure-qr-link-scanner",
    "version": "1.2.1",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "extra": {
      "apiBaseUrl": "https://riskapi.orhanuzel.com.tr",
      "eas": {
        "projectId": "9a2c9943-2d49-4c92-8d4b-4584e0d66b56"
      },
      "adUnits": {
        "androidBanner": process.env.ANDROID_BANNER_ID,
        "iosBanner": process.env.IOS_BANNER_ID,
        "androidInterstitial": process.env.ANDROID_INTERSTITIAL_ID,
        "iosInterstitial": process.env.IOS_INTERSTITIAL_ID,
        "androidRewarded": process.env.ANDROID_REWARDED_ID,
        "iosRewarded": process.env.IOS_REWARDED_ID,
        "androidRewardedInterstitial": process.env.ANDROID_REWARDED_INTERSTITIAL_ID,
        "iosRewardedInterstitial": process.env.IOS_REWARDED_INTERSTITIAL_ID,
        "androidNative": process.env.ANDROID_NATIVE_ID,
        "iosNative": process.env.IOS_NATIVE_ID
      }
    },
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.orhanuzel.secureqrlinkscanner",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "versionCode": 10,

      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "package": "com.orhanuzel.secureqrlinkscanner",
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "http"
            },
            {
              "scheme": "https"
            }
          ],
          "category": [
            "BROWSABLE",
            "DEFAULT"
          ]
        },
        {
          "action": "SEND",
          "category": [
            "DEFAULT"
          ],
          "data": [
            {
              "mimeType": "text/plain"
            }
          ]
        },
        {
          "action": "SEND",
          "category": [
            "DEFAULT"
          ],
          "data": [
            {
              "mimeType": "image/*"
            }
          ]
        }
      ]
    },
    "scheme": "secureqrlinkscanner",
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "./plugins/withUnityAds/app.plugin.js",
      "./plugins/withShareIntent/app.plugin.js",
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static",
            "deploymentTarget": "16.0"
          }
        }
      ],
      "expo-font",
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": process.env.ADMOB_ANDROID_APP_ID,
          "iosAppId": process.env.ADMOB_IOS_APP_ID,
          "skAdNetworkItems": [
            "cstr6suwn9.skadnetwork",
            "4fzdc2evr5.skadnetwork",
            "xga6mpmplv.skadnetwork",
            "9rd848q2bz.skadnetwork"
          ]
        }
      ],
      "expo-secure-store"
    ]
  }
}
