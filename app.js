// ===========================
// Utilities
// ===========================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const fmtDT = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
const toast = (msg = "Saved ✔️") => {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1600);
};
const capitalize = (s) => (!s ? "—" : s[0].toUpperCase() + s.slice(1));

// ===========================
// Local Storage
// ===========================
const LS_KEY = "workouts_v1";
const loadAll = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch (e) {
    return [];
  }
};
const saveAll = (arr) => localStorage.setItem(LS_KEY, JSON.stringify(arr));

// ===========================
// App State
// ===========================
let current = {
  id: uuid(),
  location: null, // 'gym'|'home'
  mode: null, // 'now'|'record'
  dateTimeISO: null,
  trainingType: null,
  specificMuscle: null,
  equipment: [],
  exercises: [],
};
let editIndex = null;
let history = loadAll();

// ===========================
// Router (hash-based)
// ===========================
const routes = ["#/session", "#/equipment", "#/exercises", "#/review", "#/history"];
function go(hash) {
  if (!routes.includes(hash)) hash = "#/session";
  window.location.hash = hash;
}
function renderRoute() {
  const hash = window.location.hash || "#/session";
  $$(".page").forEach((p) => {
    p.hidden = p.dataset.route !== hash;
  });
  // Light up stepper
  const idx = routes.indexOf(hash);
  if (idx >= 0) {
    $("#stepper")
      .querySelectorAll(".step")
      .forEach((s) => s.classList.toggle("active", +s.dataset.step === idx + 1));
  }
  // Page-entry hooks
  switch (hash) {
    case "#/session":
      break;
    case "#/equipment":
      renderEquipSelected();
      break;
    case "#/exercises":
      refreshExerciseSuggestions();
      renderExerciseList();
      break;
    case "#/review":
      renderReview();
      break;
    case "#/history":
      refreshHistoryUI();
      break;
  }
}
window.addEventListener("hashchange", renderRoute);

// Enable any element with data-link to navigate
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-link]");
  if (link) {
    e.preventDefault();
    go(link.getAttribute("data-link"));
  }
});

// ===========================
// Header Tabs (Gym/Home)
// ===========================
const locationTabs = $("#locationTabs");
locationTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  $$(".tab").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  current.location = btn.dataset.location;
  $("#currentLocationPill").textContent = `Location: ${capitalize(current.location)}`;
  $("#sumLoc").textContent = capitalize(current.location);
});

// ===========================
// Step 1: Session
// ===========================
$("#modeChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  $$("#modeChips .chip").forEach((c) => c.classList.remove("selected"));
  chip.classList.add("selected");
  current.mode = chip.dataset.mode === "now" ? "now" : "record";
  $("#sumMode").textContent = current.mode === "now" ? "Training Now" : "Recording";
  if (current.mode === "record") {
    $("#recordFields").style.display = "block";
    $("#dt").focus();
  } else {
    $("#recordFields").style.display = "none";
    current.dateTimeISO = new Date().toISOString();
    $("#sumDT").textContent = fmtDT(current.dateTimeISO);
  }
});
$("#dt").addEventListener("change", (e) => {
  current.dateTimeISO = e.target.value ? new Date(e.target.value).toISOString() : null;
  $("#sumDT").textContent = fmtDT(current.dateTimeISO);
});

$("#tt").addEventListener("change", (e) => {
  const val = e.target.value;
  current.trainingType = val;
  const showMuscle = val === "Specific";
  $("#muscleWrap").style.display = showMuscle ? "block" : "none";
  if (!showMuscle) current.specificMuscle = null;
  updateSummaryTraining();
});
$("#muscle").addEventListener("change", (e) => {
  current.specificMuscle = e.target.value;
  updateSummaryTraining();
});
function updateSummaryTraining() {
  let s = current.trainingType || "—";
  if (current.trainingType === "Specific" && current.specificMuscle) s += ` (${current.specificMuscle})`;
  $("#sumTrain").textContent = s;
}

// Validation + navigation
$("#toStep2").addEventListener("click", (e) => {
  // Allow anchor default only if valid
  if (!current.location) return void (alert("Please choose Gym or Home at the top."), e.preventDefault());
  if (!current.mode) return void (alert("Please choose whether you are Training Now or Recording."), e.preventDefault());
  if (current.mode === "record" && !current.dateTimeISO)
    return void (alert("Please choose a date & time for the recorded workout."), e.preventDefault());
  if (!current.trainingType) return void (alert("Please select what you are training."), e.preventDefault());
  if (current.trainingType === "Specific" && !current.specificMuscle)
    return void (alert("Please choose the specific muscle."), e.preventDefault());
});

