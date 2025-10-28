// script.js

// Workout Data
const workoutData = {
    day1: {
        name: "Day 1: Quad Focus",
        exercises: [
            {name: "Leg Extension", sets: 1, reps: "Failure", type: "isolation"},
            {name: "Hack Squat or Leg Press", sets: 1, reps: "Failure", type: "compound"},
            {name: "Bulgarian Split Squat", sets: 1, reps: "Failure", type: "compound"},
            {name: "Sissy Squat", sets: 1, reps: "Failure", type: "isolation"}
        ]
    },
    day2: {
        name: "Day 2: Hamstring Stretch",
        exercises: [
            {name: "Lying Hamstring Curl", sets: 1, reps: "Failure", type: "isolation"},
            {name: "Romanian Deadlift", sets: 1, reps: "Failure", type: "compound"},
            {name: "Seated Hamstring Curl", sets: 1, reps: "Failure", type: "isolation"},
            {name: "Glute-Ham Raise", sets: 1, reps: "Failure", type: "compound"}
        ]
    },
    day4: {
        name: "Day 4: Glute Focus",
        exercises: [
            {name: "Hip Thrust", sets: 1, reps: "Failure", type: "compound"},
            {name: "Smith Machine Reverse Lunge", sets: 1, reps: "Failure", type: "compound"},
            {name: "Cable Kickback", sets: 1, reps: "Failure", type: "isolation"},
            {name: "Abductor Machine", sets: 1, reps: "Failure", type: "isolation"}
        ]
    },
    day5: {
        name: "Day 5: Upper Body",
        exercises: [
            {name: "Chest Press", sets: 1, reps: "Failure", type: "compound"},
            {name: "Cable Row", sets: 1, reps: "Failure", type: "compound"},
            {name: "Shoulder Press", sets: 1, reps: "Failure", type: "compound"},
            {name: "Bicep Curl", sets: 1, reps: "Failure", type: "isolation"}
        ]
    },
    day6: {
        name: "Day 6: Abs/Core",
        exercises: [
            {name: "Plank Hold", sets: 1, reps: "60s", type: "isolation"},
            {name: "Russian Twists", sets: 1, reps: "Failure", type: "isolation"},
            {name: "Hanging Leg Raises", sets: 1, reps: "Failure", type: "isolation"},
            {name: "Mountain Climbers", sets: 1, reps: "Failure", type: "compound"}
        ]
    }
};

// State
let currentDay = 'day1';
let currentExerciseIndex = 0;
let sessionData = {};
let timerInterval = null;
let timerSeconds = 180;
let timerRunning = false;
let volumeChart = null;
let exerciseCharts = [];
let currentWorkoutRating = 0;
let currentWorkoutTags = [];

// NEW: Robust Storage Helper with availability check
const storage = {
    isAvailable: () => {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    },
    get: (key, def) => {
        if (!storage.isAvailable()) return def;
        try {
            const val = localStorage.getItem(key);
            return val ? JSON.parse(val) : def;
        } catch { return def; }
    },
    set: (key, val) => {
        if (!storage.isAvailable()) return false;
        try {
            localStorage.setItem(key, JSON.stringify(val));
            return true;
        } catch { return false; }
    }
};

// NEW: Centralized Event Listener Setup
function setupEventListeners() {
    // Tab Switching (Handle click on all tab buttons)
    document.querySelectorAll('.tab-bar .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            if (tabName) switchTab(tabName);
        });
    });

    // Dark Mode Toggle
    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);

    // Save Workout Button
    document.getElementById('save-workout-btn').addEventListener('click', saveWorkout);

    // Analytics Quick Actions
    document.getElementById('log-body-weight-btn').addEventListener('click', showBodyWeightLog);
    document.getElementById('export-data-btn').addEventListener('click', exportWorkoutData);
    
    // Day Select Change (Kept from original logic)
    document.getElementById('day-select').addEventListener('change', (e) => {
        currentDay = e.target.value;
        loadWorkout();
    });
}


