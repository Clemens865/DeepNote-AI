# Image Slide Pipeline Simulation — V2 (Infographic Approach)

**Source material:** `WiFi_CSI_Distance_Tracking_Whitepaper.md`
**Config:** 10 slides, format=presentation, renderMode=full-image, style=neon-circuit
**Branch:** `feature/slide-prompt-experiment`

## What changed from V1

| Aspect | V1 (cinematic) | V2 (infographic) |
|--------|----------------|-------------------|
| **Philosophy** | "Movie poster — text woven into cinematic scene" | "Infographic — combine text, visuals, diagrams into one clear slide" |
| **Content limit** | 150 chars, 3 lines | 250 chars, 5 lines |
| **Visual cue** | 50-100 word scene description, pixel-precise directions | 30-60 word layout direction, concept-level |
| **Text instruction** | "Image model struggles with text, keep minimal" | "Image model is good at text, include meaningful info" |
| **Image prompt** | "Cinematic composition, text integrated into surfaces/environments" | "Infographic-style slide, clear typography hierarchy, creative freedom" |
| **AI freedom** | Low — describes exact metaphors, materials, lighting | High — describes the concept, lets AI choose layout |

---

## Stage 1: Planning Prompt (key changes only)

The new planning prompt tells the AI:

```
You are an expert infographic and presentation designer. You are planning a 10-slide
deck where each slide will be generated as a single AI-generated image — combining
visuals, text, icons, diagrams, and data into one cohesive infographic-style slide.

YOUR ROLE:
You decide the best way to visualize each slide's message. You can use ANY combination of:
- Informational text (headlines, labels, callouts, key numbers)
- Diagrams (flowcharts, process flows, architecture diagrams)
- Comparisons (side-by-side, before/after, bar charts, scales)
- Icons and illustrations
- Data visualizations (charts, tables, meters, gauges)
- Metaphorical imagery combined with data

The image generation AI is GOOD at rendering text, numbers, labels, and infographic
layouts. You should include meaningful text on every slide — not just a title, but
the key information that makes the slide self-explanatory.

RULES:
1. Slide Count: Output EXACTLY 10 slides.
2. Self-Explanatory: Each slide must be fully understandable on its own, without a
   presenter. A viewer looking at the slide image alone should grasp the key message
   and supporting evidence.
3. content field: Max 250 characters, max 5 lines — but use what you need.
4. visualCue: 30-60 words. Describe the layout concept, not every pixel.
5. [...]
```

---

## Stage 2: Simulated AI Output (Content Plan)

