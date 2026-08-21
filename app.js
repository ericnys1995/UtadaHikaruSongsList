const DATA_URLS = {
  pool: "./data/utada-hikaru-quiz-pool.base.json?v=responsive-v4-20260821",
  releases: "./data/utada-hikaru-releases.raw.json?v=responsive-v4-20260821",
};

const elements = {
  asOf: document.querySelector("#as-of"),
  groupTotal: document.querySelector("#group-total"),
  recordTotal: document.querySelector("#record-total"),
  reviewTotal: document.querySelector("#review-total"),
  search: document.querySelector("#search-input"),
  clearSearch: document.querySelector("#clear-search"),
  artist: document.querySelector("#artist-select"),
  viewButtons: [...document.querySelectorAll("[data-view]")],
  viewCounts: [...document.querySelectorAll("[data-view-count]")],
  resultCount: document.querySelector("#result-count"),
  loading: document.querySelector("#loading-state"),
  tableFrame: document.querySelector("#table-frame"),
  rows: document.querySelector("#song-rows"),
  empty: document.querySelector("#empty-state"),
  reset: document.querySelector("#reset-filters"),
  error: document.querySelector("#error-state"),
  errorMessage: document.querySelector("#error-message"),
  retry: document.querySelector("#retry-load"),
  dock: document.querySelector("#selection-dock"),
  selectedCount: document.querySelector("#selected-count"),
  clearSelection: document.querySelector("#clear-selection"),
  copySelection: document.querySelector("#copy-selection"),
  exportSelection: document.querySelector("#export-selection"),
  toast: document.querySelector("#toast"),
};

const state = {
  groups: [],
  credits: new Map(),
  asOf: "",
  query: "",
  artist: "all",
  view: "all",
  selected: new Set(),
};

let toastTimer;

function normalize(value) {
  return String(value).normalize("NFKC").toLocaleLowerCase();
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : dateString;
}

function buildCreditMap(releasesPayload) {
  if (!releasesPayload || !Array.isArray(releasesPayload.main)) {
    throw new Error("演唱名義資料格式不正確。");
  }

  const credits = new Map();
  releasesPayload.main.forEach((release) => {
    if (!Array.isArray(release?.songs) || typeof release?.artist !== "string") return;
    release.songs.forEach((song) => {
      if (typeof song !== "string" || credits.has(song)) return;
      credits.set(song, {
        artist: release.artist,
        year: release.year,
        release: release.release,
      });
    });
  });
  return credits;
}

function parseData(poolPayload, releasesPayload) {
  if (!poolPayload || !Array.isArray(poolPayload.pool)) {
    throw new Error("歌曲分組資料格式不正確。");
  }

  const credits = buildCreditMap(releasesPayload);
  const seenGroups = new Set();
  const seenRecords = new Set();

  const groups = poolPayload.pool.map((entry, sourceIndex) => {
    const title = typeof entry?.title === "string" ? entry.title.trim() : "";
    const includes = Array.isArray(entry?.includes)
      ? [...new Set(entry.includes.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))]
      : [];

    if (!title || includes.length === 0) {
      throw new Error(`第 ${sourceIndex + 1} 組欠缺歌名或收錄版本。`);
    }
    if (seenGroups.has(title)) throw new Error(`重複歌曲組：${title}`);

    const records = includes.map((recordTitle, recordIndex) => {
      if (seenRecords.has(recordTitle)) throw new Error(`重複收錄名稱：${recordTitle}`);
      const credit = credits.get(recordTitle);
      if (!credit) throw new Error(`搵唔到演唱名義：${recordTitle}`);
      seenRecords.add(recordTitle);
      return {
        title: recordTitle,
        artist: credit.artist,
        year: credit.year,
        release: credit.release,
        recordIndex,
        searchText: normalize(`${recordTitle}\n${credit.artist}`),
      };
    });

    const baseRecord = records.find((record) => record.title === title) ?? null;
    const artists = [...new Set(records.map((record) => record.artist))];
    const groupArtist = baseRecord?.artist ?? (artists.length === 1 ? artists[0] : "多種名義");
    const displayTitle = records.length === 1 ? records[0].title : title;
    const subRecords = records.length > 1
      ? records.filter((record) => record.title !== title)
      : [];
    const reviewRecords = subRecords;

    seenGroups.add(title);
    return {
      title,
      displayTitle,
      artist: groupArtist,
      sourceIndex,
      records,
      subRecords,
      reviewRecords,
      searchText: normalize(`${title}\n${displayTitle}\n${groupArtist}\n${records.map((record) => record.title).join("\n")}`),
    };
  });

  return {
    groups,
    credits,
    asOf: typeof poolPayload.asOf === "string" ? poolPayload.asOf : releasesPayload.asOf ?? "",
  };
}

