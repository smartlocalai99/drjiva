# DrJiva patient app

One Expo React Native codebase for Android and iOS. This first part contains
the branded splash, mobile-number login, OTP verification, and a placeholder
home screen.

## Run

```bash
npm install
npx expo start
```

Open the QR code in Expo Go, enter a valid Indian mobile number, and use
`1234` as the mock OTP.

## Add medicine images later

Place square images in `assets/carousel/`, then add their static `require()`
entries to `CAROUSEL_IMAGES` in `src/components/PillMarquee.tsx`. Until then,
the app uses the built-in medicine placeholder tiles.
