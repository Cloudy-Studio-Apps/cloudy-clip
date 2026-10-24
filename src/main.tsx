import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import { bootstrap } from "@/app/bootstrap";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

bootstrap()
  .then((kernel) =>
    root.render(
      <React.StrictMode>
        <App kernel={kernel} />
      </React.StrictMode>,
    ),
  )
  .catch((error: unknown) => {
    console.error(error);
    root.render(
      <div
        style={{
          padding: 24,
          fontFamily: "sans-serif",
          color: "#eee",
          background: "#111",
          height: "100vh",
        }}
      >
        Cloudy Clip could not start: {String(error)}
      </div>,
    );
  });
