# AI Disclosure

This file is kept up to date after every task. The log at the bottom records each request, the files changed, what Claude generated and what was and was not checked.

## Tools used while building
- Claude Code (Claude Sonnet 5.5 and Claude Opus 5.5, used in different sessions by different team members): wrote the code, ran builds and checks, searched the web for the reference sources and the current Gemini model name, and wrote this file.
- Google AI Studio: used only to create the Gemini API key. It wrote nothing.

## AI inside the product (at runtime)
- MediaPipe FaceLandmarker: a pretrained face-landmark model. It runs in the browser. Video is never recorded or uploaded.
- Gemini API (`gemini-3.5-flash-lite`), used in two places. Each is labelled in the page as written by Gemini or by a template, with the reason when the template was used:
  - **Result summary:** writes the short summary on the result screen. It receives only anonymous numbers: blink rate, partial-blink share, time measured, band, the two reference ranges and the change between the first and second half of the session. It does not choose the numbers, the band or any recommendation.
  - **Trend explanation (opt-in):** only when the person presses "Explain my trend", it writes 2 short sentences about their last few checks. It receives only those blink rates (oldest first) and which checks were rough. It gets no dates. The direction of the change and where the latest check sits are worked out by our code and handed to Gemini as plain sentences. The "Not medical advice" line under the reply comes from the app, not from Gemini.
- Cohort agent (employer view, `src/cohortAgent.ts`): plain rule-based TypeScript. No language model is involved. Its thresholds and wording were chosen by Claude.
- Demo-mode blink reminder: plain rule-based TypeScript (live rate over the last 20 seconds below 5 a minute). No language model is involved.
- Not built: the measurement agent, ElevenLabs voice, Presage vitals.

## What AI wrote vs what we wrote
| Component | Written by |
|---|---|
| Concept, name, pitch, PROJECT.md spec | The team |
| All source code (blink engine, check flow, result screen, server, employer view, cohort agent) | Claude, from the spec; the user directed changes and tested in the browser |
| Logo, card drawings, chart code (including the trend chart) | Designed and coded by Claude |
| Trend graph, local history, "Explain my trend", demo-mode blink reminder, counting in hidden tabs | Coded by Claude at the user's request; the reminder was agreed by the team |
| Reference-range sources in `src/reference.ts` | Found by Claude through web search. The AAO page was read in full; the papers were seen as abstracts and secondary reports |
| Sample responses (12 plus 18 demo extras) | Invented by Claude. Always labelled "Sample data" in the UI |
| Deployment (Vultr, Caddy, pm2, GitHub Action) | Steps and workflow file by Claude; run by the user |

## Honest notes
- Blink detection thresholds are first guesses. They have not been tuned or validated, and Claude has never run the app with a real camera.
- These cut-offs are Claude's choices, not from a source: the low, typical and high bands (below 5, above 20 a minute), the employer low-share lines (20% and 40%) and their 2-point dead band, "short session" (under 2 minutes) and the agent's confidence formula.
- The reference ranges: the American Academy of Ophthalmology quotes 15 a minute at rest and 5 to 7 on screen. Controlled studies found about 10 and about 15 on screen, so published values vary. Details are in `src/reference.ts`.
- Gemini does not always keep to the word limit in the prompt, and Google returned intermittent 403 errors that the server retries. The template fallback covers the rest.
- The Gemini key is on the free tier: 15 requests a minute for this model. Rapid testing hit that limit (429). The server does not retry a 429, because quick retries only use up more of the quota. The page then shows the labelled template.
- Trend history is kept only in the browser's own storage (localStorage) on that device. It is not sent to the server or the company, and it is lost if the browser data is cleared. The trend explanation sends those rates to Gemini only when the person presses the button.
- Counting carries on in a hidden tab only in Chrome and Edge, which can read camera frames directly. Firefox and Safari still pause when the tab is hidden, and the page says so. Tested with Chrome's fake camera, not a real one.
- Demo-mode reminder settings are Claude's choices, not from a source: the 20 second window, the 30 second quiet period after "Got it", and using the bottom of the screen range (5 a minute) as the trigger.
- The employer view is anonymous but has no login, and nothing stops one person sharing twice.
- Not a medical device. It does not diagnose, and a low reading only says the person might talk to an optician.

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

### 2026-10-18: Scope change to the one-time company check. Step 1 (reconcile) and Phase 2 part A (employee flow)
**Asked:** PROJECT.md was rewritten (one-time company check only, personal mode dropped, no DSE). Step 1: remove everything built for continuous use, keep the blink engine, calibration, error states and demo mode, and make the engine expose a "measure for N seconds" function. Step 2: Phase 2 part A only: intro and consent, camera and 10 second calibration, 90 second (demo: 30 second) measurement while reading a passage, private result card with blinks per minute, incomplete percentage, band, one suggestion, comparison chart with reference numbers in one config file marked UNVERIFIED, privacy badge throughout, styled per the new Design section. No share step, server routes, employer view, agents, Gemini, ElevenLabs or Presage.

**Files created or changed:**
- `src/reference.ts` (new): reference ranges, band cut-offs and `bandFor()`.
- `src/useEyeTracker.ts` (rewritten): same camera, model, calibration, EAR and error handling, with the continuous-use parts removed and a new `measure(seconds)` function.
- `src/blink.ts`: removed the nudge, break-away, snooze and rolling-window settings and the under-blinking threshold; added `MEASURE_SEC`, `DEMO_MEASURE_SEC`, `LOW_LIGHT_SHARE`.
- `src/App.tsx` (rewritten): intro and consent screen, calibration and measurement screen with the passage, result screen, comparison chart, error screen, demo-mode pill.
- `src/index.css` (rewritten): new palette and type per the Design section.
- `src/Illustrations.tsx`: kept the blink and privacy drawings (recoloured), deleted the look-away and workstation drawings.
- `src/main.tsx`, `package.json`, `package-lock.json`: Oswald replaced by Inter (`@fontsource/inter`).
- `index.html`: theme colour and description.
- `server.js`: removed `/api/summary` and the Gemini code; `/api/health` now returns only `{ ok: true }`.
- Deleted: `src/agent.ts` (belief agent) and `src/summary.ts` (session summary client). Both are in git history.
- `AI_DISCLOSURE.md`: this entry, and the "AI inside the product" and table sections updated so they no longer claim features that are gone.

**AI-generated:** all of the code above was written by Claude (Sonnet 5.5). The reading passage on screen is original text written by Claude, not taken from anywhere.

**Removed as continuous-use or off-brief:** the dimming vignette, the break nudge and snooze, screen-time timer, break counting, the rolling 60 second blink rate, Call mode, "I was fine", the belief panel and the belief agent (Phase 4 will build the new measurement agent from scratch), the session summary screen and the Gemini route (it was framed around DSE and took screen-time and break numbers, so it would need rewriting in Phase 3 anyway), and the look-away and workstation illustrations.

**Differences from PROJECT.md:**
- The top bar has the text wordmark and a Demo mode pill, as the Design section says. The animated SVG logo files are still in `public/logo/` but are no longer used.
- The measurement clock counts only time with a face in view. If the face is lost, the progress bar pauses instead of counting that time. This is the AI's choice, not in PROJECT.md.
- If a measurement sees no blinks at all, the result screen says "No reading" and shows no band, because that is more likely a tracking failure than a real result. Also the AI's choice.
- If more than 20% of frames during the measurement were dark, the result card shows a "reading may be less reliable" note. This is a simple check, not the Phase 4 agent.

