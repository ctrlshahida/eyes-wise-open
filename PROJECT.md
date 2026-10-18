# Eyes Wise Open: project reference

Read this file at the start of every session. Build in the phases below. Stop after each phase and let me test.

## What it is

A browser-based eye-health check for people who work at screens. It measures blinking through the webcam, so companies can see how screen work affects their people and support them, without anyone seeing a video.

- Scope: one-time company eye-health check only. There is no continuous mode, no break pop-ups and no long-term tracking in this build.
- Tagline: "An eye health check that runs in the background while you work at a screen."
- Domain: eyeswiseopen.health
- Hackathon deadline: submission closes 2pm Sunday 18 Oct 2026. Feature freeze 9:30am. Submit by 1:30pm.

There is no DSE (workstation assessment) angle anywhere. Do not mention DSE in the UI, the summary or the docs.

## Hackathon context

Main track is the Wise hackathon, theme "Max Ease". Scoring:

- Friction removal and utility, 30%
- Technical and architectural execution, 30%
- Presentation and live demo, 30%
- AI usage and transparency, 10%

Sponsor tracks we are going for: incident.io (Adaptable Agents), Gemini, Vultr (hosting), GoDaddy (eligibility unconfirmed), ElevenLabs (optional) and Presage (optional, needs an API key and answers on privacy). The core check comes first. Sponsor features are built only after it works live. A stable live demo beats breadth.

## Hard rules

1. One clean flow that works live beats many half-working features.
2. Video never leaves the device and is never recorded. Show a persistent badge: "Video stays on this device." Only anonymous numbers go to the server or any API. The one exception is the optional Presage vitals step (Phase 5). It is opt-in, off by default, and the badge changes to say a short clip is sent for processing during that step.
3. Never fake a result silently. Sample data, cached values and fallbacks must be labelled in the UI.
4. Keep `AI_DISCLOSURE.md` updated. Add an entry whenever you generate a significant piece of code. This is 10% of the score.
5. No API keys in frontend code. Never use `VITE_` variables for secrets.
6. Not a medical device. Never diagnose. Any warning says: "Worth discussing with an optician."
7. Do not claim features that do not exist, and do not quote statistics without a source.
8. Keep it simple: few files, few dependencies, readable code.

## Stack

- React + Vite + TypeScript
- `@mediapipe/tasks-vision` FaceLandmarker, running in the browser
- Express `server.js` in the project root (ES modules). It serves `dist/` and holds the API routes.
- Host: Vultr VPS (Ubuntu), Caddy for HTTPS, pm2 to keep Node running
- Self-host anything that could fail on venue wifi: the MediaPipe WASM files and `face_landmarker.task` model in `public/`, and fonts via `@fontsource` packages.

## Design

Mobile first. Wise-style look: colours and type only. No Wise logo, wordmark or name anywhere.

- Page background: bright lime, about `#A0E870`
- Text and primary elements: deep forest green, about `#163300`
- Dark card: about `#202020`. Pale aqua card: about `#A0E1E1`
- Headlines: huge, uppercase, ultra-bold condensed, line-height 0.9, tight tracking. Wise's own font is proprietary, so use Anton (`@fontsource/anton`) unless font files are supplied. If they are, put them in `public/fonts/`.
- Body: Inter
- Buttons: fully rounded pills. Primary is forest green with lime text. Secondary is pale translucent lime with dark text.
- Cards: radius about 32px, three variants. Light accent heading, short body, underlined link style.
- Top bar: the animated logo (`public/logo/logo-horizontal.svg`) on the left, one button on the right (Demo mode).
- Calm motion only. Nothing flashes.

## Phase 1: blink engine

1. Start screen with the headline and a camera permission button.
2. 10 second calibration. Record the median open-eye EAR as the user's baseline. Thresholds are relative to the baseline, never fixed. Add a Recalibrate button for glasses on or off.
3. Blink detection from eye aspect ratio.
   - EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
   - Right eye landmarks: 33, 160, 158, 133, 153, 144
   - Left eye landmarks: 362, 385, 387, 263, 373, 380
   - Average both eyes.
   - Complete blink: EAR drops below about 60% of baseline, then recovers.
   - Incomplete blink: EAR dips below about 80% of baseline but never reaches the closed threshold, then recovers within about 400ms.
   - Debounce so one blink counts once. Tune the percentages by testing.
   - If EAR is noisy, cross-check with the `eyeBlinkLeft` and `eyeBlinkRight` blendshapes.
