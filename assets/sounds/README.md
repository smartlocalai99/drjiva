The bundled custom medicine reminder recordings are:

`reminder.caf` (iOS) and `rec.wav` (Android)

Keep each under 30 seconds. `app.config.js` detects these exact
filenames at build time and bundles them automatically — iOS plays
`reminder.caf` by filename, Android plays `rec.wav` by its res/raw
resource name ("rec"). Both currently play the same clip back-to-back
with a short gap, so the reminder sound is heard twice. A loud alternating
attention tone plays first, and the spoken reminder is boosted with a
look-ahead limiter so it stays clear without digital clipping. Rebuild and
reinstall the native app after replacing either file.
