const API_URL = "https://data.vatsim.net/v3/vatsim-data.json";

const MODES = {
  oceanic: ["planned", "cruise", "exit"]
};

const state = {
  icao: "EGLL",
  mode: "oceanic",
  positions: JSON.parse(localStorage.getItem("positions_vstrips") || "{}"),
  orders: JSON.parse(localStorage.getItem("orders_vstrips") || "{}"),
  flights: {}
};

// ────────────── Live UTC Clock (time only) ──────────────
function updateUTCTime() {
  const now = new Date();
  const h = String(now.getUTCHours()).padStart(2, '0');
  const m = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  
  const timeStr = `${h}:${m}:${s} Z`;
  
  const el = document.getElementById('utc-time');
  if (el) el.textContent = timeStr;
}

updateUTCTime();
setInterval(updateUTCTime, 1000);

function getCols() {
  return MODES[state.mode];
}

function extractRegistration(remarks = "") {
  const m = remarks.match(/REG\/([A-Z0-9-]+)/i);
  return m ? m[1].toUpperCase() : "";
}

function extractAirwaysFromRoute(route) {
  if (!route) return [];
  const matches = route.match(/\b([A-Z][A-Z0-9]{2,5})\b/g) || [];
  return matches.filter(awy => AIRWAY_DB && AIRWAY_DB[awy]);
}

function getContextWaypoints(route, airway) {
  if (!route || !airway) return { before: null, after: null };

  const tokens = route.toUpperCase().split(/\s+/);
  const idx = tokens.indexOf(airway);

  if (idx === -1) return { before: null, after: null };

  return {
    before: idx > 0 ? tokens[idx - 1] : null,
    after: idx < tokens.length - 1 ? tokens[idx + 1] : null
  };
}

