/* ============================
   Schedule Hub - Application Logic
   ============================ */

// ============================
// State
// ============================
const STATE = {
  currentDate: new Date(),
  weekStart: null,
  weekEnd: null,
  tasks: [],
  view: 'week', // 'week' | 'day'
  selectedDay: null,
  activeFilters: new Set(['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']),
  searchQuery: '',
  isDragging: false,
  draggedTask: null,
  resizeTask: null,
  expandedTaskId: null,
  alarmEnabled: false,
  focusMode: false,
};

// ============================
// Undo/Redo History
// ============================
const HISTORY = {
  stack: [[]],
  index: 0,
  maxSize: 50,
};

function pushHistory() {
  // Remove any redo states beyond the current index
  HISTORY.stack = HISTORY.stack.slice(0, HISTORY.index + 1);
  HISTORY.stack.push(JSON.parse(JSON.stringify(STATE.tasks)));
  if (HISTORY.stack.length > HISTORY.maxSize) {
    HISTORY.stack.shift();
  }
  HISTORY.index = HISTORY.stack.length - 1;
  updateUndoRedoButtons();
}

function undo() {
  if (HISTORY.index > 0) {
    HISTORY.index--;
    STATE.tasks = JSON.parse(JSON.stringify(HISTORY.stack[HISTORY.index]));
    saveTasks();
    render();
    updateUndoRedoButtons();
    showToast('Undo', 'info');
  }
}

function redo() {
  if (HISTORY.index < HISTORY.stack.length - 1) {
    HISTORY.index++;
    STATE.tasks = JSON.parse(JSON.stringify(HISTORY.stack[HISTORY.index]));
    saveTasks();
    render();
    updateUndoRedoButtons();
    showToast('Redo', 'info');
  }
}

function updateUndoRedoButtons() {
  dom.undoBtn.disabled = HISTORY.index <= 0;
  dom.undoBtn.style.opacity = HISTORY.index <= 0 ? '0.4' : '1';
  dom.redoBtn.disabled = HISTORY.index >= HISTORY.stack.length - 1;
  dom.redoBtn.style.opacity = HISTORY.index >= HISTORY.stack.length - 1 ? '0.4' : '1';
}

const CATEGORIES = [
  { color: '#6366f1', name: 'Work' },
  { color: '#10b981', name: 'Personal' },
  { color: '#f59e0b', name: 'Meeting' },
  { color: '#ef4444', name: 'Urgent' },
  { color: '#8b5cf6', name: 'Health' },
  { color: '#ec4899', name: 'Social' },
];

const HOURS = [];
for (let h = 6; h <= 23; h++) {
  HOURS.push(h);
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ============================
// DOM References
// ============================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  gridHeader: $('#gridHeader'),
  gridBody: $('#gridBody'),
  scheduleContainer: $('.schedule-container'),
  weekLabel: $('#weekLabel'),
  prevWeekBtn: $('#prevWeekBtn'),
  nextWeekBtn: $('#nextWeekBtn'),
  todayBtn: $('#todayBtn'),
  addTaskBtn: $('#addTaskBtn'),
  searchInput: $('#searchInput'),
  catFilters: $$('.cat-filter'),
  weekViewBtn: $('#weekViewBtn'),
  dayViewBtn: $('#dayViewBtn'),

  undoBtn: $('#undoBtn'),
  redoBtn: $('#redoBtn'),
  alarmToggleBtn: $('#alarmToggleBtn'),
  focusModeBtn: $('#focusModeBtn'),

  // Modal
  modal: $('#taskModal'),
  modalTitle: $('#modalTitle'),
  modalCloseBtn: $('#modalCloseBtn'),
  modalCancelBtn: $('#modalCancelBtn'),
  modalSaveBtn: $('#modalSaveBtn'),
  taskId: $('#taskId'),
  taskDay: $('#taskDay'),
  taskStartHour: $('#taskStartHour'),
  taskTitle: $('#taskTitle'),
  taskDate: $('#taskDate'),
  taskCategory: $('#taskCategory'),
  taskStartTime: $('#taskStartTime'),
  taskEndTime: $('#taskEndTime'),
  taskNotes: $('#taskNotes'),
  deleteTaskBtn: $('#deleteTaskBtn'),

  toastContainer: $('#toastContainer'),
};

