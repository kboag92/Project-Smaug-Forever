// Price lines sit on the left axis, in gold.
// Volume bars sit on the right axis, in listed units.
// A separate axis keeps a large stack from flattening the price lines.
(function () {
  function priceLine(label, data, color) {
    return {
      type: "line",
      label,
      data,
      yAxisID: "y",
      borderColor: color,
      tension: 0.15,
      order: 1,
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
          },
        ].concat(alertLines(labels, options.watches, options.formatCopper)),
      },
      options: {
        responsive: true,
        onClick(event) { options.onClickY(event.y); },
        plugins: {
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
            ticks: { color: "#cbb892" },
            title: { display: true, text: "Gold", color: "#f3e6c8" },
          },
          // Quantity only. Its grid is hidden so it does not cross the gold lines.
          y1: {
            position: "right",
            beginAtZero: true,
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
