const DATA_URL = "./data/utada-hikaru-quiz-pool.base.json";

const elements = {
  asOf: document.querySelector("#as-of"),
  groupTotal: document.querySelector("#group-total"),
  versionTotal: document.querySelector("#version-total"),
  multiTotal: document.querySelector("#multi-total"),
  singleTotal: document.querySelector("#single-total"),
  search: document.querySelector("#search-input"),
  clearSearch: document.querySelector("#clear-search"),
  sort: document.querySelector("#sort-select"),
  filterButtons: [...document.querySelectorAll("[data-filter]")],
  filterCounts: [...document.querySelectorAll("[data-filter-count]")],
  expandAll: document.querySelector("#expand-all"),
  collapseAll: document.querySelector("#collapse-all"),
  resultCount: document.querySelector("#result-count"),
  loading: document.querySelector("#loading-state"),
  grid: document.querySelector("#card-grid"),
  empty: document.querySelector("#empty-state"),
  reset: document.querySelector("#reset-filters"),
  error: document.querySelector("#error-state"),
  errorMessage: document.querySelector("#error-message"),
  retry: document.querySelector("#retry-load"),
  toast: document.querySelector("#toast"),
};

const state = {
  items: [],
  asOf: "",
  query: "",
  filter: "all",
  sort: "source",
};

const collator = new Intl.Collator(["zh-Hant-HK", "ja", "en"], {
  sensitivity: "base",
  numeric: true,
});

let toastTimer;
let targetTimer;
let cardsByTitle = new Map();

function normalize(value) {
  return String(value).normalize("NFKC").toLocaleLowerCase();
}

function formatDate(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : dateString;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function parsePool(payload) {
  if (!payload || !Array.isArray(payload.pool)) {
    throw new Error("JSON 格式不正確：搵唔到 pool array。");
  }

  const titles = new Set();
  const items = payload.pool.map((entry, index) => {
    const title = typeof entry?.title === "string" ? entry.title.trim() : "";
    const includes = Array.isArray(entry?.includes)
      ? [...new Set(entry.includes.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))]
      : [];

    if (!title || includes.length === 0) {
      throw new Error(`JSON 第 ${index + 1} 組欠缺 title 或 includes。`);
    }
    if (titles.has(title)) {
      throw new Error(`JSON 有重複組名：${title}`);
    }

    titles.add(title);
    return {
      title,
      includes,
      sourceIndex: index,
      searchText: normalize([title, ...includes].join("\n")),
    };
  });

  return {
    asOf: typeof payload.asOf === "string" ? payload.asOf : "",
    items,
  };
}

function getStats() {
  const multi = state.items.filter((item) => item.includes.length > 1).length;
  return {
    groups: state.items.length,
    versions: state.items.reduce((sum, item) => sum + item.includes.length, 0),
    multi,
    single: state.items.length - multi,
  };
}

function updateStats() {
  const stats = getStats();
  elements.asOf.textContent = state.asOf ? `AS OF ${formatDate(state.asOf)}` : "DATE NOT SET";
  elements.groupTotal.textContent = stats.groups;
  elements.versionTotal.textContent = stats.versions;
  elements.multiTotal.textContent = stats.multi;
  elements.singleTotal.textContent = stats.single;

  const counts = { all: stats.groups, multi: stats.multi, single: stats.single };
  elements.filterCounts.forEach((element) => {
    element.textContent = counts[element.dataset.filterCount];
  });
}

function getVisibleItems() {
  const query = normalize(state.query.trim());
  const filtered = state.items.filter((item) => {
    const matchesQuery = !query || item.searchText.includes(query);
    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "multi" && item.includes.length > 1) ||
      (state.filter === "single" && item.includes.length === 1);
    return matchesQuery && matchesFilter;
  });

  if (state.sort === "alpha") {
    return filtered.sort((a, b) => collator.compare(a.title, b.title));
  }
  if (state.sort === "versions") {
    return filtered.sort(
      (a, b) => b.includes.length - a.includes.length || a.sourceIndex - b.sourceIndex,
    );
  }
  return filtered.sort((a, b) => a.sourceIndex - b.sourceIndex);
}

function makeShareUrl(title) {
  const url = new URL(window.location.href);
  url.hash = title;
  return url.toString();
}

function discussionText(item) {
  const versions = item.includes.map((title, index) => `${index + 1}. ${title}`).join("\n");
  return [
    `【歌曲版本分組討論】${item.title}`,
    `目前同組（${item.includes.length} 個收錄名稱）：`,
    versions,
    "",
    "你覺得以上版本應該繼續同組，定係有邊幾個要拆開？",
    makeShareUrl(item.title),
  ].join("\n");
}

async function copyText(text, successMessage) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("copy command failed");
    }
    showToast(successMessage);
  } catch {
    showToast("未能自動複製，請手動 copy。", true);
  }
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.style.borderColor = isError ? "rgba(255, 152, 165, 0.48)" : "";
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

