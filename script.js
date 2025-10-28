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
let weightChart = null; 
let exerciseCharts = [];
let currentWorkoutRating = 0;
let currentWorkoutTags = [];

// E1RM Calculator (Brzycki Formula)
function calculateE1RM(weight, reps) {
    if (reps === 1) return weight;
    if (reps > 15 || weight === 0 || reps === 0) return 0;
    return Math.round(weight / (1.0278 - 0.0278 * reps));
}

// Robust Storage Helper
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

// Auto-Focus Utility
function autoAdvanceFocus(exIdx, setNum, isWeight) {
    // 1. Focus on reps field
    if (isWeight) {
        document.getElementById(`reps-${exIdx}-${setNum}`).focus();
        return;
    }

    // 2. Focus on next set's weight field
    const nextSetNum = setNum + 1;
    const nextWeightField = document.getElementById(`weight-${exIdx}-${nextSetNum}`);
    if (nextWeightField) {
        nextWeightField.focus();
    }
}

// Centralized Event Listener Setup
function setupEventListeners() {
    // Tab Switching 
    document.querySelectorAll('.tab-bar .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            if (tabName) switchTab(tabName, btn);
        });
    });

    // Dark Mode Toggle
    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);

    // Save Workout Button
    const saveBtn = document.getElementById('save-workout-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveWorkout);

    // Analytics Quick Actions
    const logWeightBtn = document.getElementById('log-body-weight-btn');
    if (logWeightBtn) logWeightBtn.addEventListener('click', showBodyWeightLog);

    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportWorkoutData);
    
    // Day Select Change
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

    const darkMode = storage.get('darkMode', false);
    if (darkMode) {
        document.body.classList.add('dark-mode');
        const icon = document.getElementById('dark-mode-icon');
        if (icon) icon.textContent = '☀️';
    }

    const dateInput = document.getElementById('workout-date');
    if (dateInput) dateInput.valueAsDate = new Date();
    
    const today = new Date().toLocaleDateString('en-US', {weekday: 'long'});
    const dayMap = {Monday: 'day1', Tuesday: 'day2', Thursday: 'day4', Friday: 'day5', Saturday: 'day6'};
    currentDay = dayMap[today] || 'day1';
    
    const daySelect = document.getElementById('day-select');
    if (daySelect) daySelect.value = currentDay;
    
    setupEventListeners();

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
    
    let lastSetData = null;
    if (lastWorkout) {
        const lastEx = lastWorkout.exercises.find(e => e.name === exercise.name);
        if (lastEx && lastEx.sets && Object.keys(lastEx.sets).length > 0) {
            // Use best set (by tonnage) from last workout for display/copy
            lastSetData = Object.values(lastEx.sets).sort((a, b) => b.tonnage - a.tonnage)[0];
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

    if (pr || lastSetData) {
        html += `<div class="pr-display"><div class="pr-display-title">Your Stats</div><div class="pr-display-stats">`;
        
        if (lastSetData) {
            const e1rm = calculateE1RM(lastSetData.weight, lastSetData.reps);
            html += `<div class="pr-stat"><div class="pr-stat-label">Last Set</div><div class="pr-stat-value">${lastSetData.weight} × ${lastSetData.reps}</div></div>`;
            if(e1rm > 0) html += `<div class="pr-stat"><div class="pr-stat-label">Last E1RM</div><div class="pr-stat-value">${e1rm} lbs</div></div>`;
        }
        if (pr) {
            const e1rm = pr.e1rm || calculateE1RM(pr.weight, pr.reps);
            html += `<div class="pr-stat"><div class="pr-stat-label">Your PR</div><div class="pr-stat-value">${pr.weight} × ${pr.reps}</div></div>`;
            if(e1rm > 0) html += `<div class="pr-stat"><div class="pr-stat-label">PR E1RM</div><div class="pr-stat-value">${e1rm} lbs</div></div>`;
        }
        html += `</div></div>`;
    }

    for (let i = 1; i <= numSets; i++) {
        const setData = sessionData[exIdx]?.sets?.[i] || {};
        const completed = setData.completed === true;
        
        const hasPrevious = lastSetData || pr;
        
        html += `
            <div class="set-input ${completed ? 'completed' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div class="set-label">Set ${i}</div>
                    <button class="copy-last-btn" onclick="copyLastWorkout(${exIdx}, ${i})" ${hasPrevious ? '' : 'disabled'}>📋 Smart Copy</button>
                </div>
                <div class="set-fields">
                    <div class="set-field">
                        <label>Weight (lbs)</label>
                        <input type="number" id="weight-${exIdx}-${i}" value="${setData.weight || ''}" 
                               oninput="handleInput(${exIdx}, ${i}, true)" min="0" step="0.5">
                    </div>
                    <div class="set-multiplier">×</div>
                    <div class="set-field">
                        <label>Reps</label>
                        <input type="number" id="reps-${exIdx}-${i}" value="${setData.reps || ''}"
                               oninput="handleInput(${exIdx}, ${i}, false)" min="0" step="1">
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

    const container = document.getElementById('current-exercise-container');
    if (container) container.innerHTML = html;
}

function handleInput(exIdx, setNum, isWeightInput) {
    if (!sessionData[exIdx]) sessionData[exIdx] = {sets: {}, notes: ''};
    
    const weightEl = document.getElementById(`weight-${exIdx}-${setNum}`);
    const repsEl = document.getElementById(`reps-${exIdx}-${setNum}`);
    
    const weight = parseFloat(weightEl?.value) || 0;
    const reps = parseInt(repsEl?.value) || 0;
    
    const tonnage = weight * reps;
    const e1rm = calculateE1RM(weight, reps);

    if (weight > 0 && reps > 0) {
        sessionData[exIdx].sets[setNum] = {weight, reps, tonnage, e1rm, completed: false};
        autoAdvanceFocus(exIdx, setNum, isWeightInput);
    } else if (weight || reps) {
        sessionData[exIdx].sets[setNum] = {weight: weight, reps: reps, tonnage: 0, e1rm: 0, completed: false};
    } else {
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

    let anySetLogged = false;
    if (sessionData[currentExerciseIndex]?.sets) {
        Object.keys(sessionData[currentExerciseIndex].sets).forEach(setNum => {
            const set = sessionData[currentExerciseIndex].sets[setNum];
            if (set.weight > 0 && set.reps > 0) {
                set.completed = true;
                anySetLogged = true;
            }
        });
    }

    updateProgress();

    if (currentExerciseIndex < workout.exercises.length - 1) {
        currentExerciseIndex++;
        renderExercise();
        
        // Auto-start timer after completing an exercise
        if (anySetLogged) {
            stopTimer(); 
            setRestTime(180); 
            startTimer();
        }
    } else {
        document.getElementById('save-workout-btn')?.click();
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
        if (sessionData[idx]?.sets) {
            completedSets += Object.values(sessionData[idx].sets).filter(set => set.weight > 0 && set.reps > 0).length;
        }
    });

    const percentage = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
    const circumference = 2 * Math.PI * 58;
    const offset = circumference - (percentage / 100) * circumference;

    const circle = document.getElementById('progress-circle');
    if (circle) circle.style.strokeDashoffset = offset;
    
    const text = document.getElementById('progress-text');
    if (text) text.textContent = `${completedSets}/${totalSets}`;

    const label = document.getElementById('progress-label');
    const sublabel = document.getElementById('progress-sublabel');

    if (completedSets === 0) {
        if (label) label.textContent = "Ready to Begin";
        if (sublabel) sublabel.textContent = `${workout.exercises.length} exercises today`;
    } else if (completedSets >= totalSets) { 
        if (label) label.textContent = "Workout Complete";
        if (sublabel) sublabel.textContent = "Ready to save";
    } else {
        if (label) label.textContent = `${Math.round(percentage)}% Complete`;
        if (sublabel) sublabel.textContent = `${totalSets - completedSets} sets remaining`;
    }
}

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
        id: Date.now(), 
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
    if (modal) modal.classList.add('active');

    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = ['#4A90E2', '#9B7EBD', '#E87DAB', '#10B981'][Math.floor(Math.random() * 4)];
            confetti.style.animationDelay = Math.random() * 0.4 + 's';
            modal.querySelector('.completion-content')?.appendChild(confetti);
            setTimeout(() => confetti.remove(), 3000);
        }, i * 25);
    }

    const stats = document.getElementById('completion-stats');
    if (stats) {
        stats.innerHTML = `
            <div class="completion-stat"><strong>${workout.totalVolume}</strong> sets completed</div>
            <div class="completion-stat"><strong>${workout.exercises.length}</strong> exercises completed</div>
            <div class="completion-stat"><strong>${workout.totalTonnage.toFixed(0)}</strong> lbs total volume</div>
            <div class="completion-stat">Workout: <strong>${workout.name}</strong></div>
        `;
    }
    
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
}

function closeCompletionModal() {
    const history = storage.get('workoutHistory', []);
    if (history.length > 0 && (currentWorkoutRating > 0 || currentWorkoutTags.length > 0)) {
        history[history.length - 1].rating = currentWorkoutRating;
        history[history.length - 1].tags = [...currentWorkoutTags];
        storage.set('workoutHistory', history);
    }
    
    const modal = document.getElementById('completion-modal');
    if (modal) modal.classList.remove('active');
}

function openTimer() {
    const modal = document.getElementById('timer-modal');
    if (modal) modal.classList.add('active');
}

function closeTimer() {
    const modal = document.getElementById('timer-modal');
    if (modal) modal.classList.remove('active');
}

function setRestTime(seconds) {
    if (timerRunning) return;
    timerSeconds = seconds;
    updateTimerDisplay();
    document.querySelectorAll('.timer-preset').forEach(p => p.classList.remove('active'));
    
    // Logic to highlight the active preset button
    const presets = [60, 180, 300, 420];
    const index = presets.indexOf(seconds);
    if (index > -1) {
        document.querySelector(`.timer-presets .timer-preset:nth-child(${index + 1})`)?.classList.add('active');
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
    document.querySelector('.timer-display')?.classList.add('running');
    document.querySelector('.floating-timer')?.classList.add('running');

    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();

        if (timerSeconds <= 0) {
            stopTimer();
            alert('Rest period complete!');
            if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
            timerSeconds = 180; 
            setRestTime(180);
            updateTimerDisplay();
        }
    }, 1000);
}

function stopTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    document.getElementById('timer-start-btn').textContent = 'Start';
    document.querySelector('.timer-display')?.classList.remove('running');
    document.querySelector('.floating-timer')?.classList.remove('running');
}

function updateTimerDisplay() {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    const display = `${mins}:${secs.toString().padStart(2, '0')}`;
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) timerDisplay.textContent = display;
    
    const floatIcon = document.getElementById('timer-float-icon');
    if (floatIcon) floatIcon.textContent = timerRunning ? display : '⏱️';
}

function switchTab(tab, clickedButton) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (clickedButton) clickedButton.classList.add('active');

    const tabContent = document.getElementById(`${tab}-tab`);
    if (tabContent) tabContent.classList.add('active');

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

        if (checkDate.getTime() === today.getTime() || checkDate.getTime() === today.getTime() - dayInMillis) {
            streak = 1;
            let lastCheckedTime = checkDate.getTime();
            
            for (let i = 1; i < sortedDates.length; i++) {
                const prevDate = new Date(sortedDates[i]);
                prevDate.setHours(0, 0, 0, 0);
                const prevTime = prevDate.getTime();

                if (prevTime === lastCheckedTime) continue;
                
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
    const historyContent = document.getElementById('history-list-content');
    if (historyContent) historyContent.innerHTML = html;
}

function editWorkout(workoutId) {
    let history = storage.get('workoutHistory', []);
    
    const indexToEdit = history.findIndex(w => w.id === workoutId);
    const workout = history[indexToEdit];
    
    if (!workout) {
        alert('Workout not found');
        return;
    }

    document.getElementById('workout-date').value = workout.date;
    currentDay = workout.day;
    document.getElementById('day-select').value = currentDay;

    currentExerciseIndex = 0;
    sessionData = {};
    
    workout.exercises.forEach((ex, idx) => {
        sessionData[idx] = {
            sets: {},
            notes: ex.notes || ''
        };
        
        Object.keys(ex.sets).forEach(setNum => {
            const set = ex.sets[setNum];
            sessionData[idx].sets[setNum] = {
                weight: set.weight,
                reps: set.reps,
                tonnage: set.tonnage,
                e1rm: set.e1rm || calculateE1RM(set.weight, set.reps),
                completed: true
            };
        });
    });

    if (indexToEdit > -1) {
        history.splice(indexToEdit, 1);
        storage.set('workoutHistory', history);
        recalculateAllPRs();
    }

    const trackBtn = document.querySelector('.tab-btn[data-tab="track"]');
    if (trackBtn) switchTab('track', trackBtn);

    updateProgress();
    renderExercise();
    renderAnalytics();
}

function deleteWorkout(workoutId) {
    if (!confirm('Are you sure you want to delete this workout? This cannot be undone.')) {
        return;
    }

    let history = storage.get('workoutHistory', []);
    
    const indexToDelete = history.findIndex(w => w.id === workoutId);

    if (indexToDelete > -1) {
        history.splice(indexToDelete, 1);
        storage.set('workoutHistory', history);

        recalculateAllPRs();

        renderHistory();
        renderCalendar();
        renderAnalytics();
        
        const chartsTab = document.getElementById('charts-tab');
        if (chartsTab?.classList.contains('active')) {
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
    
    const grid = document.getElementById('calendar-grid');
    if (grid) grid.innerHTML = html;
}

function renderCharts() {
    const history = storage.get('workoutHistory', []);
    const bodyWeights = storage.get('bodyWeights', []).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // --- 1. Body Weight Chart ---
    const weightCtx = document.getElementById('weight-chart');
    if (weightChart) weightChart.destroy();

    if (bodyWeights.length > 0 && weightCtx) {
        weightChart = new Chart(weightCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: bodyWeights.map(d => new Date(d.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})),
                datasets: [{
                    label: 'Body Weight (lbs)',
                    data: bodyWeights.map(d => d.weight),
                    borderColor: '#E87DAB', 
                    backgroundColor: 'rgba(232, 125, 171, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointBackgroundColor: '#E87DAB',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false, } },
                scales: {
                    y: { beginAtZero: false, ticks: { color: '#64748B' } },
                    x: { ticks: { color: '#64748B' } }
                }
            }
        });
    } else if (weightCtx) {
        weightCtx.parentElement.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">Log body weight on the Stats tab to see this chart.</div>';
    }


    if (history.length === 0) {
        const volumeChartEl = document.getElementById('volume-chart');
        if (volumeChartEl) volumeChartEl.parentElement.innerHTML = 
            '<div style="text-align: center; color: var(--text-secondary); padding: 60px 20px;">Log workouts to see progress charts</div>';
        const exerciseContainer = document.getElementById('exercise-charts-container');
        if (exerciseContainer) exerciseContainer.innerHTML = '';
        return;
    }

    // --- 2. Workout Volume Chart ---
    const sortedHistory = history.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedHistory.map(w => new Date(w.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}));
    const data = sortedHistory.map(w => w.totalVolume);

    const ctx = document.getElementById('volume-chart');
    if (!ctx) return; 

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
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#64748B', font: { size: 11 } } },
                x: { ticks: { color: '#64748B', maxRotation: 45, minRotation: 45, font: { size: 10 } }, grid: { display: false } }
            }
        }
    });

    // --- 3. Exercise E1RM/Tonnage Charts ---
    const exerciseData = {};
    history.forEach(w => {
        w.exercises.forEach(ex => {
            if (!exerciseData[ex.name]) exerciseData[ex.name] = [];
            
            const bestSet = Object.values(ex.sets).reduce((best, set) => 
                (set.e1rm || 0) > (best.e1rm || 0) ? set : best, {e1rm: 0});
            
            if (bestSet.e1rm > 0) {
                const existing = exerciseData[ex.name].find(d => d.date === w.date);
                if (!existing || bestSet.e1rm > existing.e1rm) {
                    if (existing) {
                        existing.e1rm = bestSet.e1rm;
                    } else {
                        exerciseData[ex.name].push({date: w.date, e1rm: bestSet.e1rm});
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
    if (container) container.innerHTML = '';
    exerciseCharts.forEach(c => c.destroy());
    exerciseCharts = [];

    const colors = ['#4A90E2', '#9B7EBD', '#10B981', '#F59E0B'];

    exerciseFreq.forEach((ex, idx) => {
        const exData = exerciseData[ex.name].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const chartDiv = document.createElement('div');
        chartDiv.className = 'chart-container';
        chartDiv.innerHTML = `
            <div class="chart-title">${ex.name} (Estimated 1RM Trend)</div>
            <canvas id="ex-chart-${idx}" class="chart-canvas"></canvas>
        `;
        if (container) container.appendChild(chartDiv);

        const ctx = document.getElementById(`ex-chart-${idx}`);
        if (!ctx) return;
        
        const chartCtx = ctx.getContext('2d');
        const chart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: exData.map(d => new Date(d.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})),
                datasets: [{
                    label: 'Estimated 1RM (lbs)',
                    data: exData.map(d => d.e1rm),
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
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#64748B', font: { size: 11 } } },
                    x: { ticks: { color: '#64748B', maxRotation: 45, minRotation: 45, font: { size: 10 } }, grid: { display: false } }
                }
            }
        });
        exerciseCharts.push(chart);
    });
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    const icon = document.getElementById('dark-mode-icon');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    storage.set('darkMode', isDark);

    // Re-render charts to pick up new dark/light text colors
    const chartsTab = document.getElementById('charts-tab');
    if (chartsTab?.classList.contains('active')) {
        renderCharts();
    }
}

function copyLastWorkout(exIdx, setNum) {
    const exercise = workoutData[currentDay].exercises[exIdx];
    const history = storage.get('workoutHistory', []);
    
    const lastWorkout = history.filter(w => 
        w.exercises.some(e => e.name === exercise.name)
    ).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    
    if (!lastWorkout) {
        alert('No previous data found for this exercise');
        return;
    }
    
    const lastEx = lastWorkout.exercises.find(e => e.name === exercise.name);
    
    const bestSet = Object.values(lastEx.sets).reduce((best, set) => 
        set.tonnage > best.tonnage ? set : best, {weight: 0, reps: 0});

    if (bestSet.weight > 0) {
        // Smart Copy Logic: Suggest +2.5 lbs progressive overload
        const smartWeight = bestSet.weight + 2.5;
        
        const weightInput = document.getElementById(`weight-${exIdx}-${setNum}`);
        const repsInput = document.getElementById(`reps-${exIdx}-${setNum}`);
        
        if (weightInput && repsInput) {
             weightInput.value = smartWeight.toFixed(1);
             repsInput.value = bestSet.reps;
             
             // Pass true for isWeightInput to trigger handleInput and auto-focus logic
             handleInput(exIdx, setNum, true); 

             // Stop the timer and reset it, prompting user to start their rest
             stopTimer(); 
             setRestTime(180);
             updateTimerDisplay();
        }

    } else {
        alert('No usable data found in the last workout.');
    }
}

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

function showPRCelebration(prs) {
    const modal = document.getElementById('pr-celebration');
    if (modal) modal.classList.add('active');
    
    for (let i = 0; i < 60; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = ['#10B981', '#FBBF24', '#4A90E2', '#E87DAB'][Math.floor(Math.random() * 4)];
            confetti.style.animationDelay = Math.random() * 0.3 + 's';
            modal?.querySelector('.pr-celebration-content')?.appendChild(confetti);
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
    
    const details = document.getElementById('pr-details');
    if (details) details.innerHTML = html;
    
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
    }
}

function closePRCelebration() {
    const modal = document.getElementById('pr-celebration');
    if (modal) modal.classList.remove('active');
}

function exportWorkoutData() {
    const history = storage.get('workoutHistory', []);
    
    if (history.length === 0) {
        alert('No workout data to export yet!');
        return;
    }
    
    let csv = 'Date,Workout,Exercise,Set,Weight,Reps,Tonnage,E1RM,Notes\n';
    
    history.forEach(workout => {
        workout.exercises.forEach(ex => {
            Object.entries(ex.sets).forEach(([setNum, set]) => {
                if (set.weight > 0 && set.reps > 0) {
                    csv += `${workout.date},"${workout.name}","${ex.name}",${setNum},${set.weight},${set.reps},${set.tonnage},${set.e1rm || calculateE1RM(set.weight, set.reps)},"${ex.notes || ''}"\n`;
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
        
        const chartsTab = document.getElementById('charts-tab');
        if (chartsTab?.classList.contains('active')) {
            renderCharts();
        }

    } else if (newWeight !== null && newWeight.trim() !== '') {
        alert('Invalid weight entered. Please enter a positive number.');
    }
}

function updatePRs(exercises) {
    const prs = storage.get('personalRecords', {});
    
    exercises.forEach(ex => {
        Object.values(ex.sets).forEach(set => {
            if (set.weight > 0 && set.reps > 0) {
                if (!prs[ex.name] || set.tonnage > prs[ex.name].tonnage) {
                    prs[ex.name] = {
                        weight: set.weight, 
                        reps: set.reps, 
                        tonnage: set.tonnage,
                        e1rm: set.e1rm
                    };
                }
            }
        });
    });

    storage.set('personalRecords', prs);
    checkAndCelebratePR(exercises);
}

function recalculateAllPRs() {
    const history = storage.get('workoutHistory', []);
    const prs = {};
    
    history.forEach(workout => {
        workout.exercises.forEach(ex => {
            Object.values(ex.sets).forEach(set => {
                if (set.weight > 0 && set.reps > 0) {
                    const tonnage = set.tonnage || (set.weight * set.reps); 
                    const e1rm = set.e1rm || calculateE1RM(set.weight, set.reps);
                    if (!prs[ex.name] || tonnage > prs[ex.name].tonnage) {
                        prs[ex.name] = {
                            weight: set.weight, 
                            reps: set.reps, 
                            tonnage: tonnage,
                            e1rm: e1rm
                        };
                    }
                }
            });
        });
    });
    
    storage.set('personalRecords', prs);
}

document.addEventListener('DOMContentLoaded', init);
