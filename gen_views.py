import os

views_dir = 'views'
if not os.path.exists(views_dir):
    os.makedirs(views_dir)

views = {
    'dashboard': {'title': 'Dashboard Command Center', 'icon': 'ri-home-5-line', 'desc': 'Visualisasi data prospek dan performa outreach.'},
    'hasil_prospek': {'title': 'Hasil Prospek Mentah', 'icon': 'ri-file-list-3-line', 'desc': 'Data mentah hasil scraping. Klik baris untuk diagnosis AI.'},
    'riwayat': {'title': 'Riwayat Pencarian', 'icon': 'ri-history-line', 'desc': 'Log aktivitas pencarian dan opsi unduh ulang.'},
    
    'cockpit_prioritas': {'title': 'Prioritas Tinggi', 'icon': 'ri-fire-line', 'desc': 'Leads dengan AI Potential Score tertinggi. Hubungi segera.'},
    'cockpit_antrian': {'title': 'Antrian (Belum Tersentuh)', 'icon': 'ri-grid-fill', 'desc': 'Kirim pesan WA/Email massal secara bertahap (Anti-Banned).'},
    'cockpit_telepon': {'title': 'Telepon Lagi (Follow Up)', 'icon': 'ri-phone-line', 'desc': 'Jadwal telepon ulang dan catatan panggilan sebelumnya.'},
    'cockpit_followup': {'title': 'Follow Up Penawaran', 'icon': 'ri-chat-1-line', 'desc': 'Pantau read receipt dan log interaksi terakhir.'},
    'cockpit_demo': {'title': 'Jadwal Demo', 'icon': 'ri-bookmark-line', 'desc': 'Integrasi kalender dan link meeting otomatis.'},
    'cockpit_cut': {'title': 'Arsip / Ditolak (Cut)', 'icon': 'ri-delete-bin-line', 'desc': 'Alasan penolakan untuk bahan evaluasi.'},
    'cockpit_performa': {'title': 'Analitik Performa', 'icon': 'ri-bar-chart-box-line', 'desc': 'Laporan response rate dan efektivitas template.'},
    'cockpit_distribusi': {'title': 'Distribusi Leads', 'icon': 'ri-share-line', 'desc': 'Routing Round-Robin atau assign manual ke tim sales.'},
    'cockpit_butuh_demo': {'title': 'Inbound / Butuh Demo', 'icon': 'ri-hammer-line', 'desc': 'Antrean prospek inbound dari landing page.'},
    
    'pengaturan': {'title': 'Pengaturan Sistem', 'icon': 'ri-settings-4-line', 'desc': 'Konfigurasi API, template copywriting, dan integrasi.'}
}

template = """
<div class="flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
    <div class="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center min-h-[400px]">
        <div class="w-20 h-20 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-4xl mb-4">
            <i class="{icon}"></i>
        </div>
        <h2 class="font-bold text-2xl text-slate-800 mb-2">{title}</h2>
        <p class="text-slate-500 font-medium max-w-md">{desc}</p>
        
        <div class="mt-8 px-6 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-400 border-dashed">
            View Development Shell - UI Placeholder
        </div>
    </div>
</div>
"""

for slug, data in views.items():
    if slug == 'pencarian':
        continue
    filepath = os.path.join(views_dir, f"{slug}.html")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(template.format(**data))

print("Created 13 view shells.")
