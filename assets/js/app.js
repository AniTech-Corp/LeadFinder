// --- History Management ---
function loadCityHistory() {
    const history = JSON.parse(localStorage.getItem('citySearchHistory') || '["Bekasi", "Jakarta Selatan", "Bandung"]');
    const datalist = document.getElementById('cityHistory');
    if (datalist) {
        datalist.innerHTML = '';
        history.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            datalist.appendChild(option);
        });
    }
}

// --- SPA Router ---
async function loadView(viewName) {
    try {
        let fetchView = viewName;
        if (viewName.startsWith('cockpit_')) {
            fetchView = 'cockpit';
        } else if (viewName.startsWith('administrasi_')) {
            fetchView = 'administrasi';
        }

        const timestamp = new Date().getTime();
        const response = await fetch(`views/${fetchView}.html?t=${timestamp}`);
        if (!response.ok) throw new Error('View not found');
        const html = await response.text();
        document.getElementById('router-view').innerHTML = html;

        // Re-initialize scripts for specific views
        if (viewName === 'pencarian') {
            document.getElementById('searchBtn')?.addEventListener('click', startSearch);
            document.getElementById('exportBtn')?.addEventListener('click', exportAllFromDB);
            loadCityHistory();
        } else if (viewName === 'database') {
            initDatabase();
        } else if (viewName === 'dashboard') {
            initDashboard();
        } else if (viewName.startsWith('cockpit_')) {
            initCockpit(viewName);
        } else if (viewName.startsWith('administrasi_')) {
            initAdministrasi(viewName);
        }

        // Update Sidebar Active States
        document.querySelectorAll('.nav-link').forEach(link => {
            const isCockpitOrAdmin = (link.dataset.view && link.dataset.view.startsWith('cockpit_')) ||
                (link.dataset.view && link.dataset.view.startsWith('administrasi_'));

            if (link.dataset.view === viewName) {
                // Active state
                if (isCockpitOrAdmin) {
                    link.className = `nav-link flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 text-blue-600 font-medium transition-colors text-[13px] border-l-[3px] border-blue-600`;
                } else {
                    link.className = `nav-link flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-light text-primary font-semibold transition-colors`;
                }
            } else {
                // Inactive state
                if (isCockpitOrAdmin) {
                    link.className = `nav-link flex items-center justify-between px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium transition-colors text-[13px]`;
                } else {
                    link.className = `nav-link flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium transition-colors`;
                }
            }
        });

    } catch (error) {
        document.getElementById('router-view').innerHTML = `<div class="p-8 text-center text-rose-500 font-bold"><i class="ri-error-warning-line text-4xl mb-2"></i><br>Halaman tidak ditemukan.</div>`;
    }
}

// Bind navigation clicks
document.addEventListener('click', e => {
    const link = e.target.closest('.nav-link');
    if (link) {
        e.preventDefault();
        const view = link.dataset.view;
        if (view) loadView(view);
    }
});


