/* Kit de EduCloud para recursos interactivos (se ejecuta dentro del sandbox aislado).
   Expone window.EC. No hay red ni almacenamiento: todo se comunica con el anfitrión por mensajes acotados. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var EC = {};

  function post(t, data) {
    try {
      var msg = { ec: 1, t: t };
      for (var k in data) msg[k] = data[k];
      parent.postMessage(msg, "*");
    } catch (_) {
      /* sin anfitrión */
    }
  }

  /* ---------- utilidades ---------- */
  function $(s, r) {
    return typeof s === "string" ? (r || document).querySelector(s) : s;
  }
  function $$(s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  }
  function svg(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }
  EC.$ = $;
  EC.$$ = $$;
  EC.svg = svg;
  EC.clamp = clamp;
  EC.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };
  EC.ease = {
    out: function (t) {
      return 1 - Math.pow(1 - t, 3);
    },
    inOut: function (t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    back: function (t) {
      var c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
  };
  EC.fmt = function (n, d) {
    var digits = d === undefined ? 2 : d;
    if (!isFinite(n)) return "—";
    return Number(n).toLocaleString("es-MX", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };
  EC.color = function (c) {
    if (!c) return "var(--s1)";
    return /^s[1-6]$/.test(c) ? "var(--" + c + ")" : c;
  };

  /* ---------- movimiento ---------- */
  EC.tween = function (from, to, ms, fn, ease) {
    var easing = ease || EC.ease.out;
    if (reduce || ms <= 0) {
      fn(to);
      return { cancel: function () {} };
    }
    var start = performance.now(),
      id = 0,
      dead = false;
    function frame(now) {
      if (dead) return;
      var t = clamp((now - start) / ms, 0, 1);
      fn(from + (to - from) * easing(t));
      if (t < 1) id = requestAnimationFrame(frame);
    }
    id = requestAnimationFrame(frame);
    return {
      cancel: function () {
        dead = true;
        cancelAnimationFrame(id);
      },
    };
  };
  EC.bump = function (el) {
    el = $(el);
    if (!el) return;
    el.classList.remove("ec-bump");
    void el.offsetWidth;
    el.classList.add("ec-bump");
  };
  EC.shake = function (el) {
    el = $(el);
    if (!el) return;
    el.classList.remove("ec-shake");
    void el.offsetWidth;
    el.classList.add("ec-shake");
  };
  EC.pulse = function (el) {
    el = $(el);
    if (!el) return;
    el.classList.remove("ec-pulse");
    void el.offsetWidth;
    el.classList.add("ec-pulse");
  };
  /* Cambia un número mostrado con una animación corta. opts: {d: decimales, unit: "V", ms} */
  EC.count = function (el, to, opts) {
    el = $(el);
    if (!el) return;
    var o = opts || {};
    var d = o.d === undefined ? 2 : o.d;
    var from = typeof el.__ecv === "number" ? el.__ecv : to;
    if (el.__ect) el.__ect.cancel();
    /* El número y la unidad van en nodos distintos: la unidad se ve más pequeña y no parte el renglón. */
    if (!el.__ecn || el.__ecn.parentNode !== el) {
      el.textContent = "";
      el.__ecn = document.createTextNode("");
      el.appendChild(el.__ecn);
      el.__ecu = document.createElement("span");
      el.__ecu.className = "ec-unit";
      el.appendChild(el.__ecu);
    }
    el.__ecu.textContent = o.unit ? " " + o.unit : "";
    el.__ect = EC.tween(
      from,
      to,
      o.ms === undefined ? 320 : o.ms,
      function (v) {
        el.__ecn.nodeValue = EC.fmt(v, d);
        el.__ecv = v;
      },
    );
    if (from !== to) EC.bump(el);
  };
  EC.celebrate = function (where) {
    if (reduce) return;
    var box = $(where);
    var r = box
      ? box.getBoundingClientRect()
      : { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
    var cx = r.left + r.width / 2,
      cy = r.top + r.height / 2;
    var colors = ["#b59957", "#122245", "#2f7f86", "#b4552d", "#6a5a9a"];
    for (var i = 0; i < 26; i++) {
      var p = document.createElement("i");
      p.className = "ec-confetti";
      var ang = Math.random() * Math.PI * 2,
        dist = 60 + Math.random() * 120;
      p.style.left = cx + "px";
      p.style.top = cy + "px";
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", Math.sin(ang) * dist - 40 + "px");
      p.style.setProperty(
        "--rot",
        Math.round(Math.random() * 540 - 270) + "deg",
      );
      p.style.setProperty("--c", colors[i % colors.length]);
      document.body.appendChild(p);
      setTimeout(
        (function (n) {
          return function () {
            n.remove();
          };
        })(p),
        1100,
      );
    }
  };

  /* ---------- estado y mensajes ---------- */
  EC.state =
    window.__EC_STATE && typeof window.__EC_STATE === "object"
      ? window.__EC_STATE
      : {};
  var saveTimer = 0;
  EC.save = function (obj) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        var json = JSON.stringify(obj);
        if (json && json.length <= 40000)
          post("state", { value: JSON.parse(json) });
      } catch (_) {
        /* estado no serializable */
      }
    }, 250);
  };
  EC.report = function (text) {
    post("report", { value: String(text).slice(0, 3000) });
  };

  /* ---------- matemáticas (las dibuja el anfitrión con KaTeX) ---------- */
  var mathId = 0,
    mathWait = {};
  EC.math = function (el, latex, opts) {
    el = $(el);
    if (!el) return;
    var key = (opts && opts.display ? "D:" : "I:") + latex;
    if (el.__ecm === key) return;
    el.__ecm = key;
    var id = ++mathId;
    mathWait[id] = el;
    post("math", {
      id: id,
      latex: String(latex).slice(0, 1500),
      display: !!(opts && opts.display),
    });
  };
  addEventListener("message", function (e) {
    var d = e.data;
    if (e.source !== parent || !d || d.ec !== 1) return;
    if (d.t === "math-result" && mathWait[d.id]) {
      mathWait[d.id].innerHTML = d.html;
      delete mathWait[d.id];
    }
  });

  /* ---------- controles ---------- */
  function syncRange(el) {
    var min = parseFloat(el.min || "0"),
      max = parseFloat(el.max || "100"),
      v = parseFloat(el.value);
    var pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
    el.style.setProperty("--pct", clamp(pct, 0, 100) + "%");
  }
  EC.sync = function (el) {
    if (el) syncRange($(el));
    else $$('input[type="range"]').forEach(syncRange);
  };
  EC.set = function (el, v) {
    el = $(el);
    if (!el) return;
    el.value = v;
    if (el.type === "range") syncRange(el);
  };
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t && t.type === "range") syncRange(t);
  });
  EC.sync();

  /* Arrastre unificado (ratón, dedo y lápiz). fn(ev, fase) con fase "start" | "move" | "end". */
  EC.drag = function (el, fn) {
    el = $(el);
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", function (ev) {
      el.setPointerCapture(ev.pointerId);
      fn(ev, "start");
      function move(e2) {
        fn(e2, "move");
      }
      function up(e3) {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        fn(e3, "end");
      }
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  };

  /* ---------- canvas con bucle de animación ---------- */
  EC.canvas = function (host, o) {
    host = $(host);
    o = o || {};
    var aspect = o.aspect || 1.6;
    var canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;aspect-ratio:" + aspect;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", o.label || "Animación");
    host.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var api = { canvas: canvas, ctx: ctx, width: 0, height: 0, t: 0 };
    var running = false,
      raf = 0,
      last = 0;
    function resize() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(r.width)),
        h = Math.max(1, Math.round(r.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      api.width = w;
      api.height = h;
      draw(0);
    }
    function draw(dt) {
      if (!api.width) return;
      ctx.clearRect(0, 0, api.width, api.height);
      if (o.draw) o.draw(ctx, api.width, api.height, api.t, dt, api);
    }
    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      api.t += dt;
      draw(dt);
      raf = requestAnimationFrame(frame);
    }
    api.start = function () {
      if (running || reduce) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    api.stop = function () {
      running = false;
      cancelAnimationFrame(raf);
    };
    api.redraw = function () {
      draw(0);
    };
    api.reset = function () {
      api.t = 0;
      draw(0);
    };
    new ResizeObserver(resize).observe(canvas);
    resize();
    if (o.animate) api.start();
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) api.stop();
      else if (o.animate) api.start();
    });
    return api;
  };

  /* ---------- gráficas ---------- */
  function niceTicks(lo, hi, count) {
    var span = hi - lo;
    if (!(span > 0)) return [lo];
    var raw = span / count,
      mag = Math.pow(10, Math.floor(Math.log10(raw))),
      norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    var out = [];
    for (
      var v = Math.ceil(lo / step - 1e-9) * step;
      v <= hi + step * 1e-6;
      v += step
    ) {
      out.push(Math.round(v / step) * step);
    }
    return out;
  }
  function tickText(v) {
    var a = Math.abs(v);
    if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(1);
    return String(parseFloat(v.toPrecision(6)));
  }
  var chartCount = 0;
  var DEFAULT_COLORS = ["s1", "s4", "s3", "s5", "s6", "s2"];

  EC.chart = function (host, o) {
    host = $(host);
    o = o || {};
    var W = 640,
      aspect = o.aspect || 1.6,
      H = Math.round(W / aspect);
    var m = { l: o.yLabel ? 58 : 46, r: 20, t: 18, b: o.xLabel ? 50 : 36 };
    var xd = (o.xDomain || [-5, 5]).slice();
    var yd = o.yDomain && o.yDomain !== "auto" ? o.yDomain.slice() : null;
    var autoY = !yd;
    if (!yd) yd = [-5, 5];
    var uid = "ec" + ++chartCount;
    var el = svg(
      "svg",
      {
        viewBox: "0 0 " + W + " " + H,
        class: "ec-svg",
        role: "img",
        "aria-label": o.label || "Gráfica",
      },
      host,
    );
    el.style.touchAction = "pan-y";
    var defs = svg("defs", null, el);
    var clip = svg("clipPath", { id: uid + "c" }, defs);
    var clipRect = svg("rect", {}, clip);
    var gGrid = svg("g", null, el),
      gAreas = svg("g", { "clip-path": "url(#" + uid + "c)" }, el),
      gAxes = svg("g", null, el),
      gSeries = svg("g", { "clip-path": "url(#" + uid + "c)" }, el),
      gGuides = svg("g", { "clip-path": "url(#" + uid + "c)" }, el),
      gMarkers = svg("g", null, el),
      gTip = svg(
        "g",
        { class: "ec-tip", visibility: "hidden", "pointer-events": "none" },
        el,
      );
    var legend = document.createElement("div");
    legend.className = "ec-legend";
    if (o.legend !== false) host.appendChild(legend);
    var data = { series: [], markers: [], vlines: [], hlines: [], areas: [] };
    var seen = {};
    var markerEls = {};

    function sx(x) {
      return m.l + ((x - xd[0]) / (xd[1] - xd[0])) * (W - m.l - m.r);
    }
    function sy(y) {
      return H - m.b - ((y - yd[0]) / (yd[1] - yd[0])) * (H - m.t - m.b);
    }
    function ix(px) {
      return xd[0] + ((px - m.l) / (W - m.l - m.r)) * (xd[1] - xd[0]);
    }
    function f1(n) {
      return n.toFixed(1);
    }
    function pts(s) {
      if (s.points) return s.points;
      var n = s.samples || 260,
        out = [];
      for (var i = 0; i <= n; i++) {
        var x = xd[0] + ((xd[1] - xd[0]) * i) / n;
        var y;
        try {
          y = s.fn(x);
        } catch (_) {
          y = NaN;
        }
        out.push([x, y]);
      }
      return out;
    }
    function lineOf(points) {
      var d = "",
        pen = false,
        prev = null;
      for (var i = 0; i < points.length; i++) {
        var x = points[i][0],
          y = points[i][1];
        if (!isFinite(x) || !isFinite(y) || Math.abs(y) > 1e9) {
          pen = false;
          prev = null;
          continue;
        }
        var py = sy(y);
        if (prev !== null && Math.abs(py - prev) > H * 1.4) pen = false;
        d += (pen ? "L" : "M") + f1(sx(x)) + "," + f1(py);
        pen = true;
        prev = py;
      }
      return d;
    }
    function autoDomain() {
      var lo = Infinity,
        hi = -Infinity;
      data.series.forEach(function (s) {
        pts(s).forEach(function (p) {
          var y = p[1];
          if (
            isFinite(y) &&
            Math.abs(y) < 1e7 &&
            p[0] >= xd[0] &&
            p[0] <= xd[1]
          ) {
            if (y < lo) lo = y;
            if (y > hi) hi = y;
          }
        });
      });
      data.hlines.forEach(function (y) {
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      });
      if (!isFinite(lo) || !isFinite(hi)) return;
      if (hi - lo < 1e-9) {
        lo -= 1;
        hi += 1;
      }
      var pad = (hi - lo) * 0.1;
      yd = [lo - pad, hi + pad];
    }
    function clear(g) {
      while (g.firstChild) g.removeChild(g.firstChild);
    }

    function drawFrame() {
      clipRect.setAttribute("x", m.l);
      clipRect.setAttribute("y", m.t);
      clipRect.setAttribute("width", W - m.l - m.r);
      clipRect.setAttribute("height", H - m.t - m.b);
      clear(gGrid);
      clear(gAxes);
      var xt = niceTicks(xd[0], xd[1], 6),
        yt = niceTicks(yd[0], yd[1], 5);
      xt.forEach(function (v) {
        svg(
          "line",
          {
            class: "ec-grid-line",
            x1: f1(sx(v)),
            x2: f1(sx(v)),
            y1: m.t,
            y2: H - m.b,
          },
          gGrid,
        );
        var t = svg(
          "text",
          { x: f1(sx(v)), y: H - m.b + 18, "text-anchor": "middle" },
          gGrid,
        );
        t.textContent = tickText(v);
      });
      yt.forEach(function (v) {
        svg(
          "line",
          {
            class: "ec-grid-line",
            x1: m.l,
            x2: W - m.r,
            y1: f1(sy(v)),
            y2: f1(sy(v)),
          },
          gGrid,
        );
        var t = svg(
          "text",
          { x: m.l - 8, y: f1(sy(v)) + 4, "text-anchor": "end" },
          gGrid,
        );
        t.textContent = tickText(v);
      });
      var ax = clamp(sx(0), m.l, W - m.r),
        ay = clamp(sy(0), m.t, H - m.b);
      svg(
        "line",
        { class: "ec-axis", x1: m.l, x2: W - m.r, y1: f1(ay), y2: f1(ay) },
        gAxes,
      );
      svg(
        "line",
        { class: "ec-axis", x1: f1(ax), x2: f1(ax), y1: m.t, y2: H - m.b },
        gAxes,
      );
      if (o.xLabel) {
        var xl = svg(
          "text",
          {
            class: "ec-axis-label",
            x: (m.l + W - m.r) / 2,
            y: H - 8,
            "text-anchor": "middle",
          },
          gAxes,
        );
        xl.textContent = o.xLabel;
      }
      if (o.yLabel) {
        var yl = svg(
          "text",
          {
            class: "ec-axis-label",
            transform: "translate(16," + (m.t + H - m.b) / 2 + ") rotate(-90)",
            "text-anchor": "middle",
          },
          gAxes,
        );
        yl.textContent = o.yLabel;
      }
    }

    function drawData() {
      clear(gAreas);
      clear(gSeries);
      clear(gGuides);
      data.areas.forEach(function (a, i) {
        var from = a.from === undefined ? xd[0] : a.from,
          to = a.to === undefined ? xd[1] : a.to,
          base = a.base || 0,
          n = 120,
          d = "M" + f1(sx(from)) + "," + f1(sy(base));
        for (var k = 0; k <= n; k++) {
          var x = from + ((to - from) * k) / n,
            y = a.fn(x);
          d += "L" + f1(sx(x)) + "," + f1(sy(isFinite(y) ? y : base));
        }
        d += "L" + f1(sx(to)) + "," + f1(sy(base)) + "Z";
        svg(
          "path",
          {
            class: "ec-area",
            d: d,
            fill: EC.color(a.color || DEFAULT_COLORS[i % 6]),
          },
          gAreas,
        );
      });
      data.series.forEach(function (s, i) {
        var color = EC.color(
          s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        );
        var pl = pts(s);
        var line = lineOf(pl);
        if (s.area && line) {
          var first = pl[0][0],
            last = pl[pl.length - 1][0];
          svg(
            "path",
            {
              class: "ec-area",
              fill: color,
              d:
                line +
                "L" +
                f1(sx(last)) +
                "," +
                f1(sy(0)) +
                "L" +
                f1(sx(first)) +
                "," +
                f1(sy(0)) +
                "Z",
            },
            gSeries,
          );
        }
        var path = svg(
          "path",
          {
            class: "ec-curve",
            d: line,
            stroke: color,
            "stroke-width": s.width || 3.5,
          },
          gSeries,
        );
        if (s.dashed) path.setAttribute("stroke-dasharray", "9 7");
        var key = s.id || "s" + i;
        if (!seen[key] && !s.dashed && !reduce) {
          path.setAttribute("pathLength", "1");
          path.classList.add("ec-drawn");
          path.addEventListener("animationend", function () {
            path.classList.remove("ec-drawn");
            path.removeAttribute("pathLength");
          });
        }
        seen[key] = true;
      });
      data.vlines.forEach(function (x) {
        svg(
          "line",
          {
            class: "ec-guide",
            x1: f1(sx(x)),
            x2: f1(sx(x)),
            y1: m.t,
            y2: H - m.b,
          },
          gGuides,
        );
      });
      data.hlines.forEach(function (y) {
        svg(
          "line",
          {
            class: "ec-guide",
            x1: m.l,
            x2: W - m.r,
            y1: f1(sy(y)),
            y2: f1(sy(y)),
          },
          gGuides,
        );
      });
    }

    function markerY(mk) {
      if (mk.on) {
        var s = data.series.filter(function (q) {
          return q.id === mk.on;
        })[0];
        if (s && s.fn) {
          try {
            return s.fn(mk.x);
          } catch (_) {
            return mk.y;
          }
        }
      }
      return mk.y;
    }
    function drawMarkers() {
      var keep = {};
      data.markers.forEach(function (mk, i) {
        var key = mk.id || "m" + i;
        keep[key] = true;
        var y = markerY(mk);
        var rec = markerEls[key];
        if (!rec) {
          var g = svg("g", { class: mk.drag ? "ec-handle" : "" }, gMarkers);
          var hit = svg("circle", { class: "ec-hit", r: 20 }, g);
          var dot = svg("circle", { class: "ec-dot", r: mk.r || 9 }, g);
          var txt = svg(
            "text",
            {
              "text-anchor": "middle",
              y: -16,
              class: "ec-axis-label ec-mlabel",
            },
            g,
          );
          rec = markerEls[key] = { g: g, dot: dot, txt: txt, hit: hit, mk: mk };
          if (mk.drag) {
            g.setAttribute("tabindex", "0");
            g.setAttribute("role", "slider");
            g.setAttribute("aria-label", mk.label || "Punto arrastrable");
            g.addEventListener("pointerdown", function (ev) {
              ev.preventDefault();
              g.setPointerCapture(ev.pointerId);
              var move = function (e2) {
                var ctm = el.getScreenCTM();
                if (!ctm) return;
                var p = el.createSVGPoint();
                p.x = e2.clientX;
                p.y = e2.clientY;
                var q = p.matrixTransform(ctm.inverse());
                var cur = markerEls[key].mk;
                var nx =
                  cur.drag.indexOf("x") >= 0
                    ? clamp(ix(q.x), xd[0], xd[1])
                    : cur.x;
                var ny = cur.y;
                if (cur.drag.indexOf("y") >= 0 && !cur.on) {
                  ny =
                    yd[0] +
                    ((H - m.b - q.y) / (H - m.t - m.b)) * (yd[1] - yd[0]);
                  ny = clamp(ny, yd[0], yd[1]);
                }
                if (cur.snap) {
                  nx = Math.round(nx / cur.snap) * cur.snap;
                  ny = Math.round(ny / cur.snap) * cur.snap;
                }
                cur.x = nx;
                cur.y = ny;
                drawMarkers();
                if (cur.onDrag) cur.onDrag(nx, markerY(cur));
              };
              var up = function () {
                g.removeEventListener("pointermove", move);
                g.removeEventListener("pointerup", up);
                g.removeEventListener("pointercancel", up);
              };
              g.addEventListener("pointermove", move);
              g.addEventListener("pointerup", up);
              g.addEventListener("pointercancel", up);
            });
            g.addEventListener("keydown", function (ev) {
              var cur = markerEls[key].mk;
              var step = (xd[1] - xd[0]) / 50;
              if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
                ev.preventDefault();
                cur.x = clamp(
                  cur.x + (ev.key === "ArrowLeft" ? -step : step),
                  xd[0],
                  xd[1],
                );
                drawMarkers();
                if (cur.onDrag) cur.onDrag(cur.x, markerY(cur));
              }
            });
          }
        } else if (rec.mk !== mk) {
          /* conserva la posición arrastrada si el recurso no la cambia explícitamente */
          if (mk.__keep) {
            mk.x = rec.mk.x;
            mk.y = rec.mk.y;
          }
          rec.mk = mk;
        }
        rec.g.setAttribute(
          "transform",
          "translate(" + f1(sx(mk.x)) + "," + f1(sy(y)) + ")",
        );
        rec.dot.setAttribute("fill", EC.color(mk.color || "s2"));
        rec.txt.textContent = mk.label || "";
      });
      Object.keys(markerEls).forEach(function (k) {
        if (!keep[k]) {
          markerEls[k].g.remove();
          delete markerEls[k];
        }
      });
    }
    function drawLegend() {
      legend.textContent = "";
      data.series.forEach(function (s, i) {
        if (!s.label) return;
        var sp = document.createElement("span");
        sp.textContent = s.label;
        sp.style.setProperty(
          "--c",
          EC.color(s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]),
        );
        legend.appendChild(sp);
      });
    }

    /* Lectura al pasar el cursor o el dedo por la gráfica */
    var traceDot = svg(
      "circle",
      { class: "ec-dot", r: 6, fill: "var(--s2)" },
      gTip,
    );
    var traceBox = svg("rect", { rx: 0, height: 24 }, gTip);
    var traceText = svg("text", { y: 16, x: 8 }, gTip);
    el.addEventListener("pointermove", function (ev) {
      if (o.trace === false) return;
      var s = data.series.filter(function (q) {
        return q.fn;
      })[0];
      if (!s) return;
      var ctm = el.getScreenCTM();
      if (!ctm) return;
      var p = el.createSVGPoint();
      p.x = ev.clientX;
      p.y = ev.clientY;
      var q = p.matrixTransform(ctm.inverse());
      if (q.x < m.l || q.x > W - m.r || q.y < m.t || q.y > H - m.b) {
        gTip.setAttribute("visibility", "hidden");
        return;
      }
      var x = ix(q.x),
        y = s.fn(x);
      if (!isFinite(y)) {
        gTip.setAttribute("visibility", "hidden");
        return;
      }
      var px = sx(x),
        py = clamp(sy(y), m.t, H - m.b);
      traceDot.setAttribute("cx", f1(px));
      traceDot.setAttribute("cy", f1(py));
      traceText.textContent =
        tickText(Math.round(x * 100) / 100) +
        " , " +
        tickText(Math.round(y * 100) / 100);
      var w = traceText.getComputedTextLength() + 16;
      var bx = clamp(px + 10, m.l, W - m.r - w),
        by = clamp(py - 34, m.t, H - m.b - 24);
      traceBox.setAttribute("x", f1(bx));
      traceBox.setAttribute("y", f1(by));
      traceBox.setAttribute("width", f1(w));
      traceText.setAttribute("x", f1(bx + 8));
      traceText.setAttribute("y", f1(by + 16));
      gTip.setAttribute("visibility", "visible");
    });
    el.addEventListener("pointerleave", function () {
      gTip.setAttribute("visibility", "hidden");
    });

    var api = {
      el: el,
      set: function (patch) {
        patch = patch || {};
        if (patch.xDomain) xd = patch.xDomain.slice();
        if (patch.yDomain) {
          if (patch.yDomain === "auto") autoY = true;
          else {
            yd = patch.yDomain.slice();
            autoY = false;
          }
        }
        ["series", "markers", "vlines", "hlines", "areas"].forEach(
          function (k) {
            if (patch[k]) data[k] = patch[k];
          },
        );
        if (autoY) autoDomain();
        drawFrame();
        drawData();
        drawMarkers();
        drawLegend();
        gMarkers.parentNode.appendChild(gMarkers);
        gTip.parentNode.appendChild(gTip);
        return api;
      },
    };
    drawFrame();
    return api;
  };

  /* ---------- barras ---------- */
  EC.bars = function (host, o) {
    host = $(host);
    o = o || {};
    var W = 640,
      aspect = o.aspect || 1.7,
      H = Math.round(W / aspect);
    var m = { l: 46, r: 16, t: 26, b: 40 };
    var el = svg(
      "svg",
      {
        viewBox: "0 0 " + W + " " + H,
        class: "ec-svg",
        role: "img",
        "aria-label": o.label || "Gráfica de barras",
      },
      host,
    );
    var labels = o.labels || [];
    var max = o.max || 1;
    var unit = o.unit || "";
    var decimals = o.decimals === undefined ? 2 : o.decimals;
    var gGrid = svg("g", null, el);
    svg(
      "line",
      { class: "ec-axis", x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b },
      el,
    );
    var n = labels.length,
      slot = (W - m.l - m.r) / Math.max(1, n),
      bw = Math.min(70, slot * 0.62);
    function drawGrid() {
      while (gGrid.firstChild) gGrid.removeChild(gGrid.firstChild);
      niceTicks(0, max, 4).forEach(function (v) {
        var y = H - m.b - (v / max) * (H - m.t - m.b);
        svg(
          "line",
          { class: "ec-grid-line", x1: m.l, x2: W - m.r, y1: y, y2: y },
          gGrid,
        );
        var t = svg(
          "text",
          { x: m.l - 8, y: y + 4, "text-anchor": "end" },
          gGrid,
        );
        t.textContent = tickText(v);
      });
    }
    drawGrid();
    var bars = labels.map(function (name, i) {
      var cx = m.l + slot * (i + 0.5);
      var color = EC.color(
        (o.colors && o.colors[i]) || o.color || DEFAULT_COLORS[i % 6],
      );
      var r = svg(
        "rect",
        { class: "ec-bar", x: cx - bw / 2, width: bw, fill: color },
        el,
      );
      r.style.y = H - m.b + "px";
      r.style.height = "0px";
      var val = svg(
        "text",
        { x: cx, "text-anchor": "middle", class: "ec-axis-label" },
        el,
      );
      var lab = svg(
        "text",
        { x: cx, y: H - m.b + 20, "text-anchor": "middle" },
        el,
      );
      lab.textContent = name;
      return { r: r, val: val };
    });
    var api = {
      el: el,
      /* set(valores, nuevoMax?): el segundo argumento reescala el eje (útil cuando los valores son pequeños). */
      set: function (values, newMax) {
        if (newMax && newMax !== max) {
          max = newMax;
          drawGrid();
        }
        var crowded = slot < 52;
        values.forEach(function (v, i) {
          if (!bars[i]) return;
          var h = clamp(v / max, 0, 1) * (H - m.t - m.b);
          bars[i].r.style.height = h + "px";
          bars[i].r.style.y = H - m.b - h + "px";
          bars[i].val.setAttribute("y", H - m.b - h - 8);
          bars[i].val.style.fontSize = crowded ? "11px" : "";
          var tiny = v <= max * 0.015 || (crowded && v < max * 0.05);
          bars[i].val.textContent = tiny
            ? ""
            : EC.fmt(v, decimals) + (unit ? " " + unit : "");
        });
        return api;
      },
    };
    if (o.values)
      requestAnimationFrame(function () {
        api.set(o.values);
      });
    return api;
  };

  /* ---------- escena 3D (R³) ---------- */
  var RAMP = [
    [18, 34, 69],
    [47, 127, 134],
    [181, 153, 87],
  ];
  function ramp(t) {
    t = clamp(t, 0, 1) * (RAMP.length - 1);
    var i = Math.min(RAMP.length - 2, Math.floor(t)),
      f = t - i,
      a = RAMP[i],
      b = RAMP[i + 1];
    return [
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
    ];
  }
  var HEX = {
    s1: "#122245",
    s2: "#b59957",
    s3: "#2f7f86",
    s4: "#b4552d",
    s5: "#6a5a9a",
    s6: "#4d7c4a",
  };
  function hexToRgb(c) {
    c = HEX[c] || c || "#122245";
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (!m) return [18, 34, 69];
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb(c, k) {
    k = k === undefined ? 1 : k;
    return (
      "rgb(" +
      Math.round(c[0] * k) +
      "," +
      Math.round(c[1] * k) +
      "," +
      Math.round(c[2] * k) +
      ")"
    );
  }

  /* EC.scene3d(host, {range: 5, aspect: 1.5, labels: ["x","y","z"], autorotate: false})
     s.set({surfaces, points, vectors, lines, planes}); s.view({yaw, pitch, zoom}); s.reset(). */
  EC.scene3d = function (host, o) {
    host = $(host);
    o = o || {};
    var R = o.range || 5;
    var labels = o.labels || ["x", "y", "z"];
    var base = {
      yaw: o.yaw !== undefined ? o.yaw : -0.85,
      pitch: o.pitch !== undefined ? o.pitch : 0.5,
      zoom: o.zoom || 1,
    };
    var cam = { yaw: base.yaw, pitch: base.pitch, zoom: base.zoom };
    var data = { surfaces: [], points: [], vectors: [], lines: [], planes: [] };
    var D = 3.6;
    host.style.position = "relative";
    var api = {};
    var canvasApi = EC.canvas(host, {
      aspect: o.aspect || 1.5,
      label: o.label || "Escena tridimensional que se puede girar",
      draw: function (ctx, w, h) {
        render(ctx, w, h);
      },
    });
    var cv = canvasApi.canvas;
    cv.tabIndex = 0;
    cv.style.touchAction = "none";
    cv.style.cursor = "grab";
    cv.style.background = "transparent";

    function projector(w, h) {
      var cy = Math.cos(cam.yaw),
        sy = Math.sin(cam.yaw),
        cp = Math.cos(cam.pitch),
        sp = Math.sin(cam.pitch),
        S = Math.min(w, h * 1.15) * 0.3 * cam.zoom;
      function rot(x, y, z) {
        var x1 = x * cy - y * sy,
          y1 = x * sy + y * cy;
        return [x1, y1 * cp - z * sp, y1 * sp + z * cp];
      }
      function proj(p) {
        var v = rot(p[0] / R, p[1] / R, p[2] / R),
          f = D / (D + v[1]);
        return {
          x: w / 2 + v[0] * f * S,
          y: h * 0.55 - v[2] * f * S,
          d: v[1],
          f: f,
        };
      }
      proj.rot = rot;
      return proj;
    }

    function render(ctx, w, h) {
      var P = projector(w, h);
      var prims = [];
      function add(d, fn) {
        prims.push({ d: d, fn: fn });
      }
      /* Rejilla en el piso */
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(18,34,69,0.13)";
      var steps = o.gridSteps || 10;
      for (var g = 0; g <= steps; g++) {
        var v = -R + (2 * R * g) / steps;
        var a = P([v, -R, -R]),
          b = P([v, R, -R]),
          c = P([-R, v, -R]),
          e = P([R, v, -R]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
      }
      /* Ejes */
      var axes = [
        [[-R, 0, 0], [R, 0, 0], labels[0]],
        [[0, -R, 0], [0, R, 0], labels[1]],
        [[0, 0, -R], [0, 0, R], labels[2]],
      ];
      axes.forEach(function (ax) {
        var p0 = P(ax[0]),
          p1 = P(ax[1]);
        add((p0.d + p1.d) / 2 + 0.001, function () {
          ctx.strokeStyle = "#122245";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
          ctx.fillStyle = "#122245";
          ctx.font = "700 15px 'DM Mono', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          var dx = p1.x - p0.x,
            dy = p1.y - p0.y,
            n = Math.hypot(dx, dy) || 1;
          ctx.fillText(ax[2], p1.x + (dx / n) * 14, p1.y + (dy / n) * 14);
        });
      });
      /* Superficies */
      data.surfaces.forEach(function (s) {
        var n = s.n || 28,
          xr = s.xRange || [-R, R],
          yr = s.yRange || [-R, R];
        var grid = [],
          zmin = Infinity,
          zmax = -Infinity;
        for (var i = 0; i <= n; i++) {
          var row = [];
          for (var j = 0; j <= n; j++) {
            var x = xr[0] + ((xr[1] - xr[0]) * i) / n,
              y = yr[0] + ((yr[1] - yr[0]) * j) / n,
              z;
            try {
              z = s.fn(x, y);
            } catch (_) {
              z = NaN;
            }
            if (isFinite(z)) {
              zmin = Math.min(zmin, z);
              zmax = Math.max(zmax, z);
            }
            row.push([x, y, z]);
          }
          grid.push(row);
        }
        var solid = s.color && s.color !== "height" ? hexToRgb(s.color) : null;
        var alpha = s.alpha === undefined ? 0.94 : s.alpha;
        for (var qi = 0; qi < n; qi++)
          for (var qj = 0; qj < n; qj++) {
            var q = [
              grid[qi][qj],
              grid[qi + 1][qj],
              grid[qi + 1][qj + 1],
              grid[qi][qj + 1],
            ];
            if (
              q.some(function (p) {
                return !isFinite(p[2]) || Math.abs(p[2]) > R * 1.6;
              })
            )
              continue;
            var pp = q.map(P);
            var depth = (pp[0].d + pp[1].d + pp[2].d + pp[3].d) / 4;
            var zc = (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4;
            var ax1 = q[1][0] - q[0][0],
              ay1 = q[1][1] - q[0][1],
              az1 = q[1][2] - q[0][2];
            var ax2 = q[3][0] - q[0][0],
              ay2 = q[3][1] - q[0][1],
              az2 = q[3][2] - q[0][2];
            var nx = ay1 * az2 - az1 * ay2,
              ny = az1 * ax2 - ax1 * az2,
              nz = ax1 * ay2 - ay1 * ax2,
              nl = Math.hypot(nx, ny, nz) || 1;
            var nv = P.rot(nx / nl, ny / nl, nz / nl);
            var light = Math.abs(nv[0] * -0.35 + nv[1] * -0.8 + nv[2] * 0.5);
            var shade = 0.62 + 0.45 * Math.min(1, light);
            var col =
              solid || ramp(zmax > zmin ? (zc - zmin) / (zmax - zmin) : 0.5);
            (function (pp, col, shade, depth) {
              add(depth, function () {
                ctx.beginPath();
                ctx.moveTo(pp[0].x, pp[0].y);
                ctx.lineTo(pp[1].x, pp[1].y);
                ctx.lineTo(pp[2].x, pp[2].y);
                ctx.lineTo(pp[3].x, pp[3].y);
                ctx.closePath();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = rgb(col, shade);
                ctx.fill();
                ctx.globalAlpha = 1;
                if (s.wire !== false) {
                  ctx.strokeStyle = "rgba(18,34,69,0.28)";
                  ctx.lineWidth = 0.7;
                  ctx.stroke();
                }
              });
            })(pp, col, shade, depth);
          }
      });
      /* Planos */
      data.planes.forEach(function (pl) {
        var nrm = pl.normal,
          dd = pl.d || 0,
          sz = pl.size || R;
        var nl = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1;
        var u = Math.abs(nrm[2]) / nl < 0.9 ? [0, 0, 1] : [1, 0, 0];
        var t1 = [
          nrm[1] * u[2] - nrm[2] * u[1],
          nrm[2] * u[0] - nrm[0] * u[2],
          nrm[0] * u[1] - nrm[1] * u[0],
        ];
        var l1 = Math.hypot(t1[0], t1[1], t1[2]) || 1;
        t1 = [t1[0] / l1, t1[1] / l1, t1[2] / l1];
        var t2 = [
          (nrm[1] * t1[2] - nrm[2] * t1[1]) / nl,
          (nrm[2] * t1[0] - nrm[0] * t1[2]) / nl,
          (nrm[0] * t1[1] - nrm[1] * t1[0]) / nl,
        ];
        var c0 = [
          (nrm[0] * dd) / (nl * nl),
          (nrm[1] * dd) / (nl * nl),
          (nrm[2] * dd) / (nl * nl),
        ];
        var corners = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(function (k) {
          return P([
            c0[0] + (t1[0] * k[0] + t2[0] * k[1]) * sz,
            c0[1] + (t1[1] * k[0] + t2[1] * k[1]) * sz,
            c0[2] + (t1[2] * k[0] + t2[2] * k[1]) * sz,
          ]);
        });
        var col = hexToRgb(pl.color || "s4");
        add((corners[0].d + corners[2].d) / 2, function () {
          ctx.beginPath();
          corners.forEach(function (c, i) {
            if (i) ctx.lineTo(c.x, c.y);
            else ctx.moveTo(c.x, c.y);
          });
          ctx.closePath();
          ctx.globalAlpha = pl.alpha === undefined ? 0.35 : pl.alpha;
          ctx.fillStyle = rgb(col);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = rgb(col, 0.8);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      });
      /* Líneas */
      data.lines.forEach(function (ln) {
        var pts = ln.points.map(P),
          col = hexToRgb(ln.color || "s1");
        for (var k = 0; k < pts.length - 1; k++)
          (function (a, b) {
            add((a.d + b.d) / 2 - 0.002, function () {
              ctx.strokeStyle = rgb(col);
              ctx.lineWidth = ln.width || 3;
              ctx.lineCap = "round";
              if (ln.dashed) ctx.setLineDash([7, 6]);
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
              ctx.setLineDash([]);
            });
          })(pts[k], pts[k + 1]);
      });
      /* Vectores */
      data.vectors.forEach(function (vc) {
        var a = P(vc.from || [0, 0, 0]),
          b = P(vc.to),
          col = hexToRgb(vc.color || "s4");
        add(Math.min(a.d, b.d) - 0.004, function () {
          ctx.strokeStyle = rgb(col);
          ctx.fillStyle = rgb(col);
          ctx.lineWidth = vc.width || 3.5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          var ang = Math.atan2(b.y - a.y, b.x - a.x),
            hl = 13;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(
            b.x - hl * Math.cos(ang - 0.4),
            b.y - hl * Math.sin(ang - 0.4),
          );
          ctx.lineTo(
            b.x - hl * Math.cos(ang + 0.4),
            b.y - hl * Math.sin(ang + 0.4),
          );
          ctx.closePath();
          ctx.fill();
          if (vc.label) {
            ctx.font = "700 14px 'DM Mono', monospace";
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(255,253,247,0.9)";
            ctx.strokeText(vc.label, b.x + 8, b.y - 6);
            ctx.fillText(vc.label, b.x + 8, b.y - 6);
          }
        });
      });
      /* Puntos */
      data.points.forEach(function (pt) {
        var p = P(pt.p),
          col = hexToRgb(pt.color || "s2");
        add(p.d - 0.006, function () {
          var r = (pt.r || 7) * p.f;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle = rgb(col);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#122245";
          ctx.stroke();
          if (pt.label) {
            ctx.font = "700 14px 'DM Mono', monospace";
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.fillStyle = "#122245";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(255,253,247,0.9)";
            ctx.strokeText(pt.label, p.x + r + 5, p.y - r);
            ctx.fillText(pt.label, p.x + r + 5, p.y - r);
          }
        });
      });
      prims
        .sort(function (a, b) {
          return b.d - a.d;
        })
        .forEach(function (pr) {
          pr.fn();
        });
    }

    function changed() {
      canvasApi.redraw();
      if (o.onView)
        o.onView({ yaw: cam.yaw, pitch: cam.pitch, zoom: cam.zoom });
    }
    /* Arrastre: un dedo gira; dos dedos acercan y alejan. */
    var pointers = {},
      lastPinch = 0;
    cv.addEventListener("pointerdown", function (ev) {
      cv.setPointerCapture(ev.pointerId);
      pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      cv.style.cursor = "grabbing";
      stopAuto();
    });
    cv.addEventListener("pointermove", function (ev) {
      var p = pointers[ev.pointerId];
      if (!p) return;
      var ids = Object.keys(pointers);
      if (ids.length >= 2) {
        var q = pointers[ids[0] === String(ev.pointerId) ? ids[1] : ids[0]];
        pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        var dist = Math.hypot(ev.clientX - q.x, ev.clientY - q.y);
        if (lastPinch) cam.zoom = clamp(cam.zoom * (dist / lastPinch), 0.5, 3);
        lastPinch = dist;
      } else {
        cam.yaw += (ev.clientX - p.x) * 0.012;
        cam.pitch = clamp(cam.pitch + (ev.clientY - p.y) * 0.012, -1.45, 1.45);
        pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      }
      changed();
    });
    function release(ev) {
      delete pointers[ev.pointerId];
      lastPinch = 0;
      cv.style.cursor = "grab";
    }
    cv.addEventListener("pointerup", release);
    cv.addEventListener("pointercancel", release);
    cv.addEventListener("keydown", function (ev) {
      var k = ev.key,
        handled = true;
      if (k === "ArrowLeft") cam.yaw -= 0.12;
      else if (k === "ArrowRight") cam.yaw += 0.12;
      else if (k === "ArrowUp") cam.pitch = clamp(cam.pitch + 0.1, -1.45, 1.45);
      else if (k === "ArrowDown")
        cam.pitch = clamp(cam.pitch - 0.1, -1.45, 1.45);
      else if (k === "+" || k === "=")
        cam.zoom = clamp(cam.zoom * 1.12, 0.5, 3);
      else if (k === "-") cam.zoom = clamp(cam.zoom / 1.12, 0.5, 3);
      else handled = false;
      if (handled) {
        ev.preventDefault();
        stopAuto();
        changed();
      }
    });
    /* Controles visibles: no todo el mundo puede arrastrar. */
    var tools = document.createElement("div");
    tools.className = "ec-3d-tools";
    [
      [
        "+",
        "Acercar",
        function () {
          cam.zoom = clamp(cam.zoom * 1.2, 0.5, 3);
        },
      ],
      [
        "−",
        "Alejar",
        function () {
          cam.zoom = clamp(cam.zoom / 1.2, 0.5, 3);
        },
      ],
      [
        "↺",
        "Restablecer vista",
        function () {
          cam.yaw = base.yaw;
          cam.pitch = base.pitch;
          cam.zoom = base.zoom;
        },
      ],
    ].forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "alt";
      b.textContent = t[0];
      b.setAttribute("aria-label", t[1]);
      b.title = t[1];
      b.addEventListener("click", function () {
        stopAuto();
        t[2]();
        changed();
      });
      tools.appendChild(b);
    });
    host.appendChild(tools);
    var autoId = 0;
    function stopAuto() {
      if (autoId) {
        cancelAnimationFrame(autoId);
        autoId = 0;
      }
    }
    if (o.autorotate && !reduce) {
      var tick = function () {
        cam.yaw += 0.004;
        canvasApi.redraw();
        autoId = requestAnimationFrame(tick);
      };
      autoId = requestAnimationFrame(tick);
    }
    api.canvas = cv;
    api.set = function (patch) {
      ["surfaces", "points", "vectors", "lines", "planes"].forEach(
        function (k) {
          if (patch && patch[k]) data[k] = patch[k];
        },
      );
      canvasApi.redraw();
      return api;
    };
    api.view = function (v) {
      if (v) {
        if (v.yaw !== undefined) cam.yaw = v.yaw;
        if (v.pitch !== undefined) cam.pitch = clamp(v.pitch, -1.45, 1.45);
        if (v.zoom !== undefined) cam.zoom = clamp(v.zoom, 0.5, 3);
        changed();
      }
      return { yaw: cam.yaw, pitch: cam.pitch, zoom: cam.zoom };
    };
    api.reset = function () {
      cam.yaw = base.yaw;
      cam.pitch = base.pitch;
      cam.zoom = base.zoom;
      changed();
    };
    api.redraw = canvasApi.redraw;
    return api;
  };

  /* ---------- grafos (nodos y aristas) ---------- */
  /* EC.graph(host, {aspect: 1.6, drag: true, onNodeClick: id => {}, onEdgeClick: e => {}})
     g.set({nodes:[{id, label, x, y, state}], edges:[{a, b, w, directed, state}], layout: "circle"|"force"|"none"})
     x e y van de 0 a 1. state: "default" | "current" | "visited" | "path" | "dim". */
  EC.graph = function (host, o) {
    host = $(host);
    o = o || {};
    var W = 640,
      H = Math.round(W / (o.aspect || 1.6)),
      pad = 44,
      R0 = o.radius || 22;
    var el = svg(
      "svg",
      {
        viewBox: "0 0 " + W + " " + H,
        class: "ec-svg ec-graph",
        role: "img",
        "aria-label": o.label || "Grafo",
      },
      host,
    );
    var gEdges = svg("g", null, el),
      gNodes = svg("g", null, el);
    var nodes = [],
      edges = [],
      nodeEls = {},
      edgeEls = [];
    function sx(n) {
      return pad + n.x * (W - 2 * pad);
    }
    function sy(n) {
      return pad + n.y * (H - 2 * pad);
    }
    function find(id) {
      return nodes.filter(function (n) {
        return n.id === id;
      })[0];
    }
    function layoutCircle() {
      nodes.forEach(function (n, i) {
        var a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
        n.x = 0.5 + 0.42 * Math.cos(a);
        n.y = 0.5 + 0.42 * Math.sin(a);
      });
    }
    function layoutForce() {
      layoutCircle();
      var n = nodes.length;
      if (n < 2) return;
      var k = Math.sqrt(1 / n) * 0.85,
        iterations = 320;
      for (var it = 0; it < iterations; it++) {
        var temp = 0.12 * (1 - it / iterations) + 0.004,
          dx = {},
          dy = {};
        nodes.forEach(function (v) {
          dx[v.id] = 0;
          dy[v.id] = 0;
        });
        nodes.forEach(function (u) {
          nodes.forEach(function (v) {
            if (u === v) return;
            var vx = u.x - v.x,
              vy = u.y - v.y,
              d = Math.max(0.01, Math.hypot(vx, vy)),
              f = (k * k) / d;
            dx[u.id] += (vx / d) * f;
            dy[u.id] += (vy / d) * f;
          });
        });
        edges.forEach(function (e) {
          var u = find(e.a),
            v = find(e.b);
          if (!u || !v) return;
          var vx = u.x - v.x,
            vy = u.y - v.y,
            d = Math.max(0.01, Math.hypot(vx, vy)),
            f = (d * d) / k;
          dx[u.id] -= (vx / d) * f;
          dy[u.id] -= (vy / d) * f;
          dx[v.id] += (vx / d) * f;
          dy[v.id] += (vy / d) * f;
        });
        nodes.forEach(function (v) {
          var d = Math.max(0.0001, Math.hypot(dx[v.id], dy[v.id])),
            m = Math.min(d, temp);
          v.x = clamp(v.x + (dx[v.id] / d) * m, 0, 1);
          v.y = clamp(v.y + (dy[v.id] / d) * m, 0, 1);
        });
      }
      /* Usa todo el espacio disponible conservando la forma. */
      var minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      nodes.forEach(function (v) {
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
      });
      nodes.forEach(function (v) {
        v.x = maxX > minX ? 0.04 + ((v.x - minX) / (maxX - minX)) * 0.92 : 0.5;
        v.y = maxY > minY ? 0.06 + ((v.y - minY) / (maxY - minY)) * 0.88 : 0.5;
      });
    }
    function edgeGeom(e) {
      var a = find(e.a),
        b = find(e.b);
      if (!a || !b) return null;
      var x1 = sx(a),
        y1 = sy(a),
        x2 = sx(b),
        y2 = sy(b),
        ang = Math.atan2(y2 - y1, x2 - x1),
        off = e.directed ? R0 + 3 : R0 - 4;
      return {
        x1: x1 + Math.cos(ang) * (R0 - 4),
        y1: y1 + Math.sin(ang) * (R0 - 4),
        x2: x2 - Math.cos(ang) * off,
        y2: y2 - Math.sin(ang) * off,
        ang: ang,
        mx: (x1 + x2) / 2,
        my: (y1 + y2) / 2,
      };
    }
    function draw() {
      /* aristas */
      while (edgeEls.length > edges.length) {
        var dead = edgeEls.pop();
        dead.g.remove();
      }
      edges.forEach(function (e, i) {
        var rec = edgeEls[i];
        if (!rec) {
          var g = svg("g", null, gEdges);
          rec = edgeEls[i] = {
            g: g,
            line: svg("line", { class: "ec-edge" }, g),
            arrow: svg("polygon", { class: "ec-arrow" }, g),
            halo: svg("rect", { class: "ec-edge-halo", rx: 0 }, g),
            text: svg(
              "text",
              { class: "ec-edge-label", "text-anchor": "middle" },
              g,
            ),
          };
          rec.g.addEventListener("click", function () {
            if (o.onEdgeClick) o.onEdgeClick(edges[i]);
          });
        }
        var gm = edgeGeom(e);
        if (!gm) return;
        var cls = e.state || "default";
        rec.g.setAttribute("class", "ec-edge-g " + cls);
        rec.line.setAttribute("x1", gm.x1);
        rec.line.setAttribute("y1", gm.y1);
        rec.line.setAttribute("x2", gm.x2);
        rec.line.setAttribute("y2", gm.y2);
        if (e.directed) {
          var hl = 13,
            hw = 6;
          var tx = gm.x2 + Math.cos(gm.ang) * 6,
            ty = gm.y2 + Math.sin(gm.ang) * 6;
          var bx = tx - Math.cos(gm.ang) * hl,
            by = ty - Math.sin(gm.ang) * hl;
          rec.arrow.setAttribute(
            "points",
            tx +
              "," +
              ty +
              " " +
              (bx - Math.sin(gm.ang) * hw) +
              "," +
              (by + Math.cos(gm.ang) * hw) +
              " " +
              (bx + Math.sin(gm.ang) * hw) +
              "," +
              (by - Math.cos(gm.ang) * hw),
          );
          rec.arrow.style.display = "";
        } else rec.arrow.style.display = "none";
        var label =
          e.w !== undefined && e.w !== null ? String(e.w) : e.label || "";
        rec.text.textContent = label;
        if (label) {
          var tw = label.length * 8.5 + 10;
          rec.text.setAttribute("x", gm.mx);
          rec.text.setAttribute("y", gm.my + 5);
          rec.halo.setAttribute("x", gm.mx - tw / 2);
          rec.halo.setAttribute("y", gm.my - 10);
          rec.halo.setAttribute("width", tw);
          rec.halo.setAttribute("height", 20);
          rec.halo.style.display = "";
        } else rec.halo.style.display = "none";
      });
      /* nodos */
      Object.keys(nodeEls).forEach(function (id) {
        if (!find(id)) {
          nodeEls[id].g.remove();
          delete nodeEls[id];
        }
      });
      nodes.forEach(function (n) {
        var rec = nodeEls[n.id];
        if (!rec) {
          var g = svg(
            "g",
            { class: "ec-node", tabindex: o.onNodeClick ? "0" : "-1" },
            gNodes,
          );
          svg("circle", { r: R0 }, g);
          var t = svg("text", null, g);
          rec = nodeEls[n.id] = { g: g, t: t };
          g.addEventListener("click", function () {
            if (!rec.moved && o.onNodeClick) o.onNodeClick(n.id);
          });
          g.addEventListener("keydown", function (ev) {
            if ((ev.key === "Enter" || ev.key === " ") && o.onNodeClick) {
              ev.preventDefault();
              o.onNodeClick(n.id);
            }
          });
          if (o.drag !== false) {
            g.style.touchAction = "none";
            g.addEventListener("pointerdown", function (ev) {
              g.setPointerCapture(ev.pointerId);
              rec.moved = false;
              var start = { x: ev.clientX, y: ev.clientY };
              function move(e2) {
                var ctm = el.getScreenCTM();
                if (!ctm) return;
                if (Math.hypot(e2.clientX - start.x, e2.clientY - start.y) > 4)
                  rec.moved = true;
                if (!rec.moved) return;
                var pt = el.createSVGPoint();
                pt.x = e2.clientX;
                pt.y = e2.clientY;
                var q = pt.matrixTransform(ctm.inverse());
                var cur = find(n.id);
                cur.x = clamp((q.x - pad) / (W - 2 * pad), 0, 1);
                cur.y = clamp((q.y - pad) / (H - 2 * pad), 0, 1);
                draw();
                if (o.onMove) o.onMove(cur);
              }
              function up() {
                g.removeEventListener("pointermove", move);
                g.removeEventListener("pointerup", up);
                g.removeEventListener("pointercancel", up);
                setTimeout(function () {
                  rec.moved = false;
                }, 0);
              }
              g.addEventListener("pointermove", move);
              g.addEventListener("pointerup", up);
              g.addEventListener("pointercancel", up);
            });
          }
        }
        rec.g.setAttribute(
          "class",
          "ec-node " +
            (n.state || "default") +
            (o.onNodeClick ? " ec-clickable" : ""),
        );
        rec.g.setAttribute(
          "transform",
          "translate(" + sx(n).toFixed(1) + "," + sy(n).toFixed(1) + ")",
        );
        rec.g.setAttribute(
          "aria-label",
          "Nodo " +
            (n.label || n.id) +
            (n.state && n.state !== "default" ? ", " + n.state : ""),
        );
        rec.t.textContent = n.label !== undefined ? n.label : n.id;
        if (n.badge !== undefined) {
          if (!rec.b) {
            rec.b = svg(
              "text",
              { class: "ec-node-badge", "text-anchor": "middle", y: -R0 - 7 },
              rec.g,
            );
          }
          rec.b.textContent = n.badge;
        } else if (rec.b) {
          rec.b.remove();
          rec.b = null;
        }
      });
      gNodes.parentNode.appendChild(gNodes);
    }
    var api = {
      el: el,
      set: function (patch) {
        patch = patch || {};
        if (patch.nodes) nodes = patch.nodes;
        if (patch.edges) edges = patch.edges;
        var needs = nodes.some(function (n) {
          return n.x === undefined || n.y === undefined;
        });
        if (patch.layout === "force") layoutForce();
        else if (patch.layout === "circle" || needs) layoutCircle();
        draw();
        return api;
      },
      node: function (id) {
        return find(id);
      },
      redraw: draw,
    };
    return api;
  };

  /* ---------- lección guiada (tutorial paso a paso) ---------- */
  /* EC.lesson(host, {steps: [{title, html, setup(el, L), check(el, L), hint}], start, onStep(i, paso), onFinish()})
     check devuelve true para avanzar, o un texto con la ayuda. L.next(), L.back(), L.goto(i), L.index, L.body. */
  EC.lesson = function (host, o) {
    host = $(host);
    o = o || {};
    var steps = o.steps || [];
    var idx = clamp(o.start || 0, 0, Math.max(0, steps.length - 1));
    var finished = false;
    host.classList.add("ec-lesson");
    host.textContent = "";
    function el(tag, cls, parent) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (parent) parent.appendChild(n);
      return n;
    }
    var head = el("div", "ec-lesson-head", host),
      count = el("span", "ec-lesson-count", head),
      title = el("h3", "ec-lesson-title", head),
      bar = el("div", "ec-steps", host),
      body = el("div", "ec-lesson-body", host),
      fb = el("div", "ec-note ec-lesson-feedback", host),
      foot = el("div", "ec-lesson-foot", host),
      back = el("button", "alt", foot),
      hintBtn = el("button", "alt", foot),
      next = el("button", "gold", foot);
    back.type = hintBtn.type = next.type = "button";
    back.textContent = "Atrás";
    hintBtn.textContent = "Quiero una pista";
    body.setAttribute("role", "region");
    body.setAttribute("aria-live", "polite");
    fb.hidden = true;
    var dots = steps.map(function () {
      return el("i", "", bar);
    });
    var api = {
      get index() {
        return idx;
      },
      get body() {
        return body;
      },
    };
    function say(text, kind) {
      fb.hidden = !text;
      fb.className = "ec-note ec-lesson-feedback" + (kind ? " " + kind : "");
      fb.textContent = text || "";
    }
    api.ok = function (text) {
      say(text, "good");
    };
    api.fail = function (text) {
      say(text, "bad");
      EC.shake(fb);
    };
    function render(dir) {
      var s = steps[idx] || {};
      finished = false;
      count.textContent = "Paso " + (idx + 1) + " de " + steps.length;
      title.textContent = s.title || "";
      dots.forEach(function (d, i) {
        d.classList.toggle("on", i <= idx);
      });
      body.innerHTML = s.html || "";
      body.style.animation = "none";
      void body.offsetWidth;
      body.style.animation = "";
      body.classList.toggle("ec-slide-back", dir < 0);
      say("");
      back.disabled = idx === 0;
      hintBtn.hidden = !s.hint;
      next.textContent = idx === steps.length - 1 ? "Terminar" : "Siguiente";
      next.disabled = false;
      if (s.setup) s.setup(body, api);
      if (o.onStep) o.onStep(idx, s);
    }
    api.goto = function (i, dir) {
      idx = clamp(i, 0, Math.max(0, steps.length - 1));
      render(dir === undefined ? 1 : dir);
    };
    api.next = function () {
      var s = steps[idx] || {};
      if (finished) {
        api.goto(0, -1);
        return;
      }
      if (s.check) {
        var r = s.check(body, api);
        if (r !== true) {
          api.fail(
            typeof r === "string" && r
              ? r
              : "Todavía no. Revisa y vuelve a intentarlo.",
          );
          return;
        }
      }
      if (idx < steps.length - 1) {
        idx++;
        render(1);
      } else {
        finished = true;
        dots.forEach(function (d) {
          d.classList.add("on");
        });
        say("Terminaste la lección. Puedes repetirla cuando quieras.", "good");
        next.textContent = "Repetir";
        EC.celebrate(next);
        if (o.onFinish) o.onFinish();
      }
    };
    api.back = function () {
      if (idx > 0) {
        idx--;
        render(-1);
      }
    };
    back.addEventListener("click", api.back);
    next.addEventListener("click", api.next);
    hintBtn.addEventListener("click", function () {
      var s = steps[idx] || {};
      if (s.hint) say(s.hint, "");
    });
    if (steps.length) render(1);
    return api;
  };

  /* ---------- arranque ---------- */
  window.addEventListener("error", function (e) {
    post("error", { message: String(e.message || "Error").slice(0, 300) });
  });
  window.addEventListener("unhandledrejection", function (e) {
    post("error", {
      message: String((e.reason && e.reason.message) || "Error").slice(0, 300),
    });
  });
  var lastHeight = 0;
  /* ---------- libreta de dibujo (predecir dibujando) ---------- */
  /* Guarda un valor en el estado del recurso sin pisar lo que ya había. */
  EC.keep = function (key, value) {
    EC.state[key] = value;
    EC.save(EC.state);
  };

  EC.sketch = function (host, o) {
    host = $(host);
    o = o || {};
    var id = o.id ? String(o.id) : "";
    var xr = o.x || [0, 1],
      yr = o.y || [0, 1];
    var aspect = o.aspect || 1.7;
    var W = 640,
      H = Math.round(W / aspect);
    var ML = o.axes === false && o.grid === false ? 12 : 46,
      MR = 14,
      MT = 12,
      MB = o.axes === false && o.grid === false ? 12 : 34;
    var colors =
      o.colors && o.colors.length ? o.colors.slice(0, 6) : ["s1", "s4", "s3"];
    var sizes = { fino: 2.6, grueso: 5.6 };
    var tool = "pen",
      color = colors[0],
      size = sizes.fino;
    var strokes = [],
      hist = [[]],
      pos = 0;
    var MAX_STROKES = 60,
      MAX_POINTS = 600;

    function px(x) {
      return ML + ((x - xr[0]) / (xr[1] - xr[0])) * (W - ML - MR);
    }
    function py(y) {
      return H - MB - ((y - yr[0]) / (yr[1] - yr[0])) * (H - MT - MB);
    }
    function mx(X) {
      return xr[0] + ((X - ML) / (W - ML - MR)) * (xr[1] - xr[0]);
    }
    function my(Y) {
      return yr[0] + ((H - MB - Y) / (H - MT - MB)) * (yr[1] - yr[0]);
    }
    function r3(v) {
      return Math.round(v * 1000) / 1000;
    }

    /* ----- estructura ----- */
    var wrap = document.createElement("div");
    wrap.className = "ec-sketch";
    var bar = document.createElement("div");
    bar.className = "ec-sketch-bar";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Herramientas de dibujo");
    var stage = document.createElement("div");
    stage.className = "ec-sketch-stage";
    var board = svg(
      "svg",
      {
        viewBox: "0 0 " + W + " " + H,
        role: "img",
        "aria-label":
          o.label || "Libreta para dibujar con el dedo, el lápiz o el ratón",
        class: "ec-sketch-svg",
      },
      stage,
    );
    var gBack = svg("g", { class: "ec-sketch-back" }, board);
    var gLayers = svg("g", { class: "ec-sketch-layers" }, board);
    var gInk = svg("g", { class: "ec-sketch-ink" }, board);
    var hint = document.createElement("div");
    hint.className = "ec-sketch-hint";
    hint.textContent = o.hint || "Dibuja aquí";
    stage.appendChild(hint);
    var legend = document.createElement("div");
    legend.className = "ec-sketch-legend";
    var live = document.createElement("div");
    live.setAttribute("aria-live", "polite");
    live.style.cssText =
      "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
    wrap.appendChild(bar);
    wrap.appendChild(stage);
    wrap.appendChild(legend);
    wrap.appendChild(live);
    host.appendChild(wrap);
    function say(text) {
      live.textContent = "";
      setTimeout(function () {
        live.textContent = text;
      }, 30);
    }

    /* ----- fondo: cuadrícula, ejes y etiquetas ----- */
    function drawBack() {
      gBack.textContent = "";
      var frame = svg(
        "rect",
        {
          x: ML,
          y: MT,
          width: W - ML - MR,
          height: H - MT - MB,
          fill: "var(--cream)",
          stroke: "var(--navy)",
          "stroke-width": 1.5,
        },
        gBack,
      );
      frame.setAttribute("rx", 0);
      if (o.grid !== false) {
        niceTicks(xr[0], xr[1], 8).forEach(function (v) {
          svg(
            "line",
            {
              x1: px(v),
              x2: px(v),
              y1: MT,
              y2: H - MB,
              stroke: "var(--sand)",
              "stroke-width": 1,
            },
            gBack,
          );
        });
        niceTicks(yr[0], yr[1], 5).forEach(function (v) {
          svg(
            "line",
            {
              x1: ML,
              x2: W - MR,
              y1: py(v),
              y2: py(v),
              stroke: "var(--sand)",
              "stroke-width": 1,
            },
            gBack,
          );
        });
      }
      if (o.axes !== false) {
        if (yr[0] < 0 && yr[1] > 0)
          svg(
            "line",
            {
              x1: ML,
              x2: W - MR,
              y1: py(0),
              y2: py(0),
              stroke: "var(--navy)",
              "stroke-width": 1.6,
            },
            gBack,
          );
        if (xr[0] < 0 && xr[1] > 0)
          svg(
            "line",
            {
              x1: px(0),
              x2: px(0),
              y1: MT,
              y2: H - MB,
              stroke: "var(--navy)",
              "stroke-width": 1.6,
            },
            gBack,
          );
        niceTicks(xr[0], xr[1], 8).forEach(function (v) {
          var t = svg(
            "text",
            {
              x: px(v),
              y: H - MB + 17,
              "text-anchor": "middle",
              fill: "var(--muted)",
              "font-size": 12,
              "font-family": "var(--font-mono)",
            },
            gBack,
          );
          t.textContent = tickText(v);
        });
        niceTicks(yr[0], yr[1], 5).forEach(function (v) {
          var t = svg(
            "text",
            {
              x: ML - 7,
              y: py(v) + 4,
              "text-anchor": "end",
              fill: "var(--muted)",
              "font-size": 12,
              "font-family": "var(--font-mono)",
            },
            gBack,
          );
          t.textContent = tickText(v);
        });
        if (o.xLabel) {
          var xl = svg(
            "text",
            {
              x: W - MR,
              y: H - 4,
              "text-anchor": "end",
              fill: "var(--navy)",
              "font-size": 13,
              "font-weight": 700,
            },
            gBack,
          );
          xl.textContent = o.xLabel;
        }
        if (o.yLabel) {
          var yl = svg(
            "text",
            {
              x: ML + 6,
              y: MT + 14,
              fill: "var(--navy)",
              "font-size": 13,
              "font-weight": 700,
            },
            gBack,
          );
          yl.textContent = o.yLabel;
        }
      }
    }

    /* ----- capas de fondo que se pueden revelar (la curva real, una guía...) ----- */
    var layerMap = {};
    function sampleLayer(L) {
      if (L.points) return L.points;
      var pts = [],
        n = 180;
      for (var i = 0; i <= n; i++) {
        var x = xr[0] + ((xr[1] - xr[0]) * i) / n;
        var y = L.fn(x);
        if (isFinite(y)) pts.push([x, y]);
      }
      return pts;
    }
    function pathOf(pts, toPx) {
      var d = "";
      for (var i = 0; i < pts.length; i++) {
        var X = toPx ? px(pts[i][0]) : pts[i][0],
          Y = toPx ? py(pts[i][1]) : pts[i][1];
        d += (i ? "L" : "M") + X.toFixed(1) + " " + Y.toFixed(1);
      }
      return d;
    }
    (o.layers || []).forEach(function (L, i) {
      var lid = L.id || "capa" + i;
      var el = svg(
        "path",
        {
          d: pathOf(sampleLayer(L), true),
          fill: "none",
          stroke: EC.color(L.color || "s3"),
          "stroke-width": L.width || 3.4,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-dasharray": L.dash || "none",
          opacity: 0,
        },
        gLayers,
      );
      layerMap[lid] = {
        el: el,
        label: L.label || lid,
        color: L.color || "s3",
        shown: false,
        dash: L.dash,
      };
      if (L.show)
        setTimeout(function () {
          pad.reveal(lid, { instant: true });
        }, 0);
    });

    /* ----- trazos ----- */
    function strokePath(pts) {
      if (!pts.length) return "";
      if (pts.length === 1) {
        var a = pts[0];
        return (
          "M" + px(a[0]).toFixed(1) + " " + py(a[1]).toFixed(1) + "l0.01 0"
        );
      }
      var P = pts.map(function (p) {
        return [px(p[0]), py(p[1])];
      });
      var d = "M" + P[0][0].toFixed(1) + " " + P[0][1].toFixed(1);
      for (var i = 1; i < P.length - 1; i++) {
        var mxp = (P[i][0] + P[i + 1][0]) / 2,
          myp = (P[i][1] + P[i + 1][1]) / 2;
        d +=
          "Q" +
          P[i][0].toFixed(1) +
          " " +
          P[i][1].toFixed(1) +
          " " +
          mxp.toFixed(1) +
          " " +
          myp.toFixed(1);
      }
      var last = P[P.length - 1];
      d += "L" + last[0].toFixed(1) + " " + last[1].toFixed(1);
      return d;
    }
    function inkEl(s) {
      return svg(
        "path",
        {
          d: strokePath(s.p),
          fill: "none",
          stroke: EC.color(s.c),
          "stroke-width": s.w,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          class: "ec-sketch-stroke",
        },
        gInk,
      );
    }
    function renderInk() {
      gInk.textContent = "";
      strokes.forEach(inkEl);
      hint.style.opacity = strokes.length ? 0 : 1;
    }
    function changed() {
      renderInk();
      var data = pad.state();
      if (id) EC.keep(id, data);
      if (o.onChange) {
        try {
          o.onChange(pad.strokes(), pad);
        } catch (_) {
          /* el recurso decide qué hacer con el trazo */
        }
      }
      syncButtons();
    }
    function commit() {
      hist = hist.slice(0, pos + 1);
      hist.push(strokes.slice());
      if (hist.length > 60) hist.shift();
      pos = hist.length - 1;
      changed();
    }

    /* ----- puntero ----- */
    function local(ev) {
      var r = board.getBoundingClientRect();
      return [
        ((ev.clientX - r.left) / r.width) * W,
        ((ev.clientY - r.top) / r.height) * H,
      ];
    }
    var drawing = null,
      removed = false;
    board.style.touchAction = "none";
    function eraseAt(P) {
      var keep = strokes.filter(function (s) {
        for (var i = 0; i < s.p.length; i++) {
          var dx = px(s.p[i][0]) - P[0],
            dy = py(s.p[i][1]) - P[1];
          if (dx * dx + dy * dy < 16 * 16) return false;
        }
        return true;
      });
      if (keep.length !== strokes.length) {
        strokes = keep;
        removed = true;
        renderInk();
      }
    }
    board.addEventListener("pointerdown", function (ev) {
      if (ev.button > 0) return;
      ev.preventDefault();
      board.setPointerCapture(ev.pointerId);
      var P = local(ev);
      if (tool === "eraser") {
        removed = false;
        drawing = { erase: true };
        eraseAt(P);
        return;
      }
      if (strokes.length >= MAX_STROKES) {
        say("Ya hay muchos trazos: borra o deshaz alguno para seguir.");
        return;
      }
      var press =
        ev.pointerType === "pen" && ev.pressure > 0 ? ev.pressure : 0.5;
      var s = { c: color, w: size, p: [[r3(mx(P[0])), r3(my(P[1]))]] };
      drawing = {
        s: s,
        el: inkEl(s),
        lastX: P[0],
        lastY: P[1],
        press: [press],
        pen: ev.pointerType === "pen",
        base: size,
      };
      hint.style.opacity = 0;
    });
    function addPoint(ev) {
      var P = local(ev);
      if (drawing.erase) return eraseAt(P);
      var dx = P[0] - drawing.lastX,
        dy = P[1] - drawing.lastY;
      if (dx * dx + dy * dy < 2.5 || drawing.s.p.length >= MAX_POINTS) return;
      drawing.lastX = P[0];
      drawing.lastY = P[1];
      drawing.s.p.push([r3(mx(P[0])), r3(my(P[1]))]);
      if (drawing.pen && ev.pressure > 0) {
        drawing.press.push(ev.pressure);
        var avg =
          drawing.press.reduce(function (a, b) {
            return a + b;
          }, 0) / drawing.press.length;
        drawing.s.w = r3(drawing.base * (0.6 + avg * 0.9));
        drawing.el.setAttribute("stroke-width", drawing.s.w);
      }
      drawing.el.setAttribute("d", strokePath(drawing.s.p));
    }
    board.addEventListener("pointermove", function (ev) {
      if (!drawing) return;
      var list = ev.getCoalescedEvents ? ev.getCoalescedEvents() : null;
      if (list && list.length) list.forEach(addPoint);
      else addPoint(ev);
    });
    function finish() {
      if (!drawing) return;
      var d = drawing;
      drawing = null;
      if (d.erase) {
        if (removed) {
          commit();
          say("Borraste parte del dibujo.");
        }
        return;
      }
      strokes = strokes.concat([d.s]);
      commit();
      say(
        "Trazo agregado. Llevas " +
          strokes.length +
          (strokes.length === 1 ? " trazo." : " trazos."),
      );
    }
    board.addEventListener("pointerup", finish);
    board.addEventListener("pointercancel", finish);

    /* ----- barra de herramientas ----- */
    function mk(label, cls, fn, title) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (cls) b.className = cls;
      if (title) b.title = title;
      b.addEventListener("click", fn);
      return b;
    }
    var toolSeg = document.createElement("div");
    toolSeg.className = "ec-seg";
    var bPen = mk("Lápiz", "", function () {
      setTool("pen");
    });
    var bEraser = mk("Borrador", "", function () {
      setTool("eraser");
    });
    toolSeg.appendChild(bPen);
    toolSeg.appendChild(bEraser);
    bar.appendChild(toolSeg);
    var sw = document.createElement("div");
    sw.className = "ec-sketch-colors";
    sw.setAttribute("role", "group");
    sw.setAttribute("aria-label", "Color del lápiz");
    var names = {
      s1: "azul marino",
      s2: "oro",
      s3: "verde azulado",
      s4: "terracota",
      s5: "violeta",
      s6: "verde",
    };
    var swBtns = colors.map(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ec-sketch-swatch";
      b.style.setProperty("--c", EC.color(c));
      b.setAttribute("aria-label", "Color " + (names[c] || c));
      b.addEventListener("click", function () {
        color = c;
        setTool("pen");
      });
      sw.appendChild(b);
      return b;
    });
    if (colors.length > 1) bar.appendChild(sw);
    var sizeSeg = document.createElement("div");
    sizeSeg.className = "ec-seg";
    var bThin = mk("Fino", "", function () {
      size = sizes.fino;
      setTool("pen");
    });
    var bThick = mk("Grueso", "", function () {
      size = sizes.grueso;
      setTool("pen");
    });
    sizeSeg.appendChild(bThin);
    sizeSeg.appendChild(bThick);
    bar.appendChild(sizeSeg);
    var bUndo = mk("Deshacer", "alt", function () {
      pad.undo();
    });
    var bRedo = mk("Rehacer", "alt", function () {
      pad.redo();
    });
    var bClear = mk("Borrar todo", "alt", function () {
      pad.clear();
    });
    bar.appendChild(bUndo);
    bar.appendChild(bRedo);
    bar.appendChild(bClear);
    function setTool(t) {
      tool = t;
      syncButtons();
    }
    function syncButtons() {
      bPen.setAttribute("aria-pressed", String(tool === "pen"));
      bEraser.setAttribute("aria-pressed", String(tool === "eraser"));
      bThin.setAttribute("aria-pressed", String(size === sizes.fino));
      bThick.setAttribute("aria-pressed", String(size === sizes.grueso));
      swBtns.forEach(function (b, i) {
        b.setAttribute("aria-pressed", String(colors[i] === color));
      });
      bUndo.disabled = pos === 0;
      bRedo.disabled = pos >= hist.length - 1;
      bClear.disabled = !strokes.length;
      stage.className =
        "ec-sketch-stage" + (tool === "eraser" ? " erasing" : "");
    }

    /* ----- alternativa con botones para quien no pueda o no quiera dibujar ----- */
    if (o.choices && o.choices.length) {
      var alt = document.createElement("div");
      alt.className = "ec-sketch-choices";
      var lab = document.createElement("span");
      lab.className = "ec-sketch-choices-label";
      lab.textContent = o.choicesLabel || "O elige una forma:";
      alt.appendChild(lab);
      var segc = document.createElement("div");
      segc.className = "ec-seg";
      o.choices.forEach(function (ch) {
        segc.appendChild(
          mk(ch.label, "", function () {
            pad.setStroke(ch.points || sampleLayer({ fn: ch.fn }));
            say("Elegiste: " + ch.label);
          }),
        );
      });
      alt.appendChild(segc);
      wrap.insertBefore(alt, legend);
    }

    /* ----- API ----- */
    var pad = {
      element: wrap,
      strokes: function () {
        return strokes.map(function (s) {
          return {
            color: s.c,
            points: s.p.map(function (p) {
              return [p[0], p[1]];
            }),
          };
        });
      },
      empty: function () {
        return !strokes.length;
      },
      /* Estado compacto para guardar y restaurar. */
      /* Estado compacto para guardar y restaurar. Los puntos van en una lista plana
         [x0, y0, x1, y1, …] porque el almacenamiento no admite listas dentro de listas. */
      state: function () {
        return strokes.map(function (s) {
          var flat = [];
          s.p.forEach(function (q) {
            flat.push(q[0], q[1]);
          });
          return { c: s.c, w: s.w, p: flat };
        });
      },
      load: function (data) {
        if (!Array.isArray(data)) return;
        strokes = data
          .filter(function (s) {
            return s && Array.isArray(s.p) && s.p.length >= 2;
          })
          .slice(0, MAX_STROKES)
          .map(function (s) {
            var pts = [];
            for (
              var i = 0;
              i + 1 < s.p.length && pts.length < MAX_POINTS;
              i += 2
            )
              pts.push([Number(s.p[i]) || 0, Number(s.p[i + 1]) || 0]);
            return {
              c: typeof s.c === "string" ? s.c : colors[0],
              w: clamp(Number(s.w) || sizes.fino, 1, 12),
              p: pts,
            };
          });
        hist = [strokes.slice()];
        pos = 0;
        renderInk();
        syncButtons();
      },
      /* Altura que el estudiante dibujó en x (la línea más reciente que pasa por ahí), o null. */
      value: function (x) {
        for (var k = strokes.length - 1; k >= 0; k--) {
          var p = strokes[k].p;
          for (var i = 0; i < p.length - 1; i++) {
            var a = p[i],
              b = p[i + 1];
            if ((a[0] <= x && x <= b[0]) || (b[0] <= x && x <= a[0])) {
              var span = b[0] - a[0];
              return span === 0
                ? a[1]
                : a[1] + ((b[1] - a[1]) * (x - a[0])) / span;
            }
          }
        }
        return null;
      },
      /* Reemplaza el dibujo por una forma dada (lista de [x, y]). */
      setStroke: function (points, c) {
        if (!points || !points.length) return;
        var step = Math.max(1, Math.floor(points.length / 160));
        var pts = [];
        for (var i = 0; i < points.length; i += step)
          pts.push([r3(points[i][0]), r3(points[i][1])]);
        strokes = [{ c: c || color, w: sizes.grueso, p: pts }];
        commit();
      },
      undo: function () {
        if (pos === 0) return;
        pos--;
        strokes = hist[pos].slice();
        changed();
        say("Se deshizo el último cambio.");
      },
      redo: function () {
        if (pos >= hist.length - 1) return;
        pos++;
        strokes = hist[pos].slice();
        changed();
      },
      clear: function () {
        if (!strokes.length) return;
        strokes = [];
        commit();
        say("Libreta limpia.");
      },
      /* Muestra una capa de fondo dibujándola de izquierda a derecha. */
      reveal: function (lid, opts) {
        var L = layerMap[lid];
        if (!L || L.shown) return;
        L.shown = true;
        var el = L.el;
        var len = el.getTotalLength ? el.getTotalLength() : 0;
        var dashed = L.dash && L.dash !== "none";
        el.setAttribute("opacity", 1);
        if (!dashed && len && !reduce && !(opts && opts.instant)) {
          el.setAttribute("stroke-dasharray", len + " " + len);
          EC.tween(
            len,
            0,
            (opts && opts.ms) || 1100,
            function (v) {
              el.setAttribute("stroke-dashoffset", v);
            },
            EC.ease.inOut,
          );
          setTimeout(
            function () {
              el.setAttribute("stroke-dasharray", "none");
              el.removeAttribute("stroke-dashoffset");
            },
            ((opts && opts.ms) || 1100) + 80,
          );
        }
        var chip = document.createElement("span");
        chip.className = "ec-sketch-key";
        chip.style.setProperty("--c", EC.color(L.color));
        chip.textContent = L.label;
        chip.dataset.layer = lid;
        legend.appendChild(chip);
        say("Se muestra: " + L.label);
      },
      hide: function (lid) {
        var L = layerMap[lid];
        if (!L || !L.shown) return;
        L.shown = false;
        L.el.setAttribute("opacity", 0);
        var chip = legend.querySelector('[data-layer="' + lid + '"]');
        if (chip) chip.remove();
      },
    };

    drawBack();
    if (id && Array.isArray(EC.state[id])) pad.load(EC.state[id]);
    else renderInk();
    syncButtons();
    return pad;
  };

  var sizeReady = false,
    sizeTimer = 0;
  function reportSize() {
    var h = Math.ceil(document.body.getBoundingClientRect().height);
    if (Math.abs(h - lastHeight) > 6) {
      lastHeight = h;
      post("size", { height: h });
    }
  }
  /* Antes de estar listo no se avisa nada (el contenido aún se arma) y después los cambios
     se juntan en uno solo: así el marco no sube y baja mientras aparece el recurso. */
  new ResizeObserver(function () {
    if (!sizeReady) return;
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(reportSize, 120);
  }).observe(document.body);

  EC.__start = function () {
    Array.prototype.forEach.call(document.body.children, function (child, i) {
      if (child.tagName === "SCRIPT" || child.className === "ec-confetti")
        return;
      child.classList.add("ec-enter");
      child.style.setProperty("--i", String(i));
    });
    EC.sync();
    var ready =
      document.fonts && document.fonts.ready
        ? document.fonts.ready
        : Promise.resolve();
    ready.then(function () {
      document.body.classList.remove("ec-hidden");
      document.body.classList.add("ec-ready");
      sizeReady = true;
      reportSize();
      post("ready");
    });
  };
  window.EC = EC;
})();