function buildOceanicStrip(f) {
  const div = document.createElement("div");
  div.className = "strip oceanic";
  div.draggable = true;
  div.dataset.callsign = f.callsign;
  div.style.position = "relative";

  // ────────────── Set background based on cruise altitude ──────────────
  let cruiseAlt = f.cruise || "";        
  let secondDigit = cruiseAlt[1];        
  if (secondDigit && !isNaN(parseInt(secondDigit, 10))) {
    let evenOdd = parseInt(secondDigit, 10) % 2 === 0;
    div.style.background = evenOdd ? "#f3f6ff" : "#f3fff3";
    div.style.color = "#000";
  } else {
    div.style.background = "#f3f6ff";
    div.style.color = "#000";
  }

  div.style.border = "1px solid #2563eb";
  div.style.borderRadius = "8px";
  div.style.padding = "4px";
  div.style.fontFamily = "monospace";

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.tableLayout = "fixed";
  table.style.fontSize = "12px";

  const airways = extractAirwaysFromRoute(f.route || "");
  const primaryAirway = airways[airways.length - 1] || null;

  let waypoints = primaryAirway && AIRWAY_DB[primaryAirway]
    ? [...AIRWAY_DB[primaryAirway]]
    : [];

  if (waypoints.length >= 2 && primaryAirway) {
    const ctx = getContextWaypoints(f.route || "", primaryAirway);
    if (ctx.before) {
      const lastFew = waypoints.slice(-5);
      if (lastFew.includes(ctx.before)) waypoints.reverse();
    }
  }

  const fixColumnCount = Math.min(Math.max(waypoints.length, 4), 10);

  let firstRow = `
    <tr>
      <td class="callsign-cell">${f.aircraft || "----"}</td>
      <td>1</td>
      <td>${f.dep || "----"}</td>
      <td rowspan="3"><input class="act-box fix-box" placeholder="${f.cruise?.slice(0,3) || "----"}"></td>
  `;
  for (let i = 0; i < fixColumnCount; i++) {
    const wp = waypoints[i] || "";
    firstRow += `<td><input class="act-box fix-box" placeholder="FIX" value="${wp}"></td>`;
  }
  firstRow += `</tr>`;

  let secondRow = `
    <tr>
      <td colspan="2" style="background:#fde047;font-weight:bold">
        ${f.callsign}
        ${primaryAirway ? `<small style="color:#555;">(${primaryAirway})</small>` : ""}
      </td>
      <td><input class="act-box est-box" placeholder="MACH"/></td>
  `;
  for (let i = 0; i < fixColumnCount; i++) {
    secondRow += `<td><input class="act-box est-box" placeholder="EST"/></td>`;
  }
  secondRow += `</tr>`;

  let thirdRow = `
    <tr>
      <td></td>
      <td>${f.registration || "----"}</td>
      <td>${f.arr || "----"}</td>
  `;
  for (let i = 0; i < fixColumnCount; i++) {
    thirdRow += `<td><input class="act-box act-box-row" placeholder="ACT"/></td>`;
  }
  thirdRow += `</tr>`;

  table.innerHTML = firstRow + secondRow + thirdRow;

  [...table.querySelectorAll("td")].forEach(td => {
    td.style.border = "1px solid #2563eb";
    td.style.padding = "2px";
    td.style.textAlign = "center";
    td.style.whiteSpace = "nowrap";
  });

  [...table.querySelectorAll(".act-box")].forEach(input => {
    input.style.width = "100%";
    input.style.border = "none";
    input.style.outline = "none";
    input.style.textAlign = "center";
    input.style.fontFamily = "monospace";
    input.style.background = "transparent";
  });

  const callsignCell = table.querySelector(".callsign-cell");
  callsignCell.style.cursor = "pointer";
  callsignCell.title = "Double-click to delete strip";
  callsignCell.addEventListener("dblclick", () => {
    div.remove();
    delete state.positions[f.callsign];
    delete state.flights[f.callsign];
    getCols().forEach(col => {
      if (state.orders[col]) state.orders[col] = state.orders[col].filter(cs => cs !== f.callsign);
    });
    localStorage.setItem("positions_vstrips", JSON.stringify(state.positions));
    localStorage.setItem("orders_vstrips", JSON.stringify(state.orders));
  });

  const fixInputs = table.querySelectorAll(".fix-box");
  fixInputs.forEach(input => {
    input.addEventListener("input", () => {
      const allFilled = [...fixInputs].every(i => i.value.trim() !== "");
      if (allFilled && !table.querySelector(".extra-col")) {
        const trRows = table.querySelectorAll("tr");

        const newFix = document.createElement("td");
        newFix.className = "extra-col";
        newFix.textContent = "WPTX";
        trRows[0].appendChild(newFix);

        const newEst = document.createElement("td");
        newEst.className = "extra-col";
        const estInput = document.createElement("input");
        estInput.className = "act-box est-box extra-col";
        estInput.placeholder = "EST";
        newEst.appendChild(estInput);
        trRows[1].appendChild(newEst);

        const newAct = document.createElement("td");
        newAct.className = "extra-col";
        const actInput = document.createElement("input");
        actInput.className = "act-box act-box-row extra-col";
        actInput.placeholder = "ACT";
        newAct.appendChild(actInput);
        trRows[2].appendChild(newAct);
      }
    });
  });

  div.appendChild(table);
  enableDrag(div);
  return div;
}

function buildCustomStrip(text, callsign) {
  const div = document.createElement("div");
  div.className = "strip custom";
  div.draggable = true;
  div.dataset.callsign = callsign;

  div.style.background = "#ffe0b2";
  div.style.fontWeight = "bold";
  div.style.padding = "6px 8px";
  div.style.textAlign = "center";
  div.style.margin = "8px auto";
  div.style.display = "flex";
  div.style.alignItems = "center";
  div.style.justifyContent = "center";
  div.style.minHeight = "60px";
  div.style.fontSize = "clamp(12px, 2vw, 16px)";
  div.style.border = "1.5px solid #3a7bd5";
  div.style.borderRadius = "10px";
  div.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  div.style.maxWidth = "420px";

  div.textContent = text;
  div.style.cursor = "pointer";
  div.title = "Double-click to delete strip";
  div.addEventListener("dblclick", () => {
    div.remove();
    delete state.positions[callsign];
    delete state.flights[callsign];
    getCols().forEach(col => {
      if (state.orders[col]) state.orders[col] = state.orders[col].filter(cs => cs !== callsign);
    });
    localStorage.setItem("positions_vstrips", JSON.stringify(state.positions));
    localStorage.setItem("orders_vstrips", JSON.stringify(state.orders));
  });

  enableDrag(div);
  return div;
}

