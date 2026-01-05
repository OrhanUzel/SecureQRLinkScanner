# Secure QR Link Scanner

Secure QR/Barcode scanning, link validation, and sharing-focused mobile app. Live on Google Play: [Secure QR Link Scanner](https://play.google.com/store/apps/details?id=com.orhanuzel.secureqrlinkscanner).

## Features
- 🔒 **Secure link analysis:** Inspect URLs from QR codes before opening; block unsafe links.
- 📸 **Live camera & full-screen preview:** Quickly capture codes; footer ad space stays visible when available.
- 🖼️ **Gallery / share intent support:** Scan from a single shared image or text; pick from gallery to decode.
- 🧠 **Local blacklist & classifier:** Modular checks to flag risky domains (uses ML Kit barcode scanning).
- 🧾 **History log:** Save scanned codes/links; reopen, copy, or share later.
- ✏️ **QR creation:** Generate QR codes from your text/URL and share.
- 🎨 **Light/Dark theme:** Auto or user-preferred themes.
- 💎 **Premium mode:** Ad-free experience with extra perks.
- 🌐 **Multilingual:** i18n powered by expo-localization and i18next.

## Tech Stack
- **React Native / Expo (SDK 54)**
- **React Navigation** (native-stack)
- **Google ML Kit** barcode/QR scanning (`@react-native-ml-kit/barcode-scanning`)
- **AdMob** integration (`react-native-google-mobile-ads`, `react-native-admob-native-ads`)
- **In-app purchases** (`react-native-iap`)
- **Theming & i18n:** `react-native-safe-area-context`, `react-i18next`

## Getting Started (Development)
> Prerequisites: Node 18+, npm, Android Studio/SDK (for Android), Xcode (for iOS), Expo CLI.

1) Install dependencies:
```bash
npm install
```

2) Start the dev server:
```bash
npm run start
```

3) Run per platform:
```bash
# Android
npm run android

# iOS (on macOS with Xcode)
npm run ios

# Web (for quick checks)
npm run web
```

## Environment Variables
Copy `.env.example` to `.env` and fill required keys (e.g., AdMob units, backend URLs).

## Test
```bash
npm test
```

## Production Build
- **Android AAB:** After `npm run android`, build a signed bundle via EAS or Android Studio. An example output lives at `release/app-release.aab`.
- **App config:** Package name, icons, and build settings live in `app.config.js`.

## Store Link
Google Play: https://play.google.com/store/apps/details?id=com.orhanuzel.secureqrlinkscanner

## License
This project is closed source; all rights reserved.