let currentPage = 1;
const itemsPerPage = 5;

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (currentLeads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="p-12 text-center text-slate-400">Belum ada data. Silakan lakukan pencarian di area target Anda.</td></tr>`;
        document.getElementById('showingText').innerText = `Menampilkan 0 hasil`;
        document.getElementById('paginationContainer').innerHTML = '';
        return;
    }

    const displayLeads = currentLeads.filter(l => !l.website);

    if (displayLeads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="p-12 text-center text-slate-400">Semua UMKM yang ditemukan sudah memiliki website.</td></tr>`;
        document.getElementById('showingText').innerText = `Menampilkan 0 hasil`;
        document.getElementById('paginationContainer').innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(displayLeads.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, displayLeads.length);

    document.getElementById('showingText').innerText = `Menampilkan ${startIndex + 1} - ${endIndex} dari ${displayLeads.length} hasil`;
    renderPagination(totalPages);

    const pageData = displayLeads.slice(startIndex, endIndex);

    pageData.forEach((lead, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";

        const name = lead.title || '-';
        const category = lead.searchCategory || 'Lainnya';
        const phone = lead.phoneNumber || '-';
        const rating = lead.rating || '-';
        const reviews = lead.user_ratings_total || '0';
        const score = lead.score || 0;
        const mapsUrl = lead.cid ? `https://www.google.com/maps?cid=${lead.cid}` : '#';

        let priorityClass = 'text-slate-600 bg-slate-50 border border-slate-200';
        let priorityIcon = 'ri-star-line';
        if (lead.priority === 'Tinggi') {
            priorityClass = 'text-rose-500 bg-rose-50 border border-rose-100';
            priorityIcon = 'ri-star-fill';
        } else if (lead.priority === 'Menengah') {
            priorityClass = 'text-amber-500 bg-amber-50 border border-amber-100';
            priorityIcon = 'ri-star-half-line';
        }

        let kecamatan = "Bekasi";
        if (lead.address) {
            const parts = lead.address.split(',');
            if (parts.length > 2) kecamatan = parts[parts.length - 3].trim();
            else kecamatan = parts[0].trim();
        }

        let igDisplay = `<span class="text-slate-300"><i class="ri-search-eye-line animate-pulse"></i></span>`;
        if (lead.igUrl === 'Tidak Ditemukan') igDisplay = `<span class="text-slate-400">-</span>`;
        else if (lead.igUrl && lead.igUrl.includes('http')) {
            const handle = lead.igUrl.split('/').filter(Boolean).pop();
            igDisplay = `<a href="${lead.igUrl}" target="_blank" class="text-pink-500 hover:underline flex items-center gap-1.5"><i class="ri-instagram-fill"></i> @${handle}</a>`;
        }

        const phoneWa = phone !== '-' ? phone.replace(/[^0-9]/g, '').replace(/^0/, '62') : '';

        // Generate dummy initial avatar based on name
        const initial = name.charAt(0).toUpperCase();

        const trueIndex = startIndex + idx;

        tr.innerHTML = `
            <td class="py-3 px-4"><input type="checkbox" class="table-checkbox"></td>
            <td class="py-3 px-4 text-center text-slate-500">${trueIndex + 1}</td>
            <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-orange-800 text-white flex items-center justify-center font-bold text-xs shrink-0">${initial}</div>
                    <span class="font-bold text-slate-800">${name}</span>
                </div>
            </td>
            <td class="py-3 px-4"><span class="text-blue-500 text-xs font-bold">${category}</span></td>
            <td class="py-3 px-4">${kecamatan}</td>
            <td class="py-3 px-4">${phone}</td>
            <td class="py-3 px-4" id="td-ig-${idx}">${igDisplay}</td>
            <td class="py-3 px-4 text-slate-400">-</td>
            <td class="py-3 px-4 text-amber-500 font-bold"><i class="ri-star-fill"></i> ${rating}</td>
            <td class="py-3 px-4 text-slate-500"><i class="ri-chat-1-line text-slate-400"></i> ${reviews}</td>
            <td class="py-3 px-4"><div class="flex items-center gap-1.5 font-bold"><i class="ri-pie-chart-2-fill text-slate-400"></i> ${score}</div></td>
            <td class="py-3 px-4">
                <span class="px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max ${priorityClass}">
                    <i class="${priorityIcon}"></i> ${lead.priority}
                </span>
            </td>
            <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    ${phoneWa ? `<a href="https://wa.me/${phoneWa}" target="_blank" class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors"><i class="ri-whatsapp-fill"></i></a>` : `<span class="w-7 h-7 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center"><i class="ri-whatsapp-fill"></i></span>`}
                    <a href="${mapsUrl}" target="_blank" class="text-slate-400 hover:text-slate-600"><i class="ri-link"></i></a>
                    <button class="text-slate-400 hover:text-slate-600"><i class="ri-more-2-fill"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPagination(totalPages) {
    const container = document.getElementById('paginationContainer');
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const createBtn = (text, onClick, isActive, isDisabled) => {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        if (isActive) {
            btn.className = "w-8 h-8 rounded bg-primary text-white flex items-center justify-center font-bold";
        } else if (isDisabled) {
            btn.className = "w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-300 cursor-not-allowed";
            btn.disabled = true;
        } else {
            btn.className = "w-8 h-8 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600";
            btn.onclick = onClick;
        }
        return btn;
    };

    container.appendChild(createBtn('<i class="ri-arrow-left-s-line"></i>', () => changePage(currentPage - 1), false, currentPage === 1));

    // Simple windowed pagination
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        container.appendChild(createBtn('1', () => changePage(1), false, false));
        if (startPage > 2) {
            const el = document.createElement('span'); el.className = "px-1 text-slate-400"; el.innerText = "...";
            container.appendChild(el);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        container.appendChild(createBtn(i.toString(), () => changePage(i), currentPage === i, false));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const el = document.createElement('span'); el.className = "px-1 text-slate-400"; el.innerText = "...";
            container.appendChild(el);
        }
        container.appendChild(createBtn(totalPages.toString(), () => changePage(totalPages), false, false));
    }

    container.appendChild(createBtn('<i class="ri-arrow-right-s-line"></i>', () => changePage(currentPage + 1), false, currentPage === totalPages));
}

function changePage(page) {
    currentPage = page;
    renderTable();
}

async function startSearch() {
    const btn = document.getElementById('searchBtn');
    const cityInput = document.getElementById('cityInput');
    const city = cityInput.value.trim();

    if (!city) {
        alert("Mohon masukkan Kota / Area");
        return;
    }

    // Save city to history
    saveCityHistory(city);

    const checkedCats = Array.from(document.querySelectorAll('.cat-checkbox.active input:checked')).map(cb => cb.value);

    if (checkedCats.length === 0) {
        alert("Mohon pilih minimal 1 kategori UMKM");
        return;
    }

    btn.innerHTML = `<i class="ri-loader-4-line animate-spin text-lg"></i> Mencari...`;
    btn.disabled = true;

    currentPage = 1;
    currentLeads = [];
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="13" class="p-12 text-center text-slate-400"><i class="ri-loader-4-line animate-spin text-3xl text-primary mb-4 block"></i>Sistem AI sedang menarik dan menganalisa data dari ${checkedCats.length} kategori di ${city}...</td></tr>`;
    document.getElementById('paginationContainer').innerHTML = '';

    try {
        let allResults = [];

        const promises = checkedCats.map(async (cat) => {
            const query = `${cat} di ${city}`;
            try {
                const res = await fetch('backend/api.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: query, type: 'places' })
                });
                const data = await res.json();
                if (data.places) {
                    data.places.forEach(p => { p.searchCategory = cat; allResults.push(p); });
                }
            } catch (e) {
                console.error("Failed to fetch", cat);
            }
        });

        await Promise.all(promises);

        const unique = [];
        const seen = new Set();
        allResults.forEach(p => {
            const id = p.cid || p.title;
            if (!seen.has(id)) {
                seen.add(id);
                unique.push(p);
            }
        });

        currentLeads = unique;
        updateStats();
        renderTable();

        runDeepHunt();

    } catch (e) {
        alert("Gagal melakukan pencarian: " + e.message);
    } finally {
        btn.innerHTML = `<i class="ri-play-fill text-lg"></i> Mulai Pencarian`;
        btn.disabled = false;
    }
}

async function runDeepHunt() {
    const displayLeads = currentLeads.filter(l => !l.website);

    for (let i = 0; i < displayLeads.length; i++) {
        const lead = displayLeads[i];
        try {
            const res = await fetch('backend/api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: `${lead.title} ${lead.address} instagram`, type: 'search' })
            });
            const result = await res.json();

            let foundIg = null;
            if (result.organic) {
                for (const org of result.organic) {
                    if (org.link.includes('instagram.com')) {
                        // Extract clean username
                        const match = org.link.match(/instagram\.com\/([A-Za-z0-9_.]+)/);
                        if (match && match[1]) {
                            const username = match[1];
                            const blocked = ['p', 'reel', 'explore', 'stories', 'tv', 'tags', 'dir'];
                            if (!blocked.includes(username.toLowerCase())) {
                                foundIg = username;
                                break;
                            }
                        }
                    }
                }
            }

            lead.igUrl = foundIg ? `https://instagram.com/${foundIg}` : "Tidak Ditemukan";

            const cell = document.getElementById(`td-ig-${i}`);
            if (cell) {
                if (foundIg) {
                    cell.innerHTML = `<a href="https://instagram.com/${foundIg}" target="_blank" class="text-pink-500 hover:underline flex items-center gap-1.5"><i class="ri-instagram-fill"></i> @${foundIg}</a>`;
                } else {
                    cell.innerHTML = `<span class="text-slate-400">-</span>`;
                }
            }

            updateStats();

        } catch (e) {
            lead.igUrl = "Tidak Ditemukan";
            const cell = document.getElementById(`td-ig-${i}`);
            if (cell) cell.innerHTML = `<span class="text-slate-400">-</span>`;
        }

        // Save to Database
        await saveLeadToDB(lead);
        updateSidebarBadges(); // Live update sidebar
    }
}

async function saveLeadToDB(lead) {
    try {
        await fetch('backend/crm_api.php?action=save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cid: lead.cid,
                title: lead.title,
                address: lead.address,
                phone: lead.phoneNumber,
                website: lead.website,
                ig_url: lead.igUrl,
                industry: lead.searchCategory,
                score: lead.score
            })
        });
    } catch (e) {
        console.error('Failed to save lead', e);
    }
}

// --- History Management ---
function loadCityHistory() {
    const history = JSON.parse(localStorage.getItem('citySearchHistory') || '["Bekasi", "Jakarta Selatan", "Bandung"]');
    const datalist = document.getElementById('cityHistory');
    if (datalist) {
        datalist.innerHTML = '';
        history.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            datalist.appendChild(option);
        });
    }
}

function saveCityHistory(city) {
    let history = JSON.parse(localStorage.getItem('citySearchHistory') || '["Bekasi", "Jakarta Selatan", "Bandung"]');
    if (!history.includes(city)) {
        history.unshift(city);
        if (history.length > 10) history.pop(); // Keep last 10
        localStorage.setItem('citySearchHistory', JSON.stringify(history));
        loadCityHistory();
    }
}

let currentLeads = [];

