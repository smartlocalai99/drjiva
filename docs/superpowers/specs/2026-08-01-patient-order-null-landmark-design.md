# Patient Order Null Landmark Repair

## Problem

The production order `ORD-1001` is stored successfully and returned by the
patient-order RPC. Its optional delivery landmark is `null`. The mobile
normalizer currently requires `address.landmark` to be a string, throws while
mapping the response, and causes the Orders screen to show “Orders unavailable.”

## Design

Keep the database schema and RPC unchanged. Update the mobile response
normalizer so the optional landmark accepts `null` or a string and exposes a
missing landmark to the UI as an empty string. Continue strictly validating all
required address fields and existing order identifiers, status, totals, and
items.

This keeps the repair at the boundary where the nullable database contract is
converted into the app's non-null display model. It also matches the existing
handling for nullable hospital address and phone values.

## Error Handling

Malformed non-null landmark values still reject the response. Other malformed
required data continues to produce the existing safe patient-facing loading
error.

## Verification

Add a regression test whose RPC response contains `address.landmark: null` and
assert that the order remains visible with `landmark: ''`. Run the focused test,
the full test suite, TypeScript checking, and Expo Doctor. Query production to
confirm `ORD-1001` still has a null landmark and otherwise valid order data.

Because this is JavaScript-only, distribute it with compatible EAS Updates if
the installed build/channel setup is verified. Otherwise rebuild the Android
APK and reinstall the iOS Release app.
