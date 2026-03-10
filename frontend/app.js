// --- 1. Global State ---
let viewDate = new Date();
let selectedDate = new Date();
let calendarExpanded = false;
let currentUser = null;
let routines = {}; 
let currentManagingDay = ''; 
let currentLogId = null;

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// --- 2. Global UI Helpers ---
function toggleAuth() {
    const loginCard = document.getElementById('loginCard');
    const signupCard = document.getElementById('signupCard');
    if (loginCard && signupCard) {
        loginCard.classList.toggle('hidden');
        signupCard.classList.toggle('hidden');
    }
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
        if (id === 'editRoutineModal') renderRoutineDays();
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

function toggleCalendar() {
    calendarExpanded = !calendarExpanded;
    const btn = document.getElementById('expandBtn');
    if (btn) btn.innerText = calendarExpanded ? 'Collapse' : 'Expand';
    renderCalendar();
}

function handleDateClick(date) {
    selectedDate = new Date(date);
    viewDate = new Date(date); 
    renderCalendar();
    renderExercises();
}

function toggleDropdown(event, index) {
    event.stopPropagation();
    const current = document.getElementById(`dropdown-${index}`);
    document.querySelectorAll('.dropdown-menu').forEach(d => {
        if (d !== current) d.classList.remove('show');
    });
    if (current) current.classList.toggle('show');
}

// --- 3. Auth Logic ---
async function checkAuth() {
    const token = localStorage.getItem('flexlog_token');
    if (!token) {
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('dashboardScreen').classList.add('hidden');
        return;
    }
    try {
        const res = await fetch('/api/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            currentUser = await res.json();
            await showDashboard();
        } else {
            localStorage.removeItem('flexlog_token');
            document.getElementById('authScreen').classList.remove('hidden');
        }
    } catch (err) {
        console.error("Auth check failed", err);
    }
}

async function login() {
    const loginCard = document.getElementById('loginCard');
    const email = loginCard.querySelector('input[type="email"]').value;
    const password = loginCard.querySelector('input[type="password"]').value;
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (res.ok) {
        const data = await res.json();
        localStorage.setItem('flexlog_token', data.token); 
        currentUser = data.user;
        showDashboard();
    } else {
        alert("Invalid Login");
    }
}

async function signup() {
    const signupCard = document.getElementById('signupCard');
    const inputs = signupCard.querySelectorAll('.form-input');
    const username = inputs[0].value;
    const email = inputs[1].value;
    const password = inputs[2].value;
    if (!username || !email || !password) return alert("Please fill in all fields.");
    const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });
    if (res.ok) {
        alert("Account created! Please log in.");
        toggleAuth();
    } else {
        const data = await res.json();
        alert(data.error || 'Signup failed');
    }
}

function logout() {
    localStorage.removeItem('flexlog_token');
    location.reload(); 
}

// --- 4. Data Logic ---
async function fetchRoutines() {
    const token = localStorage.getItem('flexlog_token');
    const res = await fetch('/api/routines', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        const data = await res.json();
        // Reset local state
        weekDays.forEach(day => routines[day] = { name: '', exercises: [] });
        
        data.routines.forEach(r => {
            routines[r.day_of_week] = { 
                name: r.rt_name || '', 
                // Map DB template names to frontend names
                exercises: r.exercises.map(ex => ({
                    name: ex.et_name,    
                    sets: ex.target_sets,
                    reps: ex.target_reps
                }))
            };
        });
        renderExercises();
        updateSidebarSchedule();
    }
}

async function updateRoutinesOnServer() {
    const token = localStorage.getItem('flexlog_token');
    await fetch('/api/routines/update', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ routines })
    });
}