function artistKind(artist) {
  if (artist === "多種名義") return "multiple";
  if (artist === "Utada" || artist === "Hikaru Utada") return "english";
  if (/feat|featuring|&|＆|・|と|,/.test(artist)) return "collaboration";
  return "japanese";
}

function makeArtistChip(artist) {
  const chip = createElement("span", "artist-chip", artist);
  chip.dataset.kind = artistKind(artist);
  return chip;
}

function getStats() {
  const reviewGroups = state.groups.filter((group) => group.reviewRecords.length > 0).length;
  const records = state.groups.reduce((sum, group) => sum + group.records.length, 0);
  const reviewRecords = state.groups.reduce((sum, group) => sum + group.reviewRecords.length, 0);
  const selectedGroups = state.groups.filter((group) =>
    group.reviewRecords.some((record) => state.selected.has(record.title)),
  ).length;
  return { groups: state.groups.length, records, reviewRecords, reviewGroups, selectedGroups };
}

function updateSummary() {
  const stats = getStats();
  elements.asOf.textContent = state.asOf ? `資料截至 ${formatDate(state.asOf)}` : "資料日期未設定";
  elements.groupTotal.textContent = stats.groups;
  elements.recordTotal.textContent = stats.records;
  elements.reviewTotal.textContent = stats.reviewRecords;

  const counts = {
    all: stats.groups,
    review: stats.reviewGroups,
    selected: state.selected.size,
  };
  elements.viewCounts.forEach((element) => {
    element.textContent = counts[element.dataset.viewCount];
  });

  const selectedButton = elements.viewButtons.find((button) => button.dataset.view === "selected");
  selectedButton.disabled = state.selected.size === 0;
  elements.selectedCount.textContent = state.selected.size;
  elements.dock.hidden = state.selected.size === 0;
}

function populateArtistFilter() {
  const artists = [];
  const seen = new Set();
  state.groups.forEach((group) => {
    group.records.forEach((record) => {
      if (seen.has(record.artist)) return;
      seen.add(record.artist);
      artists.push(record.artist);
    });
  });

  const options = artists.map((artist) => {
    const option = createElement("option", "", artist);
    option.value = artist;
    return option;
  });
  elements.artist.append(...options);
}