4. Blink counts over a fixed measurement window: total blinks, complete, incomplete, blinks per minute.
5. Visible error states: camera denied, no face for 3 seconds, low light (check mean frame brightness), model failed to load.
6. DEMO MODE toggle that shortens the measurement window so the whole flow runs quickly on stage.

Remove or switch off anything built for continuous use: the dimming vignette, break pop-ups, screen-time timers and session history. The engine should expose a simple "measure for N seconds and return the result" function.

## Phase 2: company check

A short, fixed-length assessment with one result.

**Flow**
1. Employee opens the link and sees what is measured, what is shared, and that taking part is optional.
2. Consent step, then camera, then the 10 second calibration.
3. A single measurement that runs in the background while the employee does their normal work (a 9-5 style session) and ends when they press Finish, so the result reflects real screen use. There is an 8 hour safety cap (`MEASURE_SEC` in `src/blink.ts`). The window must stay visible beside their work, because browsers stop sending camera frames to hidden or fully covered tabs. Finish is allowed after 30 seconds of measuring, and after 10 seconds in demo mode.
4. Result card for the employee, shown first and kept private to them: blink rate, percentage of incomplete blinks, which band they fall in (low, typical, high), a simple comparison chart, a short Gemini-written summary of what the pattern may mean for eye comfort if it continues (three anonymous numbers sent, template fallback labelled), and one plain suggestion. If low, show: "Worth discussing with an optician."
5. Comparison chart: one horizontal bar showing the person's blink rate against two reference bands, a typical relaxed range and a typical screen-use range. Keep the reference numbers in one config file with a source comment each. Verify and cite them before the demo.
6. Optional step: "Share my anonymous result with my company." Off by default.

**Privacy and honesty**
- Opt-in, always. No covert testing.
- Companies announce an assessment window (for example one week). The prompt appears at a random moment within that window and employees are told this upfront. They can decline.
- No names or accounts. The submitted record is only: org code, timestamp, blink rate, incomplete percentage, band.
- The employer never sees an individual result.
- The employer view only shows data once at least 5 people have shared. Below that it says "Not enough responses yet."

**Server**
- `POST /api/assessment` stores one anonymous record in a simple JSON file on the server.
- `GET /api/aggregate?org=CODE` returns aggregates only, and only if count is 5 or more.

**Employer view (aggregates only)**
- People assessed
- Average blink rate shown on the same reference bands as the employee chart
- Percentage of incomplete blinks
- Share of people in the low band
- One recommended action
- A short "what this could mean" panel for scaling up: reduced eye strain and headaches, fewer unproductive hours. Use clearly labelled assumptions the viewer can change. Do not state productivity figures without a source.

For the demo, seed a sample cohort so the view has data. Label it "Sample data" in the UI. Real results from the live demo can add to it.

## Phase 3: polish

1. **Gemini summary.** `POST /api/summary` takes aggregates only and returns one short sentence (about 60 words maximum). The numbers are shown by our own code, not written by Gemini. Company fields: people assessed, average blink rate vs typical, percentage incomplete, share in the low band, one recommended action. Use a current Gemini Flash model (check the docs for the exact name). Log API errors on the server. If it fails, use a template string and label it.
2. **Branding pass** across all screens, as in the Design section.
3. **ElevenLabs** (optional): `POST /api/speak` takes text and returns audio, used to read the instructions and the result aloud. Fall back to browser `speechSynthesis` and label it. Voice on/off toggle, framed as accessibility.

## Phase 4: adaptable agent (incident.io)

The track wants an agent that adapts when new stream data arrives, priorities change, or assumptions are corrected. It must abandon old conclusions, weigh conflicting sources, and change course without analysis paralysis.

Build two small rule-based agents in plain TypeScript. No LLM in the loop. Each one shows a current conclusion with a confidence percentage, evidence for and against, and a "changed my mind" line that gives the reason. Each always has a current best call and acts on it. Neither waits for more data.

**A) Measurement agent (during the check)**
Inputs arrive as a stream: blink events, frame brightness, face presence, calibration state, and user corrections.
- Low light lowers confidence in the reading and says so.
- Face lost for more than 3 seconds excludes that segment from the reading.
- Recalibration (glasses on or off) discards the earlier blinks, restarts with the new baseline, and says why.
- A user correction ("I wasn't reading, I was on a call") downweights the reading.
- If confidence ends up low, the result card suggests measuring again instead of reporting a band as fact.

