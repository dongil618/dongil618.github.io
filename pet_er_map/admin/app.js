/* 펫응급맵 운영정보 편집기
 * - ../hospitals.json(공개 데이터)을 읽어 병원을 고르고 verified 블록을 편집한다.
 * - 편집본은 브라우저 localStorage 에 저장되고, YAML(단건) 또는 bundle.json(전체)으로 내보낸다.
 * - bundle.json 은 `uv run scripts/import_overrides.py <bundle>` 로 data/overrides/<id>.yaml 이 된다.
 * 스키마: docs/DATA.md §4, data/overrides/README.md
 */
const DATA_URL = "../hospitals.json";
const META_URL = "../meta.json";
const STORAGE_KEY = "pet-er-map-admin-overrides-v1";
const PAGE_SIZE = 80;

const DAYS = [[1, "월"], [2, "화"], [3, "수"], [4, "목"], [5, "금"], [6, "토"], [7, "일"]];
const SPECIES = [
  ["dog", "개"], ["cat", "고양이"], ["rabbit", "토끼"], ["hamster", "햄스터"], ["guineaPig", "기니피그"],
  ["ferret", "페럿"], ["bird", "조류"], ["reptile", "파충류"], ["otherExotic", "기타 특수동물"],
];
const FACILITIES = [
  ["surgery", "수술"], ["hospitalization", "입원"], ["icu", "중환자실(ICU)"], ["oxygen", "산소방"],
  ["xray", "X-ray"], ["ultrasound", "초음파"], ["ct", "CT"], ["mri", "MRI"], ["endoscopy", "내시경"],
  ["bloodTest", "혈액검사"], ["transfusion", "수혈"], ["dialysis", "투석"],
];
const HOUR_FIELDS = ["open", "close", "nightOpen", "nightClose", "emergencyOpen", "emergencyClose", "breakStart", "breakEnd"];
const CLOSE_FIELDS = new Set(["close", "nightClose", "emergencyClose", "breakEnd"]);
const CANDIDATE_RE = /24|야간|응급|24h|emergency|night/i;

