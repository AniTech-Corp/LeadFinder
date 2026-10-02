// --- History Management ---
function loadCityHistory() {
    const history = JSON.parse(localStorage.getItem('citySearchHistory') || '["Bekasi", "Jakarta Selatan", "Bandung"]');
    const datalist = document.getElementById('cityHistory');
    if(datalist) {
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
        }
        
        // Update Sidebar Active States
        document.querySelectorAll('.nav-link').forEach(link => {
            const isCockpit = link.dataset.view && link.dataset.view.startsWith('cockpit_');
            
            if(link.dataset.view === viewName) {
                // Active state
                if (isCockpit) {
                    link.className = `nav-link flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 text-blue-600 font-medium transition-colors text-[13px] border-l-[3px] border-blue-600`;
                } else {
                    link.className = `nav-link flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-light text-primary font-semibold transition-colors`;
                }
            } else {
                // Inactive state
                if (isCockpit) {
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
    if(link) {
        e.preventDefault();
        const view = link.dataset.view;
        if(view) loadView(view);
    }
});


let currentPage = 1;
const itemsPerPage = 5;

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    if(currentLeads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="p-12 text-center text-slate-400">Belum ada data. Silakan lakukan pencarian di area target Anda.</td></tr>`;
        document.getElementById('showingText').innerText = `Menampilkan 0 hasil`;
        document.getElementById('paginationContainer').innerHTML = '';
        return;
    }
    
    const displayLeads = currentLeads.filter(l => !l.website);
    
    if(displayLeads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="p-12 text-center text-slate-400">Semua UMKM yang ditemukan sudah memiliki website.</td></tr>`;
        document.getElementById('showingText').innerText = `Menampilkan 0 hasil`;
        document.getElementById('paginationContainer').innerHTML = '';
        return;
    }
    
    const totalPages = Math.ceil(displayLeads.length / itemsPerPage);
    if(currentPage > totalPages) currentPage = totalPages;
    if(currentPage < 1) currentPage = 1;
    
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
        if(lead.priority === 'Tinggi') {
            priorityClass = 'text-rose-500 bg-rose-50 border border-rose-100';
            priorityIcon = 'ri-star-fill';
        } else if(lead.priority === 'Menengah') {
            priorityClass = 'text-amber-500 bg-amber-50 border border-amber-100';
            priorityIcon = 'ri-star-half-line';
        }

        let kecamatan = "Bekasi";
        if(lead.address) {
            const parts = lead.address.split(',');
            if(parts.length > 2) kecamatan = parts[parts.length-3].trim();
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
        if(isActive) {
            btn.className = "w-8 h-8 rounded bg-primary text-white flex items-center justify-center font-bold";
        } else if(isDisabled) {
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
    
    if(!city) {
        alert("Mohon masukkan Kota / Area");
        return;
    }

    // Save city to history
    saveCityHistory(city);

    const checkedCats = Array.from(document.querySelectorAll('.cat-checkbox.active input:checked')).map(cb => cb.value);
    
    if(checkedCats.length === 0) {
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
                if(data.places) {
                    data.places.forEach(p => { p.searchCategory = cat; allResults.push(p); });
                }
            } catch(e) {
                console.error("Failed to fetch", cat);
            }
        });

        await Promise.all(promises);
        
        const unique = [];
        const seen = new Set();
        allResults.forEach(p => {
            const id = p.cid || p.title;
            if(!seen.has(id)) {
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
            if(cell) {
                if (foundIg) {
                    cell.innerHTML = `<a href="https://instagram.com/${foundIg}" target="_blank" class="text-pink-500 hover:underline flex items-center gap-1.5"><i class="ri-instagram-fill"></i> @${foundIg}</a>`;
                } else {
                    cell.innerHTML = `<span class="text-slate-400">-</span>`;
                }
            }
            
            updateStats();
            
        } catch(e) {
            lead.igUrl = "Tidak Ditemukan";
            const cell = document.getElementById(`td-ig-${i}`);
            if(cell) cell.innerHTML = `<span class="text-slate-400">-</span>`;
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
    } catch(e) {
        console.error('Failed to save lead', e);
    }
}

// --- History Management ---
function loadCityHistory() {
    const history = JSON.parse(localStorage.getItem('citySearchHistory') || '["Bekasi", "Jakarta Selatan", "Bandung"]');
    const datalist = document.getElementById('cityHistory');
    if(datalist) {
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
            
            if(lead.score >= 70) lead.priority = 'Tinggi';
            else if(lead.score >= 50) lead.priority = 'Menengah';
            else lead.priority = 'Rendah';
        }
        
        if(lead.priority === 'Tinggi') high++;
        else if(lead.priority === 'Menengah') mid++;
        else low++;
    });

    const el = id => document.getElementById(id);
    if(el('stat-total')) el('stat-total').innerText = noWeb;
    if(el('stat-ig')) {
        el('stat-ig').innerText = igFound;
        el('stat-ig-desc').innerText = total > 0 ? Math.round((igFound/total)*100) + '% dari total' : '0% dari total';
    }
    if(el('stat-high')) el('stat-high').innerText = high;
    if(el('stat-mid')) el('stat-mid').innerText = mid;
    if(el('stat-low')) el('stat-low').innerText = low;

    if(el('sum-total')) el('sum-total').innerText = total;
    if(el('sum-noweb')) el('sum-noweb').innerText = noWeb;
    if(el('sum-ig')) el('sum-ig').innerText = igFound;
    if(el('sum-high')) el('sum-high').innerText = high;
    if(el('sum-mid')) el('sum-mid').innerText = mid;
    if(el('sum-low')) el('sum-low').innerText = low;
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initApp() {
    loadView('dashboard');
    updateSidebarBadges();
    
    // Bind logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if(confirm('Apakah Anda yakin ingin keluar?')) {
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
            let counts = { prioritas: 0, antrian: 0, telepon: 0, followup: 0, demo: 0, cut: 0 };
            
            result.data.forEach(lead => {
                const status = (lead.status || 'baru').toLowerCase();
                
                if (status === 'baru') counts.antrian++;
                else if (status === 'telepon_lagi') counts.telepon++;
                else if (status === 'follow_up') counts.followup++;
                else if (status === 'demo') counts.demo++;
                else if (status === 'cut') counts.cut++;
                
                if (lead.score >= 70 && status !== 'cut' && status !== 'closing') counts.prioritas++;
            });
            
            const setBadge = (id, count) => {
                const el = document.getElementById(id);
                if(el) {
                    el.innerText = count;
                    const baseClass = "text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors";
                    
                    if(count > 0) {
                        if(id === 'badge_prioritas') el.className = `${baseClass} bg-rose-100 text-rose-600`;
                        else if(id === 'badge_antrian') el.className = `${baseClass} bg-blue-100 text-blue-600`;
                        else if(id === 'badge_telepon') el.className = `${baseClass} bg-amber-100 text-amber-600`;
                        else if(id === 'badge_followup') el.className = `${baseClass} bg-emerald-100 text-emerald-600`;
                        else if(id === 'badge_demo') el.className = `${baseClass} bg-purple-100 text-purple-600`;
                        else if(id === 'badge_cut') el.className = `${baseClass} bg-slate-200 text-slate-700`;
                        else el.className = `${baseClass} bg-blue-50 text-blue-500`;
                    } else {
                        el.className = `${baseClass} bg-slate-100 text-slate-400`;
                    }
                }
            };
            
            setBadge('badge_prioritas', counts.prioritas);
            setBadge('badge_antrian', counts.antrian);
            setBadge('badge_telepon', counts.telepon);
            setBadge('badge_followup', counts.followup);
            setBadge('badge_demo', counts.demo);
            setBadge('badge_cut', counts.cut);
        }
    } catch(e) {
        console.error("Failed to update sidebar badges", e);
    }
}

async function initDashboard() {
    try {
        const response = await fetch('backend/crm_api.php?action=dashboard_stats');
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
        }
} catch (e) {
        console.error("Failed to init dashboard", e);
    }
}

