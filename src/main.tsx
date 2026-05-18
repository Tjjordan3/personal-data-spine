import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { Capture } from "./windows/Capture";
import "./index.css";

async function bootstrap() {
  const label = getCurrentWindow().label;
  const root = document.getElementById("root")!;

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
}

void bootstrap();
