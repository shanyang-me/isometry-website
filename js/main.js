// Efference — main.js

// ===== Neural network background — neurons that fire =====
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    if (neurons.length) buildNetwork();
  }
  window.addEventListener('resize', resize);
  resize();

  // --- Config ---
  const NUM_NEURONS = 70;
  const AXON_DIST = 200;         // max distance for axon connection
  const FIRE_INTERVAL = 1200;    // ms between random firings
  const SIGNAL_SPEED = 3;        // px per frame for action potential
  const RESTING = 'rgba(211,255,202,0.12)';
  const RESTING_BORDER = 'rgba(211,255,202,0.2)';
  const AXON_COLOR = 'rgba(211,255,202,0.04)';

  // --- State ---
  let neurons = [];
  let axons = [];       // { from, to, dist }
  let signals = [];     // { from, to, progress (0-1), dx, dy, dist }

  function buildNetwork() {
    neurons = [];
    axons = [];
    signals = [];

    // Place neurons with some clustering (brain-like)
    for (let i = 0; i < NUM_NEURONS; i++) {
      // Cluster centers
      const cx = Math.random() * W;
      const cy = Math.random() * H;
      neurons.push({
        x: cx + (Math.random() - 0.5) * 80,
        y: cy + (Math.random() - 0.5) * 80,
        r: 2 + Math.random() * 2.5,
        // Firing state
        firing: 0,       // 0 = resting, >0 = firing (decays)
        refractory: 0,   // cooldown after firing
        // Gentle drift
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
      });
    }

    // Build axon connections (nearest neighbors)
    for (let i = 0; i < neurons.length; i++) {
      for (let j = i + 1; j < neurons.length; j++) {
        const dx = neurons[i].x - neurons[j].x;
        const dy = neurons[i].y - neurons[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < AXON_DIST) {
          axons.push({ from: i, to: j, dist });
        }
      }
    }
  }
  buildNetwork();

  // --- Fire a neuron ---
  function fireNeuron(idx) {
    const n = neurons[idx];
    if (n.refractory > 0) return;
    n.firing = 1.0;
    n.refractory = 80; // frames of cooldown

    // Send signals along all connected axons
    for (const ax of axons) {
      let target = -1;
      if (ax.from === idx) target = ax.to;
      else if (ax.to === idx) target = ax.from;
      if (target < 0) continue;

      const tn = neurons[target];
      const dx = tn.x - n.x;
      const dy = tn.y - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      signals.push({
        fromIdx: idx,
        toIdx: target,
        sx: n.x, sy: n.y,     // start
        dx, dy, dist,
        progress: 0,
        speed: SIGNAL_SPEED / dist,
      });
    }
  }

  // Random spontaneous firing
  let lastFire = 0;
  function maybeFireRandom(time) {
    if (time - lastFire > FIRE_INTERVAL) {
      lastFire = time;
      // Fire 1-3 random neurons
      const count = 1 + Math.floor(Math.random() * 3);
      for (let c = 0; c < count; c++) {
        const idx = Math.floor(Math.random() * neurons.length);
        fireNeuron(idx);
      }
    }
  }

  function update() {
    // Drift neurons slowly
    for (const n of neurons) {
      n.x += n.vx;
      n.y += n.vy;
      // Soft boundary
      if (n.x < -30) n.vx = Math.abs(n.vx);
      if (n.x > W + 30) n.vx = -Math.abs(n.vx);
      if (n.y < -30) n.vy = Math.abs(n.vy);
      if (n.y > H + 30) n.vy = -Math.abs(n.vy);

      // Decay firing
      if (n.firing > 0) n.firing *= 0.95;
      if (n.firing < 0.01) n.firing = 0;
      if (n.refractory > 0) n.refractory--;
    }

    // Move signals
    for (let i = signals.length - 1; i >= 0; i--) {
      const s = signals[i];
      s.progress += s.speed;
      if (s.progress >= 1) {
        // Signal arrived — fire target neuron (chain reaction)
        if (Math.random() < 0.55) { // 55% propagation chance
          fireNeuron(s.toIdx);
        }
        signals.splice(i, 1);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw axons (dendrites)
    for (const ax of axons) {
      const a = neurons[ax.from];
      const b = neurons[ax.to];
      const bright = Math.max(a.firing, b.firing);
      const alpha = 0.03 + bright * 0.12;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(211,255,202,${alpha})`;
      ctx.lineWidth = 0.5 + bright * 1;
      ctx.stroke();
    }

    // Draw action potential signals (bright dots traveling along axons)
    for (const s of signals) {
      const px = s.sx + s.dx * s.progress;
      const py = s.sy + s.dy * s.progress;
      const glow = 1 - Math.abs(s.progress - 0.5) * 2; // brightest at midpoint

      // Glow
      ctx.beginPath();
      ctx.arc(px, py, 6 + glow * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(211,255,202,${0.08 + glow * 0.12})`;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(211,255,202,${0.5 + glow * 0.5})`;
      ctx.fill();
    }

    // Draw neurons (soma)
    for (const n of neurons) {
      const f = n.firing;

      // Firing glow
      if (f > 0.05) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 8 + f * 12, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(211,255,202,${f * 0.15})`;
        ctx.fill();
      }

      // Soma body
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      if (f > 0.05) {
        ctx.fillStyle = `rgba(211,255,202,${0.2 + f * 0.8})`;
      } else {
        ctx.fillStyle = RESTING;
      }
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.strokeStyle = f > 0.05 ? `rgba(211,255,202,${0.3 + f * 0.7})` : RESTING_BORDER;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  let startTime = 0;
  function loop(time) {
    if (!startTime) startTime = time;
    maybeFireRandom(time);
    update();
    draw();
    requestAnimationFrame(loop);
  }

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced) {
    requestAnimationFrame(loop);
  } else {
    draw();
  }
})();