function updateStats() {
    const total = currentLeads.length;
    const noWeb = currentLeads.filter(l => !l.website).length;
    const igFound = currentLeads.filter(l => l.igUrl && l.igUrl.includes('instagram.com')).length;

    let high = 0, mid = 0, low = 0;

    currentLeads.forEach(lead => {
        if (!lead.score) {
            let score = 40;
            if (lead.phoneNumber) score += 20;
            if (lead.rating > 4) score += 20;
            if (lead.user_ratings_total > 50) score += 10;
            if (lead.igUrl && lead.igUrl.includes('instagram.com')) score += 10;
            lead.score = score > 100 ? 100 : score;

            if (lead.score >= 70) lead.priority = 'Tinggi';
            else if (lead.score >= 50) lead.priority = 'Menengah';
            else lead.priority = 'Rendah';
        }

        if (lead.priority === 'Tinggi') high++;
        else if (lead.priority === 'Menengah') mid++;
        else low++;
    });

    const el = id => document.getElementById(id);
    if (el('stat-total')) el('stat-total').innerText = noWeb;
    if (el('stat-ig')) {
        el('stat-ig').innerText = igFound;
        el('stat-ig-desc').innerText = total > 0 ? Math.round((igFound / total) * 100) + '% dari total' : '0% dari total';
    }
    if (el('stat-high')) el('stat-high').innerText = high;
    if (el('stat-mid')) el('stat-mid').innerText = mid;
    if (el('stat-low')) el('stat-low').innerText = low;

    if (el('sum-total')) el('sum-total').innerText = total;
    if (el('sum-noweb')) el('sum-noweb').innerText = noWeb;
    if (el('sum-ig')) el('sum-ig').innerText = igFound;
    if (el('sum-high')) el('sum-high').innerText = high;
    if (el('sum-mid')) el('sum-mid').innerText = mid;
    if (el('sum-low')) el('sum-low').innerText = low;
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

let realtimeInterval = null;

function initApp() {
    loadView('dashboard');
    updateSidebarBadges();

    // Start realtime dashboard & badges polling
    if (realtimeInterval) clearInterval(realtimeInterval);
    realtimeInterval = setInterval(() => {
        updateSidebarBadges();
        // If dashboard view is active, update dashboard stats without full re-render
        if (document.getElementById('dash_total')) {
            initDashboard(true);
        }
    }, 5000); // 5 seconds interval for real-time feel

    // Bind logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('Apakah Anda yakin ingin keluar?')) {
                await fetch('backend/auth.php?action=logout');
                window.location.href = 'login.php';
            }
        });
    }

    // Bind dropdown toggle
    const cockpitToggle = document.getElementById('cockpitToggle');
    const cockpitDropdown = document.getElementById('cockpitDropdown');
    const cockpitCaret = document.getElementById('cockpitCaret');
    if (cockpitToggle && cockpitDropdown && cockpitCaret) {
        cockpitToggle.addEventListener('click', () => {
            cockpitDropdown.classList.toggle('hidden');
            if (cockpitDropdown.classList.contains('hidden')) {
                cockpitCaret.classList.replace('ri-arrow-down-s-line', 'ri-arrow-right-s-line');
            } else {
                cockpitCaret.classList.replace('ri-arrow-right-s-line', 'ri-arrow-down-s-line');
            }
        });
    }
}

async function updateSidebarBadges() {
    try {
        const response = await fetch('backend/crm_api.php?action=get');
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            let counts = { prioritas: 0, baru: 0, telepon: 0, followup: 0, demo: 0, cut: 0, antrian: 0, selesai: 0 };

            result.data.forEach(lead => {
                const status = (lead.status || 'baru').toLowerCase();

                if (status === 'baru') counts.baru++;
                else if (status === 'telepon_lagi') counts.telepon++;
                else if (status === 'follow_up') counts.followup++;
                else if (status === 'demo') counts.demo++;
                else if (status === 'cut') counts.cut++;
                else if (status === 'antrian') counts.antrian++;
                else if (status === 'selesai' || status === 'closing') counts.selesai++;

                if (lead.score >= 70 && status !== 'cut' && status !== 'closing' && status !== 'selesai' && status !== 'antrian' && status !== 'tersimpan') counts.prioritas++;
            });

            const setBadge = (id, count) => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerText = count;
                    const baseClass = "text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors";

                    if (count > 0) {
                        if (id === 'badge_prioritas') el.className = `${baseClass} bg-rose-100 text-rose-600`;
                        else if (id === 'badge_baru') el.className = `${baseClass} bg-blue-100 text-blue-600`;
                        else if (id === 'badge_telepon') el.className = `${baseClass} bg-amber-100 text-amber-600`;
                        else if (id === 'badge_followup') el.className = `${baseClass} bg-emerald-100 text-emerald-600`;
                        else if (id === 'badge_demo') el.className = `${baseClass} bg-purple-100 text-purple-600`;
                        else if (id === 'badge_cut') el.className = `${baseClass} bg-slate-200 text-slate-700`;
                        else if (id === 'badge_antrian') el.className = `${baseClass} bg-indigo-100 text-indigo-600`;
                        else if (id === 'badge_selesai') el.className = `${baseClass} bg-emerald-100 text-emerald-600`;
                        else el.className = `${baseClass} bg-blue-50 text-blue-500`;
                    } else {
                        el.className = `${baseClass} bg-slate-100 text-slate-400`;
                    }
                }
            };

            setBadge('badge_prioritas', counts.prioritas);
            setBadge('badge_baru', counts.baru);
            setBadge('badge_telepon', counts.telepon);
            setBadge('badge_followup', counts.followup);
            setBadge('badge_demo', counts.demo);
            setBadge('badge_cut', counts.cut);
            setBadge('badge_antrian', counts.antrian);
            setBadge('badge_selesai', counts.selesai);
        }
    } catch (e) {
        console.error("Failed to update sidebar badges", e);
    }
}