function makeCard(item) {
  const article = createElement("article", `song-card ${item.includes.length > 1 ? "is-multi" : "is-single"}`);
  article.dataset.title = item.title;

  const head = createElement("div", "card-head");
  const kicker = createElement("div", "card-kicker");
  const index = createElement("span", "card-index", `GROUP ${String(item.sourceIndex + 1).padStart(3, "0")}`);
  const badgeText = item.includes.length > 1 ? `目前同組 · ${item.includes.length}` : "單版本組";
  const badge = createElement("span", "version-badge", badgeText);
  const title = createElement("h3", "", item.title);

  kicker.append(index, badge);
  head.append(kicker, title);

  const details = createElement("details", "version-details");
  const summary = createElement("summary");
  const summaryText = createElement("span", "", `查看同組版本（${item.includes.length}）`);
  const arrow = createElement("span", "details-arrow", "+");
  arrow.setAttribute("aria-hidden", "true");
  summary.append(summaryText, arrow);

  const list = createElement("ol", "version-list");
  item.includes.forEach((version, versionIndex) => {
    const row = createElement("li");
    const number = createElement("span", "version-number", String(versionIndex + 1).padStart(2, "0"));
    const name = createElement("span", "", version);
    row.append(number, name);
    if (version === item.title) {
      row.append(createElement("span", "base-label", "組名"));
    }
    list.append(row);
  });
  details.append(summary, list);

  const actions = createElement("div", "card-actions");
  const copyDiscussion = createElement("button", "card-action", "複製討論內容");
  copyDiscussion.type = "button";
  copyDiscussion.setAttribute("aria-label", `複製 ${item.title} 的分組討論內容`);
  copyDiscussion.addEventListener("click", () => {
    copyText(discussionText(item), `已複製「${item.title}」討論內容`);
  });

  const copyLink = createElement("button", "card-action", "複製此組連結 ↗");
  copyLink.type = "button";
  copyLink.setAttribute("aria-label", `複製 ${item.title} 的直接連結`);
  copyLink.addEventListener("click", () => {
    copyText(makeShareUrl(item.title), `已複製「${item.title}」連結`);
  });

  actions.append(copyDiscussion, copyLink);
  article.append(head, details, actions);
  cardsByTitle.set(item.title, article);
  return article;
}

function syncControls() {
  elements.search.value = state.query;
  elements.clearSearch.hidden = !state.query;
  elements.sort.value = state.sort;
  elements.filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === state.filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderCards() {
  const visibleItems = getVisibleItems();
  const fragment = document.createDocumentFragment();
  cardsByTitle = new Map();
  visibleItems.forEach((item) => fragment.append(makeCard(item)));
  elements.grid.replaceChildren(fragment);

  elements.resultCount.textContent = `顯示 ${visibleItems.length} / ${state.items.length} 組`;
  elements.empty.hidden = visibleItems.length !== 0;
  elements.grid.hidden = visibleItems.length === 0;
  syncControls();
}

function resetView() {
  state.query = "";
  state.filter = "all";
  state.sort = "source";
  renderCards();
  elements.search.focus();
}

function decodedHash() {
  if (!window.location.hash) return "";
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return window.location.hash.slice(1);
  }
}

function revealHashTarget() {
  const targetTitle = decodedHash();
  if (!targetTitle || !state.items.length) return;

  if (!cardsByTitle.has(targetTitle) && state.items.some((item) => item.title === targetTitle)) {
    state.query = "";
    state.filter = "all";
    renderCards();
  }

  const card = cardsByTitle.get(targetTitle);
  if (!card) return;
  card.querySelector("details").open = true;
  card.classList.add("is-targeted");
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  window.clearTimeout(targetTimer);
  targetTimer = window.setTimeout(() => card.classList.remove("is-targeted"), 4200);
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderCards();
  });

  elements.clearSearch.addEventListener("click", () => {
    state.query = "";
    renderCards();
    elements.search.focus();
  });

  elements.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      renderCards();
    });
  });

  elements.sort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderCards();
  });

  elements.expandAll.addEventListener("click", () => {
    elements.grid.querySelectorAll("details").forEach((details) => {
      details.open = true;
    });
  });

  elements.collapseAll.addEventListener("click", () => {
    elements.grid.querySelectorAll("details").forEach((details) => {
      details.open = false;
    });
  });

  elements.reset.addEventListener("click", resetView);
  elements.retry.addEventListener("click", initialize);
  window.addEventListener("hashchange", revealHashTarget);

  document.addEventListener("keydown", (event) => {
    const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (event.key === "/" && !isTyping) {
      event.preventDefault();
      elements.search.focus();
    }
    if (event.key === "Escape" && document.activeElement === elements.search && state.query) {
      state.query = "";
      renderCards();
    }
  });
}

async function initialize() {
  elements.loading.hidden = false;
  elements.error.hidden = true;
  elements.empty.hidden = true;
  elements.grid.hidden = true;
  elements.resultCount.textContent = "正在讀取歌曲分組…";

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parsePool(await response.json());
    state.items = parsed.items;
    state.asOf = parsed.asOf;
    updateStats();
    renderCards();
    elements.loading.hidden = true;
    window.setTimeout(revealHashTarget, 0);
  } catch (error) {
    elements.loading.hidden = true;
    elements.grid.hidden = true;
    elements.error.hidden = false;
    elements.resultCount.textContent = "資料讀取失敗";
    elements.errorMessage.textContent = window.location.protocol === "file:"
      ? "直接 double-click index.html 時，browser 通常會阻擋 JSON。請用 GitHub Pages，或者跟 README 開 local server。"
      : `請檢查 data JSON 路徑及格式，再重新整理。${error?.message ? `（${error.message}）` : ""}`;
  }
}

bindEvents();
initialize();
