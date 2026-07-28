# Profile Photo and Calendar Today Marker Design

**Date:** 2026-07-28

## Scope

This change updates the existing Manage Profile and dashboard calendar experiences:

- Remove only the Address field from the Manage Profile form.
- Keep the separate Saved Addresses feature on the More screen unchanged.
- Let a patient choose a profile photo from either the camera or photo gallery.
- Store profile photos in Supabase Storage and persist the active public URL on the patient record.
- Replace the dashboard calendar's orange marker for today with the existing streak icon, with today's date centered over the icon.
- Preserve the existing orange selected-date treatment for dates other than today.

## Profile Photo Experience

The profile avatar remains in its current location. When tapped, it presents Camera and Gallery actions. Either source uses a square crop before returning the image.

The selected image is shown immediately as a local preview. Pressing Save uploads it and saves the returned public URL along with the other profile changes. While saving, the existing saving state prevents duplicate submissions. If the upload or database update fails, the screen keeps the preview and displays an error so the patient can retry.

If no photo is stored, the current initials avatar remains the fallback. Camera and gallery permission denial will show a clear alert without changing the saved photo.

Accepted images are JPEG or PNG and limited to 5 MB. The app will use unique object names rather than overwriting an existing object.

## Data and Storage

Create a public Supabase Storage bucket named `profile-pictures`, with a 5 MB file-size limit and JPEG/PNG MIME restrictions.

Objects use this layout:

`<patient-id>/<timestamp>-<random-suffix>.<extension>`

Create a nullable `avatar_url` text column on `public.patients`. After a successful upload, the app obtains the object's public URL and saves it to `patients.avatar_url`. Patient queries and profile updates include this field.

The application currently uses a temporary fixed OTP and does not establish a trustworthy Supabase Auth identity. Therefore, direct client uploads cannot provide production-grade per-user authorization. The storage policy will permit the current client role to create profile-picture objects while restricting uploads to the named bucket and accepted folder/file rules. This is an explicitly temporary security tradeoff; authenticated ownership policies should replace it when real OTP authentication is restored.

Versioned filenames avoid overwrite and CDN-staleness problems. Old objects are not deleted by the mobile client because granting anonymous delete access would increase risk. Cleanup can be added server-side after authenticated ownership is available.

## Manage Profile Changes

Remove the Address input and its local form state from the Manage Profile screen. Existing address data and the Saved Addresses screen are left untouched.

The avatar displays the saved remote image when available, otherwise initials. An edit affordance communicates that it is tappable. Camera and Gallery are both offered. Photo changes are included in the same Save action as name, age, and gender.

## Dashboard Calendar Changes

For today's date, use the existing streak asset as the full date marker and center the numeric day over it. The date text must remain legible and accessible.

For a selected date that is not today, retain the current orange gradient marker. Unselected dates retain their current appearance. Today remains visually recognizable even when another date is selected.

## Verification

- Unit/component coverage for patient mapping and profile update behavior with `avatar_url`.
- Profile screen tests for initials fallback, saved photo rendering, source actions, and removed Address field.
- Date timeline tests for today's streak marker and non-today selected styling.
- Type checking, linting, and the existing automated test suite.
- Supabase migration verification for the column, bucket configuration, and storage policies.
- Manual mobile checks for camera permission, gallery permission, crop/preview, upload persistence, app reload, and the calendar marker.

## Delivery Constraint

Adding `expo-image-picker` introduces a native module. Existing installed binaries that do not contain this module cannot receive the complete feature through an over-the-air update alone. A new mobile build is required before this change can be tested on or delivered to those devices.