function syncControls() {
  elements.search.value = state.query;
  elements.clearSearch.hidden = !state.query;
  elements.artist.value = state.artist;
  elements.viewButtons.forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function getVisibleGroups() {
  const query = normalize(state.query.trim());

  return state.groups.flatMap((group) => {
    if (state.view === "review" && group.reviewRecords.length === 0) return [];

    let displayRecords = state.view === "review" ? group.reviewRecords : group.subRecords;
    if (state.view === "selected") {
      displayRecords = group.reviewRecords.filter((record) => state.selected.has(record.title));
    }

    const groupMatchesQuery = !query || group.searchText.includes(query);
    const groupMatchesArtist = state.artist === "all" || group.artist === state.artist;
    displayRecords = displayRecords.filter((record) => {
      const matchesQuery = !query || groupMatchesQuery || record.searchText.includes(query);
      const matchesArtist = state.artist === "all" || record.artist === state.artist;
      return matchesQuery && matchesArtist;
    });

    if (state.view === "selected") {
      return displayRecords.length ? [{ group, displayRecords }] : [];
    }

    const showGroup = (groupMatchesQuery && groupMatchesArtist) || displayRecords.length > 0;
    return showGroup ? [{ group, displayRecords }] : [];
  });
}

function makeGroupRow(group, hasVisibleRecords) {
  const row = createElement("tr", `group-row${hasVisibleRecords ? " has-versions" : ""}`);
  const number = createElement("td", "group-number", String(group.sourceIndex + 1).padStart(3, "0"));
  const titleCell = createElement("th", "title-cell");
  titleCell.scope = "row";
  const titleLine = createElement("div", "title-line");
  titleLine.append(createElement("span", "", group.displayTitle));
  titleCell.append(titleLine);

  const artistCell = createElement("td", "artist-cell");
  artistCell.append(makeArtistChip(group.artist));

  const statusCell = createElement("td", "status-cell");
  statusCell.append(createElement("strong", "", group.records.length === 1 ? "唯一" : `${group.records.length} records`));
  if (group.reviewRecords.length) {
    statusCell.append(createElement("span", "", `${group.reviewRecords.length} 個可拆版本`));
  }

  const reviewCell = createElement("td", "review-cell");
  reviewCell.append(createElement("span", "base-mark", "—"));
  row.append(number, titleCell, artistCell, statusCell, reviewCell);
  return row;
}

function makeRecordRow(group, record, isLastRecord) {
  const selected = state.selected.has(record.title);
  const row = createElement(
    "tr",
    `sub-row${selected ? " is-selected" : ""}${isLastRecord ? " is-last-record" : ""}`,
  );
  row.dataset.recordTitle = record.title;

  const marker = createElement("td", "sub-marker", "↳");
  const titleCell = createElement("td", "title-cell", record.title);
  const artistCell = createElement("td", "artist-cell");
  artistCell.append(makeArtistChip(record.artist));
  const statusCell = createElement("td", "status-cell", "版本");
  const reviewCell = createElement("td", "review-cell");

  const label = createElement("label", "review-toggle");
  const checkbox = createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = selected;
  checkbox.setAttribute("aria-label", `建議將 ${record.title} 從 ${group.title} 拆出`);
  const toggleFace = createElement("span", "toggle-face");
  toggleFace.setAttribute("aria-hidden", "true");
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) state.selected.add(record.title);
    else state.selected.delete(record.title);
    row.classList.toggle("is-selected", checkbox.checked);
    if (state.view === "selected") {
      if (state.selected.size === 0) state.view = "all";
      renderTable();
    } else {
      updateSummary();
      syncControls();
    }
  });
  label.append(checkbox, toggleFace);
  reviewCell.append(label);
  row.append(marker, titleCell, artistCell, statusCell, reviewCell);
  return row;
}

function renderTable() {
  const visible = getVisibleGroups();
  const fragment = document.createDocumentFragment();
  let visibleReviewRecords = 0;

  visible.forEach(({ group, displayRecords }) => {
    fragment.append(makeGroupRow(group, displayRecords.length > 0));
    displayRecords.forEach((record, index) => {
      fragment.append(makeRecordRow(group, record, index === displayRecords.length - 1));
      if (group.reviewRecords.includes(record)) visibleReviewRecords += 1;
    });
  });

  elements.rows.replaceChildren(fragment);
  elements.resultCount.textContent = `顯示 ${visible.length} 個歌曲組 · ${visibleReviewRecords} 個可拆版本`;
  elements.tableFrame.hidden = visible.length === 0;
  elements.empty.hidden = visible.length !== 0;
  updateSummary();
  syncControls();
}

