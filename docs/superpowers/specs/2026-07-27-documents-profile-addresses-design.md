# Documents, Profile, Addresses, and Cached Name Design

## Goal

Make document creation consistent with medicine creation, expand the profile area with saved delivery addresses and useful support details, show a blue verified badge beside the verified phone number, and remove the delayed name display on Home.

## Scope

### Documents

- Remove the add icon from the Documents header.
- Remove the inline empty-state "Add Document" pill.
- Always display the existing `FloatingAddButton` above the bottom navigation.
- Use the same size, position, gradient, interaction, and safe-area spacing as Home's "Add Medicine" button.
- Label the action "Add Document" and use the upload icon already used by the screen.
- Keep the current placeholder alert until document upload is implemented.

### More/Profile

- Add a "Saved Addresses" row directly below "Manage Profile" in the Account section.
- Replace the current phone checkmark-circle with a filled verified badge in the app's existing primary blue.
- Apply the same verified badge treatment on both the More screen and the Manage Profile screen.
- Replace "Help Center" with "Support".
- Open a dedicated Support screen instead of a coming-soon alert.

### Saved Addresses

- Open a dedicated Saved Addresses screen from the More screen.
- Support multiple addresses.
- Support Home, Work, and Other labels.
- Allow the user to add, edit, delete, and choose a default address.
- Display the default address first and mark it clearly.
- Address cards show the label, recipient, formatted address, phone number, default state, and edit/delete actions.
- The empty state explains that saved addresses make medicine delivery faster and includes an "Add Address" action.
- The address form captures:
  - label type and optional custom label for Other;
  - recipient name;
  - phone number;
  - house, flat, or building;
  - street or area;
  - landmark (optional);
  - city;
  - state;
  - six-digit PIN code.
- Required fields are validated before save.
- The first saved address becomes the default automatically.
- Deleting the default address promotes the next remaining address to default.
- Deletion requires confirmation.

### Address Persistence

- Persist addresses locally in AsyncStorage under a versioned, phone-scoped key.
- Keep address serialization, parsing, validation, default-selection rules, and storage access in a focused library module.
- Treat malformed stored data as an empty address list rather than crashing the screen.
- This release does not add a Supabase migration or cross-device address synchronization.
- The storage boundary must allow a future synced implementation without changing the screens' address model.

### Support

- Add a dedicated Support screen with:
  - DrJiva branding and a short patient-support description;
  - `support@smartlocalai.in`;
  - a "Email Support" action that opens the device mail composer through a `mailto:` link;
  - application version from Expo configuration;
  - an About DrJiva section.
- If the mail app cannot be opened, show a clear alert containing the support email so the user can copy it manually.

### Cached Patient Name

- Extend session storage with a phone-scoped cached patient name.
- Save the name after:
  - successful onboarding patient creation;
  - successful patient fetches;
  - successful profile updates.
- Home initializes from the cached name and renders it as soon as local storage returns.
- Home then refreshes the patient in the background and updates the cache if the server value changed.
- A failed background fetch must not remove a valid cached name.
- More and Manage Profile may also use the cached name as their initial display while their full profile data loads.
- Logout clears the session phone and its cached profile data. Saved addresses are phone-scoped and remain available when the same verified account signs in again.

## Navigation

Expo Router file routes will be added for Saved Addresses, the address editor, and Support. Navigation will use `expo-router` imports, consistent with Expo SDK 57 guidance.

Suggested routes:

- `/saved-addresses?phone=...`
- `/address-editor?phone=...&addressId=...` for edit, with no `addressId` for add
- `/support?phone=...`

All new routes use the existing header, safe-area, colors, typography, cards, and press feedback patterns.

## Error Handling

- Storage read failures show an empty or last-known in-memory state without crashing.
- Storage write failures keep the form open and show a retryable error.
- Invalid form fields show concise inline errors.
- Server refresh failures on Home remain silent when a cached name exists.
- Support email launch failure shows the email in an alert.

## Testing and Verification

- Add focused tests for address validation, normalization, default selection, update, and delete rules.
- Add focused tests for session cache keying and cached-name behavior where the existing test setup permits.
- Follow red-green TDD for new testable behavior.
- Run TypeScript typechecking and Expo dependency validation.
- Start the app and visually inspect Documents, More, Saved Addresses, address add/edit, Support, Profile, and Home in the in-app browser.
- Verify narrow mobile layout, safe areas, keyboard behavior, back navigation, and bottom floating-button placement.

## Release

- Commit only files belonging to this feature, preserving unrelated work already present in the working tree.
- Push to the configured Git remote if one exists and authentication succeeds.
- Publish an EAS Update to the appropriate existing channel when Expo authentication and project configuration allow it.
- If no Git remote or compatible installed mobile build exists, report the exact missing prerequisite instead of claiming the update reached the device.

## Out of Scope

- Real document upload or document backend.
- Supabase address schema and cross-device address sync.
- Live chat, ticketing, or phone support.
- New authentication or account-management flows.