async function initDashboard(isRealtimeUpdate = false) {
    try {
        const periodFilter = document.getElementById('dash_period_filter');
        const period = periodFilter ? periodFilter.value : '10'; // default to October

        if (periodFilter && !periodFilter.dataset.listenerAttached) {
            periodFilter.addEventListener('change', () => {
                initDashboard();
            });
            periodFilter.dataset.listenerAttached = 'true';
        }

        const response = await fetch(`backend/crm_api.php?action=dashboard_stats&period=${period}`);
        const result = await response.json();

        if (result.status === 'success') {
            const data = result.data;

            // Top Metrics
            if (document.getElementById('dash_total')) document.getElementById('dash_total').innerText = data.total || 0;
            if (document.getElementById('dash_follow_up')) document.getElementById('dash_follow_up').innerText = data.follow_up || 0;
            if (document.getElementById('dash_demo')) document.getElementById('dash_demo').innerText = data.demo || 0;
            if (document.getElementById('dash_closing')) document.getElementById('dash_closing').innerText = data.closing || 0;

            // Industries
            const industries = ['Kuliner', 'Fashion', 'Kecantikan', 'Laundry', 'Toko Retail', 'Florist', 'Catering', 'Percetakan', 'Lainnya'];
            industries.forEach(cat => {
                const el = document.getElementById('dash_cat_' + cat);
                if (el) {
                    el.innerText = data.industry[cat] || 0;
                }
            });

            // Priorities
            const pri = data.priority;
            const total = (pri.tinggi * 1) + (pri.menengah * 1) + (pri.rendah * 1) || 1; // prevent divide by zero

            if (document.getElementById('dash_pri_tinggi')) document.getElementById('dash_pri_tinggi').innerText = pri.tinggi;
            if (document.getElementById('dash_bar_tinggi')) document.getElementById('dash_bar_tinggi').style.width = Math.round((pri.tinggi / total) * 100) + '%';

            if (document.getElementById('dash_pri_menengah')) document.getElementById('dash_pri_menengah').innerText = pri.menengah;
            if (document.getElementById('dash_bar_menengah')) document.getElementById('dash_bar_menengah').style.width = Math.round((pri.menengah / total) * 100) + '%';

            if (document.getElementById('dash_pri_rendah')) document.getElementById('dash_pri_rendah').innerText = pri.rendah;
            if (document.getElementById('dash_bar_rendah')) document.getElementById('dash_bar_rendah').style.width = Math.round((pri.rendah / total) * 100) + '%';

            // Initialize Chart dynamically based on data.closing
            const totalSelesai = parseInt(data.closing || 0);

            // Generate data up to the current week dynamically
            const d = new Date().getDate();
            let currentWeek = Math.ceil(d / 7);
            if (currentWeek > 4) currentWeek = 4;

            let wData = [0, 0, 0, 0];

            let remaining = totalSelesai;
            for (let i = 0; i < currentWeek; i++) {
                if (i === currentWeek - 1) {
                    wData[i] = remaining;
                } else {
                    let portion = Math.floor(totalSelesai / currentWeek);
                    wData[i] = portion;
                    remaining -= portion;
                }
            }

            const ctx = document.getElementById('prospekChart');
            if (ctx) {
                if (window.prospekChartInstance) {
                    if (isRealtimeUpdate) {
                        window.prospekChartInstance.data.datasets[0].data = wData;
                        window.prospekChartInstance.update('none');
                    } else {
                        window.prospekChartInstance.destroy();
                        window.prospekChartInstance = null;
                    }
                }
                if (!window.prospekChartInstance) {
                    window.prospekChartInstance = new Chart(ctx, {
                        type: 'line',
                    data: {
                        labels: ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4'],
                        datasets: [{
                            label: 'Project Selesai',
                            data: wData,
                            borderColor: '#3b82f6', // Tailwind blue-500
                            backgroundColor: '#3b82f6',
                            borderWidth: 4,
                            pointBackgroundColor: '#3b82f6',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 6,
                            fill: false,
                            tension: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                min: 0,
                                suggestedMax: 20,
                                ticks: {
                                    stepSize: 5,
                                    precision: 0,
                                    font: { weight: 'bold', color: '#475569' },
                                    padding: 10
                                },
                                grid: {
                                    drawOnChartArea: true,
                                    drawTicks: true,
                                    tickLength: 6,
                                    color: '#f1f5f9'
                                },
                                border: { display: true, width: 2, color: '#334155' }
                            },
                            x: {
                                ticks: {
                                    font: { weight: 'bold', color: '#475569' },
                                    padding: 10
                                },
                                grid: { drawOnChartArea: false, drawTicks: true, tickLength: 6, color: '#334155' },
                                border: { display: true, width: 2, color: '#334155' }
                            }
                        }
                    }
                    });
                }
            }

            // Render Jadwal Hari Ini
            const scheduleList = document.getElementById('dash_schedule_list');
            if (scheduleList) {
                scheduleList.innerHTML = '';
                const jadwalData = data.jadwal_hari_ini || [];

                if (jadwalData.length === 0) {
                    scheduleList.innerHTML = `<div class="p-4 text-center text-slate-500 text-sm mt-4">Tidak ada jadwal follow up untuk hari ini.</div>`;
                } else {
                    jadwalData.forEach(item => {
                        let icon = 'ri-time-line';
                        let colorClass = 'bg-slate-100 text-slate-500 hover:border-slate-300';
                        let iconBg = 'bg-slate-100 text-slate-500 group-hover:bg-slate-500';
                        let textHover = 'group-hover:text-slate-600';
                        let statusLabel = 'Tindak Lanjut';

                        if (item.status === 'follow_up') {
                            icon = 'ri-chat-4-line';
                            colorClass = 'hover:border-blue-200';
                            iconBg = 'bg-blue-100 text-blue-500 group-hover:bg-blue-500';
                            textHover = 'group-hover:text-blue-600';
                            statusLabel = 'Kirim Pesan / Follow Up';
                        } else if (item.status === 'demo') {
                            icon = 'ri-presentation-line';
                            colorClass = 'hover:border-purple-200';
                            iconBg = 'bg-purple-100 text-purple-500 group-hover:bg-purple-500';
                            textHover = 'group-hover:text-purple-600';
                            statusLabel = 'Jadwal Demo Sistem';
                        } else if (item.status === 'telepon_lagi') {
                            icon = 'ri-phone-line';
                            colorClass = 'hover:border-amber-200';
                            iconBg = 'bg-amber-100 text-amber-500 group-hover:bg-amber-500';
                            textHover = 'group-hover:text-amber-600';
                            statusLabel = 'Butuh Ditelpon Lagi';
                        } else if (item.status === 'antrian') {
                            icon = 'ri-macbook-line';
                            colorClass = 'hover:border-emerald-200';
                            iconBg = 'bg-emerald-100 text-emerald-500 group-hover:bg-emerald-500';
                            textHover = 'group-hover:text-emerald-600';
                            statusLabel = 'Persiapan Project (Antrian)';
                        } else {
                            icon = 'ri-checkbox-circle-line';
                            colorClass = 'hover:border-slate-300';
                            iconBg = 'bg-slate-200 text-slate-600 group-hover:bg-slate-600';
                            textHover = 'group-hover:text-slate-700';
                            statusLabel = 'Lainnya';
                        }

                        const timeStr = item.jadwal_action.split('T')[1] || item.jadwal_action.split(' ')[1] || 'Waktu tidak ditentukan';

                        scheduleList.innerHTML += `
                        <div class="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 transition-colors cursor-pointer group ${colorClass}">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 group-hover:text-white transition-colors ${iconBg}">
                                <i class="${icon}"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-sm text-slate-700 transition-colors ${textHover}">${item.title}</h4>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-[11px] font-semibold tracking-wide ${textHover.replace('group-hover:', '')}">${statusLabel}</span>
                                    <span class="text-[10px] text-slate-300">•</span>
                                    <span class="text-[11px] text-slate-500"><i class="ri-time-line text-slate-400"></i> ${timeStr} WIB</span>
                                </div>
                            </div>
                        </div>
                    `;
                    });
                }
            }
            const downloadBtn = document.getElementById('downloadReportBtn');
            if (downloadBtn) {
                // Remove old listeners to prevent multiple firing when re-initializing
                const newBtn = downloadBtn.cloneNode(true);
                downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
                newBtn.addEventListener('change', (e) => {
                    const format = e.target.value;
                    if (format) {
                        exportDashboardReport(period, format);
                    }
                });
            }

        } // Close if (result.status === 'success')
    } catch (e) {
        console.error("Failed to init dashboard", e);
    }
}

