// Price lines sit on the left axis.
// Volume bars sit on the right axis, in listed units.
// A separate axis keeps a large stack from flattening the price lines.
(function () {
  // The tallest bar reaches this share of the chart. 20% shows a restock
  // without covering the price lines above it.
  const volumeShare = 0.2;
  // One choice for every item in this browser. A missing name uses the default.
  const linesKey = "forever-auction-lines";
  const offByDefault = ["10–50", "Median", "Average"];

  function savedLines() {
    try {
      const saved = JSON.parse(localStorage.getItem(linesKey) || "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch (error) {
      return {};
    }
  }

  // P10 and Volume start on. The other three price lines start off.
  function lineVisible(label) {
    const saved = savedLines();
    if (typeof saved[label] === "boolean") return saved[label];
    return offByDefault.indexOf(label) === -1;
  }

  function rememberLine(label, visible) {
    const saved = savedLines();
    saved[label] = visible;
    localStorage.setItem(linesKey, JSON.stringify(saved));
  }

  // Headroom above the peak keeps the bars in that bottom band.
  // Tick marks stay on the real quantity, so the top label meets the tallest bar.
  function volumeScale(peak) {
    const max = peak > 0 ? peak / volumeShare : 1;
    const marks = peak > 0 ? [0, Math.round(peak / 2), Math.round(peak)] : [0];
    return { max, marks: [...new Set(marks)] };
  }

  function priceLine(label, data, color) {
    return {
      type: "line",
      label,
      data,
      yAxisID: "y",
      borderColor: color,
      tension: 0.15,
      order: 1,
      hidden: !lineVisible(label),
    };
  }

  // Alert levels are flat gold lines. They stay on the price axis.
  function alertLines(labels, watches, formatCopper) {
    return watches.map((watch) => ({
      type: "line",
      label: "Alert " + formatCopper(watch.price),
      data: labels.map(() => watch.price / 10000),
      yAxisID: "y",
      borderColor: "#f0635a",
      borderDash: [6, 4],
      pointRadius: labels.length < 2 ? 4 : 0,
      borderWidth: 2,
      tension: 0,
      order: 0,
    }));
  }

  function draw(canvas, points, options) {
    const labels = points.map((point) => new Date(point.scanned_at).toLocaleString());
    // A missing price is a gap. Dividing null by 10000 would draw the line at zero.
    const gold = (key) => points.map((point) => (point[key] == null ? null : point[key] / 10000));
    // Missing quantity is a gap. It is not drawn as zero.
    const volume = points.map((point) => (point.quantity == null ? null : Number(point.quantity)));
    const peak = volume.reduce((max, value) => (value == null ? max : Math.max(max, value)), 0);
    const volumeAxis = volumeScale(peak);
    return new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          priceLine("P10", gold("p10_price"), "#e0b44f"),
          // Units after the cheapest 10% and through the middle of the book.
          priceLine("10–50", gold("band_price"), "#c084fc"),
          priceLine("Median", gold("median_price"), "#d7d2c8"),
          priceLine("Average", gold("average_price"), "#6ea8fe"),
          {
            type: "bar",
            label: "Volume",
            data: volume,
            yAxisID: "y1",
            backgroundColor: "rgba(125, 206, 160, 0.45)",
            borderWidth: 0,
            order: 2,
            categoryPercentage: 1,
            barPercentage: 0.85,
            hidden: !lineVisible("Volume"),
          },
        ].concat(alertLines(labels, options.watches, options.formatCopper)),
      },
      options: {
        responsive: true,
        onClick(event) { options.onClickY(event.y); },
        plugins: {
          legend: {
            // Chart.js hides the series. We keep that choice for the next item.
            // Alert labels change with the price, so they are not stored.
            onClick(event, legendItem, legend) {
              const label = String(legendItem.text || "");
              Chart.defaults.plugins.legend.onClick(event, legendItem, legend);
              if (label.startsWith("Alert ")) return;
              rememberLine(label, legend.chart.isDatasetVisible(legendItem.datasetIndex));
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                if (context.parsed.y == null) return context.dataset.label + ": unknown";
                if (context.dataset.yAxisID === "y1") {
                  return "Volume: " + Math.round(context.parsed.y).toLocaleString();
                }
                return context.dataset.label + ": " + options.formatCopper(Math.round(context.parsed.y * 10000));
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: "#cbb892", maxTicksLimit: 8 } },
          y: {
            position: "left",
            ticks: {
              color: "#cbb892",
              // The scale is still gold units. The label is the same split as the coin pictures.
              callback(value) { return options.formatCopper(Math.round(Number(value) * 10000)); },
            },
            title: { display: true, text: "Price", color: "#f3e6c8" },
          },
          // Quantity only. Its grid is hidden so it does not cross the gold lines.
          y1: {
            position: "right",
            beginAtZero: true,
            max: volumeAxis.max,
            afterBuildTicks(scale) {
              scale.ticks = volumeAxis.marks.map((value) => ({ value }));
            },
            grid: { drawOnChartArea: false },
            ticks: { color: "#7dcea0" },
            title: { display: true, text: "Quantity", color: "#7dcea0" },
          },
        },
      },
    });
  }

  window.PriceChart = { draw };
})();
