document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Sunburst Chart Loaded");

  const width = 928, height = width, radius = width / 2.5;
  const svg = d3.select("#sunburst")
    .attr("viewBox", [-width / 2, -height / 2, width, width])
    .style("font", "10px sans-serif");

  const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, 11));

  let tableauWorksheet = null;

  // ✅ Fetch Data from CSV (For Standalone Mode)
  window.getDataFromCSV = function () {
    d3.csv("https://amandarae220.github.io/emsi-sunburst/data.csv").then(rawData => {
      console.log("📊 Data from CSV Loaded:", rawData);
      let parsed = rawData.map(d => ({
        generation: d["Generation"],
        occupation: d["Occupation"],
        value: +d["2013 Jobs"].replace(/,/g, "")
      }));
      drawSunburst(buildHierarchy(parsed));
    }).catch(error => console.error("❌ Error loading CSV:", error));
  };

  // ✅ Convert Flat Data to Hierarchical Structure for D3 Sunburst
  window.buildHierarchy = function (csvData) {
    const map = new Map();
    csvData.forEach(d => {
      if (!map.has(d.generation)) { map.set(d.generation, new Map()); }
      const occMap = map.get(d.generation);
      occMap.set(d.occupation, (occMap.get(occ) || 0) + d.value);
    });

    return {
      name: "All Jobs",
      children: [...map.entries()].map(([gen, occMap]) => ({
        name: gen,
        children: [...occMap.entries()].map(([occ, val]) => ({ name: occ, value: val }))
      }))
    };
  };

  // ✅ Draw Sunburst Chart
  window.drawSunburst = function (dataHierarchy) {
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
      .on("click", function (event, d) {
        if (d.depth === 1) { // 🎯 Only allow filtering on Generations
          console.log(`🔍 Filtering Tableau by Generation: ${d.data.name}`);
          applyFilterToTableau(d.data.name);
        }
      });

    path.append("title").text(d => `${d.data.name}\n${d.value}`);
  };

  // ✅ Apply Filter to Tableau When Clicking Sunburst
  window.applyFilterToTableau = function (generation) {
    if (tableauWorksheet) {
      tableauWorksheet.applyFilterAsync("Generation", generation, tableau.FilterUpdateType.Replace)
        .catch(error => console.error("❌ Error applying Tableau filter:", error));
    }
  };

  // ✅ Initialize Tableau Extension or Load CSV
  if (typeof tableau !== "undefined" && tableau.extensions) {
    console.log("✅ Running inside Tableau.");
    tableau.extensions.initializeAsync().then(() => {
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      tableauWorksheet = dashboard.worksheets.find(ws => ws.name === "Sheet1");

      tableauWorksheet.getSummaryDataAsync().then(data => {
        let parsed = data.data.map(row => ({
          generation: row[0].formattedValue,
          occupation: row[1].formattedValue,
          value: parseInt(row[2].formattedValue.replace(/,/g, "")) || 0
        }));

        console.log("📊 Data from Tableau:", parsed);
        drawSunburst(buildHierarchy(parsed));
      });

      tableauWorksheet.addEventListener(tableau.TableauEventType.FilterChanged, event => {
        console.log("🎯 Tableau filter detected:", event);
        tableauWorksheet.getSummaryDataAsync().then(data => {
          let parsed = data.data.map(row => ({
            generation: row[0].formattedValue,
            occupation: row[1].formattedValue,
            value: parseInt(row[2].formattedValue.replace(/,/g, "")) || 0
          }));

          drawSunburst(buildHierarchy(parsed));
        });
      });

    }).catch(error => console.error("❌ Error initializing Tableau API:", error));
  } else {
    console.warn("⚠️ Not running inside Tableau. Loading standalone mode.");
    getDataFromCSV();
  }
});
