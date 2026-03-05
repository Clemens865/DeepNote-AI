# Image Slide Pipeline Simulation

**Source material:** `WiFi_CSI_Distance_Tracking_Whitepaper.md`
**Config:** 10 slides, format=presentation, renderMode=full-image, style=neon-circuit

This document traces the complete prompt pipeline for a 10-slide image deck, showing:
1. The **planning prompt** sent to Gemini (text generation)
2. The **simulated AI output** (content plan JSON)
3. The **image prompt** built for each slide (sent to Imagen)

Use this to review whether slides are self-explanatory and if the prompt rules produce the right balance.

---

## Stage 1: Planning Prompt (Gemini)

This is the full prompt sent to `planImageSlides()`:

```
You are a visual presentation designer planning a 10-slide deck. Every slide is
generated as a single AI image — the text is PART OF the image, not a separate overlay.

SOURCE MATERIAL:
[...full whitepaper content, truncated to 80k chars...]

FORMAT: Presentation — educational/informational deck. Each slide should be
self-contained and understandable without a presenter. Start with a title slide,
end with key takeaways. Flow: introduce topic → explain concepts → summarize.

CRITICAL RULES:
1.  **Slide Count**: You MUST output EXACTLY 10 slides.
2.  **VISUAL-FIRST PHILOSOPHY**: Each slide is a cinematic image where text is woven
    into the visual composition. Think of it like a movie poster, editorial magazine
    spread, or infographic — the typography is part of the art, not a layer on top.
    The image model generates the entire slide as one image including any text.
3.  **Text in the content field**: This text will be rendered BY THE IMAGE MODEL as
    part of the image. Keep it extremely concise — the image model struggles with
    too much text.
    - A short TITLE (2-5 words) on the first line.
    - Then at most 2-3 short keyword phrases or single-line points. Only include
      these if they genuinely add value — a powerful image with just a title is
      better than a cluttered slide.
    - STRICT LIMIT: max 150 characters total, max 3 lines. Use \n for line breaks.
    - Prefer punchy keywords, numbers, or short phrases over full sentences.
    - Example: "How Models Learn\n\nLabeled Data → Pattern Recognition\nError
      Measurement → Weight Adjustment"
    - Example (minimal): "The Attention Mechanism"
    - Example (with data): "Market Growth\n\n$4.2B → $18.7B by 2028\n42% CAGR"
4.  **Visual Cue (MOST IMPORTANT)**: For each slide, write a RICH, SPECIFIC visual
    description in visualCue. Describe scene, metaphors, composition, mood, lighting,
    colors. This drives the entire image. The visualCue should describe how the text
    integrates into the scene — e.g. text emerging from surfaces, floating in the
    environment, etched into materials, displayed on screens within the scene.
5.  **Content as part of the visual**: When writing the visualCue, describe how the
    title/keywords should be visually integrated — carved into stone, floating as
    holographic text, written on a whiteboard in the scene, appearing as signage,
    displayed on screens, etc. The text should feel like it belongs in the world of
    the image.

SLIDE 1 REQUIREMENT: A "Title" layout — dramatic, atmospheric opener. Short punchy
title + optional subtitle. The visualCue should describe a cinematic scene with the
title naturally integrated into the imagery.

SLIDE 10 REQUIREMENT: A "Closing" layout — strong finish. Memorable closing statement
or call to action. The visualCue should describe an uplifting or thought-provoking scene.

Output a JSON array with EXACTLY 10 objects (ONLY valid JSON, no markdown fences).

[... examples omitted for brevity, same as in code ...]

Output the full array with EXACTLY 10 slides:
```

---

## Stage 2: Simulated AI Output (Content Plan)

Below is a realistic simulation of what Gemini would return. This is what we need to review for **self-explanatory quality**.

