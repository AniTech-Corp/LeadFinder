<?php
session_start();
if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
    header("Location: index.php");
    exit;
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - LeadScout AI</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f8fafc; }
    </style>
</head>
<body class="h-screen flex items-center justify-center p-4">
    
    <div class="w-full max-w-[400px] bg-white rounded-3xl p-8 border border-slate-200 shadow-xl shadow-blue-900/5 relative overflow-hidden">
        
        <!-- Decorative bg -->
        <div class="absolute -top-16 -right-16 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
        <div class="absolute -bottom-16 -left-16 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-20"></div>

        <div class="relative z-10">
            <div class="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-6 mx-auto">
                <i class="ri-radar-line text-3xl text-white"></i>
            </div>
            
            <h1 class="text-2xl font-extrabold text-slate-800 text-center mb-1">Masuk ke LeadScout</h1>
            <p class="text-sm font-medium text-slate-500 text-center mb-8">Sistem Manajemen Prospek UMKM AI</p>
            
            <div id="errorBox" class="hidden mb-4 p-3 bg-red-50 text-red-600 text-[13px] font-semibold rounded-lg border border-red-100 flex items-start gap-2">
                <i class="ri-error-warning-fill text-base mt-0.5"></i>
                <span id="errorMsg"></span>
            </div>

            <form id="loginForm" class="flex flex-col gap-5">
                <div>
                    <label class="block text-[13px] font-bold text-slate-700 mb-1.5">Username</label>
                    <div class="relative">
                        <i class="ri-user-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input type="text" id="username" placeholder="Masukkan username" required class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors">
                    </div>
                </div>
                
                <div>
                    <label class="block text-[13px] font-bold text-slate-700 mb-1.5">Password</label>
                    <div class="relative">
                        <i class="ri-lock-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input type="password" id="password" placeholder="••••••••" required class="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors">
                        <button type="button" id="togglePass" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <i class="ri-eye-off-line"></i>
                        </button>
                    </div>
                </div>
                
                <button type="submit" id="submitBtn" class="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-[14px] font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                    Masuk Sekarang <i class="ri-arrow-right-line"></i>
                </button>
            </form>
            
        </div>
    </div>

    <script>
        document.getElementById('togglePass').addEventListener('click', function() {
            const input = document.getElementById('password');
            const icon = this.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'ri-eye-line';
            } else {
                input.type = 'password';
                icon.className = 'ri-eye-off-line';
            }
        });

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('submitBtn');
            const errBox = document.getElementById('errorBox');
            const errMsg = document.getElementById('errorMsg');
            
            btn.disabled = true;
            btn.innerHTML = `<i class="ri-loader-4-line animate-spin text-lg"></i> Memeriksa...`;
            errBox.classList.add('hidden');
            
            try {
                const res = await fetch('backend/auth.php?action=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: document.getElementById('username').value,
                        password: document.getElementById('password').value
                    })
                });
                const data = await res.json();
                
                if(data.status === 'success') {
                    window.location.href = 'index.php';
                } else {
                    errMsg.innerText = data.message;
                    errBox.classList.remove('hidden');
                    btn.disabled = false;
                    btn.innerHTML = `Masuk Sekarang <i class="ri-arrow-right-line"></i>`;
                }
            } catch(err) {
                errMsg.innerText = 'Terjadi kesalahan koneksi.';
                errBox.classList.remove('hidden');
                btn.disabled = false;
                btn.innerHTML = `Masuk Sekarang <i class="ri-arrow-right-line"></i>`;
            }
        });
    </script>
</body>
</html>
