// app.js - Full integrated (Products / Customers / Invoices) with improved searchable Add Product
async function loadApp() {
  const res = await fetch('data/products.json');
  const products = await res.json();

  // --- Elements (from index.html) ---
  const productsTab = document.getElementById('productsTab');
  const customersTab = document.getElementById('customersTab');
  const invoicesTab = document.getElementById('invoicesTab');

  const productsSection = document.getElementById('productsSection');
  const customersSection = document.getElementById('customersSection');
  const invoicesSection = document.getElementById('invoicesSection');

  const productFilters = document.getElementById('productFilters');
  const searchInput = document.getElementById('searchInput');
  const skuSelect = document.getElementById('skuSelect');
  const resultsContainer = document.getElementById('resultsContainer');

  const customerContainer = document.getElementById('customerContainer');
  const invoiceContainer = document.getElementById('invoiceContainer');
  const lastUpdated = document.getElementById('lastUpdated');
  lastUpdated.textContent = new Date().toLocaleString();

  // --- Tab switching ---
  function showSection(name) {
    [productsSection, customersSection, invoicesSection].forEach(s => s.classList.remove('active'));
    [productsTab, customersTab, invoicesTab].forEach(t => t.classList.remove('active'));
    if (name === 'products') { productsSection.classList.add('active'); productsTab.classList.add('active'); productFilters.style.display = 'block'; }
    if (name === 'customers') { customersSection.classList.add('active'); customersTab.classList.add('active'); productFilters.style.display = 'none'; }
    if (name === 'invoices') { invoicesSection.classList.add('active'); invoicesTab.classList.add('active'); productFilters.style.display = 'none'; buildInvoiceUI(); }
  }

  productsTab.addEventListener('click', () => showSection('products'));
  customersTab.addEventListener('click', () => showSection('customers'));
  invoicesTab.addEventListener('click', () => showSection('invoices'));

  showSection('products');

  // --- Utilities ---
  function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function toMoney(n) { return Number(n || 0).toFixed(2); }

  // --- PRODUCTS TAB (unchanged behavior) ---
  let productBreakdownState = { rows: [], sort: { key:null, asc:true } };

  function renderProductsList(list) {
    if(!list || !list.length) { resultsContainer.innerHTML = `<p>No products found.</p>`; return; }
    resultsContainer.innerHTML = `<h2>Products</h2><div class="cards-grid">${list.map(p=>`
      <div class="card">
        <h3>${escapeHtml(p.description)}</h3>
        <p><strong>SKU:</strong> ${escapeHtml(p.sku)}</p>
        <p><strong>Customer:</strong> ${escapeHtml(p.customer)}</p>
        <p><strong>Qty:</strong> ${Number(p.qty)}</p>
        <p><strong>Price:</strong> $${toMoney(p.price)}</p>
        <p><strong>Cost:</strong> $${toMoney(p.cost)}</p>
        <p><strong>Invoice #:</strong> ${escapeHtml(String(p['inv#']))}</p>
      </div>`).join('')}</div>`;
  }

  function populateSkuDropdown(list) {
    const skuMap = new Map();
    (list || products).forEach(p => {
      if (!skuMap.has(p.sku)) skuMap.set(p.sku, new Set());
      skuMap.get(p.sku).add(p.description);
    });
    skuSelect.innerHTML = `<option value="">Select SKU</option>` + [...skuMap.entries()].flatMap(([sku, descs]) =>
      [...descs].map(desc => `<option value="${escapeHtml(sku)}">${escapeHtml(sku)} — ${escapeHtml(desc)}</option>`)
    ).join('');
  }

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.trim().toLowerCase();
    const filtered = products.filter(p => (p.description || '').toLowerCase().includes(term));
    renderProductsList(filtered);
    populateSkuDropdown(filtered);
  });

  skuSelect.addEventListener('change', () => {
    const selectedSKU = skuSelect.value;
    if (!selectedSKU) { renderProductsList(products); populateSkuDropdown(products); return; }
    const skuProducts = products.filter(p => p.sku === selectedSKU);
    const breakdown = getProductMonthlyBreakdown(skuProducts);
    productBreakdownState.rows = breakdown;
    productBreakdownState.sort = { key:null, asc:true };
    renderProductBreakdownTable(breakdown, selectedSKU);
  });

  function getProductMonthlyBreakdown(list) {
    const grouped = {};
    list.forEach(p => {
      const d = new Date(p.date); if (isNaN(d)) return;
      const month = d.toLocaleString('default', { month:'short', year:'numeric' });
      const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const key = `${p.customer}_${monthKey}`;
      if (!grouped[key]) grouped[key] = { customer:p.customer, month, monthKey, totalQty:0, totalPrice:0, totalCostAmount:0 };
      grouped[key].totalQty += Number(p.qty) || 0;
      grouped[key].totalPrice += (Number(p.price) || 0) * (Number(p.qty) || 0);
      grouped[key].totalCostAmount += (Number(p.cost) || 0) * (Number(p.qty) || 0);
    });
    return Object.values(grouped).map(r => ({ ...r, avgPrice: r.totalQty ? r.totalPrice / r.totalQty : 0, avgCost: r.totalQty ? r.totalCostAmount / r.totalQty : 0 }));
  }

  function renderProductBreakdownTable(data, skuForTitle) {
    if (!data || !data.length) { resultsContainer.innerHTML = `<p>No breakdown data for ${escapeHtml(skuForTitle)}</p>`; return; }
    resultsContainer.innerHTML = `<h3>Monthly Breakdown for SKU: ${escapeHtml(skuForTitle)}</h3>
      <table class="breakdown-table product-table" style="width:100%">
        <thead><tr>
          <th data-key="customer">Customer</th><th data-key="month">Month</th><th data-key="totalQty">Total Qty</th>
          <th data-key="avgPrice">Avg Price</th><th data-key="avgCost">Cost</th>
        </tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td>${escapeHtml(r.customer)}</td>
          <td>${escapeHtml(r.month)}</td>
          <td style="text-align:right;">${r.totalQty}</td>
          <td style="text-align:right;">$${toMoney(r.avgPrice)}</td>
          <td style="text-align:right;">$${toMoney(r.avgCost)}</td>
        </tr>`).join('')}</tbody>
      </table>`;
    attachProductTableSortHandlers();
  }

  function attachProductTableSortHandlers() {
    document.querySelectorAll('.product-table th').forEach(th => {
      th.style.cursor = 'pointer';
      th.onclick = () => {
        const key = th.dataset.key;
        productBreakdownState.sort.asc = productBreakdownState.sort.key === key ? !productBreakdownState.sort.asc : true;
        productBreakdownState.sort.key = key;
        const sorted = [...productBreakdownState.rows].sort((a,b) => {
          if (key === 'month') return productBreakdownState.sort.asc ? a.monthKey.localeCompare(b.monthKey) : b.monthKey.localeCompare(a.monthKey);
          if (typeof a[key] === 'string') return productBreakdownState.sort.asc ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]);
          return productBreakdownState.sort.asc ? a[key] - b[key] : b[key] - a[key];
        });
        productBreakdownState.rows = sorted;
        renderProductBreakdownTable(sorted, skuSelect.value || '');
      };
    });
  }

  // initial populate
  renderProductsList(products);
  populateSkuDropdown(products);

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
      grouped[key].totalPrice += (Number(p.price) || 0) * (Number(p.qty) || 0);
      grouped[key].totalCostAmount += (Number(p.cost) || 0) * (Number(p.qty) || 0);
    });

    const rows = Object.values(grouped).map(r => ({ ...r, avgPrice: r.totalQty ? r.totalPrice / r.totalQty : 0, avgCost: r.totalQty ? r.totalCostAmount / r.totalQty : 0 }));
    customerBreakdownState.rows = rows; customerBreakdownState.sort = { key:null, asc:true };

    resultsDiv.innerHTML = `<h3>Customer Purchase Breakdown: ${escapeHtml(selected)}</h3>
      <table class="breakdown-table customer-table" style="width:100%; font-size:0.95rem;">
        <thead><tr>
          <th data-key="sku">SKU</th><th data-key="description">Description</th><th data-key="month">Month</th><th data-key="totalQty">Total Qty</th>
          <th data-key="avgPrice">Avg Price</th><th data-key="avgCost">Cost</th>
        </tr></thead>
        <tbody>${rows.map(r=>`<tr>
          <td>${escapeHtml(r.sku)}</td>
          <td data-full="${escapeHtml(r.description)}">${escapeHtml(r.description)}</td>
          <td>${escapeHtml(r.month)}</td>
          <td style="text-align:right;">${r.totalQty}</td>
          <td style="text-align:right;">$${toMoney(r.avgPrice)}</td>
          <td style="text-align:right;">$${toMoney(r.avgCost)}</td>
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
          <td style="text-align:right;">$${toMoney(r.avgPrice)}</td><td style="text-align:right;">$${toMoney(r.avgCost)}</td>
        </tr>`).join('');
      };
    });
  }

  buildCustomerUI();

  // --- INVOICE TAB ---
  const invoiceState = { items: [], taxPct: 0, customer: '', invoiceNumber: '' };

  function buildInvoiceUI() {
    invoiceContainer.innerHTML = '';
    invoiceState.items = []; invoiceState.taxPct = 0; invoiceState.customer=''; invoiceState.invoiceNumber = generateInvoiceNumber();

    // Header (customer, invoice#, tax)
    const header = document.createElement('div'); header.className = 'invoice-header';

    const custLabel = document.createElement('label'); custLabel.innerHTML = 'Customer';
    const custSelect = document.createElement('select'); custSelect.id = 'invoiceCustomer';
    custSelect.innerHTML = `<option value="">Select or type new</option>` + [...new Set(products.map(p=>p.customer))].sort().map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    custLabel.appendChild(custSelect); header.appendChild(custLabel);

    const invLabel = document.createElement('label'); invLabel.innerHTML = 'Invoice #';
    const invInput = document.createElement('input'); invInput.id = 'invoiceNumberInput'; invInput.type = 'text'; invInput.value = invoiceState.invoiceNumber;
    invLabel.appendChild(invInput); header.appendChild(invLabel);

    const taxLabel = document.createElement('label'); taxLabel.innerHTML = 'Tax %';
    const taxInput = document.createElement('input'); taxInput.id = 'invoiceTaxInput'; taxInput.type = 'number'; taxInput.min = 0; taxInput.step = 0.01; taxInput.value = 0;
    taxLabel.appendChild(taxInput); header.appendChild(taxLabel);

    invoiceContainer.appendChild(header);

    // Product search + results dropdown (improved search)
    const searchWrap = document.createElement('div'); searchWrap.style.marginTop = '0.75rem';
    const prodInput = document.createElement('input'); prodInput.id = 'invoiceProductSearch'; prodInput.placeholder = 'Type product description to search...'; prodInput.style.width = '60%';
    const resultsList = document.createElement('div'); resultsList.id = 'invoiceSearchResults'; resultsList.style.position = 'relative';
    resultsList.style.maxHeight = '220px'; resultsList.style.overflow = 'auto'; resultsList.style.marginTop = '6px';
    searchWrap.appendChild(prodInput); searchWrap.appendChild(resultsList);
    invoiceContainer.appendChild(searchWrap);

    // Table
    const table = document.createElement('table'); table.className = 'invoice-table'; table.id = 'invoiceTable';
    table.innerHTML = `<thead><tr><th>SKU</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Line Total</th><th>Action</th></tr></thead><tbody></tbody>
      <tfoot>
        <tr><td colspan="4" style="text-align:right;">Subtotal</td><td id="invSubtotal">$0.00</td><td></td></tr>
        <tr><td colspan="4" style="text-align:right;">Tax</td><td id="invTax">$0.00</td><td></td></tr>
        <tr><td colspan="4" style="text-align:right;font-weight:700;">Grand Total</td><td id="invTotal">$0.00</td><td></td></tr>
      </tfoot>`;
    invoiceContainer.appendChild(table);

// Actions
const actions = document.createElement('div'); 
actions.className = 'invoice-actions';

const printBtn = document.createElement('button'); 
printBtn.textContent = 'Print / PDF';
actions.appendChild(printBtn);

invoiceContainer.appendChild(actions);

// --- Search behavior: type then show matching items ---
prodInput.addEventListener('input', () => {
  const term = prodInput.value.trim().toLowerCase();
  resultsList.innerHTML = '';
  if (!term) return;
  const cust = custSelect.value;

  // prioritize products customer purchased
  const custMatches = products.filter(p => p.customer === cust && (p.description || '').toLowerCase().includes(term));
  const globalMatches = products.filter(p => (p.description || '').toLowerCase().includes(term));

  // Build unique SKU -> use last occurrence for each sku (latest date)
  const dedupe = new Map();
  (custMatches.length ? custMatches.concat(globalMatches) : globalMatches).forEach(p => {
    if (!dedupe.has(p.sku) || new Date(p.date) > new Date(dedupe.get(p.sku).date)) dedupe.set(p.sku, p);
  });

  // render results
  [...dedupe.values()].slice(0, 50).forEach(p => {
    let lastPrice = 0;
    if (cust) {
      const purchases = products
        .filter(x => x.customer === cust && x.sku === p.sku)
        .sort((a,b) => new Date(b.date) - new Date(a.date));
      if (purchases.length) lastPrice = Number(purchases[0].price) || 0;
    }

    const itemDiv = document.createElement('div');
    itemDiv.className = 'invoice-search-item';
    itemDiv.style.cssText = 'padding:6px;border:1px solid #eee;cursor:pointer;background:#fff;';
    itemDiv.innerHTML = `<strong>${escapeHtml(p.description)}</strong> — <small>${escapeHtml(p.sku)}</small> <span style="float:right">$${toMoney(lastPrice)}</span>`;
    
    itemDiv.addEventListener('click', () => {
      invoiceState.items.push({ sku: p.sku, description: p.description, qty: 1, unitPrice: lastPrice });
      prodInput.value = '';
      resultsList.innerHTML = '';
      renderInvoiceRows();
    });

    resultsList.appendChild(itemDiv);
  });
});

// --- render invoice rows ---
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
    </tr>`).join('');

  // attach handlers
  tbody.querySelectorAll('.inv-qty').forEach((el, idx) => {
    el.addEventListener('input', e => {
      const row = invoiceState.items[idx];
      row.qty = Math.max(1, Number(e.target.value) || 1);
      const lineCell = e.target.closest('tr').querySelector('.inv-line');
      lineCell.textContent = `$${toMoney(row.unitPrice * row.qty)}`;
      updateInvoiceTotals();
    });
  });

  tbody.querySelectorAll('.inv-price').forEach((el, idx) => {
    el.addEventListener('input', e => {
      const row = invoiceState.items[idx];
      row.unitPrice = Number(e.target.value) || 0;
      const lineCell = e.target.closest('tr').querySelector('.inv-line');
      lineCell.textContent = `$${toMoney(row.unitPrice * row.qty)}`;
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

// --- update totals ---
function updateInvoiceTotals() {
  const subtotal = invoiceState.items.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0), 0);
  const taxPct = Number(taxInput.value) || 0;
  const taxAmount = subtotal * taxPct / 100;
  const total = subtotal + taxAmount;

  invoiceState.taxPct = taxPct;
  invoiceState.customer = custSelect.value || '';
  invoiceState.invoiceNumber = invInput.value || generateInvoiceNumber();

  invoiceContainer.querySelector('#invSubtotal').textContent = `$${toMoney(subtotal)}`;
  invoiceContainer.querySelector('#invTax').textContent = `$${toMoney(taxAmount)}`;
  invoiceContainer.querySelector('#invTotal').textContent = `$${toMoney(total)}`;
}

// wire up tax / customer / invoice number inputs
taxInput.addEventListener('input', updateInvoiceTotals);
custSelect.addEventListener('change', () => {
  invoiceState.customer = custSelect.value;
  const ev = new Event('input'); prodInput.dispatchEvent(ev);
});
invInput.addEventListener('input', () => invoiceState.invoiceNumber = invInput.value);

// --- print PDF ---
printBtn.addEventListener('click', () => {
  invoiceState.date = new Date().toISOString();
  const popup = window.open('', '_blank', 'width=900,height=700');
  const rowsHtml = invoiceState.items.map(it => `<tr>
    <td>${escapeHtml(it.sku)}</td>
    <td>${escapeHtml(it.description)}</td>
    <td style="text-align:right">${it.qty}</td>
    <td style="text-align:right">$${toMoney(it.unitPrice)}</td>
    <td style="text-align:right">$${toMoney(it.qty*it.unitPrice)}</td>
  </tr>`).join('');

  const subtotal = invoiceState.items.reduce((s, it) => s + it.unitPrice*it.qty, 0);
  const tax = subtotal * (invoiceState.taxPct || 0) / 100;
  const total = subtotal + tax;

  popup.document.write(`
    <html><head><title>Invoice ${escapeHtml(invoiceState.invoiceNumber||'')}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px}</style>
    </head><body>
    <h2>Invoice: ${escapeHtml(invoiceState.invoiceNumber||'')}</h2>
    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Customer:</strong> ${escapeHtml(invoiceState.customer||'')}</p>
    <table>
      <thead><tr><th>SKU</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr><td colspan="4" style="text-align:right">Subtotal</td><td style="text-align:right">$${toMoney(subtotal)}</td></tr>
        <tr><td colspan="4" style="text-align:right">Tax (${toMoney(invoiceState.taxPct)}%)</td><td style="text-align:right">$${toMoney(tax)}</td></tr>
        <tr><td colspan="4" style="text-align:right;font-weight:700">Total</td><td style="text-align:right;font-weight:700">$${toMoney(total)}</td></tr>
      </tfoot>
    </table>
    </body></html>
  `);
  popup.document.close();
  popup.print();
});
  }

  function generateInvoiceNumber() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-001`;
  }

  // initial render for products/customers
  renderProductsList(products);
  populateSkuDropdown(products);
}

loadApp().catch(err => console.error('Failed to load app:', err));
