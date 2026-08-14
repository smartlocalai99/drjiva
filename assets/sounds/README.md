The bundled custom medicine reminder files are:

`reminder.caf` (iOS) and `rec.wav` (Android)

Medicine reminders play the aggressively mastered ringtone from
`finalstartingtone.mp3`, immediately followed by the complete original
3.318-second Telugu medicine message twice. The Telugu source comes from commit
`c463cd8`, before the later starter-tone and play-twice processing. No silence
is inserted between segments. The Android WAV and iOS CAF contain the same
sequence.

`success.wav` contains only the short mastered ringtone. It is used for
reminder-created and checkout success feedback, as well as the
order-confirmation notification.

Keep each sound under 30 seconds. `app.config.js` detects these exact
filenames at build time and bundles them automatically — iOS plays
`reminder.caf` by filename, while Android plays `rec.wav` by its `res/raw`
resource name (`rec`). Rebuild and reinstall the native app after replacing
either file.