async function exportDashboardReport(period, formatInput) {
    try {
        const format = formatInput || 'excel';
        const btn = document.getElementById('downloadReportBtn');
        if (btn) {
            btn.disabled = true;
        }

        const response = await fetch(`backend/crm_api.php?action=dashboard_stats&period=${period}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            const data = result.data;
            const baseFilename = `Laporan_Dashboard_AniScout_${period}_${new Date().getTime()}`;

            // Data untuk Ringkasan Utama
            const ringkasanData = [
                {"Metrik": "Total Prospek Keseluruhan", "Jumlah": data.total || 0},
                {"Metrik": "Total Project Closing / Selesai", "Jumlah": data.closing || 0},
                {"Metrik": "Total Menunggu Demo Sistem", "Jumlah": data.demo || 0},
                {"Metrik": "Total Butuh Follow Up", "Jumlah": data.follow_up || 0},
                {"Metrik": "Prioritas Tinggi", "Jumlah": data.priority?.tinggi || 0},
                {"Metrik": "Prioritas Menengah", "Jumlah": data.priority?.menengah || 0},
                {"Metrik": "Prioritas Rendah", "Jumlah": data.priority?.rendah || 0}
            ];

            // Data untuk Jadwal Hari Ini
            const jadwalData = (data.jadwal_hari_ini || []).map((j, idx) => ({
                "No": idx + 1,
                "Nama Klien": j.title,
                "Status Saat Ini": j.status,
                "Waktu Jadwal": (j.jadwal_action.split('T')[1] || j.jadwal_action.split(' ')[1] || '-') + " WIB"
            }));


            if (format === 'excel') {
                const workbook = XLSX.utils.book_new();
                
                // Sheet 1: Ringkasan
                const wsRingkasan = XLSX.utils.json_to_sheet(ringkasanData);
                wsRingkasan['!cols'] = [{ wch: 40 }, { wch: 20 }];
                XLSX.utils.book_append_sheet(workbook, wsRingkasan, "Ringkasan Performa");
                
                // Sheet 2: Jadwal Hari Ini
                let wsJadwal;
                if (jadwalData.length > 0) {
                    wsJadwal = XLSX.utils.json_to_sheet(jadwalData);
                } else {
                    wsJadwal = XLSX.utils.json_to_sheet([{"Pesan": "Tidak ada jadwal untuk hari ini."}]);
                }
                wsJadwal['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 25 }, { wch: 20 }];
                XLSX.utils.book_append_sheet(workbook, wsJadwal, "Jadwal Hari Ini");

                XLSX.writeFile(workbook, baseFilename + '.xlsx');
            } else if (format === 'word') {
                let html = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Laporan Dashboard</title></head><body style='font-family: Arial, sans-serif;'>";
                html += "<h2 style='color:#1e3a8a;'>Laporan Kinerja & Ringkasan Dashboard (Ani-Scout)</h2><hr/>";
                
                html += "<h3>1. Ringkasan Utama</h3>";
                html += "<table border='1' cellpadding='8' style='border-collapse: collapse; width: 100%; margin-bottom: 20px;'>";
                html += "<tr style='background-color:#1e3a8a; color:white;'><th style='text-align:left;'>Metrik</th><th style='text-align:left;'>Jumlah</th></tr>";
                ringkasanData.forEach(r => {
                    html += `<tr><td>${r.Metrik}</td><td><strong>${r.Jumlah}</strong></td></tr>`;
                });
                html += "</table>";

                html += "<h3>2. Jadwal Hari Ini</h3>";
                if (jadwalData.length > 0) {
                    html += "<table border='1' cellpadding='8' style='border-collapse: collapse; width: 100%;'>";
                    html += "<tr style='background-color:#0f766e; color:white;'><th style='text-align:left;'>No</th><th style='text-align:left;'>Nama Klien</th><th style='text-align:left;'>Status</th><th style='text-align:left;'>Waktu</th></tr>";
                    jadwalData.forEach(j => {
                        html += `<tr><td>${j.No}</td><td>${j['Nama Klien']}</td><td>${j['Status Saat Ini']}</td><td>${j['Waktu Jadwal']}</td></tr>`;
                    });
                    html += "</table>";
                } else {
                    html += "<p><em>Tidak ada jadwal tindakan untuk hari ini.</em></p>";
                }

                html += "<p style='margin-top: 30px; font-size: 11px; color: #666;'>Document generated by Ani-Scout.</p>";
                html += "</body></html>";

                const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = baseFilename + ".doc";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else if (format === 'pdf') {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'pt', 'a4'); // Portrait

                doc.setFontSize(16);
                doc.setTextColor(30, 58, 138); // #1e3a8a
                doc.text("Laporan Kinerja & Ringkasan Dashboard", 40, 40);
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text("Generated by Ani-Scout | Periode: " + period, 40, 55);

                // Table Ringkasan
                doc.setFontSize(12);
                doc.setTextColor(0, 0, 0);
                doc.text("1. Ringkasan Utama", 40, 80);
                
                doc.autoTable({
                    startY: 90,
                    head: [["Metrik", "Jumlah"]],
                    body: ringkasanData.map(r => [r.Metrik, r.Jumlah]),
                    styles: { fontSize: 9, cellPadding: 4 },
                    headStyles: { fillColor: [30, 58, 138] },
                    margin: { left: 40, right: 40 }
                });

                // Table Jadwal
                let finalY = doc.lastAutoTable.finalY || 90;
                doc.setFontSize(12);
                doc.text("2. Jadwal Tindakan Hari Ini", 40, finalY + 30);

                if (jadwalData.length > 0) {
                    doc.autoTable({
                        startY: finalY + 40,
                        head: [["No", "Nama Klien", "Status", "Waktu"]],
                        body: jadwalData.map(j => [j.No, j['Nama Klien'], j['Status Saat Ini'], j['Waktu Jadwal']]),
                        styles: { fontSize: 9, cellPadding: 4 },
                        headStyles: { fillColor: [15, 118, 110] }, // teal
                        margin: { left: 40, right: 40 }
                    });
                } else {
                    doc.setFontSize(10);
                    doc.setTextColor(150, 150, 150);
                    doc.text("Tidak ada jadwal tindakan untuk hari ini.", 40, finalY + 45);
                }

                doc.save(baseFilename + ".pdf");
            }

            alert("Berhasil mengunduh " + result.data.length + " data laporan!");
        } else {
            alert("Tidak ada data pada periode ini untuk diunduh.");
        }
    } catch (e) {
        alert("Gagal mengunduh laporan: " + e.message);
    } finally {
        const btn = document.getElementById('downloadReportBtn');
        if (btn) {
            btn.value = "";
            btn.disabled = false;
        }
    }
}

async function exportAllFromDB() {
    try {
        const btn = document.getElementById('exportBtn');
        if (btn) {
            btn.innerHTML = `<i class="ri-loader-4-line animate-spin"></i> Mengekspor...`;
            btn.disabled = true;
        }

        const response = await fetch('backend/crm_api.php?action=get');
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.length > 0) {
            // Mapping for Excel Headers
            const exportData = result.data.map((lead, index) => ({
                "No": index + 1,
                "Nama UMKM": lead.title,
                "Kategori / Industri": lead.industry,
                "Alamat": lead.address,
                "No. Telepon": lead.phone,
                "WhatsApp": lead.phone ? `https://wa.me/${lead.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}` : '',
                "Instagram": lead.ig_url !== 'Tidak Ditemukan' && lead.ig_url ? lead.ig_url : '-',
                "Website": lead.website || '-',
                "Skor Prioritas": lead.score,
                "Status": lead.status,
                "Tanggal Ditarik": lead.created_at
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportData);

            // Set column widths for better readability (Lebih lebar lagi)
            worksheet['!cols'] = [
                { wch: 6 },   // A: No
                { wch: 45 },  // B: Nama UMKM
                { wch: 25 },  // C: Kategori / Industri
                { wch: 80 },  // D: Alamat
                { wch: 20 },  // E: No. Telepon
                { wch: 60 },  // F: WhatsApp
                { wch: 60 },  // G: Instagram
                { wch: 40 },  // H: Website
                { wch: 18 },  // I: Skor Prioritas
                { wch: 18 },  // J: Status
                { wch: 25 }   // K: Tanggal Ditarik
            ];

            // Apply styles to cells
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = { c: C, r: R };
                    const cellRef = XLSX.utils.encode_cell(cellAddress);
                    if (!worksheet[cellRef]) continue;

                    worksheet[cellRef].s = {
                        font: { name: "Calibri", sz: 11, color: { rgb: "334155" } },
                        border: {
                            top: { style: "thin", color: { rgb: "CBD5E1" } },
                            bottom: { style: "thin", color: { rgb: "CBD5E1" } },
                            left: { style: "thin", color: { rgb: "CBD5E1" } },
                            right: { style: "thin", color: { rgb: "CBD5E1" } }
                        },
                        alignment: { vertical: "center", wrapText: false }
                    };

                    // Headers formatting
                    if (R === 0) {
                        worksheet[cellRef].s.font = { name: "Calibri", sz: 12, bold: true, color: { rgb: "FFFFFF" } };
                        worksheet[cellRef].s.fill = { fgColor: { rgb: "3B82F6" } }; // Blue-500
                        worksheet[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
                    } else {
                        // Alternate row backgrounds
                        if (R % 2 !== 0) {
                            worksheet[cellRef].s.fill = { fgColor: { rgb: "F1F5F9" } }; // Slate-100
                        }

                        // Center align specific columns (No, Kategori, Telepon, Skor, Status, Tanggal)
                        if ([0, 2, 4, 8, 9, 10].includes(C)) {
                            worksheet[cellRef].s.alignment.horizontal = "center";
                        }
                    }
                }
            }

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Prospek UMKM");

            XLSX.writeFile(workbook, `Prospek_UMKM_${new Date().getTime()}.xlsx`);
            alert("Berhasil mengunduh " + result.data.length + " data!");
        } else {
            alert("Belum ada data di database untuk diekspor.");
        }
    } catch (e) {
        alert("Gagal mengekspor data: " + e.message);
    } finally {
        const btn = document.getElementById('exportBtn');
        if (btn) {
            btn.innerHTML = `<i class="ri-file-download-line"></i> Export Excel`;
            btn.disabled = false;
        }
    }
}