```json
[
  {
    "slideNumber": 1,
    "layout": "Title",
    "title": "WiFi Distance Tracking",
    "bullets": ["A Low-Cost Alternative for Cinema"],
    "visualCue": "A dark cinematic film set with dramatic rim lighting — camera dolly rails receding into the distance, with glowing WiFi signal waves radiating between small ESP32 nodes mounted on C-stands. The title 'WiFi Distance Tracking' appears as massive luminous holographic text floating above the set, with 'A Low-Cost Alternative for Cinema' as a subtle glowing subtitle beneath. Neon cyan and purple tones. Atmosphere of high-tech innovation meeting traditional filmmaking.",
    "content": "WiFi Distance Tracking\nA Low-Cost Alternative for Cinema",
    "speakerNotes": "This presentation explores how commodity WiFi hardware can provide real-time distance tracking for cinematography at a fraction of the cost of professional systems."
  },
  {
    "slideNumber": 2,
    "layout": "Content",
    "title": "The Problem",
    "bullets": ["Cinetape: $3,000–8,000", "Optical tracking: $10,000–100,000+", "Most productions can't afford spatial awareness"],
    "visualCue": "A dramatic split composition — on the left, a luxurious golden price tag showing '$3,000–$100,000' with premium cinema equipment (Cinetape, Vicon cameras) arranged like museum pieces behind velvet ropes with spotlights. On the right, a shadowed indie film crew working with basic tape measures and guesswork in dim lighting. The title 'The Problem' appears carved into a stone dividing wall between the two worlds. Text elements float as price labels next to equipment.",
    "content": "The Problem\n\nCinetape: $3K–$8K per unit\nOptical tracking: $10K–$100K+",
    "speakerNotes": "Professional distance measurement tools are prohibitively expensive. A single Cinetape costs $3,000–8,000. Optical tracking systems start at $10,000 and can exceed $100,000. This locks out independent and mid-budget productions."
  },
  {
    "slideNumber": 3,
    "layout": "Content",
    "title": "WiFi CSI Explained",
    "bullets": ["52 independent measurements per packet", "Amplitude + phase per subcarrier", "Sub-centimeter motion detectable"],
    "visualCue": "A futuristic visualization of WiFi signal anatomy — a glowing OFDM waveform stretching across the frame, decomposed into 52 individual subcarrier columns of varying height and color, each pulsing with data. Phase spirals rotate within each column. A person's silhouette crosses through the signal, creating visible ripples and phase distortions in the subcarriers. The title 'WiFi CSI Explained' appears as glowing terminal-style text on a transparent HUD overlay. Key stats '52 measurements' and 'amplitude + phase' float as holographic annotations.",
    "content": "WiFi CSI Explained\n\n52 measurements per packet\nAmplitude + Phase = Distance",
    "speakerNotes": "Channel State Information captures 52 independent amplitude and phase measurements per WiFi packet. Unlike RSSI which gives one number, CSI provides rich spatial data that can detect sub-centimeter movements."
  },
  {
    "slideNumber": 4,
    "layout": "Content",
    "title": "How Ranging Works",
    "bullets": ["Fresnel zone perturbation", "Phase shift ∝ distance", "30mm = full phase rotation at 5GHz"],
    "visualCue": "An elegant physics diagram rendered as a 3D cinematic scene — two glowing WiFi nodes (TX and RX) connected by a luminous ellipsoidal Fresnel zone rendered as a translucent energy field. A human figure steps into the zone, causing visible concentric ripple distortions in the field. Phase rotation spirals emanate from the disturbance point. The title 'How Ranging Works' appears etched into a dark metallic panel at the top. The equation 'Δφ = 2π × 2d / λ' glows as a floating holographic formula in the scene.",
    "content": "How Ranging Works\n\nPhase shift reveals distance\n30mm = full 2π rotation at 5GHz",
    "speakerNotes": "When a person enters the Fresnel zone between transmitter and receiver, they cause measurable phase shifts. At 5GHz, just 30mm of movement causes a complete phase rotation — making centimeter-level tracking possible."
  },
  {
    "slideNumber": 5,
    "layout": "Content",
    "title": "System Architecture",
    "bullets": ["3–4 ESP32-S3 nodes ($5–15 each)", "Raspberry Pi aggregator", "Total cost: ~$155"],
    "visualCue": "A top-down blueprint-style view of a film studio with a clean dark background. Four small glowing ESP32 nodes are positioned at corners, connected by pulsing cyan signal lines forming a tracking grid. A central Raspberry Pi hub pulses with processed data. A tracked actor silhouette moves through the grid leaving a glowing trail. The title 'System Architecture' appears as clean architectural blueprint text at the top. Component labels float next to each node: 'ESP32-S3 — $8' and 'Total: $155' appears as a prominent price badge.",
    "content": "System Architecture\n\n3–4 ESP32 nodes + Pi hub\nTotal hardware: ~$155",
    "speakerNotes": "The system uses 3–4 ESP32-S3 modules as transmitters and receivers, plus a Raspberry Pi as the processing aggregator. Total hardware cost is approximately $155 — a 20–50x reduction versus professional systems."
  },
  {
    "slideNumber": 6,
    "layout": "Content",
    "title": "Precision Envelope",
    "bullets": ["±5–10 cm at 1–8m range", "50 Hz update rate", "4th node adds 20–30% improvement"],
    "visualCue": "A precision target/bullseye visualization — concentric rings expanding outward from a central point, each ring labeled with a range bracket and precision value. The innermost ring glows green (±3–5cm at 0.5–1m), middle rings glow cyan (±5–10cm at 1–8m, labeled 'SWEET SPOT'), outer rings fade to amber (±15–25cm at 8–12m). A data readout panel on the side shows '50 Hz' update rate. The title 'Precision Envelope' appears as bold tech-display text at the top. The sweet spot zone is highlighted with a pulsing glow.",
    "content": "Precision Envelope\n\n±5–10 cm at 1–8m range\n50Hz updates · Sweet spot",
    "speakerNotes": "The system achieves ±5–10cm precision within its 1–8 meter sweet spot at 50Hz update rates. A 4th node improves precision by 20–30%. Beyond 8 meters, precision degrades significantly."
  },
  {
    "slideNumber": 7,
    "layout": "Content",
    "title": "Use Cases on Set",
    "bullets": ["Dolly/crane tracking", "Virtual production", "Through-wall monitoring", "Automated lighting zones"],
    "visualCue": "A cinematic four-quadrant split showing real film set scenarios — top-left: a dolly on tracks with glowing position markers; top-right: an LED volume stage with perspective grid lines correcting in real-time; bottom-left: WiFi signals passing through a set wall to track an actor behind it (X-ray style); bottom-right: lighting rigs activating as an actor walks through invisible trigger zones shown as glowing floor regions. The title 'Use Cases on Set' appears as a central medallion text where the four quadrants meet. Each quadrant has a small label.",
    "content": "Use Cases on Set\n\nDolly · Virtual Production\nThrough-Wall · Lighting Zones",
    "speakerNotes": "Key applications include dolly/crane position tracking, LED wall perspective correction for virtual production, monitoring actors through set walls, and creating invisible lighting trigger zones — all without markers."
  },
  {
    "slideNumber": 8,
    "layout": "Content",
    "title": "Cost Comparison",
    "bullets": ["WiFi CSI: $155", "Cinetape: $3,000–8,000", "Optical: $10,000–100,000+"],
    "visualCue": "A dramatic bar chart rendered as a 3D cityscape — three building-like bars of vastly different heights rising from a dark surface. The smallest bar ($155, WiFi CSI) glows with neon cyan and is labeled clearly. The medium bar ($3K–$8K, Cinetape) towers above in amber. The tallest bar ($10K–$100K+, Optical) reaches into clouds in deep red. A bold '20–50×' cost reduction callout floats between the WiFi and Cinetape bars with an arrow. The title 'Cost Comparison' appears as clean display text at the top. The contrast should make the cost difference viscerally obvious.",
    "content": "Cost Comparison\n\n$155 vs $3,000–$100,000+\n20–50× cheaper",
    "speakerNotes": "The WiFi CSI system costs $155 in total hardware — a 20–50x reduction compared to a single Cinetape unit and orders of magnitude less than optical tracking systems like Vicon."
  },
  {
    "slideNumber": 9,
    "layout": "Content",
    "title": "Limitations",
    "bullets": ["±5–10cm, not ±3mm", "Not for critical focus at T/1.4", "Needs calibration every 2–4 hours"],
    "visualCue": "An honest, balanced composition — a split scene where a shallow depth-of-field camera shot (beautifully blurred bokeh) is shown with a red X mark and 'NOT for T/1.4 focus' label, while a dolly tracking shot and LED wall stage are shown with green checkmarks. A precision scale at the bottom visually compares ±3mm (ultrasonic) vs ±5–10cm (WiFi CSI) with honest scaling. The title 'Limitations' appears as straightforward white text on a dark panel. The mood is honest and informative, not negative — acknowledging trade-offs.",
    "content": "Honest Limitations\n\n±5–10cm ≠ ±3mm precision\nNot for shallow DOF focus",
    "speakerNotes": "WiFi CSI cannot replace ultrasonic rangefinders for critical focus pulling at wide apertures. It's also affected by multipath in reflective environments and needs recalibration every 2–4 hours. Use it where ±10cm is good enough."
  },
  {
    "slideNumber": 10,
    "layout": "Closing",
    "title": "Democratizing Spatial Tracking",
    "bullets": ["$155 brings distance tracking to every set", "Build a prototype today"],
    "visualCue": "A triumphant wide shot of a bustling independent film set bathed in warm golden hour light — crew members working around a camera, with small glowing ESP32 nodes visible on C-stands around the perimeter, cyan data streams flowing between them forming a protective web over the set. The title 'Democratizing Spatial Tracking' appears as bold, luminous text in the sky above the set, like a sunrise reveal. A subtle '$155' price badge glows in the corner. The mood is hopeful, accessible, and forward-looking — technology serving art.",
    "content": "Democratizing Spatial Tracking\n\n$155 · Every set · No markers",
    "speakerNotes": "WiFi CSI tracking won't replace Cinetape for critical focus, but at $155 it brings spatial awareness to every production. The hardware is cheap, the physics are proven — build a prototype and start experimenting."
  }
]
```