**Honest notes:**
- The reference ranges (relaxed 15 to 20, screen use 5 to 7) come only from the figures quoted in PROJECT.md's pitch notes. They have no citation. They are marked UNVERIFIED in `src/reference.ts` and in the chart caption, and must be replaced with sourced numbers.
- PROJECT.md asks for low, typical and high bands but does not say where the lines go. The AI chose: low is below 5 blinks per minute, high is above 20, typical is between. Those cut-offs are UNVERIFIED and are an AI guess.
- All blink-detection thresholds are still the first guesses from Phase 1, not tuned and not validated.
- The intro text says nothing leaves the device. That is true of this build because there is no share step yet. The wording will need to change when the share step is added.

**Checked by the AI:** `npm run build` completes (tsc and vite). `oxlint` reports two warnings, both on code carried over from earlier phases (a ref read during render, and a hook dependency list in `start`). The intro screen was rendered in headless Chrome at 500px width (Chrome's minimum) and the AI looked at the screenshot. The local server answered `/api/health`. Nothing else was run: the calibration, measurement, result card and comparison chart were not rendered or exercised, and nothing was tested with a camera. The user will test.

### 2026-10-18: Intro card: "Taking part is optional" replaced by the "Not a medical device" card
**Asked:** Remove the "optional" card from the intro and bring the medical card back.

**Files changed:** `src/App.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** the third intro card is now the dark red `#7F1D2A` "Not a medical device" card with cream text, as it was before the scope change. The body text was rewritten without any DSE wording: "It does not diagnose anything. A low reading is a prompt to see an optician, not a result to act on by itself." There is no illustration on it, because the old one was a DSE drawing and was deleted. The unused pale card style is still in the CSS.

**Honest note:** PROJECT.md Phase 2, flow step 1, says the intro must say that taking part is optional. That sentence is now gone from the intro, at the user's request. The red card is not in the new Design section, which names only the dark and aqua cards.

**Checked by the AI:** `npm run build` was run after this change (see the reply). The card was not viewed in a browser.

### 2026-10-18: Intro restyled to match a reference screenshot; eye-chart drawing on the medical card
**Asked:** (1) "with the animation?" on the medical card, then (2) "make it look like this?" with a screenshot of a fintech homepage (centred huge headline, pill buttons, three cards of different widths).

**Files changed:** `src/App.tsx`, `src/index.css`, `src/Illustrations.tsx`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):**
- New `OpticianIllustration` (an eye chart with a dashed red highlight stepping down the rows, CSS `illo-row`, off under reduced motion) on the red "Not a medical device" card. It replaces the deleted DSE workstation drawing, which showed a DSE checklist the brief now rules out. The user was asked whether to keep this or restore the old drawing and has not answered, so this is a stand-in. The letters are decorative, not a calibrated chart.
- Layout and type copied from the screenshot's style only (no logo, wordmark, text or artwork): centred hero with tighter headline tracking, bigger primary button with the privacy badge on its own line below, three intro cards in a 1 : 1.3 : 1 grid, card headings in sentence-case Inter semibold in an accent colour instead of Anton caps, drawings moved to the bottom of the cards and run off their edges, top-bar button is now the dark primary pill. Card headings on the result and calibration cards change the same way.
- Not copied: the screenshot's "Find out more" links, nav items and offers, because they would link to or claim things this app does not have.

**Checked by the AI:** see the reply for whether the build and a screenshot were run after this change.

### 2026-10-18: Rounded rectangles instead of full pills
**Asked:** "make everything rounded, rectangular".

**Files changed:** `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** I read this as rounded-corner rectangles. Buttons, the privacy badge and the preview status label went from fully round pills (999px) to 14px and 12px corners, progress bars to 6px, the chart track to 10px, the chart marker label to 8px, and the face-found dot and legend swatches from circles to small rounded squares. Cards (32px), banners (24px) and the card drawings keep their rounded corners. The class names `.pill` and `.pill-*` were left as they are. This departs from the Design section in PROJECT.md, which says fully rounded pills, at the user's request. If "rounded, rectangular" meant something else (for example square corners as in the earlier build), say so.

**Follow-up, same day:** forced a line break in the intro headline (`src/App.tsx`) so it reads "Eye check." / "Two minutes." instead of wrapping mid-sentence at desktop width. Claude rendered the intro in headless Chrome at 1280px and looked at it. The card layout, red medical card and drawings looked as intended there. The calibration, measurement and result screens were not rendered, the eye-chart animation was not seen moving, and nothing was tested with a camera.

### 2026-10-18: Undo the screenshot restyle except the centred hero; intro box colours changed
**Asked:** "go back but only center the hero. I meant change the box colours" (after the "make it look like this" screenshot request).

**Files changed:** `src/index.css`, `src/App.tsx`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):** reverted the layout and type changes from the screenshot restyle: headline size and tracking, lede size, card padding, Anton uppercase card headings, drawings back at the top of the cards, equal three-column grid, button sizes, the Demo mode pill back to secondary, and the privacy badge back beside the start button. Kept: the centred hero, the forced line break in the headline, and the rounded-rectangle corners from the previous request. Intro box colours now follow the screenshot's palette: "What is measured" is forest green `#163300` with a lime heading, "What is shared" is near-black `#202020` with an aqua heading, and the "Not a medical device" card stays dark red. Card headings on dark cards elsewhere (the result and preview cards) now use aqua too. The red medical card is the AI's choice, since the screenshot has no such card.

**Checked by the AI:** see the reply.

### 2026-10-18: Background measurement while working, plus Gemini summary on the result
**Asked:** "I want the 9-5 version entirely", then (after the user interrupted a question about which version) a screenshot of their pitch notes and the line "one time company assessment / summary tool (to help improve employee welfare)". The notes describe a person running the app once during their 9-5 job in the background, getting an in-depth analysis of their blinking against the recommended rate and what may happen to their eyes if they continue, with the idea of companies using shared data for employee benefits.

**How Claude read that:** still a one-time assessment, not the old all-day tracker. So the vignette, break nudges, belief panel and DSE wording were not brought back. What changed is how the measurement runs and what the result says.

**Files created or changed:** `src/blink.ts`, `src/useEyeTracker.ts`, `src/App.tsx`, `src/summary.ts` (new), `src/index.css`, `server.js`, `index.html`, `PROJECT.md` (tagline, Phase 2 flow steps 3 and 4), `AI_DISCLOSURE.md`.

**What changed (AI-generated by Claude):**
- The 90 second reading task is gone, with its passage. The measurement is now 10 minutes while the person works (30 seconds in demo mode). The 10 minutes is Claude's choice, not from the pitch notes or PROJECT.md.
- A "Finish now" button, enabled after 30 seconds of measuring (`finishEarly` in the hook).
- A banner when the tab is hidden. The measurement clock already only counts frames with a face in view, so hidden time is not counted. Browsers stop sending camera frames to hidden or fully covered windows, so "background" means a visible window beside the work, not a minimised one.
- `/api/summary` is back on the server with a new prompt: no DSE wording, three sentences, under 80 words, compares the rate with the two reference ranges, says a low rate may leave eyes feeling dry or tired if it continues, gives one tip, mentions no other condition, no statistics, no timeframes, never diagnoses. Same Gemini model settings as before (`gemini-3.5-flash-lite`, minimal thinking, 10 second timeout, key from `.env` on the server only).
- `src/summary.ts`: sends blinks per minute, incomplete percentage, minutes measured, the band and the two reference ranges. A labelled template summary is used if the key is missing, Gemini fails or the measurement is under 30 seconds.
- Result screen has a "Your summary" card with a label saying whether Gemini or the template wrote it. The intro and result wording changed from "nothing leaves your device" to say that only these anonymous numbers go to Gemini and video never does.