// ============================
// Helpers
// ============================
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatTime(hour) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h} ${ampm}`;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSunday(date) {
  const mon = getMonday(date);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return sun;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function isToday(date) {
  return isSameDay(new Date(), date);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ============================
// Data Persistence
// ============================
function saveTasks() {
  try {
    localStorage.setItem('scheduleHub_tasks', JSON.stringify(STATE.tasks));
  } catch (e) {
    console.error('Failed to save tasks:', e);
  }
}

function loadTasks() {
  try {
    const data = localStorage.getItem('scheduleHub_tasks');
    if (data) {
      STATE.tasks = JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load tasks:', e);
    STATE.tasks = [];
  }
}

function savePreferences() {
  try {
    localStorage.setItem('scheduleHub_alarm', STATE.alarmEnabled);
    localStorage.setItem('scheduleHub_focusMode', STATE.focusMode);
  } catch (e) {
    console.error('Failed to save prefs:', e);
  }
}

function loadPreferences() {
  try {
    const alarm = localStorage.getItem('scheduleHub_alarm');
    if (alarm !== null) STATE.alarmEnabled = alarm === 'true';
    const focus = localStorage.getItem('scheduleHub_focusMode');
    if (focus !== null) STATE.focusMode = focus === 'true';
  } catch (e) {
    console.error('Failed to load prefs:', e);
  }
}

// ============================
// Week Navigation
// ============================
function navigateWeek(direction) {
  const newDate = addDays(STATE.currentDate, direction * 7);
  STATE.currentDate = newDate;
  STATE.weekStart = getMonday(newDate);
  STATE.weekEnd = getSunday(newDate);
  render();
}

function goToToday() {
  STATE.currentDate = new Date();
  STATE.weekStart = getMonday(new Date());
  STATE.weekEnd = getSunday(new Date());
  render();
}

// ============================
// Task CRUD
// ============================
function addTask(task) {
  pushHistory();
  task.id = generateId();
  STATE.tasks.push(task);
  saveTasks();
  render();
  showToast('Task added successfully', 'success');
}

function updateTask(id, updates) {
  pushHistory();
  const idx = STATE.tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  STATE.tasks[idx] = { ...STATE.tasks[idx], ...updates };
  saveTasks();
  render();
  showToast('Task updated', 'info');
}

function deleteTask(id) {
  pushHistory();
  const task = STATE.tasks.find(t => t.id === id);
  STATE.tasks = STATE.tasks.filter(t => t.id !== id);
  saveTasks();
  render();
  if (task) {
    showToast(`Deleted "${task.title}"`, 'error');
  }
}

// ============================
// Filtering & Search
// ============================
function getFilteredTasks() {
  let filtered = STATE.tasks;

  // Filter by active categories
  if (STATE.activeFilters.size > 0) {
    filtered = filtered.filter(t => STATE.activeFilters.has(t.color));
  }

  // Filter by search
  if (STATE.searchQuery.trim()) {
    const q = STATE.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q)
    );
  }

  return filtered;
}

function getTasksForDay(tasks, date) {
  const dateStr = formatDate(date);
  return tasks.filter(t => t.date === dateStr);
}

// ============================
// Rendering
// ============================
function render() {
  renderWeekLabel();
  renderHeader();
  renderBody();
  applyFocusMode();
}

function renderWeekLabel() {
  const start = STATE.weekStart;
  const end = STATE.weekEnd;
  const startMonth = start.toLocaleString('default', { month: 'short' });
  const endMonth = end.toLocaleString('default', { month: 'short' });

  let label;
  if (start.getFullYear() !== end.getFullYear()) {
    label = `${startMonth} ${start.getDate()}, ${start.getFullYear()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
  } else if (start.getMonth() !== end.getMonth()) {
    label = `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
  } else {
    label = `${startMonth} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  dom.weekLabel.textContent = label;
}

function renderHeader() {
  const filteredTasks = getFilteredTasks();
  const cells = [];

  // Corner cell
  cells.push(`<div class="day-cell"></div>`);

  for (let i = 0; i < (STATE.view === 'week' ? 7 : 1); i++) {
    const dayOffset = STATE.view === 'week' ? i : STATE.selectedDay;
    const date = addDays(STATE.weekStart, dayOffset);
    const today = isToday(date);
    const tasksForDay = getTasksForDay(filteredTasks, date);
    const dayNum = date.getDate();
    const dayName = DAY_NAMES[dayOffset];

    cells.push(`
      <div class="day-cell ${today ? 'today' : ''}" data-day="${dayOffset}">
        <span class="day-name">${dayName}</span>
        <span class="day-date">${dayNum}
          ${tasksForDay.length > 0 ? `<span class="day-task-count">${tasksForDay.length}</span>` : ''}
        </span>
      </div>
    `);
  }

  dom.gridHeader.innerHTML = cells.join('');
}