async function exportAllFromDB() {
    try {
        const btn = document.getElementById('exportBtn');
        if(btn) {
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
        if(btn) {
            btn.innerHTML = `<i class="ri-file-download-line"></i> Export Excel`;
            btn.disabled = false;
        }
    }
}

async function initDatabase() {
    const btn = document.getElementById('dbExportBtn');
    if(btn) btn.addEventListener('click', exportAllFromDB);
    
    try {
        const response = await fetch('backend/crm_api.php?action=get');
        const result = await response.json();
        const tbody = document.getElementById('dbTableBody');
        
        if (result.status === 'success' && result.data && result.data.length > 0) {
            document.getElementById('dbTotalCount').innerText = result.data.length;
            tbody.innerHTML = '';
            
            result.data.forEach((lead, idx) => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-100 transition-colors cursor-pointer group";
                
                let priorityClass = 'text-slate-600 bg-slate-50 border border-slate-200';
                let priorityText = 'Rendah';
                let priorityIcon = 'ri-star-line';
                if(lead.score >= 70) {
                    priorityClass = 'text-rose-500 bg-rose-50 border border-rose-100';
                    priorityText = 'Tinggi';
                    priorityIcon = 'ri-star-fill';
                } else if(lead.score >= 50) {
                    priorityClass = 'text-amber-500 bg-amber-50 border border-amber-100';
                    priorityText = 'Menengah';
                    priorityIcon = 'ri-star-half-line';
                }

                let igDisplay = `<span class="text-slate-400">-</span>`;
                if (lead.ig_url !== 'Tidak Ditemukan' && lead.ig_url) {
                    const handle = lead.ig_url.split('/').filter(Boolean).pop();
                    igDisplay = `<a href="${lead.ig_url}" target="_blank" class="text-pink-500 hover:underline flex items-center gap-1"><i class="ri-instagram-fill"></i> @${handle}</a>`;
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
                    <td class="py-4 px-5 truncate max-w-[200px]" title="${lead.address}">${lead.address}</td>
                    <td class="py-4 px-5 font-semibold text-slate-700">${lead.phone || '-'}</td>
                    <td class="py-4 px-5">${igDisplay}</td>
                    <td class="py-4 px-5 text-center font-bold text-slate-800">${lead.score}</td>
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
                            ${phoneWa ? `<a href="https://wa.me/${phoneWa}" target="_blank" class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm"><i class="ri-whatsapp-fill"></i></a>` : `<span class="w-7 h-7 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center"><i class="ri-whatsapp-fill"></i></span>`}
                            <button class="w-7 h-7 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"><i class="ri-edit-2-line"></i></button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="10" class="p-16 text-center text-slate-400">Belum ada data yang tersimpan. Lakukan pencarian terlebih dahulu.</td></tr>`;
        }
    } catch (e) {
        console.error("Failed to load database", e);
    }
}

async function initCockpit(viewName) {
    const config = {
        'cockpit_prioritas': { title: 'Prospek Prioritas', desc: 'Leads dengan skor tinggi yang harus segera dihubungi.', icon: 'ri-fire-line', color: 'text-rose-500 bg-rose-50' },
        'cockpit_antrian': { title: 'Antrian Prospek', desc: 'Data baru yang belum diproses.', icon: 'ri-grid-fill', color: 'text-blue-600 bg-blue-50' },
        'cockpit_telepon': { title: 'Telepon Lagi', desc: 'Prospek yang meminta dihubungi kembali di lain waktu.', icon: 'ri-phone-line', color: 'text-amber-500 bg-amber-50' },
        'cockpit_followup': { title: 'Follow Up', desc: 'Prospek yang sedang dalam tahap negosiasi/tanya jawab.', icon: 'ri-chat-1-line', color: 'text-emerald-500 bg-emerald-50' },
        'cockpit_demo': { title: 'Jadwal Demo', desc: 'Prospek yang sudah setuju untuk demo sistem.', icon: 'ri-bookmark-line', color: 'text-purple-500 bg-purple-50' },
        'cockpit_cut': { title: 'Cut / Ditolak', desc: 'Prospek yang tidak tertarik atau tidak valid.', icon: 'ri-delete-bin-line', color: 'text-slate-500 bg-slate-100' }
    };
    
    const conf = config[viewName] || { title: 'Cockpit', desc: 'Manajemen lead.', icon: 'ri-dashboard-3-line', color: 'text-slate-500 bg-slate-50' };
    
    if(document.getElementById('cpHeaderTitle')) document.getElementById('cpHeaderTitle').innerText = conf.title;
    if(document.getElementById('cpHeaderDesc')) document.getElementById('cpHeaderDesc').innerText = conf.desc;
    if(document.getElementById('cpHeaderIcon')) document.getElementById('cpHeaderIcon').className = conf.icon;
    if(document.getElementById('cpHeaderIconBg')) document.getElementById('cpHeaderIconBg').className = `w-10 h-10 rounded-xl flex items-center justify-center text-xl ${conf.color}`;

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
                if (viewName === 'cockpit_prioritas') return lead.score >= 70 && status !== 'cut' && status !== 'closing';
                if (viewName === 'cockpit_antrian') return status === 'baru';
                if (viewName === 'cockpit_telepon') return status === 'telepon_lagi';
                if (viewName === 'cockpit_followup') return status === 'follow_up';
                if (viewName === 'cockpit_demo') return status === 'demo';
                if (viewName === 'cockpit_cut') return status === 'cut';
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
                if(lead.score >= 70) {
                    priorityClass = 'text-rose-500 bg-rose-50 border-rose-100';
                    priorityText = 'Tinggi';
                    priorityIcon = 'ri-star-fill';
                } else if(lead.score >= 50) {
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
                                <div class="text-[11px] text-slate-400 truncate max-w-[200px]" title="${lead.address}">${lead.address}</div>
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
                    <td class="py-4 px-5">
                        <span class="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500" id="status-badge-${lead.cid}">
                            ${lead.status || 'BARU'}
                        </span>
                    </td>
                    <td class="py-4 px-5 text-center">
                        <select onchange="updateLeadStatus('${lead.cid}', this.value)" class="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer">
                            <option value="">Pilih Aksi...</option>
                            <option value="baru" ${lead.status === 'baru' ? 'selected' : ''}>Kembalikan ke Antrian</option>
                            <option value="follow_up" ${lead.status === 'follow_up' ? 'selected' : ''}>Sedang Follow Up</option>
                            <option value="telepon_lagi" ${lead.status === 'telepon_lagi' ? 'selected' : ''}>Telepon Lagi Nanti</option>
                            <option value="demo" ${lead.status === 'demo' ? 'selected' : ''}>Jadwal Demo</option>
                            <option value="closing" ${lead.status === 'closing' ? 'selected' : ''}>Berhasil Closing</option>
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
    if(!newStatus) return;
    try {
        const response = await fetch('backend/crm_api.php?action=update_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cid: cid, status: newStatus })
        });
        const result = await response.json();
        if(result.status === 'success') {
            const badge = document.getElementById(`status-badge-${cid}`);
            if(badge) {
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