```json
[
  {
    "slideNumber": 1,
    "layout": "Title",
    "title": "WiFi Distance Tracking for Cinema",
    "bullets": ["$155 vs $3,000–$100,000", "ESP32-based spatial awareness"],
    "visualCue": "Bold title card with dark tech background. WiFi signal wave pattern behind title. Subtitle below. Small price comparison badge in corner showing $155.",
    "content": "WiFi Distance Tracking\nfor Cinema\n\n$155 system replacing $3,000+ tools\nUsing commodity ESP32 hardware",
    "speakerNotes": "This presentation covers how WiFi Channel State Information can provide real-time distance tracking for film production at a fraction of the cost of professional ultrasonic or optical systems."
  },
  {
    "slideNumber": 2,
    "layout": "Content",
    "title": "The Cost Problem",
    "bullets": ["Cinetape: $3K–$8K", "Optical: $10K–$100K+", "Most sets can't afford it"],
    "visualCue": "Horizontal bar chart comparing 4 systems by cost. WiFi CSI bar tiny in green, others towering. Price labels on each bar. Header at top.",
    "content": "The Cost Problem\n\nCinetape: $3,000–$8,000\nLiDAR: $500–$2,000\nOptical (Vicon): $10,000–$100,000+\nWiFi CSI: $155\n\nMost productions priced out",
    "speakerNotes": "Professional distance measurement tools range from $3,000 for a single Cinetape unit to over $100,000 for optical tracking. At $155, WiFi CSI opens spatial tracking to any budget."
  },
  {
    "slideNumber": 3,
    "layout": "Content",
    "title": "What Is WiFi CSI?",
    "bullets": ["52 measurements per packet", "Amplitude + phase data", "vs RSSI: 1 measurement"],
    "visualCue": "Split comparison diagram. Left side: RSSI shown as single bar (labeled '1 measurement'). Right side: CSI shown as 52 colorful subcarrier columns (labeled '52 measurements'). Versus symbol between them.",
    "content": "What Is WiFi CSI?\n\nRSSI: 1 measurement per packet\nCSI: 52 amplitude+phase readings\n\n→ 52× more spatial data\n→ Sub-centimeter motion detection",
    "speakerNotes": "Channel State Information captures amplitude and phase for each of 52 WiFi subcarriers per packet. This 52x increase in measurement density over RSSI is what makes centimeter-level tracking viable."
  },
  {
    "slideNumber": 4,
    "layout": "Content",
    "title": "How Ranging Works",
    "bullets": ["Fresnel zone model", "Phase changes with distance", "Multiple methods fused"],
    "visualCue": "Process diagram with 3 steps connected by arrows. Step 1: WiFi signal + Fresnel zone ellipse icon. Step 2: phase shift wave icon. Step 3: distance output icon. Key formula shown below.",
    "content": "How Ranging Works\n\n1. Signal passes through Fresnel zone\n2. Person causes measurable phase shift\n3. Phase change → distance estimate\n\nΔφ = 2π × 2d / λ\n30mm = full rotation at 5GHz",
    "speakerNotes": "A person entering the Fresnel zone between TX and RX nodes perturbs the WiFi signal. At 5GHz (λ=60mm), just 30mm of movement causes a complete 2π phase rotation, enabling precise tracking."
  },
  {
    "slideNumber": 5,
    "layout": "Content",
    "title": "System Architecture",
    "bullets": ["3–4 ESP32-S3 nodes", "Raspberry Pi aggregator", "4-stage pipeline"],
    "visualCue": "Architecture diagram: 4 small node icons at corners labeled TX/RX, connected by dotted signal lines to a central hub icon labeled 'Raspberry Pi'. Below: 4-step pipeline flow with arrows. Component costs annotated.",
    "content": "System Architecture\n\n3–4 ESP32-S3 nodes ($8 each)\n+ Raspberry Pi aggregator ($35)\n\nPipeline: CSI Capture → Phase\nSanitization → Feature Extraction\n→ Position Estimation",
    "speakerNotes": "The system uses ESP32-S3 modules as WiFi nodes placed around the tracking area, feeding CSI data to a Raspberry Pi that runs a 4-stage signal processing pipeline producing real-time position estimates."
  },
  {
    "slideNumber": 6,
    "layout": "Content",
    "title": "Precision Envelope",
    "bullets": ["±5–10cm sweet spot", "1–8m range", "50Hz updates"],
    "visualCue": "Data table or range chart showing distance ranges vs precision. Sweet spot zone (1–8m) highlighted in green. Key metrics as callout badges: '±5–10cm', '50Hz', '4 nodes recommended'.",
    "content": "Precision Envelope\n\n0.5–1m:  ±3–5 cm (high confidence)\n1–8m:   ±5–10 cm ← sweet spot\n8–12m:  ±15–25 cm (medium)\n\nUpdate rate: 50 Hz\n4th node adds 20–30% precision",
    "speakerNotes": "Within the 1–8 meter sweet spot, the system reliably achieves ±5–10cm precision at 50Hz. Adding a 4th node improves precision by 20–30% across all ranges."
  },
  {
    "slideNumber": 7,
    "layout": "Content",
    "title": "5 Use Cases on Set",
    "bullets": ["Dolly tracking", "Virtual production", "Multi-actor blocking", "Through-wall monitoring", "Lighting zones"],
    "visualCue": "Icon grid with 5 use cases, each with a simple icon and 2-line description. Arranged in a clean grid or list. Film-themed icons.",
    "content": "5 Use Cases on Set\n\n🎬 Dolly/crane position tracking\n🖥️ Virtual production LED wall\n👥 Multi-actor blocking verification\n🧱 Through-wall monitoring\n💡 Automated lighting trigger zones",
    "speakerNotes": "Key applications span dolly tracking (±10cm sufficient), LED wall perspective correction via FreeD protocol, markerless multi-actor tracking, through-obstacle monitoring, and spatial lighting triggers via DMX/OSC."
  },
  {
    "slideNumber": 8,
    "layout": "Content",
    "title": "Technology Comparison",
    "bullets": ["WiFi vs ultrasonic vs optical", "Trade-offs at a glance"],
    "visualCue": "Comparison table with 4 columns: WiFi CSI, Cinetape, LiDAR, Vicon. Rows for precision, cost, multi-target, through-obstacle. Green checkmarks and red X marks. WiFi CSI column highlighted.",
    "content": "Technology Comparison\n\n            WiFi CSI  Cinetape  Vicon\nPrecision   ±5-10cm  ±3mm     <1mm\nCost        $155     $3-8K    $10-100K+\nMulti-target  ✓        ✗        ✓\nThrough-wall  ✓        ✗        ✗\nMarkerless    ✓        ✗        ✗",
    "speakerNotes": "WiFi CSI can't match ultrasonic precision, but uniquely offers markerless, through-obstacle, multi-target tracking at 20–50× lower cost. It fills a different niche than Cinetape or Vicon."
  },
  {
    "slideNumber": 9,
    "layout": "Content",
    "title": "Honest Limitations",
    "bullets": ["Not for critical focus", "Needs calibration", "Latency 20–50ms"],
    "visualCue": "Two-column layout. Left: 'Don't use for' list with X marks (shallow DOF focus, sub-cm precision, safety-critical). Right: 'Works great for' list with checkmarks (dolly, VP, blocking, lighting). Clear and balanced.",
    "content": "Honest Limitations\n\n✗ Critical focus at T/1.4–T/2.8\n✗ Sub-centimeter precision needs\n✗ Zero-latency (<5ms) requirements\n\n✓ Dolly tracking, blocking, lighting\n✓ Virtual production at ±10cm\n✓ Through-wall monitoring",
    "speakerNotes": "WiFi CSI is not a Cinetape replacement for shallow DOF focus pulling. It's a complementary tool for the many workflows where ±10cm is more than adequate, at a fraction of the cost."
  },
  {
    "slideNumber": 10,
    "layout": "Closing",
    "title": "Get Started for $155",
    "bullets": ["4 ESP32 nodes + Raspberry Pi", "20–50× cheaper", "Build a prototype today"],
    "visualCue": "Clean closing slide with bold headline. Shopping list of 4 items with prices totaling $155. '20–50× cost reduction' as a large callout. Forward-looking tone.",
    "content": "Get Started for $155\n\n4× ESP32-S3 nodes:  $32\n4× Antennas + cables: $32\nRaspberry Pi + SD:   $43\nMounting hardware:    $48\n\n= $155 total\n20–50× cheaper than pro tools",
    "speakerNotes": "The entire system costs less than a single day's rental of a Cinetape. Build a prototype, test it on your next production, and bring spatial tracking to sets that could never justify the cost before."
  }
]
```