// --- 5. Dashboard Rendering ---
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('monthLabel');
    if (!grid || !monthLabel) return;
    grid.innerHTML = '';
    monthLabel.innerText = `${months[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
    const todayString = new Date().toDateString();

    if (calendarExpanded) {
        const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
        const start = new Date(firstDay);
        start.setDate(firstDay.getDate() - firstDay.getDay());
        for (let i = 0; i < 42; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const dayEl = document.createElement('div');
            dayEl.className = `day ${d.toDateString() === todayString ? 'active' : ''} ${d.toDateString() === selectedDate.toDateString() ? 'selected' : ''} ${d.getMonth() !== viewDate.getMonth() ? 'other-month' : ''}`;
            dayEl.onclick = () => handleDateClick(d);
            dayEl.innerHTML = `<div class="date">${d.getDate()}</div>`;
            grid.appendChild(dayEl);
        }
    } else {
        const start = new Date(viewDate);
        start.setDate(viewDate.getDate() - viewDate.getDay());
        for(let i=0; i<7; i++) {
            const d = new Date(start); 
            d.setDate(start.getDate() + i);
            const dayEl = document.createElement('div');
            dayEl.className = `day ${d.toDateString() === todayString ? 'active' : ''} ${d.toDateString() === selectedDate.toDateString() ? 'selected' : ''}`;
            dayEl.onclick = () => handleDateClick(d);
            dayEl.innerHTML = `<span>${weekDays[d.getDay()].substring(0, 3)}</span><div class="date">${d.getDate()}</div>`;
            grid.appendChild(dayEl);
        }
    }
}

async function showDashboard() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.remove('hidden');
    if (currentUser) {
        document.getElementById('userNameLabel').innerText = currentUser.user_name;
        await fetchRoutines();
    }
    renderCalendar();
    renderExercises();
    updateSidebarSchedule();
    updateDailyVolumeBars();
    updateProgressChart();
    updateProgressSummary();
    if (window.lucide) lucide.createIcons();
}

async function renderExercises() {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const isToday = selectedDate.toDateString() === new Date().toDateString();
    document.getElementById('dateHeadingLabel').innerText = isToday ? 'Today' : 
        selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const token = localStorage.getItem('flexlog_token');
    const res = await fetch(`/api/logs/${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await res.json();
    currentLogId = data.logs_id;
    document.getElementById('routineNameLabel').innerText = data.rt_name || 'No Routine Set';

    // Call the function that handles the HTML generation
    renderExerciseCards(data.exercises);
    updateDailyVolumeDisplay(data.exercises);
}