// Initialize
function init() {
    if (typeof Chart !== 'undefined') {
        Chart.defaults.devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    }

    // Load dark mode preference
    const darkMode = storage.get('darkMode', false);
    if (darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-icon').textContent = '☀️';
    }

    document.getElementById('workout-date').valueAsDate = new Date();
    const today = new Date().toLocaleDateString('en-US', {weekday: 'long'});
    const dayMap = {Monday: 'day1', Tuesday: 'day2', Thursday: 'day4', Friday: 'day5', Saturday: 'day6'};
    currentDay = dayMap[today] || 'day1';
    document.getElementById('day-select').value = currentDay;
    
    setupEventListeners(); // NEW: Call centralized listener setup

    loadWorkout();
    renderAnalytics();
    renderHistory();
    renderCalendar();
}

function loadWorkout() {
    currentExerciseIndex = 0;
    sessionData = {};
    const workout = workoutData[currentDay];
    if (!workout) return;
    updateProgress();
    renderExercise();
}

function renderExercise() {
    const workout = workoutData[currentDay];
    if (!workout) return;

    const exercise = workout.exercises[currentExerciseIndex];
    const exIdx = currentExerciseIndex;
    const numSets = parseInt(exercise.sets) || 1;

    const prs = storage.get('personalRecords', {});
    const pr = prs[exercise.name];
    const history = storage.get('workoutHistory', []);
    const lastWorkout = history.filter(w => 
        w.exercises.some(e => e.name === exercise.name)
    ).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    
    let lastTime = null;
    if (lastWorkout) {
        const lastEx = lastWorkout.exercises.find(e => e.name === exercise.name);
        if (lastEx && lastEx.sets && Object.keys(lastEx.sets).length > 0) {
            // Get the best or first set's data for display
            const firstSetKey = Object.keys(lastEx.sets)[0];
            lastTime = lastEx.sets[firstSetKey];
        }
    }

    let html = `
        <div class="exercise-card">
            <div class="exercise-header">
                <div>
                    <div class="exercise-name">${exercise.name}</div>
                    <div class="exercise-target">Target: ${exercise.sets} × ${exercise.reps}</div>
                </div>
                <div class="exercise-type-badge badge-${exercise.type}">
                    ${exercise.type}
                </div>
            </div>
    `;

    if (pr || lastTime) {
        html += `<div class="pr-display"><div class="pr-display-title">Your Stats</div><div class="pr-display-stats">`;
        if (lastTime) {
            html += `<div class="pr-stat"><div class="pr-stat-label">Last Time</div><div class="pr-stat-value">${lastTime.weight} × ${lastTime.reps}</div></div>`;
        }
        if (pr) {
            html += `<div class="pr-stat"><div class="pr-stat-label">Your PR</div><div class="pr-stat-value">${pr.weight} × ${pr.reps}</div></div>`;
        }
        html += `</div></div>`;
    }

    for (let i = 1; i <= numSets; i++) {
        const setData = sessionData[exIdx]?.sets?.[i] || {};
        const completed = setData.completed === true;
        
        // Check if there's previous data for this set
        const hasPrevious = lastTime || pr;
        
        html += `
            <div class="set-input ${completed ? 'completed' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div class="set-label">Set ${i}</div>
                    <button class="copy-last-btn" onclick="copyLastWorkout(${exIdx}, ${i})" ${hasPrevious ? '' : 'disabled'}>📋 Copy Last</button>
                </div>
                <div class="set-fields">
                    <div class="set-field">
                        <label>Weight (lbs)</label>
                        <input type="number" id="weight-${exIdx}-${i}" value="${setData.weight || ''}" 
                               oninput="handleInput(${exIdx}, ${i})" min="0" step="0.5">
                    </div>
                    <div class="set-multiplier">×</div>
                    <div class="set-field">
                        <label>Reps</label>
                        <input type="number" id="reps-${exIdx}-${i}" value="${setData.reps || ''}"
                               oninput="handleInput(${exIdx}, ${i})" min="0" step="1">
                    </div>
                </div>
            </div>
        `;
    }

    html += `
        <div class="quick-notes">
            <textarea id="notes-${exIdx}" placeholder="Notes (optional)...">${sessionData[exIdx]?.notes || ''}</textarea>
        </div>
        <div class="nav-buttons">
            <button class="nav-btn nav-btn-secondary" onclick="prevExercise()" ${currentExerciseIndex === 0 ? 'disabled' : ''}>
                ← Previous
            </button>
            <button class="nav-btn nav-btn-primary" onclick="nextExercise()">
                ${currentExerciseIndex === workout.exercises.length - 1 ? 'Finish' : 'Next →'}
            </button>
        </div>
    </div>`;

    document.getElementById('current-exercise-container').innerHTML = html;
}

