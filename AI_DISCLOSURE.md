# AI Disclosure

## Tools used while building
- Claude (Sonnet 5.5 / Opus 5.5): code generation, debugging, writing the project plan
- [Any others, e.g. Copilot, ChatGPT]

## AI inside the product (at runtime)
- MediaPipe FaceLandmarker: pretrained ML model for face landmarks. Runs on-device.
- Gemini API: writes the end-of-session summary from aggregate numbers only.
- ElevenLabs API: speaks the break nudges.
- [Presage, if used]
- The belief panel is rule-based TypeScript. No LLM decides what it believes.

## What AI wrote vs what we wrote
| Component | AI generated | Human written or changed |
|---|---|---|
| Vite scaffold | Mostly | Config tweaks |
| Blink detection (EAR) | First draft | Threshold tuning, testing with glasses |
| Belief panel logic | First draft | Rules and behaviours we specified |
| UI styling | First draft | Colours and layout changes |
| Server routes | First draft | API keys, deployment |
| Pitch, name, concept | None | All ours |

## Prompt log
- [time] Prompt: "Build Phase 1..." Result: core loop. What we changed: ...
- [time] Prompt: ...

## Honest notes
- [e.g. "Thresholds were tuned by hand, not clinically validated."]
- [e.g. "Gemini summary falls back to a template if the API fails."]

## Log

### 2026-10-17: Project setup and Phase 1 (core loop)
**Asked:** Scaffold Vite React TypeScript, add Express server, then build Phase 1 only from PROJECT.md (start screen, 10s calibration, complete/incomplete blink detection, rolling blink rate, vignette, break nudge, demo mode, visible error states), self-hosting MediaPipe files and fonts.

