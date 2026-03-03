import type { StructuredSlide, PresentationTheme, SlideBodyContent } from '../../shared/types'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function hexToRgbTuple(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `${r},${g},${b}`
}

function renderBodyContent(item: SlideBodyContent): string {
  switch (item.type) {
    case 'text':
      return `<p class="anim" style="font-size:1.05rem;line-height:1.7;color:var(--text-secondary);margin-top:1rem;">${escapeHtml(item.text || '')}</p>`
    case 'bullets':
      return `<ul class="bullet-list">${(item.bullets || []).map(b => `<li class="anim">${escapeHtml(b)}</li>`).join('')}</ul>`
    case 'stat':
      return `<div class="stat anim"><div class="stat-value gradient-text">${escapeHtml(item.statValue || '')}</div><div class="stat-label">${escapeHtml(item.statLabel || '')}</div></div>`
    case 'quote':
      return `<blockquote class="anim" style="font-size:1.4rem;font-style:italic;line-height:1.6;color:var(--text-secondary);border-left:3px solid var(--accent-1);padding-left:1.5rem;margin:2rem 0;">${escapeHtml(item.text || '')}</blockquote>`
    case 'image-placeholder':
      return `<div class="anim glass" style="width:100%;height:200px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.9rem;">Image Placeholder</div>`
    default:
      return ''
  }
}

function renderTitleSlide(slide: StructuredSlide): string {
  return `<section>
  <div class="section-inner" style="text-align:center;">
    <div class="orb" style="width:500px;height:500px;background:var(--accent-1);top:-10%;left:-10%;"></div>
    <div class="orb" style="width:400px;height:400px;background:var(--accent-2);bottom:-10%;right:-10%;"></div>
    <h1 class="hero-title gradient-text anim">${escapeHtml(slide.title)}</h1>
    <div class="hero-line anim" style="margin:2rem auto;"></div>
    ${slide.subtitle ? `<p class="hero-subtitle anim" style="margin:0 auto;">${escapeHtml(slide.subtitle)}</p>` : ''}
    ${slide.bodyContent.map(renderBodyContent).join('\n    ')}
  </div>
</section>`
}

function renderSectionHeader(slide: StructuredSlide, idx: number): string {
  return `<section>
  <div class="section-inner">
    <span class="section-tag anim">${String(idx).padStart(2, '0')} &mdash; SECTION</span>
    <h2 class="section-heading gradient-text anim">${escapeHtml(slide.title)}</h2>
    ${slide.subtitle ? `<p class="anim" style="font-size:1.1rem;color:var(--text-muted);margin-top:0.5rem;">${escapeHtml(slide.subtitle)}</p>` : ''}
    ${slide.bodyContent.map(renderBodyContent).join('\n    ')}
  </div>
</section>`
}

function renderContentSlide(slide: StructuredSlide, idx: number): string {
  return `<section>
  <div class="section-inner">
    <span class="section-tag anim">${String(idx).padStart(2, '0')} &mdash; ${escapeHtml(slide.title.toUpperCase().slice(0, 30))}</span>
    <h2 class="section-heading gradient-text anim">${escapeHtml(slide.title)}</h2>
    <div class="glass" style="margin-top:2rem;">
      ${slide.bodyContent.map(renderBodyContent).join('\n      ')}
    </div>
  </div>
</section>`
}

function renderTwoColumn(slide: StructuredSlide, idx: number): string {
  const left = slide.bodyContent.slice(0, Math.ceil(slide.bodyContent.length / 2))
  const right = slide.bodyContent.slice(Math.ceil(slide.bodyContent.length / 2))
  return `<section>
  <div class="section-inner">
    <span class="section-tag anim">${String(idx).padStart(2, '0')} &mdash; ${escapeHtml(slide.title.toUpperCase().slice(0, 30))}</span>
    <h2 class="section-heading gradient-text anim">${escapeHtml(slide.title)}</h2>
    <div style="display:flex;gap:2rem;margin-top:2rem;flex-wrap:wrap;">
      <div style="flex:1;min-width:280px;">
        ${left.map(renderBodyContent).join('\n        ')}
      </div>
      <div class="glass" style="flex:1;min-width:280px;">
        ${right.map(renderBodyContent).join('\n        ')}
      </div>
    </div>
  </div>
</section>`
}

