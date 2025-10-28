// script.js

// Workout Data (Will be loaded/overwritten from localStorage in init)
let workoutData = {
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
let sessionDurationSeconds = 0; 
let sessionDurationInterval = null; 

// Utility Functions

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
    if (isWeight) {
        document.getElementById(`reps-${exIdx}-${setNum}`)?.focus();
        return;
    }
    const nextSetNum = setNum + 1;
    document.getElementById(`weight-${exIdx}-${nextSetNum}`)?.focus();
}

// QoL: Session Duration Timer Logic
function updateSessionDurationDisplay() {
    const hours = Math.floor(sessionDurationSeconds / 3600);
    const minutes = Math.floor((sessionDurationSeconds % 3600) / 60);
    const seconds = sessionDurationSeconds % 60;

    const display = 
        `${String(hours).padStart(2, '0')}:` +
        `${String(minutes).padStart(2, '0')}:` +
        `${String(seconds).padStart(2, '0')}`;
    
    document.getElementById('session-timer-display').textContent = display;
}

function startSessionTimer() {
    if (sessionDurationInterval) clearInterval(sessionDurationInterval);
    
    sessionDurationInterval = setInterval(() => {
        sessionDurationSeconds++;
        updateSessionDurationDisplay();
    }, 1000);
    
    document.querySelector('.app-header')?.classList.add('session-running');
}

function stopSessionTimer() {
    clearInterval(sessionDurationInterval);
    sessionDurationInterval = null;
    document.querySelector('.app-header')?.classList.remove('session-running');
}

// Centralized Event Listener Setup
function setupEventListeners() {
    document.querySelectorAll('.tab-bar .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            if (tabName) switchTab(tabName, btn);
        });
    });

    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) darkModeToggle.addEventListener('click', toggleDarkMode);

    const saveBtn = document.getElementById('save-workout-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveWorkout);

    const logWeightBtn = document.getElementById('log-body-weight-btn');
    if (logWeightBtn) logWeightBtn.addEventListener('click', showBodyWeightLog);

    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportWorkoutData);
    
    document.getElementById('day-select')?.addEventListener('change', (e) => {
        currentDay = e.target.value;
        loadWorkout();
    });
}


// Core App Logic

