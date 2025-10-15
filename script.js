// Variabel global untuk filter
let currentFilter = {
    active: false,
    startDate: null,
    endDate: null,
    preset: null
};

// Fungsi untuk memuat data dari JSON dengan cache busting
async function loadAttendanceData() {
    try {
        showLoading();
        
        // Tambahkan timestamp untuk avoid cache GitHub Pages
        const timestamp = new Date().getTime();
        const response = await fetch(`absensi.json?t=${timestamp}`);
        
        if (!response.ok) {
            throw new Error('File tidak ditemukan');
        }
        
        const data = await response.json();
        
        // JIKA TIDAK ADA FILTER, TAMPILKAN HANYA DATA HARI INI
        if (!currentFilter.active) {
            const todayData = getTodayData(data);
            displayData(todayData);
        } else {
            // Jika ada filter, tampilkan data filtered (riwayat)
            const filteredData = filterDataByDate(data);
            displayFilteredData(filteredData);
        }
        
        updateLastUpdate();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Error memuat data. Pastikan file absensi.json ada di repository.');
    }
}

// ================== FUNGSI UTAMA UNTUK TAMPILAN HARI INI ================== //

// Fungsi untuk mendapatkan data HARI INI saja
function getTodayData(data) {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // Format: 2025-10-14
    
    console.log('🔍 Filtering for TODAY:', todayString);
    
    const todayData = {};
    
    for (const [cardId, student] of Object.entries(data)) {
        for (const absen of student.riwayat) {
            // CEK APAKAH TANGGAL ABSEN SAMA DENGAN HARI INI
            if (absen.time.startsWith(todayString)) {
                todayData[cardId] = {
                    nama: absen.nama,
                    jurusan: absen.jurusan,
                    angkatan: absen.angkatan,
                    time: absen.time
                };
                console.log('✅ Found TODAY absen for:', absen.nama, 'at', absen.time);
                break; // Hanya ambil satu absen per kartu untuk hari ini
            }
        }
    }
    
    console.log('📊 TODAY data result:', Object.keys(todayData).length, 'records');
    return todayData;
}

// Fungsi untuk menampilkan data HARI INI di tabel
function displayData(data) {
    const tableBody = document.getElementById('tableBody');
    const totalSpan = document.getElementById('total');
    const todaySpan = document.getElementById('today');
    
    if (!data || Object.keys(data).length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div>📭</div>
                    <h3>Belum ada data absensi hari ini</h3>
                    <p>Data absensi akan muncul setelah kartu RFID dibaca</p>
                </td>
            </tr>
        `;
        totalSpan.textContent = '0';
        todaySpan.textContent = '0';
        return;
    }

    let html = '';
    let counter = 1;
    let todayCount = 0;
    
    // Urutkan data berdasarkan waktu (terbaru dulu)
    const sortedData = Object.entries(data).sort((a, b) => {
        return new Date(b[1].time) - new Date(a[1].time);
    });
    
    for (const [cardId, student] of sortedData) {
        todayCount++;
        
        html += `
            <tr>
                <td>${counter}</td>
                <td><strong>${cardId}</strong></td>
                <td>${student.nama}</td>
                <td>${student.jurusan}</td>
                <td>${student.angkatan}</td>
                <td>${formatDateTime(student.time)}</td>
                <td>
                    <span class="badge badge-success">
                        Hari Ini
                    </span>
                </td>
            </tr>
        `;
        counter++;
    }
    
    tableBody.innerHTML = html;
    
    // Update stats
    totalSpan.textContent = todayCount;
    todaySpan.textContent = todayCount;
}

// ================== FUNGSI UNTUK FILTER RIWAYAT ================== //

// Fungsi untuk menampilkan data filtered (RIWAYAT)
function displayFilteredData(data) {
    const tableBody = document.getElementById('tableBody');
    const totalSpan = document.getElementById('total');
    const todaySpan = document.getElementById('today');
    
    // Flatten data untuk riwayat
    const flattenedData = flattenAttendanceData(data);
    
    if (!flattenedData || Object.keys(flattenedData).length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div>📭</div>
                    <h3>Tidak ada data absensi pada tanggal tersebut</h3>
                    <p>Coba pilih tanggal lain</p>
                </td>
            </tr>
        `;
        totalSpan.textContent = '0';
        todaySpan.textContent = '0';
        return;
    }

    let html = '';
    let counter = 1;
    let filteredCount = 0;
    
    // Urutkan data berdasarkan waktu (terbaru dulu)
    const sortedData = Object.entries(flattenedData).sort((a, b) => {
        return new Date(b[1].time) - new Date(a[1].time);
    });
    
    for (const [uniqueId, absen] of sortedData) {
        filteredCount++;
        
        html += `
            <tr>
                <td>${counter}</td>
                <td><strong>${absen.cardId}</strong></td>
                <td>${absen.nama}</td>
                <td>${absen.jurusan}</td>
                <td>${absen.angkatan}</td>
                <td>${formatDateTime(absen.time)}</td>
                <td>
                    <span class="badge badge-warning">
                        ${formatDate(absen.time)}
                    </span>
                </td>
            </tr>
        `;
        counter++;
    }
    
    tableBody.innerHTML = html;
    
    // Update stats
    totalSpan.textContent = filteredCount;
    todaySpan.textContent = filteredCount;
}

