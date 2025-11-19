// app.js - Full integrated (Products / Customers / Invoices / Types)
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
    [productsSection, customersSection, invoicesSection, typesSection].forEach(s => s.classList.remove('active'));
    [productsTab, customersTab, invoicesTab, typesTab].forEach(t => t.classList.remove('active'));
    if (name === 'products') { productsSection.classList.add('active'); productsTab.classList.add('active'); productFilters.style.display = 'block'; }
    if (name === 'customers') { customersSection.classList.add('active'); customersTab.classList.add('active'); productFilters.style.display = 'none'; }
    if (name === 'invoices') { invoicesSection.classList.add('active'); invoicesTab.classList.add('active'); productFilters.style.display = 'none'; buildInvoiceUI(); }
    if (name === 'types') { typesSection.classList.add('active'); typesTab.classList.add('active'); productFilters.style.display = 'none'; buildTypesUI(); }
  }

  productsTab.addEventListener('click', () => showSection('products'));
  customersTab.addEventListener('click', () => showSection('customers'));
  invoicesTab.addEventListener('click', () => showSection('invoices'));
  typesTab.addEventListener('click', () => showSection('types'));

  showSection('products');

  // --- Utilities ---
  function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function toMoney(n) { return Number(n || 0).toFixed(2); }

  // --- PRODUCTS TAB ---
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

      const currentDate = new Date(p.date);
      if (!grouped[key].latestDate || currentDate > grouped[key].latestDate) {
        grouped[key].latestDate = currentDate;
        grouped[key].lastPrice = Number(p.price) || 0;
        grouped[key].lastCost  = Number(p.cost)  || 0;
      }
    });
    return Object.values(grouped).map(r => ({ ...r, lastPrice: r.lastPrice || 0, lastCost: r.lastCost || 0 }));
  }

  function renderProductBreakdownTable(data, skuForTitle) {
    if (!data || !data.length) { resultsContainer.innerHTML = `<p>No breakdown data for ${escapeHtml(skuForTitle)}</p>`; return; }
    resultsContainer.innerHTML = `<h3>Monthly Breakdown for SKU: ${escapeHtml(skuForTitle)}</h3>
      <table class="breakdown-table product-table" style="width:100%">
        <thead><tr>
          <th data-key="customer">Customer</th><th data-key="month">Month</th><th data-key="totalQty">Total Qty</th>
          <th data-key="lastPrice">Last Price</th><th data-key="lastCost">Last Cost</th>
        </tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td>${escapeHtml(r.customer)}</td>
          <td>${escapeHtml(r.month)}</td>
          <td style="text-align:right;">${r.totalQty}</td>
          <td style="text-align:right;">$${toMoney(r.lastPrice)}</td>
          <td style="text-align:right;">$${toMoney(r.lastCost)}</td>
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
    invoiceContainer.innerHTML='';
    const header=document.createElement('div'); header.className='invoice-header';
    const invInput=document.createElement('input'); invInput.placeholder='Invoice #';
    header.appendChild(invInput);
    const custSelect=document.createElement('select'); custSelect.id='invoiceCustomer';
    custSelect.innerHTML=`<option value="">Select Customer</option>`+[...new Set(products.map(p=>p.customer))].sort().map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    header.appendChild(custSelect);

    // --- Editable Customer Contact Fields ---
    const contactWrapper=document.createElement('div'); contactWrapper.style.marginTop='8px';
    function createContactField(labelText,id,value){const label=document.createElement('label');label.innerHTML=labelText;const input=document.createElement('input');input.type='text';input.id=id;input.value=value||'';label.appendChild(input);contactWrapper.appendChild(label);return input;}
    const invoiceState={items:[],contactName:'',contactPhone:'',contactEmail:'',customerAddress:'',taxPct:0,customer:'',invoiceNumber:''};
    const nameInput=createContactField('Contact Name: ','invoiceContactName',invoiceState.contactName);
    const phoneInput=createContactField(' Contact Tel#: ','invoiceContactPhone',invoiceState.contactPhone);
    const emailInput=createContactField(' Contact Email: ','invoiceContactEmail',invoiceState.contactEmail);
    const addrInput=createContactField(' Customer Address: ','invoiceContactAddress',invoiceState.customerAddress);
    header.appendChild(contactWrapper); invoiceContainer.appendChild(header);

    const taxLabel=document.createElement('label'); taxLabel.textContent='Tax %: '; const taxInput=document.createElement('input'); taxInput.type='number'; taxInput.value=0; taxLabel.appendChild(taxInput); header.appendChild(taxLabel);

    const searchWrap=document.createElement('div'); searchWrap.style.marginTop='0.75rem';
    const prodInput=document.createElement('input'); prodInput.id='invoiceProductSearch'; prodInput.placeholder='Type product description to search...'; prodInput.style.width='60%';
    const resultsList=document.createElement('div'); resultsList.id='invoiceSearchResults'; resultsList.style.position='relative'; resultsList.style.maxHeight='220px'; resultsList.style.overflow='auto'; resultsList.style.marginTop='6px';
    searchWrap.appendChild(prodInput); searchWrap.appendChild(resultsList); invoiceContainer.appendChild(searchWrap);

    const table=document.createElement('table'); table.id='invoiceTable'; table.className='invoice-table';
    table.innerHTML=`<thead>
      <tr><th>SKU</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Line Total</th><th>Action</th></tr>
    </thead>
    <tbody></tbody>
    <tfoot>
      <tr><td colspan="4" style="text-align:right;">Subtotal</td><td id="invSubtotal">$0.00</td><td></td></tr>
      <tr><td colspan="4" style="text-align:right;">Tax</td><td id="invTax">$0.00</td><td></td></tr>
      <tr><td colspan="4" style="text-align:right;font-weight:700;">Grand Total</td><td id="invTotal">$0.00</td><td></td></tr>
    </tfoot>`;
    invoiceContainer.appendChild(table);

    const actions=document.createElement('div'); actions.className='invoice-actions';
    const printBtn=document.createElement('button'); printBtn.textContent='Print / PDF'; actions.appendChild(printBtn); invoiceContainer.appendChild(actions);

    function renderInvoiceRows(){const tbody=table.querySelector('tbody');tbody.innerHTML=invoiceState.items.map((it,i)=>`<tr data-idx="${i}"><td>${escapeHtml(it.sku)}</td><td>${escapeHtml(it.description)}</td><td><input type="number" min="1" value="${it.qty}" class="inv-qty" style="width:70px;"></td><td><input type="number" step="0.01" value="${toMoney(it.unitPrice)}" class="inv-price" style="width:90px;"></td><td class="inv-line">$${toMoney(it.unitPrice*it.qty)}</td><td><button class="inv-remove">Remove</button></td></tr>`).join('');
      tbody.querySelectorAll('.inv-qty').forEach((el,idx)=>{el.addEventListener('input',e=>{invoiceState.items[idx].qty=Math.max(1,Number(e.target.value)||1); e.target.closest('tr').querySelector('.inv-line').textContent=`$${toMoney(invoiceState.items[idx].unitPrice*invoiceState.items[idx].qty)}`; updateInvoiceTotals(); });});
      tbody.querySelectorAll('.inv-price').forEach((el,idx)=>{el.addEventListener('input',e=>{invoiceState.items[idx].unitPrice=Number(e.target.value)||0; e.target.closest('tr').querySelector('.inv-line').textContent=`$${toMoney(invoiceState.items[idx].unitPrice*invoiceState.items[idx].qty)}`; updateInvoiceTotals(); });});
      tbody.querySelectorAll('.inv-remove').forEach((btn,idx)=>{btn.addEventListener('click',()=>{invoiceState.items.splice(idx,1); renderInvoiceRows();});});
      updateInvoiceTotals();
    }

    function updateInvoiceTotals(){const subtotal=invoiceState.items.reduce((s,it)=>s+it.qty*it.unitPrice,0); const taxPct=Number(taxInput.value)||0; const taxAmount=subtotal*taxPct/100; const total=subtotal+taxAmount; invoiceState.taxPct=taxPct; invoiceState.customer=custSelect.value||''; invoiceState.invoiceNumber=invInput.value||generateInvoiceNumber(); invoiceContainer.querySelector('#invSubtotal').textContent=`$${toMoney(subtotal)}`; invoiceContainer.querySelector('#invTax').textContent=`$${toMoney(taxAmount)}`; invoiceContainer.querySelector('#invTotal').textContent=`$${toMoney(total)}`; }

    taxInput.addEventListener('input',updateInvoiceTotals);
    custSelect.addEventListener('change',()=>{invoiceState.customer=custSelect.value; prodInput.dispatchEvent(new Event('input'));});
    invInput.addEventListener('input',()=>invoiceState.invoiceNumber=invInput.value);

    prodInput.addEventListener('input',()=>{
      const term=prodInput.value.trim().toLowerCase(); resultsList.innerHTML=''; if(!term) return; const cust=custSelect.value;
      const custMatches=products.filter(p=>p.customer===cust&&(p.description||'').toLowerCase().includes(term));
      const globalMatches=products.filter(p=>(p.description||'').toLowerCase().includes(term));
      const dedupe=new Map();(custMatches.length?custMatches.concat(globalMatches):globalMatches).forEach(p=>{if(!dedupe.has(p.sku)||new Date(p.date)>new Date(dedupe.get(p.sku).date)) dedupe.set(p.sku,p);});
      [...dedupe.values()].slice(0,50).forEach(p=>{
        let lastPrice=0;
        if(cust){ const purchases=products.filter(x=>x.customer===cust&&x.sku===p.sku).sort((a,b)=>new Date(b.date)-new Date(a.date)); if(purchases.length) lastPrice=Number(purchases[0].price)||0; }
        const itemDiv=document.createElement('div'); itemDiv.className='invoice-search-item'; itemDiv.style.cssText='padding:6px;border:1px solid #eee;cursor:pointer;background:#fff;';
        itemDiv.innerHTML=`<strong>${escapeHtml(p.description)}</strong> — <small>${escapeHtml(p.sku)}</small> <span style="float:right">$${toMoney(lastPrice)}</span>`;
        itemDiv.addEventListener('click',()=>{ invoiceState.items.push({sku:p.sku,description:p.description,qty:1,unitPrice:lastPrice}); prodInput.value=''; resultsList.innerHTML=''; renderInvoiceRows(); });
        resultsList.appendChild(itemDiv);
      });
    });

    printBtn.addEventListener('click',()=>{
      const popup=window.open('','_blank','width=900,height=700');
      const rowsHtml=invoiceState.items.map(it=>`<tr><td>${escapeHtml(it.sku)}</td><td>${escapeHtml(it.description)}</td><td style="text-align:right">${it.qty}</td><td style="text-align:right">$${toMoney(it.unitPrice)}</td><td style="text-align:right">$${toMoney(it.qty*it.unitPrice)}</td></tr>`).join('');
      const subtotal=invoiceState.items.reduce((s,it)=>s+it.unitPrice*it.qty,0);
      const tax=subtotal*(invoiceState.taxPct||0)/100; const total=subtotal+tax;
      const companyInfo={name:"Ecosanitary",contact:"Sung",phone:"(562) 207-3999",email:"sung@ecosanitary.com",address:"14423 Marquardt Avenue Santa Fe Springs CA. 90670"};
      const notesText=`Thank you for your business!<br>Please contact us if you have any questions about this invoice.<br>Payment terms: Net 0 days - Payment Due Upon Delivery.<br>Please make check payments to: ECO SANITARY`;
      popup.document.write(`<html><head><title>Invoice ${escapeHtml(invoiceState.invoiceNumber||'')}</title><style>
        body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#222;}
        h1,h2,h3{margin:0 0 6px 0;}
        .company-header{margin-bottom:20px;border-bottom:2px solid #000;padding-bottom:10px;}
        .company-header p{margin:2px 0;}
        table{width:100%;border-collapse:collapse;margin-top:12px;}
        th,td{border:1px solid #ccc;padding:6px;}
        tfoot td{font-weight:600;}
        .footer-notes{margin-top:25px;border-top:1px solid #aaa;padding-top:10px;font-size:0.9rem;}
      </style></head><body>
      <div class="company-header"><h2>${escapeHtml(companyInfo.name)}</h2><p><strong>Contact:</strong> ${escapeHtml(companyInfo.contact)}</p><p><strong>Phone:</strong> ${escapeHtml(companyInfo.phone)}</p><p><strong>Email:</strong> ${escapeHtml(companyInfo.email)}</p><p><strong>Address:</strong> ${escapeHtml(companyInfo.address)}</p></div>
      <h2>Invoice: ${escapeHtml(invoiceState.invoiceNumber||'')}</h2>
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Customer:</strong> ${escapeHtml(invoiceState.customer||'')}</p>
      <p><strong>Contact Name:</strong> ${escapeHtml(invoiceState.contactName||'')}</p>
      <p><strong>Phone:</strong> ${escapeHtml(invoiceState.contactPhone||'')}</p>
      <p><strong>Email:</strong> ${escapeHtml(invoiceState.contactEmail||'')}</p>
      <p><strong>Address:</strong> ${escapeHtml(invoiceState.customerAddress||'')}</p>
      <table><thead><tr><th>SKU</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead><tbody>${rowsHtml}</tbody><tfoot>
      <tr><td colspan="4" style="text-align:right">Subtotal</td><td style="text-align:right">$${toMoney(subtotal)}</td></tr>
      <tr><td colspan="4" style="text-align:right">Tax (${toMoney(invoiceState.taxPct)}%)</td><td style="text-align:right">$${toMoney(tax)}</td></tr>
      <tr><td colspan="4" style="text-align:right;font-weight:700">Total</td><td style="text-align:right;font-weight:700">$${toMoney(total)}</td></tr></tfoot></table>
      <div class="footer-notes"><strong>Notes:</strong><br>${notesText}</div></body></html>`);
      popup.document.close(); popup.print();
    });

  }

  function generateInvoiceNumber() { const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-001`; }

}

loadApp().catch(err=>console.error('Failed to load app:',err));
