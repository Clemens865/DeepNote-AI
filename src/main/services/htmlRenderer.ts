import type { StructuredSlide, PresentationTheme } from '../../shared/types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function hexToRgbTuple(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function renderBodyContent(items: StructuredSlide['bodyContent'], imageDataMap?: Map<string, string>): string {
  return items
    .map((item) => {
      switch (item.type) {
        case 'text':
          return `<p class="body-text">${escapeHtml(item.text || '')}</p>`
        case 'bullets':
          return `<ul class="body-bullets">${(item.bullets || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
        case 'stat':
          return `<div class="stat-item"><span class="stat-value">${escapeHtml(item.statValue || '')}</span><span class="stat-label">${escapeHtml(item.statLabel || '')}</span></div>`
        case 'quote':
          return `<blockquote class="body-quote">${escapeHtml(item.text || '')}</blockquote>`
        case 'image-placeholder': {
          const imgData = imageDataMap?.get(item.id)
          if (imgData) {
            return `<img src="${imgData}" class="slide-image" alt="${escapeHtml(item.imagePrompt || item.text || 'Generated image')}" />`
          }
          return `<div class="image-placeholder">${escapeHtml(item.text || 'Image')}</div>`
        }
        default:
          return ''
      }
    })
    .join('\n')
}

function renderTitleSlide(slide: StructuredSlide, imageDataMap?: Map<string, string>): string {
  return `
    <section class="slide title-slide">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="slide-inner">
        <h1 class="gradient-text">${escapeHtml(slide.title)}</h1>
        ${slide.subtitle ? `<p class="subtitle">${escapeHtml(slide.subtitle)}</p>` : ''}
        ${renderBodyContent(slide.bodyContent, imageDataMap)}
      </div>
    </section>`
}

function renderSectionHeader(slide: StructuredSlide, imageDataMap?: Map<string, string>): string {
  return `
    <section class="slide section-header">
      <div class="slide-inner">
        <span class="section-tag">Section</span>
        <h2 class="section-title">${escapeHtml(slide.title)}</h2>
        ${slide.subtitle ? `<p class="section-subtitle">${escapeHtml(slide.subtitle)}</p>` : ''}
        ${renderBodyContent(slide.bodyContent, imageDataMap)}
      </div>
    </section>`
}

function renderContentSlide(slide: StructuredSlide, imageDataMap?: Map<string, string>): string {
  return `
    <section class="slide content-slide">
      <div class="slide-inner">
        <h2>${escapeHtml(slide.title)}</h2>
        <div class="glass-card">
          ${renderBodyContent(slide.bodyContent, imageDataMap)}
        </div>
      </div>
    </section>`
}

function renderTwoColumn(slide: StructuredSlide, imageDataMap?: Map<string, string>): string {
  const half = Math.ceil(slide.bodyContent.length / 2)
  const left = slide.bodyContent.slice(0, half)
  const right = slide.bodyContent.slice(half)
  return `
    <section class="slide two-column-slide">
      <div class="slide-inner">
        <h2>${escapeHtml(slide.title)}</h2>
        <div class="two-col">
          <div class="col">${renderBodyContent(left, imageDataMap)}</div>
          <div class="col glass-card">${renderBodyContent(right, imageDataMap)}</div>
        </div>
      </div>
    </section>`
}

function renderCardGrid(slide: StructuredSlide): string {
  const cards = slide.bodyContent
    .map(
      (item) => `
    <div class="glass-card grid-card">
      <div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg></div>
      ${item.type === 'bullets' ? `<ul class="body-bullets">${(item.bullets || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : `<p class="body-text">${escapeHtml(item.text || item.statLabel || '')}</p>`}
    </div>`
    )
    .join('')
  return `
    <section class="slide card-grid-slide">
      <div class="slide-inner">
        <h2>${escapeHtml(slide.title)}</h2>
        <div class="card-grid">${cards}</div>
      </div>
    </section>`
}

function renderStatRow(slide: StructuredSlide): string {
  const stats = slide.bodyContent
    .filter((c) => c.type === 'stat')
    .map(
      (c) => `
    <div class="stat-block">
      <span class="stat-value">${escapeHtml(c.statValue || '')}</span>
      <span class="stat-label">${escapeHtml(c.statLabel || '')}</span>
    </div>`
    )
    .join('')
  return `
    <section class="slide stat-row-slide">
      <div class="slide-inner">
        <h2>${escapeHtml(slide.title)}</h2>
        <div class="stat-row">${stats}</div>
      </div>
    </section>`
}

function renderQuoteSlide(slide: StructuredSlide): string {
  const quoteItem = slide.bodyContent.find((c) => c.type === 'quote')
  return `
    <section class="slide quote-slide">
      <div class="orb orb-1"></div>
      <div class="slide-inner">
        <blockquote class="featured-quote">${escapeHtml(quoteItem?.text || slide.title)}</blockquote>
        ${slide.subtitle ? `<p class="quote-attribution">— ${escapeHtml(slide.subtitle)}</p>` : ''}
      </div>
    </section>`
}

function renderClosingSlide(slide: StructuredSlide, imageDataMap?: Map<string, string>): string {
  return `
    <section class="slide final-slide">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="slide-inner">
        <h2 class="gradient-text">${escapeHtml(slide.title)}</h2>
        ${renderBodyContent(slide.bodyContent, imageDataMap)}
      </div>
    </section>`
}

function renderSlide(slide: StructuredSlide, imageDataMap?: Map<string, string>): string {
  switch (slide.layout) {
    case 'title-slide':
      return renderTitleSlide(slide, imageDataMap)
    case 'section-header':
      return renderSectionHeader(slide, imageDataMap)
    case 'content':
      return renderContentSlide(slide, imageDataMap)
    case 'two-column':
      return renderTwoColumn(slide, imageDataMap)
    case 'card-grid':
      return renderCardGrid(slide)
    case 'stat-row':
      return renderStatRow(slide)
    case 'quote':
      return renderQuoteSlide(slide)
    case 'closing':
      return renderClosingSlide(slide, imageDataMap)
    default:
      return renderContentSlide(slide, imageDataMap)
  }
}

export function renderSlidesToHtml(slides: StructuredSlide[], theme: PresentationTheme, imageDataMap?: Map<string, string>): string {
  const c = theme.colors
  const f = theme.fonts
  const slidesHtml = slides.map(s => renderSlide(s, imageDataMap)).join('\n')
  const totalSlides = slides.length

  // Template assets
  const tmpl = theme.pptxTemplate
  const bgImage = tmpl?.backgroundImageBase64
  const logoAsset = tmpl?.assets?.find((a) => a.role === 'logo')

  const bgStyle = bgImage
    ? `background: url('${bgImage}') center/cover no-repeat, var(--bg-primary);`
    : 'background: var(--bg-primary);'
  const logoHtml = logoAsset
    ? `<img src="${logoAsset.base64}" class="template-logo" alt="Logo" />`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Presentation</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.heading)}:wght@400;600;700;900&family=${encodeURIComponent(f.body)}:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --bg-primary: ${c.background};
  --bg-secondary: ${c.backgroundSecondary};
  --accent-1: ${c.accent1};
  --accent-2: ${c.accent2};
  --accent-3: ${c.accent3};
  --text-primary: ${c.textPrimary};
  --text-secondary: ${c.textSecondary};
  --text-muted: ${c.textMuted};
  --font-heading: '${f.heading}', system-ui, sans-serif;
  --font-body: '${f.body}', system-ui, sans-serif;
}
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:100%; height:100%; overflow:hidden; ${bgStyle} color:var(--text-primary); font-family:var(--font-body); }
.template-logo { position:fixed; top:1rem; left:1.2rem; max-height:2rem; width:auto; z-index:50; opacity:0.85; pointer-events:none; }
canvas#particles { position:fixed; top:0; left:0; width:100%; height:100%; z-index:0; pointer-events:none; }
.slides-container { position:relative; z-index:1; width:100%; height:100%; scroll-snap-type:y mandatory; overflow-y:scroll; scroll-behavior:smooth; }
.slide { width:100%; height:100vh; scroll-snap-align:start; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; padding:3rem; }
.slide-inner { max-width:1100px; width:100%; text-align:center; }
h1 { font-family:var(--font-heading); font-size:clamp(2.5rem,5vw,4.5rem); font-weight:900; line-height:1.1; margin-bottom:1rem; }
h2 { font-family:var(--font-heading); font-size:clamp(1.8rem,3.5vw,3rem); font-weight:700; margin-bottom:1.5rem; }
.gradient-text { background:linear-gradient(135deg, var(--accent-1), var(--accent-2), var(--accent-3)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.subtitle { font-size:1.3rem; color:var(--text-secondary); max-width:700px; margin:0 auto 2rem; }
.section-tag { display:inline-block; padding:.3rem .8rem; border-radius:999px; font-size:.75rem; font-weight:600; text-transform:uppercase; letter-spacing:.08em; background:rgba(${hexToRgbTuple(c.accent1)}, 0.15); color:var(--accent-1); margin-bottom:1rem; }
.section-title { font-size:clamp(2rem,4vw,3.5rem); }
.section-subtitle { color:var(--text-secondary); font-size:1.1rem; }
.glass-card { background:rgba(${hexToRgbTuple(c.backgroundSecondary)}, 0.6); backdrop-filter:blur(16px); border:1px solid rgba(${hexToRgbTuple(c.textMuted)}, 0.12); border-radius:1rem; padding:2rem; text-align:left; }
.body-text { color:var(--text-secondary); font-size:1.05rem; line-height:1.7; margin-bottom:1rem; }
.body-bullets { list-style:none; padding:0; }
.body-bullets li { position:relative; padding-left:1.5rem; color:var(--text-secondary); font-size:1rem; line-height:1.7; margin-bottom:.6rem; }
.body-bullets li::before { content:''; position:absolute; left:0; top:.6em; width:8px; height:8px; border-radius:50%; background:var(--accent-1); }
.body-quote { font-style:italic; font-size:1.1rem; color:var(--text-secondary); border-left:3px solid var(--accent-1); padding-left:1.2rem; margin:1rem 0; }
.two-col { display:flex; gap:2rem; text-align:left; }
.two-col .col { flex:1; }
.card-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1.5rem; text-align:left; }
.grid-card { display:flex; flex-direction:column; gap:.8rem; }
.card-icon { color:var(--accent-1); }
.stat-row { display:flex; gap:2rem; justify-content:center; flex-wrap:wrap; }
.stat-block { text-align:center; min-width:160px; }
.stat-value { display:block; font-family:var(--font-heading); font-size:clamp(2rem,4vw,3.5rem); font-weight:900; background:linear-gradient(135deg, var(--accent-1), var(--accent-2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.stat-label { display:block; color:var(--text-muted); font-size:.9rem; margin-top:.3rem; }
.stat-item { display:inline-flex; flex-direction:column; align-items:center; margin:0 1.5rem 1rem; }
.stat-item .stat-value { font-size:2rem; }
.featured-quote { font-family:var(--font-heading); font-size:clamp(1.5rem,3vw,2.5rem); font-weight:600; max-width:800px; margin:0 auto; line-height:1.4; border:none; padding:0; font-style:italic; color:var(--text-primary); }
.quote-attribution { color:var(--text-muted); margin-top:1.5rem; font-size:1rem; }
.image-placeholder { width:100%; padding:3rem; border:2px dashed rgba(${hexToRgbTuple(c.textMuted)}, 0.3); border-radius:.75rem; color:var(--text-muted); text-align:center; }
.slide-image { width:100%; max-height:60vh; object-fit:contain; border-radius:.75rem; }
.orb { position:absolute; border-radius:50%; filter:blur(80px); opacity:0.15; pointer-events:none; }
.orb-1 { width:400px; height:400px; background:var(--accent-1); top:-100px; right:-100px; }
.orb-2 { width:300px; height:300px; background:var(--accent-2); bottom:-80px; left:-80px; }
.progress-bar { position:fixed; top:0; left:0; height:3px; background:linear-gradient(90deg, var(--accent-1), var(--accent-2)); z-index:100; transition:width .3s; }
.slide-counter { position:fixed; bottom:1.5rem; right:1.5rem; font-size:.75rem; color:var(--text-muted); z-index:100; font-family:var(--font-body); }
@media (max-width:768px) {
  .two-col { flex-direction:column; }
  .stat-row { flex-direction:column; align-items:center; }
  .slide { padding:1.5rem; }
}
</style>
</head>
<body>
<canvas id="particles"></canvas>
${logoHtml}
<div class="progress-bar" id="progressBar"></div>
<div class="slide-counter" id="slideCounter">1 / ${totalSlides}</div>
<div class="slides-container" id="slidesContainer">
${slidesHtml}
</div>
<script>
(function(){
  const container = document.getElementById('slidesContainer');
  const bar = document.getElementById('progressBar');
  const counter = document.getElementById('slideCounter');
  const total = ${totalSlides};
  container.addEventListener('scroll', () => {
    const pct = container.scrollTop / (container.scrollHeight - container.clientHeight);
    bar.style.width = (pct * 100) + '%';
    const idx = Math.round(pct * (total - 1)) + 1;
    counter.textContent = idx + ' / ' + total;
  });
  document.addEventListener('keydown', (e) => {
    const h = container.clientHeight;
    if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); container.scrollBy({top:h,behavior:'smooth'}); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); container.scrollBy({top:-h,behavior:'smooth'}); }
    if (e.key === 'Home') { e.preventDefault(); container.scrollTo({top:0,behavior:'smooth'}); }
    if (e.key === 'End') { e.preventDefault(); container.scrollTo({top:container.scrollHeight,behavior:'smooth'}); }
  });
  // Particles
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let W, H;
  function resize(){ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize(); window.addEventListener('resize', resize);
  const dots = Array.from({length:60}, () => ({x:Math.random()*W, y:Math.random()*H, r:Math.random()*2+0.5, dx:(Math.random()-0.5)*0.3, dy:(Math.random()-0.5)*0.3}));
  function draw(){
    ctx.clearRect(0,0,W,H);
    dots.forEach(d => {
      d.x += d.dx; d.y += d.dy;
      if(d.x<0||d.x>W) d.dx*=-1;
      if(d.y<0||d.y>H) d.dy*=-1;
      ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
      ctx.fillStyle='rgba(${hexToRgbTuple(c.accent1)},0.25)'; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();
<\/script>
</body>
</html>`
}
