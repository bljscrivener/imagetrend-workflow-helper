// GFI Share-to-ChatGPT bridge
// Intended to be called from the GFI export UI in direct response to a user tap.
// The bridge binds the handoff to an immutable capture object, derives a unique
// filename from captureId + capturedAt, and never reuses a prior File/Blob.

let lastExportedCaptureId = null;

function safePart(value, fallback = 'capture') {
  const out = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return out || fallback;
}

function captureFilename(capture, requestedFilename) {
  const header = capture?.header || {};
  const captureId = safePart(header.captureId || 'no-id');
  const capturedAt = String(header.capturedAt || new Date().toISOString()).replace(/[:.]/g, '-');
  const stem = safePart(
    header.friendlyName ||
    header.captureType ||
    requestedFilename?.replace(/\.[^.]+$/, '') ||
    'gfi-capture'
  );
  return `${stem}-${capturedAt}-${captureId}.txt`;
}

function captureText(capture, text) {
  if (capture?.header?.captureId) {
    return `GFI NORMALIZED CAPTURE\nCapture-ID: ${capture.header.captureId}\nCaptured: ${capture.header.capturedAt || ''}\n\n--- JSON ---\n${JSON.stringify(capture, null, 2)}`;
  }
  return String(text || '');
}

export async function shareCaptureToChatGPT({
  capture,
  text,
  filename,
  title = 'GFI Capture',
  allowRepeat = false
} = {}) {
  const captureId = capture?.header?.captureId || null;
  if (!captureId && !text) throw new Error('GFI share requires a capture object or text.');

  if (captureId && captureId === lastExportedCaptureId && !allowRepeat) {
    return { mode: 'duplicate-blocked', captureId, filename: null };
  }

  // Rebuild both payload and filename at tap time. Do not retain/reuse a File,
  // Blob, object URL, filename, or text from any prior export.
  const payload = captureText(capture, text);
  const safeName = captureFilename(capture, filename);
  const file = new File([payload], safeName, {
    type: 'text/plain',
    lastModified: Date.now()
  });

  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        files: [file],
        title,
        text: `GFI capture ${captureId || ''}: ${safeName}`
      });
      if (captureId) lastExportedCaptureId = captureId;
      return { mode: 'share', filename: safeName, captureId };
    }
  } catch (error) {
    // AbortError means the user dismissed the sheet; do not mark the capture as
    // exported and do not force a download.
    if (error?.name === 'AbortError') return { mode: 'cancelled', filename: safeName, captureId };
    console.warn('[GFI] Web Share failed; falling back to download.', error);
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);

  // Clipboard is only a locator bridge. It is generated from the same capture
  // object as the file, so it cannot point at an older capture accidentally.
  try { await navigator.clipboard?.writeText(`${safeName}\n${captureId || ''}`); } catch (_) {}
  if (captureId) lastExportedCaptureId = captureId;
  return { mode: 'download', filename: safeName, captureId };
}

export function resetGfiShareState() {
  lastExportedCaptureId = null;
}

// Correct integration pattern:
// shareButton.addEventListener('click', async () => {
//   const capture = getCurrentlySelectedCapture(); // resolve NOW, on tap
//   const result = await shareCaptureToChatGPT({ capture, title: `GFI ${capture.header.captureType}` });
//   showStatus(result.mode === 'duplicate-blocked'
//     ? 'This exact capture was already exported. Select a newer capture or explicitly export again.'
//     : `Exported ${result.captureId}: ${result.filename}`);
// });