// ================== FILTER TANGGAL FUNCTIONS ================== //

// Fungsi untuk menampilkan modal filter tanggal
function showDateFilter() {
    const modal = document.getElementById('dateFilterModal');
    modal.style.display = 'flex';
    
    // Set tanggal hari ini sebagai default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('filterDate').value = today;
    
    // Reset preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('active');
    });
}

// Fungsi untuk menutup modal
function closeDateFilter() {
    const modal = document.getElementById('dateFilterModal');
    modal.style.display = 'none';
}

// Fungsi untuk set preset tanggal
function setDatePreset(preset) {
    const today = new Date();
    let filterDate;
    
    // Update active button
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    switch(preset) {
        case 'today':
            filterDate = today;
            break;
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            filterDate = yesterday;
            break;
        default:
            return;
    }
    
    // Set input value
    document.getElementById('filterDate').value = filterDate.toISOString().split('T')[0];
    currentFilter.preset = preset;
}

// Fungsi untuk menerapkan filter (UNTUK LIHAT RIWAYAT)
function applyDateFilter() {
    const dateInput = document.getElementById('filterDate').value;
    
    if (!dateInput) {
        alert('❌ Harap pilih tanggal');
        return;
    }
    
    const selectedDate = new Date(dateInput);
    const startDate = new Date(selectedDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(selectedDate);
    endDate.setHours(23, 59, 59, 999);
    
    // Set filter
    currentFilter.active = true;
    currentFilter.startDate = startDate;
    currentFilter.endDate = endDate;
    currentFilter.selectedDate = selectedDate;
    
    closeDateFilter();
    
    // Load data dengan filter
    loadFilteredData();
    
    // Tampilkan tanggal yang dipilih
    const dateStr = selectedDate.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    let message = `✅ Menampilkan riwayat tanggal: ${dateStr}`;
    if (currentFilter.preset === 'yesterday') {
        message = `✅ Menampilkan riwayat kemarin: ${dateStr}`;
    }
    
    showMessage(message, 'success');
}

// Fungsi untuk load data filtered (RIWAYAT)
async function loadFilteredData() {
    try {
        showLoading();
        
        const timestamp = new Date().getTime();
        const response = await fetch(`absensi.json?t=${timestamp}`);
        
        if (!response.ok) {
            throw new Error('File tidak ditemukan');
        }
        
        const data = await response.json();
        const filteredData = filterDataByDate(data);
        
        displayFilteredData(filteredData);
        updateLastUpdate();
    } catch (error) {
        console.error('Error loading filtered data:', error);
        showError('Error memuat data filter.');
    }
}

// Fungsi untuk reset filter (kembali ke tampilan HARI INI)
function resetDateFilter() {
    currentFilter.active = false;
    currentFilter.startDate = null;
    currentFilter.endDate = null;
    currentFilter.preset = null;
    currentFilter.selectedDate = null;
    
    // Kembali ke data HARI INI
    loadAttendanceData();
    
    showMessage('🔄 Kembali menampilkan data hari ini', 'success');
}

// Fungsi untuk memfilter data berdasarkan tanggal
function filterDataByDate(data) {
    if (!currentFilter.active || !currentFilter.startDate || !currentFilter.endDate) {
        return data;
    }
    
    const filteredData = {};
    
    for (const [cardId, student] of Object.entries(data)) {
        try {
            // Filter riwayat berdasarkan tanggal
            const filteredRiwayat = student.riwayat.filter(absen => {
                try {
                    const absenDate = new Date(absen.time);
                    // Bandingkan hanya tanggalnya saja (abaikan jam)
                    const absenDateOnly = new Date(absenDate.toDateString());
                    const startDateOnly = new Date(currentFilter.startDate.toDateString());
                    const endDateOnly = new Date(currentFilter.endDate.toDateString());
                    
                    return absenDateOnly >= startDateOnly && absenDateOnly <= endDateOnly;
                } catch (error) {
                    console.warn('Error parsing date:', absen.time, error);
                    return false;
                }
            });
            
            // Jika ada riwayat yang sesuai dengan filter
            if (filteredRiwayat.length > 0) {
                filteredData[cardId] = {
                    ...student,
                    riwayat: filteredRiwayat
                };
            }
        } catch (error) {
            console.warn('Error filtering data for card:', cardId, error);
        }
    }
    
    return filteredData;
}

// Fungsi untuk flatten data struktur baru
function flattenAttendanceData(data) {
    const flattened = {};
    
    for (const [cardId, student] of Object.entries(data)) {
        if (student.riwayat && Array.isArray(student.riwayat)) {
            student.riwayat.forEach((absen, index) => {
                const uniqueId = `${cardId}_${index}`;
                flattened[uniqueId] = {
                    cardId: cardId,
                    nama: absen.nama,
                    jurusan: absen.jurusan,
                    angkatan: absen.angkatan,
                    time: absen.time
                };
            });
        }
    }
    
    return flattened;
}

// Format tanggal saja (untuk badge)
function formatDate(dateTimeStr) {
    const date = new Date(dateTimeStr);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Format tanggal dan waktu
function formatDateTime(dateTimeStr) {
    const date = new Date(dateTimeStr);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Update waktu terakhir update
function updateLastUpdate() {
    const now = new Date();
    const lastUpdateElement = document.getElementById('lastUpdate');
    const lastUpdateTextElement = document.getElementById('lastUpdateText');
    
    const timeStr = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const dateStr = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    lastUpdateElement.textContent = timeStr;
    lastUpdateTextElement.textContent = `Terakhir update: ${dateStr} ${timeStr}`;
}

// Tampilkan loading
function showLoading() {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="loading">
                <div class="loading-spinner"></div>
                Memuat data absensi...
            </td>
        </tr>
    `;
}

// Tampilkan error
function showError(message) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; color: var(--danger); padding: 40px;">
                ❌ ${message}
            </td>
        </tr>
    `;
}

// Fungsi untuk menampilkan pesan
function showMessage(message, type) {
    // Hapus pesan sebelumnya
    const existingMessage = document.querySelector('.message-popup');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Buat elemen pesan baru
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-popup ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 10px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    
    if (type === 'success') {
        messageDiv.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
    } else {
        messageDiv.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
    }
    
    document.body.appendChild(messageDiv);
    
    // Hapus pesan setelah 3 detik
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

// Fungsi untuk refresh data
function refreshData() {
    loadAttendanceData();
    showMessage('🔄 Data diperbarui', 'success');
}

// Fungsi untuk export ke CSV
function exportToCSV() {
    // Simulasi export CSV
    showMessage('📊 Fitur export CSV dalam pengembangan', 'success');
}

// Fungsi untuk print tabel
function printTable() {
    window.print();
}

// Load data saat halaman dibuka
document.addEventListener('DOMContentLoaded', function() {
    loadAttendanceData();
    
    // Auto-refresh setiap 10 detik untuk GitHub Pages
    setInterval(loadAttendanceData, 10000);
    
    // Close modal ketika klik di luar
    window.onclick = function(event) {
        const modal = document.getElementById('dateFilterModal');
        if (event.target === modal) {
            closeDateFilter();
        }
    };
});

// Animasi saat hover stat card
document.addEventListener('DOMContentLoaded', function() {
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
});