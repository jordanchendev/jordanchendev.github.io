'use strict';

// Renders the ETF Rotation article's Plotly charts and data tables from the
// trimmed research dataset. Re-renders on language change so labels/headers follow.
(function () {
  var DATA_URL = "./assets/data/etf-rotation.json";

  var COLORS = {
    core: "#7aa2f7",  // blue  — core buy & hold
    lev: "#f7768e",   // red   — leveraged buy & hold
    a: "#ffd45e",     // amber — highlighted strategy
    b: "#9ece6a"      // green — secondary strategy
  };
  var SERIES_COLORS = [COLORS.core, COLORS.lev, COLORS.a, COLORS.b];

  // zh -> en labels for validation choice names (validation rows only carry zh)
  var EN = {
    "純核心持有": "Core buy & hold",
    "純槓桿持有": "Leveraged buy & hold",
    "綜合分數最佳": "Best composite",
    "回撤小於 40% 內最高報酬": "Best within −40% DD",
    "MA：核心站上 SMA200": "MA: core above SMA200",
    "MA：SMA200 ±2% 權重帶": "MA: SMA200 ±2% band",
    "反向降槓桿綜合最佳": "Reverse de-risk, best"
  };

  var state = { data: null, scale: "log" };

  function lang() { return document.documentElement.classList.contains("lang-zh") ? "zh" : "en"; }
  function t(en, zh) { return lang() === "zh" ? zh : en; }
  function nameOf(zh) { return lang() === "zh" ? zh : (EN[zh] || zh); }
  function pct(x) { return (x * 100).toFixed(1) + "%"; }
  function mult(x) { return x >= 100 ? Math.round(x) + "×" : x.toFixed(2) + "×"; }
  function signed(x) { return (x > 0 ? "+" : "") + pct(x); }

  fetch(DATA_URL)
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (d) {
      state.data = d;
      renderAll();
      document.addEventListener("languagechange", renderAll);
      document.querySelectorAll("[data-scale]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.scale = btn.getAttribute("data-scale");
          document.querySelectorAll("[data-scale]").forEach(function (x) {
            x.classList.toggle("active", x === btn);
          });
          renderCharts();
        });
      });
    })
    .catch(function (e) {
      var el = document.getElementById("etf-error");
      if (el) el.style.display = "block";
      console.error("ETF data load failed:", e);
    });

  function renderAll() { renderCharts(); renderTables(); }

  // ---------- charts ----------

  function baseLayout() {
    return {
      margin: { l: 54, r: 14, t: 8, b: 30 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#cfcfcf", family: "Poppins, sans-serif", size: 12 },
      legend: { orientation: "h", y: -0.16, font: { size: 11 } },
      hovermode: "x unified",
      xaxis: { gridcolor: "rgba(255,255,255,0.06)", zeroline: false },
      yaxis: { gridcolor: "rgba(255,255,255,0.06)", zeroline: false }
    };
  }

  function curveTraces(pairKey) {
    return state.data.featured[pairKey].series.map(function (s, i) {
      return {
        type: "scatter", mode: "lines",
        name: lang() === "zh" ? s.labelZh : s.labelEn,
        x: s.dates, y: s.multiples,
        line: { width: i >= 2 ? 2.6 : 1.6, color: SERIES_COLORS[i % SERIES_COLORS.length] },
        hovertemplate: "%{fullData.name}: %{y:.2f}×<extra></extra>"
      };
    });
  }

  function curveChart(divId, pairKey) {
    var lay = baseLayout();
    lay.yaxis.type = state.scale === "log" ? "log" : "linear";
    lay.yaxis.title = { text: t("Growth (×, start = 1)", "成長倍數(起始 = 1)") };
    Plotly.react(divId, curveTraces(pairKey), lay, { displayModeBar: false, responsive: true });
  }

  function monteCarloChart() {
    var mc = state.data.featured.NASDAQ.validation.monteCarlo;
    var names = mc.map(function (r) { return nameOf(r.choiceName); });
    function bar(key, label, color) {
      return { type: "bar", name: label, x: names, y: mc.map(function (r) { return r[key]; }),
        marker: { color: color }, hovertemplate: "%{x}<br>%{y:.2f}×<extra>" + label + "</extra>" };
    }
    var lay = baseLayout();
    lay.barmode = "group";
    lay.margin.b = 90;
    lay.xaxis.tickangle = -22;
    lay.yaxis.type = "log";
    lay.yaxis.title = { text: t("10y final multiple (×, log)", "10 年終值倍數(×,log)") };
    var data = [
      bar("p05FinalMultiple", t("P05 (worst 5%)", "P05(較差 5%)"), COLORS.core),
      bar("p50FinalMultiple", t("P50 (median)", "P50(中位)"), COLORS.a),
      bar("p95FinalMultiple", t("P95 (best 5%)", "P95(較好 5%)"), COLORS.b)
    ];
    Plotly.react("chart-montecarlo", data, lay, { displayModeBar: false, responsive: true });
  }

  function renderCharts() {
    if (!state.data || !window.Plotly) return;
    curveChart("chart-nasdaq", "NASDAQ");
    curveChart("chart-taiwan", "TAIWAN50");
    monteCarloChart();
  }

  // ---------- tables ----------

  function table(id, headers, rows) {
    var el = document.getElementById(id);
    if (!el) return;
    var thead = "<thead><tr>" + headers.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead>";
    var tbody = "<tbody>" + rows.map(function (r) {
      return "<tr" + (r._bench ? ' class="row-bench"' : "") + ">" +
        r.cells.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>";
    }).join("") + "</tbody>";
    el.innerHTML = thead + tbody;
  }

  function ddCell(x) { return '<span class="neg">' + pct(x) + "</span>"; }
  function cagrCell(x) { return '<span class="pos">' + pct(x) + "</span>"; }

  function renderTables() {
    if (!state.data) return;
    var d = state.data;

    // benchmark — all pairs
    table("table-benchmark",
      [t("Pair", "標的對"), t("Core CAGR", "核心 CAGR"), t("Core MaxDD", "核心 MaxDD"),
       t("Lev CAGR", "槓桿 CAGR"), t("Lev MaxDD", "槓桿 MaxDD"), t("Period", "期間")],
      d.pairs.map(function (p) {
        return { _bench: true, cells: [
          p.name, cagrCell(p.coreCagr), ddCell(p.coreMaxdd),
          cagrCell(p.levCagr), ddCell(p.levMaxdd),
          p.start.slice(0, 4) + "–" + p.end.slice(0, 4)
        ] };
      }));

    // results — NASDAQ & TAIWAN50
    [["table-results-nasdaq", "NASDAQ"], ["table-results-taiwan", "TAIWAN50"]].forEach(function (pair) {
      table(pair[0],
        [t("Strategy", "策略"), "CAGR", "MaxDD", t("Switches", "切換"), t("Final ×", "終值 ×")],
        (d.resultsTable[pair[1]] || []).map(function (r) {
          var bench = r.choiceZh === "純核心持有" || r.choiceZh === "純槓桿持有";
          return { _bench: bench, cells: [
            lang() === "zh" ? r.choiceZh : r.choiceEn,
            cagrCell(r.cagr), ddCell(r.maxdd), r.switches, mult(r.finalMultiple)
          ] };
        }));
    });

    // monte carlo — NASDAQ
    var mc = d.featured.NASDAQ.validation.monteCarlo;
    table("table-montecarlo",
      [t("Strategy", "策略"), "P05", "P50", "P95", t("Loss prob.", "虧損機率"), t("Median DD", "中位回撤")],
      mc.map(function (r) {
        var bench = r.choiceName === "純核心持有" || r.choiceName === "純槓桿持有";
        return { _bench: bench, cells: [
          nameOf(r.choiceName), mult(r.p05FinalMultiple), mult(r.p50FinalMultiple),
          mult(r.p95FinalMultiple), pct(r.probabilityOfLoss), ddCell(r.medianMaxDrawdown)
        ] };
      }));

    // rolling — NASDAQ, 5-year horizon
    var rolling = d.featured.NASDAQ.validation.rolling.filter(function (r) { return r.horizonYears === 5; });
    table("table-rolling",
      [t("Strategy (5y rolling)", "策略(5 年滾動)"), t("Median", "中位"), "P05",
       t("Win vs core", "勝率 vs 核心"), t("Worst DD", "最差回撤")],
      rolling.map(function (r) {
        var bench = r.choiceName === "純核心持有" || r.choiceName === "純槓桿持有";
        return { _bench: bench, cells: [
          nameOf(r.choiceName), mult(r.medianFinalMultiple), mult(r.p05FinalMultiple),
          pct(r.winRateVsCore), ddCell(r.worstMaxDrawdown)
        ] };
      }));
  }
})();