function enableDrag(strip) {
  strip.addEventListener("dragstart", e => {
    strip.classList.add("dragging");
    e.dataTransfer.setData("text/plain", strip.dataset.callsign);
  });

  strip.addEventListener("dragend", () => {
    strip.classList.remove("dragging");
    saveOrders();
  });
}

function getAfterElement(container, y) {
  const els = [...container.querySelectorAll(".strip:not(.dragging)")];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: -Infinity }).element;
}

async function addOceanicStrip() {
  const input = document.getElementById("oceanicCallsign");
  const callsign = input.value.trim().toUpperCase();
  if (!callsign || state.flights[callsign]) return;

  const data = await (await fetch(API_URL)).json();
  const p = data.pilots.find(p => p.callsign === callsign);

  state.flights[callsign] = p && p.flight_plan ? {
    callsign,
    dep: p.flight_plan.departure || "----",
    arr: p.flight_plan.arrival || "----",
    aircraft: p.flight_plan.aircraft_short || "----",
    cruise: p.flight_plan.altitude || "----",
    squawk: p.transponder || "----",
    registration: extractRegistration(p.flight_plan.remarks),
    route: p.flight_plan.route || "",
    type: "oceanic"
  } : {
    callsign,
    dep: "----",
    arr: "----",
    aircraft: "----",
    cruise: "----",
    squawk: "----",
    registration: "----",
    route: "",
    type: "oceanic"
  };

  state.positions[callsign] ||= getCols()[0];
  saveOrders();
  render();
  input.value = "";
}

function saveOrders() {
  const orders = {};
  getCols().forEach(col => {
    orders[col] = [...document.getElementById(col)
      .querySelectorAll(".strip")]
      .map(s => s.dataset.callsign);
  });
  state.orders = orders;
  localStorage.setItem("orders_vstrips", JSON.stringify(orders));
  localStorage.setItem("positions_vstrips", JSON.stringify(state.positions));
}

function render() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  getCols().forEach(col => {
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.id = col;
    lane.innerHTML = `<h2>${col.toUpperCase()}</h2>`;
    board.appendChild(lane);

    lane.addEventListener("dragover", e => {
      e.preventDefault();
      const dragging = document.querySelector(".dragging");
      const after = getAfterElement(lane, e.clientY);
      after ? lane.insertBefore(dragging, after) : lane.appendChild(dragging);
    });

    lane.addEventListener("drop", e => {
      const cs = e.dataTransfer.getData("text/plain");
      state.positions[cs] = col;
      saveOrders();
    });
  });

  getCols().forEach(col => {
    const lane = document.getElementById(col);
    const ordered = (state.orders[col] || []).map(cs => state.flights[cs]).filter(Boolean);
    const unordered = Object.values(state.flights).filter(f =>
      state.positions[f.callsign] === col &&
      !(state.orders[col] || []).includes(f.callsign)
    );

    [...ordered, ...unordered].forEach(f => {
      let strip;
      if (f.type === "custom") {
        strip = buildCustomStrip(f.text, f.callsign);
      } else {
        strip = buildOceanicStrip(f);
      }
      lane.appendChild(strip);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("addOceanicBtn").onclick = addOceanicStrip;
  document.getElementById("oceanicCallsign").addEventListener("keydown", e => {
    if (e.key === "Enter") addOceanicStrip();
  });

  document.getElementById("addCustomStripBtn").onclick = () => {
    const text = document.getElementById("customStripText").value.trim();
    if (!text) return;

    const stripId = `CUSTOM-${Date.now()}`;
    state.flights[stripId] = { callsign: stripId, type: "custom", text };
    state.positions[stripId] ||= getCols()[0];
    saveOrders();
    render();
    document.getElementById("customStripText").value = "";
  };

  document.getElementById("customStripText").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("addCustomStripBtn").click();
  });

  render();
});