async function initDatabase() {
    const btn = document.getElementById('dbExportBtn');
    if (btn) btn.addEventListener('click', exportAllFromDB);

    try {
        const response = await fetch('backend/crm_api.php?action=get');
        const result = await response.json();
        const tbody = document.getElementById('dbTableBody');

        if (result.status === 'success' && result.data && result.data.length > 0) {
            document.getElementById('dbTotalCount').innerText = result.data.length;
            tbody.innerHTML = '';

            window.allDatabaseLeads = result.data;
            renderDatabaseTable(result.data);
        } else {
            tbody.innerHTML = `<tr><td colspan="11" class="p-16 text-center text-slate-400">Belum ada data yang tersimpan. Lakukan pencarian terlebih dahulu.</td></tr>`;
        }
    } catch (e) {
        console.error("Failed to load database", e);
    }
}

function renderDatabaseTable(data) {
    const tbody = document.getElementById('dbTableBody');
    if (!tbody) return;

    document.getElementById('dbTotalCount').innerText = data.length;
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="p-16 text-center text-slate-400">Tidak ada data.</td></tr>`;
        return;
    }

    data.forEach((lead, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-100 transition-colors cursor-pointer group";

        let priorityClass = 'text-slate-600 bg-slate-50 border border-slate-200';
        let priorityText = 'Rendah';
        let priorityIcon = 'ri-star-line';
        if (lead.score >= 70) {
            priorityClass = 'text-rose-500 bg-rose-50 border border-rose-100';
            priorityText = 'Tinggi';
            priorityIcon = 'ri-star-fill';
        } else if (lead.score >= 50) {
            priorityClass = 'text-amber-500 bg-amber-50 border border-amber-100';
            priorityText = 'Menengah';
            priorityIcon = 'ri-star-half-line';
        }

        let igDisplay = `<span class="text-slate-400">-</span>`;
        if (lead.ig_url !== 'Tidak Ditemukan' && lead.ig_url) {
            const handle = lead.ig_url.split('/').filter(Boolean).pop();
            igDisplay = `<a href="${lead.ig_url}" target="_blank" class="text-pink-500 hover:underline flex items-center gap-1"><i class="ri-instagram-fill"></i> @${handle}</a>`;
        }

        let skalaBadge = `<span class="px-2 py-1 bg-gray-100 text-gray-600 text-[11px] rounded font-semibold whitespace-nowrap">Kecil</span>`;
        if (lead.skala_bisnis === 'Besar') {
            skalaBadge = `<span class="px-2 py-1 bg-red-100 text-red-800 text-[11px] font-bold rounded whitespace-nowrap"><i class="ri-building-4-line mr-1"></i> Besar</span>`;
        } else if (lead.skala_bisnis === 'Menengah') {
            skalaBadge = `<span class="px-2 py-1 bg-blue-100 text-blue-800 text-[11px] font-semibold rounded whitespace-nowrap"><i class="ri-building-2-line mr-1"></i> Menengah</span>`;
        }

        const initial = lead.title ? lead.title.charAt(0).toUpperCase() : '?';
        const phoneWa = lead.phone ? lead.phone.replace(/[^0-9]/g, '').replace(/^0/, '62') : '';

        tr.innerHTML = `
            <td class="py-4 px-5 text-center text-slate-500 font-bold">${idx + 1}</td>
            <td class="py-4 px-5">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">${initial}</div>
                    <span class="font-bold text-slate-800">${lead.title}</span>
                </div>
            </td>
            <td class="py-4 px-5"><span class="text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-md text-xs">${lead.industry}</span></td>
            <td class="py-4 px-5 truncate max-w-[200px]" title="${lead.address}">
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.title + ' ' + lead.address)}" target="_blank" class="text-slate-700 hover:text-blue-600 hover:underline">
                    ${lead.address}
                </a>
            </td>
            <td class="py-4 px-5 font-semibold text-slate-700">${lead.phone || '-'}</td>
            <td class="py-4 px-5">${igDisplay}</td>
            <td class="py-4 px-5 text-center font-bold text-slate-800">${lead.score}</td>
            <td class="py-4 px-5">${skalaBadge}</td>
            <td class="py-4 px-5">
                <span class="px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max ${priorityClass}">
                    <i class="${priorityIcon}"></i> ${priorityText}
                </span>
            </td>
            <td class="py-4 px-5">
                <span class="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                    ${lead.status}
                </span>
            </td>
            <td class="py-4 px-5 text-center">
                <div class="flex items-center justify-center gap-2">
                    ${lead.status === 'tersimpan' ? `<button onclick="updateLeadStatus('${lead.cid}', 'baru'); setTimeout(initDatabase, 300);" class="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg font-semibold transition-colors shadow-sm whitespace-nowrap"><i class="ri-send-plane-fill mr-1"></i> Ke CRM</button>` : `<span class="text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-1 rounded whitespace-nowrap"><i class="ri-check-line"></i> Di CRM</span>`}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.filterSkala = function (skala) {
    if (!window.allDatabaseLeads) return;

    if (skala === 'Semua') {
        renderDatabaseTable(window.allDatabaseLeads);
    } else {
        const filtered = window.allDatabaseLeads.filter(l => l.skala_bisnis === skala);
        renderDatabaseTable(filtered);
    }
}