function renderCardGrid(slide: StructuredSlide, idx: number): string {
  const cards = slide.bodyContent.map((item, ci) => {
    const icons = [
      '<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
      '<svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
      '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/></svg>',
    ]
    const title = item.type === 'stat' ? (item.statLabel || '') : (item.text?.split('.')[0] || `Card ${ci + 1}`)
    const body = item.type === 'stat' ? item.statValue || '' : (item.text || item.bullets?.join(', ') || '')
    return `<div class="card anim">
        <div class="card-icon">${icons[ci % icons.length]}</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
      </div>`
  })
  return `<section>
  <div class="section-inner">
    <span class="section-tag anim">${String(idx).padStart(2, '0')} &mdash; ${escapeHtml(slide.title.toUpperCase().slice(0, 30))}</span>
    <h2 class="section-heading gradient-text anim">${escapeHtml(slide.title)}</h2>
    <div class="card-grid">
      ${cards.join('\n      ')}
    </div>
  </div>
</section>`
}

function renderStatRow(slide: StructuredSlide, idx: number): string {
  const stats = slide.bodyContent
    .filter(b => b.type === 'stat')
    .map(b => renderBodyContent(b))
  const nonStats = slide.bodyContent.filter(b => b.type !== 'stat')
  return `<section>
  <div class="section-inner">
    <span class="section-tag anim">${String(idx).padStart(2, '0')} &mdash; ${escapeHtml(slide.title.toUpperCase().slice(0, 30))}</span>
    <h2 class="section-heading gradient-text anim">${escapeHtml(slide.title)}</h2>
    <div class="stat-row">
      ${stats.join('\n      ')}
    </div>
    ${nonStats.map(renderBodyContent).join('\n    ')}
  </div>
</section>`
}

function renderQuoteSlide(slide: StructuredSlide): string {
  return `<section>
  <div class="section-inner" style="text-align:center;max-width:800px;margin:0 auto;">
    <div class="orb" style="width:300px;height:300px;background:var(--accent-2);top:10%;right:-5%;"></div>
    ${slide.bodyContent.map(renderBodyContent).join('\n    ')}
    ${slide.subtitle ? `<p class="anim" style="font-size:0.9rem;color:var(--text-muted);margin-top:1rem;">&mdash; ${escapeHtml(slide.subtitle)}</p>` : ''}
  </div>
</section>`
}

function renderClosingSlide(slide: StructuredSlide): string {
  return `<section>
  <div class="section-inner final-slide">
    <h2 class="hero-title gradient-text anim" style="font-size:clamp(2.5rem,6vw,4.5rem);">${escapeHtml(slide.title)}</h2>
    <div class="hero-line anim" style="margin:2rem auto;"></div>
    ${slide.bodyContent.map(renderBodyContent).join('\n    ')}
  </div>
</section>`
}

function renderSlide(slide: StructuredSlide, idx: number): string {
  switch (slide.layout) {
    case 'title-slide': return renderTitleSlide(slide)
    case 'section-header': return renderSectionHeader(slide, idx)
    case 'content': return renderContentSlide(slide, idx)
    case 'two-column': return renderTwoColumn(slide, idx)
    case 'card-grid': return renderCardGrid(slide, idx)
    case 'stat-row': return renderStatRow(slide, idx)
    case 'quote': return renderQuoteSlide(slide)
    case 'closing': return renderClosingSlide(slide)
    default: return renderContentSlide(slide, idx)
  }
}