// ===========================
// Step 2: Equipment
// ===========================
const equipCheckboxes = $$(".equip");
equipCheckboxes.forEach((cb) => {
  cb.addEventListener("change", () => {
    current.equipment = equipCheckboxes.filter((x) => x.checked).map((x) => x.value);
    renderEquipSelected();
  });
});
function renderEquipSelected() {
  const area = $("#equipSelected");
  if (!area) return;
  area.innerHTML = "";
  if (current.equipment.length === 0) {
    area.innerHTML = '<span class="muted">None selected.</span>';
    return;
  }
  current.equipment.forEach((eq) => {
    const span = document.createElement("span");
    span.className = "chip selected";
    span.textContent = eq;
    area.appendChild(span);
  });
}

// ===========================
// Step 3: Exercises + Sets
// ===========================
const prevInfo = $("#prevInfo");
const exName = $("#exName");
const setInputs = $("#setInputs");

if (exName) {
  exName.addEventListener("input", () => {
    showPrevForExercise(exName.value.trim());
  });
}

$("#buildSets")?.addEventListener("click", buildSetRows);
$("#addSet")?.addEventListener("click", (e) => {
  e.preventDefault();
  addSetRow();
});
$("#clearSets")?.addEventListener("click", (e) => {
  e.preventDefault();
  setInputs.innerHTML = "";
});

function buildSetRows(e) {
  e && e.preventDefault();
  setInputs.innerHTML = "";
  let n = parseInt($("#setCount").value || "0", 10);
  if (!Number.isFinite(n) || n < 1) n = 3;
  for (let i = 0; i < n; i++) addSetRow();
}

function addSetRow(prefill = { weight: "", reps: "", hint: "" }) {
  const idx = setInputs.children.length + 1;
  const row = document.createElement("div");
  row.className = "set-row";
  row.innerHTML = `
    <div class="idx">#${idx}</div>
    <input type="number" step="0.5" min="0" placeholder="Weight (kg)" value="${prefill.weight}" />
    <input type="number" step="1" min="0" placeholder="Reps" value="${prefill.reps}" />
    <small class="muted">${prefill.hint ? "Last: " + prefill.hint : ""}</small>
    <button class="ghost-btn danger" title="Remove set">Delete</button>
  `;
  const hintEl = row.children[3];
  hintEl.style.cursor = prefill.hint ? "pointer" : "default";
  hintEl.addEventListener("click", () => {
    if (!prefill.hint) return;
    const m = /([\d.]+)\s*kg\s*×\s*(\d+)/i.exec(prefill.hint);
    if (m) {
      row.children[1].value = m[1];
      row.children[2].value = m[2];
    }
  });
  row.children[4].addEventListener("click", () => {
    row.remove();
    renumberSets();
  });
  setInputs.appendChild(row);
}
function renumberSets() {
  [...setInputs.children].forEach((r, i) => (r.querySelector(".idx").textContent = `#${i + 1}`));
}

function showPrevForExercise(name) {
  if (!prevInfo) return;
  if (!name) {
    prevInfo.innerHTML = "Enter an exercise name to see your last session & heaviest.";
    prevInfo.className = "empty";
    return;
  }
  const { last, heaviest } = getExerciseHistorySummary(name);
  if (!last && heaviest === null) {
    prevInfo.innerHTML = `No history for <strong>${name}</strong> yet.`;
    prevInfo.className = "empty";
    return;
  }
  prevInfo.className = "exercise-card";
  const lastLines = last ? last.sets.map((s, i) => `Set ${i + 1}: <code>${s.weight} kg × ${s.reps}</code>`).join("<br/>") : "—";
  const lastDate = last ? fmtDT(last.date) : "—";
  prevInfo.innerHTML = `
    <div class="flex"><strong>History for ${name}</strong><span class="pill">Heaviest ever: ${heaviest ?? "—"} kg</span><div class="right muted">Last time: ${lastDate}</div></div>
    <div style="margin-top:6px">${lastLines}</div>
  `;
  const builtRows = [...setInputs.children];
  if (builtRows.length && last) {
    builtRows.forEach((row, i) => {
      const lastSet = last.sets[i];
      const hint = lastSet ? `${lastSet.weight} kg × ${lastSet.reps}` : "";
      row.children[3].textContent = hint ? `Last: ${hint}` : "";
      if (hint && !row.children[1].value && !row.children[2].value) {
        row.children[1].value = lastSet.weight;
        row.children[2].value = lastSet.reps;
      }
    });
  }
}

