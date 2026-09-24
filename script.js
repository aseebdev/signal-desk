(() => {
  "use strict";

  const STORAGE = "signaldesk.workspace.v1";
  const THEME = "signaldesk.theme.v1";
  const state = {
    user: null,
    signals: [],
    history: [],
    view: "inbox",
    selectedRecommendation: null
  };

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const todayISO = () => new Date().toISOString().slice(0,10);
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function announce(message) {
    const region = $("#toast-region");
    region.textContent = "";
    setTimeout(() => region.textContent = message, 10);
  }

  function loadWorkspace() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.signals)) state.signals = data.signals;
      if (Array.isArray(data.history)) state.history = data.history;
    } catch {
      announce("Local workspace data could not be read. A new workspace was started.");
    }
  }

  function saveWorkspace() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({signals: state.signals, history: state.history}));
      $("#save-state").textContent = "Saved locally";
    } catch {
      $("#save-state").textContent = "Local storage unavailable";
      announce("The browser could not save workspace data.");
    }
  }

  function validName(name) {
    return /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,60}$/.test(name.trim());
  }

  function scoreSignal(s) {
    const days = s.due ? Math.ceil((new Date(`${s.due}T23:59:59`) - new Date()) / 86400000) : 14;
    const urgency = s.due ? Math.max(0, Math.min(5, 5 - Math.max(days, 0) * 0.7)) : 1.2;
    const overdue = days < 0 ? 3 : 0;
    return Math.round((s.impact * 2 + urgency * 2 + overdue - s.effort * 0.35) * 10) / 10;
  }

  function dueLabel(due) {
    if (!due) return "No due date";
    const days = Math.ceil((new Date(`${due}T23:59:59`) - new Date()) / 86400000);
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due ${new Date(`${due}T00:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"})}`;
  }

  function nextMove(s) {
    if (s.effort <= 2) return "Do the smallest executable step now — aim for 10 minutes, not completion.";
    if (s.due && s.due <= todayISO()) return "Protect a short time block now. This item is already at its deadline.";
    if (s.impact >= 4) return "Define the outcome first, then schedule one concrete action toward it.";
    if (s.category === "Idea") return "Capture the testable version: who benefits, what changes, and what would prove it useful.";
    return "Break this into one visible action that can be finished in a single focused session.";
  }

  function recommendation(s) {
    const score = scoreSignal(s);
    let reason = score >= 14 ? "It combines meaningful impact with timing pressure." :
      score >= 9 ? "It has enough impact or timing pressure to deserve deliberate attention." :
      "It is currently lower pressure, so it can wait behind more consequential work.";
    return {score, reason, move: nextMove(s)};
  }

  function renderCard(s) {
    const rec = recommendation(s);
    const card = document.createElement("article");
    card.className = "signal-card";
    card.dataset.id = s.id;
    card.innerHTML = `
      <div class="signal-main">
        <div class="signal-top"><span class="tag">${escapeHtml(s.category)}</span><span class="score">Priority ${rec.score}</span></div>
        <h3>${escapeHtml(s.title)}</h3>
        ${s.context ? `<p class="signal-context">${escapeHtml(s.context)}</p>` : ""}
        <div class="signal-meta"><span>${escapeHtml(dueLabel(s.due))}</span><span>Impact ${s.impact}/5</span><span>Effort ${s.effort}/5</span></div>
      </div>
      <div class="signal-actions">
        <button class="mini-button ${s.saved ? "starred" : ""}" data-action="save" aria-label="${s.saved ? "Remove from saved" : "Save signal"}">${s.saved ? "★" : "☆"}</button>
        <button class="mini-button" data-action="recommend">Next</button>
        <button class="mini-button" data-action="complete">✓</button>
        <button class="mini-button" data-action="delete" aria-label="Delete signal">×</button>
      </div>`;
    return card;
  }

  function getFilteredSignals() {
    const query = $("#search").value.trim().toLowerCase();
    const category = $("#filter-category").value;
    const sort = $("#sort-order").value;
    let list = state.signals.filter(s => !query || `${s.title} ${s.context || ""} ${s.category}`.toLowerCase().includes(query));
    if (category !== "all") list = list.filter(s => s.category === category);
    list.sort((a,b) => {
      if (sort === "due") return (a.due || "9999") .localeCompare(b.due || "9999");
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "effort") return a.effort - b.effort;
      return scoreSignal(b) - scoreSignal(a);
    });
    return list;
  }

  function renderList(target, list, empty) {
    target.innerHTML = "";
    empty.classList.toggle("hidden", list.length !== 0);
    list.forEach(s => target.appendChild(renderCard(s)));
  }

  function renderHistory() {
    const target = $("#history-list"), empty = $("#history-empty");
    target.innerHTML = "";
    empty.classList.toggle("hidden", state.history.length !== 0);
    state.history.slice().reverse().forEach(h => {
      const el = document.createElement("div");
      el.className = "history-item";
      el.innerHTML = `<div><strong>${escapeHtml(h.title)}</strong><small>Completed ${new Date(h.completedAt).toLocaleString()}</small></div><span class="tag">${escapeHtml(h.category)}</span>`;
      target.appendChild(el);
    });
  }

  function render() {
    $("#date-label").textContent = new Date().toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
    const active = state.signals.length;
    const soon = state.signals.filter(s => s.due && s.due <= new Date(Date.now()+3*86400000).toISOString().slice(0,10)).length;
    const impact = state.signals.filter(s => s.impact >= 4).length;
    $("#metric-active").textContent = active;
    $("#metric-soon").textContent = soon;
    $("#metric-impact").textContent = impact;
    $("#queue-count").textContent = active;
    $("#today-count").textContent = state.signals.filter(s => s.due && s.due <= todayISO()).length;
    $("#saved-count").textContent = state.signals.filter(s => s.saved).length;
    $("#history-count").textContent = state.history.length;

    const top = getFilteredSignals()[0];
    $("#insight-text").textContent = top ? `Start with “${top.title}”. ${nextMove(top)}` : "Add your first signal to get a focused recommendation.";

    renderList($("#signal-list"), getFilteredSignals(), $("#empty-state"));
    renderList($("#today-list"), state.signals.filter(s => s.due && s.due <= todayISO()).sort((a,b)=>scoreSignal(b)-scoreSignal(a)), $("#today-empty"));
    renderList($("#saved-list"), state.signals.filter(s => s.saved).sort((a,b)=>scoreSignal(b)-scoreSignal(a)), $("#saved-empty"));
    renderHistory();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[ch]));
  }

  async function registerUser(name, age) {
    const response = await fetch("/api/users", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({name, age})
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || "Could not save the user entry.");
    return data;
  }

  async function entrySubmit(e) {
    e.preventDefault();
    const name = $("#name").value.trim();
    const age = Number($("#age").value);
    $("#entry-error").textContent = "";
    if (!validName(name)) return $("#entry-error").textContent = "Enter a real name using letters, spaces, apostrophes or hyphens.";
    if (!Number.isInteger(age) || age < 1 || age > 120) return $("#entry-error").textContent = "Enter an age from 1 to 120.";
    try {
      const user = await registerUser(name, age);
      state.user = user;
      localStorage.setItem("signaldesk.user.v1", JSON.stringify(user));
      enterApp();
    } catch (err) {
      $("#entry-error").textContent = err.message;
    }
  }

  function enterApp() {
    $("#entry-screen").classList.add("hidden");
    $("#app").classList.remove("hidden");
    $("#user-name").textContent = state.user.name;
    $("#user-age").textContent = `Age ${state.user.age}`;
    $("#avatar").textContent = state.user.name[0].toUpperCase();
    loadWorkspace();
    render();
  }

  function openCapture() {
    $("#capture-form").reset();
    $("#impact-output").value = "3"; $("#effort-output").value = "3";
    $("#impact-output").textContent = "3"; $("#effort-output").textContent = "3";
    $("#capture-error").textContent = "";
    $("#signal-due").value = todayISO();
    $("#capture-dialog").showModal();
    $("#signal-title").focus();
  }

  function saveSignal(e) {
    e.preventDefault();
    const title = $("#signal-title").value.trim();
    if (!title) return $("#capture-error").textContent = "Give the signal a clear, actionable title.";
    const signal = {
      id: uid(), title, category: $("#signal-category").value, due: $("#signal-due").value,
      impact: Number($("#signal-impact").value), effort: Number($("#signal-effort").value),
      context: $("#signal-context").value.trim(), saved:false, createdAt:new Date().toISOString()
    };
    state.signals.push(signal); saveWorkspace(); render(); $("#capture-dialog").close(); announce("Signal added.");
  }

  function handleSignalAction(e) {
    const button = e.target.closest("[data-action]");
    if (!button) return;
    const card = e.target.closest(".signal-card");
    const id = card?.dataset.id;
    const s = state.signals.find(x => x.id === id);
    if (!s) return;
    const action = button.dataset.action;
    if (action === "save") { s.saved = !s.saved; saveWorkspace(); render(); announce(s.saved ? "Saved." : "Removed from saved."); }
    if (action === "delete") { state.signals = state.signals.filter(x => x.id !== id); saveWorkspace(); render(); announce("Signal deleted."); }
    if (action === "complete") completeSignal(id);
    if (action === "recommend") openRecommendation(s);
  }

  function completeSignal(id) {
    const index = state.signals.findIndex(s=>s.id===id);
    if (index < 0) return;
    const s = state.signals.splice(index,1)[0];
    state.history.push({...s, completedAt:new Date().toISOString()});
    saveWorkspace(); render(); announce("Signal marked complete.");
    if ($("#recommend-dialog").open) $("#recommend-dialog").close();
  }

  function openRecommendation(s) {
    const rec = recommendation(s);
    state.selectedRecommendation = s.id;
    $("#recommend-title").textContent = s.title;
    $("#recommend-body").innerHTML = `<p><strong>Why this order?</strong> ${escapeHtml(rec.reason)}</p><div class="move"><strong>Recommended next move</strong><br>${escapeHtml(rec.move)}</div><p>Priority score: <strong>${rec.score}</strong>. This is a transparent rule-based ranking, not a prediction or AI-generated answer.</p>`;
    $("#recommend-dialog").showModal();
  }

  function setView(view) {
    state.view = view;
    $$(".view").forEach(v=>v.classList.toggle("active", v.id === `view-${view}`));
    $$(".nav-item[data-view]").forEach(b=>b.classList.toggle("active", b.dataset.view === view));
    $("#sidebar").classList.remove("open");
  }

  function setTheme(theme) {
    document.body.dataset.theme = theme;
    localStorage.setItem(THEME, theme);
    $("#theme-menu").classList.add("hidden");
    announce(`${theme} theme selected.`);
  }

  function exportData() {
    const payload = {version:1, exportedAt:new Date().toISOString(), signals:state.signals, history:state.history};
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download=`signaldesk-export-${todayISO()}.json`; a.click(); URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.signals) || !Array.isArray(data.history)) throw new Error("Invalid SignalDesk export.");
        const cleanSignal = s => ({id:String(s.id||uid()),title:String(s.title||"").slice(0,120),category:["Work","Study","Personal","Finance","Health","Idea"].includes(s.category)?s.category:"Personal",due:/^\d{4}-\d{2}-\d{2}$/.test(s.due||"")?s.due:"",impact:Math.min(5,Math.max(1,Number(s.impact)||3)),effort:Math.min(5,Math.max(1,Number(s.effort)||3)),context:String(s.context||"").slice(0,500),saved:Boolean(s.saved),createdAt:String(s.createdAt||new Date().toISOString())});
        state.signals = data.signals.map(cleanSignal).filter(s=>s.title);
        state.history = data.history.map(cleanSignal).filter(s=>s.title).map(s=>({...s,completedAt:String(s.completedAt||new Date().toISOString())}));
        saveWorkspace(); render(); announce("Workspace imported.");
      } catch(err) { announce(err.message); }
    };
    reader.readAsText(file);
  }

  function bind() {
    $("#entry-form").addEventListener("submit", entrySubmit);
    $("#capture-button").addEventListener("click", openCapture);
    $("#empty-capture").addEventListener("click", openCapture);
    $("#capture-form").addEventListener("submit", saveSignal);
    $("#signal-list").addEventListener("click", handleSignalAction);
    $("#today-list").addEventListener("click", handleSignalAction);
    $("#saved-list").addEventListener("click", handleSignalAction);
    $("#search").addEventListener("input", render);
    $("#filter-category").addEventListener("change", render);
    $("#sort-order").addEventListener("change", render);
    $$(".nav-item[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
    $("#mobile-nav").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
    $("#theme-button").addEventListener("click",()=>$("#theme-menu").classList.toggle("hidden"));
    $("#settings-theme").addEventListener("click",()=>$("#theme-menu").classList.toggle("hidden"));
    $$("#theme-menu button").forEach(b=>b.addEventListener("click",()=>setTheme(b.dataset.themeChoice)));
    $("#export-button").addEventListener("click",exportData); $("#settings-export").addEventListener("click",exportData);
    $("#import-file").addEventListener("change",e=>e.target.files[0]&&importData(e.target.files[0]));
    $("#reset-workspace").addEventListener("click",()=>{ if(confirm("Reset all local signals and history?")) { localStorage.removeItem(STORAGE); state.signals=[];state.history=[];render();announce("Local workspace reset."); }});
    $("#clear-history").addEventListener("click",()=>{ if(confirm("Clear completed history?")) {state.history=[];saveWorkspace();render();}});
    $("#close-recommend").addEventListener("click",()=>$("#recommend-dialog").close());
    $("#recommend-close").addEventListener("click",()=>$("#recommend-dialog").close());
    $("#recommend-complete").addEventListener("click",()=>state.selectedRecommendation&&completeSignal(state.selectedRecommendation));
    ["impact","effort"].forEach(id=>$("#signal-"+id).addEventListener("input",e=>$("#"+id+"-output").textContent=e.target.value));
    document.addEventListener("click",e=>{ if(!e.target.closest("#theme-menu")&&!e.target.closest("#theme-button")&&!e.target.closest("#settings-theme")) $("#theme-menu").classList.add("hidden"); });
  }

  const savedTheme = localStorage.getItem(THEME);
  if (savedTheme && ["executive","future","human"].includes(savedTheme)) document.body.dataset.theme = savedTheme;
  bind();
  try {
    const existing = JSON.parse(localStorage.getItem("signaldesk.user.v1") || "null");
    if (existing && validName(existing.name) && Number.isInteger(existing.age)) { state.user=existing; enterApp(); }
  } catch {}
})();