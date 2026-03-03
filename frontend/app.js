// --- State ---
let viewDate = new Date();
let selectedDate = new Date();
let calendarExpanded = false;
let currentUser = null;
let routines = {}; 

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// --- Global UI Helpers (Fixes ReferenceErrors) ---
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
        if (id === 'editRoutineModal') renderRoutineDays(); // Populate the list
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

// --- Auth Logic ---
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
        document.getElementById('authScreen').classList.remove('hidden');
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
    try {
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
    } catch (err) {
        console.error("Signup Script Error:", err);
    }
}

function logout() {
    localStorage.removeItem('flexlog_token');
    location.reload(); 
}

// --- Data Logic ---
async function fetchRoutines() {
    const token = localStorage.getItem('flexlog_token');
    const res = await fetch('/api/routines', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        const data = await res.json();
        weekDays.forEach(day => routines[day] = { name: '', exercises: [] });
        data.routines.forEach(r => {
            routines[r.day_of_week] = { 
                name: r.rt_name, 
                exercises: r.exercises || [] 
            };
        });
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

// --- Dashboard Rendering ---
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('monthLabel');
    grid.innerHTML = '';
    monthLabel.innerText = `${months[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

    const todayString = new Date().toDateString();

    if (calendarExpanded) {
        // Simple Monthly View logic
        const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
        const lastDay = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
        const start = new Date(firstDay);
        start.setDate(firstDay.getDate() - firstDay.getDay());

        for (let i = 0; i < 42; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const isToday = d.toDateString() === todayString;
            const isSelected = d.toDateString() === selectedDate.toDateString();
            const isOtherMonth = d.getMonth() !== viewDate.getMonth();

            const dayEl = document.createElement('div');
            dayEl.className = `day ${isToday ? 'active' : ''} ${isSelected ? 'selected' : ''} ${isOtherMonth ? 'other-month' : ''}`;
            dayEl.onclick = () => handleDateClick(d);
            dayEl.innerHTML = `<div class="date">${d.getDate()}</div>`;
            grid.appendChild(dayEl);
        }
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
    } else {
        const start = new Date(viewDate);
        start.setDate(viewDate.getDate() - viewDate.getDay());

        for(let i=0; i<7; i++) {
            const d = new Date(start); 
            d.setDate(start.getDate() + i);
            const isToday = d.toDateString() === todayString;
            const isSelected = d.toDateString() === selectedDate.toDateString();
            
            const dayEl = document.createElement('div');
            dayEl.className = `day ${isToday ? 'active' : ''} ${isSelected ? 'selected' : ''}`;
            dayEl.onclick = () => handleDateClick(d);
            dayEl.innerHTML = `<span>${weekDays[d.getDay()].substring(0, 3)}</span><div class="date">${d.getDate()}</div>`;
            grid.appendChild(dayEl);
        }
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
    }
}

async function showDashboard() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.remove('hidden');
    
    if (currentUser) {
        document.getElementById('userNameLabel').innerText = currentUser.user_name;
        try { await fetchRoutines(); } catch (err) { console.warn(err); }
    }

    renderCalendar();
    renderExercises();
    updateSidebarSchedule();
    if (window.lucide) lucide.createIcons();
}

function renderExercises() {
    const list = document.getElementById('exerciseList');
    const dayName = weekDays[selectedDate.getDay()];
    const routine = routines[dayName];
    
    document.getElementById('routineNameLabel').innerText = routine.name || 'No Routine Set';
    list.innerHTML = '';
    
    if (routine.exercises.length === 0) {
        list.innerHTML = '<p class="empty-msg">No exercises set for today.</p>';
        return;
    }

    routine.exercises.forEach((ex, index) => {
        const card = document.createElement('div');
        card.className = 'exercise-card';
        card.innerHTML = `
            <div class="exercise-info">
                <div class="exercise-icon"><i data-lucide="dumbbell"></i></div>
                <div class="exercise-details">
                    <h3>${ex.name}</h3>
                    <p>${ex.sets} Sets • ${ex.reps} Reps</p>
                </div>
            </div>
            <div class="exercise-actions" onclick="toggleDropdown(event, ${index})">
                <i data-lucide="more-vertical"></i>
                <div class="dropdown-menu" id="dropdown-${index}">
                    <div class="dropdown-item" onclick="openEditModal(${index})">Edit</div>
                    <div class="dropdown-item delete" onclick="deleteExercise(${index})">Delete</div>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
    if (window.lucide) lucide.createIcons();
}

function updateSidebarSchedule() {
    const list = document.querySelector('.schedule-list');
    if (!list) return;
    list.innerHTML = '';
    weekDays.forEach(day => {
        const routine = routines[day];
        const isToday = day === weekDays[selectedDate.getDay()];
        list.innerHTML += `<li><span>${day}</span> <span class="val ${isToday ? 'highlight' : ''}">${routine.name || 'Rest'}</span></li>`;
    });
}

// --- Routine Manager ---
// --- Exercise Management ---

async function addExercise() {
    // 1. Get values from the Add Exercise Modal inputs
    const name = document.getElementById('addExerciseName').value;
    const sets = document.getElementById('addExerciseSets').value;
    const reps = document.getElementById('addExerciseReps').value;

    // 2. Simple validation
    if (!name || !sets || !reps) {
        return alert("Please fill in all exercise details.");
    }

    // 3. Identify which day we are adding to based on the calendar selection
    const dayName = weekDays[selectedDate.getDay()];
    
    // 4. Ensure the day object exists
    if (!routines[dayName]) {
        routines[dayName] = { name: '', exercises: [] };
    }

    // 5. Push the new exercise into the local state
    routines[dayName].exercises.push({
        name: name,
        sets: parseInt(sets),
        reps: parseInt(reps)
    });

    // 6. Sync with the server and update the UI
    try {
        await updateRoutinesOnServer(); 
        
        // Reset inputs and close modal
        document.getElementById('addExerciseName').value = '';
        document.getElementById('addExerciseSets').value = '';
        document.getElementById('addExerciseReps').value = '';
        
        closeModal('addExerciseModal');
        renderExercises(); 
    } catch (err) {
        console.error("Failed to save exercise:", err);
        alert("Server error: Could not save exercise.");
    }
}

let editingExerciseIndex = null;

function openEditModal(index) {
    editingExerciseIndex = index;
    const dayName = weekDays[selectedDate.getDay()];
    const ex = routines[dayName].exercises[index];
    
    // Select all inputs within the Edit Modal
    const inputs = document.querySelectorAll('#editExerciseModal .form-input');
    
    // Fill the current data labels
    inputs[0].value = ex.name;
    inputs[1].value = ex.sets;
    inputs[2].value = ex.reps;
    
    // Clear the new update inputs
    inputs[3].value = '';
    inputs[4].value = '';
    inputs[5].value = '';
    
    openModal('editExerciseModal');
}

async function applyEditExercise() {
    const dayName = weekDays[selectedDate.getDay()];
    const inputs = document.querySelectorAll('#editExerciseModal .form-input');
    
    const newName = inputs[3].value;
    const newSets = inputs[4].value;
    const newReps = inputs[5].value;
    
    // Update local state if user provided new values
    if (newName) routines[dayName].exercises[editingExerciseIndex].name = newName;
    if (newSets) routines[dayName].exercises[editingExerciseIndex].sets = parseInt(newSets);
    if (newReps) routines[dayName].exercises[editingExerciseIndex].reps = parseInt(newReps);
    
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

function renderRoutineDays() {
    const list = document.getElementById('routineDaysList');
    if (!list) return;
    list.innerHTML = '';
    weekDays.forEach(day => {
        const routine = routines[day];
        const row = document.createElement('div');
        row.className = 'routine-day-row';
        row.innerHTML = `
            <span class="routine-day-name">${day}</span>
            <input type="text" class="form-input routine-name-input" data-day="${day}" value="${routine.name}" placeholder="Name">
        `;
        list.appendChild(row);
    });
}

async function saveWeeklyRoutine() {
    const inputs = document.querySelectorAll('.routine-name-input');
    inputs.forEach(input => {
        const day = input.dataset.day;
        routines[day].name = input.value; // Save the new name to local state
    });
    
    await updateRoutinesOnServer(); // Sync with the database
    closeModal('editRoutineModal');
    renderExercises();
    updateSidebarSchedule();
}

// --- Initialization ---
window.onload = () => {
    weekDays.forEach(day => routines[day] = { name: '', exercises: [] });
    checkAuth();
};