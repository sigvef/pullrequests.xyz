import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import { createTheme, ThemeProvider } from "@mui/material";

const multiplier = 0.25;

const theme = createTheme({
  transitions: {
    duration: {
      shortest: 150 * multiplier,
      shorter: 200 * multiplier,
      short: 250 * multiplier,
      standard: 300 * multiplier,
      complex: 375 * multiplier,
      enteringScreen: 225 * multiplier,
      leavingScreen: 195 * multiplier,
    },
  },
});

ReactDOM.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
