async function loadApp() {
  // --- Fetch JSON data ---
  const [productsRes, purchasesRes, crmRes] = await Promise.all([
    fetch('data/products.json'),
    fetch('data/purchasing.json'),
    fetch('data/customer-contacts.json') // CRM JSON
  ]);

  const products = await productsRes.json();
  const purchases = await purchasesRes.json();
  const crmCustomers = await crmRes.json(); // CRM data array
 
function buildCRMUI() {
  const container = document.getElementById('crmContainer');
  container.innerHTML = `
    <div style="max-width:450px;margin-bottom:15px;">
      <input 
        id="crmSearchInput" 
        type="text" 
        placeholder="Search customer name, ID, or email…" 
        style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;font-size:16px;">
    </div>

    <div id="crmSearchResults" 
      style="border:1px solid #ddd;border-radius:6px;background:#fff;max-width:450px;display:none;
             max-height:300px; overflow-y:auto;">
    </div>

    <div id="crmProfile" style="margin-top:20px;"></div>
  `;

  const searchInput = document.getElementById('crmSearchInput');
  const resultsBox = document.getElementById('crmSearchResults');
  const profileBox = document.getElementById('crmProfile');

  // --- Normalize strings for robust searching ---
  function normalize(str) {
    return (str || '').toLowerCase().trim();
  }

  // === Live Search ===
  searchInput.addEventListener('input', () => {
    const q = normalize(searchInput.value);
    profileBox.innerHTML = ''; // Clear profile when typing

    if (q.length < 2) {
      resultsBox.style.display = 'none';
      resultsBox.innerHTML = '';
      return;
    }

    // --- Filter customers for substring match anywhere in name/ID/email ---
    const matches = crmCustomers.filter(c =>
      normalize(c["Customer"]).includes(q) ||
      normalize(c["Customer ID"]).includes(q) ||
      normalize(c["Main Email"]).includes(q)
    ).slice(0, 50); // show up to 50 matches

    if (!matches.length) {
      resultsBox.style.display = 'block';
      resultsBox.innerHTML = `<div style="padding:10px;color:#999;">No matches found.</div>`;
      return;
    }

    resultsBox.style.display = 'block';
    resultsBox.innerHTML = matches.map(c => `
      <div 
        class="crm-result-item"
        data-id="${c["Customer ID"]}"
        style="padding:10px;border-bottom:1px solid #eee;cursor:pointer;">
        <strong>${c["Customer"]}</strong><br>
        <span style="font-size:13px;color:#555;">${c["Main Email"] || ''}</span>
      </div>
    `).join('');

    // === Click to open profile ===
    document.querySelectorAll('.crm-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const custId = item.getAttribute('data-id');
        const cust = crmCustomers.find(c => c["Customer ID"] === custId);

        if (!cust) return;

        searchInput.value = item.textContent.trim();
        resultsBox.style.display = 'none';

        profileBox.innerHTML = renderCRMProfile(cust);
      });
    });
  });
}


// -------------------------------------------------------
// CUSTOMER PROFILE PANEL
// -------------------------------------------------------

function renderCRMProfile(c) {
  const rows = Object.keys(c).map(key => `
    <tr>
      <td style="font-weight:600;padding:8px 10px;width:180px;">${key}</td>
      <td style="padding:8px 10px;">${c[key] || ''}</td>
    </tr>
  `).join('');

  return `
    <div class="card" style="padding:20px;">
      <h2 style="margin-top:0;margin-bottom:15px;">${c["Customer"]}</h2>
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
    </div>
  `;
}

  // --- Utilities ---
  function toMoney(n) { return Number(n || 0).toFixed(2); }
  function escapeHtml(str) {
    return str?.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])) || '';
  }

  // --- Elements ---
  const tabs = {
    products: document.getElementById('productsTab'),
    customers: document.getElementById('customersTab'),
    crm: document.getElementById('crmTab'),
    invoices: document.getElementById('invoicesTab'),
    types: document.getElementById('typesTab'),
    vendors: document.getElementById('vendorsTab'),
    purchasing: document.getElementById('purchasingTab')
  };

  const sections = {
    products: document.getElementById('productsSection'),
    customers: document.getElementById('customersSection'),
    crm: document.getElementById('crmSection'),
    invoices: document.getElementById('invoicesSection'),
    types: document.getElementById('typesSection'),
    vendors: document.getElementById('vendorsSection'),
    purchasing: document.getElementById('purchasingSection')
  };

  const productFilters = document.getElementById('productFilters');

  // --- Tab switching ---
  function showSection(name) {
    Object.values(sections).forEach(s => s.classList.remove('active'));
    Object.values(tabs).forEach(t => t.classList.remove('active'));
    sections[name].classList.add('active');
    tabs[name].classList.add('active');
    productFilters.style.display = (name === 'products') ? 'flex' : 'none';

    switch(name) {
      case 'customers': buildCustomerUI(products); break;
      case 'crm': buildCRMUI(); break;
      case 'invoices': buildInvoiceUI(); break;
      case 'types': buildTypesUI(); break;
      case 'vendors': buildVendorUI(); break;
      case 'purchasing': buildPurchasingSuggestionUI(products, purchases); break;
    }
  }

  Object.keys(tabs).forEach(key => {
    tabs[key].addEventListener('click', () => showSection(key));
  });

  showSection('products'); // default tab