async function initCockpit(viewName) {
    const config = {
        'cockpit_prioritas': { title: 'Prospek Prioritas', desc: 'Leads dengan skor tinggi yang harus segera dihubungi.', icon: 'ri-fire-line', color: 'text-rose-500 bg-rose-50' },
        'cockpit_baru': { title: 'Prospek Baru', desc: 'Data baru yang belum diproses.', icon: 'ri-user-add-line', color: 'text-blue-600 bg-blue-50' },
        'cockpit_telepon': { title: 'Telepon Lagi', desc: 'Prospek yang meminta dihubungi kembali di lain waktu.', icon: 'ri-phone-line', color: 'text-amber-500 bg-amber-50' },
        'cockpit_followup': { title: 'Follow Up', desc: 'Prospek yang sedang dalam tahap negosiasi/tanya jawab.', icon: 'ri-chat-1-line', color: 'text-emerald-500 bg-emerald-50' },
        'cockpit_demo': { title: 'Jadwal Demo', desc: 'Prospek yang sudah setuju untuk demo sistem.', icon: 'ri-bookmark-line', color: 'text-purple-500 bg-purple-50' },
        'cockpit_cut': { title: 'Cut / Ditolak', desc: 'Prospek yang tidak tertarik atau tidak valid.', icon: 'ri-delete-bin-line', color: 'text-slate-500 bg-slate-100' },
        'cockpit_antrian': { title: 'Antrian Project', desc: 'Klien sudah Deal / Closing, masuk antrean pengerjaan.', icon: 'ri-stack-fill', color: 'text-indigo-600 bg-indigo-50' },
        'cockpit_selesai': { title: 'Project Selesai', desc: 'Klien yang sudah diselesaikan project-nya.', icon: 'ri-checkbox-circle-fill', color: 'text-emerald-600 bg-emerald-50' }
    };

    const conf = config[viewName] || { title: 'Cockpit', desc: 'Manajemen lead.', icon: 'ri-dashboard-3-line', color: 'text-slate-500 bg-slate-50' };

    if (document.getElementById('cpHeaderTitle')) document.getElementById('cpHeaderTitle').innerText = conf.title;
    if (document.getElementById('cpHeaderDesc')) document.getElementById('cpHeaderDesc').innerText = conf.desc;
    if (document.getElementById('cpHeaderIcon')) document.getElementById('cpHeaderIcon').className = conf.icon;
    if (document.getElementById('cpHeaderIconBg')) document.getElementById('cpHeaderIconBg').className = `w-10 h-10 rounded-xl flex items-center justify-center text-xl ${conf.color}`;

    // For specific analytical views that don't need a table, we could render charts instead.
    // But for now, we'll assume they just show a filtered table.
    try {
        const response = await fetch('backend/crm_api.php?action=get');
        const result = await response.json();
        const tbody = document.getElementById('cpTableBody');

        if (result.status === 'success' && result.data) {

            // Filter logic
            let filteredData = result.data.filter(lead => {
                const status = (lead.status || 'baru').toLowerCase();
                if (viewName === 'cockpit_prioritas') return lead.score >= 70 && status === 'baru';
                if (viewName === 'cockpit_baru') return status === 'baru';
                if (viewName === 'cockpit_telepon') return status === 'telepon_lagi';
                if (viewName === 'cockpit_followup') return status === 'follow_up';
                if (viewName === 'cockpit_demo') return status === 'demo';
                if (viewName === 'cockpit_cut') return status === 'cut';
                if (viewName === 'cockpit_antrian') return status === 'antrian';
                if (viewName === 'cockpit_selesai') return status === 'selesai' || status === 'closing';
                return true;
            });

            document.getElementById('cpTotalCount').innerText = filteredData.length;
            tbody.innerHTML = '';

            if (filteredData.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="p-16 text-center text-slate-400">Tidak ada data prospek pada kategori ini.</td></tr>`;
                return;
            }

            filteredData.forEach((lead, idx) => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition-colors group";

                let priorityClass = 'text-slate-600 bg-slate-50 border-slate-200';
                let priorityText = 'Rendah';
                let priorityIcon = 'ri-star-line';
                if (lead.score >= 70) {
                    priorityClass = 'text-rose-500 bg-rose-50 border-rose-100';
                    priorityText = 'Tinggi';
                    priorityIcon = 'ri-star-fill';
                } else if (lead.score >= 50) {
                    priorityClass = 'text-amber-500 bg-amber-50 border-amber-100';
                    priorityText = 'Menengah';
                    priorityIcon = 'ri-star-half-line';
                }

                const initial = lead.title ? lead.title.charAt(0).toUpperCase() : '?';
                const phoneWa = lead.phone ? lead.phone.replace(/[^0-9]/g, '').replace(/^0/, '62') : '';

                tr.innerHTML = `
                    <td class="py-4 px-5 text-center text-slate-500 font-bold">${idx + 1}</td>
                    <td class="py-4 px-5">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">${initial}</div>
                            <div>
                                <div class="font-bold text-slate-800">${lead.title}</div>
                                <div class="text-[11px] text-slate-400 truncate max-w-[200px]" title="${lead.address}">
                                    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.title + ' ' + lead.address)}" target="_blank" class="hover:text-blue-600 hover:underline">
                                        ${lead.address}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="py-4 px-5"><span class="text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-md text-xs">${lead.industry}</span></td>
                    <td class="py-4 px-5">
                        <div class="flex flex-col gap-1">
                            ${phoneWa ? `<a href="https://wa.me/${phoneWa}" target="_blank" class="text-emerald-600 font-semibold hover:underline flex items-center gap-1"><i class="ri-whatsapp-fill"></i> ${lead.phone}</a>` : '<span class="text-slate-400">-</span>'}
                            ${lead.ig_url && lead.ig_url !== 'Tidak Ditemukan' ? `<a href="${lead.ig_url}" target="_blank" class="text-pink-500 font-semibold hover:underline flex items-center gap-1"><i class="ri-instagram-fill"></i> Instagram</a>` : ''}
                        </div>
                    </td>
                    <td class="py-4 px-5 text-center font-bold text-slate-800">${lead.score}</td>
                    <td class="py-4 px-5">
                        <span class="px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max border ${priorityClass}">
                            <i class="${priorityIcon}"></i> ${priorityText}
                        </span>
                    </td>
                    <td class="py-4 px-5 whitespace-nowrap">
                        ${viewName === 'cockpit_selesai' ? '<span class="text-slate-400 italic text-[11px]">-</span>' :
                        `<input type="datetime-local" class="text-[11px] font-semibold bg-white border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500 cursor-text w-[140px]" 
                            onchange="updateLeadJadwal('${lead.cid}', this.value)" 
                            value="${lead.jadwal_action || ''}">`}
                    </td>
                    <td class="py-4 px-5">
                        <span class="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500" id="status-badge-${lead.cid}">
                            ${lead.status || 'BARU'}
                        </span>
                    </td>
                    <td class="py-4 px-5 text-center">
                        <select onchange="updateLeadStatus('${lead.cid}', this.value)" class="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer">
                            <option value="">Pilih Aksi...</option>
                            <option value="baru" ${lead.status === 'baru' ? 'selected' : ''}>Kembalikan ke Prospek Baru</option>
                            <option value="follow_up" ${lead.status === 'follow_up' ? 'selected' : ''}>Sedang Follow Up</option>
                            <option value="telepon_lagi" ${lead.status === 'telepon_lagi' ? 'selected' : ''}>Telepon Lagi Nanti</option>
                            <option value="demo" ${lead.status === 'demo' ? 'selected' : ''}>Jadwal Demo</option>
                            <option value="antrian" ${lead.status === 'antrian' ? 'selected' : ''}>Berhasil Closing (Antrian Project)</option>
                            <option value="selesai" ${lead.status === 'selesai' || lead.status === 'closing' ? 'selected' : ''}>Project Selesai</option>
                            <option value="cut" ${lead.status === 'cut' ? 'selected' : ''}>Cut / Ditolak</option>
                        </select>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error("Failed to load cockpit data", e);
    }
}

async function updateLeadStatus(cid, newStatus) {
    if (!newStatus) return;
    try {
        const response = await fetch('backend/crm_api.php?action=update_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cid: cid, status: newStatus })
        });
        const result = await response.json();
        if (result.status === 'success') {
            const badge = document.getElementById(`status-badge-${cid}`);
            if (badge) {
                badge.innerText = newStatus.toUpperCase();
                badge.className = "px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 transition-colors";
            }
            updateSidebarBadges(); // Refresh sidebar numbers
        } else {
            alert('Gagal mengupdate status: ' + result.error);
        }
    } catch (e) {
        alert('Gagal menghubungi server.');
    }
}