function renderBody() {
  const filteredTasks = getFilteredTasks();
  const totalDays = STATE.view === 'week' ? 7 : 1;
  const startDay = STATE.view === 'week' ? 0 : STATE.selectedDay;

  let html = '';
  const now = new Date();

  for (const hour of HOURS) {
    // Time label
    html += `<div class="time-label">${formatTime(hour)}</div>`;

    for (let d = 0; d < totalDays; d++) {
      const dayOffset = startDay + d;
      const date = addDays(STATE.weekStart, dayOffset);
      const dateStr = formatDate(date);
      const isWeekend = dayOffset >= 5;
      const isCurrentTime = isToday(date) && now.getHours() === hour;

      html += `
        <div class="time-slot ${isWeekend ? 'weekend' : ''} ${isCurrentTime ? 'current-time' : ''}"
             data-day="${dayOffset}" data-hour="${hour}" data-date="${dateStr}">
        </div>
      `;
    }
  }

  dom.gridBody.innerHTML = html;

  // Render tasks on top of the grid
  for (const task of filteredTasks) {
    const taskDate = parseDate(task.date);
    const taskDay = taskDate.getDay();
    const gridDay = taskDay === 0 ? 6 : taskDay - 1;

    const dayStart = STATE.view === 'week' ? 0 : STATE.selectedDay;
    const dayEnd = STATE.view === 'week' ? 6 : STATE.selectedDay;
    if (gridDay < dayStart || gridDay > dayEnd) continue;

    const weekStart = getMonday(STATE.weekStart);
    const weekEnd = getSunday(STATE.weekEnd);
    if (taskDate < weekStart || taskDate > weekEnd) continue;

    const hourStart = task.startHour;
    const hourEnd = task.endHour;
    const duration = hourEnd - hourStart || 1;

    const hourIndex = HOURS.indexOf(hourStart);
    if (hourIndex === -1) continue;

    const height = `${duration * 40}px`;
    const isExpanded = STATE.expandedTaskId === task.id;

    const taskCard = document.createElement('div');
    taskCard.className = `task-card${isExpanded ? ' expanded' : ''}`;
    taskCard.style.cssText = `
      top: 0;
      height: ${isExpanded ? `${Math.max(duration, 1.5) * 40}px` : height};
      background: ${task.color}22;
      --task-color: ${task.color};
      border-left-color: ${task.color};
    `;
    taskCard.dataset.taskId = task.id;

    const timeStr = `${formatTime(task.startHour)} – ${formatTime(task.endHour)}`;
    const catName = CATEGORIES.find(c => c.color === task.color)?.name || 'Task';

    if (isExpanded) {
      taskCard.innerHTML = `
        <div class="task-expanded-content">
          <div class="task-expanded-header">
            <span class="task-title">${escapeHtml(task.title)}</span>
            <span class="task-expanded-badge" style="background:${task.color}33;color:${task.color}">${catName}</span>
          </div>
          <div class="task-expanded-time">${timeStr}</div>
          ${task.notes ? `<div class="task-expanded-notes">📝 ${escapeHtml(task.notes)}</div>` : ''}
          <div class="task-expanded-actions">
            <button class="btn btn-sm btn-secondary task-edit-btn" data-id="${task.id}">✏️ Edit</button>
            <button class="btn btn-sm btn-danger task-delete-btn" data-id="${task.id}">🗑️ Delete</button>
          </div>
        </div>
        <div class="resize-handle"></div>
      `;
    } else {
      taskCard.innerHTML = `
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-time">${timeStr}</div>
        ${task.notes ? '<span class="task-notes-indicator">📝</span>' : ''}
        <div class="resize-handle"></div>
      `;
    }

    // Position in the grid
    const actualDay = gridDay - startDay;
    const targetIndex = hourIndex * totalDays + actualDay;
    const cells = dom.gridBody.querySelectorAll('.time-slot');
    const targetCell = cells[targetIndex];
    if (targetCell) {
      targetCell.style.position = 'relative';
      targetCell.appendChild(taskCard);
    }

    // Click to toggle expansion / edit
    taskCard.addEventListener('click', (e) => {
      if (e.target.closest('.task-expanded-actions') || e.target.closest('.resize-handle')) return;
      if (STATE.isDragging) return;
      e.stopPropagation();

      const btn = e.target.closest('.task-edit-btn, .task-delete-btn');
      if (btn) {
        if (btn.classList.contains('task-edit-btn')) {
          openEditModal(task.id);
        } else {
          if (confirm(`Delete "${task.title}"?`)) {
            deleteTask(task.id);
          }
        }
        return;
      }

      // Toggle expansion
      toggleTaskExpansion(task.id);
    });

    // Resize handle
    const handle = taskCard.querySelector('.resize-handle');
    if (handle) {
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        startResize(e, task.id, taskCard);
      });
    }

    // Drag
    taskCard.addEventListener('mousedown', (e) => {
      if (e.target.closest('.resize-handle') || e.target.closest('.task-expanded-actions')) return;
      const rect = taskCard.getBoundingClientRect();
      const isNearBottom = e.clientY - rect.top > rect.height - 12;
      if (!isNearBottom) {
        startDrag(e, task.id, taskCard);
      }
    });
  }

  // Current time indicator
  renderTimeIndicator();

  // Attach slot click events
  attachSlotEvents();
}