function resetFilters() {
  state.query = "";
  state.artist = "all";
  state.view = "all";
  renderTable();
  elements.search.focus();
}

function clearSelection() {
  state.selected.clear();
  if (state.view === "selected") state.view = "all";
  renderTable();
  showToast("已清除全部選擇");
}

function selectedGroups() {
  return state.groups.flatMap((group) => {
    const records = group.reviewRecords
      .filter((record) => state.selected.has(record.title))
      .map((record) => ({ title: record.title, artist: record.artist }));
    return records.length ? [{ fromGroup: group.title, records }] : [];
  });
}

function selectionText() {
  const lines = [
    "宇多田光歌曲版本分組 Review",
    `建議拆出：${state.selected.size} 個收錄版本`,
    "",
  ];

  selectedGroups().forEach((group) => {
    lines.push(`【${group.fromGroup}】`);
    group.records.forEach((record) => lines.push(`- ${record.title} — ${record.artist}`));
    lines.push("");
  });
  if (state.asOf) lines.push(`資料截至：${state.asOf}`);
  return lines.join("\n").trim();
}

function selectionJson() {
  return {
    dataAsOf: state.asOf,
    selectedCount: state.selected.size,
    splitSuggestions: selectedGroups(),
  };
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("copy failed");
    }
    showToast(`已複製 ${state.selected.size} 個拆分建議`);
  } catch {
    showToast("未能自動複製，請再試一次。", true);
  }
}

function exportJson() {
  const blob = new Blob([`${JSON.stringify(selectionJson(), null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = createElement("a");
  link.href = url;
  link.download = `utada-version-split-review-${state.asOf || "draft"}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast(`已匯出 ${state.selected.size} 個拆分建議`);
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.style.borderColor = isError ? "#ef9bb4" : "";
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderTable();
  });

  elements.clearSearch.addEventListener("click", () => {
    state.query = "";
    renderTable();
    elements.search.focus();
  });

  elements.artist.addEventListener("change", (event) => {
    state.artist = event.target.value;
    renderTable();
  });

  elements.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      state.view = button.dataset.view;
      renderTable();
    });
  });

  elements.reset.addEventListener("click", resetFilters);
  elements.retry.addEventListener("click", initialize);
  elements.clearSelection.addEventListener("click", clearSelection);
  elements.copySelection.addEventListener("click", () => copyText(selectionText()));
  elements.exportSelection.addEventListener("click", exportJson);

  document.addEventListener("keydown", (event) => {
    const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (event.key === "/" && !isTyping) {
      event.preventDefault();
      elements.search.focus();
    }
    if (event.key === "Escape" && document.activeElement === elements.search && state.query) {
      state.query = "";
      renderTable();
    }
  });
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function initialize() {
  elements.loading.hidden = false;
  elements.tableFrame.hidden = true;
  elements.empty.hidden = true;
  elements.error.hidden = true;
  elements.resultCount.textContent = "正在讀取歌曲資料…";

  try {
    const [poolPayload, releasesPayload] = await Promise.all([
      fetchJson(DATA_URLS.pool),
      fetchJson(DATA_URLS.releases),
    ]);
    const parsed = parseData(poolPayload, releasesPayload);
    state.groups = parsed.groups;
    state.credits = parsed.credits;
    state.asOf = parsed.asOf;
    populateArtistFilter();
    elements.loading.hidden = true;
    renderTable();
  } catch (error) {
    elements.loading.hidden = true;
    elements.tableFrame.hidden = true;
    elements.error.hidden = false;
    elements.resultCount.textContent = "資料讀取失敗";
    elements.errorMessage.textContent = window.location.protocol === "file:"
      ? "請透過 GitHub Pages 或 local server 開啟，唔好直接 double-click index.html。"
      : `請檢查歌曲資料檔案後再試。${error?.message ? `（${error.message}）` : ""}`;
  }
}

bindEvents();
initialize();