**Honest notes:**
- The sentence about low blink rates and dry or tired eyes is a general, widely repeated claim that the prompt asks Gemini to make cautiously. It has no citation in this project. The reference ranges it compares against are still UNVERIFIED.
- The pitch notes mention companies sharing data to shape benefits. That share step, the server storage and the employer view are not built.
- The notes say "in-depth analysis". The summary is capped at about 80 words, which is shorter than "in depth".

**Checked by the AI:** `npm run build` completes. The intro was rendered in headless Chrome at 1280px and looked at. The local server returns 503 for `/api/summary` with no key, and a JSON 400 for bad JSON. There is no `.env` in the project folder at the moment, so no real Gemini call was made and the prompt's output was not seen. The measuring screen, hidden-tab banner, Finish now and the result summary card were not rendered. Nothing was tested with a camera.

### 2026-10-18: Square corners
**Asked:** "make it rectangular".

**Files changed:** `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** every `border-radius` in the CSS is now 0: buttons, the privacy badge, cards, banners, progress bars, the chart, the card drawing panels, and the small face-found dot and legend swatches. The drawings themselves still have their own rounded shapes inside the SVGs. This reverses the earlier "rounded rectangles" change and departs from PROJECT.md, which says pills and 32px cards, at the user's request. Class names such as `.pill` are unchanged.

**Checked by the AI:** `npm run build` was run (see reply). Not viewed in a browser after this change.

### 2026-10-18: Padding and less template-like UI
**Asked:** "fix the padding and make it look less ai-generated".

**Files changed:** `src/App.tsx`, `src/index.css`, `src/summary.ts`, `server.js`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):**
- Spacing: more room under the top bar and around the hero, cards have 28px padding and a 20px gap, the drawings sit in a smaller panel (capped at 150px tall) with space before the card heading, the check screen and result screen have consistent 16 to 24px gaps, and the page has more space at the bottom.
- Result screen: removed the separate "What to do" card, which repeated the summary. The summary card now holds the written summary, its Gemini/template label, and the "Worth discussing with an optician." line for the low band. The static per-band suggestion text is gone: the summary carries the tip. The Gemini prompt no longer asks for the optician line (the app adds it itself), and the template summary now includes a short tip.
- Copy: shorter lede, card text and consent line on the intro; removed the duplicate "Starting the camera…" line; shortened the chart caption and the result footnote.

**Checked by the AI:** `npm run build` completes. The intro and the result screen were rendered in headless Chrome at 500px width and looked at. The result screen was rendered with made-up numbers through a temporary hook that was removed afterwards (the final build was re-run without it). The calibration screen was only seen at 1280px with Chrome's fake camera before the spacing change, so the new spacing there was not viewed. The measuring screen was not rendered. Nothing was tested with a real camera and no real Gemini call was made.

### 2026-10-18: Animated logo back in the top bar
**Asked:** "what happened to the old svg animated logo".

**Answer:** Claude replaced it with a text wordmark during the scope-change rewrite, because the new Design section in PROJECT.md says "text wordmark". The logo files were never deleted from `public/logo/`.

**Files changed:** `src/App.tsx` (top bar shows `/logo/logo-horizontal.svg` again), `src/index.css` (`.logo` size, removed the `.wordmark` rule), `PROJECT.md` (top bar line), `AI_DISCLOSURE.md`.

**Notes:** the logo was designed earlier by Claude (see the 2026-10-17 "Animated eye logo" entry) with charcoal letters and a soft-green iris from the old cream palette. It was not recoloured for the lime background. Claude rendered the header in headless Chrome at 1280px and looked at it: the letters and eye read clearly on the lime. The glance and blink animation was not seen moving in that still.

### 2026-10-18: Removed the small caption lines
**Asked:** The "Pressing the button lets this page use your camera for the check." line looks AI-generated, like eyebrow labels and captions; design it better.

**Files changed:** `src/App.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):**
- Removed the consent caption under the start button. The button already reads "I agree. Start the camera."
- Removed the explanation under the incomplete-blinks figure, the "Blinks per minute" caption under the chart, the "You can finish early" hint, and the blinks-counted footnote on the result.
- The UNVERIFIED mark on the reference ranges now sits in each legend line as "(unverified)" instead of a caption. The measuring card's text is one sentence and the time left is bold instead of grey small print.
- Required labels were kept but folded into the element they belong to: the summary card says "Written by Gemini. Not a medical device." (or says the text is a template, and why). The result screen no longer says "your video never left this device" in the subtitle, because the privacy badge already says it.

**Checked by the AI:** `npm run build` completes. The screens were not rendered after this change.

### 2026-10-18: Intro fits on one screen; medical card is light blue
**Asked:** (1) "fix the padding on the page so it all fits in one page", (2) "not a medical advice should be this light blue" (with a crop of a light-blue card from the reference screenshot).

**Files changed:** `src/App.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):**
- The "Not a medical device" card is now the pale aqua `#A0E1E1` with forest-green text, replacing the dark red. The unused red card style was removed.
- Intro spacing now scales with the window height (headline size, hero padding, gaps, card padding and the drawing height use `vh`-based `clamp()` values). On desktop-width windows up to 900px tall the card drawings are hidden so the whole intro fits without scrolling. Phones and narrow windows still scroll, because three stacked cards cannot fit one phone screen.
- The start button now reads "Start" and the consent line is gone. Those edits to `src/App.tsx` were made by the user in their editor, not by Claude.

**Checked by the AI:** `npm run build` completes. The intro was rendered in headless Chrome at 1366x650, 1440x800 and 1920x950 and looked at; at those sizes the whole page, cards included, is inside the window. 1280x720 was rendered but not looked at. The result, calibration and measuring screens were not re-checked, and the result screen is long by design.

### 2026-10-18: Open-ended 9-5 style session, and why the Gemini summary showed "Server returned 502"
**Asked:** (1) "can I do a 9-5 but stop whenever, because the 10 min version isn't feasible for a live demo", (2) "fix the gemini summary, why isn't Gemini working?" with a screenshot of the template summary labelled "Server returned 502".