function gatherExerciseFromUI() {
  const name = exName.value.trim();
  if (!name) {
    alert("Enter an exercise name.");
    return null;
  }
  const rows = [...setInputs.children];
  if (rows.length === 0) {
    alert("Add at least one set.");
    return null;
  }
  const sets = rows.map((row, i) => {
    const w = parseFloat(row.children[1].value || "0");
    const r = parseInt(row.children[2].value || "0", 10);
    return { set: i + 1, weight: isFinite(w) ? w : 0, reps: isFinite(r) ? r : 0 };
  });
  const equipment = $("#exEquip").value || null;
  return { id: uuid(), name, equipment, sets };
}

$("#addExercise")?.addEventListener("click", () => {
  const ex = gatherExerciseFromUI();
  if (!ex) return;
  current.exercises.push(ex);
  renderExerciseList();
  resetExerciseForm();
});
$("#updateExercise")?.addEventListener("click", () => {
  const ex = gatherExerciseFromUI();
  if (!ex) return;
  if (editIndex === null) return;
  ex.id = current.exercises[editIndex].id;
  current.exercises[editIndex] = ex;
  editIndex = null;
  renderExerciseList();
  resetExerciseForm();
});
$("#cancelEdit")?.addEventListener("click", () => {
  editIndex = null;
  resetExerciseForm();
});

function resetExerciseForm() {
  if (!exName) return;
  exName.value = "";
  $("#exEquip").value = "";
  $("#setCount").value = "3";
  setInputs.innerHTML = "";
  $("#addExercise").hidden = false;
  $("#updateExercise").hidden = true;
  $("#cancelEdit").hidden = true;
  if (prevInfo) {
    prevInfo.className = "empty";
    prevInfo.innerHTML = "Enter an exercise name to see your last session & heaviest.";
  }
}

function renderExerciseList() {
  const area = $("#exerciseList");
  if (!area) return;
  area.innerHTML = "";
  if (current.exercises.length === 0) {
    area.innerHTML = '<div class="empty">No exercises added yet.</div>';
    return;
  }
  current.exercises.forEach((ex, idx) => {
    const card = document.createElement("div");
    card.className = "exercise-card";
    const setsStr = ex.sets.map((s) => `${s.weight}×${s.reps}`).join(" • ");
    card.innerHTML = `
      <div class="flex">
        <div><strong>${ex.name}</strong> <span class="muted">${ex.equipment || ""}</span></div>
        <div class="pill">${ex.sets.length} sets</div>
        <div class="right tools">
          <button data-act="edit">Edit</button>
          <button data-act="del" class="danger">Delete</button>
        </div>
      </div>
      <div class="muted" style="margin-top:6px">${setsStr}</div>
    `;
    card.querySelector('[data-act="edit"]').addEventListener("click", () => {
      editIndex = idx;
      exName.value = ex.name;
      $("#exEquip").value = ex.equipment || "";
      setInputs.innerHTML = "";
      ex.sets.forEach((s) => {
        addSetRow({ weight: String(s.weight), reps: String(s.reps), hint: "" });
      });
      showPrevForExercise(ex.name);
      $("#addExercise").hidden = true;
      $("#updateExercise").hidden = false;
      $("#cancelEdit").hidden = false;
      window.scrollTo({ top: document.querySelector('[data-route="#/exercises"]').offsetTop - 60, behavior: "smooth" });
    });
    card.querySelector('[data-act="del"]').addEventListener("click", () => {
      if (confirm("Delete this exercise?")) {
        current.exercises.splice(idx, 1);
        renderExerciseList();
      }
    });
    area.appendChild(card);
  });
}

// Navigation validation into next pages
$("#toStep3")?.addEventListener("click", (e) => {
  // Equipment is optional; no gating here
});
$("#toStep4")?.addEventListener("click", (e) => {
  if (current.exercises.length === 0) return void (alert("Add at least one exercise."), e.preventDefault());
});