function buildPurchasingSuggestionUI(products, purchases) {
  const section = sections.purchasing;
  const now = new Date();
  const days = [30, 60, 90].map(d => { const dt = new Date(now); dt.setDate(now.getDate() - d); return dt; });

  // --- Helper to sanitize numbers ---
  const cleanNumber = n => Number(Number(n || 0).toFixed(2));

  // --- Sanitize input data ---
  products = products.map(p => ({ ...p, qty: cleanNumber(p.qty), cost: cleanNumber(p.cost) }));
  purchases = purchases.map(p => ({ ...p, qty: cleanNumber(p.qty), cost: cleanNumber(p.cost) }));

  // --- Aggregate sales per SKU ---
  const skuSales = {};
  products.forEach(p => {
    const saleDate = new Date(p.date);
    if (!skuSales[p.sku]) skuSales[p.sku] = { description: p.description, last30: 0, prev30: 0, prev60: 0 };

    if (saleDate >= days[0]) skuSales[p.sku].last30 += p.qty;
    else if (saleDate >= days[1]) skuSales[p.sku].prev30 += p.qty;
    else if (saleDate >= days[2]) skuSales[p.sku].prev60 += p.qty;
  });

  // --- Sanitize totals ---
  Object.values(skuSales).forEach(s => {
    s.last30 = cleanNumber(s.last30);
    s.prev30 = cleanNumber(s.prev30);
    s.prev60 = cleanNumber(s.prev60);
  });

  // --- Merge with purchases ---
  const skuPurchases = {};
  purchases.forEach(p => {
    if (!skuPurchases[p.sku]) skuPurchases[p.sku] = [];
    skuPurchases[p.sku].push({ date: p.date, qty: p.qty, cost: p.cost, vendor: p.vendor });
  });

  // --- Weighted suggestion ---
  const leadTime = 3;
  const safetyStock = 5;
  const rows = Object.keys(skuSales).map(sku => {
    const s = skuSales[sku];
    const weightedDaily = cleanNumber(((s.last30 * 0.5) + (s.prev30 * 0.3) + (s.prev60 * 0.2)) / 30);
    const suggestedQty = Math.max(Math.round(weightedDaily * leadTime + safetyStock), 0);

    let lastPurchase = { cost: 0, vendor: '' };
    if (skuPurchases[sku]?.length) {
      skuPurchases[sku].sort((a,b) => new Date(b.date) - new Date(a.date));
      lastPurchase = { cost: cleanNumber(skuPurchases[sku][0].cost), vendor: skuPurchases[sku][0].vendor || '' };
    }

    return { sku, ...s, suggestedQty, adjustedQty: suggestedQty, ...lastPurchase };
  });

  // --- Render table ---
  section.innerHTML = `
    <h3>Purchasing Suggestions</h3>
    <table class="breakdown-table purchasing-table">
      <thead>
        <tr>
          <th data-key="sku">SKU</th>
          <th data-key="description">Description</th>
          <th data-key="last30">Last 30d</th>
          <th data-key="prev30">Prior 30d</th>
          <th data-key="prev60">Prev 30d</th>
          <th data-key="suggestedQty">Suggested Qty</th>
          <th data-key="adjustedQty">Adjusted Qty</th>
          <th data-key="cost">Last Cost</th>
          <th data-key="vendor">Last Vendor</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.sku}</td>
            <td>${r.description}</td>
            <td style="text-align:right;">${r.last30.toFixed(2)}</td>
            <td style="text-align:right;">${r.prev30.toFixed(2)}</td>
            <td style="text-align:right;">${r.prev60.toFixed(2)}</td>
            <td style="text-align:right;">${r.suggestedQty}</td>
            <td style="text-align:right;"><input type="number" value="${r.adjustedQty}" style="width:60px;"></td>
            <td style="text-align:right;">$${r.cost.toFixed(2)}</td>
            <td>${r.vendor}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // --- Sorting ---
  const table = section.querySelector('table');
  const state = { rows, sort: { key: null, asc: true } };
  table.querySelectorAll('th').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      state.sort.asc = state.sort.key === key ? !state.sort.asc : true;
      state.sort.key = key;
      state.rows.sort((a,b) => {
        if (typeof a[key] === 'string') return state.sort.asc ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]);
        return state.sort.asc ? a[key]-b[key] : b[key]-a[key];
      });
      const tbody = table.querySelector('tbody');
      tbody.innerHTML = state.rows.map(r => `
        <tr>
          <td>${r.sku}</td>
          <td>${r.description}</td>
          <td style="text-align:right;">${r.last30.toFixed(2)}</td>
          <td style="text-align:right;">${r.prev30.toFixed(2)}</td>
          <td style="text-align:right;">${r.prev60.toFixed(2)}</td>
          <td style="text-align:right;">${r.suggestedQty}</td>
          <td style="text-align:right;"><input type="number" value="${r.adjustedQty}" style="width:60px;"></td>
          <td style="text-align:right;">$${r.cost.toFixed(2)}</td>
          <td>${r.vendor}</td>
        </tr>
      `).join('');
    });
  });
}

/// --- PRODUCTS TAB: SKU × Type Price Range Table ---
let productBreakdownState = { rows: [], sort: { key: null, asc: true } };
let productsTableSort = { key: 'sku', asc: true };

// --- FIXED TYPE ORDER (GLOBAL) ---
const FIXED_TYPE_ORDER = [
  "end user - food service",
  "end user - parlor",
  "end user - hospitality",
  "end user - schools",
  "end user - clubhouse",
  "end user - church",
  "end user - golf course",
  "end user - car dealers",
  "reseller no-wareh",
  "reseller special",
  "reseller strategic",
  "GENERAL"
  "Unknown"
];

// --- UTILITIES ---
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function toMoney(value) {
  return Number(value || 0).toFixed(2);
}

function highlightTerm(text, term) {
  if (!term) return escapeHtml(text);
  const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return escapeHtml(text).replace(re, '<mark>$1</mark>');
}

// --- DEDUPLICATE PRODUCTS BY SKU & COLLECT TYPE PRICES ---
function getUniqueProductsBySKU(products, purchases = [], cutoffDate = null) {
  const skuMap = new Map();

  products.forEach(p => {
    const pDate = new Date(p.date);
    if (isNaN(pDate)) return;

    const existing = skuMap.get(p.sku);

    // Store latest description
    if (!existing || pDate > existing._date) {
      // Get Cost from purchases.json by SKU (sum or latest, your choice)
      const costEntry = purchases.find(c => c.sku === p.sku);
      const cost = costEntry ? Number(costEntry.cost) || 0 : 0;

      skuMap.set(p.sku, {
        sku: p.sku,
        description: p.description,
        _date: pDate,
        typePrices: {}, // { type: [prices] }
        cost: cost
      });
    }

    const skuObj = skuMap.get(p.sku);

    if (!skuObj.typePrices[p.type]) skuObj.typePrices[p.type] = [];
    skuObj.typePrices[p.type].push(Number(p.price) || 0);
  });

  // Clean up internal `_date`
  return {
    uniqueList: [...skuMap.values()].map(p => {
      delete p._date;
      return p;
    })
  };
}

// --- RENDER PRODUCTS TABLE ---
function renderProductsTable(list, purchases = [], searchTerm = '') {
  if (!list || !list.length) {
    resultsContainer.innerHTML = `<p>No products found for "<strong>${escapeHtml(searchTerm)}</strong>".</p>`;
    return;
  }

  // Get SKU-level consolidated pricing data including Cost
  const { uniqueList } = getUniqueProductsBySKU(list, purchases);

  // Sort products table
  if (productsTableSort.key) {
    const key = productsTableSort.key;
    const asc = productsTableSort.asc;
    uniqueList.sort((a, b) => {
      if (key === 'sku') return asc ? a.sku.localeCompare(b.sku) : b.sku.localeCompare(a.sku);
      if (key === 'description') return asc ? a.description.localeCompare(b.description) : b.description.localeCompare(a.description);
      if (key === 'cost') return asc ? a.cost - b.cost : b.cost - a.cost;
      return 0;
    });
  }

  const allTypesSorted = [...FIXED_TYPE_ORDER];

  const typeHeaders = allTypesSorted
    .map(t => `<th data-key="${t}">${escapeHtml(t)}</th>`)
    .join('');

  resultsContainer.innerHTML = `
    <h2>Search Results for "<strong>${escapeHtml(searchTerm)}</strong>"</h2>
    <table class="products-table" style="width:100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th data-key="sku">SKU</th>
          <th data-key="description">Last Description</th>
          <th data-key="cost">Cost</th>
          ${typeHeaders}
        </tr>
      </thead>
      <tbody>
        ${uniqueList.map(p => {
          const typeCols = allTypesSorted.map(type => {
            const prices = p.typePrices[type] || [];
            if (!prices.length) return `<td>-</td>`;
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            return `<td style="text-align:right;">$${toMoney(minPrice)} - $${toMoney(maxPrice)}</td>`;
          }).join('');

          return `
          <tr data-sku="${escapeHtml(p.sku)}" style="cursor:pointer;">
            <td>${escapeHtml(p.sku)}</td>
            <td>${highlightTerm(p.description, searchTerm)}</td>
            <td style="text-align:right;">$${toMoney(p.cost)}</td>
            ${typeCols}
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  attachProductsTableHandlers(searchTerm, allTypesSorted);
}

// --- CLICK HANDLERS / SORT HANDLERS ---
function attachProductsTableHandlers(searchTerm, typeColumns) {
  // Row click -> breakdown
  document.querySelectorAll('.products-table tbody tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const sku = tr.dataset.sku;
      const description = tr.dataset.description;
      const skuProducts = products.filter(p => p.sku === sku);
      const breakdown = getProductMonthlyBreakdown(skuProducts);

      productBreakdownState.rows = breakdown;
      productBreakdownState.sort = { key: null, asc: true };

      renderProductBreakdownTable(breakdown, sku, description, searchTerm);
    });
  });

  // Column sort for SKU, description, and cost
  document.querySelectorAll('.products-table th').forEach(th => {
    const key = th.dataset.key;
    if (key === 'sku' || key === 'description' || key === 'cost') {
      th.style.cursor = 'pointer';
      th.onclick = () => {
        productsTableSort.asc = productsTableSort.key === key ? !productsTableSort.asc : true;
        productsTableSort.key = key;

        const term = searchTerm.toLowerCase();
        const filtered = products.filter(p => {
          const d = (p.description || '').toLowerCase();
          const s = (p.sku || '').toLowerCase();
          return d.includes(term) || s.includes(term);
        });

        renderProductsTable(filtered, purchases, searchTerm);
      };
    }
  });
}

// --- SEARCH LISTENER ---
searchInput.addEventListener("input", () => {
  const term = searchInput.value.trim().toLowerCase();

  if (!term) {
    resultsContainer.innerHTML = `<p>Type a product keyword to search.</p>`;
    return;
  }

  const filtered = products.filter(p => {
    const desc = (p.description || '').toLowerCase();
    const sku  = (p.sku || '').toLowerCase();
    return desc.includes(term) || sku.includes(term);
  });

  renderProductsTable(filtered, purchases, term);
});

// --- BREAKDOWN LOGIC ---
function getProductMonthlyBreakdown(list) {
  const grouped = {};

  list.forEach(p => {
    const d = new Date(p.date);
    if (isNaN(d)) return;

    const month = d.toLocaleString('default', { month:'short', year:'numeric' });
    const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const key = `${p.customer}_${monthKey}`;

    if (!grouped[key]) {
      grouped[key] = {
        customer: p.customer,
        month,
        monthKey,
        totalQty: 0,
        lastPrice: 0,
        latestDate: null
      };
    }

    grouped[key].totalQty += Number(p.qty) || 0;

    if (!grouped[key].latestDate || d > grouped[key].latestDate) {
      grouped[key].latestDate = d;
      grouped[key].lastPrice = Number(p.price) || 0;
    }
  });

  return Object.values(grouped);
}

// --- BREAKDOWN TABLE ---
function renderProductBreakdownTable(data, skuForTitle, searchTerm = '') {
  if (!data.length) {
    resultsContainer.innerHTML = `<p>No breakdown data for ${escapeHtml(skuForTitle)}</p>`;
    return;
  }

  resultsContainer.innerHTML = `
    <button id="backToProducts" style="margin-bottom:10px;">← Back to Results</button>
    <h3>Monthly Breakdown for SKU: ${escapeHtml(skuForTitle)}</h3>

    <table class="breakdown-table product-table" style="width:100%">
      <thead>
        <tr>
          <th data-key="customer">Customer</th>
          <th data-key="month">Month</th>
          <th data-key="totalQty">Last Qty</th>
          <th data-key="lastPrice">Last Price</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(r => `
          <tr>
            <td>${escapeHtml(r.customer)}</td>
            <td>${escapeHtml(r.month)}</td>
            <td style="text-align:right;">${r.totalQty}</td>
            <td style="text-align:right;">$${toMoney(r.lastPrice)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;

  document.querySelector('#backToProducts').onclick = () => {
    const term = searchTerm.toLowerCase();
    const filtered = products.filter(p => {
      const d = (p.description || '').toLowerCase();
      const s = (p.sku || '').toLowerCase();
      return d.includes(term) || s.includes(term);
    });

    renderProductsTable(filtered, purchases, searchTerm);
  };

  attachProductTableSortHandlers();
}

// --- BREAKDOWN SORTING ---
function attachProductTableSortHandlers() {
  document.querySelectorAll('.product-table th').forEach(th => {
    th.style.cursor = 'pointer';
    th.onclick = () => {
      const key = th.dataset.key;
      productBreakdownState.sort.asc =
        productBreakdownState.sort.key === key ? !productBreakdownState.sort.asc : true;

      productBreakdownState.sort.key = key;
      const asc = productBreakdownState.sort.asc;

      const sorted = [...productBreakdownState.rows].sort((a, b) => {
        if (key === 'month') {
          return asc ? a.monthKey.localeCompare(b.monthKey) : b.monthKey.localeCompare(a.monthKey);
        }
        if (typeof a[key] === 'string') {
          return asc ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]);
        }
        return asc ? a[key] - b[key] : b[key] - a[key];
      });

      productBreakdownState.rows = sorted;
      renderProductBreakdownTable(sorted, '', '');
    };
  });
}

// --- INITIAL PROMPT ---
resultsContainer.innerHTML = `<p>Type a product keyword to search.</p>`;

  // --- CUSTOMERS TAB ---
  let customerBreakdownState = { rows: [], sort: { key:null, asc:true } };

  function buildCustomerUI() {
    customerContainer.innerHTML = '';
    const wrapper = document.createElement('div'); wrapper.className = 'customer-controls';

    const label = document.createElement('label');
    label.innerHTML = 'Select Customer: ';
    const select = document.createElement('select'); select.id = 'customerSelect';
    select.innerHTML = `<option value="">Select Customer</option>` + [...new Set(products.map(p => p.customer))].sort().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    label.appendChild(select);
    wrapper.appendChild(label);

    const filter = document.createElement('input'); filter.id = 'customerFilter'; filter.placeholder = 'Filter by product description...'; filter.style.marginLeft = '10px';
    wrapper.appendChild(filter);

    const results = document.createElement('div'); results.id = 'customerResults'; results.style.marginTop = '1rem';
    customerContainer.appendChild(wrapper); customerContainer.appendChild(results);

    select.addEventListener('change', renderCustomerTable);
    filter.addEventListener('input', renderCustomerTable);
  }

  function renderCustomerTable() {
    const selected = document.getElementById('customerSelect').value;
    const filterTerm = (document.getElementById('customerFilter').value || '').trim().toLowerCase();
    const resultsDiv = document.getElementById('customerResults');

    if (!selected) { resultsDiv.innerHTML = '<p>Select a customer to show purchase breakdown.</p>'; return; }

    const custProducts = products.filter(p => p.customer === selected && (filterTerm ? (p.description || '').toLowerCase().includes(filterTerm) : true));
    if (!custProducts.length) { resultsDiv.innerHTML = '<p>No products found for this customer with the current filter.</p>'; return; }

    const grouped = {};
    custProducts.forEach(p => {
      const d = new Date(p.date); if (isNaN(d)) return;
      const month = d.toLocaleString('default', { month:'short', year:'numeric' });
      const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const key = `${p.sku}_${monthKey}`;
      if (!grouped[key]) grouped[key] = { sku:p.sku, description:p.description, month, monthKey, totalQty:0, totalPrice:0, totalCostAmount:0 };
      grouped[key].totalQty += Number(p.qty) || 0;

      const currentDate = new Date(p.date);
      if (!grouped[key].latestDate || currentDate > grouped[key].latestDate) {
        grouped[key].latestDate = currentDate;
        grouped[key].lastPrice = Number(p.price) || 0;
        grouped[key].lastCost  = Number(p.cost)  || 0;
      }
    });

    const rows = Object.values(grouped).map(r => ({ ...r, lastPrice: r.lastPrice || 0, lastCost:  r.lastCost  || 0 }));
    customerBreakdownState.rows = rows; customerBreakdownState.sort = { key:null, asc:true };

    resultsDiv.innerHTML = `<h3>Customer Purchase Breakdown: ${escapeHtml(selected)}</h3>
      <table class="breakdown-table customer-table" style="width:100%; font-size:0.95rem;">
        <thead><tr>
          <th data-key="sku">SKU</th><th data-key="description">Description</th><th data-key="month">Month</th><th data-key="totalQty">Total Qty</th>
          <th data-key="lastPrice">Last Price</th><th data-key="lastCost">Last Cost</th>
        </tr></thead>
        <tbody>${rows.map(r=>`<tr>
          <td>${escapeHtml(r.sku)}</td>
          <td data-full="${escapeHtml(r.description)}">${escapeHtml(r.description)}</td>
          <td>${escapeHtml(r.month)}</td>
          <td style="text-align:right;">${r.totalQty}</td>
          <td style="text-align:right;">$${toMoney(r.lastPrice)}</td>
          <td style="text-align:right;">$${toMoney(r.lastCost)}</td>
        </tr>`).join('')}</tbody>
      </table>`;
    attachCustomerTableSortHandlers();
  }

  function attachCustomerTableSortHandlers() {
    document.querySelectorAll('.customer-table th').forEach(th => {
      th.style.cursor = 'pointer';
      th.onclick = () => {
        const key = th.dataset.key;
        customerBreakdownState.sort.asc = customerBreakdownState.sort.key === key ? !customerBreakdownState.sort.asc : true;
        customerBreakdownState.sort.key = key;
        const sorted = [...customerBreakdownState.rows].sort((a,b) => {
          if (key === 'month') return customerBreakdownState.sort.asc ? a.monthKey.localeCompare(b.monthKey) : b.monthKey.localeCompare(a.monthKey);
          if (typeof a[key] === 'string') return customerBreakdownState.sort.asc ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]);
          return customerBreakdownState.sort.asc ? a[key] - b[key] : b[key] - a[key];
        });
        customerBreakdownState.rows = sorted;
        const tbody = document.querySelector('.customer-table tbody');
        tbody.innerHTML = sorted.map(r=>`<tr>
          <td>${escapeHtml(r.sku)}</td><td data-full="${escapeHtml(r.description)}">${escapeHtml(r.description)}</td>
          <td>${escapeHtml(r.month)}</td><td style="text-align:right;">${r.totalQty}</td>
          <td style="text-align:right;">$${toMoney(r.lastPrice)}</td><td style="text-align:right;">$${toMoney(r.lastCost)}</td>
        </tr>`).join('');
      };
    });
  }

  buildCustomerUI();

  // --- TYPES TAB (REVISED: Type -> SKU dropdown -> SKU History Table) ---
// === Type state ===
let typeState = {
  selectedType: '',
  summaryRows: [],
};

// --- Build Types Tab UI ---
function buildTypesUI() {
  typesSection.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'type-controls';

  // --- Type select ---
  const labelType = document.createElement('label');
  labelType.innerHTML = 'Select Customer Type: ';
  const typeSelect = document.createElement('select');
  typeSelect.id = 'typeSelect';
  typeSelect.innerHTML = `<option value="">Select Type</option>` +
    [...new Set(products.map(p => p.type))].sort()
      .map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  labelType.appendChild(typeSelect);
  wrapper.appendChild(labelType);

  typesSection.appendChild(wrapper);

  // --- Results container ---
  const resultsDiv = document.createElement('div');
  resultsDiv.id = 'typeResults';
  resultsDiv.style.marginTop = '1rem';
  typesSection.appendChild(resultsDiv);

  // --- When Type is selected ---
  typeSelect.addEventListener('change', () => {
    const selType = (typeSelect.value || '').trim();
    typeState.selectedType = selType;
    resultsDiv.innerHTML = '';
    if (!selType) return;

    const filtered = products.filter(p => (p.type || '').trim() === selType);

    // Aggregate SKUs: count customers and price range
    const skuMap = {};
    filtered.forEach(p => {
      const key = p.sku;
      if (!skuMap[key]) skuMap[key] = { sku: key, description: p.description, customers: new Set(), minPrice: p.price, maxPrice: p.price };
      skuMap[key].customers.add(p.customer);
      skuMap[key].minPrice = Math.min(skuMap[key].minPrice, p.price);
      skuMap[key].maxPrice = Math.max(skuMap[key].maxPrice, p.price);
    });

    const summaryRows = Object.values(skuMap).map(s => ({
      sku: s.sku,
      description: s.description,
      customersCount: s.customers.size,
      priceRange: s.minPrice === s.maxPrice ? `$${toMoney(s.minPrice)}` : `$${toMoney(s.minPrice)}–$${toMoney(s.maxPrice)}`
    }));

    typeState.summaryRows = summaryRows;

    // Build summary table with expandable rows
    const table = document.createElement('table');
    table.className = 'breakdown-table type-table';
    table.style.width = '100%';
    table.innerHTML = `<thead><tr>
      <th data-key="sku">SKU</th>
      <th data-key="description">Description</th>
      <th data-key="customersCount">Customers</th>
      <th data-key="priceRange">Price Range</th>
    </tr></thead>
    <tbody>${summaryRows.map(r=>`<tr data-sku="${r.sku}">
      <td>${escapeHtml(r.sku)}</td>
      <td>${escapeHtml(r.description)}</td>
      <td style="text-align:right;">${r.customersCount}</td>
      <td style="text-align:right;">${r.priceRange}</td>
    </tr>`).join('')}</tbody>`;

    resultsDiv.appendChild(table);

    attachSummaryTableSort(table);
  });
}

// --- Attach sorting & click handlers to summary table ---
function attachSummaryTableSort(table) {
  const tbody = table.querySelector('tbody');

  // --- Function to attach click handlers ---
  function attachRowClicks() {
    tbody.querySelectorAll('tr').forEach(tr => {
      tr.style.cursor = 'pointer';
      tr.onclick = () => {
        const sku = tr.dataset.sku;

        // Toggle existing history row
        const next = tr.nextElementSibling;
        if (next && next.classList.contains('history-row')) {
          next.remove(); // collapse
          return;
        }

        // Remove other open histories
        tbody.querySelectorAll('.history-row').forEach(hr => hr.remove());

        // Insert history row
        const historyTr = document.createElement('tr');
        historyTr.className = 'history-row';
        const td = document.createElement('td');
        td.colSpan = table.querySelectorAll('th').length;
        td.style.padding = '0.5rem 1rem';
        historyTr.appendChild(td);
        tr.insertAdjacentElement('afterend', historyTr);

        // Build history table inside td
        const historyTable = renderTypeHistoryTable(typeState.selectedType, sku);
        td.appendChild(historyTable);

        // Scroll into view for visibility
        historyTr.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    });
  }

  // Initial attach
  attachRowClicks();

  // Attach sorting
  table.querySelectorAll('th').forEach(th => {
    th.style.cursor='pointer';
    let asc = true;
    th.onclick = () => {
      const key = th.dataset.key;
      asc = table.dataset.lastKey === key ? !asc : true;
      table.dataset.lastKey = key;
      const sorted = [...typeState.summaryRows].sort((a, b) => {
        if (typeof a[key] === 'string') return asc ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]);
        return asc ? a[key] - b[key] : b[key] - a[key];
      });
      tbody.innerHTML = sorted.map(r=>`<tr data-sku="${r.sku}">
        <td>${escapeHtml(r.sku)}</td>
        <td>${escapeHtml(r.description)}</td>
        <td style="text-align:right;">${r.customersCount}</td>
        <td style="text-align:right;">${r.priceRange}</td>
      </tr>`).join('');

      // Reattach click handlers
      attachRowClicks();
    };
  });
}

// --- Render history table for a SKU ---
function renderTypeHistoryTable(type, sku) {
  const filtered = products.filter(p => (p.type || '').trim() === type && p.sku === sku);
  const rows = filtered.map(p => {
    const d = new Date(p.date);
    const month = isNaN(d) ? '' : d.toLocaleString('default',{month:'short',year:'numeric'});
    return {
      customer: p.customer,
      month,
      monthKey: isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      totalQty: Number(p.qty) || 0,
      lastPrice: Number(p.price) || 0,
      lastCost: Number(p.cost) || 0
    };
  });

  const table = document.createElement('table');
  table.className = 'breakdown-table history-table';
  table.style.margin = '0.5rem 0';
  table.innerHTML = `<thead><tr>
    <th data-key="customer">Customer</th>
    <th data-key="month">Month</th>
    <th data-key="totalQty">Total Qty</th>
    <th data-key="lastPrice">Last Price</th>
    <th data-key="lastCost">Last Cost</th>
  </tr></thead>
  <tbody>${rows.map(r=>`<tr>
    <td>${escapeHtml(r.customer)}</td>
    <td>${escapeHtml(r.month)}</td>
    <td style="text-align:right;">${r.totalQty}</td>
    <td style="text-align:right;">$${toMoney(r.lastPrice)}</td>
    <td style="text-align:right;">$${toMoney(r.lastCost)}</td>
  </tr>`).join('')}</tbody>`;

  attachTypeTableSort(table, rows);
  return table;
}

// --- Sorting function for history tables ---
function attachTypeTableSort(table, rows) {
  table.querySelectorAll('th').forEach(th => {
    th.style.cursor='pointer';
    let asc=true;
    th.onclick=()=> {
      const key = th.dataset.key;
      asc = table.dataset.lastKey === key ? !asc : true;
      table.dataset.lastKey = key;
      const sorted = [...rows].sort((a,b)=>{
        if(key==='month') return asc ? a.monthKey.localeCompare(b.monthKey) : b.monthKey.localeCompare(a.monthKey);
        if(typeof a[key]==='string') return asc ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]);
        return asc ? a[key]-b[key] : b[key]-a[key];
      });
      const tbody = table.querySelector('tbody');
      tbody.innerHTML = sorted.map(r=>`<tr>
        <td>${escapeHtml(r.customer)}</td>
        <td>${escapeHtml(r.month)}</td>
        <td style="text-align:right;">${r.totalQty}</td>
        <td style="text-align:right;">$${toMoney(r.lastPrice)}</td>
        <td style="text-align:right;">$${toMoney(r.lastCost)}</td>
      </tr>`).join('');
    };
  });
}

// --- INVOICES TAB ---
function buildInvoiceUI() {
  const invoiceContainer = document.getElementById('invoiceContainer');
  invoiceContainer.innerHTML = '';

  // --- Combine customers from crmCustomers + products ---
  const allCustomers = [
    ...new Map(
      [...crmCustomers, ...products.map(p => ({ Customer: p.customer, "Customer ID": p.customer }))].map(c => [c.Customer, c])
    ).values()
  ].sort((a, b) => a.Customer.localeCompare(b.Customer));

  // --- Header: Invoice # and Customer ---
  const header = document.createElement('div');
  header.className = 'invoice-header';

  const invInput = document.createElement('input');
  invInput.placeholder = 'Invoice #';
  invInput.style.marginRight = '10px';
  header.appendChild(invInput);

  const custSelect = document.createElement('select');
  custSelect.id = 'invoiceCustomer';
  custSelect.style.minWidth = '220px';
  custSelect.innerHTML = `<option value="">Select Customer</option>` +
    allCustomers.map(c => `<option value="${escapeHtml(c.Customer)}">${escapeHtml(c.Customer)}</option>`).join('');
  header.appendChild(custSelect);
  invoiceContainer.appendChild(header);

  // --- Editable Contact Fields ---
  const contactWrapper = document.createElement('div');
  contactWrapper.style.marginTop = '8px';

  function createContactField(labelText, id, value) {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.marginTop = '6px';
    label.innerHTML = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.value = value || '';
    input.style.width = '100%';
    input.style.padding = '6px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '4px';
    label.appendChild(input);
    contactWrapper.appendChild(label);
    return input;
  }

  const invoiceState = {
    items: [],
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    customerAddress: '',
    taxPct: 0,
    customer: '',
    invoiceNumber: '',
    notes: ''
  };

  const nameInput = createContactField('Contact Name:', 'invoiceContactName', invoiceState.contactName);
  const phoneInput = createContactField('Contact Tel#:', 'invoiceContactPhone', invoiceState.contactPhone);
  const emailInput = createContactField('Contact Email:', 'invoiceContactEmail', invoiceState.contactEmail);
  const addrInput = createContactField('Customer Address:', 'invoiceContactAddress', invoiceState.customerAddress);

  // --- Sync contact fields into invoiceState ---
nameInput.addEventListener('input', e => invoiceState.contactName = e.target.value);
phoneInput.addEventListener('input', e => invoiceState.contactPhone = e.target.value);
emailInput.addEventListener('input', e => invoiceState.contactEmail = e.target.value);
addrInput.addEventListener('input', e => invoiceState.customerAddress = e.target.value);

  invoiceContainer.appendChild(contactWrapper);

  // --- Tax ---
  const taxLabel = document.createElement('label');
  taxLabel.textContent = 'Tax %: ';
  taxLabel.style.display = 'block';
  taxLabel.style.marginTop = '8px';
  const taxInput = document.createElement('input');
  taxInput.type = 'number';
  taxInput.value = 0;
  taxInput.style.width = '80px';
  taxLabel.appendChild(taxInput);
  invoiceContainer.appendChild(taxLabel);

  // --- Notes Field ---
  const notesLabel = document.createElement('label');
  notesLabel.textContent = 'Invoice Notes (optional):';
  notesLabel.style.display = 'block';
  notesLabel.style.marginTop = '10px';
  const notesInput = document.createElement('textarea');
  notesInput.id = 'invoiceNotes';
  notesInput.rows = 4;
  notesInput.style.width = '100%';
  notesInput.style.padding = '6px';
  notesInput.style.border = '1px solid #ccc';
  notesInput.style.borderRadius = '4px';
  notesLabel.appendChild(notesInput);
  invoiceContainer.appendChild(notesLabel);

  // --- Product Search ---
  const searchWrap = document.createElement('div');
  searchWrap.style.marginTop = '12px';
  const prodInput = document.createElement('input');
  prodInput.id = 'invoiceProductSearch';
  prodInput.placeholder = 'Type product description to search...';
  prodInput.style.width = '60%';
  prodInput.style.padding = '6px';
  const resultsList = document.createElement('div');
  resultsList.id = 'invoiceSearchResults';
  resultsList.style.position = 'relative';
  resultsList.style.maxHeight = '220px';
  resultsList.style.overflow = 'auto';
  resultsList.style.marginTop = '6px';
  searchWrap.appendChild(prodInput);
  searchWrap.appendChild(resultsList);
  invoiceContainer.appendChild(searchWrap);

  // --- Invoice Table ---
  const table = document.createElement('table');
  table.id = 'invoiceTable';
  table.className = 'invoice-table';
  table.innerHTML = `<thead>
    <tr><th>SKU</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Line Total</th><th>Action</th></tr>
  </thead>
  <tbody></tbody>
  <tfoot>
    <tr><td colspan="4" style="text-align:right;">Subtotal</td><td id="invSubtotal">$0.00</td><td></td></tr>
    <tr><td colspan="4" style="text-align:right;">Tax</td><td id="invTax">$0.00</td><td></td></tr>
    <tr><td colspan="4" style="text-align:right;font-weight:700;">Grand Total</td><td id="invTotal">$0.00</td><td></td></tr>
  </tfoot>`;
  invoiceContainer.appendChild(table);

  // --- Actions ---
  const actions = document.createElement('div');
  actions.className = 'invoice-actions';
  actions.style.marginTop = '12px';
  const printBtn = document.createElement('button');
  printBtn.textContent = 'Print / PDF';
  actions.appendChild(printBtn);
  invoiceContainer.appendChild(actions);

  // --- Functions to Render Rows & Totals ---
  function renderInvoiceRows() {
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = invoiceState.items.map((it, i) => `
      <tr data-idx="${i}">
        <td>${escapeHtml(it.sku)}</td>
        <td>${escapeHtml(it.description)}</td>
        <td><input type="number" min="1" value="${it.qty}" class="inv-qty" style="width:70px;"></td>
        <td><input type="number" step="0.01" value="${toMoney(it.unitPrice)}" class="inv-price" style="width:90px;"></td>
        <td class="inv-line">$${toMoney(it.unitPrice * it.qty)}</td>
        <td><button class="inv-remove">Remove</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.inv-qty').forEach((el, idx) => {
      el.addEventListener('input', e => {
        invoiceState.items[idx].qty = Math.max(1, Number(e.target.value) || 1);
        e.target.closest('tr').querySelector('.inv-line').textContent = `$${toMoney(invoiceState.items[idx].unitPrice * invoiceState.items[idx].qty)}`;
        updateInvoiceTotals();
      });
    });

    tbody.querySelectorAll('.inv-price').forEach((el, idx) => {
      el.addEventListener('input', e => {
        invoiceState.items[idx].unitPrice = Number(e.target.value) || 0;
        e.target.closest('tr').querySelector('.inv-line').textContent = `$${toMoney(invoiceState.items[idx].unitPrice * invoiceState.items[idx].qty)}`;
        updateInvoiceTotals();
      });
    });

    tbody.querySelectorAll('.inv-remove').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        invoiceState.items.splice(idx, 1);
        renderInvoiceRows();
      });
    });

    updateInvoiceTotals();
  }

  function updateInvoiceTotals() {
    const subtotal = invoiceState.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
    const taxPct = Number(taxInput.value) || 0;
    const taxAmount = subtotal * taxPct / 100;
    const total = subtotal + taxAmount;
    invoiceState.taxPct = taxPct;
    invoiceState.customer = custSelect.value || '';
    invoiceState.invoiceNumber = invInput.value || generateInvoiceNumber();
    invoiceState.notes = notesInput.value || '';
    invoiceContainer.querySelector('#invSubtotal').textContent = `$${toMoney(subtotal)}`;
    invoiceContainer.querySelector('#invTax').textContent = `$${toMoney(taxAmount)}`;
    invoiceContainer.querySelector('#invTotal').textContent = `$${toMoney(total)}`;
  }

  taxInput.addEventListener('input', updateInvoiceTotals);
  custSelect.addEventListener('change', () => { invoiceState.customer = custSelect.value; prodInput.dispatchEvent(new Event('input')); });
  invInput.addEventListener('input', () => invoiceState.invoiceNumber = invInput.value);
  notesInput.addEventListener('input', () => invoiceState.notes = notesInput.value);

  // --- Product Search ---
  prodInput.addEventListener('input', () => {
    const term = prodInput.value.trim().toLowerCase();
    resultsList.innerHTML = '';
    if (!term) return;
    const cust = custSelect.value;

    // Customer-specific matches
    const custMatches = products.filter(p => p.customer === cust && (p.description || '').toLowerCase().includes(term));
    // Global matches
    const globalMatches = products.filter(p => (p.description || '').toLowerCase().includes(term));

    // Deduplicate by SKU, latest date
    const dedupe = new Map();

(custMatches.length ? custMatches.concat(globalMatches) : globalMatches).forEach(p => {
  const existing = dedupe.get(p.sku);

  if (
    !existing ||
    new Date(p.date).getTime() > new Date(existing.date).getTime()
  ) {
    dedupe.set(p.sku, p);
  }
});

// Render results
Array.from(dedupe.values()).slice(0, 50).forEach(p => {
  let lastPrice = 0;

  if (cust) {
    const purchases = products
      .filter(x =>
        x.customer &&
        cust &&
        x.customer.toLowerCase().trim() === cust.toLowerCase().trim() &&
        x.sku === p.sku
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (purchases.length > 0) {
      lastPrice = parseFloat(purchases[0].price) || 0;
    }
  }

  // Fallback (if no customer price found)
if (!lastPrice) {
  lastPrice = 0;
}

  const itemDiv = document.createElement('div');
  itemDiv.className = 'invoice-search-item';
  itemDiv.style.cssText = 'padding:6px;border:1px solid #eee;cursor:pointer;background:#fff;';

  itemDiv.innerHTML = `
    <strong>${escapeHtml(p.description || '')}</strong> —
    <small>${escapeHtml(p.sku || '')}</small>
    <span style="float:right">
  ${lastPrice ? `$${toMoney(lastPrice)}` : 'No Price'}
</span>
  `;

  itemDiv.addEventListener('click', () => {
    invoiceState.items.push({
      sku: p.sku,
      description: p.description,
      qty: 1,
      unitPrice: lastPrice
    });

    prodInput.value = '';
    resultsList.innerHTML = '';
    renderInvoiceRows();
  });

  resultsList.appendChild(itemDiv);
});
  });

  // --- Print / PDF ---
printBtn.addEventListener('click', () => {
  const popup = window.open('', '_blank', 'width=900,height=700');

  const rowsHtml = invoiceState.items.map(it => `
    <tr>
      <td>${escapeHtml(it.sku)}</td>
      <td>${escapeHtml(it.description)}</td>
      <td style="text-align:right">${it.qty}</td>
      <td style="text-align:right">$${toMoney(it.unitPrice)}</td>
      <td style="text-align:right">$${toMoney(it.qty * it.unitPrice)}</td>
    </tr>
  `).join('');

  const subtotal = invoiceState.items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const tax = subtotal * (invoiceState.taxPct || 0) / 100;
  const total = subtotal + tax;

    const companyInfo = {
    name: "Ecosanitary",
    contact: "Carlos Wall",
    phone: "(949) 350-8054 ",
    email: "carlos@ecosanitary.com",
    website: "www.ecosanitary.com",
    address: "14423 Marquardt Ave. Santa Fe Springs, CA 90670"
  };

  // --- Footer text: ALWAYS shows up ---
  const footerText = `Thank you for your business!<br>
Please contact us if you have any questions about this invoice.<br>
Payment terms: Net 0 days - Payment Due Upon Delivery.<br>
Please make check payments to: ECOSANITARY`;

  // --- User notes: optional ---
  const userNotes = invoiceState.notes.trim();

  popup.document.write(`
    <html>
      <head>
        <title>Invoice ${escapeHtml(invoiceState.invoiceNumber||'')}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; padding: 20px; color: #222; }
          h1,h2,h3 { margin: 0 0 6px 0; }
          .company-header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .company-header p { margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #ccc; padding: 6px; }
          tfoot td { font-weight: 600; }
          .user-notes { margin-top: 20px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; background:#f9f9f9; font-size:0.95rem; }
          .footer-notes { margin-top: 25px; border-top: 1px solid #aaa; padding-top: 10px; font-size:0.9rem; }
        </style>
      </head>
      <body>
        <div class="company-header">
          <h2>${escapeHtml(companyInfo.name)}</h2>
          <p><strong>Contact:</strong> ${escapeHtml(companyInfo.contact)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(companyInfo.phone)}</p>
          <p><strong>Email:</strong> ${escapeHtml(companyInfo.email)}</p>
          <p><strong>Website:</strong> ${escapeHtml(companyInfo.website)}</p>
          <p><strong>Address:</strong> ${escapeHtml(companyInfo.address)}</p>
        </div>

        <h2>Invoice: ${escapeHtml(invoiceState.invoiceNumber||'')}</h2>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Customer:</strong> ${escapeHtml(invoiceState.customer||'')}</p>
        <p><strong>Contact Name:</strong> ${escapeHtml(invoiceState.contactName||'')}</p>
        <p><strong>Phone:</strong> ${escapeHtml(invoiceState.contactPhone||'')}</p>
        <p><strong>Email:</strong> ${escapeHtml(invoiceState.contactEmail||'')}</p>
        <p><strong>Address:</strong> ${escapeHtml(invoiceState.customerAddress||'')}</p>

        ${userNotes ? `<div class="user-notes"><strong>Invoice Notes:</strong><br>${userNotes}</div>` : ''}

        <table>
          <thead>
            <tr>
              <th>SKU</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr><td colspan="4" style="text-align:right">Subtotal</td><td style="text-align:right">$${toMoney(subtotal)}</td></tr>
            <tr><td colspan="4" style="text-align:right">Tax (${toMoney(invoiceState.taxPct)}%)</td><td style="text-align:right">$${toMoney(tax)}</td></tr>
            <tr><td colspan="4" style="text-align:right;font-weight:700">Total</td><td style="text-align:right;font-weight:700">$${toMoney(total)}</td></tr>
          </tfoot>
        </table>

        <!-- Footer: ALWAYS included -->
        <div class="footer-notes">
          ${footerText}
        </div>
      </body>
    </html>
  `);

  popup.document.close();
  popup.print();
});
}