function handleInput(exIdx, setNum) {
    if (!sessionData[exIdx]) sessionData[exIdx] = {sets: {}, notes: ''};
    
    const weight = parseFloat(document.getElementById(`weight-${exIdx}-${setNum}`).value) || 0;
    const reps = parseInt(document.getElementById(`reps-${exIdx}-${setNum}`).value) || 0;
    
    // Store the data, calculating tonnage
    const tonnage = weight * reps;

    if (weight > 0 && reps > 0) {
        sessionData[exIdx].sets[setNum] = {weight, reps, tonnage, completed: false};
    } else if (weight || reps) {
        // Partial data
        sessionData[exIdx].sets[setNum] = {weight: weight, reps: reps, tonnage: 0, completed: false};
    } else {
        // Empty fields - remove set data if it exists
        if (sessionData[exIdx].sets[setNum]) {
            delete sessionData[exIdx].sets[setNum];
        }
    }
}

function nextExercise() {
    const workout = workoutData[currentDay];
    const notes = document.getElementById(`notes-${currentExerciseIndex}`);
    if (notes) {
        if (!sessionData[currentExerciseIndex]) sessionData[currentExerciseIndex] = {sets: {}, notes: ''};
        sessionData[currentExerciseIndex].notes = notes.value;
    }

    // Mark all sets for this exercise as completed when moving to next
    if (sessionData[currentExerciseIndex]?.sets) {
        Object.keys(sessionData[currentExerciseIndex].sets).forEach(setNum => {
            const set = sessionData[currentExerciseIndex].sets[setNum];
            if (set.weight > 0 && set.reps > 0) {
                set.completed = true;
            }
        });
    }

    // Update progress after marking complete
    updateProgress();

    if (currentExerciseIndex < workout.exercises.length - 1) {
        currentExerciseIndex++;
        renderExercise();
    } else {
        // Call save workout if it's the last exercise
        document.getElementById('save-workout-btn').click(); 
    }
}

function prevExercise() {
    if (currentExerciseIndex > 0) {
        currentExerciseIndex--;
        renderExercise();
        updateProgress();
    }
}

function updateProgress() {
    const workout = workoutData[currentDay];
    if (!workout) return;

    let completedSets = 0;
    let totalSets = 0;

    workout.exercises.forEach((ex, idx) => {
        const sets = parseInt(ex.sets) || 1;
        totalSets += sets;
        // Count valid, non-empty sets as completed
        if (sessionData[idx]?.sets) {
            completedSets += Object.values(sessionData[idx].sets).filter(set => set.weight > 0 && set.reps > 0).length;
        }
    });

    const percentage = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
    const circumference = 2 * Math.PI * 58;
    const offset = circumference - (percentage / 100) * circumference;

    document.getElementById('progress-circle').style.strokeDashoffset = offset;
    document.getElementById('progress-text').textContent = `${completedSets}/${totalSets}`;

    if (completedSets === 0) {
        document.getElementById('progress-label').textContent = "Ready to Begin";
        document.getElementById('progress-sublabel').textContent = `${workout.exercises.length} exercises today`;
    } else if (completedSets >= totalSets) { // >= in case of extra sets logged
        document.getElementById('progress-label').textContent = "Workout Complete";
        document.getElementById('progress-sublabel').textContent = "Ready to save";
    } else {
        document.getElementById('progress-label').textContent = `${Math.round(percentage)}% Complete`;
        document.getElementById('progress-sublabel').textContent = `${totalSets - completedSets} sets remaining`;
    }
}