**Files created or changed:**
- `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `.oxlintrc.json`, `.gitignore`: from the `create-vite` react-ts template (scaffolded in a temp folder and copied in, so the existing .md files were untouched). Edited by AI: renamed package, added `start` script and dependencies (express, @mediapipe/tasks-vision, @fontsource/anton, @fontsource/inter), added `.env` to `.gitignore`, told oxlint to skip `public/` and `dist/`.
- `index.html`, `public/favicon.svg`: edited from template (title, theme colour, eye favicon).
- `server.js`: Express server serving `dist/` with index.html fallback and `GET /api/health`.
- `public/mediapipe/wasm/*`: copied unmodified from the `@mediapipe/tasks-vision` npm package.
- `public/models/face_landmarker.task`: downloaded unmodified from Google's public MediaPipe model storage.
- `src/blink.ts`: EAR maths, blink state machine (complete vs incomplete), baseline calculation, and all tunable thresholds.
- `src/useEyeTracker.ts`: camera, FaceLandmarker, frame loop, calibration, rolling rate, no-face / low-light / break / nudge logic, error states.
- `src/App.tsx`, `src/main.tsx`, `src/index.css`: UI and styling.
- `AI_DISCLOSURE.md`: this entry.

**AI-generated:** All of the source files listed above (blink.ts, useEyeTracker.ts, App.tsx, index.css, server.js, main.tsx) were written by Claude (Sonnet 5.5) from the PROJECT.md spec. The template files are from create-vite. The MediaPipe WASM and model files are Google's, not AI-generated.

**Not yet verified:** `npm run build` completes and the server answers `/api/health`, the fallback route, the model file and a WASM file when started locally. Nothing has been tested with a real camera. All blink thresholds (60%, 80%, 85% recover, 400ms, 1000ms, blendshape 0.3, low-light brightness 55, break-away times, 20 min nudge) are first guesses, not tuned and not validated.

### 2026-10-17: UI cleanup (removed eyebrow labels and filler captions)
**Asked:** Remove the AI-generated look of the UI: eyebrow labels, unnecessary captions and similar.

**Files changed:** `src/App.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):** removed the small heading labels on the calibration, rate and stat cards; removed the "last 60s" / "since last break" captions, the "Looks fine" and "drying out" status sentences, the demo-mode subtitles, the glasses hint and the stats recital in the nudge; shortened banners and the card copy; removed the "Find out more" expanders from the start-screen cards (headline plus one sentence each); the EAR tuning readout now only shows with `?debug` in the URL. No detection or tracking logic changed.

**Not yet verified:** `npm run build` completes. The new layout has not been viewed in a browser by the AI.

### 2026-10-17: Palette change (cream background, softer green)
**Asked:** Make the page background `#FBF6EA` (the cream from the user's thenodefoundation repo) and make the secondary colour a softer green.

**Files changed:** `src/index.css`, `src/App.tsx` (class rename only), `index.html` (theme-color), `public/favicon.svg`, `PROJECT.md` (Design section updated to match), `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):** body background is now `#FBF6EA`; the bright lime `#A0E870` is replaced everywhere by a softer green `#B6DBA0` (accents, bar, button text on forest) and `#DCEBCF` (secondary button). The soft green values were chosen by the AI, not taken from a brand source. The cream hex was read from the user's `thenodefoundation` repo, which was only read, not modified.

**Not yet verified:** `npm run build` completes. The new colours have not been viewed in a browser, so text contrast on cream and on the aqua/forest cards is unchecked.

### 2026-10-17: Charcoal headlines
**Asked:** Change the bold large text (e.g. "DSE compliance with zero forms.") to the charcoal colour.

**Files changed:** `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** the h1, the wordmark, and the Anton headings and big numbers on aqua cards now use charcoal `#202020` (the existing `--ink`). Headings on forest and near-black cards are unchanged so they stay readable. Charcoal hex was reused from PROJECT.md's dark card colour, not taken from a new source.

**Not yet verified:** `npm run build` completes. Not viewed in a browser.

### 2026-10-17: Rectangular boxes and buttons
**Asked:** Make all boxes and buttons rectangular.

**Files changed:** `src/index.css`, `PROJECT.md` (Design section: buttons and cards now square-cornered), `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** every `border-radius` set to 0 (buttons, cards, banners, notes, progress bar, privacy badge, preview status label). Only the small face-found status dot stays round. Class names such as `.pill` were left as they are.

**Not yet verified:** `npm run build` completes. Not viewed in a browser.

### 2026-10-17: Body font swap (Inter to Hanken Grotesk)
**Asked:** Replace Inter with something straightforward like Aktiv Grotesk.

**Files changed:** `package.json`, `package-lock.json` (removed `@fontsource/inter`, added `@fontsource/hanken-grotesk`), `src/main.tsx`, `src/index.css`, `PROJECT.md` (Body font and stack lines), `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** body font is now Hanken Grotesk (weights 400, 600, 700), self-hosted via fontsource. Aktiv Grotesk is a commercial font and PROJECT.md rules out proprietary fonts, so it was not copied in from the user's thenodefoundation repo (where the TTFs exist); the font choice of Hanken Grotesk as a lookalike was the AI's, not the user's.

**Not yet verified:** `npm run build` completes. Not viewed in a browser.

### 2026-10-17: Tagline on one line
**Asked:** Stop the line break in "A break reminder that watches your eyes instead of a timer."

**Files changed:** `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** removed the `max-width: 28ch` that was forcing the wrap on `.lede`; error-screen body text keeps a 60ch limit. On very narrow screens the sentence will still wrap because it cannot fit.

**Not yet verified:** `npm run build` completes. Not viewed in a browser.

### 2026-10-17: Sage boxes, peach medical card
**Asked:** Replace the other box colours with a softer sage green; make the medical box a different colour so it stands out.

**Files changed:** `src/index.css`, `src/App.tsx`, `PROJECT.md` (Design section), `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):** all boxes (start cards, camera frame, calibration, rate and stat cards, break nudge) are now sage `#C5D5B9` with charcoal headings and dark body text; the "Not a medical device" card is peach `#F4C9A8`. The old forest, near-black and aqua card colours are removed. In the break nudge the buttons are now the standard primary and secondary buttons. Both hex values were picked by the AI, not from a brand source.

**Not yet verified:** `npm run build` completes. Not viewed in a browser, so contrast and how sage looks against the cream background are unchecked.

### 2026-10-17: Medical card to dark red
**Asked:** Replace the peach medical card colour with a darker red.

**Files changed:** `src/index.css`, `src/App.tsx`, `PROJECT.md`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** the "Not a medical device" card is now dark red `#7F1D2A` with cream heading and text. Hex chosen by the AI.

**Not yet verified:** `npm run build` completes. Not viewed in a browser, so text contrast on the red is unchecked.

### 2026-10-17: SVG illustrations (blinking, look away, DSE setup, privacy)
**Asked:** Create SVG animations like the ones in the user's thenodefoundation repo, specific to DSE and blinking, screen distance and other DSE factors.

**Files created or changed:** `src/Illustrations.tsx` (new), `src/App.tsx` (illustrations placed in the start-screen cards and the break nudge), `src/index.css` (illustration styles and keyframes), `AI_DISCLOSURE.md`.

**What was done (AI-generated by Claude):** four inline SVG components in the style of `src/components/Illustrations.tsx` in thenodefoundation (flat, thick round-joined outlines, looping CSS keyframes that are switched off under `prefers-reduced-motion`). That file was read for style only; no artwork or code was copied from it.
- `BlinkIllustration`: an eye that does a full blink, a long stare, then a partial blink (complete vs incomplete). On the "Blinks, not timers" card.
- `LookAwayIllustration`: a person at a desk looking past the monitor at a tree, with a "20 ft" gaze line. In the break nudge.
- `DseSetupIllustration`: arm's length, eye level, elbows at 90 degrees, feet flat. On the "Not a medical device" card, to back up the text that a person still has to assess these.
- `PrivacyIllustration`: laptop with padlock and a blocked route to the cloud. On the "Video stays here" card.

**Honest notes:** the app measures blink rate only. The distance, eye-level, elbow and feet items in `DseSetupIllustration` are guidance shown as a picture, not features; the app does not track posture or screen distance (PROJECT.md rule 6).

**Checked by the AI:** `npm run build` completes. The drawings were rendered in headless Chrome at several animation times (full blink, partial blink, gaze line, ticks) and the start screen was rendered at desktop width and at 390px width. The AI looked at those screenshots itself. The break-nudge placement of the look-away drawing was not rendered in the real app (the nudge needs a live camera session to appear). Nothing was tested with a real camera.

### 2026-10-17: Body font swap (Hanken Grotesk to Oswald)
**Asked:** Replace the body font with one that matches the large bold headline font.

**Files changed:** `package.json`, `package-lock.json` (removed `@fontsource/hanken-grotesk`, added `@fontsource/oswald`), `src/main.tsx`, `src/index.css`, `src/Illustrations.tsx` (text font), `PROJECT.md` (Body font and stack lines), `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):** body, button and illustration text now use Oswald (weights 400, 500, 600), self-hosted via fontsource. Anton stays for headlines. Buttons are now uppercase with slight letter-spacing, the tagline is medium weight at a larger size, and the base body size went up a little because Oswald is narrow. Oswald was the AI's pick as a readable relative of Anton, not a font the user named.

**Checked by the AI:** `npm run build` completes. The start screen was rendered at desktop width in headless Chrome and the AI looked at the screenshot. Mobile width and the dashboard screens were not re-checked with the new font.

### 2026-10-17: Privacy badge moved, top-bar button and footer removed
**Asked:** Replace the bottom bar with a privacy box higher up next to the start button; remove the top-bar Start button; remove the "Not a medical device. It prompts breaks." footer text.

**Files changed:** `src/App.tsx`, `src/index.css`, `PROJECT.md` (rule 2 and top bar line), `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):** new `PrivacyBadge` component (sage box with a padlock and the text "Video stays on this device.") placed next to "Allow camera and start" on the start screen, next to "Try again" on the error screen, and in the controls row at the top of the dashboard. The top bar now holds only the wordmark. The footer is gone. Because the top-bar Stop button was removed with it, Stop moved into the dashboard controls row (the camera still needs an obvious off switch).

**Honest notes:** "Not a medical device" now only appears on the dark red card of the start screen, not on the dashboard (PROJECT.md hard rule 7 asks for that wording to be present; the user explicitly asked for the footer line to go).

**Checked by the AI:** `npm run build` completes. The start screen was rendered in headless Chrome at desktop width and at 390px width and the screenshots were looked at. The dashboard layout with the new controls row was not rendered, because it only appears during a live camera session. Nothing was tested with a real camera.

### 2026-10-17: Animated eye logo
**Asked:** A cool, animated SVG logo with a play on eyes actually having eyes; a real logo, not header text; usable stacked and in other forms.

**Files created or changed:** `public/logo/logo-horizontal.svg`, `public/logo/logo-stacked.svg`, `public/logo/logo-mark.svg` (new), `public/favicon.svg` (replaced), `src/App.tsx` (header shows the logo image instead of text), `src/index.css` (logo sizing, removed the old wordmark rule), `PROJECT.md` (top bar line), `AI_DISCLOSURE.md`.

**What was done (AI-generated by Claude):** the concept (the O of "OPEN" is an eye with a green iris and pupil that glances left and right and blinks, with a lid line when closed) and the eye geometry were designed by Claude. The SVGs were produced by a small Node script that uses the opentype.js library to turn the self-hosted Anton font into outline paths, so the letters are drawn shapes, not live text. The script and the opentype.js install live in the AI session's scratchpad, not in the project, so regenerating the files later means re-creating that script. Animation is CSS inside each SVG and is switched off when the viewer prefers reduced motion. Anton is an open-licence font (SIL OFL), as fontsource packages it.

**Checked by the AI:** the three logos and the favicon were rendered in headless Chrome at several animation times (centred, glancing, blinking) and the header was rendered in the real app; the AI looked at those screenshots. The logo is a first design, not reviewed by the user or by a designer, and no trademark or similarity check was done.

### 2026-10-17: Working branch
**Asked:** Create a separate branch to work on.

**Files created or changed:** `AI_DISCLOSURE.md` only. Claude ran `git checkout -b phase-2`, branching from `main` at commit 88f4483. No code was generated or changed.

### 2026-10-17: Phase 2, step 1: belief agent logic
**Asked:** Implement Phase 2 (belief panel, incident.io Adaptable Agents) step by step, checking in before each step. Step 1: the agent logic on its own.

**Files created or changed:** `src/agent.ts` (new), `AI_DISCLOSURE.md`.

**What was done (AI-generated by Claude):** all of `src/agent.ts`. It is a rule-based agent, a plain state object plus functions, with no LLM and no React. Four hypotheses (under-blinking, fine, bad lighting / data unreliable, in a call). Each tick it collects weighted evidence from blink rate, incomplete-blink ratio, continuous screen time, frame brightness, face visibility, Call mode, time since recalibration and "I was fine" presses, then turns the scores into confidences with a softmax. Blink-based evidence is scaled down by a reliability factor when the light is low, the face is missing, the rate is still being measured, or the user recently recalibrated. A new hypothesis takes over only with a 10-point lead (so it does not flicker), except after an "I was fine" correction, which switches straight away. Every change of mind is logged as "Dropped X (old% → new%). Reason: …". "I was fine" relaxes the under-blinking threshold by 2/min (floor 4) and its effect fades over three rate windows. In Call mode, fatigue signs queue a break instead of nudging, and the break is released when the call ends. The agent always returns an action and a one-line explanation. All weights were chosen by Claude as starting values and have not been tuned against real data.

**Not yet done:** the agent is not connected to the tracker or the UI yet (steps 2 to 4), so it has no visible effect.

**Checked by the AI:** Node.js is not installed on this machine, so `npm run build` could not be run. The file was only read through by hand against the project's TypeScript settings. Nothing was compiled or run.

### 2026-10-17: Phase 2, steps 2 to 4: agent wired in, belief panel, Call mode, "I was fine"
**Asked:** Node.js is now installed; continue Phase 2 only, on the `phase-2` branch, from where step 1 left off.

**Files created or changed:** `src/agent.ts`, `src/useEyeTracker.ts`, `src/App.tsx`, `src/index.css`, `AI_DISCLOSURE.md`. `npm install` was run (creates `node_modules/`, which git ignores; `package.json` unchanged).

**What was done (AI-generated by Claude):**
- `src/agent.ts`: fixed a TypeScript error from step 1 (first-tick hypothesis could be null); added `agentDeferNudge` so a break nudge that is on screen when Call mode is switched on becomes a queued break instead of being lost; the "changed my mind" reason now quotes the strongest evidence for the new conclusion first (before, a switch to bad lighting was explained by the blink rate instead of the dark frame); shortened the "bad lighting" label so it fits in the panel.
- `src/useEyeTracker.ts`: the agent runs on every UI refresh (4 times a second) during calibration and tracking. It now decides the vignette and the break nudge. The tracker only supplies numbers. Under-blinking uses the agent's threshold, which "I was fine" relaxes. Recalibrate, I took a break and Remind me later notify the agent. New `wasFine` action and `callMode` input. A nudge is hidden while in Call mode or while the agent thinks the light is too poor.
- `src/App.tsx`: new belief panel beside the camera preview: current hypothesis with confidence, the action it is taking, confidence bars for all four hypotheses, how much it trusts the blink data, evidence for and against, the "Changed my mind" line, and a collapsible reasoning log with a count of changes of mind. "I was fine" button in the panel and in the break nudge. Call mode toggle in the controls row. "Break queued for after your call." banner.
- `src/index.css`: belief panel styles; preview and panel side by side from 880px, stacked on phones; rate and stat cards moved below.

**Behaviour change from Phase 1:** the nudge used to need a rate below 8/min plus enough screen time. Now it fires when the agent's current call is under-blinking (which can also come from a high incomplete-blink share) plus enough screen time, or when a queued break is released after a call.

**Checked by the AI:** `npm run build` completes. `oxlint` shows two warnings, both in Phase 1 code that was already there. The agent was driven by a scripted input sequence in Node (warm-up, healthy rate, staring at 4/min, "I was fine", call on and off, low light, recalibration). It switched and logged reasons as intended, and fatigue came back about 30s after "I was fine" in demo timings. The dashboard was rendered in headless Chrome with Chrome's fake camera (a test pattern, no face) at 1280px and 390px, and the AI looked at the screenshots. That shows the layout during calibration only. Live tracking, the agent with real blink data, the nudge and the vignette were not seen. Nothing was tested with a real camera or face. All agent weights are still untuned first guesses.

### 2026-10-17: Phase 3, Gemini summary
**Asked:** Implement the "Gemini" section of Phase 3.

**Files created or changed:** `server.js`, `vite.config.ts`, `src/summary.ts` (new), `src/useEyeTracker.ts`, `src/App.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What was done (AI-generated by Claude):**
- `server.js`: loads `.env` from the app folder with Node's built-in `process.loadEnvFile` (no new dependency). New `POST /api/summary` takes five aggregate numbers (average blink rate, incomplete %, screen minutes, breaks, belief changes), ignores any other fields, range-checks them, and asks Gemini for a 2 to 3 sentence plain-English DSE summary. The system instruction tells Gemini it is not a medical device and must not diagnose or give medical advice. Uses the Gemini Interactions API (`/v1beta/interactions`) with model `gemini-3.8-flash` (can be overridden with `GEMINI_MODEL`), `thinking_level: low`, `store: false`, and a 10 second timeout. It returns 503 if no key is set and 502 with a short reason if Gemini fails. `/api/health` now also reports whether a Gemini key is configured (true or false, never the key). Bad JSON gets a JSON 400 instead of an HTML stack trace.
- `vite.config.ts`: the dev server forwards `/api` to the Express server on port 3000.
- `src/summary.ts`: client call with a 15 second timeout, and a template summary used when the session is under 30 seconds, the server has no key, or Gemini fails. The UI labels which one was used and why.
- `src/useEyeTracker.ts`: session totals that survive the 60 second window, recalibration and breaks: complete and incomplete blinks, tracked time with a face in view, breaks (the "I took a break" button plus time away from the camera). New `endSession` returns those aggregates and stops the camera.
- `src/App.tsx`, `src/index.css`: Stop is now "End session". It shows a session summary with four stat tiles, the summary text, a label ("Written by Gemini…" or "Template summary, not written by Gemini" plus the reason), the privacy badge and "Start a new session". This is a minimal results view. The full DSE report and the employer view are the separate "Summary screen" section, which has not been built.

**Not done, on purpose:** Gemini does not write the belief-panel reason. Phase 2 says no LLM in the agent's loop, so that optional part was skipped.

**Model name source:** the AI read Google's Gemini API docs (ai.google.dev, models page and Interactions API reference) on 2026-10-17. They list `gemini-3.8-flash` as the current stable Flash model. The response parser follows that reference (text sits in `steps` of type `model_output`) and also accepts the older `candidates` shape.

**Checked by the AI:** `npm run build` completes and `oxlint` reports only the two older warnings. A local server was run and checked with curl:
- `/api/health` responds.
- With no key, the summary route gives 503 and the reason.
- Bad JSON gives a JSON 400.
- With a deliberately fake key, the request reached Google, which answered "API key not valid", so the route returned 502 with a short reason.
- The SPA fallback still works.
- The template text was printed for a normal and a too-short session.

**Not checked:** no call has been made with a real Gemini key, so a real successful response and the text-extraction path are untested. The summary screen has not been viewed in a browser and the session totals have not been checked against a real camera session.

### 2026-10-17: Gemini summary timing out, switched to Flash-Lite
**Asked:** The summary showed "Template summary, not written by Gemini. Gemini timed out" after the user added their API key.

**Files changed:** `server.js`, `AI_DISCLOSURE.md`.

**Diagnosis (by Claude, using the user's key from `.env`; the key was never printed):** the request to `gemini-3.8-flash` succeeded, but it took 54 seconds and used 327 thinking tokens for a 21-token reply, well past the server's 10-second limit. A plain `generateContent` call to the same model was still waiting after 60 seconds. `gemini-3.8-flash` rejects `thinking_level: minimal`. `gemini-3.5-flash-lite` answered in about 1 second with no thinking tokens. The test calls sent only made-up aggregate numbers.

**What changed (AI-generated by Claude):** the default model is now `gemini-3.5-flash-lite` with `thinking_level: minimal`. Google's models page recommends "3.5 Flash-Lite or 3.8 Flash" for new projects. Both settings can be overridden with `GEMINI_MODEL` and `GEMINI_THINKING` in `.env`. The instruction to Gemini now asks for digits rounded to whole numbers, asks it to mention the blink rate and incomplete share, and tells it not to add its own disclaimer (it was appending "This is not a medical device." and skipping the blink numbers).

**Checked by the AI:** through the local server's `/api/summary`, with the user's real key:
- Three made-up sessions each got a Gemini summary in under about 1 second after the first call. The first call took 5.7 seconds.
- The replies followed the instructions, apart from a small grammar slip ("1 minutes").
- Not checked in the browser. The user's own server on port 3000 was still running the old code when this was written.