function init() {
    if (typeof Chart !== 'undefined') {
        Chart.defaults.devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    }

    // QoL #6: System Theme Default Check on Init
    let darkMode = storage.get('darkMode', null);
    if (darkMode === null) {
        darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    if (darkMode) {
        document.body.classList.add('dark-mode');
        const icon = document.getElementById('dark-mode-icon');
        if (icon) icon.textContent = '☀️';
    }
    storage.set('darkMode', darkMode); 
    
    const dateInput = document.getElementById('workout-date');
    if (dateInput) dateInput.valueAsDate = new Date();
    
    const today = new Date().toLocaleDateString('en-US', {weekday: 'long'});
    const dayMap = {Monday: 'day1', Tuesday: 'day2', Thursday: 'day4', Friday: 'day5', Saturday: 'day6'};
    currentDay = dayMap[today] || 'day1';
    
    const daySelect = document.getElementById('day-select');
    if (daySelect) daySelect.value = currentDay;
    
    setupEventListeners();

    // QoL #8: Load custom workout data if it exists
    const storedWorkoutData = storage.get('customWorkoutData', null);
    if (storedWorkoutData) workoutData = storedWorkoutData;

    loadWorkout();
    renderAnalytics();
    renderHistory();
    renderCalendar();
    renderPlanTab(); 
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

    const lastWorkoutEntry = history.filter(w => 
        w.exercises.some(e => e.name === exercise.name)
    ).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    
    let lastSetData = null;
    let lastNotes = "";
    if (lastWorkoutEntry) {
        const lastEx = lastWorkoutEntry.exercises.find(e => e.name === exercise.name);
        if (lastEx) {
            lastSetData = Object.values(lastEx.sets).sort((a, b) => b.tonnage - a.tonnage)[0];
            lastNotes = lastEx.notes || "";
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
    
    // QoL #7: Last Notes Preview in Tracker
    if (lastNotes && lastWorkoutEntry) {
         html += `
            <details class="info-box" style="margin: 0 0 16px 0;">
                <summary class="info-box-title" style="color: var(--text-primary); cursor: pointer;">
                    <span>📝</span>
                    <span>Notes from last workout (${new Date(lastWorkoutEntry.date).toLocaleDateString()})</span>
                </summary>
                <div class="info-box-content" style="padding-top: 8px;">
                    ${lastNotes.replace(/\n/g, '<br>')}
                </div>
            </details>
        `;
    }

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
                    <div class="set-label">
                        Set ${i}
                        <span id="pr-alert-${exIdx}-${i}"></span>
                    </div>
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

// QoL #3 (Dynamic Input Clearing) & QoL #4 (Live PR Indicator)
function handleInput(exIdx, setNum, isWeightInput) {
    if (!sessionData[exIdx]) sessionData[exIdx] = {sets: {}, notes: ''};
    
    const weightEl = document.getElementById(`weight-${exIdx}-${setNum}`);
    const repsEl = document.getElementById(`reps-${exIdx}-${setNum}`);
    const prAlertEl = document.getElementById(`pr-alert-${exIdx}-${setNum}`);
    
    const weight = parseFloat(weightEl?.value) || 0;
    const reps = parseInt(repsEl?.value) || 0;
    
    const tonnage = weight * reps;
    const e1rm = calculateE1RM(weight, reps);

    // QoL #4: Live PR Check
    if (prAlertEl) prAlertEl.innerHTML = '';
    if (weight > 0 && reps > 0) {
        const prs = storage.get('personalRecords', {});
        const currentPR = prs[workoutData[currentDay].exercises[exIdx].name];
        
        if (!currentPR || tonnage > currentPR.tonnage) {
            if (prAlertEl) prAlertEl.innerHTML = '<span class="live-pr-indicator">NEW PR! 🏆</span>';
        }

        sessionData[exIdx].sets[setNum] = {weight, reps, tonnage, e1rm, completed: false};
        autoAdvanceFocus(exIdx, setNum, isWeightInput);
        
        // QoL #1: Start Session Duration Timer if this is the first set logged
        const totalLoggedSets = Object.keys(sessionData).flatMap(key => Object.keys(sessionData[key].sets)).length;
        if (totalLoggedSets === 1 && !sessionDurationInterval) {
            startSessionTimer();
        }
    } else {
        // QoL #3: Explicitly delete the set entry if both inputs are cleared
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

function saveWorkout() {
    stopSessionTimer();
    const finalDuration = document.getElementById('session-timer-display').textContent;
    sessionDurationSeconds = 0;
    updateSessionDurationDisplay(); 
    
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
        duration: finalDuration, // Save final duration
        rating: 0,
        tags: []
    };

    const history = storage.get('workoutHistory', []);
    history.push(workoutEntry);
    storage.set('workoutHistory', history);

    updatePRs(exercises);
    showCompletionModal(workoutEntry);
    
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

// QoL #5: Haptic Feedback integrated
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
            if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 400]); 
            timerSeconds = 180; 
            setRestTime(180);
            updateTimerDisplay();
        }
    }, 1000);
}

// QoL #2: Smart Copy Logic refinement - Copy corresponding set + Progressive Overload
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
    
    // QoL #2: Use the exact matching set number for consistency (Set N to Set N)
    const setFound = lastEx.sets[setNum];

    if (setFound && setFound.weight > 0) {
        // Smart Copy Logic: Suggest +2.5 lbs progressive overload
        const smartWeight = setFound.weight + 2.5;
        
        const weightInput = document.getElementById(`weight-${exIdx}-${setNum}`);
        const repsInput = document.getElementById(`reps-${exIdx}-${setNum}`);
        
        if (weightInput && repsInput) {
             weightInput.value = smartWeight.toFixed(1);
             repsInput.value = setFound.reps;
             
             handleInput(exIdx, setNum, true); 

             stopTimer(); 
             setRestTime(180);
             updateTimerDisplay();
        }

    } else {
        alert(`No data found for Set ${setNum} in the last workout. Try copying data from Set 1, or adding a new set manually.`);
    }
}