// UPDATED: Function to save workout (now includes unique ID)
function saveWorkout() {
    const workout = workoutData[currentDay];
    const date = document.getElementById('workout-date').value;

    const exercises = workout.exercises.map((ex, idx) => ({
        name: ex.name,
        sets: sessionData[idx]?.sets || {},
        notes: sessionData[idx]?.notes || ''
    }));

    const totalSets = exercises.reduce((sum, ex) => 
        sum + Object.values(ex.sets).filter(set => set.weight > 0 && set.reps > 0).length, 0
    );
    const totalTonnage = exercises.reduce((sum, ex) => 
        sum + Object.values(ex.sets).reduce((s, set) => s + (set.tonnage || 0), 0), 0
    );

    if (totalSets === 0) {
        alert('No sets logged. Please add workout data first.');
        return;
    }

    const workoutEntry = {
        id: Date.now(), // 👈 CRITICAL: Assign unique ID
        date,
        day: currentDay,
        name: workout.name,
        exercises,
        totalVolume: totalSets,
        totalTonnage: totalTonnage,
        rating: 0,
        tags: []
    };

    const history = storage.get('workoutHistory', []);
    history.push(workoutEntry);
    storage.set('workoutHistory', history);

    updatePRs(exercises);
    showCompletionModal(workoutEntry);
    
    // Reset session state
    sessionData = {};
    currentExerciseIndex = 0;
    currentWorkoutRating = 0;
    currentWorkoutTags = [];
    renderExercise();
    updateProgress();
    renderAnalytics();
    renderHistory();
    renderCalendar();
}

function showCompletionModal(workout) {
    const modal = document.getElementById('completion-modal');
    modal.classList.add('active');

    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = ['#4A90E2', '#9B7EBD', '#E87DAB', '#10B981'][Math.floor(Math.random() * 4)];
            confetti.style.animationDelay = Math.random() * 0.4 + 's';
            modal.querySelector('.completion-content').appendChild(confetti);
            setTimeout(() => confetti.remove(), 3000);
        }, i * 25);
    }

    document.getElementById('completion-stats').innerHTML = `
        <div class="completion-stat"><strong>${workout.totalVolume}</strong> sets completed</div>
        <div class="completion-stat"><strong>${workout.exercises.length}</strong> exercises completed</div>
        <div class="completion-stat"><strong>${workout.totalTonnage.toFixed(0)}</strong> lbs total volume</div>
        <div class="completion-stat">Workout: <strong>${workout.name}</strong></div>
    `;
    
    // Reset rating UI
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
}

function closeCompletionModal() {
    // Save rating and tags to the last workout
    const history = storage.get('workoutHistory', []);
    if (history.length > 0 && (currentWorkoutRating > 0 || currentWorkoutTags.length > 0)) {
        history[history.length - 1].rating = currentWorkoutRating;
        history[history.length - 1].tags = [...currentWorkoutTags];
        storage.set('workoutHistory', history);
    }
    
    document.getElementById('completion-modal').classList.remove('active');
}

function openTimer() {
    document.getElementById('timer-modal').classList.add('active');
}

function closeTimer() {
    document.getElementById('timer-modal').classList.remove('active');
}

function setRestTime(seconds) {
    if (timerRunning) return;
    timerSeconds = seconds;
    updateTimerDisplay();
    // Update active class for preset button
    document.querySelectorAll('.timer-preset').forEach(p => p.classList.remove('active'));
    // Use event.target when called from inline onclick
    if (event && event.target) { 
        event.target.classList.add('active');
    } else {
        // Fallback for programmatic call (should manually find the matching button if needed)
        const presetBtn = document.querySelector(`.timer-presets .timer-preset:nth-child(${[60, 180, 300, 420].indexOf(seconds) + 1})`);
        if (presetBtn) presetBtn.classList.add('active');
    }
}

function toggleTimer() {
    if (timerRunning) {
        stopTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    timerRunning = true;
    document.getElementById('timer-start-btn').textContent = 'Pause';
    document.querySelector('.timer-display').classList.add('running');
    document.querySelector('.floating-timer').classList.add('running');

    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();

        if (timerSeconds <= 0) {
            stopTimer();
            alert('Rest period complete!');
            if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
            timerSeconds = 180; // Reset to 3:00 after alert
            setRestTime(180);
            updateTimerDisplay();
        }
    }, 1000);
}

function stopTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    document.getElementById('timer-start-btn').textContent = 'Start';
    document.querySelector('.timer-display').classList.remove('running');
    document.querySelector('.floating-timer').classList.remove('running');
}