**Files changed:** `src/blink.ts`, `src/useEyeTracker.ts`, `src/App.tsx`, `src/summary.ts`, `server.js`, `PROJECT.md` (Phase 2 flow step 3), `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):**
- The measurement no longer has a fixed length. It runs until the user presses "Finish and see result", with an 8 hour safety cap (`MEASURE_SEC`). The progress bar is replaced by a time-measured clock. Finish is allowed after 30 seconds, or 10 seconds in demo mode (`DEMO_MIN_FINISH_SEC`). Demo mode no longer changes a measurement length, only that minimum. The result and the Gemini request now carry seconds instead of minutes, and the server turns that into "45 seconds", "12 minutes" or "7.5 hours" for the prompt. Summaries are attempted from 10 seconds of measuring.
- Summary error text: when the response is not a JSON error from our server, the label now says "The API server did not answer (status N)" instead of "Server returned N".

**Diagnosis of the 502 (by Claude):** the dev page was on Vite port 5173, which forwards `/api` to the Express server on port 3000. Nothing was listening on 3000, so Vite answered 502 with no body. Separately there is no `.env` in the project folder and no `GEMINI_API_KEY` in the environment, so even with Express running the route would answer 503 "Gemini is not configured". Neither is a code bug. With a deliberately fake key on a spare port, `/api/summary` reached Google and returned "Gemini returned 400" (key rejected), so the route, the prompt wiring and the error path work up to that point.

**Not checked:** no real Gemini call has been made in this session because there is no key available here, so the wording of a real reply is unseen. The Finish button and the open-ended timer were not exercised with a camera.

### 2026-10-18: Gemini summary working with the user's key
**Asked:** "I think it's 5173 not 3000" (about which port to use), after the 502 diagnosis above.

**Files changed:** `server.js`, `AI_DISCLOSURE.md`.

**Findings (by Claude):** the page is on 5173 (Vite), which forwards `/api` to Express on 3000, so both must run. Port 3000 was not running. The `.env` now exists with `GEMINI_API_KEY` set (Claude checked only that the line is well-formed, its length and that it has no quotes; the key was never printed). With Express started, `/api/health` answered `"gemini":true` through 5173 and real summaries came back from `gemini-3.5-flash-lite` for made-up numbers only.

**What changed (AI-generated edits by Claude):**
- The prompt now receives the duration as a plain phrase ("75 seconds", "1.5 hours") and is told never to write the field name. Before, one reply said "you were measuredFor 75 seconds".
- The server now works out where the rate sits against the two ranges ("below the typical screen-use range", "above the typical screen-use range but below the typical relaxed range", and so on) and passes that as a fact. Before, Gemini said 12 blinks a minute was "above" both ranges.
- `/api/summary` retries once after 700 ms when Gemini answers 403, 429 or 5xx. Gemini returned "403 The caller does not have permission" on 3 of about 14 test calls and then worked on repeats, so it looks intermittent. The cause was not found. If it keeps happening, the template summary is shown with its reason.

**Checked by the AI:** about 14 calls with made-up numbers through `/api/summary` on port 5173. Wording was read for low, typical and high cases and looked correct. The page itself was not run against the real server in a browser, and nothing was tested with a camera.

### 2026-10-18: Finish button explained and clock made less likely to stall
**Asked:** "why can't I click finish and see result".

**Files changed:** `src/useEyeTracker.ts`, `src/App.tsx`, `AI_DISCLOSURE.md`.

**Cause (by Claude, from the code, not reproduced):** the button is disabled until 30 seconds of face-in-view time are measured (10 seconds in demo mode). That clock only advances on camera frames that contain a face while the tab is visible. Claude had removed the hint explaining this in the earlier caption clean-up, so a locked button looked broken. A slow camera or CPU could also stall the clock, because gaps of more than 0.5 seconds between frames were not counted.

**What changed (AI-generated edits by Claude):** while locked, the button now reads "Finish unlocks in Ns". The gap allowed between frames before time stops counting went from 0.5 to 1.5 seconds. Frames separated by a hidden or covered tab still do not count.

**Checked by the AI:** `npm run build` completes. Not run with a camera, so whether the clock advanced in the user's session is unconfirmed.

### 2026-10-18: Gemini 403s: diagnosis and more retries
**Asked:** the summary showed "Template summary, not written by Gemini: Gemini returned 403". Why isn't Gemini working?

**Files changed:** `server.js`, `AI_DISCLOSURE.md`.

**Diagnosis (by Claude, with the user's key from `.env`, never printed):** a probe script (kept in the session scratchpad, not in the project) sent 12 tiny test calls to each of Gemini's Interactions endpoint and `generateContent`, with the same model. Both returned 200 most of the time and 403 "The caller does not have permission" now and then (3 of 12 and 1 of 12). One 403 said "Gemini API has not been used in project … before or it is disabled". So the app code is not at fault: the key's Google Cloud project appears not to have the Generative Language API fully enabled, or the setting is still propagating, and Google's servers disagree about it. The key is accepted most of the time, so it is not simply invalid.

**What changed (AI-generated edit by Claude):** `/api/summary` now retries up to 4 attempts in total (800 ms apart) on 403, 429 and 5xx, instead of one retry. In a run of 24 requests through the app 22 returned a Gemini summary and 2 failed after 4 attempts in a row (11 retries were needed overall). The page falls back to the labelled template summary when all attempts fail.

**Not fixed:** the underlying project setting. That needs the user in Google AI Studio or Google Cloud Console (confirm the Generative Language API is enabled for the key's project, or create a new key in a new project).

### 2026-10-18: Share-with-company step, anonymous storage, and sources for the reference ranges
**Asked:** (1) build the "share my anonymous result" step, and advise on whether to store the data with a sponsor partner; (2) "find real sources for the reference ranges".

**Files created or changed:** `src/share.ts` (new), `src/App.tsx`, `src/index.css`, `server.js`, `src/reference.ts`, `.gitignore`, `PROJECT.md` (pitch notes line on blink figures), `AI_DISCLOSURE.md`.

**What was built (AI-generated by Claude):**
- Result screen has an opt-in "Share with your company" card. Nothing is sent until the button is pressed. The company code is read from `?org=CODE` in the link or typed in. Once sent, the card says it cannot be taken back because nothing links it to the person.
- `POST /api/assessment` validates the company code (2 to 32 letters, numbers, `-` or `_`), the rate (0 to 200), the incomplete percentage (0 to 100 or null) and the band, then appends one record `{ org, timestamp, blinksPerMinute, incompletePct, band }` to `data/assessments.json`. The timestamp is set by the server. Any other field in the request (a name, an email) is dropped. Writes are queued so simultaneous shares do not overwrite each other, and the file is written then renamed. `data/` is in `.gitignore`. There is a 20,000 record cap.
- Not built yet: `GET /api/aggregate` and the employer view, so shared data cannot be read back in the app yet. There is also no protection against the same person sharing twice, because there is no identity to check.
- The intro's "What is shared" card now mentions that sharing is optional and off by default.
- On the near-black card the secondary button is solid lime, because the pale version looked greyed out.

**Sources (found by Claude by web search, 2026-10-18):** the American Academy of Ophthalmology page "Computers, Digital Devices, and Eye Strain" (27 Jun 2024) was fetched and read directly. It says people "normally blink about 15 times in one minute" and "about 5 to 7 times in a minute while using computers". It names no primary study. The three papers (Bentivoglio et al. 1997; Talens-Estarelles et al. 2021; Chu, Rosenfield and Portello 2014) were seen only through abstracts, search summaries and secondary pages, because PubMed and the publishers' sites blocked automated fetching, so their exact figures were not checked in the full text. Full citations and numbers are in the comment at the top of `src/reference.ts`.

**Honest findings:**
- 15 to 20 at rest is well supported (AAO about 15, Bentivoglio about 17 with 150 people, Talens-Estarelles 20.4 looking at a distant target).
- 5 to 7 on screen rests on the AAO line alone. The controlled studies found about 10 (Talens-Estarelles, computer, 95% CI 6.9 to 12.8) and about 15 (Chu et al., 20 minutes reading on a computer, not different from paper). Bentivoglio's 4.5 was reading printed text, not a screen. So the number is the low end of what has been published.
- The low, typical and high cut-offs are still not from any source: they are the AI's choice and the code comment says so.
- The "(unverified)" tag in the chart legend was replaced by short citations ("AAO", "AAO, Bentivoglio 1997") and the `UNVERIFIED` flag was removed. If the user would rather keep a caveat on screen, that tag should come back for the 5 to 7 range.
- The Gemini prompt no longer calls the ranges placeholders; it is told to say "the reference ranges in this app" and name no source.

**Checked by the AI:** `npm run build` completes. The share route was tested on a spare port with a temporary data folder: two valid posts (one with a null incomplete share and extra name and email fields, which were dropped), five simultaneous posts (all 5 stored), and bad company code, bad band, rate out of range, missing field and bad JSON (all answered with a 400 and a short message). The test data was in the session scratchpad and no test records were written to the project's `data/` folder. The intro (1440x800) and the result screen (500px, with made-up numbers through a temporary hook that was removed before the final build) were rendered and looked at. The share button itself was not clicked in a browser, and no camera test was done.

### 2026-10-18: Company code taken from the link
**Asked:** the company code wording was confusing; for the demo the company will be "wise".

**Files changed:** `src/App.tsx`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** if the page address ends in `?org=CODE` (2 to 32 letters, numbers, `-` or `_`), the code is filled in, shown as "Company code: CODE", and the input box is hidden. Without it, the box is still shown. The card text now says the code is there so results can be grouped by company. For the demo, open the app with `?org=WISE`.

**Note on PROJECT.md:** the Design section says no Wise name anywhere in the UI. The app does not hardcode "Wise": the name only appears if it is in the link. That was the AI's way of keeping to the rule and using Wise as the demo company; the user can decide whether showing the code WISE on screen is acceptable.

**Checked by the AI:** `npm run build` completes. The new card layout was not rendered or clicked.

### 2026-10-18: Company code is typed in again
**Asked:** "I want to input the company code for the demo."

**Files changed:** `src/App.tsx`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** reverses the previous change. The company code box is always shown and typed in by the user. A link ending in `?org=CODE` still pre-fills it, but it can be edited. "Wise" is not hardcoded anywhere, so it only appears if someone types it or it is in the link.

**Checked by the AI:** `npm run build` completes. The card was not rendered or clicked.

### 2026-10-18: Removed "Only you can see this."
**Asked:** remove the line "Only you can see this." from the result screen.

**Files changed:** `src/App.tsx`, `src/index.css` (removed the now-unused `.result .lede` rule), `AI_DISCLOSURE.md`.

**Note:** the line was also what told the person the result is private to them before they choose to share (PROJECT.md Phase 2, step 4: shown first and kept private). The share card still says sharing is optional and sends only anonymous numbers.

**Checked by the AI:** `npm run build` completes. The result screen was not re-rendered.

### 2026-10-18: Blink rate over the session, short-session note, result screen redesign, new body font
**Asked:** (1) "sure" to the plan: renamed band labels, a line saying the app does not check vision, a short-session note, and a blink-rate-over-the-session chart that also gives Gemini a trend; (2) the result cards felt text heavy and AI-looking, and the secondary font should suit the bigger bold text.

**Files changed:** `src/blink.ts`, `src/useEyeTracker.ts`, `src/App.tsx`, `src/summary.ts`, `src/reference.ts`, `src/index.css`, `src/main.tsx`, `server.js`, `package.json`, `package-lock.json`, `AI_DISCLOSURE.md`.

**What changed (AI-generated by Claude):**
- The engine records when each blink happens (in measured seconds). `buildTimeline` in `blink.ts` splits a session of two minutes or more into up to 12 equal parts and counts blinks per part. `trendOf` compares the first half with the last half. The result carries `timeline`.
- New "Through the session" bar chart on the result screen, over the same two reference bands. It only appears for sessions of two minutes or more.
- Sessions under two minutes (`SHORT_SESSION_SEC`, the AI's choice) show a yellow note saying they are too short to judge.
- Gemini now also receives `shortSession` and the first-half and second-half rates. The server turns the rates into a fixed phrase ("dropped from 8 to 4 blinks a minute between the first and second half of the session", "stayed about the same", or "rose") and the prompt says to use it as worded and not guess a cause. For short sessions it says only that the session was too short. The template fallback does the same.
- The two bands were renamed "Relaxed, not at a screen" and "Typical at a screen".
- Summary card: the optician line is now a lime callout, the summary text is larger, and one small line carries the Gemini/template label plus "Not a medical device, and it does not check your vision. Eye pain or changed sight: see an optician." Share card text was cut to one sentence, with the code box and button on one row. On wide screens the result is two columns.
- Body font changed from Inter to Barlow Semi Condensed (`@fontsource/barlow-semi-condensed`, weights 400 to 700), chosen by Claude as a semi-condensed grotesque that sits with Anton. Intro card text was shortened.
- The prompt now asks for 3 short sentences under 70 words. Gemini does not obey word limits closely: replies in testing were 71 to 89 words.

**Checked by the AI:** `npm run build` completes. The result screen was rendered at 1366px and 500px wide using made-up numbers (a 10 minute session with a falling rate) through a temporary hook that was removed before the final build, and the intro at 1440x800; all were looked at. Four real Gemini calls covered a short session, a drop, no change and a rise, and each used the supplied wording. The chart was not checked against a real session, because no camera test has been done. The share button was not clicked in the browser.

### 2026-10-18: Result screen back to one stacked column
**Asked:** the two-column result layout was not wanted ("I liked it stacked like before, on top of each other").

**Files changed:** `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** removed the two-column rule for the result screen, so the cards stack in one column on every screen width: the two number cards (side by side on wide screens, as before), then the ranges chart, the session chart, the summary and the share card. Everything else from the previous redesign (font, shorter text, callout) is unchanged.

