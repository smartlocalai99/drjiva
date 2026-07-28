# Secure Document Scanning Design

## Goal

Replace the Documents screen placeholder with a native multi-page scanner that
creates one PDF, attempts on-device classification, asks for missing metadata,
uploads privately, and attaches the report to the current patient.

## Capture and PDF

- Rename the floating action from **Add Document** to **Scan Document** and use
  a scanner icon.
- Use `react-native-document-scanner-plugin@2.0.4` for native edge detection,
  cropping, retakes, and multi-page capture.
- Allow one to ten pages per scan.
- Return cropped pages as base64 JPEGs and create a single A4 PDF with
  `expo-print`.
- Keep capture, OCR, and PDF generation on-device.
- Cancellation returns to Documents without an error. Permission, scanner,
  conversion, upload, and metadata failures display specific retry guidance.

## Classification

- Run on-device OCR using
  `@react-native-ml-kit/text-recognition@2.0.0`.
- Match normalized OCR text against hospital names fetched from
  `public.hospitals`.
- Classify into Prescription, OP Consultation, Lab Report, Imaging,
  Discharge Summary, or Other using explicit keyword scores.
- Accept an automatic value only when it has a unique positive score.
- Always show a review sheet. Missing or low-confidence hospital and report
  type values must be selected manually before upload.
- No report image or OCR text is sent to an external AI provider.

## Authentication and Storage

- Keep the temporary `1234` app verification behavior unchanged.
- After successful app verification, ensure the app has a persistent Supabase
  anonymous Auth session. Anonymous Auth must be enabled for the Medico
  project.
- Keep `patient-reports` private and limit it to PDF files up to 20 MB.
- Store files at
  `<auth.uid()>/<patient-id>/<document-id>.pdf`.
- Add `owner_user_id`, `report_type`, `page_count`, and `storage_path` to
  `public.patient_reports`.
- Patient report rows and files are readable and writable only when
  `owner_user_id = auth.uid()` and the Storage path begins with `auth.uid()`.
- Remove the current broad anonymous/public report policies. Existing report
  rows remain intact.
- Generate short-lived signed URLs when a patient opens a report.

## Documents Screen

- Load reports for the current patient and group them by hospital.
- Show a clean empty state when none exist.
- Show upload progress while scanning is saved.
- A folder opens a compact list containing type, date, and page count.
- Opening a report uses a signed URL; failed or expired URLs are regenerated.

## Native Delivery

The scanner, OCR, Print, and FileSystem packages require a new Android preview
binary. EAS Update alone cannot add these native modules. After that binary is
installed, JavaScript-only fixes can continue through the `preview` channel.

## Security Limitation

The universal `1234` code is explicitly temporary and does not prove phone
ownership. Anonymous Auth prevents public cross-user document reads, but the
temporary phone-verification flow must be replaced with real OTP before a
production release containing real medical reports.

## Testing

- Unit-test classifier scoring, hospital matching, report mapping, storage
  paths, validation, and cancellation behavior.
- Verify RLS with two separate anonymous users: each user can access only its
  own report row and object.
- Run the complete Vitest suite, TypeScript check, Expo Doctor, Android export,
  and an EAS Android preview build.

