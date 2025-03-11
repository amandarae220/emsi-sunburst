document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Sunburst Chart Loaded");

  const width = 928, height = width, radius = width / 6;
  const svg = d3.select("#sunburst")
    .attr("viewBox", [-width/2, -height/2, width, width])
    .style("font", "10px sans-serif");

  const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, 11));
  let tableauWorksheet = null;

  // ✅ Initialize Tableau Extensions API
  if (typeof tableau !== "undefined") {
    tableau.extensions.initializeAsync().then(() => {
      console.log("✅ Tableau Extensions API initialized.");
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      tableauWorksheet = dashboard.worksheets.find(ws => ws.name === "Sheet1"); // Update with your worksheet name
      
      // ✅ Listen for Tableau filter changes
      tableauWorksheet.addEventListener(tableau.TableauEventType.FilterChanged, event => {
        console.log("🎯 Tableau filter detected:", event);
        applyTableauFilter(event);
      });

      // ✅ Fetch data and render the chart
      getDataAndRender();
    }).catch(error => console.error("❌ Error initializing Tableau API:", error));
  } else {
    console.warn("❌ Tableau Extensions API is not available.");
  }

  // ✅ Get data from Tableau and render Sunburst
  function getDataAndRender() {
    tableauWorksheet.getSummaryDataAsync().then(data => {
      let parsed = data.data.map(row => ({
        generation: row[3].formattedValue,
        occupation: row[2].formattedValue,
        value: parseInt(row[4].formattedValue.replace(/,/g, "")) || 0
      }));

      console.log("📊 Data from Tableau:", parsed);
      drawSunburst(buildHierarchy(parsed));
    });
  }

  // ✅ Filter Tableau when clicking the Sunburst
  function applyFilterToTableau(generation) {
    if (tableauWorksheet) {
      tableauWorksheet.applyFilterAsync("Generation", generation, tableau.FilterUpdateType.Replace)
        .catch(error => console.error("❌ Error applying Tableau filter:", error));
    }
  }

  // ✅ Build hierarchical data
  function buildHierarchy(csvData) {
    const map = new Map();
    csvData.forEach(d => {
      if (!map.has(d.generation)) { map.set(d.generation, new Map()); }
      const occMap = map.get(d.generation);
      occMap.set(d.occupation, (occMap.get(d.occupation) || 0) + d.value);
    });

    return { name: "All Jobs", children: [...map.entries()].map(([gen, occMap]) => ({
      name: gen, children: [...occMap.entries()].map(([occ, val]) => ({ name: occ, value: val }))
    })) };
  }

  // ✅ Draw Sunburst
  function drawSunburst(dataHierarchy) {
    svg.selectAll("*").remove();
    const root = d3.partition().size([2 * Math.PI, 2])
      (d3.hierarchy(dataHierarchy).sum(d => d.value));
    
    const arc = d3.arc()
      .startAngle(d => d.x0).endAngle(d => d.x1)
      .innerRadius(d => d.y0 * radius).outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    const path = svg.append("g").selectAll("g")
      .data(root.descendants().slice(1))
      .join("g")
      .append("path")
      .attr("class", "arc")
      .attr("d", arc)
      .attr("fill", d => color(d.ancestors().map(d => d.data.name).reverse().join("/")))
      .on("click", (event, d) => {
        if (d.depth === 1) applyFilterToTableau(d.data.name);
      });

    path.append("title").text(d => `${d.data.name}\n${d.value}`);
  }
});