function toggleTaskExpansion(taskId) {
  if (STATE.expandedTaskId === taskId) {
    STATE.expandedTaskId = null;
  } else {
    STATE.expandedTaskId = taskId;
  }
  render();
}

function renderTimeIndicator() {
  const existing = dom.gridBody.querySelector('.current-time-line');
  if (existing) existing.remove();

  const now = new Date();
  const today = isToday(now);
  if (!today) return;

  const currentHour = now.getMinutes() >= 0 ? now.getHours() : now.getHours() - 1;
  if (currentHour < HOURS[0] || currentHour > HOURS[HOURS.length - 1]) return;

  const actualHourIndex = HOURS.indexOf(currentHour);
  if (actualHourIndex === -1) return;

  const minuteFraction = now.getMinutes() / 60;
  const top = (actualHourIndex + minuteFraction) * 40;

  const line = document.createElement('div');
  line.className = 'current-time-line';
  line.style.top = `${top}px`;
  line.style.left = `80px`;
  line.style.right = '0';
  line.style.position = 'absolute';

  dom.gridBody.appendChild(line);
}

function attachSlotEvents() {
  const slots = dom.gridBody.querySelectorAll('.time-slot');
  slots.forEach(slot => {
    slot.addEventListener('click', () => {
      const day = parseInt(slot.dataset.day);
      const hour = parseInt(slot.dataset.hour);
      openAddModal(day, hour);
    });
  });
}

// ============================
// Focus Mode
// ============================
function applyFocusMode() {
  dom.scheduleContainer.classList.toggle('focus-mode', STATE.focusMode);
  dom.focusModeBtn.classList.toggle('active', STATE.focusMode);
}

function toggleFocusMode() {
  STATE.focusMode = !STATE.focusMode;
  savePreferences();
  applyFocusMode();
  showToast(STATE.focusMode ? 'Focus mode on 🎯' : 'Focus mode off', 'info');
}

// ============================
// Alarm System
// ============================
let alarmInterval = null;
let lastNotifiedTasks = new Set();

function toggleAlarm() {
  STATE.alarmEnabled = !STATE.alarmEnabled;
  savePreferences();
  dom.alarmToggleBtn.classList.toggle('active', STATE.alarmEnabled);

  if (STATE.alarmEnabled) {
    startAlarmChecker();
    showToast('Alarm enabled 🔔', 'success');
  } else {
    stopAlarmChecker();
    showToast('Alarm disabled', 'info');
  }
}

function startAlarmChecker() {
  stopAlarmChecker();
  alarmInterval = setInterval(checkAlarm, 15000);
  checkAlarm();
}

function stopAlarmChecker() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