// ===========================
// Step 4: Review & Complete
// ===========================
function renderReview() {
  const tbody = $("#reviewTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  current.exercises.forEach((ex, idx) => {
    const tr = document.createElement("tr");
    const setsHtml = ex.sets.map((s) => `#${s.set}: ${s.weight} kg × ${s.reps}`).join("<br/>");
    tr.innerHTML = `
      <td><strong>${ex.name}</strong></td>
      <td>${ex.equipment || "—"}</td>
      <td>${setsHtml}</td>
      <td><button class="ghost-btn" data-idx="${idx}">Edit</button></td>
    `;
    tr.querySelector("button").addEventListener("click", (e) => {
      const i = +e.target.dataset.idx;
      go("#/exercises");
      // preload and scroll after route draws
      setTimeout(() => {
        editIndex = i;
        const ex = current.exercises[i];
        $("#exName").value = ex.name;
        $("#exEquip").value = ex.equipment || "";
        $("#setInputs").innerHTML = "";
        ex.sets.forEach((s) => addSetRow({ weight: String(s.weight), reps: String(s.reps) }));
        showPrevForExercise(ex.name);
        $("#addExercise").hidden = true;
        $("#updateExercise").hidden = false;
        $("#cancelEdit").hidden = false;
      }, 0);
    });
    tbody.appendChild(tr);
  });
}

$("#completeWorkout")?.addEventListener("click", () => {
  if (current.mode === "now" || !current.dateTimeISO) current.dateTimeISO = new Date().toISOString();
  history.push(structuredClone(current));
  saveAll(history);
  toast("Workout saved to history ✔️");

  // Reset current but keep location preference
  current = {
    id: uuid(),
    location: current.location,
    mode: "now",
    dateTimeISO: null,
    trainingType: null,
    specificMuscle: null,
    equipment: [],
    exercises: [],
  };

  // Reset UI bits
  resetExerciseForm();
  renderExerciseList();
  renderEquipSelected();
  $("#sumMode").textContent = "—";
  $("#sumDT").textContent = "—";
  $("#sumTrain").textContent = "—";
  $$("#modeChips .chip").forEach((c) => c.classList.remove("selected"));
  $("#recordFields").style.display = "none";
  $("#tt").value = "";
  $("#muscle").value = "";
  $("#muscleWrap").style.display = "none";
  equipCheckboxes.forEach((cb) => (cb.checked = false));

  go("#/history");
});

// ===========================
// History helpers
// ===========================
function allExerciseNames() {
  const set = new Set();
  history.forEach((w) => w.exercises.forEach((ex) => set.add(ex.name)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
function getExerciseHistorySummary(name) {
  let last = null,
    heaviest = null;
  const sorted = [...history].sort((a, b) => new Date(b.dateTimeISO) - new Date(a.dateTimeISO));
  for (const w of sorted) {
    const ex = w.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (ex) {
      if (!last) last = { date: w.dateTimeISO, sets: ex.sets.map((s) => ({ weight: s.weight, reps: s.reps })) };
      for (const s of ex.sets) heaviest = Math.max(heaviest ?? 0, s.weight);
    }
  }
  return { last, heaviest };
}
function perWorkoutTopWeight(name) {
  const rows = [];
  history.forEach((w) => {
    let maxW = -Infinity,
      repsAtMax = 0;
    let found = false;
    w.exercises.forEach((ex) => {
      if (ex.name.toLowerCase() === name.toLowerCase()) {
        found = true;
        ex.sets.forEach((s) => {
          if (s.weight > maxW) {
            maxW = s.weight;
            repsAtMax = s.reps;
          }
        });
      }
    });
    if (found) rows.push({ dateISO: w.dateTimeISO, weight: maxW, reps: repsAtMax, workoutId: w.id });
  });
  rows.sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));
  return rows;
}

// ===========================
// History UI + Chart
// ===========================
const picker = $("#exercisePicker");
function refreshExercisePicker() {
  if (!picker) return;
  const names = allExerciseNames();
  picker.innerHTML = "";
  if (names.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No exercises yet";
    picker.appendChild(opt);
  } else {
    names.forEach((n) => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      picker.appendChild(opt);
    });
  }
}
picker?.addEventListener("change", () => drawChart(picker.value));

