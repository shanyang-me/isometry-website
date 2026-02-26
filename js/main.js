// Efference — main.js

// ===== Brain-shaped neural network with physics symbols =====
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;

  // --- Config ---
  const BRAIN_NEURONS = 35;
  const SCATTER_NEURONS = 10;
  const AXON_DIST = 200;
  const FIRE_INTERVAL = 1500;
  const SIGNAL_SPEED = 1.2;

  // Physics symbols that float around
  const SYMBOLS = [
    'F=ma', 'g', '\u2193', '\u2192', '\u03C3', '\u0394p', 'N', '\u03C4',
    'E=\u00BDmv\u00B2', '\u2211F=0', 'mg', '\u03B1', '\u03C9', 'J',
    '\u222B', 'dx/dt', '\u2207', 'p=mv'
  ];

  let neurons = [];
  let axons = [];
  let signals = [];
  let symbols = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildNetwork();
  }
  window.addEventListener('resize', resize);

  // Brain silhouette: point-in-brain test using an ellipse + bumps
  function brainShape(x, y, cx, cy, rw, rh) {
    // Normalize to unit circle
    const nx = (x - cx) / rw;
    const ny = (y - cy) / rh;
    // Brain shape: two hemispheres with a slight dip in the middle (corpus callosum)
    const r = Math.sqrt(nx * nx + ny * ny);
    // Add lobes: frontal (front bulge), occipital (back), temporal (sides)
    const angle = Math.atan2(ny, nx);
    const lobe = 1.0
      + 0.12 * Math.cos(angle * 2)        // two-hemisphere shape
      + 0.08 * Math.cos(angle + 0.3)      // frontal lobe
      - 0.06 * Math.cos(angle * 3)        // temporal lobes
      + 0.05 * Math.sin(angle * 4);       // gyri bumps
    return r < lobe;
  }

  function buildNetwork() {
    neurons = [];
    axons = [];
    signals = [];
    symbols = [];

    // Brain center and size — spread across most of viewport
    const bcx = W * 0.5;
    const bcy = H * 0.4;
    const brw = Math.min(W * 0.48, 650);
    const brh = Math.min(H * 0.42, 500);

    // Place neurons inside brain shape
    let placed = 0;
    let attempts = 0;
    while (placed < BRAIN_NEURONS && attempts < 5000) {
      attempts++;
      const x = bcx + (Math.random() - 0.5) * brw * 2.6;
      const y = bcy + (Math.random() - 0.5) * brh * 2.6;
      if (brainShape(x, y, bcx, bcy, brw, brh)) {
        // Vary size — larger near center
        const distFromCenter = Math.sqrt((x - bcx) ** 2 + (y - bcy) ** 2);
        const maxDist = Math.sqrt(brw ** 2 + brh ** 2);
        const centralness = 1 - distFromCenter / maxDist;
        neurons.push({
          x, y,
          r: 1.5 + centralness * 2.5 + Math.random() * 1,
          firing: 0,
          refractory: 0,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.08,
          inBrain: true,
          // Dendrite branches
          dendrites: Math.floor(Math.random() * 4),
          dendriteAngle: Math.random() * Math.PI * 2,
        });
        placed++;
      }
    }

    // Scatter some neurons across the full viewport
    for (let i = 0; i < SCATTER_NEURONS; i++) {
      neurons.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1 + Math.random() * 1.5,
        firing: 0,
        refractory: 0,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        inBrain: false,
        dendrites: Math.floor(Math.random() * 2),
        dendriteAngle: Math.random() * Math.PI * 2,
      });
    }

    // Build axon connections
    for (let i = 0; i < neurons.length; i++) {
      for (let j = i + 1; j < neurons.length; j++) {
        const dx = neurons[i].x - neurons[j].x;
        const dy = neurons[i].y - neurons[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = (neurons[i].inBrain && neurons[j].inBrain) ? AXON_DIST : AXON_DIST * 0.7;
        if (dist < maxDist) {
          axons.push({ from: i, to: j, dist });
        }
      }
    }

    // Place floating physics symbols
    for (let i = 0; i < 20; i++) {
      symbols.push({
        text: SYMBOLS[i % SYMBOLS.length],
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.15,
        alpha: 0.18 + Math.random() * 0.15,
        size: 13 + Math.random() * 8,
        rotation: (Math.random() - 0.5) * 0.3,
        rotSpeed: (Math.random() - 0.5) * 0.001,
      });
    }
  }

  // --- Fire a neuron ---
  function fireNeuron(idx) {
    const n = neurons[idx];
    if (n.refractory > 0) return;
    n.firing = 1.0;
    n.refractory = 70;

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
        fromIdx: idx, toIdx: target,
        sx: n.x, sy: n.y,
        dx, dy, dist,
        progress: 0,
        speed: SIGNAL_SPEED / dist,
      });
    }
  }

  let lastFire = 0;
  function maybeFireRandom(time) {
    if (time - lastFire > FIRE_INTERVAL) {
      lastFire = time;
      const count = 1 + Math.floor(Math.random() * 2);
      for (let c = 0; c < count; c++) {
        fireNeuron(Math.floor(Math.random() * neurons.length));
      }
    }
  }

  function update() {
    for (const n of neurons) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -40) n.vx = Math.abs(n.vx);
      if (n.x > W + 40) n.vx = -Math.abs(n.vx);
      if (n.y < -40) n.vy = Math.abs(n.vy);
      if (n.y > H + 40) n.vy = -Math.abs(n.vy);
      if (n.firing > 0) n.firing *= 0.94;
      if (n.firing < 0.01) n.firing = 0;
      if (n.refractory > 0) n.refractory--;
    }

    for (let i = signals.length - 1; i >= 0; i--) {
      const s = signals[i];
      s.progress += s.speed;
      if (s.progress >= 1) {
        if (Math.random() < 0.5) fireNeuron(s.toIdx);
        signals.splice(i, 1);
      }
    }

    // Drift symbols
    for (const s of symbols) {
      s.x += s.vx;
      s.y += s.vy;
      s.rotation += s.rotSpeed;
      if (s.x < -40) s.x = W + 40;
      if (s.x > W + 40) s.x = -40;
      if (s.y < -40) s.y = H + 40;
      if (s.y > H + 40) s.y = -40;
    }
  }

  function draw() {
    // Fill dark background
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, W, H);

    // Brain outline glow
    const bcx = W * 0.5;
    const bcy = H * 0.38;
    const brw = Math.min(W * 0.38, 500);
    const brh = Math.min(H * 0.32, 380);
    const grad = ctx.createRadialGradient(bcx, bcy, 0, bcx, bcy, Math.max(brw, brh));
    grad.addColorStop(0, 'rgba(211,255,202,0.08)');
    grad.addColorStop(0.5, 'rgba(211,255,202,0.04)');
    grad.addColorStop(1, 'rgba(211,255,202,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Axons (with subtle curves for dendrite feel)
    for (const ax of axons) {
      const a = neurons[ax.from];
      const b = neurons[ax.to];
      const bright = Math.max(a.firing, b.firing);
      const alpha = 0.09 + bright * 0.3;
      ctx.beginPath();
      const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.1;
      const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.1;
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.strokeStyle = `rgba(211,255,202,${alpha})`;
      ctx.lineWidth = 0.5 + bright * 1.2;
      ctx.stroke();
    }

    // Dendrite branches on neurons
    for (const n of neurons) {
      if (n.dendrites === 0) continue;
      const f = n.firing;
      const alpha = 0.1 + f * 0.25;
      ctx.strokeStyle = `rgba(211,255,202,${alpha})`;
      ctx.lineWidth = 0.6;
      for (let d = 0; d < n.dendrites; d++) {
        const angle = n.dendriteAngle + (d * Math.PI * 2 / n.dendrites);
        const len = n.r * 4 + Math.random() * 3;
        const ex = n.x + Math.cos(angle) * len;
        const ey = n.y + Math.sin(angle) * len;
        // Branching fork
        const mid = 0.6;
        const mx = n.x + Math.cos(angle) * len * mid;
        const my = n.y + Math.sin(angle) * len * mid;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        // Fork
        const forkAngle = 0.5;
        const forkLen = len * 0.4;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(angle + forkAngle) * forkLen, my + Math.sin(angle + forkAngle) * forkLen);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(angle - forkAngle) * forkLen, my + Math.sin(angle - forkAngle) * forkLen);
        ctx.stroke();
      }
    }

    // Action potential signals
    for (const s of signals) {
      const px = s.sx + s.dx * s.progress;
      const py = s.sy + s.dy * s.progress;
      const glow = 1 - Math.abs(s.progress - 0.5) * 2;

      ctx.beginPath();
      ctx.arc(px, py, 4 + glow * 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(211,255,202,${0.12 + glow * 0.25})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, 1.5 + glow * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(211,255,202,${0.5 + glow * 0.35})`;
      ctx.fill();
    }

    // Neurons (soma)
    for (const n of neurons) {
      const f = n.firing;

      // Firing glow
      if (f > 0.05) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 8 + f * 14, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(211,255,202,${f * 0.16})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 3 + f * 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(211,255,202,${f * 0.28})`;
        ctx.fill();
      }

      // Soma
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = f > 0.05
        ? `rgba(211,255,202,${0.3 + f * 0.5})`
        : `rgba(211,255,202,${n.inBrain ? 0.22 : 0.12})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.strokeStyle = f > 0.05
        ? `rgba(211,255,202,${0.4 + f * 0.4})`
        : `rgba(211,255,202,${n.inBrain ? 0.3 : 0.18})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    // Physics symbols (floating, translucent)
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of symbols) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.fillStyle = `rgba(211,255,202,${Math.min(s.alpha * 2.5, 0.55)})`;
      ctx.font = `500 ${s.size}px "JetBrains Mono", monospace`;
      ctx.fillText(s.text, 0, 0);
      ctx.restore();
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

  // Initialize and start animation
  resize();
  requestAnimationFrame(loop);
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
  const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : 'https://alexyangshan--efference-api.modal.run';
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

  function loadExample() {
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

    // Fill the text input for reference
    demoInput.value = EXAMPLE_DESCRIPTION;

    // Render with fallback data immediately (no server needed)
    renderResult(FALLBACK, false);
    renderVisual(FALLBACK);
  }

  exampleBtn.addEventListener('click', loadExample);

  // Example loads only when button is clicked

  demoBtn.addEventListener('click', async () => {
    if (currentMode === 'text') {
      const scene = demoInput.value.trim();
      if (!scene) { demoInput.focus(); return; }
      await runAnalysis({ scene });
    } else {
      // If there's a text description (e.g. from example), use that for analysis
      const scene = demoInput.value.trim();
      if (scene) {
        await runAnalysis({ scene });
      } else if (uploadedFile) {
        await runAnalysis({ image: uploadedFile });
      } else {
        dropzone.click();
      }
    }
  });

  async function waitForModel() {
    const maxWait = 90000; // 90 seconds max
    const pollInterval = 2000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      try {
        const res = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok') return true;
        }
      } catch (e) { /* server not up yet */ }
      await new Promise(r => setTimeout(r, pollInterval));
    }
    return false;
  }

  async function runAnalysis(input) {
    demoOutput.innerHTML = '<div class="demo-loading">Waking up server...</div>';
    demoVisual.innerHTML = '<div class="demo-loading" style="text-align:center">Generating visual prediction...</div>';
    demoBtn.disabled = true;

    try {
      const ready = await waitForModel();
      if (!ready) throw new Error('Server did not become ready in time');

      demoOutput.innerHTML = '<div class="demo-loading">Analyzing scene (10-30s)...</div>';

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
        signal: AbortSignal.timeout(120000)
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      renderResult(data);
      renderVisual(data);
    } catch (err) {
      console.error('Analysis failed:', err);
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