// QoL #8: Plan Editing Logic
function renderPlanTab() {
    const planContainer = document.getElementById('plan-split-content');
    if (!planContainer) return;

    let html = '';
    const days = Object.keys(workoutData);

    days.forEach(dayKey => {
        const day = workoutData[dayKey];
        
        html += `
            <div class="plan-subsection" data-day="${dayKey}">
                <h4>${day.name}</h4>
        `;
        
        if (day.exercises.length === 0) {
             html += `<div class="rest-day">Rest Day or No Exercises Assigned</div>`;
        } else {
            day.exercises.forEach((ex, exIndex) => {
                const badge = `<span class="badge-${ex.type.toLowerCase()}">${ex.type.toUpperCase()}</span>`;
                html += `
                    <div class="exercise-list-item" data-exercise-index="${exIndex}">
                        <span class="exercise-list-name">${ex.name} ${badge}</span>
                        <span class="exercise-list-sets">${ex.sets} × ${ex.reps}</span>
                        
                        <div class="plan-item-controls hidden">
                            <button onclick="movePlanItem('${dayKey}', ${exIndex}, -1)">⬆️</button>
                            <button onclick="movePlanItem('${dayKey}', ${exIndex}, 1)">⬇️</button>
                            <button class="delete-btn" onclick="deletePlanItem('${dayKey}', ${exIndex})">🗑️</button>
                        </div>
                    </div>
                `;
            });
        }
        html += `</div>`;
    });

    planContainer.innerHTML = html;
}

function togglePlanEditMode() {
    const button = document.querySelector('[onclick="togglePlanEditMode()"]');
    const sections = document.querySelectorAll('.plan-subsection');
    const controls = document.querySelectorAll('.plan-item-controls');
    
    const isEditing = sections[0]?.classList.contains('editing');

    if (isEditing) {
        // Save logic
        button.textContent = '⚙️ Edit/Save Workout Plan';
        workoutData = { ...workoutData }; // Ensure workoutData is non-proxied before saving
        storage.set('customWorkoutData', workoutData);
        alert('Workout Plan Saved!');
    } else {
        // Edit mode activated
        button.textContent = '✅ Save Plan Changes';
        alert('Plan Edit Mode Active. Use up/down arrows to reorder, trash can to delete. Click "Save Plan Changes" when done.');
    }

    sections.forEach(s => s.classList.toggle('editing'));
    controls.forEach(c => c.classList.toggle('hidden'));
}

function deletePlanItem(dayKey, exIndex) {
    if (confirm(`Are you sure you want to delete ${workoutData[dayKey].exercises[exIndex].name}?`)) {
        workoutData[dayKey].exercises.splice(exIndex, 1);
        renderPlanTab(); 
    }
}

function movePlanItem(dayKey, exIndex, direction) {
    const list = workoutData[dayKey].exercises;
    const newIndex = exIndex + direction;

    if (newIndex >= 0 && newIndex < list.length) {
        const item = list[exIndex];
        list.splice(exIndex, 1);
        list.splice(newIndex, 0, item);
        renderPlanTab();
    }
}

// Retain other critical functions
function prevExercise() { 
    if (currentExerciseIndex > 0) {
        currentExerciseIndex--;
        renderExercise();
        updateProgress();
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

function checkAndCelebratePR(exercises) {
    const prs = storage.get('personalRecords', {});
    const newPRs = [];
    
    exercises.forEach(ex => {
        Object.values(ex.sets).forEach(set => {
            const oldPR = prs[ex.name];
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
            modal?.querySelector('.completion-content')?.appendChild(confetti);
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
            <div class="completion-stat">Duration: <strong>${workout.duration}</strong></div>
        `;
    }
    
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
}

document.addEventListener('DOMContentLoaded', init);
