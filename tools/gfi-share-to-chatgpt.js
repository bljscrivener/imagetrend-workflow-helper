// GFI Share-to-ChatGPT bridge
// Intended to be called from the GFI export UI in direct response to a user tap.
// Keeps the capture as a real .txt File. On iPadOS/Safari, Web Share opens the
// native share sheet when file sharing is supported; otherwise it downloads.

export async function shareCaptureToChatGPT({ text, filename, title = 'GFI Capture' }) {
  const safeName = filename || `GFI_CAPTURE_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  const file = new File([text], safeName, { type: 'text/plain' });

  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        files: [file],
        title,
        text: `GFI capture: ${safeName}\nAnalyze the attached capture and use its AI INDEX first, then inspect RAW CAPTURE only where needed.`
      });
      return { mode: 'share', filename: safeName };
    }
  } catch (error) {
    // AbortError means the user dismissed the sheet; do not force a download.
    if (error?.name === 'AbortError') return { mode: 'cancelled', filename: safeName };
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  // Best-effort filename bridge for manual ChatGPT attachment search.
  try { await navigator.clipboard?.writeText(safeName); } catch (_) {}
  return { mode: 'download', filename: safeName };
}

// Example integration:
// shareButton.addEventListener('click', () => shareCaptureToChatGPT({
//   text: buildNormalizedCapture(),
//   filename: suggestedFilename,
//   title: `GFI ${captureType}: ${pageTitle}`
// }));