function renderExerciseCards(exercises) {
    const list = document.getElementById('exerciseList');
    list.innerHTML = '';

    if (!exercises || exercises.length === 0) {
        list.innerHTML = '<p class="empty-msg">No exercises for this day.</p>';
        return;
    }

    exercises.forEach((ex) => {
        const isDone = ex.status === 'Completed';
        const isPrePlanned = ex.et_id !== null;

        const card = document.createElement('div');
        card.className = `exercise-card ${isDone ? 'completed' : ''}`;

        card.innerHTML = `
            <div class="exercise-info">
                <div class="exercise-icon"><i data-lucide="dumbbell"></i></div>
                <div class="exercise-details">
                    <h3 class="${isDone ? 'strikethrough' : ''}">${ex.de_name}</h3>
                    <p>${ex.actual_sets} Sets • ${ex.actual_reps} Reps • ${ex.actual_weight || 0} kg</p>
                </div>
            </div>

            <div class="exercise-actions-group">
                <input type="checkbox" class="exercise-checkbox" ${isDone ? 'checked' : ''}
                    onclick="toggleExerciseStatus(${ex.de_id}, this.checked)">

                ${!isPrePlanned ? `
                    <div class="exercise-actions" onclick="toggleDropdown(event, ${ex.de_id})">
                        <i data-lucide="more-vertical"></i>
                        <div class="dropdown-menu" id="dropdown-${ex.de_id}">
                            <div class="dropdown-item delete" onclick="deleteDailyExercise(${ex.de_id}, false)">Delete</div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        list.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
}

async function toggleExerciseStatus(id, isChecked) {
    const status = isChecked ? 'Completed' : 'Pending';

    const token = localStorage.getItem('flexlog_token');

    await fetch(`/api/exercises/${id}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
    });

    await renderExercises();

    updateDailyVolumeBars();
    updateProgressChart();
    updateProgressSummary();
}

async function deleteDailyExercise(id, isPrePlanned) {
    if (isPrePlanned) {
        alert("You cannot delete planned exercises.");
        return;
    }

    if (!confirm("Delete this exercise?")) return;

    const token = localStorage.getItem('flexlog_token');

    const res = await fetch(`/api/exercises/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) renderExercises();
}

// --- 6. Weekly Routine Planner (Screenshot 2 Logic) ---
function renderRoutineDays() {
    const list = document.getElementById('routineDaysList');
    if (!list) return;
    list.innerHTML = '';
    weekDays.forEach(day => {
        const routine = routines[day] || { name: '', exercises: [] };
        const row = document.createElement('div');
        row.className = 'routine-day-row'; 
        row.innerHTML = `
            <span class="routine-day-name">${day}</span>
            <div class="routine-day-controls">
                <input class="input-small routine-name-input" data-day="${day}" value="${routine.name}" placeholder="Routine Name">
                <button class="btn-exercises" onclick="openExerciseManager('${day}')">
                    <span>${routine.exercises.length} Exercises</span>
                    <i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i>
                </button>
            </div>`;
        list.appendChild(row);
    });
    if (window.lucide) lucide.createIcons();
}

function openExerciseManager(day) {
    currentManagingDay = day; 
    const title = document.getElementById('managerDayTitle');
    if (title) title.innerText = `${day} Exercises`;
    
    renderManagerList(); 
    
    const managerOverlay = document.getElementById('exerciseManager');
    if (managerOverlay) {
        managerOverlay.classList.remove('hidden');
        // Optional: Hide the background list to prevent scrolling issues
        document.getElementById('routineDaysList').style.visibility = 'hidden';
    }
}

function closeExerciseManager() {
    const managerOverlay = document.getElementById('exerciseManager');
    if (managerOverlay) {
        managerOverlay.classList.add('hidden');
        document.getElementById('routineDaysList').style.visibility = 'visible';
    }
}

function renderManagerList() {
    const list = document.getElementById('managerExerciseList');
    if (!list) return;
    list.innerHTML = '';
    const exercises = routines[currentManagingDay]?.exercises || [];
    if (exercises.length === 0) {
        list.innerHTML = '<p class="empty-msg">No exercises in this template yet.</p>';
        return;
    }
    exercises.forEach((ex, i) => {
        const item = document.createElement('div');
        item.className = 'exercise-manager-item';
        item.innerHTML = `
            <span>${ex.name} (${ex.sets}x${ex.reps})</span>
            <button class="btn-link delete" onclick="deletePlannerExercise(${i})">Remove</button>`;
        list.appendChild(item);
    });
}

// FIXED: Added missing "Add Exercise" logic for the Weekly Planner Manager
async function addExerciseToManager() {
    const name = document.getElementById('mgrNewExName').value;
    const sets = document.getElementById('mgrNewExSets').value;
    const reps = document.getElementById('mgrNewExReps').value;

    if (!name || !sets || !reps) return alert("Fill all fields");

    routines[currentManagingDay].exercises.push({
        name: name,
        sets: parseInt(sets),
        reps: parseInt(reps)
    });

    // Reset inputs
    document.getElementById('mgrNewExName').value = '';
    document.getElementById('mgrNewExSets').value = '';
    document.getElementById('mgrNewExReps').value = '';

    renderManagerList();
    renderRoutineDays(); // Update exercise count in background list
}

function deletePlannerExercise(index) {
    routines[currentManagingDay].exercises.splice(index, 1);
    renderManagerList();
    renderRoutineDays();
}

async function saveWeeklyRoutine() {
    const inputs = document.querySelectorAll('.routine-name-input');
    inputs.forEach(input => {
        const day = input.dataset.day;
        routines[day].name = input.value;
    });
    await updateRoutinesOnServer();
    closeModal('editRoutineModal');
    renderExercises();
    updateSidebarSchedule();
}

// --- 7. Dashboard Exercise Actions (Screenshot 1 Logic) ---
async function addExercise() {
    const name = document.getElementById('addExerciseName').value;
    const sets = document.getElementById('addExerciseSets').value;
    const reps = document.getElementById('addExerciseReps').value;
    const weight = document.getElementById('addExerciseWeight').value; // New
    
    if (!name || !sets || !reps || !weight || !currentLogId) return alert("Missing data");

    const token = localStorage.getItem('flexlog_token');
    const res = await fetch(`/api/logs/${currentLogId}/exercise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, sets, reps, weight })
    });

    if (res.ok) {
        closeModal('addExerciseModal');
        renderExercises();
        updateProgressSummary(); // Refresh summary
    }
}

let editingExerciseIndex = null;
function openEditModal(index) {
    editingExerciseIndex = index;
    const dayName = weekDays[selectedDate.getDay()];
    const ex = routines[dayName].exercises[index];
    const inputs = document.querySelectorAll('#editExerciseModal .form-input');
    inputs[0].value = ex.name;
    inputs[1].value = ex.sets;
    inputs[2].value = ex.reps;
    openModal('editExerciseModal');
}

async function applyEditExercise() {
    const dayName = weekDays[selectedDate.getDay()];
    const inputs = document.querySelectorAll('#editExerciseModal .form-input');
    routines[dayName].exercises[editingExerciseIndex] = {
        name: inputs[3].value || inputs[0].value,
        sets: parseInt(inputs[4].value) || parseInt(inputs[1].value),
        reps: parseInt(inputs[5].value) || parseInt(inputs[2].value)
    };
    await updateRoutinesOnServer();
    closeModal('editExerciseModal');
    renderExercises();
}

async function deleteExercise(index) {
    if (confirm("Delete this exercise?")) {
        const dayName = weekDays[selectedDate.getDay()];
        routines[dayName].exercises.splice(index, 1);
        await updateRoutinesOnServer();
        renderExercises();
    }
}

// --- 8. Sidebar & Init ---
function updateSidebarSchedule() {
    const list = document.querySelector('.schedule-list');
    if (!list) return;
    list.innerHTML = '';
    weekDays.forEach(day => {
        const routine = routines[day] || { name: '', exercises: [] };
        const isToday = day === weekDays[selectedDate.getDay()];
        list.innerHTML += `<li><span>${day}</span> <span class="val ${isToday ? 'highlight' : ''}">${routine.name || 'Rest'}</span></li>`;
    });
}

async function updateDailyVolumeBars() {
    const token = localStorage.getItem('flexlog_token');
    // Fetch last 7 days of volume
    const res = await fetch('/api/analytics/volume?range=weekly', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    // Select the bar container
    const container = document.getElementById('dailyVolumeBarContainer');
    if (!container) return;
    container.innerHTML = ''; 

    const maxVolume = Math.max(...data.map(d => d.value), 1000); 

    data.forEach(day => {
        const heightPercentage = (day.value / maxVolume) * 100;
        const bar = document.createElement('div');
        bar.style.flex = "1";
        bar.style.height = `${Math.max(heightPercentage, 5)}%`; 
        // Highlight the bar if it matches the currently selected date in the calendar
        const isSelected = day.date === selectedDate.toISOString().split('T')[0];
        bar.style.background = isSelected ? "var(--accent-blue)" : "#1a1a1e";
        bar.style.borderRadius = "4px";
        bar.title = `${day.label}: ${day.value} volume`;
        container.appendChild(bar);
    });
}

async function updateProgressChart() {
    const range = document.getElementById('progressRangeSelect').value;
    const token = localStorage.getItem('flexlog_token');
    
    const res = await fetch(`/api/analytics/volume?range=${range}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    const path = document.querySelector('#progressLineChart path');
    const labelContainer = document.getElementById('progressLabels');
    
    // Clear previous state
    labelContainer.innerHTML = '';
    if (!data || data.length === 0) {
        path.setAttribute('d', 'M0,100 L100,100');
        return;
    }

    const maxVal = Math.max(...data.map(d => d.value), 1);
    
    // 1. Generate Line Path
    let coords = data.map((point, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((point.value / maxVal) * 100);
        return `${x},${y}`;
    }).join(' L');
    path.setAttribute('d', `M${coords}`);

    // 2. Inject Correct Labels
    data.forEach((point) => {
        const span = document.createElement('span');
        span.style.fontSize = '9px';
        span.style.color = 'var(--text-muted)';
        if (range === "yearly") {
            span.innerText = months[point.label - 1];
        } else {
            span.innerText = point.label;
        }
        labelContainer.appendChild(span);
    });
}

async function updateProgressSummary() {
    const token = localStorage.getItem('flexlog_token');
    const res = await fetch('/api/analytics/compare-weeks', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await res.json();
    const summaryLabel = document.getElementById('summaryText');
    const diff = data.diff || 0;

    if (diff > 0) {
        summaryLabel.innerHTML = `You've <span class="status-improved">improved</span> by ${diff.toLocaleString()} kg from last week!`;
    } else if (diff < 0) {
        summaryLabel.innerHTML = `You're <span class="status-behind">behind</span> by ${Math.abs(diff).toLocaleString()} kg from last week.`;
    } else {
        summaryLabel.innerHTML = `<span class="status-neutral">Consistent volume</span> from last week.`;
    }
}

async function updateDailyVolumeDisplay(exercises) {
    const display = document.getElementById('dailyVolumeDisplay');
    if (!display) return;

    // Calculate sum only for exercises marked 'Completed'
    const total = exercises.reduce((acc, ex) => {
        if (ex.status === 'Completed') {
            return acc + (ex.actual_sets * ex.actual_reps * (ex.actual_weight || 0));
        }
        return acc;
    }, 0);

    display.innerText = total.toLocaleString();
}

function changeMonth(offset) {
    viewDate.setMonth(viewDate.getMonth() + offset);
    renderCalendar();
}

window.onload = () => {
    weekDays.forEach(day => routines[day] = { name: '', exercises: [] });
    checkAuth();

    /* ===== INPUT VALIDATION (ADDED) ===== */
    document.querySelectorAll('input[type="number"]').forEach(input => {

        // Prevent typing invalid characters
        input.addEventListener("keydown", function(e) {
            if (["e", "E", "+", "-", "."].includes(e.key)) {
                e.preventDefault();
            }
        });

        // Clean pasted values
        input.addEventListener("input", function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });

    });
    /* ===== END OF ADDED CODE ===== */
};