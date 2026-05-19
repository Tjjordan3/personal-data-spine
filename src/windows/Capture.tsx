import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  CaptureForm,
  type CaptureFormHandle,
} from "../components/CaptureForm";
import { loadSettings } from "../lib/settings";
import { applyTheme } from "../lib/theme";

export function Capture() {
  const [focusToken, setFocusToken] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);
  const formRef = useRef<CaptureFormHandle>(null);
  const tauriWindow = getCurrentWindow();

  const hide = useCallback(async () => {
    formRef.current?.reset();
    await tauriWindow.hide();
  }, [tauriWindow]);

  useEffect(() => {
    applyTheme(loadSettings().theme);
  }, []);

  useEffect(() => {
    const unlistenShow = listen("capture:focus", () => {
      applyTheme(loadSettings().theme);
      setFocusToken((t) => t + 1);
    });
    return () => {
      void unlistenShow.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    void tauriWindow.isVisible().then((visible) => {
      if (visible) formRef.current?.focusInput();
    });
    const unlisten = tauriWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) formRef.current?.focusInput();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [tauriWindow]);

  return (
    <div className="flex h-screen w-screen flex-col bg-transparent p-2">
      <div
        className={`flex min-h-0 flex-1 flex-col rounded-sm border bg-pds-panel/95 p-2 shadow-2xl backdrop-blur-sm transition ${
          savedFlash ? "border-emerald-600" : "border-pds-border/80"
        }`}
      >
        <CaptureForm
          ref={formRef}
          variant="floating"
          focusToken={focusToken}
          onClose={() => void hide()}
          onSaved={() => {
            setSavedFlash(true);
            globalThis.setTimeout(() => setSavedFlash(false), 800);
          }}
        />
      </div>
    </div>
  );
}
