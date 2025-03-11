document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Sunburst Chart Loaded");

  const width = 928, height = width, radius = width / 2.5;
  const svg = d3.select("#sunburst")
    .attr("viewBox", [-width / 2, -height / 2, width, width])
    .style("font", "10px sans-serif");

  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("text-align", "center")
    .style("padding", "6px")
    .style("font", "12px sans-serif")
    .style("background", "lightsteelblue")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("opacity", 0);

  const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, 11));

  let tableauWorksheet = null;

  // ✅ Check if running inside Tableau
  if (typeof tableau !== "undefined" && tableau.extensions) {
    console.log("✅ Running inside Tableau.");
    tableau.extensions.initializeAsync().then(() => {
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      tableauWorksheet = dashboard.worksheets.find(ws => ws.name === "Sheet1"); // Update with your sheet name

      // ✅ Fetch data from Tableau and render the chart
      getDataFromTableau();

      // ✅ Listen for Tableau filter changes
      tableauWorksheet.addEventListener(tableau.TableauEventType.FilterChanged, event => {
        console.log("🎯 Tableau filter detected:", event);
        getDataFromTableau();
      });
    }).catch(error => console.error("❌ Error initializing Tableau API:", error));
  } else {
    console.warn("⚠️ Not running inside Tableau. Loading standalone mode.");
    getDataFromCSV();
  }

  function getDataFromTableau() {
    tableauWorksheet.getSummaryDataAsync().then(data => {
      let parsed = data.data.map(row => ({
        generation: row[0].formattedValue,
        occupation: row[1].formattedValue,
        value: parseInt(row[2].formattedValue.replace(/,/g, "")) || 0
      }));

      console.log("📊 Data from Tableau:", parsed);
      drawSunburst(buildHierarchy(parsed));
    });
  }

  function getDataFromCSV() {
    d3.csv("https://amandarae220.github.io/emsi-sunburst/data.csv").then(rawData => {
      let parsed = rawData.map(d => ({
        generation: d["Generation"],
        occupation: d["Occupation"],
        value: +d["2013 Jobs"].replace(/,/g, "")
      }));

      console.log("📊 Data from CSV:", parsed);
      drawSunburst(buildHierarchy(parsed));
    }).catch(error => console.error("❌ Error loading CSV:", error));
  }

  function buildHierarchy(csvData) {
    const map = new Map();
    csvData.forEach(d => {
      if (!map.has(d.generation)) { map.set(d.generation, new Map()); }
      const occMap = map.get(d.generation);
      occMap.set(d.occupation, (occMap.get(d.occupation) || 0) + d.value);
    });

    return {
      name: "All Jobs",
      children: [...map.entries()].map(([gen, occMap]) => ({
        name: gen,
        children: [...occMap.entries()].map(([occ, val]) => ({ name: occ, value: val }))
      }))
    };
  }

  function drawSunburst(dataHierarchy) {
    svg.selectAll("*").remove();

    const root = d3.partition().size([2 * Math.PI, radius])
      (d3.hierarchy(dataHierarchy).sum(d => d.value));

    root.each(d => d.current = d);

    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius(d => d.y0 * radius)
      .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    const path = svg.append("g").selectAll("path")
      .data(root.descendants().slice(1))
      .join("path")
      .attr("class", "arc")
      .attr("d", d => arc(d.current))
      .attr("fill", d => color(d.ancestors().map(d => d.data.name).reverse().join("/")))
      .attr("fill-opacity", d => d.depth === 1 ? 0.8 : 0.6)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        tooltip.style("opacity", 1)
          .html(`${d.data.name}<br>${d.value}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function () {
        tooltip.style("opacity", 0);
      })
      .on("click", function (event, d) {
        if (d.depth === 1) { // 🎯 Only allow filtering on Generations
          console.log(`🔍 Filtering Tableau by Generation: ${d.data.name}`);
          applyFilterToTableau(d.data.name);
          clicked(event, d);
        }
      });

    path.append("title").text(d => `${d.data.name}\n${d.value}`);

    // ✅ Add Labels
    svg.append("g").selectAll("text")
      .data(root.descendants().slice(1))
      .join("text")
      .attr("transform", d => labelTransform(d))
      .attr("text-anchor", "middle")
      .attr("fill", "#fff")
      .attr("font-size", "12px")
      .attr("opacity", d => d.depth === 1 ? 1 : 0)
      .text(d => d.data.name);

    function clicked(event, p) {
      if (p.depth > 1) return;

      root.each(d => d.target = {
        x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        y0: Math.max(0, d.y0 - p.depth),
        y1: Math.max(0, d.y1 - p.depth)
      });

      const t = svg.transition().duration(750);

      path.transition(t)
        .tween("data", d => {
          const i = d3.interpolate(d.current, d.target);
          return t => d.current = i(t);
        })
        .attrTween("d", d => () => arc(d.current));

      svg.selectAll("text").transition(t)
        .attr("opacity", d => d.depth === 1 ? 1 : 0)
        .attrTween("transform", d => () => labelTransform(d.current));
    }
  }

  function applyFilterToTableau(generation) {
    if (tableauWorksheet) {
      tableauWorksheet.applyFilterAsync("Generation", generation, tableau.FilterUpdateType.Replace)
        .catch(error => console.error("❌ Error applying Tableau filter:", error));
    }
  }

  function labelTransform(d) {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = (d.y0 + d.y1) / 2 * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }
});