**B) Cohort agent (employer view)**
Input: anonymous responses arriving over the assessment window.
- Under 5 responses: "Not enough responses yet."
- From 5 up, it states a conclusion about the team and updates it as responses arrive, showing what changed.
- The employer can change priority (headaches, productivity, cost) and the recommended action changes with it.
- A correction, such as removing the sample data or marking that many roles are not screen-based, triggers a recompute with a visible reason.
- Demo move: add a few new responses live and watch the conclusion change.

## Phase 5: Presage vitals (optional)

Do this only when I say so, and only if we have a Presage API key. Their Physiology API takes an uploaded video file, processes it asynchronously, and returns heart rate and breathing rate. Subject motion and talking hurt accuracy.

- After consent, an optional step: "Add a vitals reading." Record a 30 second still clip in the browser.
- The server sends it to Presage (`POST /api/vitals`) and the result card shows pulse and breathing rate when it comes back. Do not block the rest of the flow while waiting.
- Use it as a second source for the measurement agent. For example, blink rate looks low but breathing and pulse look calm, so the agent lowers its confidence in a strain conclusion and says so.
- Employers only ever see anonymous aggregates of these values.
- This is not on-device. Label it clearly. Confirm Presage's retention policy with their rep before using it.
- If it fails or is slow, show that honestly. Never display a cached or invented result as live.

## Server

Environment variables, set on the server only in `/opt/app/.env`, never committed:

- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY` (only if used)
- `PRESAGE_API_KEY` (only if used)

Routes: `/api/health`, `/api/assessment`, `/api/aggregate`, `/api/summary`, `/api/speak`, `/api/vitals`. Everything else serves `dist/`.

## Deploy

Server: Vultr VPS, IP `209.250.226.234`. Caddy proxies `eyeswiseopen.health` to `localhost:3000`. HTTPS is required because browsers block the webcam on plain HTTP.

Update after changes:

```
cd /opt/app && git pull && npm install && npm run build && pm2 restart app
```

Edit files on the laptop, not on the server.

## Demo script (about 90 seconds)

1. Open with the problem: "Companies have no idea how screen work is affecting their people's eyes. Eyes Wise Open finds out in two minutes, and nobody ever sees a video."
2. Live: run the check in demo mode. Show the employee result card and the comparison chart.
3. Share the anonymous result, then show the employer view with aggregates and the "Sample data" label.
4. Show the agent changing its mind: recalibrate or dim the light during a check and watch the confidence and reason update. In the employer view, add a few responses live and watch the conclusion shift.
5. Say it out loud: video stays on this device, employers only see anonymous aggregates, and it is not a medical device.
6. Close with one line on what comes next: the same engine for individuals who want to track over time. Do not demo it.

Keep a backup screen recording. Test in the actual room's lighting and with glasses on and off.

## If we run out of time, cut in this order

1. Presage
2. ElevenLabs
3. Measurement agent (keep the cohort agent, since it is the bigger moment in the demo)
4. Gemini sentence (keep the template text)
5. Comparison chart becomes text only
6. Editable assumptions in the "what this could mean" panel

Never cut the check flow, the privacy behaviour, or the backup video.

## Pitch and Q&A notes

- Blink figures: relaxed blinking is about 15 to 20 per minute, and the American Academy of Ophthalmology quotes 5 to 7 during screen use ("Computers, Digital Devices, and Eye Strain", aao.org, 2024). Controlled studies vary: about 17 at rest (Bentivoglio 1997, n=150), about 10 on a computer against 20 looking at a distant target (Talens-Estarelles 2021), and about 15 reading on a computer (Chu, Rosenfield and Portello 2014). Full citations are in `src/reference.ts`. Say "published ranges vary" if asked.
- Accuracy: per-user calibration, and we would validate against a clinical measure next.
- Privacy: on-device processing, anonymous records, employer sees aggregates only with a minimum group size. Expect GDPR questions, since this is health-adjacent workplace data. The answer is opt-in, no identifiers, no individual reporting.
- Announced window: people behave differently when they know they are being measured. Telling employees a check will happen at a random moment within an announced window keeps it honest and reduces that effect.
- If Presage is used: only the optional vitals step sends a short clip off the device, with consent, and the rest of the check stays on-device. Say exactly that.
- Not a medical device. We do not diagnose. A low reading is a prompt to see an optician.