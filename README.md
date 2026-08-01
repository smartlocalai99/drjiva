# DrJiva patient app

One Expo React Native codebase for Android and iOS. This first part contains
the branded splash, mobile-number login, OTP verification, and a placeholder
home screen.

## Run

```bash
npm install
npx expo start
```

Open the QR code in the installed development client, enter a valid Indian
mobile number, and use `1234` as the temporary mock OTP.

## COD medicine orders

Checkout calls the linked Supabase `place_cod_order` RPC. The database validates
the Asian Hospitals catalogue, derives canonical prices (using the shop's ₹49
fallback only where a catalogue price is missing), snapshots the delivery and
medicine details, and inserts the order atomically. No online payment provider
is used.

Order backend changes live in:

- `supabase/migrations/20260801090000_add_cod_orders_and_hospital_console.sql`
- `supabase/migrations/20260801100000_configure_order_web_push.sql`
- `supabase/functions/notify-new-order/`

Apply/deploy them with the linked Supabase CLI before releasing the mobile app.
The matching hospital PWA is maintained in
`/Users/vardhanreddy/Desktop/medislash/medisin_app`.

## Add medicine images later

Place square images in `assets/carousel/`, then add their static `require()`
entries to `CAROUSEL_IMAGES` in `src/components/PillMarquee.tsx`. Until then,
the app uses the built-in medicine placeholder tiles.
