// Supabase Configuration
const SUPABASE_URL = 'https://ifoiivttteufbtydnbyk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pu4zjObjq1NQ0vcG3yciTQ_HU1K0AJl';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        
        const sectionId = item.getAttribute('data-section');
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${sectionId}`).classList.add('active');
        
        // Update header texts
        const titles = {
            'dashboard': ['Dashboard', 'Visão geral dos jobs CNC'],
            'jobs': ['Histórico', 'Registro completo de atividades'],
            'charts': ['Gráficos', 'Análise aprofundada de produção']
        };
        document.getElementById('pageTitle').innerText = titles[sectionId][0];
        document.getElementById('pageSubtitle').innerText = titles[sectionId][1];
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
            data: { labels: [], datasets: [{ label: 'Jobs', data: [], backgroundColor: '#10b981' }] },
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
        const { data, error } = await supabaseClient
            .from('jobs')
            .select('*')
            .order('start_time', { ascending: false });
        
        if (error) throw error;
        
        // Final Clean Sequential Interleaved Sort (36, 35, 34... at top)
        let rawData = (data || []).filter(job => {
            // HIDE completed jobs shorter than 15 seconds (0.25 min)
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
            
            // Priority 1: Numeric sequence (36, 35, 34...)
            if (numA !== numB && numA !== -1 && numB !== -1) {
                return numB - numA;
            }
            
            // Priority 2: ID or Start Time
            return (b.id - a.id) || (new Date(b.start_time) - new Date(a.start_time));
        });

        allJobsData = rawData;
        calculateAndDisplay(allJobsData);
        
        console.log("DASHBOARD V4: Sincronizado com 36 chapas.");
        document.getElementById('serverStatusText').innerText = 'Mach3 Tracker Cloud V4';
        document.querySelector('.status-dot').classList.add('online');
    } catch (err) {
        console.error(err);
        document.getElementById('serverStatusText').innerText = 'Supabase Disconnected';
        document.querySelector('.status-dot').classList.remove('online');
    }
}

// Real-time Subscriptions
supabaseClient.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload) => {
        console.log('Realtime change received!', payload);
        fetchData();
    })
    .subscribe();

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
        
        if (j.end_time) {
            let dur = j.duration_minutes;
            if (dur === null) {
                dur = (new Date(j.end_time) - startDt) / (1000 * 60);
            }

            if (dur > 0.16) {
                validCompletedJobsCount++;
                totalHoursCount += (dur / 60);
                const dateKey = `${startDt.getDate().toString().padStart(2, '0')}/${(startDt.getMonth()+1).toString().padStart(2, '0')}`;
                if (!hoursPerDay[dateKey]) hoursPerDay[dateKey] = 0;
                hoursPerDay[dateKey] += (dur / 60);
                
                if (!fileCounts[j.file_name]) fileCounts[j.file_name] = 0;
                fileCounts[j.file_name]++;
            }
        }
    });

    const avgJobHours = validCompletedJobsCount > 0 ? totalHoursCount / validCompletedJobsCount : 0;
    
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
        avgJobHours: avgJobHours,
        jobsToday: uniqueProjectsToday.size,
        filesToday: filesTodayCount,
        dailyHoursLabels: sortedDays,
        dailyHoursData: sortedDays.map(d => hoursPerDay[d]),
        topFiles: Object.keys(fileCounts)
            .map(k => ({ name: k, count: fileCounts[k] }))
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
    
    if (!isFiltered) {
        renderJobsTables(jobs);
    }
}

function renderJobsTables(jobs) {
    const recentBody = document.getElementById('recentJobsBody');
    if (recentBody) {
        recentBody.innerHTML = jobs.slice(0, 8).map(job => `
            <tr>
                <td>${job.id}</td>
                <td class="file-name-cell" title="${job.file_name}">${job.file_name}</td>
                <td title="${job.folder}">${getProjectName(job.folder)}</td>
                <td>${formatPTTime(job.start_time)}</td>
                <td>${job.end_time ? formatPTTime(job.end_time) : '<span style="color:var(--accent-warning);">Ativo</span>'}</td>
                <td class="duration-cell">${formatStringDuration(job.duration_minutes || calculateDuration(job))}</td>
                <td>${formatPTDate(job.start_time)}</td>
            </tr>
        `).join('');
    }
    
    const allBody = document.getElementById('allJobsBody');
    if (allBody) {
        allBody.innerHTML = jobs.map(job => `
            <tr>
                <td>${job.id}</td>
                <td class="file-name-cell" title="${job.file_name}">${job.file_name}</td>
                <td title="${job.folder}">${getProjectName(job.folder)}</td>
                <td>${formatPTTime(job.start_time)}</td>
                <td>${job.end_time ? formatPTTime(job.end_time) : '<span style="color:var(--accent-warning);">Ativo</span>'}</td>
                <td class="duration-cell">${formatStringDuration(job.duration_minutes || calculateDuration(job))}</td>
                <td>${formatPTDate(job.start_time)}</td>
                <td><button class="btn btn-danger" onclick="deleteJob(${job.id})" title="Excluir">🗑️</button></td>
            </tr>
        `).join('');
    }
    
    const countBadge = document.getElementById('jobsCount');
    if(countBadge) countBadge.innerText = `${jobs.length} arquivos`;
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
            const { error } = await supabaseClient
                .from('jobs')
                .delete()
                .eq('id', pendingDeleteId);
            
            if (error) throw error;
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
fetchData();