export function renderSlidesToHtml(slides: StructuredSlide[], theme: PresentationTheme): string {
  const cssVars = theme.cssVariables || {}
  const rootVarsLines = Object.entries(cssVars).map(([k, v]) => `    ${k}: ${v};`)
  const rootBlock = rootVarsLines.length > 0
    ? rootVarsLines.join('\n')
    : `    --bg-primary: ${theme.colors.background};
    --bg-secondary: ${theme.colors.backgroundSecondary};
    --accent-1: ${theme.colors.accent1};
    --accent-2: ${theme.colors.accent2};
    --accent-3: ${theme.colors.accent3};
    --text-primary: ${theme.colors.textPrimary};
    --text-secondary: ${theme.colors.textSecondary};
    --text-muted: ${theme.colors.textMuted};
    --glass-bg: rgba(255,255,255,0.03);
    --glass-border: rgba(255,255,255,0.06);
    --particle-rgb: ${hexToRgbTuple(theme.colors.accent1)}`

  const totalSlides = slides.length
  const slidesHtml = slides.map((s, i) => renderSlide(s, i + 1)).join('\n\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Presentation</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"><\/script>
<style>
  :root {
${rootBlock}
  }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-snap-type: y mandatory; overflow-y: scroll; }
  body {
    font-family: '${theme.fonts.heading}', 'Inter', -apple-system, sans-serif;
    background: var(--bg-primary);
    color: var(--text-secondary);
    overflow-x: hidden;
  }
  #particles { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
  .bg-mesh {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 80% 60% at 10% 20%, color-mix(in srgb, var(--accent-1) 15%, transparent), transparent),
      radial-gradient(ellipse 60% 80% at 90% 80%, color-mix(in srgb, var(--accent-2) 12%, transparent), transparent),
      radial-gradient(ellipse 70% 50% at 50% 50%, color-mix(in srgb, var(--accent-3) 8%, transparent), transparent);
    animation: meshShift 20s ease-in-out infinite alternate;
  }
  @keyframes meshShift {
    0% { background-position: 0% 0%, 100% 100%, 50% 50%; filter: hue-rotate(0deg); }
    100% { background-position: 100% 100%, 0% 0%, 50% 50%; filter: hue-rotate(30deg); }
  }
  section {
    min-height: 100vh; scroll-snap-align: start;
    display: flex; align-items: center; justify-content: center;
    position: relative; z-index: 1;
    padding: clamp(2rem, 5vw, 6rem);
  }
  .section-inner { max-width: 1100px; width: 100%; }
  #progress {
    position: fixed; top: 0; left: 0; height: 3px; z-index: 100;
    background: linear-gradient(90deg, var(--accent-1), var(--accent-2), var(--accent-3));
    width: 0%; transition: width 0.3s ease;
  }
  #counter {
    position: fixed; bottom: 2rem; right: 2rem; z-index: 100;
    font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;
    color: var(--text-muted); letter-spacing: 0.1em;
  }
  .glass {
    background: var(--glass-bg);
    backdrop-filter: blur(24px) saturate(1.2);
    -webkit-backdrop-filter: blur(24px) saturate(1.2);
    border: 1px solid var(--glass-border);
    border-radius: 24px;
    padding: clamp(1.5rem, 3vw, 3rem);
    position: relative; overflow: hidden;
  }
  .glass::before {
    content: ''; position: absolute; inset: 0; border-radius: 24px;
    background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%);
    pointer-events: none;
  }
  .gradient-text {
    background: linear-gradient(135deg, var(--accent-1) 0%, var(--accent-2) 50%, var(--accent-3) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hero-title {
    font-size: clamp(3rem, 8vw, 6rem); font-weight: 900;
    line-height: 1.05; letter-spacing: -0.03em;
    margin-bottom: 1.5rem;
  }
  .hero-subtitle {
    font-size: clamp(1.1rem, 2.5vw, 1.5rem); font-weight: 300;
    color: var(--text-muted); max-width: 600px; line-height: 1.7;
  }
  .hero-line {
    width: 80px; height: 3px; border-radius: 3px;
    background: linear-gradient(90deg, var(--accent-1), var(--accent-2));
    margin: 2rem 0;
  }
  .section-heading {
    font-size: clamp(2rem, 4vw, 3rem); font-weight: 700;
    line-height: 1.2; margin-bottom: 1rem;
  }
  .section-tag {
    font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;
    font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase;
    color: var(--accent-1); margin-bottom: 0.75rem; display: block;
  }
  .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
  .card {
    background: var(--glass-bg); border: 1px solid var(--glass-border);
    border-radius: 20px; padding: 2rem; position: relative; overflow: hidden;
    transition: border-color 0.4s ease, transform 0.4s ease;
  }
  .card:hover { border-color: color-mix(in srgb, var(--accent-1) 30%, transparent); transform: translateY(-4px); }
  .card::after {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent-1), var(--accent-2), transparent);
    opacity: 0; transition: opacity 0.4s ease;
  }
  .card:hover::after { opacity: 1; }
  .card-icon {
    width: 40px; height: 40px; margin-bottom: 1rem; display: flex;
    align-items: center; justify-content: center; border-radius: 12px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent-1) 15%, transparent), color-mix(in srgb, var(--accent-2) 15%, transparent));
  }
  .card-icon svg { width: 20px; height: 20px; stroke: var(--accent-1); stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .card h3 { font-size: 1.15rem; font-weight: 600; margin-bottom: 0.6rem; color: var(--text-primary); }
  .card p { font-size: 0.95rem; line-height: 1.7; color: var(--text-muted); }
  .bullet-list { list-style: none; margin-top: 1.5rem; }
  .bullet-list li {
    padding: 1rem 1.5rem; margin-bottom: 0.75rem;
    background: var(--glass-bg); border-left: 3px solid var(--accent-1);
    border-radius: 0 12px 12px 0; font-size: 1.05rem; line-height: 1.7;
    color: var(--text-secondary);
  }
  .bullet-list li strong { color: var(--text-primary); }
  .stat-row { display: flex; flex-wrap: wrap; gap: 2rem; margin-top: 2rem; }
  .stat {
    flex: 1; min-width: 160px; text-align: center;
    padding: 2rem 1rem; border-radius: 20px;
    background: var(--glass-bg); border: 1px solid var(--glass-border);
  }
  .stat-value { font-size: clamp(2rem, 4vw, 3rem); font-weight: 900; line-height: 1; }
  .stat-label { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; }
  .final-slide { text-align: center; }
  .final-slide .hero-title { font-size: clamp(2.5rem, 6vw, 4.5rem); }
  .orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15; pointer-events: none; }
  .anim { opacity: 0; }
