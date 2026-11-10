import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProvider } from "./ctx";
import App from "./App";
import "./styles.css";
import { SpeedInsights } from "@vercel/speed-insights/react";
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AppProvider>
      <App />
      <SpeedInsights />
    </AppProvider>
  </BrowserRouter>,
);