**Checked by the AI:** `npm run build` completes. The result screen was not re-rendered after this change.

### 2026-10-18: Employer view (aggregates only) with a labelled sample cohort
**Asked:** "work on the employer view now" (PROJECT.md Phase 2, employer view). The cohort agent was not part of this request and was not built.

**Files created or changed:** `src/Employer.tsx` (new), `src/charts.tsx` (new, the two charts moved out of `App.tsx`), `src/App.tsx`, `src/index.css`, `server.js`, `AI_DISCLOSURE.md`.

**What was built (AI-generated by Claude):**
- `GET /api/aggregate?org=CODE&sample=1|0`: returns group numbers only (people counted, average rate, average incomplete share, share in the low band, counts per band). It never returns an individual record. Below 5 responses it returns only `{ enough: false, needed: 5 }`, with no count.
- Sample cohort: 12 invented responses are written into `server.js` (`SAMPLE_COHORT`), shown in the page under a yellow "Sample data" note, and removed with the "Include sample data" tick box (`sample=0`). They are not real people.
- Design choice (not in PROJECT.md): real responses only join the numbers once there are at least 5 real ones for that company code. Reason: the sample data is known and fixed, so if one real response were mixed in below 5, anyone could subtract the sample back out and read that person's result. With fewer than 5 real responses and the sample on, the view shows the sample-only numbers and says real responses join at 5. Consequence for the demo: sharing 1 to 4 live responses does not change the employer view; the fifth does.
- The page (`/?view=employer&org=CODE`): people assessed (real and sample counts), share in the low band, average incomplete blinks, the average rate on the same reference bands as the employee chart, a stacked bar of how many fall in each band, a recommended action, and a "What this could mean at scale" panel. It refreshes every 5 seconds.
- Recommended action: a rule-based sentence chosen from the low-band share (40% and above, 20% and above, below 20%). Those cut-offs are the AI's choice, not from a source.
- "What this could mean at scale": two editable assumptions (employees, default 1000; minutes lost per person per day, default 10) turn the low-band share into "about N people in the low band" and "about H hours a month" (21 working days). The 10 minutes is a placeholder, labelled on screen as not a research finding, because the app has no source for how much time eye strain costs.
- After sharing, the share card offers an "Open the employer view" link. The top bar shows "Take the check" on the employer page instead of the demo-mode button.

**Not built:** the cohort agent (conclusion, confidence, changed-my-mind), the priority selector, a Gemini sentence for the employer view, and any login for the employer page: anyone with the link and a company code can open it.

**Checked by the AI:** `npm run build` completes. The aggregate route was tested on a spare port with a temporary data folder: no real responses (sample only), sample off with 4 real (not enough), sample on with 4 real (sample-only numbers, real count withheld), 5 real with sample off and on (real counted), a second company code stays separate, and a bad code gets a 400. The page was rendered at 1366px wide against that test data and looked at. The mobile layout was rendered but not looked at. The test data lived in the session scratchpad. The project's own `data/assessments.json` already held one WISE record before this work, not made by Claude's tests, and was left untouched. The page was not checked in a browser against live demo data.

