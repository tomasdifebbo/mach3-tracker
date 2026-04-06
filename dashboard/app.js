// API Configuration
const API_URL = 'https://mach3-tracker-production.up.railway.app';

// Auth Check
if (!localStorage.getItem('mach3_token') && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
}

function getAuthHeaders() {
    const token = localStorage.getItem('mach3_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'Bypass-Tunnel-Reminder': 'true' // Bypasses localtunnel warning page
    };
}

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const sectionId = item.getAttribute('data-section');
        if (!sectionId) return; // Skip logout or other non-section items
        
        e.preventDefault();
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${sectionId}`).classList.add('active');
        
        // Update header texts
        const titles = {
            'dashboard': ['Dashboard', 'Visão geral dos jobs CNC'],
            'jobs': ['Histórico', 'Registro completo de atividades'],
            'charts': ['Gráficos', 'Análise aprofundada de produção'],
            'materials': ['Materiais', 'Cadastro de insumos e preços'],
            'settings': ['Configurações', 'Ajustes de custo e produção']
        };
        document.getElementById('pageTitle').innerText = titles[sectionId][0];
        document.getElementById('pageSubtitle').innerText = titles[sectionId][1];
        
        if (sectionId === 'settings') {
            loadSettings();
        }
        if (sectionId === 'materials') {
            fetchMaterials();
        }
    });
});

// Sidebar Toggle
document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// Date Display
const dateElement = document.getElementById('currentDate');
if (dateElement) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.innerText = new Date().toLocaleDateString('pt-BR', options);
}

// Chart Global Defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

let charts = {};

function initCharts() {
    const hoursCtx = document.getElementById('hoursChart')?.getContext('2d');
    const topCtx = document.getElementById('topFilesChart')?.getContext('2d');
    const hoursFullCtx = document.getElementById('hoursChartFull')?.getContext('2d');
    const jobsDayCtx = document.getElementById('jobsPerDayChart')?.getContext('2d');
    const topFullCtx = document.getElementById('topFilesChartFull')?.getContext('2d');
    
    if (hoursCtx && typeof Chart !== 'undefined') {
        charts.hours = new Chart(hoursCtx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Horas', data: [], backgroundColor: createGradient(hoursCtx) }] },
            options: getChartOptions()
        });
    }

    if (topCtx && typeof Chart !== 'undefined') {
        charts.top = new Chart(topCtx, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '70%'}
        });
    }
    
    // Duplicate for the "Charts" full page
    if (hoursFullCtx && typeof Chart !== 'undefined') {
        charts.hoursFull = new Chart(hoursFullCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Horas', data: [], borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4 }] },
            options: getChartOptions()
        });
    }

    if (jobsDayCtx && typeof Chart !== 'undefined') {
        charts.jobsDay = new Chart(jobsDayCtx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Arquivos', data: [], backgroundColor: '#10b981' }] },
            options: getChartOptions()
        });
    }

    if (topFullCtx && typeof Chart !== 'undefined') {
        charts.topFull = new Chart(topFullCtx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Execuções', data: [], backgroundColor: '#8b5cf6' }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    const costCtx = document.getElementById('costProjectChart')?.getContext('2d');
    if (costCtx && typeof Chart !== 'undefined') {
        charts.costProject = new Chart(costCtx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Custo (R$)', data: [], backgroundColor: '#f59e0b' }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: (v) => 'R$ ' + v } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

function createGradient(ctx) {
    if(!ctx) return '#3b82f6';
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, '#06b6d4');
    gradient.addColorStop(1, '#3b82f6');
    return gradient;
}

function getChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
            x: { grid: { display: false } }
        },
        plugins: { legend: { display: false } }
    };
}

// Format utils
function formatStringDuration(minutes) {
    if (minutes === null || minutes === undefined) return "-";
    if (minutes < 0.16) return "< 10s";
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const s = Math.floor((minutes * 60) % 60);
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatPTDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
}

function formatPTTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Settings Persistence
const DEFAULT_SETTINGS = {
    costPerHour: 50.0,
    plannedHours: 8.0
};

function getSettings() {
    // In SaaS mode, settings are loaded from the user object via API
    // We maintain this for local fallback if needed
    const saved = localStorage.getItem('mach3_settings');
    if (saved) return JSON.parse(saved);
    return DEFAULT_SETTINGS;
}

let currentUser = null;

async function loadUserData() {
    try {
        const resp = await fetch(API_URL + '/api/user/me', { headers: getAuthHeaders() });
        if (resp.status === 401 || resp.status === 403) {
            logout();
            return;
        }
        currentUser = await resp.json();
        
        // Update local settings with user settings from DB
        if (currentUser.settings) {
            localStorage.setItem('mach3_settings', JSON.stringify(currentUser.settings));
        }
        
        updateSaaSUI();
    } catch (e) {
        console.error("Auth error:", e);
    }
}

function updateSaaSUI() {
    if (!currentUser) return;
    
    const statusEl = document.getElementById('subscriptionStatus');
    if (statusEl) {
        const expiry = new Date(currentUser.trial_expiry);
        const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
        
        statusEl.innerHTML = `
            <div class="user-chip">
                <span class="user-plan-badge ${currentUser.plan}">${currentUser.plan.toUpperCase()}</span>
                <span class="user-email">${currentUser.email}</span>
                <span class="expiry-note">${daysLeft > 0 ? `Trial: ${daysLeft} dias restantes` : 'Assinatura Expirada'}</span>
            </div>
        `;

        // Apply restrictions based on plan
        // Starter (R$ 49) blocks OEE and Export
        if (currentUser.plan === 'starter' || daysLeft <= 0) {
            const forbiddenFeatures = ['.nav-item[data-section="charts"]', '.export-group', '#statOEE-card'];
            forbiddenFeatures.forEach(query => {
                const el = document.querySelector(query);
                if (el) {
                    el.style.opacity = '0.5';
                    el.style.pointerEvents = 'none';
                    el.title = 'Disponível apenas nos planos Pro e Business';
                }
            });
        }
    }
}

function logout() {
    localStorage.removeItem('mach3_token');
    localStorage.removeItem('mach3_user');
    window.location.href = 'login.html';
}

function loadSettings() {
    const settings = getSettings();
    document.getElementById('settingCostPerHour').value = settings.costPerHour;
    document.getElementById('settingPlannedHours').value = settings.plannedHours;
}

async function saveSettings() {
    const settings = {
        costPerHour: parseFloat(document.getElementById('settingCostPerHour').value) || 50.0,
        plannedHours: parseFloat(document.getElementById('settingPlannedHours').value) || 8.0
    };
    
    // Save to local for instant UI feel
    localStorage.setItem('mach3_settings', JSON.stringify(settings));
    
    try {
        const resp = await fetch(API_URL + '/api/user/settings', {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(settings)
        });
        if (resp.ok) {
            alert('Configurações salvas no servidor!');
            fetchData(); // Recalculate everything
        } else {
            alert('Erro ao salvar no servidor, salvo logalmente apenas.');
            fetchData();
        }
    } catch (e) {
        alert('Erro ao salvar no servidor.');
        fetchData();
    }
}

async function subscribePlan(planType) {
    try {
        const resp = await fetch(API_URL + '/api/payments/create-preference', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ planType })
        });
        const data = await resp.json();
        if (data.init_point) {
            window.location.href = data.init_point;
        }
    } catch (e) { alert("Erro ao iniciar checkout"); }
}

let materials = [];

async function fetchMaterials() {
    try {
        const resp = await fetch(API_URL + '/api/materials', { headers: getAuthHeaders() });
        materials = await resp.json();
        renderMaterialsList();
    } catch (e) {
        console.error("Error fetching materials:", e);
    }
}

async function addMaterial() {
    const name = document.getElementById('newMaterialName').value;
    const price = document.getElementById('newMaterialPrice').value;
    
    if (!name || !price) return alert("Preencha nome e preço!");
    
    try {
        const resp = await fetch(API_URL + '/api/materials', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, price })
        });
        if (resp.ok) {
            document.getElementById('newMaterialName').value = '';
            document.getElementById('newMaterialPrice').value = '';
            await fetchMaterials();
            fetchData();
        }
    } catch (e) {
        alert("Erro ao salvar material");
    }
}

async function deleteMaterial(id) {
    if (!confirm("Excluir este material?")) return;
    try {
        const resp = await fetch(API_URL + `/api/materials/${id}`, { 
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (resp.ok) {
            await fetchMaterials();
            fetchData();
        }
    } catch (e) {
        alert("Erro ao excluir material");
    }
}

function renderMaterialsList() {
    const body = document.getElementById('materialsListBody');
    if (!body) return;
    body.innerHTML = materials.map(m => `
        <tr>
            <td>${m.name}</td>
            <td>${formatCurrency(m.price)}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteMaterial(${m.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function updateJobMaterial(jobId, materialId) {
    const material = materials.find(m => m.id == materialId);
    const payload = material ? {
        material_id: material.id,
        material_name: material.name,
        material_price: material.price
    } : {
        material_id: null,
        material_name: null,
        material_price: 0
    };
    
    try {
        const resp = await fetch(API_URL + `/api/jobs/${jobId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        if (resp.ok) {
            fetchData();
        }
    } catch (e) {
        console.error("Error updating job material:", e);
    }
}

let allJobsData = [];
let isFiltered = false;

let currentActiveStartTime = null;

// Ticker fluido do painel: atualiza o relógio a cada 1 segundo 
setInterval(() => {
    if (currentActiveStartTime) {
        const startDt = new Date(currentActiveStartTime);
        const elapsed = Math.floor((Date.now() - startDt) / 1000);
        if (elapsed >= 0) {
            const h = Math.floor(elapsed / 3600);
            const m = Math.floor((elapsed % 3600) / 60);
            const s = elapsed % 60;
            const pad = n => n.toString().padStart(2, '0');
            const timerEl = document.getElementById('liveTimer');
            if (timerEl) {
                timerEl.innerText = `${pad(h)}:${pad(m)}:${pad(s)}`;
            }
        }
    }
}, 1000);

async function fetchData() {
    try {
        const response = await fetch(API_URL + '/api/jobs', { headers: getAuthHeaders() });
        const data = await response.json();
        
        let rawData = (data || []).filter(job => {
            if (job.end_time) {
                const startDt = new Date(job.start_time);
                const endDt = new Date(job.end_time);
                const diffSec = (endDt - startDt) / 1000;
                if (diffSec < 15) return false;
            }
            return true;
        });
        rawData.sort((a, b) => {
            const getNum = (name) => {
                if (!name) return -1;
                const match = name.match(/(\d+)/);
                return match ? parseInt(match[1], 10) : -1;
            };
            const numA = getNum(a.file_name);
            const numB = getNum(b.file_name);
            if (numA !== numB && numA !== -1 && numB !== -1) return numB - numA;
            return (b.id - a.id) || (new Date(b.start_time) - new Date(a.start_time));
        });

        allJobsData = rawData;
        calculateAndDisplay(allJobsData);
        
        document.getElementById('serverStatusText').innerText = 'Mach3 Local V4.2';
        document.querySelector('.status-dot').classList.add('online');
    } catch (err) {
        console.error(err);
        document.getElementById('serverStatusText').innerText = 'Servidor Offline';
        document.querySelector('.status-dot').classList.remove('online');
    }
}

// Atualização automática via polling local
setInterval(fetchData, 10000);

// Helper to extract project name (looks for Pattern "1234 - NAME")
function getProjectName(folder) {
    if (!folder) return '-';
    
    // 1. Tenta encontrar o padrão "Número - Nome" (ex: 2576 - GLOBOTOY)
    const projectMatch = folder.match(/(\d+\s*-\s*[^\\\/|]+)/);
    if (projectMatch) {
        return projectMatch[1].trim();
    }

    // 2. Fallback: Remove o prefixo da máquina e pega a primeira pasta útil
    let clean = folder.includes('|') ? folder.split('|')[1].trim() : folder;
    const parts = clean.split(/[\\\/]/).filter(p => p.trim() !== "");
    return parts.length > 0 ? parts[0].trim() : clean;
}

function calculateAndDisplay(jobs) {
    const today = new Date();
    let filesTodayCount = 0;
    let totalHoursCount = 0;
    let validCompletedJobsCount = 0;
    const hoursPerDay = {};
    const fileCounts = {};
    const uniqueProjectsOverall = new Set();
    const uniqueProjectsToday = new Set();

    const settings = getSettings();
    let totalCostCount = 0;
    const costByProject = {};

    jobs.forEach(j => {
        const startDt = new Date(j.start_time);
        const isToday = startDt.getDate() === today.getDate() && 
                        (startDt.getMonth() + 1) === (today.getMonth() + 1) && 
                        startDt.getFullYear() === today.getFullYear();
        
        const projectName = getProjectName(j.folder);
        uniqueProjectsOverall.add(projectName);

        if (isToday) {
            filesTodayCount++;
            uniqueProjectsToday.add(projectName);
        }
        
        if (j.end_time || !j.end_time) {
            let dur = j.duration_minutes;
            if (dur === null) {
                dur = (new Date(j.end_time || Date.now()) - startDt) / (1000 * 60);
            }

            if (dur > 0.16) {
                if (j.end_time) validCompletedJobsCount++;
                totalHoursCount += (dur / 60);
                
                const machineCost = (dur / 60) * settings.costPerHour;
                const materialCost = j.material_price || 0;
                const currentCost = machineCost + materialCost;
                
                totalCostCount += currentCost;
                
                if (!costByProject[projectName]) costByProject[projectName] = 0;
                costByProject[projectName] += currentCost;

                const dateKey = `${startDt.getDate().toString().padStart(2, '0')}/${(startDt.getMonth()+1).toString().padStart(2, '0')}`;
                if (!hoursPerDay[dateKey]) hoursPerDay[dateKey] = 0;
                hoursPerDay[dateKey] += (dur / 60);
                
                if (!fileCounts[projectName]) fileCounts[projectName] = 0;
                fileCounts[projectName]++;
            }
        }
    });

    const avgJobHours = validCompletedJobsCount > 0 ? totalHoursCount / validCompletedJobsCount : 0;
    const avgCostPerJob = validCompletedJobsCount > 0 ? totalCostCount / validCompletedJobsCount : 0;
    
    // Preparation for Charts
    const sortedDays = Object.keys(hoursPerDay).sort((a,b) => {
        const [d1,m1] = a.split('/');
        const [d2,m2] = b.split('/');
        return new Date(2026, m1-1, d1) - new Date(2026, m2-1, d2);
    }).slice(-30);
    
    const stats = {
        totalJobs: uniqueProjectsOverall.size,
        totalFiles: jobs.length,
        totalHours: totalHoursCount,
        totalCost: totalCostCount,
        avgJobHours: avgJobHours,
        avgCostPerJob: avgCostPerJob,
        jobsToday: uniqueProjectsToday.size,
        filesToday: filesTodayCount,
        dailyHoursLabels: sortedDays,
        dailyHoursData: sortedDays.map(d => hoursPerDay[d]),
        topFiles: Object.keys(fileCounts)
            .map(k => ({ name: k, count: fileCounts[k], cost: costByProject[k] || 0 }))
            .sort((a, b) => b.count - a.count)
    };

    updateUI(jobs, stats);
}

function updateUI(jobs, stats) {
    // Stats Cards
    // Showing "X Jobs (Y Files)" for better clarity as requested
    document.getElementById('statTotalJobs').innerText = `${stats.totalJobs}`;
    document.getElementById('statTotalHours').innerText = formatStringDuration(stats.totalHours * 60);
    document.getElementById('statAvgTime').innerText = formatStringDuration(stats.avgJobHours * 60);
    document.getElementById('statTodayJobs').innerText = `${stats.jobsToday} (${stats.filesToday})`;

    document.getElementById('statTotalCost').innerText = formatCurrency(stats.totalCost);
    document.getElementById('statAvgCost').innerText = formatCurrency(stats.avgCostPerJob);
    
    // OEE Calculation
    const settings = getSettings();
    const todayHours = stats.dailyHoursData[stats.dailyHoursData.length - 1] || 0;
    const oeeValue = Math.min(100, (todayHours / settings.plannedHours) * 100);
    document.getElementById('statOEE').innerText = `${oeeValue.toFixed(1)}%`;
    
    // Live Job Banner
    const banner = document.getElementById('liveBanner');
    const activeJob = jobs.find(j => !j.end_time);
    if (activeJob && banner) {
        banner.style.display = 'flex';
        document.getElementById('liveFileName').innerText = activeJob.file_name;
        document.getElementById('liveFolderName').innerText = getProjectName(activeJob.folder);
        currentActiveStartTime = activeJob.start_time;
    } else if (banner) {
        banner.style.display = 'none';
        currentActiveStartTime = null;
    }
    
    // Updates Charts
    if (charts.hours && stats.dailyHoursLabels) {
        charts.hours.data.labels = stats.dailyHoursLabels;
        charts.hours.data.datasets[0].data = stats.dailyHoursData;
        charts.hours.update();
        
        if(charts.hoursFull) {
            charts.hoursFull.data.labels = stats.dailyHoursLabels;
            charts.hoursFull.data.datasets[0].data = stats.dailyHoursData;
            charts.hoursFull.update(); 
        }
    }
    
    if (charts.top && stats.topFiles) {
        const top5 = stats.topFiles.slice(0, 5);
        charts.top.data.labels = top5.map(f => f.name.substring(0,20));
        charts.top.data.datasets[0].data = top5.map(f => f.count);
        charts.top.update();
    }

    if (charts.jobsDay && stats.dailyHoursLabels) {
        const jobsPerDay = {};
        jobs.forEach(j => {
            if (j.end_time) {
                const d = new Date(j.start_time);
                const dateKey = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
                if (!jobsPerDay[dateKey]) jobsPerDay[dateKey] = 0;
                jobsPerDay[dateKey]++;
            }
        });
        charts.jobsDay.data.labels = stats.dailyHoursLabels;
        charts.jobsDay.data.datasets[0].data = stats.dailyHoursLabels.map(d => jobsPerDay[d] || 0);
        charts.jobsDay.update();
    }

    if (charts.topFull && stats.topFiles) {
        const top10 = stats.topFiles.slice(0, 10);
        charts.topFull.data.labels = top10.map(f => f.name.substring(0, 25));
        charts.topFull.data.datasets[0].data = top10.map(f => f.count);
        charts.topFull.update();
    }

    if (charts.costProject && stats.topFiles) {
        const top10Costs = [...stats.topFiles].sort((a, b) => b.cost - a.cost).slice(0, 10);
        charts.costProject.data.labels = top10Costs.map(f => f.name.substring(0, 20));
        charts.costProject.data.datasets[0].data = top10Costs.map(f => f.cost);
        charts.costProject.update();
    }
    
    if (!isFiltered) {
        renderJobsTables(jobs);
    }
}

function renderJobsTables(jobs) {
    const settings = getSettings();
    const calculateCost = (job) => {
        const machineMinutes = job.duration_minutes || calculateDuration(job) || 0;
        const machineCost = (machineMinutes / 60) * settings.costPerHour;
        const materialCost = job.material_price || 0;
        return machineCost + materialCost;
    };

    const materialOptions = `<option value="">Sem mat.</option>` + 
        materials.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    const recentBody = document.getElementById('recentJobsBody');
    if (recentBody) {
        recentBody.innerHTML = jobs.slice(0, 8).map(job => `
            <tr>
                <td class="file-name-cell" title="${job.file_name}">${job.file_name}</td>
                <td title="${job.folder}">${getProjectName(job.folder)}</td>
                <td>${formatPTTime(job.start_time)}</td>
                <td>${job.end_time ? formatPTTime(job.end_time) : '<span style="color:var(--accent-warning);">Ativo</span>'}</td>
                <td class="duration-cell">${formatStringDuration(job.duration_minutes || calculateDuration(job))}</td>
                <td style="font-size: 0.8rem; opacity: 0.8;">${job.material_name || '-'}</td>
                <td>${formatCurrency(calculateCost(job))}</td>
                <td>${formatPTDate(job.start_time)}</td>
            </tr>
        `).join('');
    }
    
    const allBody = document.getElementById('allJobsBody');
    if (allBody) {
        allBody.innerHTML = jobs.map(job => `
            <tr>
                <td class="file-name-cell" title="${job.file_name}">${job.file_name}</td>
                <td title="${job.folder}">${getProjectName(job.folder)}</td>
                <td>${formatPTTime(job.start_time)}</td>
                <td>${job.end_time ? formatPTTime(job.end_time) : '<span style="color:var(--accent-warning);">Ativo</span>'}</td>
                <td class="duration-cell">${formatStringDuration(job.duration_minutes || calculateDuration(job))}</td>
                <td>
                    <select class="filter-input-sm" onchange="updateJobMaterial(${job.id}, this.value)" style="width: 100px; padding: 2px; font-size:0.8rem;">
                        ${materialOptions.replace(`value="${job.material_id}"`, `value="${job.material_id}" selected`)}
                    </select>
                </td>
                <td>${formatCurrency(calculateCost(job))}</td>
                <td>${formatPTDate(job.start_time)}</td>
                <td><button class="btn btn-danger" onclick="deleteJob(${job.id})" title="Excluir">🗑️</button></td>
            </tr>
        `).join('');
    }
    
    const countBadge = document.getElementById('jobsCount');
    if(countBadge) countBadge.innerText = `${jobs.length} arquivos`;
}

// Export functions
function exportCSV() {
    const settings = getSettings();
    const headers = ['ID', 'Arquivo', 'Projeto', 'Inicio', 'Fim', 'Duracao (min)', 'Custo (R$)', 'Data'];
    const rows = allJobsData.map(j => [
        j.id,
        j.file_name,
        getProjectName(j.folder),
        formatPTTime(j.start_time),
        j.end_time ? formatPTTime(j.end_time) : 'Ativo',
        (j.duration_minutes || calculateDuration(j)).toFixed(2),
        ((j.duration_minutes || calculateDuration(j))/60 * settings.costPerHour).toFixed(2),
        formatPTDate(j.start_time)
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_mach3_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportPDF() {
    window.print();
}

function calculateDuration(job) {
    if (!job.end_time) return null;
    return (new Date(job.end_time) - new Date(job.start_time)) / (1000 * 60);
}

let pendingDeleteId = null;

async function deleteJob(id) {
    pendingDeleteId = id;
    document.getElementById('deleteModal').style.display = 'flex';
}

document.getElementById('modalCancel')?.addEventListener('click', () => {
    document.getElementById('deleteModal').style.display = 'none';
    pendingDeleteId = null;
});

document.getElementById('modalConfirm')?.addEventListener('click', async () => {
    if (pendingDeleteId !== null) {
        try {
            const resp = await fetch(API_URL + `/api/jobs/${pendingDeleteId}`, { 
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!resp.ok) throw new Error("Erro ao deletar no servidor");
            fetchData();
        } catch(e) { alert("Erro ao deletar: " + e.message); }
    }
    document.getElementById('deleteModal').style.display = 'none';
    pendingDeleteId = null;
});

document.getElementById('deleteModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        e.currentTarget.style.display = 'none';
        pendingDeleteId = null;
    }
});

function showSection(id) {
    document.getElementById(`nav-${id}`).click();
}

function loadJobs() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const month = document.getElementById('filterMonth').value;
    const year = document.getElementById('filterYear').value;
    
    let filtered = allJobsData;
    isFiltered = !!(search || month || year);
    
    if (search) filtered = filtered.filter(j => j.file_name.toLowerCase().includes(search));
    
    if (month || year) {
        filtered = filtered.filter(j => {
            const dt = new Date(j.start_time);
            const mMatch = month ? (dt.getMonth() + 1) == month : true;
            const yMatch = year ? dt.getFullYear() == year : true;
            return mMatch && yMatch;
        });
    }
    
    renderJobsTables(filtered);
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterMonth').value = '';
    document.getElementById('filterYear').value = '';
    isFiltered = false;
    renderJobsTables(allJobsData);
}

document.getElementById('btnFilter')?.addEventListener('click', loadJobs);
document.getElementById('searchInput')?.addEventListener('keyup', (e) => {
    if(e.key === 'Enter') loadJobs();
});
document.getElementById('btnClear')?.addEventListener('click', clearFilters);

initCharts();
loadUserData().then(() => {
    fetchMaterials().then(() => fetchData());
});
