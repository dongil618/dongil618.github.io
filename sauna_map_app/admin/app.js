const DATA_URL = "../saunas.json";
const DETAILS_URL = "../sauna_details.json";
const STORAGE_KEY = "sauna-map-admin-observations-v1";
const weekdays = [
  ["monday", "월"], ["tuesday", "화"], ["wednesday", "수"],
  ["thursday", "목"], ["friday", "금"], ["saturday", "토"], ["sunday", "일"],
];

const state = { places: [], visiblePlaces: [], details: new Map(), entries: new Map(), selected: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function today() { return new Date().toISOString().slice(0, 10); }
function setStatus(message, tone = "ok") {
  const node = $("#saveStatus");
  node.textContent = message;
  node.style.background = tone === "error" ? "#fff0ee" : "#e7f3ed";
  node.style.color = tone === "error" ? "#8e332b" : "#0f523a";
}
function escapeText(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

function buildWeeklyRows() {
  const body = $("#weeklyRows");
  body.innerHTML = weekdays.map(([key, label]) => `
    <tr data-day="${key}">
      <td>${label}</td>
      <td><select data-field="status"><option value="unknown">미확인</option><option value="open">영업</option><option value="closed">휴무</option></select></td>
      <td class="all-day-cell"><input data-field="allDay" type="checkbox" aria-label="${label}요일 24시간"></td>
      <td><input data-field="open" type="time"></td><td><input data-field="close" type="time"></td>
      <td><input data-field="breakOpen" type="time"></td><td><input data-field="breakClose" type="time"></td>
    </tr>`).join("");
  for (const row of $$("tr[data-day]", body)) {
    $("[data-field='status']", row).addEventListener("change", () => syncDayRow(row));
    $("[data-field='allDay']", row).addEventListener("change", () => syncDayRow(row));
    syncDayRow(row);
  }
  $("#closureWeekday").innerHTML = weekdays.map(([key, label]) => `<option value="${key}">${label}요일</option>`).join("");
}

function syncDayRow(row) {
  const open = $("[data-field='status']", row).value === "open";
  const allDay = $("[data-field='allDay']", row);
  allDay.disabled = !open;
  for (const field of ["open", "close", "breakOpen", "breakClose"]) {
    $( `[data-field='${field}']`, row).disabled = !open || allDay.checked;
  }
}

const koreanDays = ["월", "화", "수", "목", "금", "토", "일"];
function dayTargets(text) {
  if (/평일/.test(text)) return weekdays.slice(0, 5).map(([key]) => key);
  if (/주말/.test(text)) return weekdays.slice(5).map(([key]) => key);
  if (/매일|매일같이|연중무휴/.test(text)) return weekdays.map(([key]) => key);
  const range = text.match(/([월화수목금토일])(?:요일)?\s*[-~–]\s*([월화수목금토일])(?:요일)?/);
  if (range) {
    const start = koreanDays.indexOf(range[1]);
    const end = koreanDays.indexOf(range[2]);
    const result = [];
    for (let index = start; ; index = (index + 1) % 7) {
      result.push(weekdays[index][0]);
      if (index === end) return result;
    }
  }
  return [...new Set([...text.matchAll(/([월화수목금토일])(?:요일)?/g)].map((match) => weekdays[koreanDays.indexOf(match[1])][0]))];
}

function normalizeKoreanTimes(text) {
  return text.replace(/(오전|오후)\s*(\d{1,2}):(\d{2})/g, (_, meridiem, rawHour, minute) => {
    let hour = Number(rawHour) % 12;
    if (meridiem === "오후") hour += 12;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  });
}

function timePair(text) {
  const values = [...normalizeKoreanTimes(text).matchAll(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g)]
    .map((match) => `${match[1].padStart(2, "0")}:${match[2]}`);
  return values.length >= 2 ? values.slice(0, 2) : null;
}

function setDay(day, values) {
  const row = $(`tr[data-day='${day}']`);
  if (!row) return;
  $("[data-field='status']", row).value = values.status;
  $("[data-field='allDay']", row).checked = Boolean(values.allDay);
  for (const field of ["open", "close", "breakOpen", "breakClose"]) {
    if (Object.hasOwn(values, field)) $(`[data-field='${field}']`, row).value = values[field] || "";
  }
  if (values.status !== "open" || values.allDay) {
    $("[data-field='open']", row).value = "";
    $("[data-field='close']", row).value = "";
    if (values.status !== "open") {
      $("[data-field='breakOpen']", row).value = "";
      $("[data-field='breakClose']", row).value = "";
    }
  }
  syncDayRow(row);
}

function setParseResult(selector, message, error = false) {
  const node = $(selector);
  node.textContent = message;
  node.classList.toggle("error", error);
  node.hidden = false;
}

function parseRegularClosure(line) {
  if (!/(?:매월|매달)/.test(line) || !/휴무/.test(line)) return false;
  const match = line.match(/(첫째|둘째|셋째|넷째|다섯째|마지막|[1-5](?:번째|째))\s*([월화수목금토일])(?:요일)?/);
  if (!match) return false;
  const ordinalMap = { 첫째: 1, 둘째: 2, 셋째: 3, 넷째: 4, 다섯째: 5 };
  $("#closureKind").value = match[1] === "마지막" ? "lastWeekday" : "nthWeekday";
  $("#closureWeekday").value = weekdays[koreanDays.indexOf(match[2])][0];
  $("#closureOrdinal").value = match[1] === "마지막" ? "" : ordinalMap[match[1]] || Number(match[1][0]);
  $("#closureLabel").value = line.trim();
  return true;
}

function parseHoursText() {
  const text = $("#hoursPaste").value.trim();
  if (!text) return setParseResult("#hoursPasteResult", "붙여넣을 영업시간이 없습니다.", true);
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let currentDays = [];
  let appliedDays = new Set();
  let breaks = 0;
  let closures = 0;
  for (const line of lines) {
    if (parseRegularClosure(line)) { closures += 1; continue; }
    const parsedDays = dayTargets(line);
    if (parsedDays.length) currentDays = parsedDays;
    const targets = parsedDays.length ? parsedDays : currentDays;
    if (!targets.length) continue;
    if (/휴게|브레이크/.test(line)) {
      const pair = timePair(line);
      if (pair) {
        for (const day of targets) setDay(day, { status: "open", breakOpen: pair[0], breakClose: pair[1] });
        breaks += targets.length;
      }
      continue;
    }
    if (/휴무/.test(line)) {
      for (const day of targets) { setDay(day, { status: "closed" }); appliedDays.add(day); }
      continue;
    }
    if (/24\s*시간|연중무휴/.test(line)) {
      for (const day of targets) { setDay(day, { status: "open", allDay: true }); appliedDays.add(day); }
      continue;
    }
    const pair = timePair(line);
    if (pair) {
      for (const day of targets) {
        setDay(day, { status: "open", allDay: false, open: pair[0], close: pair[1], breakOpen: "", breakClose: "" });
        appliedDays.add(day);
      }
    }
  }
  if (!appliedDays.size && !closures) return setParseResult("#hoursPasteResult", "요일과 시간을 인식하지 못했습니다. ‘월-금 06:00-23:00’처럼 붙여넣어 주세요.", true);
  setParseResult("#hoursPasteResult", `${appliedDays.size}개 요일 반영${breaks ? ` · 휴게시간 ${breaks}개` : ""}${closures ? ` · 정기휴무 ${closures}개` : ""}`);
}

function copyMondayTo(targetDays) {
  const monday = $("tr[data-day='monday']");
  const values = {
    status: $("[data-field='status']", monday).value,
    allDay: $("[data-field='allDay']", monday).checked,
    open: $("[data-field='open']", monday).value,
    close: $("[data-field='close']", monday).value,
    breakOpen: $("[data-field='breakOpen']", monday).value,
    breakClose: $("[data-field='breakClose']", monday).value,
  };
  if (values.status === "unknown") return setParseResult("#hoursPasteResult", "먼저 월요일 영업시간을 입력하세요.", true);
  for (const day of targetDays) setDay(day, values);
  setParseResult("#hoursPasteResult", `월요일 설정을 ${targetDays.length}개 요일에 적용했습니다.`);
}

function addRepeater(templateId, containerId, data = {}) {
  const fragment = document.importNode($(templateId).content, true);
  const row = fragment.firstElementChild;
  for (const [key, value] of Object.entries(data)) {
    const input = $(`[data-field='${key}']`, row);
    if (input) input.value = Array.isArray(value) ? value.join("; ") : value ?? "";
  }
  $(".remove-row", row).addEventListener("click", () => row.remove());
  $(containerId).append(row);
  return row;
}

async function loadData() {
  try {
    const [placesResponse, detailsResponse] = await Promise.all([fetch(DATA_URL), fetch(DETAILS_URL)]);
    if (!placesResponse.ok) throw new Error(`saunas.json HTTP ${placesResponse.status}`);
    state.places = await placesResponse.json();
    if (detailsResponse.ok) {
      const dataset = await detailsResponse.json();
      state.details = new Map(dataset.places.map((place) => [place.saunaId, place]));
    }
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.entries = new Map(saved.map((entry) => [entry.saunaId, entry]));
    setStatus(`${state.places.length.toLocaleString()}곳 · 저장 ${state.entries.size}곳`);
    renderSearch("");
  } catch (error) {
    setStatus(`불러오기 실패: ${error.message}`, "error");
  }
}

function renderSearch(query) {
  const normalized = query.trim().toLowerCase();
  const matches = state.places.filter((place) => {
    if (!normalized) return true;
    return `${place.name} ${place.address} ${place.phone || ""}`.toLowerCase().includes(normalized);
  }).slice(0, 60);
  state.visiblePlaces = matches;
  $("#searchResults").innerHTML = matches.map((place) => `
    <button type="button" class="search-result ${state.selected?.id === place.id ? "active" : ""}" data-id="${escapeText(place.id)}" role="option">
      <strong>${escapeText(place.name)}${state.entries.has(place.id) ? '<span class="saved-mark">저장됨</span>' : ""}</strong><small>${escapeText(place.address)} · ${escapeText(place.phone || "전화 없음")}</small>
    </button>`).join("");
  for (const button of $$(".search-result")) button.addEventListener("click", () => selectPlace(button.dataset.id));
}

function selectPlace(id) {
  state.selected = state.places.find((place) => place.id === id) || null;
  if (!state.selected) return;
  $("#placeName").textContent = state.selected.name;
  $("#placeAddress").textContent = state.selected.address;
  $("#placeType").textContent = state.selected.type;
  $("#placeId").textContent = state.selected.id;
  renderSearch($("#placeSearch").value);
  fillForm(state.entries.get(id) || detailToEntry(state.details.get(id)) || emptyEntry(id));
  updateReference();
}

function emptyEntry(saunaId) {
  return {
    saunaId,
    source: { kind: "community", name: "관리자 직접 확인", license: "관리자 확인 정보" },
    observedAt: today(), prices: [],
  };
}

function detailToEntry(detail) {
  if (!detail) return null;
  return { ...emptyEntry(detail.saunaId), phone: detail.phone?.display, hours: detail.hours, prices: detail.prices || [], reviewSummary: detail.reviewSummary, media: detail.media || [] };
}

function fillForm(entry) {
  $("#hoursPaste").value = "";
  $("#pricesPaste").value = "";
  $("#hoursPasteResult").hidden = true;
  $("#pricesPasteResult").hidden = true;
  $("#sourceKind").value = entry.source?.kind || "community";
  $("#sourceName").value = entry.source?.name || "관리자 직접 확인";
  $("#sourceUrl").value = entry.source?.url || "";
  $("#sourceLicense").value = entry.source?.license || "관리자 확인 정보";
  $("#observedAt").value = entry.observedAt || today();
  $("#expiresAt").value = entry.expiresAt || "";
  const hours = entry.hours || {};
  $("#holidayPolicy").value = hours.publicHolidayPolicy || "unknown";
  $("#hoursNote").value = (hours.notes || []).join("; ");
  for (const row of $$("tr[data-day]")) {
    const day = hours.weekly?.[row.dataset.day] || { status: "unknown" };
    $("[data-field='status']", row).value = day.status || "unknown";
    $("[data-field='allDay']", row).checked = Boolean(day.allDay);
    const period = day.periods?.[0] || {};
    const pause = period.breaks?.[0] || {};
    for (const [field, value] of [["open", period.open], ["close", period.close], ["breakOpen", pause.open], ["breakClose", pause.close]]) $( `[data-field='${field}']`, row).value = value || "";
    syncDayRow(row);
  }
  const closure = hours.regularClosures?.[0] || {};
  $("#closureKind").value = closure.kind || "";
  $("#closureWeekday").value = closure.weekday || "monday";
  $("#closureOrdinal").value = closure.ordinal || closure.dayOfMonth || "";
  $("#closureLabel").value = closure.label || "";
  $("#exceptions").innerHTML = "";
  for (const exception of hours.exceptions || []) {
    const period = exception.periods?.[0] || {};
    addRepeater("#exceptionTemplate", "#exceptions", { ...exception, open: period.open, close: period.close });
  }
  $("#prices").innerHTML = "";
  for (const price of entry.prices || []) addRepeater("#priceTemplate", "#prices", price);
  $("#validationBox").hidden = true;
}

function serializeForm() {
  if (!state.selected) throw new Error("먼저 업소를 선택하세요.");
  const errors = [];
  const weekly = {};
  let hasHours = false;
  for (const row of $$("tr[data-day]")) {
    const status = $("[data-field='status']", row).value;
    const allDay = $("[data-field='allDay']", row).checked;
    const open = $("[data-field='open']", row).value;
    const close = $("[data-field='close']", row).value;
    if (status === "open" && !allDay && (!open || !close || open === close)) errors.push(`${row.firstElementChild.textContent}요일 영업 시작·종료 시간을 확인하세요.`);
    const day = { status };
    if (status === "open") {
      hasHours = true;
      if (allDay) day.allDay = true;
      else {
        const period = { open, close, breaks: [] };
        const breakOpen = $("[data-field='breakOpen']", row).value;
        const breakClose = $("[data-field='breakClose']", row).value;
        if (Boolean(breakOpen) !== Boolean(breakClose)) errors.push(`${row.firstElementChild.textContent}요일 휴게시간은 시작·종료를 모두 입력하세요.`);
        if (breakOpen && breakClose) period.breaks.push({ open: breakOpen, close: breakClose });
        day.periods = [period];
      }
    }
    weekly[row.dataset.day] = day;
  }

  const regularClosures = [];
  const closureKind = $("#closureKind").value;
  if (closureKind) {
    const numeric = Number($("#closureOrdinal").value);
    const closure = { kind: closureKind, label: $("#closureLabel").value.trim() || undefined };
    if (closureKind === "monthlyDate") {
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 31) errors.push("정기휴무 일자는 1~31이어야 합니다.");
      closure.dayOfMonth = numeric;
    } else {
      closure.weekday = $("#closureWeekday").value;
      if (closureKind === "nthWeekday") {
        if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) errors.push("N번째 요일 순번은 1~5여야 합니다.");
        closure.ordinal = numeric;
      }
    }
    regularClosures.push(closure);
    hasHours = true;
  }

  const exceptions = $$(".exception-row").map((row) => {
    const status = $("[data-field='status']", row).value;
    const item = { date: $("[data-field='date']", row).value, status, label: $("[data-field='label']", row).value.trim() || undefined };
    if (!item.date) errors.push("날짜별 예외의 날짜를 입력하세요.");
    if (status === "open") {
      const open = $("[data-field='open']", row).value, close = $("[data-field='close']", row).value;
      if (!open || !close || open === close) errors.push(`${item.date || "예외일"} 특별 영업시간을 확인하세요.`);
      item.periods = [{ open, close, breaks: [] }];
    }
    return item;
  });
  if (exceptions.length) hasHours = true;

  const prices = $$(".price-row").map((row) => {
    const amount = Number($("[data-field='amount']", row).value);
    const label = $("[data-field='label']", row).value.trim();
    if (!label) errors.push("가격 표시명을 입력하세요.");
    if (!Number.isInteger(amount) || amount < 0 || amount > 1000000) errors.push(`${label || "가격"}의 금액은 0~1,000,000원 정수여야 합니다.`);
    const conditions = $("[data-field='conditions']", row).value.split(";").map((value) => value.trim()).filter(Boolean);
    return { label, audience: $("[data-field='audience']", row).value, service: $("[data-field='service']", row).value, amount, currency: "KRW", timeBand: $("[data-field='timeBand']", row).value, conditions };
  });

  const sourceUrl = $("#sourceUrl").value.trim();
  if (sourceUrl) { try { new URL(sourceUrl); } catch { errors.push("참고 URL 형식이 올바르지 않습니다."); } }
  const observedAt = $("#observedAt").value;
  const expiresAt = $("#expiresAt").value;
  if (!observedAt) errors.push("확인일을 입력하세요.");
  if (expiresAt && observedAt > expiresAt) errors.push("재확인 만료일은 확인일보다 빠를 수 없습니다.");
  if (errors.length) throw new Error(errors.join("\n"));

  const entry = {
    saunaId: state.selected.id,
    source: { kind: $("#sourceKind").value, name: $("#sourceName").value.trim(), license: $("#sourceLicense").value.trim(), ...(sourceUrl ? { url: sourceUrl } : {}) },
    observedAt, ...(expiresAt ? { expiresAt } : {}),
    ...(state.selected.phone ? { phone: state.selected.phone } : {}),
    ...(hasHours ? { hours: { timeZone: "Asia/Seoul", weekly, regularClosures, publicHolidayPolicy: $("#holidayPolicy").value, exceptions, notes: $("#hoursNote").value.split(";").map((v) => v.trim()).filter(Boolean) } } : {}),
    prices,
  };
  if (!entry.source.name || !entry.source.license) throw new Error("출처 이름과 사용 근거를 입력하세요.");
  return entry;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.entries.values()]));
  setStatus(`${state.places.length.toLocaleString()}곳 · 저장 ${state.entries.size}곳`);
}
function showError(error) {
  const box = $("#validationBox"); box.textContent = error.message; box.hidden = false; box.scrollIntoView({ behavior: "smooth", block: "center" });
}
function downloadJson(name, value) {
  const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
function normalizeNaverSearchName(name) {
  return String(name || "")
    .replace(/^\s*(?:(?:\((?:유|주)\)|㈜|주식회사|유한회사)\s*)+/u, "")
    .trim();
}

function classifyPriceLabel(label) {
  const compact = label.replace(/\s/g, "");
  const audience = /유아|36개월|3세미만/.test(compact) ? "infant"
    : /경로|노인|65세/.test(compact) ? "senior"
    : /청소년|중고생|학생/.test(compact) ? "youth"
    : /소인|어린이|아동|미취학|7세|6세/.test(compact) ? "child"
    : /대인|성인/.test(compact) ? "adult" : "all";
  const service = /찜질/.test(compact) && !/찜질복/.test(compact) ? "jjimjil"
    : /사우나/.test(compact) ? "sauna"
    : /숙박|심야입장/.test(compact) ? "overnight"
    : /대여|찜질복|수건/.test(compact) ? "rental"
    : /회원권|목욕권|월목욕|개월|\d+매|카드/.test(compact) ? "package"
    : /세신/.test(compact) ? "other" : "bath";
  const timeBand = /야간|심야/.test(compact) ? "nighttime"
    : /주말/.test(compact) ? "weekend"
    : /평일/.test(compact) ? "weekday"
    : /공휴일/.test(compact) ? "holiday"
    : /주간/.test(compact) ? "daytime" : "standard";
  return { audience, service, timeBand };
}

function parsePricesText() {
  const lines = $("#pricesPaste").value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let added = 0;
  const rejected = [];
  for (const line of lines) {
    const matches = [...line.matchAll(/\d[\d,]*/g)];
    if (!matches.length) { rejected.push(line); continue; }
    const amountToken = matches.at(-1)[0];
    const amount = Number(amountToken.replace(/,/g, ""));
    if (!Number.isInteger(amount) || amount < 0 || amount > 1000000) { rejected.push(line); continue; }
    const label = line.slice(0, matches.at(-1).index).replace(/[·:\-]\s*$/, "").trim() || "입장료";
    addRepeater("#priceTemplate", "#prices", { label, amount, conditions: "", ...classifyPriceLabel(label) });
    added += 1;
  }
  if (!added) return setParseResult("#pricesPasteResult", "가격을 인식하지 못했습니다. ‘대인 10,000원’처럼 한 줄씩 입력하세요.", true);
  setParseResult("#pricesPasteResult", `${added}개 가격 반영${rejected.length ? ` · 미인식 ${rejected.length}줄` : ""}`, Boolean(rejected.length));
}

function saveSelected() {
  try {
    const entry = serializeForm();
    state.entries.set(entry.saunaId, entry);
    persist();
    $("#validationBox").hidden = true;
    renderSearch($("#placeSearch").value);
    return true;
  } catch (error) {
    showError(error);
    return false;
  }
}

function selectNextVisible() {
  if (!state.selected || !state.visiblePlaces.length) return;
  const current = state.visiblePlaces.findIndex((place) => place.id === state.selected.id);
  const ordered = [...state.visiblePlaces.slice(current + 1), ...state.visiblePlaces.slice(0, current + 1)];
  const next = ordered.find((place) => !state.entries.has(place.id)) || ordered[0];
  if (next) selectPlace(next.id);
}
function updateReference() {
  const query = normalizeNaverSearchName(state.selected.name);
  const mapUrl = `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
  const blogUrl = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(query)}`;
  $("#naverMapLink").href = mapUrl; $("#naverBlogLink").href = blogUrl; $("#naverFrame").src = mapUrl;
}

$("#placeSearch").addEventListener("input", (event) => renderSearch(event.target.value));
$("#parseHours").addEventListener("click", parseHoursText);
$("#fillWeekdays").addEventListener("click", () => copyMondayTo(weekdays.slice(0, 5).map(([key]) => key)));
$("#fillEveryday").addEventListener("click", () => copyMondayTo(weekdays.map(([key]) => key)));
$("#addException").addEventListener("click", () => addRepeater("#exceptionTemplate", "#exceptions"));
$("#addPrice").addEventListener("click", () => addRepeater("#priceTemplate", "#prices"));
$("#parsePrices").addEventListener("click", parsePricesText);
$("#clearPrices").addEventListener("click", () => { $("#prices").innerHTML = ""; setParseResult("#pricesPasteResult", "기존 가격을 비웠습니다."); });
$("#detailForm").addEventListener("submit", (event) => {
  event.preventDefault();
  saveSelected();
});
$("#saveNextButton").addEventListener("click", () => { if (saveSelected()) selectNextVisible(); });
$("#copyButton").addEventListener("click", async () => { try { await navigator.clipboard.writeText(JSON.stringify(serializeForm(), null, 2)); setStatus("선택 JSON을 복사했습니다"); } catch (error) { showError(error); } });
$("#resetButton").addEventListener("click", () => { if (!state.selected) return; state.entries.delete(state.selected.id); persist(); fillForm(detailToEntry(state.details.get(state.selected.id)) || emptyEntry(state.selected.id)); });
$("#exportButton").addEventListener("click", () => downloadJson("sauna_details.raw.json", [...state.entries.values()].sort((a, b) => a.saunaId.localeCompare(b.saunaId))));
$("#importFile").addEventListener("change", async (event) => {
  try { const value = JSON.parse(await event.target.files[0].text()); if (!Array.isArray(value)) throw new Error("JSON 최상위 값은 배열이어야 합니다."); state.entries = new Map(value.map((entry) => { if (!entry.saunaId) throw new Error("saunaId가 없는 항목이 있습니다."); return [entry.saunaId, entry]; })); persist(); if (state.selected) fillForm(state.entries.get(state.selected.id) || emptyEntry(state.selected.id)); }
  catch (error) { showError(error); }
  event.target.value = "";
});
$("#toggleReference").addEventListener("click", () => {
  const expanded = document.body.classList.toggle("reference-expanded");
  $("#toggleReference").textContent = expanded ? "편집 넓게" : "참고 크게";
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveSelected();
  }
});

buildWeeklyRows();
$("#observedAt").value = today();
loadData();
