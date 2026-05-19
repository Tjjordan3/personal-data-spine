import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { Capture } from "./windows/Capture";
import "./index.css";
import { initTheme } from "./lib/theme";

function showBootstrapError(root: HTMLElement, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  root.innerHTML = "";
  const panel = document.createElement("div");
  panel.setAttribute("role", "alert");
  panel.style.cssText =
    "padding:1.5rem;font-family:system-ui,sans-serif;max-width:32rem;line-height:1.5";
  panel.innerHTML = `<p style="font-weight:600;margin:0 0 0.5rem">DonePath failed to start</p>
    <p style="margin:0;font-size:0.875rem;opacity:0.85">${message}</p>
    <p style="margin:0.75rem 0 0;font-size:0.75rem;opacity:0.65">From the project root run: npm run tauri dev</p>`;
  root.append(panel);
}

async function bootstrap() {
  const root = document.getElementById("root");
  if (!root) return;

  try {
    initTheme();
    const label = getCurrentWindow().label;

    if (label === "capture") {
      ReactDOM.createRoot(root).render(
        <React.StrictMode>
          <Capture />
        </React.StrictMode>,
      );
      return;
    }

    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  } catch (err) {
    console.error("bootstrap failed", err);
    showBootstrapError(root, err);
  }
}

void bootstrap();