function updateTimerDisplay() {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    const display = `${mins}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('timer-display').textContent = display;
    
    if (timerRunning) {
        document.getElementById('timer-float-icon').textContent = display;
    } else {
        document.getElementById('timer-float-icon').textContent = '⏱️';
    }
}

// UPDATED: Function to switch tabs
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Find the correct button using the data-tab attribute
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    document.getElementById(`${tab}-tab`).classList.add('active');

    if (tab === 'stats') renderAnalytics();
    if (tab === 'history') {
        renderHistory();
        renderCalendar();
    }
    if (tab === 'charts') renderCharts();
}

function renderAnalytics() {
    const history = storage.get('workoutHistory', []);
    const prs = storage.get('personalRecords', {});

    document.getElementById('total-workouts').textContent = history.length;
    document.getElementById('total-sets').textContent = history.reduce((sum, w) => sum + w.totalVolume, 0);
    document.getElementById('prs-count').textContent = Object.keys(prs).length;

    const sortedDates = history.map(w => new Date(w.date)).sort((a, b) => b - a);
    let streak = 0;
    if (sortedDates.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let checkDate = new Date(sortedDates[0]);
        checkDate.setHours(0, 0, 0, 0);
        
        const dayInMillis = 86400000;

        // Check if last workout was today or yesterday
        if (checkDate.getTime() === today.getTime() || checkDate.getTime() === today.getTime() - dayInMillis) {
            streak = 1;
            let lastCheckedTime = checkDate.getTime();
            
            // Loop through history backwards to find consecutive days
            for (let i = 1; i < sortedDates.length; i++) {
                const prevDate = new Date(sortedDates[i]);
                prevDate.setHours(0, 0, 0, 0);
                const prevTime = prevDate.getTime();

                // Skip duplicates
                if (prevTime === lastCheckedTime) continue;
                
                // Check if it's the day before the last checked day
                if (lastCheckedTime - prevTime === dayInMillis) {
                    streak++;
                    lastCheckedTime = prevTime;
                } else {
                    break;
                }
            }
        }
    }
    document.getElementById('current-streak').textContent = streak;

    const prEntries = Object.entries(prs).sort((a, b) => b[1].tonnage - a[1].tonnage);
    let prHtml = '';
    if (prEntries.length === 0) {
        prHtml = '<div style="text-align: center; color: var(--text-secondary); padding: 24px;">No personal records yet</div>';
    } else {
        prEntries.forEach(([name, pr]) => {
            prHtml += `
                <div class="pr-item">
                    <div class="pr-exercise">${name}</div>
                    <div class="pr-stats">${pr.weight} × ${pr.reps}</div>
                </div>
            `;
        });
    }
    document.getElementById('pr-list-content').innerHTML = prHtml;
}

// UPDATED: Render History (Now uses unique ID for buttons)
function renderHistory() {
    const history = storage.get('workoutHistory', []).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let html = '';
    if (history.length === 0) {
        html = '<div style="text-align: center; color: var(--text-secondary); padding: 24px;">No workouts logged yet</div>';
    } else {
        history.slice(0, 20).forEach((w) => {
            
            html += `
                <div class="history-item">
                    <div class="history-header">
                        <div class="history-date">${new Date(w.date).toLocaleDateString()}</div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <div class="history-sets">${w.totalVolume} sets</div>
                            <button onclick="editWorkout(${w.id})" style="background: var(--primary-blue); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">Edit</button>
                            <button onclick="deleteWorkout(${w.id})" style="background: var(--error); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">Delete</button>
                        </div>
                    </div>
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">${w.name}</div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                        ${w.exercises.map(e => e.name).join(', ')}
                    </div>
                </div>
            `;
        });
    }
    document.getElementById('history-list-content').innerHTML = html;
}

// UPDATED: Edit Workout (Now uses unique ID)
function editWorkout(workoutId) {
    let history = storage.get('workoutHistory', []);
    
    // Find the workout by its unique ID
    const indexToEdit = history.findIndex(w => w.id === workoutId);
    const workout = history[indexToEdit];
    
    if (!workout) {
        alert('Workout not found');
        return;
    }

    // Set the date and day
    document.getElementById('workout-date').value = workout.date;
    currentDay = workout.day;
    document.getElementById('day-select').value = currentDay;

    // Load the exercises into sessionData
    currentExerciseIndex = 0;
    sessionData = {};
    
    workout.exercises.forEach((ex, idx) => {
        sessionData[idx] = {
            sets: {},
            notes: ex.notes || ''
        };
        
        // Copy all sets and mark them as completed
        Object.keys(ex.sets).forEach(setNum => {
            const set = ex.sets[setNum];
            sessionData[idx].sets[setNum] = {
                weight: set.weight,
                reps: set.reps,
                tonnage: set.tonnage,
                completed: true
            };
        });
    });

    // Delete the old workout from history (using the found index)
    if (indexToEdit > -1) {
        history.splice(indexToEdit, 1);
        storage.set('workoutHistory', history);

        // Recalculate PRs since we removed the old workout
        recalculateAllPRs();
    }

    // Switch to track tab and render
    switchTab('track');

    updateProgress();
    renderExercise();
    renderAnalytics();
}

// UPDATED: Delete Workout (Now uses unique ID)
function deleteWorkout(workoutId) {
    if (!confirm('Are you sure you want to delete this workout? This cannot be undone.')) {
        return;
    }

    let history = storage.get('workoutHistory', []);
    
    // Find the workout by its unique ID
    const indexToDelete = history.findIndex(w => w.id === workoutId);

    if (indexToDelete > -1) {
        history.splice(indexToDelete, 1);
        storage.set('workoutHistory', history);

        // Recalculate PRs since we deleted a workout
        recalculateAllPRs();

        // Update all views
        renderHistory();
        renderCalendar();
        renderAnalytics();
        
        // Re-render charts if on charts tab
        const chartsTab = document.getElementById('charts-tab');
        if (chartsTab.classList.contains('active')) {
            renderCharts();
        }
    }
}

function renderCalendar() {
    const history = storage.get('workoutHistory', []);
    const workoutDates = new Set(history.map(w => w.date));
    
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    let html = '';
    
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
        html += `<div style="text-align: center; font-weight: 700; color: var(--text-secondary); padding: 6px; font-size: 0.75rem;">${d}</div>`;
    });
    
    for (let i = 0; i < firstDay.getDay(); i++) {
        html += '<div></div>';
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(today.getFullYear(), today.getMonth(), day);
        const dateStr = date.toISOString().split('T')[0];
        const isToday = day === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        const hasWorkout = workoutDates.has(dateStr);
        
        html += `<div class="calendar-day ${hasWorkout ? 'workout-day' : ''} ${isToday ? 'today' : ''}">${day}</div>`;
    }
    
    document.getElementById('calendar-grid').innerHTML = html;
}

function renderCharts() {
    const history = storage.get('workoutHistory', []);
    
    if (history.length === 0) {
        document.getElementById('volume-chart').parentElement.innerHTML = 
            '<div style="text-align: center; color: var(--text-secondary); padding: 60px 20px;">Log workouts to see progress charts</div>';
        document.getElementById('exercise-charts-container').innerHTML = '';
        return;
    }

    const sortedHistory = history.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedHistory.map(w => new Date(w.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}));
    const data = sortedHistory.map(w => w.totalVolume);

    const ctx = document.getElementById('volume-chart');
    if (!ctx) return; // Prevent error if the tab is not initialized correctly

    const chartCtx = ctx.getContext('2d');
    if (volumeChart) volumeChart.destroy();

    volumeChart = new Chart(chartCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Sets',
                data: data,
                borderColor: '#4A90E2',
                backgroundColor: 'rgba(74, 144, 226, 0.08)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#4A90E2',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 7
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
                    ticks: {
                        stepSize: 1,
                        color: '#64748B',
                        font: { size: 11 }
                    },
                    grid: {
                        color: 'rgba(226, 232, 240, 0.5)'
                    }
                },
                x: {
                    ticks: {
                        color: '#64748B',
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    const exerciseData = {};
    history.forEach(w => {
        w.exercises.forEach(ex => {
            if (!exerciseData[ex.name]) exerciseData[ex.name] = [];
            const bestSet = Object.values(ex.sets).reduce((best, set) => 
                set.tonnage > best.tonnage ? set : best, {tonnage: 0});
            if (bestSet.tonnage > 0) {
                // Check for duplicates on the same date (e.g., if user edits/resaves)
                const existing = exerciseData[ex.name].find(d => d.date === w.date);
                if (!existing || bestSet.tonnage > existing.tonnage) {
                    if (existing) {
                        existing.tonnage = bestSet.tonnage;
                    } else {
                        exerciseData[ex.name].push({date: w.date, tonnage: bestSet.tonnage});
                    }
                }
            }
        });
    });

    const exerciseFreq = Object.keys(exerciseData).map(name => ({
        name,
        count: exerciseData[name].length
    })).sort((a, b) => b.count - a.count).slice(0, 4);

    const container = document.getElementById('exercise-charts-container');
    container.innerHTML = '';
    exerciseCharts.forEach(c => c.destroy());
    exerciseCharts = [];

    const colors = ['#4A90E2', '#9B7EBD', '#10B981', '#F59E0B'];

    exerciseFreq.forEach((ex, idx) => {
        const exData = exerciseData[ex.name].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const chartDiv = document.createElement('div');
        chartDiv.className = 'chart-container';
        chartDiv.innerHTML = `
            <div class="chart-title">${ex.name}</div>
            <canvas id="ex-chart-${idx}" class="chart-canvas"></canvas>
        `;
        container.appendChild(chartDiv);

        const ctx = document.getElementById(`ex-chart-${idx}`);
        if (!ctx) return;
        
        const chartCtx = ctx.getContext('2d');
        const chart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: exData.map(d => new Date(d.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})),
                datasets: [{
                    label: 'Best Tonnage',
                    data: exData.map(d => d.tonnage.toFixed(0)),
                    borderColor: colors[idx],
                    backgroundColor: `${colors[idx]}15`,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: colors[idx],
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 7
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
                        ticks: {
                            color: '#64748B',
                            font: { size: 11 }
                        },
                        grid: {
                            color: 'rgba(226, 232, 240, 0.5)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#64748B',
                            maxRotation: 45,
                            minRotation: 45,
                            font: { size: 10 }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
        exerciseCharts.push(chart);
    });
}

// Dark Mode Toggle
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('dark-mode-icon').textContent = isDark ? '☀️' : '🌙';
    storage.set('darkMode', isDark);
}

// Copy Last Workout Data
function copyLastWorkout(exIdx, setNum) {
    const exercise = workoutData[currentDay].exercises[exIdx];
    const history = storage.get('workoutHistory', []);
    
    // Find the most recent workout that includes this exercise
    const lastWorkout = history.filter(w => 
        w.exercises.some(e => e.name === exercise.name)
    ).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    
    if (!lastWorkout) {
        alert('No previous data found for this exercise');
        return;
    }
    
    const lastEx = lastWorkout.exercises.find(e => e.name === exercise.name);
    
    // Attempt to copy the specific set number, fallback to the best set if none matches
    let setFound = lastEx.sets[setNum];
    if (!setFound || setFound.weight === 0) {
        setFound = Object.values(lastEx.sets).reduce((best, set) => 
            set.tonnage > best.tonnage ? set : best, {weight: 0, reps: 0});
    }

    if (setFound && setFound.weight > 0) {
        document.getElementById(`weight-${exIdx}-${setNum}`).value = setFound.weight;
        document.getElementById(`reps-${exIdx}-${setNum}`).value = setFound.reps;
        handleInput(exIdx, setNum);
    } else {
        alert('No usable data found in the last workout.');
    }
}

// Workout Rating Functions
function setRating(rating) {
    currentWorkoutRating = rating;
    document.querySelectorAll('.star').forEach((star, idx) => {
        if (idx < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function toggleTag(element, tag) {
    element.classList.toggle('active');
    const idx = currentWorkoutTags.indexOf(tag);
    if (idx > -1) {
        currentWorkoutTags.splice(idx, 1);
    } else {
        currentWorkoutTags.push(tag);
    }
}

// PR Celebration
function checkAndCelebratePR(exercises) {
    const prs = storage.get('personalRecords', {});
    const newPRs = [];
    
    exercises.forEach(ex => {
        Object.values(ex.sets).forEach(set => {
            const oldPR = prs[ex.name];
            // Check if this set is the new PR AND if a previous PR existed (to trigger celebration)
            if (oldPR && set.tonnage > oldPR.tonnage) { 
                newPRs.push({
                    exercise: ex.name,
                    oldWeight: oldPR.weight,
                    oldReps: oldPR.reps,
                    newWeight: set.weight,
                    newReps: set.reps
                });
            }
        });
    });
    
    if (newPRs.length > 0) {
        setTimeout(() => showPRCelebration(newPRs), 500);
    }
}

function showPRCelebration(prs) {
    const modal = document.getElementById('pr-celebration');
    modal.classList.add('active');
    
    // Confetti
    for (let i = 0; i < 60; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = ['#10B981', '#FBBF24', '#4A90E2', '#E87DAB'][Math.floor(Math.random() * 4)];
            confetti.style.animationDelay = Math.random() * 0.3 + 's';
            modal.querySelector('.pr-celebration-content').appendChild(confetti);
            setTimeout(() => confetti.remove(), 3000);
        }, i * 15);
    }
    
    let html = '';
    prs.forEach(pr => {
        html += `<div style="margin: 16px 0; padding: 16px; background: var(--bg-light); border-radius: 12px;">
            <div style="font-weight: 700; color: var(--success); margin-bottom: 8px;">${pr.exercise}</div>
            <div style="font-size: 0.938rem; color: var(--text-secondary);">
                Previous: ${pr.oldWeight} × ${pr.oldReps}<br>
                <strong style="color: var(--success);">New PR: ${pr.newWeight} × ${pr.newReps}!</strong>
            </div>
        </div>`;
    });
    
    document.getElementById('pr-details').innerHTML = html;
    
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
    }
}

function closePRCelebration() {
    document.getElementById('pr-celebration').classList.remove('active');
}

// Export Data
function exportWorkoutData() {
    const history = storage.get('workoutHistory', []);
    
    if (history.length === 0) {
        alert('No workout data to export yet!');
        return;
    }
    
    let csv = 'Date,Workout,Exercise,Set,Weight,Reps,Tonnage,Notes\n';
    
    history.forEach(workout => {
        workout.exercises.forEach(ex => {
            Object.entries(ex.sets).forEach(([setNum, set]) => {
                // Ensure set has data before exporting
                if (set.weight > 0 && set.reps > 0) {
                    csv += `${workout.date},"${workout.name}","${ex.name}",${setNum},${set.weight},${set.reps},${set.tonnage},"${ex.notes || ''}"\n`;
                }
            });
        });
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jasmin-workouts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Body Weight Logging
function showBodyWeightLog() {
    const weights = storage.get('bodyWeights', []);
    const currentWeight = weights.length > 0 ? weights[weights.length - 1].weight : '';
    
    const newWeight = prompt('Enter your current body weight (lbs):', currentWeight);
    
    if (newWeight !== null && newWeight.trim() !== '' && !isNaN(newWeight) && parseFloat(newWeight) > 0) {
        weights.push({
            date: new Date().toISOString().split('T')[0],
            weight: parseFloat(newWeight)
        });
        storage.set('bodyWeights', weights);
        alert(`Body weight logged: ${newWeight} lbs`);
    } else if (newWeight !== null && newWeight.trim() !== '') {
        alert('Invalid weight entered. Please enter a positive number.');
    }
}

// Enhanced Update PRs with celebration check
function updatePRs(exercises) {
    const prs = storage.get('personalRecords', {});
    
    exercises.forEach(ex => {
        Object.values(ex.sets).forEach(set => {
            if (set.weight > 0 && set.reps > 0) {
                if (!prs[ex.name] || set.tonnage > prs[ex.name].tonnage) {
                    prs[ex.name] = {weight: set.weight, reps: set.reps, tonnage: set.tonnage};
                }
            }
        });
    });

    storage.set('personalRecords', prs);
    checkAndCelebratePR(exercises);
}

// Recalculate all PRs from workout history
function recalculateAllPRs() {
    const history = storage.get('workoutHistory', []);
    const prs = {};
    
    // Go through all workouts and find the best performance for each exercise
    history.forEach(workout => {
        workout.exercises.forEach(ex => {
            Object.values(ex.sets).forEach(set => {
                if (set.weight > 0 && set.reps > 0) {
                    const tonnage = set.tonnage || (set.weight * set.reps); // Use stored tonnage or recalculate
                    if (!prs[ex.name] || tonnage > prs[ex.name].tonnage) {
                        prs[ex.name] = {
                            weight: set.weight, 
                            reps: set.reps, 
                            tonnage: tonnage
                        };
                    }
                }
            });
        });
    });
    
    storage.set('personalRecords', prs);
}

document.addEventListener('DOMContentLoaded', init);