const state = {
  hospitals: [], byId: new Map(), visible: [], rendered: PAGE_SIZE, entries: new Map(), selected: null, dirty: false,
};
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// ───────────── utils ─────────────
const pad = (n) => String(n).padStart(2, "0");
function nowKstLocal() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}
function localToIsoKst(local) {
  if (!local) return null;
  return `${local.length === 16 ? local + ":00" : local}+09:00`;
}
function isoToLocalKst(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (m && /\+09:?00$/.test(iso)) return `${m[1]}T${m[2]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}
function minutesToParts(min) {
  if (min === null || min === undefined || min === "") return { time: "", next: false };
  let m = Number(min);
  let next = false;
  if (m >= 1440) { m -= 1440; next = true; }
  return { time: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`, next };
}
function partsToMinutes(time, next) {
  if (!time) return null;
  const [h, mi] = time.split(":").map(Number);
  return h * 60 + mi + (next ? 1440 : 0);
}
function escapeText(v) {
  return String(v ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}
function setStatus(message, tone = "ok") {
  const node = $("#saveStatus");
  node.textContent = message;
  node.classList.toggle("error", tone === "error");
}
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.entries.values()]));
}
function downloadText(name, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ───────────── form scaffolding ─────────────
function buildWeeklyRows() {
  const body = $("#weeklyRows");
  const timeCell = (field) => `
    <td><div class="time-cell">
      <input data-field="${field}" type="time" step="300">
      ${CLOSE_FIELDS.has(field) ? `<label title="익일"><input data-next="${field}" type="checkbox">익일</label>` : ""}
    </div></td>`;
  body.innerHTML = DAYS.map(([day, label]) => `
    <tr data-day="${day}">
      <td>${label}</td>
      <td><input data-field="isClosed" type="checkbox" aria-label="${label}요일 휴무"></td>
      ${HOUR_FIELDS.map(timeCell).join("")}
    </tr>`).join("");
  for (const row of $$("tr[data-day]", body)) {
    $("[data-field='isClosed']", row).addEventListener("change", () => syncDayRow(row));
  }
}
function syncDayRow(row) {
  const closed = $("[data-field='isClosed']", row).checked;
  row.classList.toggle("closed", closed);
}
function buildCheckGrids() {
  $("#speciesBox").innerHTML = `<span class="grid-title">진료 동물</span>` + SPECIES.map(([k, l]) =>
    `<label class="check"><input type="checkbox" data-species="${k}"> ${l}</label>`).join("");
  $("#facilityBox").innerHTML = `<span class="grid-title">시설 · 장비</span>` + FACILITIES.map(([k, l]) =>
    `<label class="check"><input type="checkbox" data-facility="${k}"> ${l}</label>`).join("");
}
function addRow(templateId, containerId, data = {}) {
  const fragment = document.importNode($(templateId).content, true);
  const row = fragment.firstElementChild;
  for (const [key, value] of Object.entries(data)) {
    const input = $(`[data-field='${key}']`, row);
    if (!input) continue;
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = value ?? "";
  }
  $(".remove-row", row).addEventListener("click", () => { row.remove(); markDirty(); });
  $(containerId).append(row);
  return row;
}
function markDirty() { state.dirty = true; refreshPreview(); }

// ───────────── data ─────────────
async function loadData() {
  try {
    const [res, metaRes] = await Promise.all([fetch(DATA_URL), fetch(META_URL)]);
    if (!res.ok) throw new Error(`hospitals.json HTTP ${res.status}`);
    state.hospitals = await res.json();
    state.byId = new Map(state.hospitals.map((h) => [h.id, h]));
    const meta = metaRes.ok ? await metaRes.json() : null;
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.entries = new Map(saved.map((e) => [e.id, e]));
    const sidos = [...new Set(state.hospitals.map((h) => h.sido).filter(Boolean))].sort();
    $("#sidoFilter").innerHTML = `<option value="">전체 지역</option>` + sidos.map((s) => `<option value="${escapeText(s)}">${escapeText(s)}</option>`).join("");
    const verifiedCount = state.hospitals.filter((h) => h.verified).length;
    setStatus(`${state.hospitals.length.toLocaleString()}곳 · 공개 verified ${verifiedCount}곳 · 브라우저 저장 ${state.entries.size}곳${meta?.generatedAt ? ` · 데이터 ${meta.generatedAt.slice(0, 10)}` : ""}`);
    renderSearch();
  } catch (error) {
    setStatus(`불러오기 실패: ${error.message} — docs/ 를 http 서버로 열었는지 확인 (python3 -m http.server -d docs)`, "error");
  }
}

function renderSearch({ append = false } = {}) {
  const q = $("#placeSearch").value.trim().toLowerCase();
  const sido = $("#sidoFilter").value;
  const onlyCandidates = $("#onlyCandidates").checked;
  const onlySaved = $("#onlySaved").checked;
  const matches = state.hospitals.filter((h) => {
    if (sido && h.sido !== sido) return false;
    if (onlySaved && !state.entries.has(h.id)) return false;
    if (onlyCandidates && !q && !CANDIDATE_RE.test(h.name)) return false;
    if (!q) return true;
    return `${h.name} ${h.address} ${h.phone || ""} ${h.id}`.toLowerCase().includes(q);
  });
  if (!append) state.rendered = PAGE_SIZE;
  state.visible = matches;
  const rendered = matches.slice(0, state.rendered);
  $("#searchCount").textContent = `${matches.length.toLocaleString()}곳 · ${rendered.length.toLocaleString()}곳 표시`;
  $("#clearSearch").hidden = !q;
  const more = $("#loadMorePlaces");
  more.hidden = rendered.length >= matches.length;
  more.textContent = `다음 ${Math.min(PAGE_SIZE, matches.length - rendered.length).toLocaleString()}곳 더 보기`;
  $("#searchResults").innerHTML = rendered.map((h) => `
    <button type="button" class="search-result ${state.selected?.id === h.id ? "active" : ""}" data-id="${escapeText(h.id)}" role="option">
      <strong>${escapeText(h.name)}
        ${state.entries.has(h.id) ? '<span class="saved-mark">저장됨</span>' : ""}
        ${h.verified ? '<span class="verified-mark">공개 verified</span>' : ""}
      </strong>
      <small>${escapeText(h.address)} · ${escapeText(h.phone || "전화 없음")}</small>
    </button>`).join("");
  for (const b of $$(".search-result")) b.addEventListener("click", () => selectHospital(b.dataset.id));
}

function selectHospital(id, { force = false } = {}) {
  if (!force && state.dirty && state.selected && state.selected.id !== id) {
    if (!confirm("저장하지 않은 변경이 있습니다. 버리고 이동할까요?")) return;
  }
  const h = state.byId.get(id);
  if (!h) return;
  state.selected = h;
  state.dirty = false;
  $("#placeName").textContent = h.name;
  $("#placeAddress").textContent = `${h.address}${h.phone ? ` · ${h.phone}` : ""}`;
  $("#placeMeta").textContent = `${h.sido || ""} ${h.sigungu || ""} · ${h.status || ""} · 공공데이터 갱신 ${String(h.sourceUpdatedAt || "").slice(0, 10)}`;
  $("#placeId").textContent = h.id;
  const pill = $("#publicState");
  if (h.verified) {
    pill.className = "pill verified";
    pill.textContent = `공개 verified · ${h.verified.sourceType} · ${String(h.verified.verifiedAt).slice(0, 10)} · ${h.verified.confidenceScore}점`;
  } else {
    pill.className = "pill muted";
    pill.textContent = "공개 데이터: 미검증(공공데이터만)";
  }
  fillForm(state.entries.get(id) || entryFromPublic(h));
  renderSearch({ append: true });
  $("#detailForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function entryFromPublic(h) {
  const v = h.verified;
  return {
    id: h.id,
    name: h.name,
    phones: (h.phones || []).map((p) => ({ type: p.type, phone: p.phone })),
    verified: {
      sourceType: v?.sourceType || "phoneCall",
      sourceUrl: v?.sourceUrl || "",
      verifiedAt: v?.verifiedAt || localToIsoKst(nowKstLocal()),
      verifiedBy: v?.verifiedBy || "admin",
      holidayOpen: v?.holidayOpen ?? false,
      is24hGeneral: null,
      is24hEmergency: null,
      hours: v?.hours || [],
      specialHours: v?.specialHours || [],
      species: v?.species || [],
      facilities: v?.facilities || [],
      notes: v?.notes || "",
    },
  };
}

// ───────────── form ↔ entry ─────────────
function fillForm(entry) {
  const v = entry.verified || {};
  $("#sourceType").value = v.sourceType || "phoneCall";
  $("#sourceUrl").value = v.sourceUrl || "";
  $("#verifiedAt").value = isoToLocalKst(v.verifiedAt) || nowKstLocal();
  $("#verifiedBy").value = v.verifiedBy || "admin";
  $("#holidayOpen").checked = Boolean(v.holidayOpen);
  $("#is24hGeneral").value = v.is24hGeneral === true ? "true" : v.is24hGeneral === false ? "false" : "";
  $("#is24hEmergency").value = v.is24hEmergency === true ? "true" : v.is24hEmergency === false ? "false" : "";
  $("#notes").value = v.notes || "";
  $("#hoursPaste").value = "";

  $("#phoneRows").innerHTML = "";
  for (const p of entry.phones || []) addRow("#phoneRowTemplate", "#phoneRows", p);

  const byDay = new Map((v.hours || []).map((h) => [Number(h.day), h]));
  for (const row of $$("#weeklyRows tr[data-day]")) {
    const h = byDay.get(Number(row.dataset.day)) || {};
    $("[data-field='isClosed']", row).checked = Boolean(h.isClosed);
    for (const f of HOUR_FIELDS) {
      const { time, next } = minutesToParts(h[f]);
      $(`[data-field='${f}']`, row).value = time;
      const nx = $(`[data-next='${f}']`, row);
      if (nx) nx.checked = next;
    }
    syncDayRow(row);
  }

  $("#specialRows").innerHTML = "";
  for (const s of v.specialHours || []) {
    const o = minutesToParts(s.open), c = minutesToParts(s.close), eo = minutesToParts(s.emergencyOpen), ec = minutesToParts(s.emergencyClose);
    addRow("#specialRowTemplate", "#specialRows", {
      date: s.date, isClosed: s.isClosed, reason: s.reason || "",
      open: o.time, close: c.time, emergencyOpen: eo.time, emergencyClose: ec.time, emergencyNext: ec.next,
    });
  }
  for (const box of $$("[data-species]")) box.checked = (v.species || []).includes(box.dataset.species);
  for (const box of $$("[data-facility]")) box.checked = (v.facilities || []).includes(box.dataset.facility);
  refreshPreview();
}

function readForm() {
  const h = state.selected;
  const phones = $$("#phoneRows .phone-row").map((row) => ({
    type: $("[data-field='type']", row).value,
    phone: $("[data-field='phone']", row).value.trim(),
  })).filter((p) => p.phone);

  const hours = [];
  for (const row of $$("#weeklyRows tr[data-day]")) {
    const day = Number(row.dataset.day);
    const isClosed = $("[data-field='isClosed']", row).checked;
    const rec = { day };
    for (const f of HOUR_FIELDS) {
      const time = $(`[data-field='${f}']`, row).value;
      const nx = $(`[data-next='${f}']`, row);
      const min = partsToMinutes(time, nx ? nx.checked : false);
      if (min !== null) rec[f] = min;
    }
    if (isClosed) rec.isClosed = true;
    if (isClosed || Object.keys(rec).length > 1) hours.push(rec);
  }

  const specialHours = $$("#specialRows .special-row").map((row) => {
    const g = (f) => $(`[data-field='${f}']`, row);
    const rec = { date: g("date").value };
    if (g("isClosed").checked) rec.isClosed = true;
    if (g("reason").value.trim()) rec.reason = g("reason").value.trim();
    const o = partsToMinutes(g("open").value, false), c = partsToMinutes(g("close").value, false);
    const eo = partsToMinutes(g("emergencyOpen").value, false), ec = partsToMinutes(g("emergencyClose").value, g("emergencyNext").checked);
    if (o !== null) rec.open = o; if (c !== null) rec.close = c;
    if (eo !== null) rec.emergencyOpen = eo; if (ec !== null) rec.emergencyClose = ec;
    return rec;
  }).filter((s) => s.date);

  const tri = (id) => { const v = $(id).value; return v === "" ? null : v === "true"; };
  return {
    id: h.id,
    name: h.name,
    phones,
    verified: {
      sourceType: $("#sourceType").value,
      sourceUrl: $("#sourceUrl").value.trim(),
      verifiedAt: localToIsoKst($("#verifiedAt").value),
      verifiedBy: $("#verifiedBy").value.trim() || "admin",
      holidayOpen: $("#holidayOpen").checked,
      is24hGeneral: tri("#is24hGeneral"),
      is24hEmergency: tri("#is24hEmergency"),
      hours,
      specialHours,
      species: $$("[data-species]:checked").map((b) => b.dataset.species),
      facilities: $$("[data-facility]:checked").map((b) => b.dataset.facility),
      notes: $("#notes").value.trim(),
    },
    updatedAt: new Date().toISOString(),
  };
}

// ───────────── validation + YAML ─────────────
function validate(entry) {
  const errors = [], warnings = [];
  const v = entry.verified;
  if (!v.verifiedAt) errors.push("확인 시각이 비어 있습니다.");
  const pairs = [["open", "close", "일반"], ["nightOpen", "nightClose", "야간"], ["emergencyOpen", "emergencyClose", "응급"], ["breakStart", "breakEnd", "브레이크"]];
  for (const h of v.hours) {
    const label = DAYS.find(([d]) => d === h.day)[1];
    for (const [a, b, name] of pairs) {
      const hasA = h[a] !== undefined, hasB = h[b] !== undefined;
      if (hasA !== hasB) errors.push(`${label}요일 ${name}: 시작/종료 둘 다 필요합니다.`);
      else if (hasA && h[b] <= h[a]) errors.push(`${label}요일 ${name}: 종료(${h[b]})가 시작(${h[a]})보다 커야 합니다. 자정을 넘기면 '익일' 체크.`);
      if (hasA && h[a] > 1440) warnings.push(`${label}요일 ${name}: 시작이 익일입니다(${h[a]}). 의도한 값인지 확인.`);
    }
    if (h.isClosed && (h.open !== undefined || h.nightOpen !== undefined)) warnings.push(`${label}요일: 휴무인데 일반/야간 시간이 있습니다(응급 창구만 두려면 일반/야간은 비우세요).`);
  }
  for (const s of v.specialHours) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) errors.push(`특별운영 날짜 형식 오류: ${s.date}`);
    if ((s.open !== undefined) !== (s.close !== undefined)) errors.push(`${s.date}: 일반 시작/종료 둘 다 필요.`);
    if ((s.emergencyOpen !== undefined) !== (s.emergencyClose !== undefined)) errors.push(`${s.date}: 응급 시작/종료 둘 다 필요.`);
    if (s.open !== undefined && s.close <= s.open) errors.push(`${s.date}: 일반 종료가 시작보다 커야 합니다.`);
    if (s.emergencyOpen !== undefined && s.emergencyClose <= s.emergencyOpen) errors.push(`${s.date}: 응급 종료가 시작보다 커야 합니다.`);
  }
  if (v.hours.length === 0 && v.specialHours.length === 0) warnings.push("시간표가 비어 있습니다. 앱에서는 '미확인'으로 표시됩니다.");
  if (v.hours.length > 0 && v.hours.length < 7) warnings.push(`요일 ${v.hours.length}/7 만 입력됨 — 나머지 요일은 앱에서 '미확인'.`);
  if (v.sourceUrl && !/^https?:\/\//.test(v.sourceUrl)) errors.push("출처 URL 은 http(s):// 로 시작해야 합니다.");
  for (const p of entry.phones) if (!/^[\d\s()+-]{7,}$/.test(p.phone)) warnings.push(`전화 형식 확인: ${p.phone}`);
  return { errors, warnings };
}

const yq = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
function flow(obj) {
  return "{ " + Object.entries(obj).map(([k, val]) =>
    `${k}: ${typeof val === "string" ? yq(val) : val}`).join(", ") + " }";
}
function toYaml(entry) {
  const v = entry.verified;
  const lines = [];
  lines.push(`# ${entry.name} — 편집기 생성 ${new Date().toISOString().slice(0, 16)}Z`);
  lines.push(`id: ${yq(entry.id)}`);
  lines.push(`name: ${yq(entry.name)}`);
  if (entry.phones.length) {
    lines.push("phones:");
    for (const p of entry.phones) lines.push(`  - ${flow({ type: p.type, phone: p.phone })}`);
  }
  lines.push("verified:");
  lines.push(`  sourceType: ${v.sourceType}`);
  if (v.sourceUrl) lines.push(`  sourceUrl: ${yq(v.sourceUrl)}`);
  lines.push(`  verifiedAt: ${yq(v.verifiedAt)}`);
  lines.push(`  verifiedBy: ${yq(v.verifiedBy)}`);
  if (v.is24hGeneral !== null) lines.push(`  is24hGeneral: ${v.is24hGeneral}`);
  if (v.is24hEmergency !== null) lines.push(`  is24hEmergency: ${v.is24hEmergency}`);
  if (v.holidayOpen) lines.push(`  holidayOpen: true`);
  if (v.hours.length) {
    lines.push("  hours:");
    for (const h of v.hours) lines.push(`    - ${flow(h)}`);
  }
  if (v.specialHours.length) {
    lines.push("  specialHours:");
    for (const s of v.specialHours) lines.push(`    - ${flow(s)}`);
  }
  if (v.species.length) lines.push(`  species: [${v.species.join(", ")}]`);
  if (v.facilities.length) lines.push(`  facilities: [${v.facilities.join(", ")}]`);
  if (v.notes) lines.push(`  notes: ${yq(v.notes)}`);
  return lines.join("\n") + "\n";
}

function refreshPreview() {
  if (!state.selected) return;
  const entry = readForm();
  const { errors, warnings } = validate(entry);
  const box = $("#validation");
  if (errors.length || warnings.length) {
    box.hidden = false;
    box.className = `validation${errors.length ? "" : " warn"}`;
    box.textContent = [...errors.map((e) => `✕ ${e}`), ...warnings.map((w) => `△ ${w}`)].join("\n");
  } else {
    box.hidden = true;
  }
  $("#yamlPreview").textContent = toYaml(entry);
  $("#saveButton").disabled = errors.length > 0;
  $("#saveNextButton").disabled = errors.length > 0;
  $("#downloadYaml").disabled = errors.length > 0;
  return { entry, errors };
}

// ───────────── presets & parser ─────────────
function setRow(day, values) {
  const row = $(`#weeklyRows tr[data-day='${day}']`);
  $("[data-field='isClosed']", row).checked = Boolean(values.isClosed);
  for (const f of HOUR_FIELDS) {
    if (!(f in values)) continue;
    const { time, next } = minutesToParts(values[f]);
    $(`[data-field='${f}']`, row).value = time;
    const nx = $(`[data-next='${f}']`, row);
    if (nx) nx.checked = next;
  }
  syncDayRow(row);
}
function clearRow(day) {
  const row = $(`#weeklyRows tr[data-day='${day}']`);
  $("[data-field='isClosed']", row).checked = false;
  for (const f of HOUR_FIELDS) {
    $(`[data-field='${f}']`, row).value = "";
    const nx = $(`[data-next='${f}']`, row);
    if (nx) nx.checked = false;
  }
  syncDayRow(row);
}
function readRow(day) {
  const row = $(`#weeklyRows tr[data-day='${day}']`);
  const rec = { isClosed: $("[data-field='isClosed']", row).checked };
  for (const f of HOUR_FIELDS) {
    const nx = $(`[data-next='${f}']`, row);
    rec[f] = partsToMinutes($(`[data-field='${f}']`, row).value, nx ? nx.checked : false);
  }
  return rec;
}
function applyPreset(name) {
  if (name === "clear") { for (const [d] of DAYS) clearRow(d); }
  if (name === "24h-emergency") { for (const [d] of DAYS) setRow(d, { emergencyOpen: 0, emergencyClose: 1440 }); $("#holidayOpen").checked = true; }
  if (name === "24h-general") { for (const [d] of DAYS) setRow(d, { open: 0, close: 1440, emergencyOpen: 0, emergencyClose: 1440 }); $("#holidayOpen").checked = true; }
  if (name === "weekday-copy") { const src = readRow(1); for (const [d] of DAYS) if (d !== 1) setRow(d, src); }
  if (name === "weekday-copy-5") { const src = readRow(1); for (const d of [2, 3, 4, 5]) setRow(d, src); }
  markDirty();
}

const KO_DAYS = ["월", "화", "수", "목", "금", "토", "일"];
function dayTargets(text) {
  if (/평일/.test(text)) return [1, 2, 3, 4, 5];
  if (/주말/.test(text)) return [6, 7];
  if (/매일|연중무휴|365일|무휴/.test(text)) return [1, 2, 3, 4, 5, 6, 7];
  const range = text.match(/([월화수목금토일])(?:요일)?\s*[-~–]\s*([월화수목금토일])(?:요일)?/);
  if (range) {
    const start = KO_DAYS.indexOf(range[1]), end = KO_DAYS.indexOf(range[2]);
    const out = [];
    for (let i = start; ; i = (i + 1) % 7) { out.push(i + 1); if (i === end) break; }
    return out;
  }
  const singles = [...text.matchAll(/(?:^|[^가-힣])([월화수목금토일])(?:요일|,|\s|$)/g)].map((m) => KO_DAYS.indexOf(m[1]) + 1);
  return [...new Set(singles)];
}
function normalizeKoreanTimes(text) {
  return text
    .replace(/(오전|오후|아침|저녁|밤|새벽)\s*(\d{1,2})(?::(\d{2}))?\s*시?/g, (_, mer, h, m) => {
      let hour = Number(h) % 12;
      if (/오후|저녁|밤/.test(mer)) hour += 12;
      return `${pad(hour)}:${m || "00"}`;
    })
    .replace(/(\d{1,2})시\s*(\d{2})분?/g, (_, h, m) => `${pad(h)}:${m}`)
    .replace(/(\d{1,2})시/g, (_, h) => `${pad(h)}:00`)
    .replace(/24:00/g, "23:59+");
}
function timeRanges(text) {
  const norm = normalizeKoreanTimes(text);
  const out = [];
  const re = /([01]?\d|2[0-3]):([0-5]\d)(\+?)\s*[-~–]\s*(익일|다음날|익일\s)?\s*([01]?\d|2[0-3]):([0-5]\d)(\+?)/g;
  let m;
  while ((m = re.exec(norm))) {
    let start = Number(m[1]) * 60 + Number(m[2]);
    let end = Number(m[5]) * 60 + Number(m[6]);
    if (m[7] === "+") end = 1440; // 24:00
    if (m[4] || end <= start) end += 1440;
    out.push([start, end]);
  }
  return out;
}
function parseHoursText(text, forceEmergency) {
  const lines = text.split(/\n|;|\//).map((l) => l.trim()).filter(Boolean);
  let applied = 0;
  for (const line of lines) {
    // 요일 표기가 없으면(예: "야간 19:00~익일 09:00") 전 요일에 적용
    const days = dayTargets(line).length ? dayTargets(line) : [1, 2, 3, 4, 5, 6, 7];
    if (/휴무|휴진|정기휴일|쉽니다/.test(line) && !/(\d)/.test(normalizeKoreanTimes(line))) {
      for (const d of days) setRow(d, { isClosed: true });
      applied++;
      continue;
    }
    const ranges = /24시간|24시\b|종일/.test(line) && !timeRanges(line).length ? [[0, 1440]] : timeRanges(line);
    if (!ranges.length) continue;
    const [start, end] = ranges[0];
    const bucket = forceEmergency || /응급/.test(line) ? "emergency" : /야간/.test(line) ? "night" : "general";
    for (const d of days) {
      const values = { isClosed: false };
      if (bucket === "general") { values.open = start; values.close = end; }
      if (bucket === "night") { values.nightOpen = start; values.nightClose = end; }
      if (bucket === "emergency") { values.emergencyOpen = start; values.emergencyClose = end; }
      const brk = ranges[1];
      if (bucket === "general" && brk && /점심|휴게|브레이크|break/i.test(line)) { values.breakStart = brk[0]; values.breakEnd = brk[1]; }
      setRow(d, values);
    }
    applied++;
  }
  return applied;
}

// ───────────── save / export ─────────────
function saveSelected() {
  if (!state.selected) return false;
  const result = refreshPreview();
  if (!result || result.errors.length) { setStatus("검증 오류가 있어 저장하지 않았습니다.", "error"); return false; }
  state.entries.set(state.selected.id, result.entry);
  persist();
  state.dirty = false;
  setStatus(`저장됨: ${state.selected.name} · 브라우저 저장 ${state.entries.size}곳`);
  renderSearch({ append: true });
  return true;
}
function selectNextVisible() {
  const idx = state.visible.findIndex((h) => h.id === state.selected?.id);
  const next = state.visible[idx + 1];
  if (next) selectHospital(next.id, { force: true });
}
function exportBundle() {
  const entries = [...state.entries.values()].sort((a, b) => a.id.localeCompare(b.id));
  const bundle = { schemaVersion: 1, exportedAt: new Date().toISOString(), tool: "pet_er_map/docs/admin", entries };
  downloadText(`pet_er_overrides.bundle.${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2) + "\n", "application/json");
  setStatus(`${entries.length}곳 내보냄 → uv run scripts/import_overrides.py <파일>`);
}
async function importBundle(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const list = Array.isArray(parsed) ? parsed : parsed.entries;
    if (!Array.isArray(list)) throw new Error("entries 배열이 없습니다");
    let merged = 0;
    for (const e of list) { if (e && e.id) { state.entries.set(e.id, e); merged++; } }
    persist();
    setStatus(`${merged}곳 가져옴 · 브라우저 저장 ${state.entries.size}곳`);
    renderSearch();
    if (state.selected) selectHospital(state.selected.id, { force: true });
  } catch (error) {
    setStatus(`가져오기 실패: ${error.message}`, "error");
  }
}

// ───────────── wiring ─────────────
function init() {
  buildWeeklyRows();
  buildCheckGrids();
  $("#placeSearch").addEventListener("input", () => renderSearch());
  $("#sidoFilter").addEventListener("change", () => renderSearch());
  $("#onlyCandidates").addEventListener("change", () => renderSearch());
  $("#onlySaved").addEventListener("change", () => renderSearch());
  $("#clearSearch").addEventListener("click", () => { $("#placeSearch").value = ""; renderSearch(); });
  $("#loadMorePlaces").addEventListener("click", () => { state.rendered += PAGE_SIZE; renderSearch({ append: true }); });
  $("#addPhone").addEventListener("click", () => { addRow("#phoneRowTemplate", "#phoneRows", { type: "main" }); markDirty(); });
  $("#addSpecial").addEventListener("click", () => { addRow("#specialRowTemplate", "#specialRows", {}); markDirty(); });
  for (const chip of $$("[data-preset]")) chip.addEventListener("click", () => applyPreset(chip.dataset.preset));
  $("#parseHours").addEventListener("click", () => {
    const n = parseHoursText($("#hoursPaste").value, $("#pasteAsEmergency").checked);
    setStatus(n ? `${n}개 규칙을 표에 반영했습니다. 표를 확인하세요.` : "인식된 규칙이 없습니다.", n ? "ok" : "error");
    markDirty();
  });
  $("#detailForm").addEventListener("input", markDirty);
  $("#detailForm").addEventListener("change", markDirty);
  $("#detailForm").addEventListener("submit", (e) => { e.preventDefault(); saveSelected(); });
  $("#saveButton").addEventListener("click", saveSelected);
  $("#saveNextButton").addEventListener("click", () => { if (saveSelected()) selectNextVisible(); });
  $("#deleteButton").addEventListener("click", () => {
    if (!state.selected || !state.entries.has(state.selected.id)) return;
    if (!confirm("브라우저에 저장된 이 병원의 편집본을 삭제할까요? (이미 커밋된 YAML 은 영향 없음)")) return;
    state.entries.delete(state.selected.id);
    persist();
    selectHospital(state.selected.id, { force: true });
    setStatus("삭제됨");
  });
  $("#copyYaml").addEventListener("click", async () => {
    if (!state.selected) return;
    await navigator.clipboard.writeText($("#yamlPreview").textContent);
    setStatus(`YAML 복사됨 → data/overrides/${state.selected.id}.yaml`);
  });
  $("#downloadYaml").addEventListener("click", () => {
    if (!state.selected) return;
    const r = refreshPreview();
    if (r.errors.length) return;
    downloadText(`${state.selected.id}.yaml`, toYaml(r.entry), "text/yaml");
  });
  $("#exportButton").addEventListener("click", exportBundle);
  $("#importFile").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) importBundle(f); e.target.value = ""; });
  window.addEventListener("beforeunload", (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveSelected(); }
  });
  loadData();
}
init();