</style>
</head>
<body>
<div class="bg-mesh"></div>
<canvas id="particles"></canvas>
<div id="progress"></div>
<div id="counter">1 / ${totalSlides}</div>

${slidesHtml}

<script>
(function(){
  const c=document.getElementById('particles'),x=c.getContext('2d');
  const pRgb=getComputedStyle(document.documentElement).getPropertyValue('--particle-rgb').trim()||'99,102,241';
  let w,h,pts=[];
  function resize(){w=c.width=innerWidth;h=c.height=innerHeight;}
  resize(); addEventListener('resize',resize);
  for(let i=0;i<80;i++) pts.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.5+0.5,dx:(Math.random()-0.5)*0.3,dy:(Math.random()-0.5)*0.3,o:Math.random()*0.3+0.1});
  function draw(){
    x.clearRect(0,0,w,h);
    for(const p of pts){
      p.x+=p.dx; p.y+=p.dy;
      if(p.x<0)p.x=w; if(p.x>w)p.x=0; if(p.y<0)p.y=h; if(p.y>h)p.y=0;
      x.beginPath(); x.arc(p.x,p.y,p.r,0,Math.PI*2);
      x.fillStyle='rgba('+pRgb+','+p.o+')'; x.fill();
    }
    for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
      const d=Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y);
      if(d<120){ x.beginPath(); x.moveTo(pts[i].x,pts[i].y); x.lineTo(pts[j].x,pts[j].y);
        x.strokeStyle='rgba('+pRgb+','+(0.06*(1-d/120))+')'; x.stroke(); }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();
gsap.registerPlugin(ScrollTrigger);
document.querySelectorAll('.anim').forEach(el=>{
  gsap.fromTo(el,{opacity:0, y:40, scale:0.95},{
    opacity:1, y:0, scale:1, duration:0.9, ease:'power3.out',
    scrollTrigger:{trigger:el, start:'top 85%', toggleActions:'play none none none'}
  });
});
document.querySelectorAll('section').forEach(sec=>{
  const cards=sec.querySelectorAll('.card, .bullet-list li, .stat');
  if(cards.length) gsap.fromTo(cards,{opacity:0, y:30},{
    opacity:1, y:0, duration:0.7, stagger:0.12, ease:'power2.out',
    scrollTrigger:{trigger:sec, start:'top 70%', toggleActions:'play none none none'}
  });
});
const sections=document.querySelectorAll('section');
const bar=document.getElementById('progress');
const counter=document.getElementById('counter');
const total=sections.length;
let current=0;
const obs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting){
    current=[...sections].indexOf(e.target);
    bar.style.width=((current+1)/total*100)+'%';
    counter.textContent=(current+1)+' / '+total;
  }});
},{threshold:0.5});
sections.forEach(s=>obs.observe(s));
document.addEventListener('keydown',e=>{
  if(['ArrowDown','ArrowRight'].includes(e.key)&&current<total-1){e.preventDefault();sections[current+1].scrollIntoView({behavior:'smooth'});}
  if(['ArrowUp','ArrowLeft'].includes(e.key)&&current>0){e.preventDefault();sections[current-1].scrollIntoView({behavior:'smooth'});}
});
<\/script>
</body>
</html>`
}