function refreshHistoryUI() {
  refreshExercisePicker();
  drawChart(picker?.value || picker?.options[0]?.value || "");
  renderWorkoutCards();
  refreshExerciseSuggestions();
}
function renderWorkoutCards() {
  const wrap = $("#workoutCards");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (history.length === 0) {
    wrap.innerHTML = '<div class="empty">No workouts recorded yet.</div>';
    return;
  }
  const sorted = [...history].sort((a, b) => new Date(b.dateTimeISO) - new Date(a.dateTimeISO));
  sorted.forEach((w) => {
    const card = document.createElement("div");
    card.className = "workout-card";
    card.id = "w_" + w.id;
    const head = `
      <div class="flex">
        <div><strong>${fmtDT(w.dateTimeISO)}</strong></div>
        <span class="mini-badge">${capitalize(w.location)}</span>
        <span class="mini-badge">${w.trainingType}${w.specificMuscle ? " (" + w.specificMuscle + ")" : ""}</span>
        <div class="right tools">
          <button data-act="delete" class="danger">Delete</button>
        </div>
      </div>
      <div class="muted" style="margin:6px 0">${w.equipment?.length ? w.equipment.join(" • ") : "No equipment recorded"}</div>
    `;
    const exRows = w.exercises
      .map((ex) => {
        const sets = ex.sets.map((s) => `${s.weight} kg × ${s.reps}`).join(" • ");
        return `<tr><td><strong>${ex.name}</strong><br/><span class="muted">${ex.equipment || ""}</span></td><td>${sets}</td></tr>`;
      })
      .join("");
    card.innerHTML = head + `<table class="table"><tbody>${exRows}</tbody></table>`;
    card.querySelector('[data-act="delete"]').addEventListener("click", () => {
      if (confirm("Delete this workout from history?")) {
        history = history.filter((x) => x.id !== w.id);
        saveAll(history);
        refreshHistoryUI();
      }
    });
    wrap.appendChild(card);
  });
}

