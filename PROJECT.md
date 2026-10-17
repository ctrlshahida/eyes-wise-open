# Eyes Wise Open: project reference

Read this file at the start of every session. Build in the phases below. Stop after each phase and let me test.

## What it is

A browser-based eye-strain coach. It tracks blinking through the webcam and tells people when to take a break, so employer DSE (screen-break) policies enforce themselves with no forms.

- Tagline: "DSE compliance with zero forms."
- One-liner: a break reminder that watches your eyes instead of a timer.
- Domain: eyeswiseopen.health
- Hackathon deadline: submission closes 2pm Sunday 18 Oct 2026. Feature freeze 9:30am. Submit by 1:30pm.

## Hackathon context

Main track is the Wise hackathon, theme "Max Ease". Scoring:

- Friction removal and utility, 30%
- Technical and architectural execution, 30%
- Presentation and live demo, 30%
- AI usage and transparency, 10%

Sponsor tracks, in priority order: incident.io (Adaptable Agents), Gemini, Vultr (hosting), GoDaddy (domain, eligibility unconfirmed), ElevenLabs (voice), Presage (optional, unconfirmed). A stable live demo beats breadth.

## Hard rules

1. One clean loop that works live beats many half-working features.
2. Video never leaves the device and is never recorded. Show a persistent badge: "Video stays on this device." It sits in a sage box next to the main button (start screen, error screen, and the controls row at the top of the dashboard). Only aggregate numbers go to any API.
3. Never fake a result silently. If a fallback or cached value is used, label it in the UI.
4. Keep `AI_DISCLOSURE.md` updated. Add an entry whenever you generate a significant piece of code. This is 10% of the score.
5. No API keys in frontend code. Never use `VITE_` variables for secrets.
6. No posture tracking or screen distance in the first build. Do not claim features that do not exist.
7. Not a medical device. It prompts breaks.
8. Keep it simple: few files, few dependencies, readable code.

## Stack

- React + Vite + TypeScript
- `@mediapipe/tasks-vision` FaceLandmarker, running in the browser
- Express `server.js` in the project root. It serves `dist/` and holds the API routes.
- Host: Vultr VPS (Ubuntu), Caddy for HTTPS, pm2 to keep Node running
- Self-host everything that could fail on venue wifi: put the MediaPipe WASM files and `face_landmarker.task` model in `public/`, and use `@fontsource/anton` and `@fontsource/oswald` for fonts.

## Design

Mobile first. Bold fintech look, inspired by the Wise site. No logos, no Wise name, no proprietary fonts.

- Page background: cream, `#FBF6EA`. Soft green `#B6DBA0` is the secondary colour (replaces the bright lime)
- Text and primary elements: deep forest green, about `#163300`
- Charcoal `#202020` for large headline text. Sage `#C5D5B9` box colour. Dark red `#7F1D2A` for the medical-disclaimer box
- Headlines: Anton, huge, uppercase, line-height 0.9, tight tracking
- Body: Oswald, a condensed gothic that matches Anton. Buttons are uppercase Oswald.
- Buttons: rectangular, square corners. Primary is forest green with soft green text. Secondary is pale soft green (`#DCEBCF`) with dark text.
- Cards: square corners. Sage green `#C5D5B9` for most boxes, dark red `#7F1D2A` with cream text for the "Not a medical device" card so it stands out. Charcoal headings and dark body text on the sage boxes.
- Top bar: the animated logo on the left (`public/logo/logo-horizontal.svg`), nothing else. No footer. Logo files: horizontal, stacked and eye-only mark in `public/logo/`; the "O" of OPEN is an eye that glances and blinks.
- Calm motion only. The vignette fades in smoothly and never flashes.

## Phase 1: core loop

1. Start screen. Headline "DSE COMPLIANCE WITH ZERO FORMS." and a camera permission button.
2. 10 second calibration. Record the median open-eye EAR as the user's baseline. Thresholds are relative to the baseline, never fixed. Add a Recalibrate button for glasses on or off.
3. Blink detection from eye aspect ratio.
   - EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
   - Right eye landmarks: 33, 160, 158, 133, 153, 144
   - Left eye landmarks: 362, 385, 387, 263, 373, 380
   - Average both eyes.
   - Complete blink: EAR drops below about 60% of baseline, then recovers.
   - Incomplete blink: EAR dips below about 80% of baseline but never reaches the closed threshold, then recovers within about 400ms.
   - Debounce so one blink counts once. Tune the percentages by testing.
   - If EAR is noisy, cross-check with the `eyeBlinkLeft` and `eyeBlinkRight` blendshapes from FaceLandmarker.