// --- Invoice Number Generator ---
function generateInvoiceNumber() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-001`;
}
// --- VENDORS TAB ---
let vendorBreakdownState = { rows: [], sort: { key:null, asc:true } };

function buildVendorUI() {
  vendorContainer.innerHTML = '';
  const wrapper = document.createElement('div'); 
  wrapper.className = 'vendor-controls';

  // Vendor selector
  const label = document.createElement('label');
  label.innerHTML = 'Select Vendor: ';

  const select = document.createElement('select'); 
  select.id = 'vendorSelect';

  select.innerHTML = `<option value="">Select Vendor</option>` +
    [...new Set(purchases.map(p => p.vendor))]    // unique vendors
      .sort()
      .map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)
      .join('');

  label.appendChild(select);
  wrapper.appendChild(label);

  // Description filter
  const filter = document.createElement('input'); 
  filter.id = 'vendorFilter';
  filter.placeholder = 'Filter by description...';
  filter.style.marginLeft = '10px';
  wrapper.appendChild(filter);

  // Results container
  const results = document.createElement('div'); 
  results.id = 'vendorResults';
  results.style.marginTop = '1rem';

  vendorContainer.appendChild(wrapper);
  vendorContainer.appendChild(results);

  select.addEventListener('change', renderVendorTable);
  filter.addEventListener('input', renderVendorTable);
}

function renderVendorTable() {
  const selected = document.getElementById('vendorSelect').value;
  const filterTerm = (document.getElementById('vendorFilter').value || '').trim().toLowerCase();
  const resultsDiv = document.getElementById('vendorResults');

  if (!selected) { 
    resultsDiv.innerHTML = '<p>Select a vendor to show purchasing breakdown.</p>'; 
    return; 
  }

  // Filter purchases for vendor
  const vendorData = purchases.filter(p => 
    p.vendor === selected &&
    (filterTerm ? (p.description || '').toLowerCase().includes(filterTerm) : true)
  );

  if (!vendorData.length) {
    resultsDiv.innerHTML = '<p>No records found for this vendor.</p>';
    return;
  }

  // Group by SKU + Month
  const grouped = {};

  vendorData.forEach(p => {
    const d = new Date(p.date);
    if (isNaN(d)) return;

    const month = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const key = `${p.sku}_${monthKey}`;

    if (!grouped[key]) {
      grouped[key] = {
        sku: p.sku,
        description: p.description,
        month,
        monthKey,
        totalQty: 0,
        lastCost: 0,
        latestDate: null
      };
    }

    // accumulate qty
    grouped[key].totalQty += Number(p.qty) || 0;

    // determine latest cost in that month
    const currentDate = new Date(p.date);

    if (!grouped[key].latestDate || currentDate > grouped[key].latestDate) {
      grouped[key].latestDate = currentDate;
      grouped[key].lastCost = Number(p.cost) || 0;
    }
  });

  const rows = Object.values(grouped).map(r => ({
    ...r,
    lastCost: r.lastCost || 0
  }));

  // Save table state
  vendorBreakdownState.rows = rows;
  vendorBreakdownState.sort = { key:null, asc:true };

  // Build table
  resultsDiv.innerHTML = `
    <h3>Vendor Purchasing Breakdown: ${escapeHtml(selected)}</h3>
    <table class="breakdown-table vendor-table" style="width:100%; font-size:0.95rem;">
      <thead><tr>
        <th data-key="sku">SKU</th>
        <th data-key="description">Description</th>
        <th data-key="month">Month</th>
        <th data-key="totalQty">Total Qty</th>
        <th data-key="lastCost">Last Cost</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${escapeHtml(r.sku)}</td>
            <td data-full="${escapeHtml(r.description)}">${escapeHtml(r.description)}</td>
            <td>${escapeHtml(r.month)}</td>
            <td style="text-align:right;">${r.totalQty}</td>
            <td style="text-align:right;">$${toMoney(r.lastCost)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  attachVendorTableSortHandlers();
}