// ===========================
// Lightweight SVG Line Chart
// ===========================
function drawChart(exName) {
  const svg = $("#chart");
  const tip = $("#chartTip");
  if (!svg) return;
  svg.innerHTML = "";
  if (!exName) {
    svg.innerHTML = `<text x="20" y="30" fill="#7a8699">Pick an exercise to see progress…</text>`;
    return;
  }
  const data = perWorkoutTopWeight(exName);
  if (data.length === 0) {
    svg.innerHTML = `<text x="20" y="30" fill="#7a8699">No data yet for ${exName}.</text>`;
    return;
  }

  const W = 720,
    H = 260,
    padL = 46,
    padR = 16,
    padT = 16,
    padB = 32;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;

  const xs = (i) => padL + (data.length === 1 ? innerW / 2 : i * (innerW / (data.length - 1)));
  const maxY = Math.max(...data.map((d) => d.weight)) || 1;
  const yNice = niceMax(maxY);
  const ys = (v) => padT + innerH * (1 - v / yNice);

  // Gridlines
  const gy = 5;
  for (let i = 0; i <= gy; i++) {
    const yv = (yNice / gy) * i;
    const y = ys(yv);
    svg.appendChild(lineEl(padL, y, W - padR, y, "#1b2030", i === gy ? 2 : 1));
    svg.appendChild(textEl(6, y + 4, `${Math.round(yv)}`, "#637089", 11));
  }

  // X labels
  data.forEach((d, i) => {
    const x = xs(i),
      y = H - padB + 14;
    const date = new Date(d.dateISO);
    const label = date.toLocaleDateString([], { month: "short", day: "2-digit" });
    svg.appendChild(textEl(x - 18, y + 6, label, "#637089", 11));
  });

  // Path
  const dPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(d.weight)}`).join(" ");
  svg.appendChild(pathEl(dPath, "none", "#6dd3fb", 2.5));

  // Points
  data.forEach((d, i) => {
    const x = xs(i),
      y = ys(d.weight);
    const dot = circleEl(x, y, 4.5, "#6dd3fb");
    dot.style.cursor = "pointer";
    dot.addEventListener("mouseenter", (ev) => {
      showTip(tip, ev.clientX, ev.clientY, `${fmtDT(d.dateISO)}<br><strong>${d.weight} kg</strong> × ${d.reps} reps`);
    });
    dot.addEventListener("mouseleave", () => hideTip(tip));
    dot.addEventListener("click", () => {
      $$(".workout-card").forEach((c) => c.classList.remove("active"));
      const el = document.getElementById("w_" + d.workoutId);
      if (el) {
        el.classList.add("active");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    svg.appendChild(dot);
  });

  // Axes
  svg.appendChild(lineEl(padL, padT, padL, H - padB, "#2a3245", 1.5));
  svg.appendChild(lineEl(padL, H - padB, W - padR, H - padB, "#2a3245", 1.5));
  svg.appendChild(textEl(padL, 14, exName, "#cfe6ff", 12, "bold"));

  function lineEl(x1, y1, x2, y2, stroke, w = 1) {
    const el = svgEl("line");
    el.setAttribute("x1", x1);
    el.setAttribute("y1", y1);
    el.setAttribute("x2", x2);
    el.setAttribute("y2", y2);
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-width", w);
    return el;
  }
  function pathEl(d, fill, stroke, w) {
    const el = svgEl("path");
    el.setAttribute("d", d);
    el.setAttribute("fill", fill);
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-width", w);
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
    return el;
  }
  function circleEl(cx, cy, r, fill) {
    const el = svgEl("circle");
    el.setAttribute("cx", cx);
    el.setAttribute("cy", cy);
    el.setAttribute("r", r);
    el.setAttribute("fill", fill);
    el.setAttribute("stroke", "#0b0c10");
    el.setAttribute("stroke-width", "1.5");
    return el;
  }
  function textEl(x, y, txt, fill, fs = 12, weight = "normal") {
    const el = svgEl("text");
    el.setAttribute("x", x);
    el.setAttribute("y", y);
    el.setAttribute("fill", fill);
    el.setAttribute("font-size", fs);
    el.setAttribute("font-weight", weight);
    el.textContent = txt;
    return el;
  }
  function svgEl(tag) {
    return document.createElementNS("http://www.w3.org/2000/svg", tag);
  }
  function niceMax(max) {
    if (max <= 0) return 10;
    const exp = Math.floor(Math.log10(max));
    const base = Math.pow(10, exp);
    const m = max / base;
    const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
    return nice * base;
  }
  function showTip(el, clientX, clientY, html) {
    if (!el) return;
    el.innerHTML = html;
    el.style.display = "block";
    const rect = svg.getBoundingClientRect();
    el.style.left = clientX - rect.left + "px";
    el.style.top = clientY - rect.top + "px";
  }
  function hideTip(el) {
    if (!el) return;
    el.style.display = "none";
  }
}

// ===========================
// Suggestions (datalist)
// ===========================
function refreshExerciseSuggestions() {
  const list = $("#exList");
  if (!list) return;
  list.innerHTML = "";
  const common = [
    "Bench Press",
    "Incline Dumbbell Press",
    "Overhead Press",
    "Lat Pulldown",
    "Pull-Up",
    "Barbell Row",
    "Seated Cable Row",
    "Deadlift",
    "Squat",
    "Front Squat",
    "Leg Press",
    "Romanian Deadlift",
    "Lunge",
    "Calf Raise",
    "Biceps Curl",
    "Hammer Curl",
    "Triceps Pushdown",
    "Skullcrusher",
    "Lateral Raise",
    "Face Pull",
    "Hip Thrust",
    "Leg Extension",
    "Leg Curl",
    "Plank",
    "Crunch",
  ];
  const fromHist = allExerciseNames();
  const names = Array.from(new Set([...fromHist, ...common])).sort((a, b) => a.localeCompare(b));
  names.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n;
    list.appendChild(opt);
  });
}

// ===========================
// Init
// ===========================
(function init() {
  // Default location tab: Gym
  const firstTab = $('#locationTabs .tab[data-location="gym"]');
  firstTab?.classList.add("active");
  current.location = "gym";
  $("#currentLocationPill").textContent = `Location: Gym`;
  $("#sumLoc").textContent = "Gym";

  // Default mode: now
  $("#modeChips .chip[data-mode='now']")?.classList.add("selected");
  current.mode = "now";
  current.dateTimeISO = new Date().toISOString();
  $("#sumMode").textContent = "Training Now";
  $("#sumDT").textContent = fmtDT(current.dateTimeISO);

  // Initial route
  if (!routes.includes(window.location.hash)) go("#/session");
  renderRoute();
})();