---

## Stage 3: Image Prompt for Slide 5 (example)

**New `buildSlidePrompt()` output:**

```
Generate an infographic-style presentation slide image. This is a single slide in a
professional deck — combine text, visuals, icons, and data into one clear,
self-explanatory composition.

VISUAL STYLE: with a deep dark background (#0a0a14), electric purple and neon cyan
glowing accent colors, thin luminous circuit board traces connecting glowing nodes,
subtle hexagonal grid pattern, holographic data visualizations, and a futuristic
cyberpunk tech aesthetic. Typography is clean geometric sans-serif. All slides share
this exact same deep dark background and purple-cyan neon glow consistently.

COMPOSITION: Fill the entire 16:9 frame edge-to-edge. No empty borders or margins.

LAYOUT DIRECTION:
Architecture diagram: 4 small node icons at corners labeled TX/RX, connected by
dotted signal lines to a central hub icon labeled 'Raspberry Pi'. Below: 4-step
pipeline flow with arrows. Component costs annotated.

The slide must display the following text clearly and legibly as part of the design.
Use good typography hierarchy — the headline should be prominent, supporting points
should be smaller but readable. You have creative freedom for layout, icons, diagrams,
and visual elements.

SLIDE CONTENT:
System Architecture

3–4 ESP32-S3 nodes ($8 each)
+ Raspberry Pi aggregator ($35)

Pipeline: CSI Capture → Phase
Sanitization → Feature Extraction
→ Position Estimation
```

---

## Comparison: V1 vs V2 for the same slide

### V1 (Slide 5 content)
```
System Architecture

3–4 ESP32 nodes + Pi hub
Total hardware: ~$155
```
- 2 lines of text beyond title
- Viewer knows: there are nodes and a hub, costs $155
- Viewer doesn't know: what the nodes do, how data flows, what each costs

### V2 (Slide 5 content)
```
System Architecture

3–4 ESP32-S3 nodes ($8 each)
+ Raspberry Pi aggregator ($35)

Pipeline: CSI Capture → Phase
Sanitization → Feature Extraction
→ Position Estimation
```
- 5 lines of text beyond title
- Viewer knows: specific components + prices, the 4-stage processing pipeline
- The slide is self-explanatory — you understand the system without a presenter

### V1 (Slide 5 visualCue — 80 words)
```
A top-down blueprint-style view of a film studio with a clean dark background. Four
small glowing ESP32 nodes are positioned at corners, connected by pulsing cyan signal
lines forming a tracking grid. A central Raspberry Pi hub pulses with processed data.
A tracked actor silhouette moves through the grid leaving a glowing trail. The title
'System Architecture' appears as clean architectural blueprint text at the top.
Component labels float next to each node: 'ESP32-S3 — $8' and 'Total: $155' appears
as a prominent price badge.
```

### V2 (Slide 5 visualCue — 30 words)
```
Architecture diagram: 4 small node icons at corners labeled TX/RX, connected by
dotted signal lines to a central hub icon labeled 'Raspberry Pi'. Below: 4-step
pipeline flow with arrows. Component costs annotated.
```

**V2 gives the AI creative freedom** — it knows the concept (architecture diagram + pipeline flow) but decides the exact rendering, colors, icon style, and spatial arrangement.

---

## Key Hypothesis

**V1 tries to control the output → gets mediocre results because the image model can't follow pixel-precise scene descriptions reliably.**

**V2 describes the information goal → lets the image model use its strength (infographic layout, typography, icons, charts) and produces slides that are actually self-explanatory.**

The risk: image models might produce generic-looking infographics without the cinematic quality of V1. But the trade-off is: a readable, informative slide > a beautiful but incomprehensible one.

---

## Next Steps

1. Generate a test deck from the WiFi whitepaper using V2 prompts
2. Compare side-by-side with a V1 deck from the same source
3. Evaluate: readability, self-explanation, visual quality, style consistency
4. If V2 works well, consider a blend: V2 for content slides, V1 for title/closing slides