### 2026-10-18: Employer view small print removed; drawings back on short screens
**Asked:** (1) "remove the AI generated look, tiny small texts etc" on the employer view (screenshot of the recommended action and "what this could mean at scale" cards); (2) the card drawings were missing entirely on the deployed site, and the user confirmed the hiding rule was the problem.

**Files changed:** `src/Employer.tsx`, `src/App.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edits by Claude):**
- Employer view: removed the grey "rule-based suggestion, not medical advice" line, the "An illustration, not a forecast" intro and the long placeholder paragraph. "What this could mean at scale" became "At your scale": two inputs labelled "Assumed employees" and "Assumed minutes lost per person per day", followed by two big number cards (people in the low band, hours a month at your assumptions). The word "Assumed" in the input labels and the card title are now the only labelling of the placeholder minutes figure, which the app still has no source for.
- The remaining fine print on the result screen (the Gemini or template label and the "see an optician" line) is bigger (1.05rem, nearly full strength) and ends with a question mark phrasing: "Eye pain or changed sight? See an optician."
- Drawings: the rule that hid the three intro drawings on desktop windows 900px tall or less (added to make the intro fit one screen) now shrinks them to a strip about 48 to 80px tall instead. Reason: on the deployed site, laptop-sized windows were hiding them completely.

**Trade-off:** at 900px tall the whole intro fits. At 650px tall (a common laptop browser height) the bottom of the cards is cut off by about 40px, so the page scrolls slightly. Fitting everything on one screen on the smallest laptops would mean hiding the drawings again.

**Checked by the AI:** `npm run build` completes. The employer view was rendered at 1366px wide with the sample data before and after this change and looked at. The intro was rendered at 1366x900 and 1366x650 and looked at. The deployed site was not checked.

### 2026-10-18: Intro drawings back to full size on short screens
**Asked:** "make it look like the local version" (the deployed intro showed small drawing strips, the local one the larger drawings).

**Files changed:** `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** removed the rule that shrank the drawings and the headline on desktop windows 900px tall or less. The drawings and headline now size from the window height only through the earlier `vh`-based `clamp()` values (drawing 64 to 150px tall), the same as the local version in a taller window. The intro will scroll on laptop-sized windows instead of fitting one screen; this reverses the earlier "fit on one page" request for those screens, at the user's choice.

**Checked by the AI:** `npm run build` completes. Not rendered after this change. Not committed or pushed; the live site still needs the update command after a push.

### 2026-10-18: Auto-deploy on push (GitHub Action)
**Asked:** why can't Vultr be set up so that pushing to the GitHub repo updates the deployed website.

**Files created or changed:** `.github/workflows/deploy.yml` (new), `AI_DISCLOSURE.md`.

**What was done (AI-generated by Claude):** a GitHub Actions workflow that runs on every push to `main`. It logs into the server over SSH with a deploy key and runs the same update command as PROJECT.md (`cd /opt/app && git pull && npm install && npm run build && pm2 restart app`). It uses plain shell and no third-party actions. The server address, private key and server host fingerprint come from three repository secrets that the user has to create; until then the workflow would fail on each push. The workflow only runs on pushes to `main`, never on pull requests, so outside contributors to the public repo cannot reach the secrets.

**Not done or checked:** nothing was run. No key was created, no secret was set, and the workflow was not pushed. The deploy key logs in as `root`, which is simple but gives the key full access to the server.

### 2026-10-18: Cohort agent (PROJECT.md Phase 4, part B)
**Asked:** "let's do the cohort agent", then whether it fits the incident.io track and whether this file is being updated.

**Files created or changed:** `src/cohortAgent.ts` (new), `src/Employer.tsx`, `server.js`, `src/index.css`, `AI_DISCLOSURE.md` (this entry, and the header above was rewritten: it still said Gemini and the agents were not built and had unfilled template placeholders).

**What was built (AI-generated by Claude):**
- `src/cohortAgent.ts`: a rule-based agent with no language model. From the group numbers it holds one call: "Many blink less than usual" (low-band share 40% or more), "Some blink less than usual" (20% or more) or "Mostly typical blinking". It has a confidence percentage (from how far the share is from the nearest line, how many responses there are, whether sample data is included, and how many roles are screen-based), evidence for and against, and an action for the chosen priority (headaches, productivity or cost). Below 50% confidence the action is marked "Provisional" but still given: it never waits for more data. A 2-point dead band stops the call flipping back and forth on a line.
- "Changed my mind": whenever the call, the action or the confidence moves, the agent writes why (new responses arrived, priority changed, sample data removed, roles marked as not screen-based) and the old and new low-band share. A log keeps earlier changes.
- Employer view: priority buttons, a "roles that are screen-based (%)" correction, the "Include sample data" tick as a correction, and an "Add 3 sample responses" button that reveals more invented responses (mostly low-band) so the call can be seen changing on stage. These extras are labelled sample data, never stored, and come from `SAMPLE_EXTRA` in `server.js`.
- The agent was tested on its own in Node with a scripted story: first call, no flip at exactly 40% (dead band), flip to "many" at 44% with a stated reason, priority change, roles correction, sample removal. The page was rendered while a temporary hook (removed afterwards) added responses step by step; the screen showed the new call, confidence, evidence and the changed-my-mind line.

**Fixed afterwards:** the changed-my-mind line had a lime background on a lime page, so it looked like plain text. It is now a dark bar.

**Limits, said plainly:**
- Real shared responses only join the numbers once there are 5 of them, so live demo changes come from the labelled sample button, not from new real shares, unless 5 real ones exist.
- Only the cohort agent exists. The measurement agent (confidence changing during the check when light drops, the face is lost, or the person recalibrates) is not built.
- The agent only weighs signals from one source, the shared responses. It does not combine different sources.
- incident.io's own track brief has not been seen: the match below is against what PROJECT.md says the track wants.

### 2026-10-18: Clearer wording before the cohort agent has changed its mind
**Asked:** "Changed my mind: Not yet. This is my first call." was not clear to the user.

**Files changed:** `src/Employer.tsx`, `AI_DISCLOSURE.md`.

**What changed (AI-generated edit by Claude):** until the agent has changed anything, the box now reads "No change yet. Add responses, change the priority or correct the roles, and this box will say what moved my call." Once something changes it shows "Changed my mind:" followed by the reason, as before. The agent logic is unchanged.

**Checked by the AI:** `npm run build` completes. The page was not re-rendered after this wording change.

### 2026-10-18: "Team agent" header with an animated drawing
**Asked:** make it clearer that the cohort agent section is an agent, maybe with an animated SVG.

**Files changed:** `src/Illustrations.tsx`, `src/Employer.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What was done (AI-generated by Claude):** a dark "Team agent" card above the agent's call, with a new `AgentIllustration` (an eye that scans left and right over three bars that rise and fall; CSS animation, switched off under reduced motion) and one line of text: "Makes a call from these numbers and tells you when it changes its mind. Rules only, no AI model." The "rules only" claim is true: `src/cohortAgent.ts` contains no model call.

**Checked by the AI:** `npm run build` completes. The employer page was rendered at 1366px and 500px wide and the desktop one was looked at: the card, drawing and text show correctly. The animation was not seen moving in a still image.

**Note:** the user then shared the incident.io logo as the track's brand. Nothing from it was copied into the app. Whether to add a sponsor mention or accent colour is still undecided.

### 2026-10-18: Team agent panel in incident.io's colours, with an animated flame and a track badge
**Asked:** use incident.io's colours, make the agent section look like an agent and clearly separate, and "create an animated svg flame and the indicator it's for incident io track". The user shared the incident.io logo for reference.

**Files changed:** `src/Illustrations.tsx`, `src/Employer.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What was done (AI-generated by Claude):**
- The cohort agent now sits in its own near-black panel with an orange top bar, separate from the team numbers above it. Inside: a "Built for the incident.io Adaptable Agents track" badge, the title "Team agent", the call and its confidence in a grey block with an orange edge, For and Against lists with orange bullets, the changed-my-mind line as an orange bar, and the priority buttons and roles field in the same dark style.
- `FlameIllustration`: a flame with two layers that flicker slowly and three embers that rise and fade (CSS animation, off under reduced motion). **Drawn from scratch by Claude.** It is not a copy of incident.io's logo. No incident.io logo, wordmark or artwork was used. The sponsor is named in plain text on the badge only.
- The orange `#F25533` is **Claude's estimate** of incident.io's orange from a small image, not an official brand value. It is set once as `--agent-orange` in `src/index.css` (and as `ORANGE` in `Illustrations.tsx`).
- Removed the earlier eye-and-bars drawing and the tiny uppercase orange labels. The earlier agent card styles were deleted.