function checkAlarm() {
  if (!STATE.alarmEnabled) return;
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const today = formatDate(now);

  for (const task of STATE.tasks) {
    if (task.date === today && task.startHour === currentHour && currentMinute < 3) {
      if (!lastNotifiedTasks.has(task.id)) {
        lastNotifiedTasks.add(task.id);
        playAlarmBeep();
        showToast(`🔔 Time for: ${task.title}`, 'success');
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Schedule Hub Alarm', { body: `Time for: ${task.title}` });
        }
      }
    }
  }

  // Clean up old task IDs (after the 3-min window passes)
  if (currentMinute >= 5) {
    lastNotifiedTasks.clear();
  }
}

function playAlarmBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(660, audioCtx.currentTime + 0.15);
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.6);

    // Second beep
    setTimeout(() => {
      const ctx2 = new (window.AudioContext || window.webkitAudioContext)();
      const osc2 = ctx2.createOscillator();
      const gain2 = ctx2.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx2.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx2.currentTime);
      gain2.gain.setValueAtTime(0.4, ctx2.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.4);
      osc2.start(ctx2.currentTime);
      osc2.stop(ctx2.currentTime + 0.4);
    }, 300);
  } catch (e) {
    console.error('Alarm audio failed:', e);
  }
}

// ============================
// Drag & Drop (Re-schedule across days & hours)
// ============================
function startDrag(e, taskId, card) {
  STATE.isDragging = true;
  const gridRect = dom.gridBody.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();

  STATE.draggedTask = {
    id: taskId,
    card,
    offsetX: e.clientX - cardRect.left,
    offsetY: e.clientY - cardRect.top,
    gridBodyRect: gridRect,
    startTask: STATE.tasks.find(t => t.id === taskId),
  };

  // Bring card to root of grid body for free movement
  const currentCell = card.parentElement;
  if (currentCell && currentCell.classList.contains('time-slot')) {
    dom.gridBody.appendChild(card);
    card.style.position = 'absolute';
    card.style.left = `${cardRect.left - gridRect.left}px`;
    card.style.top = `${cardRect.top - gridRect.top}px`;
    card.style.width = `${cardRect.width}px`;
    card.style.zIndex = '50';
  }

  card.classList.add('dragging');

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e) {
  if (!STATE.draggedTask) return;
  const { card, offsetX, offsetY, gridBodyRect } = STATE.draggedTask;

  const x = e.clientX - gridBodyRect.left - offsetX;
  const y = e.clientY - gridBodyRect.top - offsetY;

  card.style.left = `${Math.max(0, x)}px`;
  card.style.top = `${Math.max(0, y)}px`;

  // Highlight target day column
  const relativeX = e.clientX - gridBodyRect.left - 80;
  const totalDays = STATE.view === 'week' ? 7 : 1;
  const dayWidth = Math.max(1, (gridBodyRect.width - 80) / totalDays);
  const dayOffset = Math.floor(relativeX / dayWidth);
  const clampedDayOffset = Math.max(0, Math.min(dayOffset, totalDays - 1));

  // Remove previous highlights
  dom.gridBody.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));
  dom.gridHeader.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));

  // Highlight current day column
  const headerCells = dom.gridHeader.querySelectorAll('.day-cell');
  const targetHeader = headerCells[clampedDayOffset + 1];
  if (targetHeader) targetHeader.classList.add('drag-highlight');

  const slots = dom.gridBody.querySelectorAll('.time-slot');
  for (let s = clampedDayOffset; s < slots.length; s += totalDays) {
    slots[s].classList.add('drag-highlight');
  }
}

function onDragEnd(e) {
  if (!STATE.draggedTask) return;
  const { id, card, startTask } = STATE.draggedTask;

  // Remove highlights
  dom.gridBody.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));
  dom.gridHeader.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));

  card.classList.remove('dragging');
  card.style.position = '';
  card.style.left = '';
  card.style.top = '';
  card.style.width = '';
  card.style.zIndex = '';
  STATE.expandedTaskId = null;

  // Calculate new position
  const gridRect = dom.gridBody.getBoundingClientRect();
  const relativeX = e.clientX - gridRect.left - 80;
  const relativeY = e.clientY - gridRect.top;

  const totalDays = STATE.view === 'week' ? 7 : 1;
  const dayWidth = Math.max(1, (gridRect.width - 80) / totalDays);
  const dayOffset = Math.floor(relativeX / dayWidth);
  const clampedDayOffset = Math.max(0, Math.min(dayOffset, totalDays - 1));

  const hourIndex = Math.round(relativeY / 40);
  const clampedHourIndex = Math.max(0, Math.min(hourIndex, HOURS.length - 1));
  const newStartHour = HOURS[clampedHourIndex];

  const startDay = STATE.view === 'week' ? 0 : STATE.selectedDay;
  const newDayOffset = startDay + clampedDayOffset;
  const newDate = addDays(STATE.weekStart, newDayOffset);

  const task = STATE.tasks.find(t => t.id === id);
  if (task) {
    const duration = Math.max(task.endHour - task.startHour, 1);
    const newEndHour = Math.min(newStartHour + duration, 24);

    const isDifferentDay = !isSameDay(parseDate(task.date), newDate);
    const isDifferentHour = task.startHour !== newStartHour;

    if (isDifferentDay || isDifferentHour) {
      updateTask(id, {
        date: formatDate(newDate),
        startHour: newStartHour,
        endHour: newEndHour,
      });
    }
  }

  STATE.isDragging = false;
  STATE.draggedTask = null;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