// ===== Main site logic =====
(function () {
  'use strict';

  // --- Mobile nav toggle ---
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    navLinks.classList.toggle('open');
    toggle.setAttribute('aria-expanded', navLinks.classList.contains('open'));
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      navLinks.classList.remove('open');
    });
  });

  // --- Smooth scroll for anchor links ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // --- Helpers ---
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  // --- Demo: Tabs ---
  const tabs = document.querySelectorAll('.demo-tab');
  const textMode = document.getElementById('demo-text-mode');
  const imageMode = document.getElementById('demo-image-mode');
  let currentMode = 'text';

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.dataset.mode;
      textMode.style.display = currentMode === 'text' ? '' : 'none';
      imageMode.style.display = currentMode === 'image' ? '' : 'none';
    });
  });

  // --- Demo: Image upload ---
  const dropzone = document.getElementById('demo-dropzone');
  const fileInput = document.getElementById('demo-file');
  const previewWrap = document.getElementById('demo-preview-wrap');
  const previewImg = document.getElementById('demo-preview-img');
  const clearBtn = document.getElementById('demo-clear-img');
  let uploadedFile = null;

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });
  clearBtn.addEventListener('click', () => {
    uploadedFile = null;
    fileInput.value = '';
    previewWrap.style.display = 'none';
    dropzone.style.display = '';
  });

  function handleFile(file) {
    uploadedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewWrap.style.display = '';
      dropzone.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  // --- Demo: Analyze ---
  const API_URL = 'https://efference-api.fly.dev';
  const demoBtn = document.getElementById('demo-btn');
  const demoInput = document.getElementById('demo-input');
  const demoOutput = document.getElementById('demo-output');
  const demoVisual = document.getElementById('demo-visual');

  // Pre-computed fallback
  const FALLBACK = {
    objects: [
      { name: "glass_cup", material: "glass", mass_kg: 0.3, bbox: { x: 200, y: 130, w: 36, h: 78 }, state: "resting" },
      { name: "table", material: "wood", mass_kg: 20.0, bbox: { x: 50, y: 210, w: 400, h: 200 }, state: "static" },
      { name: "floor", material: "concrete", mass_kg: null, bbox: { x: 0, y: 400, w: 512, h: 112 }, state: "static" }
    ],
    forces: [
      { type: "gravity", source: "earth", target: "glass_cup", magnitude: 2.94, direction: { x: 0, y: -1, z: 0 } },
      { type: "normal", source: "table", target: "glass_cup", magnitude: 2.94, direction: { x: 0, y: 1, z: 0 } },
      { type: "gravity", source: "earth", target: "table", magnitude: 196.2, direction: { x: 0, y: -1, z: 0 } },
      { type: "normal", source: "floor", target: "table", magnitude: 198.14, direction: { x: 0, y: 1, z: 0 } }
    ],
    trajectories: [
      {
        object_name: "glass_cup",
        points: [
          { t: 0.0, position: { x: 0.2, y: 0.8, z: 0 } },
          { t: 0.2, position: { x: 0.25, y: 0.65, z: 0 } },
          { t: 0.4, position: { x: 0.3, y: 0.3, z: 0 } },
          { t: 0.5, position: { x: 0.32, y: 0.0, z: 0 } }
        ]
      }
    ],
    constraints: [
      { type: "energy_decreasing", description: "Kinetic energy lost to fracture on impact.", confidence: 0.9 },
      { type: "parabolic_trajectory", description: "Glass follows a parabolic path as it falls.", confidence: 0.85 }
    ],
    will_happen: [
      "The glass will tip over the table edge and fall.",
      "The glass will shatter on impact with the floor."
    ],
    wont_happen: [
      "The glass will not remain balanced indefinitely.",
      "The glass will not float."
    ],
    reasoning: "With ~50% overhang, the glass's center of mass is near the tipping point. Any slight perturbation will cause it to rotate off the edge. Glass is brittle and will shatter on floor impact.",
    confidence: 0.88
  };

  const EXAMPLE_DESCRIPTION = 'A glass cup sits on the edge of a wooden table, about 55% overhanging. The glass is partially filled with water. The table is 75 cm tall. A concrete floor is below.';
  const exampleBtn = document.getElementById('demo-example');

  exampleBtn.addEventListener('click', () => {
    // Switch to image mode and load example
    tabs.forEach(t => t.classList.remove('active'));
    tabs.forEach(t => { if (t.dataset.mode === 'image') t.classList.add('active'); });
    currentMode = 'image';
    textMode.style.display = 'none';
    imageMode.style.display = '';

    // Show example image in preview
    previewImg.src = 'assets/example-scene.svg';
    previewWrap.style.display = '';
    dropzone.style.display = 'none';

    // Also fill the text input for reference
    demoInput.value = EXAMPLE_DESCRIPTION;

    // Render with fallback data immediately (no server needed)
    renderResult(FALLBACK, false);
    renderVisual(FALLBACK);
  });

  demoBtn.addEventListener('click', async () => {
    if (currentMode === 'text') {
      const scene = demoInput.value.trim();
      if (!scene) { demoInput.focus(); return; }
      await runAnalysis({ scene });
    } else {
      if (!uploadedFile) { dropzone.click(); return; }
      await runAnalysis({ image: uploadedFile });
    }
  });

  async function runAnalysis(input) {
    demoOutput.innerHTML = '<div class="demo-loading">Analyzing scene...</div>';
    demoVisual.innerHTML = '<div class="demo-loading" style="text-align:center">Generating visual prediction...</div>';
    demoBtn.disabled = true;

    try {
      let body, headers;
      if (input.scene) {
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({ scene: input.scene });
      } else {
        const fd = new FormData();
        fd.append('image', input.image);
        body = fd;
        headers = {};
      }

      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      renderResult(data);
      renderVisual(data);
    } catch (err) {
      console.warn('API unavailable, using fallback:', err.message);
      renderResult(FALLBACK, true);
      renderVisual(FALLBACK);
    } finally {
      demoBtn.disabled = false;
    }
  }

  // --- Render structured text output ---
  function renderResult(data, isFallback = false) {
    let html = '<div class="demo-result">';

    if (isFallback) {
      html += '<p style="color:var(--text-muted);margin-bottom:16px;font-family:var(--font-body);font-size:0.85rem;">Server offline \u2014 showing pre-computed example.</p>';
    }

    html += '<h4>Objects</h4><div>';
    (data.objects || []).forEach(o => {
      html += `<span class="obj-tag">${esc(o.name)} \u00b7 ${esc(o.material)} \u00b7 ${o.mass_kg ? esc(o.mass_kg) + ' kg' : 'static'} \u00b7 ${esc(o.state)}</span>`;
    });
    html += '</div>';

    html += '<h4>Forces</h4>';
    (data.forces || []).forEach(f => {
      const dir = f.direction;
      html += `<div class="force-row">${esc(f.type)} &nbsp; ${esc(f.source)} \u2192 ${esc(f.target)} &nbsp; ${esc(f.magnitude)} N &nbsp; (${esc(dir.x)}, ${esc(dir.y)}, ${esc(dir.z)})</div>`;
    });

    if (data.trajectories && data.trajectories.length > 0) {
      html += '<h4>Trajectories</h4>';
      data.trajectories.forEach(t => {
        html += `<div style="margin-bottom:8px"><strong style="color:var(--text-primary)">${esc(t.object_name)}</strong>: `;
        html += t.points.map(p => `t=${esc(p.t)}s (${esc(p.position.x)}, ${esc(p.position.y)}, ${esc(p.position.z)})`).join(' \u2192 ');
        html += '</div>';
      });
    }

    if (data.will_happen && data.will_happen.length > 0) {
      html += '<h4>Will Happen</h4><ul class="prediction-list">';
      data.will_happen.forEach(s => { html += `<li>${esc(s)}</li>`; });
      html += '</ul>';
    }
    if (data.wont_happen && data.wont_happen.length > 0) {
      html += '<h4>Won\'t Happen</h4><ul class="prediction-list wont-list">';
      data.wont_happen.forEach(s => { html += `<li>${esc(s)}</li>`; });
      html += '</ul>';
    }

    if (data.reasoning) {
      html += `<h4>Reasoning</h4><p class="reasoning-text">${esc(data.reasoning)}</p>`;
    }

    if (typeof data.confidence === 'number') {
      const pct = Math.round(data.confidence * 100);
      html += `<h4>Confidence: ${pct}%</h4>`;
      html += `<div class="confidence-bar"><div class="confidence-fill" style="width:${pct}%"></div></div>`;
    }

    html += '</div>';
    demoOutput.innerHTML = html;
  }

  // --- Render visual prediction (SVG scene with annotations) ---
  const MATERIAL_COLORS = {
    rubber: '#d94040', wood: '#8B6914', metal: '#9ca3af', glass: '#7dd3fc',
    plastic: '#f59e0b', stone: '#78716c', concrete: '#9ca3af', fabric: '#c084fc',
    paper: '#fef3c7', ceramic: '#fbbf24', ice: '#bae6fd', water: '#38bdf8',
    sand: '#d4a574', clay: '#b45309', foam: '#fde68a', leather: '#92400e',
    rope: '#a16207', wax: '#fef9c3'
  };

  function renderVisual(data) {
    const W = 512, H = 512;
    const objects = data.objects || [];
    const forces = data.forces || [];
    const trajectories = data.trajectories || [];

    // Build SVG
    let svg = `<svg class="vis-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#0d0d0d;border-radius:8px">`;

    // Arrowhead defs
    svg += `<defs>
      <marker id="vArrowG" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0 0L8 3L0 6" fill="#d3ffca"/></marker>
      <marker id="vArrowN" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0 0L8 3L0 6" fill="#a8d8a0"/></marker>
      <marker id="vArrowF" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0 0L8 3L0 6" fill="#fbbf24"/></marker>
    </defs>`;

    // Draw objects as rounded rects with labels
    objects.forEach(obj => {
      const b = obj.bbox;
      if (!b) return;
      const color = MATERIAL_COLORS[obj.material] || '#666';
      const isStatic = obj.state === 'static' && obj.mass_kg == null;
      const opacity = isStatic ? 0.4 : 0.8;
      const rx = obj.material === 'rubber' || obj.name.includes('ball') ? Math.min(b.w, b.h) / 2 : 4;

      svg += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${rx}" fill="${color}" opacity="${opacity}" stroke="${color}" stroke-width="1.5" stroke-opacity="0.6"/>`;
      // Label
      const lx = b.x + b.w / 2;
      const ly = b.y - 6;
      svg += `<text x="${lx}" y="${ly}" text-anchor="middle" fill="#fff" font-family="JetBrains Mono,monospace" font-size="10" opacity="0.8">${esc(obj.name)}</text>`;
    });

    // Draw forces as arrows from object center
    const objMap = {};
    objects.forEach(o => { if (o.bbox) objMap[o.name] = o; });

    forces.forEach(f => {
      const target = objMap[f.target];
      if (!target || !target.bbox) return;
      const b = target.bbox;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const dir = f.direction;
      // Scale arrow length by magnitude (capped)
      const len = Math.min(Math.max(f.magnitude * 3, 20), 80);
      // direction.y is physics (+y up), SVG is +y down, so flip
      const ex = cx + dir.x * len;
      const ey = cy - dir.y * len;
      const markerColor = f.type === 'gravity' ? 'vArrowG' : f.type === 'normal' ? 'vArrowN' : 'vArrowF';
      const strokeColor = f.type === 'gravity' ? '#d3ffca' : f.type === 'normal' ? '#a8d8a0' : '#fbbf24';

      svg += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="${strokeColor}" stroke-width="2" marker-end="url(#${markerColor})" opacity="0.8"/>`;
      // Force label
      const mx = (cx + ex) / 2 + 8;
      const my = (cy + ey) / 2;
      svg += `<text x="${mx}" y="${my}" fill="${strokeColor}" font-family="JetBrains Mono,monospace" font-size="8" opacity="0.7">${esc(f.type)} ${esc(f.magnitude)}N</text>`;
    });

    // Draw trajectories as dashed paths with ghost objects
    trajectories.forEach(traj => {
      const pts = traj.points;
      if (pts.length < 2) return;
      const obj = objMap[traj.object_name];
      if (!obj || !obj.bbox) return;

      // Map trajectory positions to pixel coords
      // Trajectory uses world coords where scene center ~ (0,0,0), 1 unit ~ 1m
      // We map relative to the object's current bbox center
      const bx = obj.bbox.x + obj.bbox.w / 2;
      const by = obj.bbox.y + obj.bbox.h / 2;
      const p0 = pts[0].position;
      const scale = 200; // pixels per world unit

      const mapped = pts.map(p => ({
        x: bx + (p.position.x - p0.x) * scale,
        y: by - (p.position.y - p0.y) * scale  // flip y
      }));

      // Dashed trajectory path
      let pathD = `M${mapped[0].x} ${mapped[0].y}`;
      for (let i = 1; i < mapped.length; i++) {
        pathD += ` L${mapped[i].x} ${mapped[i].y}`;
      }
      svg += `<path d="${pathD}" stroke="#d3ffca" stroke-width="2" stroke-dasharray="6 4" fill="none" opacity="0.6">`;
      svg += `<animate attributeName="stroke-dashoffset" values="20;0" dur="1.5s" repeatCount="indefinite"/>`;
      svg += `</path>`;

      // Ghost positions (skip first which is current)
      const ghostColor = MATERIAL_COLORS[obj.material] || '#666';
      for (let i = 1; i < mapped.length; i++) {
        const alpha = 0.15 + 0.05 * i;
        const r = Math.min(obj.bbox.w, obj.bbox.h) / 3;
        svg += `<circle cx="${mapped[i].x}" cy="${mapped[i].y}" r="${r}" fill="${ghostColor}" opacity="${Math.min(alpha, 0.3)}"/>`;
      }

      // Final position label
      const last = mapped[mapped.length - 1];
      const lastT = pts[pts.length - 1].t;
      svg += `<text x="${last.x + 10}" y="${last.y}" fill="#d3ffca" font-family="JetBrains Mono,monospace" font-size="9" opacity="0.7">t=${lastT}s</text>`;
    });

    // Title overlay
    svg += `<text x="${W / 2}" y="20" text-anchor="middle" fill="#d3ffca" font-family="Inter,sans-serif" font-size="11" font-weight="600" opacity="0.6">Visual Prediction</text>`;

    svg += '</svg>';
    demoVisual.innerHTML = svg;
  }
})();
