# CLAUDE.md - EchoLens Project Guide

This document defines build commands, development guidelines, and coding standards for the EchoLens application.

## Build and Run Commands
- **Install dependencies**: `npm install`
- **Start development server**: `npm run dev`
- **Build production assets**: `npm run build`
- **Preview production build**: `npm run preview`

## Project Structure
- `index.html` - Application entrypoint & markup (includes CDN links for TF.js).
- `style.css` - Custom styles (vanilla CSS, glassmorphism, responsive, accessible).
- `app.js` - Main client JavaScript file (Web Audio context, TF.js runner, Web Speech loop, Canvas rendering).
- `package.json` - Node dependencies (Vite developer tools).
- `vite.config.js` - Dev server configurations.

## Development Guidelines & Rules
- **No Frameworks**: Keep the app framework-free (Vanilla HTML, CSS, JS).
- **Offline / Local first**: Object detection must run in-browser using TF.js. Do not stream video frames to any remote API.
- **Web Audio API**:
  - Always require a user interaction (like clicking a button) before starting or resuming the `AudioContext` to satisfy browser security policies.
  - Keep audio level controls (volume gain nodes) capped to prevent hearing damage.
  - Ensure oscillators are properly cleaned up (`disconnect()` and `stop()`) when beeps complete to avoid audio leaks.
- **Accessibility (a11y)**:
  - Ensure elements have descriptive labels (`aria-label`).
  - High-contrast colors by default.
  - Sighted visualizer for testing (drawn canvas showing bounding boxes, panning vectors, and audio feedback levels).
- **Git Hygiene**:
  - Never commit local environmental files (though this project uses client-only CDN APIs, keep it clean).
  - Keep commits clean and focused.