**Checked by the AI:** `npm run build` completes. The employer page was rendered at 1366px and 500px wide while a temporary hook (removed afterwards) added sample responses and changed the priority; the desktop one was looked at: the flame, badge, call, evidence and changed-my-mind bar all show. The flame animation was not seen moving in a still. The left-aligned priority buttons were fixed after that screenshot and not re-rendered.

### 2026-10-18: Agent panel simplified; "what changed" shown as Before / Now / Why
**Asked:** the flame looked too skinny; the section still looked AI-generated (remove eyebrow labels, captions, generated-looking boxes); and it was unclear what the agent was changing its mind about.

**Files changed:** `src/cohortAgent.ts`, `src/Employer.tsx`, `src/Illustrations.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated by Claude):**
- Flame redrawn wider and fatter (viewBox 160 wide, shown 130px).
- Removed the outlined track badge, the grey call box, the orange change bar, the For / Against headings and the tiny uppercase labels. The incident.io mention is now one plain sentence under the title: "Built for incident.io's Adaptable Agents track. Rules only, no AI model." The call is the large headline with its confidence in orange, introduced by "My call on your team:". Evidence is plain lines with a + (for) or a minus (against).
- The agent now records each change as a structured object (`what` moved, `before`, `now`, `why`) instead of one long sentence, and the page shows it as three lines: Before, Now, Why. It says "I changed my mind" when the call moved, "I changed my advice" when only the action moved (the priority changed), and "I changed my confidence" when only how sure it is moved. The earlier-changes list uses the same fields.
- The agent logic (thresholds, dead band, confidence) is unchanged. It was re-run in Node with the scripted story: no flip at exactly 40%, flip at 44% with before, now and why, new advice after a priority change, lower confidence after the roles correction, and a call change after the sample data was removed.

**Checked by the AI:** `npm run build` completes. The employer page was rendered at 1366px wide after a temporary hook (removed afterwards) added sample responses, and looked at: the flame, the call headline, the evidence lines and the Before / Now / Why block all show. The flame animation, the phone layout and the live site were not checked.

### 2026-10-18: Agent panel rebuilt as four numbered sections (accessibility pass); "At your scale" removed
**Asked:** (1) the agent section still looked AI-generated; it should be clear, visual and sectioned, and accessibility matters; (2) "remove this section" (the "At your scale" panel with the assumed employees and minutes fields and the two big number cards).

**Files changed:** `src/Employer.tsx`, `src/Illustrations.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What changed (AI-generated by Claude):**
- "At your scale" and its two number cards were deleted, with the fields, state and arithmetic behind them. PROJECT.md lists this "what this could mean" panel in the employer view and in its cut list (item 6, editable assumptions), so the employer view no longer has it. The minutes figure had no source, so nothing unsourced remains on the page.
- The team agent is now four numbered sections, each a real heading: 1 My call (the call in large type, a confidence meter with the number written next to it, and the recommendation), 2 Why (what supports the call and what argues against it, with counts), 3 What changed (Before, Now, Why, then an "Earlier" timeline), 4 Tell me what matters (priority and roles).
- Accessibility: headings are h2 for the panel and h3 for each section, so people using a screen reader can jump between them; the confidence meter is an ARIA meter with a spoken value ("65 percent sure"); priority is a labelled group of radio buttons that works with the keyboard, with a tick on the chosen one so it is not shown by colour alone; "roles that are screen-based" is a labelled range slider with its value written beside it; evidence uses + and minus signs as well as colour; the focus outline is a 3px white ring on the dark panel; the flame is hidden from screen readers; motion switches off under reduced motion; all text is at least 1rem. Contrast was calculated, not guessed: white on the panel 18.4:1, orange 5.4:1, grey 8.5:1, dark text on orange 5.4:1, all above 4.5:1.
- The rest of the app (intro, check and result screens) was not audited for accessibility in this pass.

**Checked by the AI:** `npm run build` completes. The employer page was rendered at 1366px wide after a temporary hook (removed afterwards) added sample responses and changed the priority, and looked at: all four sections, the meter, the timeline and the ticked priority show. The 500px render was not looked at. Keyboard use and a screen reader were not tried. A doubled full stop in the Earlier list was fixed after the screenshot and not re-rendered.

### 2026-10-18: "Show trend": last 5 checks from this browser's own storage
**Asked:** A trend graph of the last 5 sessions, using data stored locally, with a "Show trend" button.