4. Rolling 60 second blink rate, plus complete and incomplete counts.
5. Under-blinking (default below 8 per minute) fades in a dimming vignette.
6. Break nudge when low blink rate combines with continuous screen time.
7. DEMO MODE toggle. It compresses the windows (20 second rate window, nudge after about 40 seconds) so everything fires live on stage.
8. Visible error states: camera denied, no face for 3 seconds, low light (check mean frame brightness), model failed to load.

## Phase 2: belief panel (incident.io Adaptable Agents)

The track wants an agent that adapts when new stream data arrives, priorities change, or assumptions are corrected. It must abandon old conclusions, weigh conflicting sources, and change course without analysis paralysis.

Build a rule-based agent as a plain TypeScript state object. No LLM in the loop. Show it beside the camera preview:

- Current hypothesis with a confidence percentage, for example "Under-blinking, 80%". Hypotheses: fatigued, fine, bad lighting (data unreliable), in a call.
- Evidence for and against, as a short list.
- A "changed my mind" line saying what was dropped and why.

Inputs: blink rate, incomplete ratio, continuous screen time, frame brightness, "I was fine" button, Call mode toggle, recalibration.

Behaviours, each logged with a reason:

- "I was fine" drops the fatigue conclusion and relaxes the threshold.
- Call mode defers the nudge and shows "Break queued for after your call."
- Recalibration or low light lowers confidence in the blink data and says so.
- Conflicting signals are weighed, not overridden.
- The agent always has a current best call and acts on it. It never waits for more data.

## Phase 3: sponsor features

Add these only after Phases 1 and 2 work on the live URL.

**ElevenLabs (voice and audio AI).** `POST /api/speak` takes text and returns audio. Pre-generate the fixed nudge lines at load so playback is instant. If the API fails, fall back to browser `speechSynthesis` and label it. Add a voice on/off toggle. Frame it as accessibility.

**Gemini.** `POST /api/summary` takes aggregates only (blink rate, incomplete percentage, screen time, breaks taken, number of belief changes) and returns a short plain-English DSE summary. It can also write the one-sentence reason in the belief panel. If it fails, use a template string and label it. Use a current Gemini Flash model and check the docs for the exact name.

**Summary screen.** A DSE-style report with the numbers, the Gemini text, a mock "employer sees anonymised aggregates only" view, and a note that this is a prompt to take breaks, not a medical device.

**Presage (optional, unconfirmed).** Keep a feature-flagged stub for a "break recovery check". Record a 20 to 30 second still clip, send it through the server to Presage's API, and show pulse and breathing rate in the belief panel. Opt-in only, since this clip leaves the device. Do not build this unless I say so.

## Server

Environment variables, set on the server only in `/opt/app/.env`, never committed:

- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `PRESAGE_API_KEY` (only if used)

Routes: `/api/health`, `/api/speak`, `/api/summary`. Everything else serves `dist/`.

## Deploy

Server: Vultr VPS, IP `209.250.226.234`. Caddy proxies `eyeswiseopen.health` to `localhost:3000`. HTTPS is required because browsers block the webcam on plain HTTP.

Update after changes:

```
cd /opt/app && git pull && npm install && npm run build && pm2 restart app
```

Edit files on the laptop, not on the server.

## Demo script (about 90 seconds)

1. Open with the pain: "Every company has a screen-break policy and nobody follows it. Eyes Wise Open follows it for you."
2. Calibrate. Stare at the screen on purpose. Watch the rate drop, the vignette appear, the break nudge fire.
3. Flip 1: tap "I was fine". The agent drops its conclusion and says why.
4. Flip 2: switch to Call mode. The agent defers the nudge and queues a break.
5. End the session and show the summary.
6. Say it out loud: video stays on this device, the employer sees anonymised aggregates only.

Keep a backup screen recording. Test in the actual room's lighting and with glasses on and off.

## If we run out of time, cut in this order

1. Presage
2. Screen distance
3. ElevenLabs (keep the browser speech fallback)
4. Gemini (keep the template summary)

Never cut the blink loop, the belief panel, or the backup video.

## Pitch and Q&A notes

- Healthy blink rate is often quoted around 15 to 20 per minute, dropping to roughly 5 to 7 on screens. Published ranges vary, so cite a source before claiming it.
- Accuracy: per-user calibration, and we would validate against a clinical measure next.
- Privacy: on-device processing, employer sees aggregates only.
- A webcam cannot assess chair, desk or wrists. This covers the eye-behaviour part of DSE and flags that a full assessment still needs a person.