---

## Stage 3: Image Prompt (per slide)

For each slide above, `buildSlidePrompt()` combines the content plan with the style description. Here's the full prompt for **Slide 5** as an example:

**Style description (neon-circuit preset):**
```
with a deep dark background (#0a0a14), electric purple and neon cyan glowing accent
colors, thin luminous circuit board traces connecting glowing nodes, subtle hexagonal
grid pattern, holographic data visualizations, and a futuristic cyberpunk tech aesthetic.
Typography is clean geometric sans-serif. All slides share this exact same deep dark
background and purple-cyan neon glow consistently
```

**Full image prompt sent to Imagen:**
```
Generate a single CINEMATIC presentation slide image where the visual and text form
one unified composition — like a movie poster, editorial spread, or infographic.

VISUAL STYLE (follow precisely): with a deep dark background (#0a0a14), electric
purple and neon cyan glowing accent colors, thin luminous circuit board traces
connecting glowing nodes, subtle hexagonal grid pattern, holographic data
visualizations, and a futuristic cyberpunk tech aesthetic. Typography is clean
geometric sans-serif. All slides share this exact same deep dark background and
purple-cyan neon glow consistently.

COMPOSITION: The image MUST fill the entire 16:9 frame edge-to-edge with NO empty
space, NO borders, NO margins, NO letterboxing. Full-bleed artwork that extends to
every edge.

SCENE AND COMPOSITION:
A top-down blueprint-style view of a film studio with a clean dark background. Four
small glowing ESP32 nodes are positioned at corners, connected by pulsing cyan signal
lines forming a tracking grid. A central Raspberry Pi hub pulses with processed data.
A tracked actor silhouette moves through the grid leaving a glowing trail. The title
'System Architecture' appears as clean architectural blueprint text at the top.
Component labels float next to each node: 'ESP32-S3 — $8' and 'Total: $155' appears
as a prominent price badge.

INTEGRATED TEXT — render the following text as part of the image composition. The text
should feel like it belongs in the scene — as stylized display typography, integrated
into the environment, or as bold graphic text that is part of the visual design. NOT
a floating overlay — part of the art.

TEXT TO INTEGRATE:
System Architecture

3–4 ESP32 nodes + Pi hub
Total hardware: ~$155
```