async function updateLeadJadwal(cid, newJadwal) {
    try {
        const response = await fetch('backend/crm_api.php?action=update_jadwal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cid: cid, jadwal: newJadwal })
        });
        const result = await response.json();
        if (result.status !== 'success') {
            alert('Gagal menyimpan jadwal: ' + result.error);
        }
    } catch (e) {
        alert('Gagal menghubungi server untuk menyimpan jadwal.');
    }
}

async function initAdministrasi(viewName) {
    const isProposal = viewName === 'administrasi_proposal';
    const config = {
        'administrasi_proposal': { title: 'Proposal Penawaran', desc: 'Daftar prospek yang membutuhkan dokumen proposal penawaran (status Demo atau Follow up).', icon: 'ri-file-text-line', color: 'text-indigo-600 bg-indigo-50' },
        'administrasi_invoice': { title: 'Invoice & Tagihan', desc: 'Daftar klien yang sedang dalam pengerjaan (Antrian Project) untuk memantau status pembayaran.', icon: 'ri-bank-card-line', color: 'text-emerald-600 bg-emerald-50' }
    };
    const conf = config[viewName];

    if (document.getElementById('adminHeaderTitle')) document.getElementById('adminHeaderTitle').innerText = conf.title;
    if (document.getElementById('adminHeaderDesc')) document.getElementById('adminHeaderDesc').innerText = conf.desc;
    if (document.getElementById('adminHeaderIcon')) document.getElementById('adminHeaderIcon').className = conf.icon;
    if (document.getElementById('adminHeaderIconBg')) document.getElementById('adminHeaderIconBg').className = `w-10 h-10 rounded-xl flex items-center justify-center text-xl ${conf.color}`;

    try {
        const response = await fetch('backend/crm_api.php?action=get');
        const result = await response.json();
        const tbody = document.getElementById('adminTableBody');

        if (result.status === 'success' && result.data) {
            let filteredData = result.data.filter(lead => {
                const status = (lead.status || 'baru').toLowerCase();
                if (isProposal) return status === 'demo' || status === 'follow_up';
                if (!isProposal) return status === 'antrian';
                return false;
            });

            document.getElementById('adminTotalCount').innerText = filteredData.length;
            tbody.innerHTML = '';

            if (filteredData.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="p-16 text-center text-slate-400 font-medium">Tidak ada data untuk ditampilkan pada kategori ini.</td></tr>`;
                return;
            }

            filteredData.forEach((lead, idx) => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0";

                const price = lead.price || 0;
                const nominal = price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price) : 'Rp 0';

                const createdDate = new Date(lead.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
                const actionBtnHtml = isProposal
                    ? `<button onclick="downloadAdminDoc('${lead.cid}', 'proposal', '${lead.title.replace(/'/g, "\\'")}', '${lead.phone}')" class="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"><i class="ri-file-download-line"></i> Buat Proposal</button>`
                    : `<button onclick="downloadAdminDoc('${lead.cid}', 'invoice', '${lead.title.replace(/'/g, "\\'")}', '${lead.phone}')" class="bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"><i class="ri-download-2-line"></i> Unduh Invoice</button>`;

                const statusBadge = isProposal
                    ? `<span class="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">Draft</span>`
                    : `<span class="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-rose-100 text-rose-600">Belum Bayar</span>`;

                tr.innerHTML = `
                    <td class="py-4 px-5 text-center text-slate-500 font-bold">${idx + 1}</td>
                    <td class="py-4 px-5">
                        <div class="font-bold text-slate-800">${lead.title}</div>
                        <div class="text-[11px] text-slate-400 mt-0.5">${lead.industry}</div>
                    </td>
                    <td class="py-4 px-5 text-sm font-semibold text-slate-600">${createdDate}</td>
                    <td class="py-4 px-5 text-sm font-bold text-slate-700">${nominal}</td>
                    <td class="py-4 px-5">${statusBadge}</td>
                    <td class="py-4 px-5 flex justify-end">
                        ${actionBtnHtml}
                    </td>
                `;
                tbody.appendChild(tr);
            });

            document.getElementById('adminSearch')?.addEventListener('input', function (e) {
                const term = e.target.value.toLowerCase();
                const rows = tbody.querySelectorAll('tr');
                let count = 0;
                rows.forEach(row => {
                    if (row.innerText.toLowerCase().includes(term)) {
                        row.style.display = '';
                        count++;
                    } else {
                        row.style.display = 'none';
                    }
                });
                document.getElementById('adminTotalCount').innerText = count;
            });
        }
    } catch (e) {
        console.error("Gagal memuat data administrasi:", e);
    }
}

function downloadAdminDoc(cid, type, title, phone) {
    document.getElementById('pdfCid').value = cid;
    document.getElementById('pdfJenis').value = type;
    document.getElementById('pdfClientName').value = title;
    document.getElementById('pdfPhone').value = phone || '';

    document.getElementById('pdfModalTitle').innerText = 'Generate ' + (type === 'invoice' ? 'Invoice' : 'Proposal');

    if (type === 'invoice') {
        document.getElementById('pdfTerminContainer').style.display = 'block';
    } else {
        document.getElementById('pdfTerminContainer').style.display = 'none';
    }

    // Reset state
    document.getElementById('pdfSuccessBox').style.display = 'none';
    document.getElementById('pdfFooterActions').style.display = 'flex';
    document.getElementById('btnGeneratePdf').disabled = false;
    document.getElementById('btnGeneratePdf').innerHTML = '<i class="ri-printer-line"></i> Generate PDF';

    document.getElementById('pdfModal').style.display = 'flex';
}

function closePdfModal() {
    document.getElementById('pdfModal').style.display = 'none';
}

async function generatePdf() {
    const btn = document.getElementById('btnGeneratePdf');
    btn.disabled = true;
    btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Memproses...';

    const cid = document.getElementById('pdfCid').value;
    const jenis = document.getElementById('pdfJenis').value;
    const id_layanan = document.getElementById('pdfPaket').value;
    const termin = document.getElementById('pdfTermin').value;

    const formData = new FormData();
    formData.append('cid', cid);
    formData.append('jenis', jenis);
    formData.append('id_layanan', id_layanan);
    formData.append('termin', termin);

    try {
        const response = await fetch('backend/generate_pdf.php', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.status === 'success') {
            document.getElementById('pdfSuccessBox').style.display = 'block';
            document.getElementById('pdfFooterActions').style.display = 'none';
            document.getElementById('pdfSuccessDocNo').innerText = result.no_dokumen;

            const link = document.getElementById('pdfDownloadLink');
            link.href = result.file_url;

            // simpan link ke button wa
            const waBtn = document.getElementById('pdfWaLink');
            waBtn.dataset.url = window.location.origin + window.location.pathname.replace('index.php', '') + result.file_url;
            waBtn.dataset.jenis = jenis;
        } else {
            alert('Gagal generate: ' + result.message);
            btn.disabled = false;
            btn.innerHTML = '<i class="ri-printer-line"></i> Generate PDF';
        }
    } catch (e) {
        alert('Gagal menghubungi server.');
        btn.disabled = false;
        btn.innerHTML = '<i class="ri-printer-line"></i> Generate PDF';
    }
}

function sendWaPdf() {
    const btn = document.getElementById('pdfWaLink');
    const url = btn.dataset.url;
    const jenis = btn.dataset.jenis;
    const phoneRaw = document.getElementById('pdfPhone').value;

    let phone = phoneRaw.replace(/\D/g, '');
    if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
    }

    let text = `Halo Bapak/Ibu, berikut kami lampirkan ${jenis.toUpperCase()} untuk sistem Anda: \n${url}\n\nTerima kasih.`;

    let waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
}