function attachVendorTableSortHandlers() {
  document.querySelectorAll('.vendor-table th').forEach(th => {
    th.style.cursor = 'pointer';
    th.onclick = () => {
      const key = th.dataset.key;

      vendorBreakdownState.sort.asc =
        vendorBreakdownState.sort.key === key ? !vendorBreakdownState.sort.asc : true;

      vendorBreakdownState.sort.key = key;

      const sorted = [...vendorBreakdownState.rows].sort((a,b) => {
        if (key === 'month') 
          return vendorBreakdownState.sort.asc
            ? a.monthKey.localeCompare(b.monthKey)
            : b.monthKey.localeCompare(a.monthKey);

        if (typeof a[key] === 'string') 
          return vendorBreakdownState.sort.asc
            ? a[key].localeCompare(b[key])
            : b[key].localeCompare(a[key]);

        return vendorBreakdownState.sort.asc ? a[key] - b[key] : b[key] - a[key];
      });

      vendorBreakdownState.rows = sorted;

      const tbody = document.querySelector('.vendor-table tbody');
      tbody.innerHTML = sorted.map(r => `
        <tr>
          <td>${escapeHtml(r.sku)}</td>
          <td data-full="${escapeHtml(r.description)}">${escapeHtml(r.description)}</td>
          <td>${escapeHtml(r.month)}</td>
          <td style="text-align:right;">${r.totalQty}</td>
          <td style="text-align:right;">$${toMoney(r.lastCost)}</td>
        </tr>
      `).join('');
    };
  });
}