**Files created or changed:** `src/history.ts` (new), `src/charts.tsx`, `src/App.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What was done (AI-generated by Claude):**
- `src/history.ts`: each finished check with at least one blink is saved to `localStorage` in this browser only. It is never sent to the server, Gemini or the company. Each entry holds the time, blinks per minute, incomplete %, seconds measured, and whether it was demo mode or low light. The latest 20 are kept. Reads and writes are wrapped so blocked or full storage does not break the result screen. A check is marked "rough" if it ran under 2 minutes (`SHORT_SESSION_SEC`), was in demo mode, or was flagged low-light.
- `src/charts.tsx`: new `TrendChart`. It is an SVG line chart of the last 5 checks, oldest on the left, over the same two reference bands as the session chart, with date and time labels and the rounded rate above each point. Rough checks get a hollow dot and a legend line saying they are only a rough guide (PROJECT.md hard rule 3). It has a screen-reader label listing every point.
- `src/App.tsx`: a "Show trend" / "Hide trend" button next to "Measure again" on the result screen. It opens a card with the chart, or a message if fewer than 2 checks are saved, the note "Saved only in this browser on this device. Never sent to the server or your company.", and a "Clear my history" link.
- `src/index.css`: hollow-dot legend marker, chart width cap (600px), layout for the note and clear link.

**Scope note:** PROJECT.md currently says "no long-term tracking in this build". The user asked for this explicitly, and it is local-only, so it does not change what the server or the employer sees. PROJECT.md has not been edited. The team should agree whether it stays in the demo.

**Checked by the AI:** `npm run build` completes. `oxlint` shows no new warnings in the changed files. A temporary test switch (removed afterwards, and confirmed gone in the diff) opened the result screen with six invented history entries, one demo and one low-light. The trend card was rendered in headless Chrome at 1280px and 390px wide, and the AI looked at the screenshots. Only the last 5 were shown, the two rough checks had hollow dots, and the labels were readable at both widths. Not checked: saving after a real camera check, since there was no live face, and "Clear my history" was not clicked in the test.

### 2026-10-18: Measurement keeps running when the user switches to another tab (Chrome and Edge)
**Asked:** The timer stops when the user goes to a different website. Fix it.

**Files changed:** `src/useEyeTracker.ts`, `src/App.tsx`, `AI_DISCLOSURE.md`.

**Cause:** the frame loop ran on `requestAnimationFrame`, which browsers stop completely in hidden tabs. The camera itself keeps running, so the frames were there but nothing processed them.

**What changed (AI-generated by Claude):**
- `src/useEyeTracker.ts`: where the browser has `MediaStreamTrackProcessor` (Chrome, Edge), frames are read straight from the camera track and passed to FaceLandmarker as `VideoFrame`s. This is not tied to screen refreshes, so it keeps going in a hidden tab. Each frame is closed after use. If the model rejects the very first frame, it falls back to the old video-element loop, with a console warning, instead of showing an error. Other browsers (Firefox, Safari) still use the old loop and still pause when hidden. Brightness sampling and the eye-ratio maths now take the frame's own size, so they work for both sources. Stop and teardown cancel the frame reader. New snapshot field `background`. The "tab was hidden" banner now only shows in browsers that really pause.
- `src/App.tsx`: the "Measuring while you work" card says counting carries on in other tabs where that is true, and says to keep the window visible where it is not.

**Not changed:** PROJECT.md still says the window must stay visible. That is now only true for Firefox and Safari.

**Checked by the AI:** `npm run build` completes. The app was run in headless Chrome with Chrome's fake camera and a temporary frame counter (removed afterwards, and confirmed gone). With the page visible, 200 frames reached the model in 10 seconds. After a second tab was opened and focused, the page reported `visibilityState = hidden` and 200 frames still reached the model in 10 seconds, so there was no slowdown. The fake camera has no face, so blink counting and the measured-time clock were not seen advancing in a hidden tab. Not tested with a real webcam, in Edge, Firefox or Safari, on battery saver, or with the tab hidden for long periods (Chrome may treat long-hidden tabs differently).

### 2026-10-18: "Explain my trend": Gemini helps read the trend graph
**Asked:** Let Gemini help the user interpret the trend graph. Keep it short and make clear it is not medical advice.

**Files changed:** `server.js`, `src/summary.ts`, `src/App.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What was done (AI-generated by Claude):**
- `server.js`: the Gemini call (request, retries, error handling) moved out of `/api/summary` into a shared `askGemini` helper. `/api/summary` behaves as before. New `POST /api/trend` takes up to 5 checks: just each blink rate and whether it was a rough check. Dates and any other fields are ignored. The server works out the direction (went up, went down, about the same, from first to last) and where the latest check sits against the reference ranges. It passes these to Gemini as three plain sentences, so the model never sees field names. The instruction asks for 2 sentences under 35 words, no diagnosis, no conditions, no statistics, and no disclaimer of its own.
- Retry change: Gemini is no longer retried on 429 (rate limit). Google asks for a wait of about 25 seconds, and quick retries only used up more of the free tier. Retries on 403 and 5xx stay as Shahida wrote them.
- `src/summary.ts`: `fetchTrendSummary` sends only the rates and rough flags, with a template fallback that is labelled with the reason.
- `src/App.tsx`, `src/index.css`: an "Explain my trend" button under the trend chart, with the note "Sends only these N blink rates, without dates, to Gemini." Nothing is sent until it is pressed. The reply shows with a fixed app line, "Not medical advice. Eye pain or changes in your sight? See an optician.", plus "Written by Gemini…" or "Template text, not written by Gemini: reason". The history note changed from "Never sent to the server or your company" to "Never sent to your company", because the button can now send the rates to Gemini.

**Checked by the AI:** `npm run build` completes and oxlint shows no warnings in the changed files. With the user's real Gemini key, made-up trends were sent to the local server's `/api/trend`.
- The first prompt leaked field names ("your latestPosition…") and ran to about 50 words. After two rewrites, eight replies read correctly at 30 to 39 words, and the rough-check case said the trend was only a rough guide.
- A one-check request gives a 400.
- `/api/summary` still answers after the refactor.
- The rapid testing hit the free-tier limit (429, "15 requests per minute"), which led to the retry change above.
- With a temporary test switch (removed afterwards, and confirmed gone), the trend card was rendered in headless Chrome before and after pressing the button, at 1280px and 390px, and the screenshots were looked at: real Gemini text, the not-medical-advice box and the label all showed.
- Not checked: the template fallback in the browser, and the flow after a real camera check.

### 2026-10-18: Demo-mode blink reminder pop-up, with an off switch
**Asked:** In demo mode only, show a pop-up reminding the user to blink when their blink rate falls below the typical screen-use rate (5 to 7 a minute), with an option to turn it off.

**Files changed:** `src/blink.ts`, `src/useEyeTracker.ts`, `src/App.tsx`, `src/index.css`, `AI_DISCLOSURE.md`.

**What was done (AI-generated by Claude):**
- `src/blink.ts`: two settings, `DEMO_REMINDER_WINDOW_SEC = 20` (the live rate is worked out over the last 20 seconds of measured time) and `DEMO_REMINDER_SNOOZE_SEC = 30` (after "Got it", it stays quiet for 30 measured seconds). Both values were the AI's choice.
- `src/useEyeTracker.ts`: new snapshot field `liveRate`, blinks per minute over the last 20 measured seconds. It is null until 20 seconds have been measured. Time with no face in view is not counted, as with the main clock.
- `src/App.tsx`: a `BlinkReminder` pop-up appears only when demo mode is on, reminders are on, a measurement is running, and the live rate is below `SCREEN_RANGE.min` (5, from `reference.ts`). It shows the rate, the 5 to 7 range, "Try a few slow, full blinks.", a "Got it" button, a "Turn off reminders" link, and "Demo mode reminder. Not medical advice." A "Blink reminders (demo mode)" checkbox on the measuring card, on by default and shown only in demo mode, switches it on or off. The snooze resets on a new check or a recalibration.
- `src/index.css`: pop-up styles (rises in over 0.8s, no flashing, no animation under reduced motion), a lime "Got it" button on the dark card, and checkbox styles.

**Scope note:** PROJECT.md says "no break pop-ups" in this build. The user asked for this explicitly and it is limited to demo mode. PROJECT.md has not been edited.

**Checked by the AI:** `npm run build` completes, with no new lint warnings. A temporary test switch (removed afterwards, and confirmed gone) faked a live rate of 2 a minute in demo mode. In headless Chrome:
- the pop-up appeared, and the checkbox showed;
- "Got it" hid it;
- "Turn off reminders" hid it and unticked the checkbox, and re-ticking brought it back;
- the demo-mode button is disabled during a check.

Screenshots at 1280px and 390px were looked at. Not checked: the real live rate and the pop-up with a real face and camera, and the 30 second snooze running out. The pop-up only shows while the tab is visible; it is not a system notification.

### 2026-10-18: Demo-mode reminder agreed by the team
The user confirmed that the team (including Shahida) agreed the demo-mode blink reminder pop-up. So the scope note in the reminder entry above, which says PROJECT.md asks for no break pop-ups, is resolved by team agreement. PROJECT.md itself has not been edited yet. No code was changed.

### 2026-10-18: Disclosure summary brought up to date
**Asked:** Update AI_DISCLOSURE.md.

**Files changed:** `AI_DISCLOSURE.md` only. No code was changed.

**What was done (by Claude):** the summary sections at the top were updated to cover the work logged today:
- "Tools used while building" now names both Claude models used (Sonnet 5.5 and Opus 5.5).
- "AI inside the product" now covers the opt-in Gemini trend explanation (what it receives, that it gets no dates, and that the not-medical-advice line comes from the app) and the rule-based demo-mode reminder.
- "What AI wrote vs what we wrote" now lists the trend graph, local history, trend explanation, demo reminder and hidden-tab counting.
- "Honest notes" now covers the Gemini free-tier limit and the no-retry-on-429 change, where trend history is stored, which browsers keep counting in a hidden tab, and that the reminder settings are Claude's choices.

The log entries below were left as written, apart from this entry and the one above.
