/* Dashboard application logic */

(function () {
  "use strict";

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  let currentUser = null;
  let currentShop = null;
  let currentPage = "dashboard";
  let charts = {};

  // ---------- Auth & boot ----------
  async function boot() {
    currentUser = await App.requireAuth();
    if (!currentUser) return;
    $("#userName").textContent = currentUser.fullName;
    $("#userRole").textContent = App.ROLE_LABELS[currentUser.role] || currentUser.role;
    $("#userAvatar").textContent = (currentUser.fullName || "U").charAt(0).toUpperCase();
    $("#shopName").textContent = currentUser.shopName || "Personal";

    // Sign out button
    $("#sidebar .btn").addEventListener("click", (e) => {
      e.preventDefault();
      App.logout();
    });

    // Role-based nav visibility
    $$(".nav-item[data-roles]").forEach((el) => {
      const roles = el.getAttribute("data-roles").split(",");
      if (!roles.includes(currentUser.role)) {
        el.style.display = "none";
      }
    });

    // Nav clicks
    $$(".nav-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const page = el.getAttribute("data-page");
        if (page) navigateTo(page);
      });
    });

    // Mobile menu toggle
    $("#menuToggle").addEventListener("click", () => {
      $("#sidebar").classList.toggle("open");
    });

    // Global search
    let searchTimer = null;
    $("#globalSearch").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if (currentPage === "phones") renderPhones(e.target.value);
        else if (currentPage === "parts") renderParts(e.target.value);
      }, 300);
    });

    // Modal close on backdrop click
    $$(".modal-backdrop").forEach((b) => {
      b.addEventListener("click", (e) => {
        if (e.target === b) b.classList.remove("open");
      });
    });

    // Forms
    $("#phoneForm").addEventListener("submit", handlePhoneSubmit);
    $("#partForm").addEventListener("submit", handlePartSubmit);
    $("#catForm").addEventListener("submit", handleCatSubmit);
    $("#saleForm").addEventListener("submit", handleSaleSubmit);
    $("#restockForm").addEventListener("submit", handleRestockSubmit);
    $("#userForm").addEventListener("submit", handleUserSubmit);
    $("#restoreForm").addEventListener("submit", handleRestoreSubmit);

    // Start on dashboard
    navigateTo("dashboard");
  }

  function navigateTo(page) {
    currentPage = page;
    $$(".nav-item").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-page") === page);
    });
    $("#pageTitle").textContent = pageTitle(page);
    const c = $("#pageContainer");
    c.innerHTML = "";
    // Destroy old charts
    Object.values(charts).forEach((ch) => {
      try {
        ch.destroy();
      } catch (e) {}
    });
    charts = {};

    if (page === "dashboard") renderDashboard();
    else if (page === "phones") renderPhones();
    else if (page === "categories") renderCategories();
    else if (page === "parts") renderParts();
    else if (page === "sales") renderSales();
    else if (page === "restock") renderRestock();
    else if (page === "users") renderUsers();
    else if (page === "logs") renderLogs();
    else if (page === "backup") renderBackup();
    // close sidebar on mobile
    $("#sidebar").classList.remove("open");
  }

  function pageTitle(p) {
    return {
      dashboard: "Dashboard",
      phones: "Phones Inventory",
      categories: "Categories",
      parts: "Spare Parts",
      sales: "Sales",
      restock: "Restock",
      users: "Users",
      logs: "Activity Log",
      backup: "Backup & Restore",
    }[p] || "Dashboard";
  }

  function canEdit() {
    return ["admin", "shop_admin", "worker"].includes(currentUser.role);
  }
  function isAdmin() {
    return currentUser.role === "admin" || currentUser.role === "shop_admin";
  }

  // ---------- Dashboard ----------
  async function renderDashboard() {
    const c = $("#pageContainer");
    c.innerHTML = `
      <div class="page">
        <div class="hero-banner">
          <div class="morph"></div>
          <h2 id="welcomeMsg">Welcome back</h2>
          <p id="welcomeSub">Here's what's happening in your shop today.</p>
        </div>

        <div class="stats-grid" id="statsGrid">
          <div class="stat-card">
            <div class="icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg></div>
            <div class="label">Phone models</div>
            <div class="value" id="sModels">—</div>
            <div class="sub" id="sModelsSub">—</div>
          </div>
          <div class="stat-card">
            <div class="icon cyan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
            <div class="label">Spare parts</div>
            <div class="value" id="sParts">—</div>
            <div class="sub" id="sPartsSub">—</div>
          </div>
          <div class="stat-card">
            <div class="icon pink"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
            <div class="label">Total revenue</div>
            <div class="value" id="sRevenue">—</div>
            <div class="sub" id="sRevenueSub">—</div>
          </div>
          <div class="stat-card">
            <div class="icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M9 9h6v6H9z"/></svg></div>
            <div class="label">Sales transactions</div>
            <div class="value" id="sTx">—</div>
            <div class="sub" id="sTxSub">All time</div>
          </div>
        </div>

        <div class="charts-grid">
          <div class="card">
            <div class="chart-title">Sales over the last 30 days</div>
            <div class="chart-sub">Daily revenue in Ghana Cedis</div>
            <div class="chart-wrap"><canvas id="chartSales"></canvas></div>
          </div>
          <div class="card">
            <div class="chart-title">Phones by category</div>
            <div class="chart-sub">Models count across categories</div>
            <div class="chart-wrap"><canvas id="chartCategory"></canvas></div>
          </div>
        </div>

        <div class="charts-grid">
          <div class="card">
            <div class="chart-title">Top selling phones</div>
            <div class="chart-sub">Units sold across all transactions</div>
            <div class="chart-wrap"><canvas id="chartTop"></canvas></div>
          </div>
          <div class="card">
            <div class="chart-title">Payment methods</div>
            <div class="chart-sub">Revenue split by method</div>
            <div class="chart-wrap"><canvas id="chartPayment"></canvas></div>
          </div>
        </div>

        <div class="card">
          <div class="flex justify-between items-center">
            <div>
              <div class="chart-title" style="margin-bottom:2px">Low stock alerts</div>
              <div class="chart-sub">Phones with less than 3 units</div>
            </div>
            <button class="btn btn-sm" onclick="document.querySelector('[data-page=phones]').click()">View all</button>
          </div>
          <div id="lowStockList"></div>
        </div>
      </div>
    `;

    $("#welcomeMsg").textContent = "Welcome back, " + (currentUser.fullName || "there");
    $("#welcomeSub").textContent =
      "Here's what's happening in " + (currentUser.shopName || "your shop") + " today.";

    try {
      const stats = await App.api("/api/stats");
      $("#sModels").textContent = stats.phones.totalModels.toLocaleString();
      $("#sModelsSub").textContent =
        stats.phones.totalUnits.toLocaleString() + " units · " + App.ghs(stats.phones.totalValue) + " value";
      $("#sParts").textContent = stats.parts.totalTypes.toLocaleString();
      $("#sPartsSub").textContent = stats.parts.totalUnits.toLocaleString() + " units in stock";
      $("#sRevenue").textContent = App.ghs(stats.sales.totalRevenue);
      $("#sRevenueSub").textContent = stats.sales.totalTransactions + " transactions";
      $("#sTx").textContent = stats.sales.totalTransactions.toLocaleString();

      // Sales over 30 days (line)
      const days = stats.salesByDay || [];
      const labels = days.map((d) => d.day);
      const totals = days.map((d) => Number(d.total));
      charts.sales = new Chart($("#chartSales"), {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Revenue (GHS)",
              data: totals,
              borderColor: "#8b5cf6",
              backgroundColor: "rgba(139, 92, 246, 0.18)",
              tension: 0.4,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: "#8b5cf6",
            },
          ],
        },
        options: chartOpts(true),
      });

      // Category pie
      const cats = stats.phonesByCategory || [];
      charts.category = new Chart($("#chartCategory"), {
        type: "doughnut",
        data: {
          labels: cats.map((c) => c.categoryName),
          datasets: [
            {
              data: cats.map((c) => Number(c.count)),
              backgroundColor: ["#8b5cf6", "#22d3ee", "#f472b6", "#10b981", "#f59e0b", "#6366f1", "#ef4444"],
              borderColor: "rgba(0,0,0,0.3)",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { color: "#cbd3e6" } },
          },
        },
      });

      // Top phones
      const top = stats.topPhones || [];
      charts.top = new Chart($("#chartTop"), {
        type: "bar",
        data: {
          labels: top.map((t) => t.label),
          datasets: [
            {
              label: "Units sold",
              data: top.map((t) => Number(t.totalQty)),
              backgroundColor: "rgba(34, 211, 238, 0.6)",
              borderColor: "#22d3ee",
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: chartOpts(false, "y"),
      });

      // Payment methods
      const pays = stats.paymentMethods || [];
      charts.payment = new Chart($("#chartPayment"), {
        type: "doughnut",
        data: {
          labels: pays.map((p) => p.method),
          datasets: [
            {
              data: pays.map((p) => Number(p.total)),
              backgroundColor: ["#22d3ee", "#8b5cf6", "#f472b6", "#10b981", "#f59e0b"],
              borderColor: "rgba(0,0,0,0.3)",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { color: "#cbd3e6" } } },
        },
      });

      // Low stock list
      const low = stats.lowStockPhones || [];
      const lowList = $("#lowStockList");
      if (low.length === 0) {
        lowList.innerHTML =
          '<div class="empty" style="padding:30px"><h3>Stock levels are healthy</h3><p>All phones have sufficient stock.</p></div>';
      } else {
        lowList.innerHTML =
          '<div class="table-wrap mt-3"><table class="data"><thead><tr><th>Phone</th><th>Stock</th><th>Action</th></tr></thead><tbody>' +
          low
            .map(
              (p) =>
                `<tr><td>${p.brand} ${p.model}</td><td><span class="badge badge-worker">${p.stock} units</span></td><td><button class="btn btn-sm" onclick="openRestockFromLow('${p.id}')">Restock</button></td></tr>`
            )
            .join("") +
          "</tbody></table></div>";
      }
    } catch (err) {
      App.toast("Failed to load stats: " + err.message, "error");
    }
  }

  window.openRestockFromLow = async function (phoneId) {
    try {
      const { phone } = await App.api("/api/phones/" + phoneId);
      openRestockModal(phone.id, "phone", phone.brand + " " + phone.model, phone.stock);
    } catch (e) {
      App.toast(e.message, "error");
    }
  };

  function chartOpts(currency, indexAxis) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: indexAxis || "x",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: currency
            ? {
                label: (ctx) => "GHS " + Number(ctx.parsed.y).toLocaleString(),
              }
            : undefined,
        },
      },
      scales: {
        x: {
          ticks: { color: "#9aa5bd", maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          ticks: {
            color: "#9aa5bd",
            callback: currency ? (v) => "GHS " + v : undefined,
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    };
  }

  // ---------- Phones ----------
  let phonesCache = [];
  let categoriesCache = [];

  async function renderPhones(query) {
    const c = $("#pageContainer");
    c.innerHTML = `
      <div class="page">
        <div class="toolbar">
          <select id="filterCat" class="btn btn-ghost btn-sm">
            <option value="">All categories</option>
          </select>
          <div class="spacer"></div>
          ${canEdit() ? '<button class="btn btn-primary" id="addPhoneBtn">+ Add phone</button>' : ""}
        </div>
        <div id="phonesList"></div>
      </div>
    `;
    if (canEdit()) {
      $("#addPhoneBtn").addEventListener("click", () => openPhoneModal());
    }
    try {
      const cats = await App.api("/api/categories");
      categoriesCache = cats.categories;
      const sel = $("#filterCat");
      categoriesCache.forEach((cat) => {
        const o = document.createElement("option");
        o.value = cat.id;
        o.textContent = cat.name;
        sel.appendChild(o);
      });
      sel.addEventListener("change", () => {
        renderPhones($("#globalSearch").value);
      });
      const url = "/api/phones" + (query ? "?q=" + encodeURIComponent(query) : "");
      const data = await App.api(url + (sel.value ? (url.includes("?") ? "&" : "?") + "categoryId=" + sel.value : ""));
      phonesCache = data.phones;
      renderPhoneCards();
    } catch (err) {
      App.toast("Failed to load phones: " + err.message, "error");
    }
  }

  function renderPhoneCards() {
    const list = $("#phonesList");
    if (!phonesCache.length) {
      list.innerHTML =
        '<div class="card empty"><h3>No phones yet</h3><p>Add your first phone to start tracking inventory.</p></div>';
      return;
    }
    list.innerHTML =
      '<div class="grid-cards">' +
      phonesCache
        .map((p, i) => {
          const sb = App.stockBadge(p.stock);
          return `
          <div class="card phone-card">
            <div class="shine"></div>
            <div class="thumb">
              <img src="${App.phoneImg(p.imageUrl, i)}" alt="${escapeHtml(p.brand + " " + p.model)}" loading="lazy" onerror="this.src='${App.FALLBACK_PHONES[0]}'" />
              <span class="tag">${escapeHtml(p.type || "Phone")}</span>
              <span class="stock-badge ${sb.cls}">${sb.label}</span>
            </div>
            <div class="body">
              <h3>${escapeHtml(p.brand + " " + p.model)}</h3>
              <div class="sub">${escapeHtml(p.categoryName || "Uncategorized")}${p.color ? " · " + escapeHtml(p.color) : ""}</div>
              <div class="meta">
                ${p.storage ? `<span class="chip">${escapeHtml(p.storage)}</span>` : ""}
                ${p.ram ? `<span class="chip">${escapeHtml(p.ram)} RAM</span>` : ""}
                ${p.imei ? `<span class="chip">IMEI ${escapeHtml(p.imei.slice(-4))}</span>` : ""}
              </div>
              <div class="price">
                <span class="amount">${App.ghs(p.sellingPrice)}</span>
                <span class="unit">/ unit</span>
              </div>
              <div class="actions">
                ${canEdit() ? `<button class="btn btn-sm" onclick="openSaleModal('${p.id}','phone')">Sell</button>` : ""}
                ${canEdit() ? `<button class="btn btn-sm" onclick="openRestockModalById('${p.id}','phone')">Restock</button>` : ""}
                ${canEdit() ? `<button class="btn btn-sm" onclick="openPhoneModal('${p.id}')">Edit</button>` : ""}
                ${isAdmin() ? `<button class="btn btn-sm btn-danger" onclick="deletePhone('${p.id}')">×</button>` : ""}
              </div>
            </div>
          </div>
        `;
        })
        .join("") +
      "</div>";
  }

  window.openPhoneModal = async function (id) {
    const form = $("#phoneForm");
    form.reset();
    $("#phoneId").value = "";
    // populate category select
    const sel = $("#pCategory");
    sel.innerHTML = '<option value="">Uncategorized</option>';
    try {
      if (!categoriesCache.length) {
        const cats = await App.api("/api/categories");
        categoriesCache = cats.categories;
      }
      categoriesCache.forEach((c) => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.name;
        sel.appendChild(o);
      });
    } catch (e) {}

    if (id) {
      try {
        const { phone } = await App.api("/api/phones/" + id);
        $("#phoneModalTitle").textContent = "Edit Phone";
        $("#phoneId").value = phone.id;
        $("#pBrand").value = phone.brand || "";
        $("#pModel").value = phone.model || "";
        $("#pType").value = phone.type || "Smartphone";
        $("#pCategory").value = phone.categoryId || "";
        $("#pColor").value = phone.color || "";
        $("#pStorage").value = phone.storage || "";
        $("#pRam").value = phone.ram || "";
        $("#pImei").value = phone.imei || "";
        $("#pCost").value = phone.costPrice || 0;
        $("#pSell").value = phone.sellingPrice || 0;
        $("#pStock").value = phone.stock || 0;
        $("#pImage").value = phone.imageUrl || "";
        $("#pDesc").value = phone.description || "";
      } catch (e) {
        App.toast(e.message, "error");
        return;
      }
    } else {
      $("#phoneModalTitle").textContent = "Add Phone";
    }
    App.openModal("modalPhone");
  };

  async function handlePhoneSubmit(e) {
    e.preventDefault();
    const id = $("#phoneId").value;
    const payload = {
      brand: $("#pBrand").value.trim(),
      model: $("#pModel").value.trim(),
      type: $("#pType").value,
      categoryId: $("#pCategory").value || null,
      color: $("#pColor").value.trim() || null,
      storage: $("#pStorage").value.trim() || null,
      ram: $("#pRam").value.trim() || null,
      imei: $("#pImei").value.trim() || null,
      costPrice: $("#pCost").value,
      sellingPrice: $("#pSell").value,
      stock: $("#pStock").value,
      imageUrl: $("#pImage").value.trim() || null,
      description: $("#pDesc").value.trim() || null,
    };
    try {
      if (id) {
        await App.api("/api/phones/" + id, { method: "PUT", body: payload });
        App.toast("Phone updated", "success");
      } else {
        await App.api("/api/phones", { method: "POST", body: payload });
        App.toast("Phone added", "success");
      }
      App.closeModal("modalPhone");
      renderPhones();
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  window.deletePhone = async function (id) {
    if (!confirm("Delete this phone? This cannot be undone.")) return;
    try {
      await App.api("/api/phones/" + id, { method: "DELETE" });
      App.toast("Phone deleted", "success");
      renderPhones();
    } catch (err) {
      App.toast(err.message, "error");
    }
  };

  // ---------- Categories ----------
  async function renderCategories() {
    const c = $("#pageContainer");
    c.innerHTML = `
      <div class="page">
        <div class="toolbar">
          <div class="spacer"></div>
          ${isAdmin() ? '<button class="btn btn-primary" id="addCatBtn">+ Add category</button>' : ""}
        </div>
        <div id="catList"></div>
      </div>
    `;
    if (isAdmin()) $("#addCatBtn").addEventListener("click", () => openCatModal());
    try {
      const data = await App.api("/api/categories");
      categoriesCache = data.categories;
      const list = $("#catList");
      if (!categoriesCache.length) {
        list.innerHTML =
          '<div class="card empty"><h3>No categories yet</h3><p>Create categories to organize your phones.</p></div>';
        return;
      }
      list.innerHTML =
        '<div class="grid-cards">' +
        categoriesCache
          .map((cat) => {
            return `
            <div class="card phone-card">
              <div class="shine"></div>
              <div class="thumb">
                <img src="${cat.imageUrl || "https://images.pexels.com/photos/36680544/pexels-photo-36680544.jpeg?auto=compress&cs=tinysrgb&w=600"}" alt="${escapeHtml(cat.name)}" />
              </div>
              <div class="body">
                <h3>${escapeHtml(cat.name)}</h3>
                <div class="sub">${escapeHtml(cat.description || "No description")}</div>
                <div class="actions mt-3">
                  ${isAdmin() ? `<button class="btn btn-sm" onclick="openCatModal('${cat.id}')">Edit</button>` : ""}
                  ${isAdmin() ? `<button class="btn btn-sm btn-danger" onclick="deleteCat('${cat.id}')">Delete</button>` : ""}
                </div>
              </div>
            </div>
          `;
          })
          .join("") +
        "</div>";
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  window.openCatModal = function (id) {
    $("#catForm").reset();
    $("#catId").value = "";
    if (id) {
      const c = categoriesCache.find((x) => x.id === id);
      if (c) {
        $("#catModalTitle").textContent = "Edit Category";
        $("#catId").value = c.id;
        $("#catName").value = c.name || "";
        $("#catDesc").value = c.description || "";
        $("#catImage").value = c.imageUrl || "";
      }
    } else {
      $("#catModalTitle").textContent = "Add Category";
    }
    App.openModal("modalCategory");
  };

  async function handleCatSubmit(e) {
    e.preventDefault();
    const id = $("#catId").value;
    const payload = {
      name: $("#catName").value.trim(),
      description: $("#catDesc").value.trim() || null,
      imageUrl: $("#catImage").value.trim() || null,
    };
    try {
      if (id) {
        await App.api("/api/categories", { method: "PUT", body: { id, ...payload } });
        App.toast("Category updated", "success");
      } else {
        await App.api("/api/categories", { method: "POST", body: payload });
        App.toast("Category added", "success");
      }
      App.closeModal("modalCategory");
      renderCategories();
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  window.deleteCat = async function (id) {
    if (!confirm("Delete this category? Phones in it will become uncategorized.")) return;
    try {
      await App.api("/api/categories?id=" + encodeURIComponent(id), { method: "DELETE" });
      App.toast("Category deleted", "success");
      renderCategories();
    } catch (err) {
      App.toast(err.message, "error");
    }
  };

  // ---------- Spare Parts ----------
  let partsCache = [];
  async function renderParts(query) {
    const c = $("#pageContainer");
    c.innerHTML = `
      <div class="page">
        <div class="toolbar">
          <div class="spacer"></div>
          ${["admin", "shop_admin", "repairer"].includes(currentUser.role)
            ? '<button class="btn btn-primary" id="addPartBtn">+ Add part</button>'
            : ""}
        </div>
        <div id="partsList"></div>
      </div>
    `;
    const addBtn = $("#addPartBtn");
    if (addBtn) addBtn.addEventListener("click", () => openPartModal());
    try {
      const url = "/api/spare-parts" + (query ? "?q=" + encodeURIComponent(query) : "");
      const data = await App.api(url);
      partsCache = data.parts;
      renderPartCards();
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  function renderPartCards() {
    const list = $("#partsList");
    if (!partsCache.length) {
      list.innerHTML =
        '<div class="card empty"><h3>No spare parts yet</h3><p>Add parts for your repair bench.</p></div>';
      return;
    }
    const canManage = ["admin", "shop_admin", "repairer"].includes(currentUser.role);
    list.innerHTML =
      '<div class="grid-cards">' +
      partsCache
        .map((p, i) => {
          const sb = App.stockBadge(p.quantity);
          return `
          <div class="card phone-card">
            <div class="shine"></div>
            <div class="thumb">
              <img src="${App.partImg(p.imageUrl, i)}" alt="${escapeHtml(p.partName)}" onerror="this.src='${App.FALLBACK_PARTS[0]}'" />
              <span class="tag">${escapeHtml(p.sku || "Part")}</span>
              <span class="stock-badge ${sb.cls}">${sb.label}</span>
            </div>
            <div class="body">
              <h3>${escapeHtml(p.partName)}</h3>
              <div class="sub">Fits: ${escapeHtml(p.compatibleModels || "Universal")}</div>
              <div class="price">
                <span class="amount">${App.ghs(p.sellingPrice)}</span>
                <span class="unit">/ unit</span>
              </div>
              <div class="actions">
                ${canManage ? `<button class="btn btn-sm" onclick="openSaleModal('${p.id}','part')">Sell</button>` : ""}
                ${canManage ? `<button class="btn btn-sm" onclick="openRestockModalById('${p.id}','part')">Restock</button>` : ""}
                ${canManage ? `<button class="btn btn-sm" onclick="openPartModal('${p.id}')">Edit</button>` : ""}
                ${isAdmin() ? `<button class="btn btn-sm btn-danger" onclick="deletePart('${p.id}')">×</button>` : ""}
              </div>
            </div>
          </div>
        `;
        })
        .join("") +
      "</div>";
  }

  window.openPartModal = async function (id) {
    $("#partForm").reset();
    $("#partId").value = "";
    if (id) {
      const p = partsCache.find((x) => x.id === id);
      if (!p) {
        try {
          const data = await App.api("/api/spare-parts?q=");
          const found = data.parts.find((x) => x.id === id);
          if (found) fillPartForm(found);
        } catch (e) {}
      } else {
        fillPartForm(p);
      }
      $("#partModalTitle").textContent = "Edit Spare Part";
    } else {
      $("#partModalTitle").textContent = "Add Spare Part";
    }
    App.openModal("modalPart");
  };
  function fillPartForm(p) {
    $("#partId").value = p.id;
    $("#partName").value = p.partName || "";
    $("#partCompat").value = p.compatibleModels || "";
    $("#partSku").value = p.sku || "";
    $("#partQty").value = p.quantity || 0;
    $("#partCost").value = p.costPrice || 0;
    $("#partSell").value = p.sellingPrice || 0;
    $("#partImage").value = p.imageUrl || "";
    $("#partDesc").value = p.description || "";
  }
  async function handlePartSubmit(e) {
    e.preventDefault();
    const id = $("#partId").value;
    const payload = {
      partName: $("#partName").value.trim(),
      compatibleModels: $("#partCompat").value.trim() || null,
      sku: $("#partSku").value.trim() || null,
      quantity: $("#partQty").value,
      costPrice: $("#partCost").value,
      sellingPrice: $("#partSell").value,
      imageUrl: $("#partImage").value.trim() || null,
      description: $("#partDesc").value.trim() || null,
    };
    try {
      if (id) {
        await App.api("/api/spare-parts", { method: "PUT", body: { id, ...payload } });
        App.toast("Part updated", "success");
      } else {
        await App.api("/api/spare-parts", { method: "POST", body: payload });
        App.toast("Part added", "success");
      }
      App.closeModal("modalPart");
      renderParts();
    } catch (err) {
      App.toast(err.message, "error");
    }
  }
  window.deletePart = async function (id) {
    if (!confirm("Delete this part?")) return;
    try {
      await App.api("/api/spare-parts?id=" + encodeURIComponent(id), { method: "DELETE" });
      App.toast("Part deleted", "success");
      renderParts();
    } catch (err) {
      App.toast(err.message, "error");
    }
  };

  // ---------- Sale modal ----------
  window.openSaleModal = async function (id, type) {
    $("#saleForm").reset();
    $("#saleItemId").value = id;
    $("#saleItemType").value = type;
    try {
      let info = "";
      let price = 0;
      let stock = 0;
      if (type === "phone") {
        const { phone } = await App.api("/api/phones/" + id);
        info = phone.brand + " " + phone.model + " · Stock: " + phone.stock;
        price = phone.sellingPrice;
        stock = phone.stock;
      } else {
        const part = partsCache.find((p) => p.id === id);
        if (part) {
          info = part.partName + " · Stock: " + part.quantity;
          price = part.sellingPrice;
          stock = part.quantity;
        } else {
          const data = await App.api("/api/spare-parts");
          const found = data.parts.find((p) => p.id === id);
          info = found.partName + " · Stock: " + found.quantity;
          price = found.sellingPrice;
          stock = found.quantity;
        }
      }
      if (stock <= 0) {
        App.toast("This item is out of stock", "error");
        return;
      }
      $("#saleItemInfo").textContent = info;
      $("#salePrice").value = price;
      $("#saleQty").max = stock;
      App.openModal("modalSale");
    } catch (err) {
      App.toast(err.message, "error");
    }
  };
  async function handleSaleSubmit(e) {
    e.preventDefault();
    const payload = {
      quantity: Number($("#saleQty").value) || 1,
      unitPrice: $("#salePrice").value,
      customerName: $("#saleCustomer").value.trim() || null,
      customerPhone: $("#saleCustomerPhone").value.trim() || null,
      paymentMethod: $("#salePayment").value,
      note: $("#saleNote").value.trim() || null,
    };
    const type = $("#saleItemType").value;
    if (type === "phone") payload.phoneId = $("#saleItemId").value;
    else payload.partId = $("#saleItemId").value;
    try {
      const res = await App.api("/api/sales", { method: "POST", body: payload });
      App.toast("Sale recorded · " + App.ghs(res.sale.total), "success");
      App.closeModal("modalSale");
      if (currentPage === "phones") renderPhones();
      else if (currentPage === "parts") renderParts();
      else if (currentPage === "sales") renderSales();
      else if (currentPage === "dashboard") renderDashboard();
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  // ---------- Restock modal ----------
  window.openRestockModalById = async function (id, type) {
    try {
      let name = "",
        stock = 0;
      if (type === "phone") {
        const { phone } = await App.api("/api/phones/" + id);
        name = phone.brand + " " + phone.model;
        stock = phone.stock;
      } else {
        const part = partsCache.find((p) => p.id === id);
        if (part) {
          name = part.partName;
          stock = part.quantity;
        } else {
          const data = await App.api("/api/spare-parts");
          const f = data.parts.find((p) => p.id === id);
          name = f.partName;
          stock = f.quantity;
        }
      }
      openRestockModal(id, type, name, stock);
    } catch (err) {
      App.toast(err.message, "error");
    }
  };
  function openRestockModal(id, type, name, stock) {
    $("#restockForm").reset();
    $("#rsItemId").value = id;
    $("#rsItemType").value = type;
    $("#rsItemInfo").textContent = name + " · Current stock: " + stock;
    App.openModal("modalRestock");
  }
  async function handleRestockSubmit(e) {
    e.preventDefault();
    const payload = {
      itemType: $("#rsItemType").value,
      itemId: $("#rsItemId").value,
      quantity: $("#rsQty").value,
      unitCost: $("#rsCost").value,
      note: $("#rsNote").value.trim() || null,
    };
    try {
      await App.api("/api/restock", { method: "POST", body: payload });
      App.toast("Restocked", "success");
      App.closeModal("modalRestock");
      if (currentPage === "phones") renderPhones();
      else if (currentPage === "parts") renderParts();
      else if (currentPage === "restock") renderRestock();
      else if (currentPage === "dashboard") renderDashboard();
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  // ---------- Sales page ----------
  async function renderSales() {
    const c = $("#pageContainer");
    c.innerHTML = `
      <div class="page">
        <div class="toolbar">
          <div class="spacer"></div>
          <button class="btn" id="exportSalesBtn">Export CSV</button>
        </div>
        <div class="card" style="padding:0">
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Date</th><th>Item</th><th>Customer</th><th>Qty</th><th>Unit</th><th>Total</th><th>Method</th><th>By</th></tr></thead>
              <tbody id="salesBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    $("#exportSalesBtn").addEventListener("click", async () => {
      try {
        const res = await fetch("/api/export?type=sales", { headers: App.authHeaders() });
        const text = await res.text();
        App.downloadText(text, "sales.csv", "text/csv");
        App.toast("Sales exported", "success");
      } catch (e) {
        App.toast(e.message, "error");
      }
    });
    try {
      const data = await App.api("/api/sales");
      const body = $("#salesBody");
      if (!data.sales.length) {
        body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-dim)">No sales yet</td></tr>';
        return;
      }
      // Get phone/part details in parallel
      const phoneIds = [...new Set(data.sales.filter((s) => s.phoneId).map((s) => s.phoneId))];
      const phoneMap = {};
      for (const id of phoneIds) {
        try {
          const { phone } = await App.api("/api/phones/" + id);
          phoneMap[id] = phone.brand + " " + phone.model;
        } catch (e) {
          phoneMap[id] = "Phone";
        }
      }
      const partData = await App.api("/api/spare-parts");
      const partMap = {};
      partData.parts.forEach((p) => (partMap[p.id] = p.partName));

      body.innerHTML = data.sales
        .map((s) => {
          const item = s.phoneId
            ? phoneMap[s.phoneId] || "Phone"
            : s.partId
            ? partMap[s.partId] || "Part"
            : "Item";
          return `
          <tr>
            <td>${App.timeAgo(s.soldAt)}</td>
            <td>${escapeHtml(item)}</td>
            <td>${escapeHtml(s.customerName || "-")}${s.customerPhone ? "<br/><small class='text-dim'>" + escapeHtml(s.customerPhone) + "</small>" : ""}</td>
            <td>${s.quantity}</td>
            <td>${App.ghs(s.unitPrice)}</td>
            <td><strong>${App.ghs(s.total)}</strong></td>
            <td><span class="chip">${escapeHtml(s.paymentMethod || "Cash")}</span></td>
            <td class="text-dim text-sm">${s.userId ? s.userId.slice(0, 6) : "-"}</td>
          </tr>
        `;
        })
        .join("");
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  // ---------- Restock page ----------
  async function renderRestock() {
    const c = $("#pageContainer");
    c.innerHTML = `
      <div class="page">
        <div class="card" style="padding:0">
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Qty</th><th>Unit cost</th><th>Note</th></tr></thead>
              <tbody id="rsBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    try {
      const data = await App.api("/api/restock");
      const body = $("#rsBody");
      if (!data.restocks.length) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim)">No restocks yet</td></tr>';
        return;
      }
      body.innerHTML = data.restocks
        .map(
          (r) => `
          <tr>
            <td>${App.timeAgo(r.createdAt)}</td>
            <td><code>${escapeHtml(r.itemId.slice(0, 8))}</code></td>
            <td><span class="chip">${r.itemType}</span></td>
            <td>+${r.quantity}</td>
            <td>${App.ghs(r.unitCost)}</td>
            <td class="text-dim">${escapeHtml(r.note || "-")}</td>
          </tr>
        `
        )
        .join("");
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  // ---------- Users ----------
  let usersCache = [];
  async function renderUsers() {
    const c = $("#pageContainer");
    c.innerHTML = `
      <div class="page">
        <div class="toolbar">
          <div class="spacer"></div>
          <button class="btn btn-primary" id="addUserBtn">+ Add user</button>
        </div>
        <div class="card" style="padding:0">
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="usersBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    $("#addUserBtn").addEventListener("click", () => openUserModal());
    try {
      const data = await App.api("/api/users");
      usersCache = data.users;
      const body = $("#usersBody");
      if (!usersCache.length) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim)">No users</td></tr>';
        return;
      }
      body.innerHTML = usersCache
        .map(
          (u) => `
          <tr>
            <td>${escapeHtml(u.fullName)}</td>
            <td><code>${escapeHtml(u.username)}</code></td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="badge badge-${u.role}">${App.ROLE_LABELS[u.role] || u.role}</span></td>
            <td>${u.active ? '<span class="chip">Active</span>' : '<span class="chip" style="color:#fca5a5">Disabled</span>'}</td>
            <td>
              <button class="btn btn-sm" onclick="toggleUser('${u.id}', ${!u.active})">${u.active ? "Disable" : "Enable"}</button>
              ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">Delete</button>` : ""}
            </td>
          </tr>
        `
        )
        .join("");
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  window.openUserModal = function () {
    $("#userForm").reset();
    $("#uId").value = "";
    $("#userModalTitle").textContent = "Add User";
    App.openModal("modalUser");
  };
  async function handleUserSubmit(e) {
    e.preventDefault();
    const payload = {
      fullName: $("#uFullName").value.trim(),
      username: $("#uUsername").value.trim(),
      email: $("#uEmail").value.trim(),
      password: $("#uPassword").value,
      role: $("#uRole").value,
    };
    if (!payload.password) {
      App.toast("Password required", "error");
      return;
    }
    try {
      await App.api("/api/users", { method: "POST", body: payload });
      App.toast("User created", "success");
      App.closeModal("modalUser");
      renderUsers();
    } catch (err) {
      App.toast(err.message, "error");
    }
  }
  window.toggleUser = async function (id, active) {
    try {
      await App.api("/api/users", { method: "PUT", body: { id, active } });
      App.toast("User updated", "success");
      renderUsers();
    } catch (err) {
      App.toast(err.message, "error");
    }
  };
  window.deleteUser = async function (id) {
    if (!confirm("Delete this user?")) return;
    try {
      await App.api("/api/users?id=" + encodeURIComponent(id), { method: "DELETE" });
      App.toast("User deleted", "success");
      renderUsers();
    } catch (err) {
      App.toast(err.message, "error");
    }
  };

  // ---------- Logs ----------
  async function renderLogs() {
    const c = $("#pageContainer");
    c.innerHTML = `
      <div class="page">
        <div class="card">
          <div class="chart-title">Recent activity</div>
          <div id="logsList"></div>
        </div>
      </div>
    `;
    try {
      const stats = await App.api("/api/stats");
      const list = $("#logsList");
      const logs = stats.recentActivity || [];
      if (!logs.length) {
        list.innerHTML = '<div class="empty"><p>No activity yet.</p></div>';
        return;
      }
      list.innerHTML =
        '<div class="table-wrap mt-3"><table class="data"><thead><tr><th>When</th><th>Action</th><th>Details</th></tr></thead><tbody>' +
        logs
          .map(
            (l) =>
              `<tr><td>${App.timeAgo(l.createdAt)}</td><td><span class="chip">${escapeHtml(l.action)}</span></td><td>${escapeHtml(l.details || "-")}</td></tr>`
          )
          .join("") +
        "</tbody></table></div>";
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  // ---------- Backup ----------
  async function renderBackup() {
    const c = $("#pageContainer");
    c.innerHTML = `
      <div class="page">
        <div class="hero-banner">
          <div class="morph"></div>
          <h2>Data protection</h2>
          <p>Backup, restore, and export your shop data at any time. Backups are saved as JSON files you can store anywhere.</p>
        </div>
        <div class="stats-grid">
          <div class="card">
            <div class="chart-title">Create backup</div>
            <p class="text-dim text-sm">Download a complete backup of all your data as a JSON file.</p>
            <button class="btn btn-primary mt-3" id="backupBtn">Download backup</button>
          </div>
          <div class="card">
            <div class="chart-title">Restore from backup</div>
            <p class="text-dim text-sm">Upload a previously saved backup file to restore data.</p>
            <button class="btn btn-accent mt-3" id="restoreBtn">Upload &amp; restore</button>
          </div>
          <div class="card">
            <div class="chart-title">Export data</div>
            <p class="text-dim text-sm">Export individual datasets as CSV for spreadsheets.</p>
            <div class="flex gap-2 flex-wrap mt-3">
              <button class="btn btn-sm" data-export="phones">Phones</button>
              <button class="btn btn-sm" data-export="parts">Spare parts</button>
              <button class="btn btn-sm" data-export="sales">Sales</button>
            </div>
          </div>
        </div>
      </div>
    `;
    $("#backupBtn").addEventListener("click", async () => {
      try {
        const res = await fetch("/api/backup", { headers: App.authHeaders() });
        if (!res.ok) throw new Error("Backup failed");
        const text = await res.text();
        App.downloadText(text, "phoneshop-backup-" + Date.now() + ".json", "application/json");
        App.toast("Backup downloaded", "success");
      } catch (e) {
        App.toast(e.message, "error");
      }
    });
    $("#restoreBtn").addEventListener("click", () => App.openModal("modalRestore"));
    $$("[data-export]").forEach((b) => {
      b.addEventListener("click", async () => {
        const type = b.getAttribute("data-export");
        try {
          const res = await fetch("/api/export?type=" + type, { headers: App.authHeaders() });
          const text = await res.text();
          App.downloadText(text, type + ".csv", "text/csv");
          App.toast(type + " exported", "success");
        } catch (e) {
          App.toast(e.message, "error");
        }
      });
    });
  }

  async function handleRestoreSubmit(e) {
    e.preventDefault();
    const file = $("#rsFile").files[0];
    const mode = $("#rsMode").value;
    if (!file) return;
    if (mode === "replace" && !confirm("This will DELETE all current data. Continue?")) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await App.api("/api/backup", { method: "POST", body: { data, mode } });
      App.toast("Restore complete: " + JSON.stringify(res.restored), "success");
      App.closeModal("modalRestore");
      if (currentPage === "dashboard") renderDashboard();
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  // ---------- Helpers ----------
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.addEventListener("DOMContentLoaded", boot);
})();