// ============================
// Resize Task
// ============================
function startResize(e, taskId, card) {
  STATE.resizeTask = { id: taskId, card, startY: e.clientY, startHeight: card.offsetHeight };
  e.preventDefault();

  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
}

function onResizeMove(e) {
  if (!STATE.resizeTask) return;
  const { card, startY, startHeight } = STATE.resizeTask;
  const diff = e.clientY - startY;
  const newHeight = Math.max(40, startHeight + diff);
  const snappedHeight = Math.round(newHeight / 40) * 40;
  card.style.height = `${snappedHeight}px`;
}

function onResizeEnd(e) {
  if (!STATE.resizeTask) return;
  const { id, card } = STATE.resizeTask;
  const newHeight = parseInt(card.style.height);
  const duration = Math.round(newHeight / 40);

  const task = STATE.tasks.find(t => t.id === id);
  if (task) {
    const newEndHour = Math.min(task.startHour + duration, 24);
    updateTask(id, { endHour: newEndHour });
  }

  STATE.resizeTask = null;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
}

// ============================
// Modal Logic
// ============================
function openAddModal(dayOffset, hour) {
  dom.modalTitle.textContent = 'New Task';
  dom.taskId.value = '';
  dom.deleteTaskBtn.style.display = 'none';

  const date = addDays(STATE.weekStart, dayOffset || 0);
  dom.taskDate.value = formatDate(date);
  dom.taskDay.value = dayOffset || 0;
  dom.taskStartHour.value = hour || 9;

  const startH = hour || 9;
  dom.taskStartTime.value = `${String(startH).padStart(2, '0')}:00`;
  dom.taskEndTime.value = `${String(startH + 1).padStart(2, '0')}:00`;

  dom.taskTitle.value = '';
  dom.taskCategory.value = '#6366f1';
  dom.taskNotes.value = '';

  STATE.expandedTaskId = null;
  dom.modal.classList.add('open');
  setTimeout(() => dom.taskTitle.focus(), 100);
}

function openEditModal(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  dom.modalTitle.textContent = 'Edit Task';
  dom.taskId.value = task.id;
  dom.taskDate.value = task.date;
  dom.taskCategory.value = task.color;
  dom.taskTitle.value = task.title;

  const startH = String(task.startHour).padStart(2, '0');
  const endH = String(task.endHour).padStart(2, '0');
  dom.taskStartTime.value = `${startH}:00`;
  dom.taskEndTime.value = `${endH}:00`;
  dom.taskNotes.value = task.notes || '';
  dom.taskDay.value = task.day;
  dom.taskStartHour.value = task.startHour;

  dom.deleteTaskBtn.style.display = 'inline-flex';
  dom.deleteTaskBtn.onclick = () => {
    if (confirm(`Delete "${task.title}"?`)) {
      deleteTask(task.id);
      closeModal();
    }
  };

  STATE.expandedTaskId = null;
  dom.modal.classList.add('open');
  setTimeout(() => dom.taskTitle.focus(), 100);
}

function closeModal() {
  dom.modal.classList.remove('open');
}

