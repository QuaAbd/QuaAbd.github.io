/* =========================================================
   Moving research watermarks
   One canvas behind the page. The scene is chosen by
   <body data-watermark="...">:
     sandpile   – Abelian sandpile growing from a single site
     pattern    – Gray–Scott reaction–diffusion (pattern formation)
     powerlaw   – avalanche statistics building up P(s) ~ s^-tau
     noise      – white, 1/f and Brownian noise traces
     modular    – multiplication table  x -> k x (mod N) on a circle
   Drifting formulas (number theory, algebra, SOC) float on top.
   Respects prefers-reduced-motion (draws one still frame).
========================================================= */
(function () {
  "use strict";

  var body = document.body;
  var sceneName = body.getAttribute("data-watermark") || "sandpile";
  if (sceneName === "none") return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas = document.createElement("canvas");
  canvas.className = "wm-canvas";
  canvas.setAttribute("aria-hidden", "true");
  body.insertBefore(canvas, body.firstChild);
  var ctx = canvas.getContext("2d");

  var INK = "200, 214, 235";
  var BLUE = "110, 168, 255";
  var AMBER = "240, 179, 90";
  var CYAN = "64, 224, 208", VIOLET = "167, 120, 255", PINK = "255, 105, 180";
  var STOPS = [[13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33]];
  function cmap(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var x = t * (STOPS.length - 1), i = Math.min(STOPS.length - 2, x | 0), f = x - i, a = STOPS[i], b = STOPS[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  var LUT = []; for (var li = 0; li < 256; li++) LUT.push(cmap(li / 255));

  var W = 0, H = 0, dpr = 1, t0 = performance.now();

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function isNarrow() { return W < 760; }

  /* ---------- where the main figure sits ---------- */
  function stage() {
    if (isNarrow()) {
      var s = Math.min(W * 0.95, H * 0.6);
      return { x: (W - s) / 2, y: H - s - 20, s: s };
    }
    var size = Math.min(W * 0.40, H * 0.80);
    return { x: W - size - Math.max(20, W * 0.03), y: (H - size) / 2 + 30, s: size };
  }

  /* =======================================================
     SCENE 1 — Abelian sandpile from a single site
  ======================================================= */
  function Sandpile() {
    var n = 151, N = n * n, c = (n * n - 1) / 2;
    var h, queue, inQ, qHead, qTail, grains, active, done, holdUntil;
    var off = document.createElement("canvas");
    off.width = n; off.height = n;
    var octx = off.getContext("2d");
    var img = octx.createImageData(n, n);

    function reset() {
      h = new Int32Array(N);
      active = new Uint8Array(N);
      queue = new Int32Array(N * 4); inQ = new Uint8Array(N);
      qHead = 0; qTail = 0; grains = 0; done = false; holdUntil = 0;
      drop(Math.pow(2, 13));
      relax(1e9);                 // start from the stable fractal
      active.fill(0);
    }
    function push(i) { if (!inQ[i]) { inQ[i] = 1; queue[qTail] = i; qTail = (qTail + 1) % queue.length; } }
    function drop(k) { h[c] += k; grains += k; push(c); }

    function relax(budget) {
      while (qHead !== qTail && budget-- > 0) {
        var i = queue[qHead]; qHead = (qHead + 1) % queue.length; inQ[i] = 0;
        if (h[i] < 4) continue;
        var q = h[i] >> 2; h[i] -= 4 * q; active[i] = 255;
        var x = i % n, y = (i / n) | 0;
        if (x > 0) { h[i - 1] += q; push(i - 1); } else done = true;
        if (x < n - 1) { h[i + 1] += q; push(i + 1); } else done = true;
        if (y > 0) { h[i - n] += q; push(i - n); } else done = true;
        if (y < n - 1) { h[i + n] += q; push(i + n); } else done = true;
      }
      return qHead === qTail;
    }

    reset();

    return {
      step: function (now) {
        if (holdUntil) { if (now > holdUntil) reset(); return; }
        if (reduce) return;
        if (done || grains > 52000) { holdUntil = now + 4000; return; }
        drop(16);                   // grains keep arriving at the origin; the fractal grows
        relax(1e9);
      },
      draw: function () {
        var st = stage(), d = img.data;
        // h = 0,1,2,3 : empty, blue, ink, amber
        var pal = [[0, 0, 0, 0], [64, 224, 208, 150], [167, 120, 255, 190], [255, 160, 70, 230]];
        for (var i = 0; i < N; i++) {
          var c4 = pal[h[i] > 3 ? 3 : h[i]], p = i * 4;
          d[p] = c4[0]; d[p + 1] = c4[1]; d[p + 2] = c4[2]; d[p + 3] = c4[3];
        }
        octx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
        ctx.drawImage(off, st.x, st.y, st.s, st.s);
        ctx.globalAlpha = 1;
        label(st, "Abelian sandpile  ·  h(x) ∈ ℤ/4ℤ  ·  " + grains.toLocaleString("en-US") + " grains");
      }
    };
  }

  /* =======================================================
     SCENE 2 — Gray–Scott reaction–diffusion
  ======================================================= */
  function Pattern() {
    var gw = 150, gh = 150, u, v, u2, v2;
    var off = document.createElement("canvas");
    off.width = gw; off.height = gh;
    var octx = off.getContext("2d");
    var img = octx.createImageData(gw, gh);
    var F = 0.029, K = 0.057, Du = 1.0, Dv = 0.5;

    function seed(cx, cy, r) {
      for (var y = cy - r; y <= cy + r; y++) for (var x = cx - r; x <= cx + r; x++) {
        var xx = (x + gw) % gw, yy = (y + gh) % gh, i = yy * gw + xx;
        u[i] = 0.5; v[i] = 0.25 + rnd(-0.02, 0.02);
      }
    }
    function reset() {
      u = new Float32Array(gw * gh).fill(1); v = new Float32Array(gw * gh);
      u2 = new Float32Array(gw * gh); v2 = new Float32Array(gw * gh);
      for (var k = 0; k < 22; k++) seed((rnd(0, gw)) | 0, (rnd(0, gh)) | 0, 3);
    }
    function iterate() {
      for (var y = 0; y < gh; y++) {
        var ym = ((y - 1 + gh) % gh) * gw, y0 = y * gw, yp = ((y + 1) % gh) * gw;
        for (var x = 0; x < gw; x++) {
          var xm = (x - 1 + gw) % gw, xp = (x + 1) % gw, i = y0 + x;
          var lu = 0.2 * (u[y0 + xm] + u[y0 + xp] + u[ym + x] + u[yp + x]) +
                   0.05 * (u[ym + xm] + u[ym + xp] + u[yp + xm] + u[yp + xp]) - u[i];
          var lv = 0.2 * (v[y0 + xm] + v[y0 + xp] + v[ym + x] + v[yp + x]) +
                   0.05 * (v[ym + xm] + v[ym + xp] + v[yp + xm] + v[yp + xp]) - v[i];
          var uvv = u[i] * v[i] * v[i];
          u2[i] = u[i] + Du * lu - uvv + F * (1 - u[i]);
          v2[i] = v[i] + Dv * lv + uvv - (F + K) * v[i];
        }
      }
      var a = u; u = u2; u2 = a; a = v; v = v2; v2 = a;
    }
    reset();
    for (var r = 0; r < (reduce ? 2500 : 700); r++) iterate();
    var frames = 0;

    return {
      step: function () {
        if (reduce) return;
        for (var k = 0; k < 8; k++) iterate();
        frames++;
        if (frames % 900 === 0) seed((rnd(0, gw)) | 0, (rnd(0, gh)) | 0, 4);
        if (frames > 9000) { reset(); for (var r2 = 0; r2 < 700; r2++) iterate(); frames = 0; }
      },
      draw: function () {
        var st = stage(), d = img.data;
        for (var i = 0; i < gw * gh; i++) {
          var a = Math.min(1, Math.max(0, (v[i] - 0.05) * 3.2));
          var p = i * 4;
          var cc = LUT[(a * 255) | 0]; d[p] = cc[0]; d[p + 1] = cc[1]; d[p + 2] = cc[2]; d[p + 3] = Math.min(255, a * 420);
        }
        octx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.beginPath(); ctx.arc(st.x + st.s / 2, st.y + st.s / 2, st.s / 2, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(off, st.x, st.y, st.s, st.s);
        ctx.restore();
        ctx.strokeStyle = "rgba(" + INK + ",0.25)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(st.x + st.s / 2, st.y + st.s / 2, st.s / 2, 0, Math.PI * 2); ctx.stroke();
        label(st, "∂ₜu = Dᵤ∇²u − uv² + F(1−u)    ∂ₜv = Dᵥ∇²v + uv² − (F+k)v");
      }
    };
  }

  /* =======================================================
     SCENE 3 — avalanche statistics, P(s) ~ s^-tau
  ======================================================= */
  function PowerLaw() {
    var tau = 1.5, smax = 1e5, nb = 34, base = Math.pow(smax, 1 / nb);
    var counts, total, series, started;
    function reset() { counts = new Float64Array(nb); total = 0; series = []; started = performance.now(); }
    function sample() {
      var s = Math.floor(Math.pow(1 - Math.random(), -1 / (tau - 1)));
      if (s > smax * Math.exp(-rnd(0, 1.2))) s = Math.floor(smax * Math.exp(-rnd(0, 1.2)));
      return Math.max(1, s);
    }
    reset();
    if (reduce) for (var k = 0; k < 120000; k++) add(sample());
    function add(s) {
      var b = Math.min(nb - 1, Math.floor(Math.log(s) / Math.log(base)));
      counts[b]++; total++;
    }
    return {
      step: function (now) {
        if (reduce) return;
        for (var k = 0; k < 160; k++) add(sample());
        var s = sample(); series.push(s); if (series.length > 260) series.shift();
        if (now - started > 45000) reset();
      },
      draw: function () {
        var st = stage(), pad = st.s * 0.1;
        var x0 = st.x + pad, y0 = st.y + st.s * 0.72, x1 = st.x + st.s - pad / 2, y1 = st.y + pad / 2;
        var lx = function (s) { return x0 + (x1 - x0) * Math.log(s) / Math.log(smax); };
        var ymin = -11, ymax = 0;
        var ly = function (p) { return y0 + (y1 - y0) * (Math.log10(p) - ymin) / (ymax - ymin); };
        ctx.strokeStyle = "rgba(" + INK + ",0.45)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
        ctx.fillStyle = "rgba(" + INK + ",0.5)"; ctx.font = "italic 13px Georgia, serif";
        for (var e = 0; e <= 5; e++) {
          var X = lx(Math.pow(10, e));
          ctx.beginPath(); ctx.moveTo(X, y0); ctx.lineTo(X, y0 + 6); ctx.stroke();
          ctx.fillText("10" + sup(e), X - 8, y0 + 22);
        }
        ctx.fillText("s", x1 - 6, y0 + 40);
        ctx.fillText("P(s)", x0 - 34, y1 + 4);
        // theory line
        ctx.setLineDash([6, 6]); ctx.strokeStyle = "rgba(" + AMBER + ",0.75)"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(lx(1), ly(0.5)); ctx.lineTo(lx(smax), ly(0.5 * Math.pow(smax, -tau))); ctx.stroke();
        ctx.setLineDash([]);
        // data
        if (total > 0) for (var b = 0; b < nb; b++) {
          if (!counts[b]) continue;
          var lo = Math.pow(base, b), hi = Math.pow(base, b + 1);
          var p = counts[b] / (total * (hi - lo));
          var mid = Math.sqrt(lo * hi);
          var cc2 = cmap(0.25 + 0.75 * b / nb); ctx.fillStyle = "rgba(" + (cc2[0] | 0) + "," + (cc2[1] | 0) + "," + (cc2[2] | 0) + ",0.95)";
          ctx.beginPath(); ctx.arc(lx(mid), ly(p), 4.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "rgba(" + AMBER + ",0.9)"; ctx.font = "italic 20px Georgia, serif";
        var tx = lx(30), tyy = ly(1e-2);
        ctx.fillText("P(s) ∼ s", tx, tyy);
        var wsx = ctx.measureText("P(s) ∼ s").width;
        ctx.font = "italic 14px Georgia, serif"; ctx.fillText("−τ", tx + wsx + 1, tyy - 9);
        ctx.font = "italic 20px Georgia, serif"; ctx.fillText(",  τ = 3/2", tx + wsx + 22, tyy);
        // avalanche time series
        var ty = st.y + st.s * 0.9, th = st.s * 0.12;
        ctx.strokeStyle = "rgba(" + INK + ",0.55)"; ctx.lineWidth = 1;
        ctx.beginPath();
        for (var j = 0; j < series.length; j++) {
          var X2 = x0 + (x1 - x0) * j / 260, hgt = th * Math.log(series[j] + 1) / Math.log(smax);
          ctx.moveTo(X2, ty); ctx.lineTo(X2, ty - hgt);
        }
        ctx.stroke();
        label(st, "avalanche sizes  ·  " + total.toLocaleString("en-US") + " events");
      }
    };
  }

  /* =======================================================
     SCENE 4 — white, pink (1/f) and Brownian noise
  ======================================================= */
  function Noise() {
    var len = 360, tr = [[], [], []];
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, brown = 0;
    function next() {
      var w = rnd(-1, 1);
      // Paul Kellet's pink filter
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      var pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.16; b6 = w * 0.115926;
      brown = 0.995 * brown + w * 0.09;
      tr[0].push(w * 0.55); tr[1].push(pink); tr[2].push(brown * 0.8);
      for (var k = 0; k < 3; k++) if (tr[k].length > len) tr[k].shift();
    }
    for (var k = 0; k < len; k++) next();
    var names = ["α = 0   white", "α = 1   1/f  (pink)", "α = 2   1/f²  (Brownian)"];
    return {
      step: function () { if (!reduce) { next(); next(); } },
      draw: function () {
        var st = stage(), rowH = st.s / 3.4;
        for (var r = 0; r < 3; r++) {
          var yc = st.y + rowH * (r + 0.75);
          ctx.strokeStyle = "rgba(" + [CYAN, PINK, VIOLET][r] + ",0.85)";
          ctx.lineWidth = 1.3; ctx.beginPath();
          for (var j = 0; j < tr[r].length; j++) {
            var X = st.x + st.s * j / len, Y = yc - tr[r][j] * rowH * 0.42;
            if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
          }
          ctx.stroke();
          ctx.fillStyle = "rgba(" + INK + ",0.55)"; ctx.font = "italic 14px Georgia, serif";
          ctx.fillText(names[r], st.x, yc - rowH * 0.45);
        }
        label(st, "S(f) ∼ 1/f^α");
      }
    };
  }

  /* =======================================================
     SCENE 5 — modular multiplication  x ↦ kx (mod N)
  ======================================================= */
  function Modular() {
    var Nn = 240, k = 2;
    return {
      step: function () { if (!reduce) { k += 0.0016; if (k > 51) k = 2; } else k = 2; },
      draw: function () {
        var st = stage(), cx = st.x + st.s / 2, cy = st.y + st.s / 2, R = st.s * 0.46;
        ctx.strokeStyle = "rgba(" + INK + ",0.35)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 0.9;
        for (var i = 0; i < Nn; i++) {
          var a = 2 * Math.PI * i / Nn - Math.PI / 2, b = 2 * Math.PI * ((k * i) % Nn) / Nn - Math.PI / 2;
          ctx.strokeStyle = "hsla(" + ((360 * i / Nn + k * 20) % 360) + ",85%,62%,0.45)";
          ctx.beginPath();
          ctx.moveTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
          ctx.lineTo(cx + R * Math.cos(b), cy + R * Math.sin(b));
          ctx.stroke();
        }
        label(st, "x ↦ " + k.toFixed(2) + "·x  (mod " + Nn + ")");
      }
    };
  }

  /* ---------- drifting formulas ---------- */
  var FORMULAS = [
    "ζ(s) = Σ n⁻ˢ", "ℤⁿ / Δℤⁿ", "Δ = D − A", "a ≡ b (mod p)", "φ(n)", "μ(n)",
    "z꜀ = 4", "P(s) ∼ s⁻τ", "S(f) ∼ 1/fᵅ", "⟨s⟩ ∼ Lᴰ", "ζₙ = e^(2πi/n)", "π(x) ∼ x / log x",
    "τ = 3/2", "∇²u", "GL₂(ℤ)", "p ∣ n", "|K(G)| = det Δ′", "H > 1/2", "ℚₚ", "x² + y² = p"
  ];
  var glyphs = [];
  function makeGlyphs() {
    glyphs = [];
    var count = isNarrow() ? 8 : 15;
    for (var i = 0; i < count; i++) {
      glyphs.push({
        t: FORMULAS[(i * 7 + (Math.random() * FORMULAS.length) | 0) % FORMULAS.length],
        x: rnd(0, W), y: rnd(0, H), vx: rnd(-0.12, 0.12), vy: rnd(-0.08, 0.08),
        size: rnd(15, 30), rot: rnd(-0.25, 0.25), a: rnd(0.25, 0.5),
        c: [AMBER, CYAN, VIOLET, PINK, INK][(Math.random() * 5) | 0]
      });
    }
  }
  function drawGlyphs() {
    ctx.textBaseline = "middle";
    for (var i = 0; i < glyphs.length; i++) {
      var g = glyphs[i];
      if (!reduce) { g.x += g.vx; g.y += g.vy; }
      if (g.x < -200) g.x = W + 100; if (g.x > W + 200) g.x = -100;
      if (g.y < -60) g.y = H + 40; if (g.y > H + 60) g.y = -40;
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rot);
      ctx.fillStyle = "rgba(" + g.c + "," + g.a + ")";
      ctx.font = "italic " + g.size + "px Georgia, 'Times New Roman', serif";
      ctx.fillText(g.t, 0, 0); ctx.restore();
    }
    ctx.textBaseline = "alphabetic";
  }

  function label(st, text) {
    ctx.fillStyle = "rgba(" + INK + ",0.5)";
    ctx.font = "italic 14px Georgia, serif";
    ctx.fillText(text, st.x, st.y + st.s + 22 > H - 4 ? st.y - 10 : st.y + st.s + 22);
  }
  function sup(e) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[e]; }

  var SCENES = { sandpile: Sandpile, pattern: Pattern, powerlaw: PowerLaw, noise: Noise, modular: Modular };
  var scene = (SCENES[sceneName] || Sandpile)();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeGlyphs();
  }

  var last = 0;
  function frame(now) {
    if (!document.hidden && now - last > 33) {
      last = now;
      scene.step(now);
      ctx.clearRect(0, 0, W, H);
      scene.draw();
      drawGlyphs();
    }
    if (!reduce) requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", function () { resize(); if (reduce) frame(performance.now() + 100); });
  requestAnimationFrame(frame);
})();
