"use client";

import { useEffect, useState } from "react";

function openDiagnosticsWindow() {
  const width = Math.min(1440, Math.max(320, window.screen.availWidth - 40));
  const height = Math.min(1000, Math.max(640, window.screen.availHeight - 80));
  const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  const popup = window.open("/diagnostics", "racecraft-diagnostics", `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
  popup?.focus();
  return popup !== null;
}

function isEditableTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  return element?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName ?? "");
}

function useDiagnosticsShortcut() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || !(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== "f") return;
      event.preventDefault();
      openDiagnosticsWindow();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export function GlobalDiagnosticsShortcut() {
  useDiagnosticsShortcut();
  return null;
}

export function DiagnosticsShortcut() {
  const [popupBlocked, setPopupBlocked] = useState(false);

  const handleClick = () => setPopupBlocked(!openDiagnosticsWindow());

  return <div className="diagnostics-shortcut">
    <button type="button" className="button-secondary diagnostics-window-button" onClick={handleClick} aria-keyshortcuts="Control+Shift+F">
      Open in new window
      <span className="diagnostics-key-hint" aria-label="Keyboard shortcut Control Shift F"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>F</kbd></span>
    </button>
    {popupBlocked ? <span className="diagnostics-popup-note" role="status">Popup blocked · use JSON endpoint or allow popups</span> : null}
  </div>;
}