buildVendorUI();

}

// --- CRM / Customer Management TAB ---
let crmContainer = document.getElementById('crmContainer');
let crmState = { customers: JSON.parse(localStorage.getItem('crmCustomers')||'[]'), selectedCustomer: null };

function buildCRMUI() {
  crmContainer.innerHTML = '';

  // Header + Add Customer
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  
  const title = document.createElement('h3'); title.textContent = 'Customer Management';
  header.appendChild(title);

  const addBtn = document.createElement('button'); addBtn.textContent = 'Add Customer';
  addBtn.onclick = () => openCustomerForm();
  header.appendChild(addBtn);
  crmContainer.appendChild(header);

  // Search / filter
  const searchInput = document.createElement('input');
  searchInput.placeholder = 'Search customers...';
  searchInput.style.margin = '8px 0';
  crmContainer.appendChild(searchInput);

  const resultsDiv = document.createElement('div'); resultsDiv.id = 'crmResults';
  crmContainer.appendChild(resultsDiv);

  searchInput.addEventListener('input', () => renderCRMTable(searchInput.value));
  
  renderCRMTable();
}

function renderCRMTable(searchTerm = '') {
  const resultsDiv = document.getElementById('crmResults');
  const term = searchTerm.trim().toLowerCase();

  const filtered = crmState.customers.filter(c =>
    !term || c.name.toLowerCase().includes(term) || (c.email && c.email.toLowerCase().includes(term))
  );

  if (!filtered.length) { resultsDiv.innerHTML = '<p>No customers found.</p>'; return; }

  const table = document.createElement('table');
  table.className = 'breakdown-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Phone</th>
        <th>Address</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${filtered.map((c,i) => `
        <tr data-idx="${i}">
          <td>${escapeHtml(c.name)}</td>
          <td>${escapeHtml(c.email||'')}</td>
          <td>${escapeHtml(c.phone||'')}</td>
          <td>${escapeHtml(c.address||'')}</td>
          <td>
            <button class="editBtn">Edit</button>
            <button class="delBtn">Delete</button>
          </td>
        </tr>`).join('')}
    </tbody>
  `;

  resultsDiv.innerHTML = ''; resultsDiv.appendChild(table);

  table.querySelectorAll('.editBtn').forEach((btn,i) => {
    btn.addEventListener('click', () => openCustomerForm(filtered[i], i));
  });

  table.querySelectorAll('.delBtn').forEach((btn,i) => {
    btn.addEventListener('click', () => {
      if(confirm('Delete this customer?')) {
        const idx = crmState.customers.indexOf(filtered[i]);
        if(idx > -1) { crmState.customers.splice(idx,1); saveCRMState(); renderCRMTable(searchTerm); }
      }
    });
  });
}

function openCustomerForm(customer={}, idx=null) {
  const formDiv = document.createElement('div');
  formDiv.style.border = '1px solid #ccc'; formDiv.style.padding='10px'; formDiv.style.margin='10px 0'; formDiv.style.background='#f9f9f9';

  formDiv.innerHTML = `
    <label>Name: <input type="text" id="custName" value="${escapeHtml(customer.name||'')}"></label><br>
    <label>Email: <input type="email" id="custEmail" value="${escapeHtml(customer.email||'')}"></label><br>
    <label>Phone: <input type="text" id="custPhone" value="${escapeHtml(customer.phone||'')}"></label><br>
    <label>Address: <input type="text" id="custAddress" value="${escapeHtml(customer.address||'')}"></label><br>
    <button id="saveCustomer">Save</button>
    <button id="cancelCustomer">Cancel</button>
  `;
  crmContainer.insertBefore(formDiv, crmContainer.firstChild);

  document.getElementById('saveCustomer').onclick = () => {
    const newCust = {
      name: document.getElementById('custName').value.trim(),
      email: document.getElementById('custEmail').value.trim(),
      phone: document.getElementById('custPhone').value.trim(),
      address: document.getElementById('custAddress').value.trim()
    };
    if(!newCust.name){ alert('Name is required'); return; }

    if(idx !== null) crmState.customers[idx] = newCust;
    else crmState.customers.push(newCust);

    saveCRMState(); formDiv.remove(); renderCRMTable();
  };

  document.getElementById('cancelCustomer').onclick = () => formDiv.remove();
}

function saveCRMState() {
  localStorage.setItem('crmCustomers', JSON.stringify(crmState.customers));
}

function setupTabSwitching() {
  const tabs = document.querySelectorAll('#tabButtons button');
  const containers = {
    type: document.getElementById('typeContainer'),
    invoice: document.getElementById('invoiceContainer'),
    vendor: document.getElementById('vendorContainer'),
    crm: document.getElementById('crmContainer')
  };

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      Object.keys(containers).forEach(k => containers[k].style.display = (k === tab ? 'block' : 'none'));
    });
  });
}

loadApp().catch(err=>console.error('Failed to load app:',err));