---

## Observations & Issues to Discuss

### What works well
- **Visual cues are rich** — they describe specific, cinematic scenes with clear mood/lighting
- **Text is integrated into the visual description** — not just floating
- **Content is concise** — within the 150-char limit
- **Speaker notes expand** on what the slide only hints at

### Potential problems with self-explanatory slides

1. **Content field is TOO minimal for standalone understanding.** The constraint says max 150 chars / 3 lines, but that means slides like #3 show `"WiFi CSI Explained\n\n52 measurements per packet\nAmplitude + Phase = Distance"` — a viewer unfamiliar with CSI will see text but not grasp what it means. The visual cue describes an elaborate scene but the image model may or may not render the holographic annotations correctly.

2. **Image models are unreliable with text rendering.** Even with the "INTEGRATED TEXT" instruction, Imagen often renders text garbled, misspelled, or partially missing. So the carefully crafted content may come out as `"Systm Archtecure"` or similar. This means **the visual itself must tell the story even if text fails**.

3. **No explicit "key takeaway" guidance per slide.** The prompt says "self-contained and understandable without a presenter" but doesn't enforce a structure like: *"Each slide must answer ONE clear question that a viewer can understand from the visual alone."*

4. **Bullets in JSON aren't rendered anywhere (full-image mode).** The `bullets` array is stored for metadata/notes but not rendered in the image — only `content` goes to the image model. So the bullets exist in speaker notes context but the viewer never sees them unless in hybrid mode.

5. **Visual cue describes text placement, but the image model doesn't reliably follow layout instructions.** Phrases like "appears as a central medallion text where the four quadrants meet" are aspirational — the model will approximate.

### Possible improvements to explore

| Area | Current | Suggestion |
|------|---------|------------|
| **Content length** | Max 150 chars, 3 lines | Consider allowing 200 chars / 4 lines for data-heavy slides (cost comparisons, precision tables) |
| **Self-explanation prompt** | "self-contained and understandable without a presenter" | Add: *"Each slide must answer ONE specific question. State the question implicitly through the title and answer it through the visual + text."* |
| **Fallback text strategy** | Only `content` goes to image | For critical data slides, add a rule: *"If this slide has numbers or comparisons, the content field must contain the key number/comparison even if the visual also shows it."* |
| **Visual narrative arc** | Generic flow guidance | Add: *"Each visual cue must depict something that a viewer can understand WITHOUT reading any text — the image alone should communicate the slide's message through metaphor, diagram, or scene."* |
| **Speaker notes as slide caption** | Notes are hidden behind toggle | Consider showing a 1-line summary beneath each slide in the UI (not in the image) as a "caption" fallback |
| **Image model text reliability** | Hope it works | For full-image mode, consider a post-processing step that overlays clean text on top of the generated image if the model's text rendering is garbled |