function saveModal() {
  const title = dom.taskTitle.value.trim();
  if (!title) {
    showToast('Please enter a task title', 'error');
    dom.taskTitle.focus();
    return;
  }

  const date = dom.taskDate.value;
  const color = dom.taskCategory.value;
  const startTime = dom.taskStartTime.value;
  const endTime = dom.taskEndTime.value;
  const notes = dom.taskNotes.value.trim();

  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]) || startHour + 1;

  if (endHour <= startHour) {
    showToast('End time must be after start time', 'error');
    return;
  }

  const existingId = dom.taskId.value;

  const taskData = {
    title,
    date,
    day: new Date(date).getDay(),
    startHour,
    endHour,
    color,
    notes,
  };

  if (existingId) {
    updateTask(existingId, taskData);
  } else {
    addTask(taskData);
  }

  closeModal();
}

// ============================
// Toast Notifications
// ============================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================
// Helpers
// ============================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================
// Event Binding
// ============================
function bindEvents() {
  // Week navigation
  dom.prevWeekBtn.addEventListener('click', () => navigateWeek(-1));
  dom.nextWeekBtn.addEventListener('click', () => navigateWeek(1));
  dom.todayBtn.addEventListener('click', goToToday);

  // Add task button
  dom.addTaskBtn.addEventListener('click', () => {
    const now = new Date();
    const dayOffset = now.getDay() === 0 ? 6 : now.getDay() - 1;
    openAddModal(dayOffset, now.getHours());
  });

  // Search
  dom.searchInput.addEventListener('input', (e) => {
    STATE.searchQuery = e.target.value;
    render();
  });

  // Category filters
  dom.catFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      btn.classList.toggle('active');
      if (btn.classList.contains('active')) {
        STATE.activeFilters.add(color);
      } else {
        STATE.activeFilters.delete(color);
      }
      render();
    });
  });

  // View toggle
  dom.weekViewBtn.addEventListener('click', () => {
    STATE.view = 'week';
    STATE.expandedTaskId = null;
    dom.weekViewBtn.classList.add('active');
    dom.dayViewBtn.classList.remove('active');
    render();
  });

  dom.dayViewBtn.addEventListener('click', () => {
    STATE.view = 'day';
    STATE.expandedTaskId = null;
    const today = new Date();
    STATE.selectedDay = today.getDay() === 0 ? 6 : today.getDay() - 1;
    dom.dayViewBtn.classList.add('active');
    dom.weekViewBtn.classList.remove('active');
    render();
  });

  // Undo / Redo
  dom.undoBtn.addEventListener('click', undo);
  dom.redoBtn.addEventListener('click', redo);

  // Alarm toggle
  dom.alarmToggleBtn.addEventListener('click', toggleAlarm);
  dom.alarmToggleBtn.classList.toggle('active', STATE.alarmEnabled);

  // Focus mode toggle
  dom.focusModeBtn.addEventListener('click', toggleFocusMode);
  dom.focusModeBtn.classList.toggle('active', STATE.focusMode);

  // Modal events
  dom.modalCloseBtn.addEventListener('click', closeModal);
  dom.modalCancelBtn.addEventListener('click', closeModal);
  dom.modalSaveBtn.addEventListener('click', saveModal);

  // Close modal on overlay click
  dom.modal.addEventListener('click', (e) => {
    if (e.target === dom.modal) closeModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      STATE.expandedTaskId = null;
      closeModal();
    }

    // Ctrl+Z: Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    // Ctrl+Shift+Z or Ctrl+Y: Redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    }

    // Enter in modal
    if (e.key === 'Enter' && dom.modal.classList.contains('open')) {
      if (e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        saveModal();
      }
    }
  });

  // Window resize - re-render time indicator
  window.addEventListener('resize', () => {
    renderTimeIndicator();
  });
}

// ============================
// Keyboard Shortcuts (Global)
// ============================
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    dom.searchInput.focus();
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 't' &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
    goToToday();
  }
  // f: toggle focus mode
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'f' &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
    e.preventDefault();
    toggleFocusMode();
  }
  // a: toggle alarm
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'a' &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
    e.preventDefault();
    toggleAlarm();
  }
});

// ============================
// Initialize
// ============================
function init() {
  loadPreferences();
  loadTasks();

  // Initialize history with current tasks
  HISTORY.stack = [JSON.parse(JSON.stringify(STATE.tasks))];
  HISTORY.index = 0;

  STATE.weekStart = getMonday(new Date());
  STATE.weekEnd = getSunday(new Date());

  bindEvents();
  render();
  updateUndoRedoButtons();

  if (STATE.alarmEnabled) {
    startAlarmChecker();
  }

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  showToast('Welcome to Schedule Hub! 🚀', 'info');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
