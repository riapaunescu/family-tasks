// Family Tasks App
// Core application logic — Firebase CRUD, UI rendering, week navigation

(function () {
  "use strict";

  // --- Constants ---
  const FAMILY_MEMBERS = ["Adriana", "Mihai", "Andrei"];
  const ADMIN_USER = "Adriana";
  const MEMBER_COLORS = {
    Adriana: "#e91e63",
    Mihai: "#2196f3",
    Andrei: "#4caf50"
  };
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // --- State ---
  let weekOffset = 0;
  let currentListener = null;
  let tasksCache = {};

  // --- Firebase ---
  let db;

  function initApp() {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();

    const savedUser = getCurrentUser();
    const selector = document.getElementById("current-user");
    if (savedUser) {
      selector.value = savedUser;
    }
    updateUIForUser(savedUser);

    selector.addEventListener("change", function () {
      setCurrentUser(this.value);
    });

    document.getElementById("prev-week").addEventListener("click", function () {
      navigateWeek(-1);
    });
    document.getElementById("next-week").addEventListener("click", function () {
      navigateWeek(1);
    });
    document.getElementById("today-btn").addEventListener("click", function () {
      weekOffset = 0;
      refreshWeek();
    });
    document.getElementById("clear-all-btn").addEventListener("click", function () {
      clearAllTasks();
    });

    refreshWeek();
  }

  // --- User Management ---

  function getCurrentUser() {
    return localStorage.getItem("familyTasksUser") || "";
  }

  function setCurrentUser(name) {
    localStorage.setItem("familyTasksUser", name);
    updateUIForUser(name);
    renderWeekView(getCurrentWeekDates(weekOffset), tasksCache);
  }

  function updateUIForUser(name) {
    const clearBtn = document.getElementById("clear-all-btn");
    if (name === ADMIN_USER) {
      clearBtn.style.display = "";
    } else {
      clearBtn.style.display = "none";
    }

    const header = document.querySelector(".app-header");
    if (name && MEMBER_COLORS[name]) {
      header.style.borderBottomColor = MEMBER_COLORS[name];
    } else {
      header.style.borderBottomColor = "#ccc";
    }
  }

  // --- Week Date Calculations ---

  function getCurrentWeekDates(offset) {
    var today = new Date();
    var dayOfWeek = today.getDay();
    // Adjust so Monday = 0
    var mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    var monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + offset * 7);

    var dates = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(formatDate(d));
    }
    return dates;
  }

  function formatDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function formatDateDisplay(dateStr) {
    var parts = dateStr.split("-");
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var dayIndex = d.getDay();
    // Convert Sunday=0 to index 6, Monday=1 to index 0, etc.
    var adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return DAY_NAMES[adjustedIndex] + ", " + monthNames[d.getMonth()] + " " + d.getDate();
  }

  function getWeekLabel(dates) {
    if (weekOffset === 0) return "This Week";
    var startParts = dates[0].split("-");
    var endParts = dates[6].split("-");
    var startD = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    var endD = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthNames[startD.getMonth()] + " " + startD.getDate() +
      " - " + monthNames[endD.getMonth()] + " " + endD.getDate();
  }

  // --- Week Navigation ---

  function navigateWeek(direction) {
    weekOffset += direction;
    refreshWeek();
  }

  function refreshWeek() {
    var dates = getCurrentWeekDates(weekOffset);
    document.getElementById("week-label").textContent = getWeekLabel(dates);
    listenToTasks(dates);
  }

  // --- Firebase Listeners ---

  function listenToTasks(weekDates) {
    if (currentListener) {
      db.ref("tasks").off("value", currentListener);
    }

    var startDate = weekDates[0];
    var endDate = weekDates[6];

    currentListener = db.ref("tasks")
      .orderByChild("day")
      .startAt(startDate)
      .endAt(endDate)
      .on("value", function (snapshot) {
        tasksCache = {};
        if (snapshot.exists()) {
          snapshot.forEach(function (child) {
            tasksCache[child.key] = child.val();
          });
        }
        renderWeekView(weekDates, tasksCache);
      });
  }

  // --- CRUD Operations ---

  function addTask(text, assignedTo, day) {
    if (!text.trim()) return;
    var taskData = {
      text: text.trim(),
      assignedTo: assignedTo,
      day: day,
      completed: false,
      completedBy: null,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    db.ref("tasks").push(taskData);
  }

  function removeTask(taskId) {
    if (getCurrentUser() !== ADMIN_USER) return;
    db.ref("tasks/" + taskId).remove();
  }

  function toggleTaskComplete(taskId, currentlyCompleted) {
    var user = getCurrentUser();
    if (!user) return;
    var updates = {
      completed: !currentlyCompleted,
      completedBy: !currentlyCompleted ? user : null
    };
    db.ref("tasks/" + taskId).update(updates);
  }

  function clearAllTasks() {
    if (getCurrentUser() !== ADMIN_USER) return;
    if (!confirm("Are you sure you want to remove ALL tasks? This cannot be undone.")) return;
    db.ref("tasks").remove();
  }

  // --- Rendering ---

  function renderWeekView(dates, tasks) {
    var grid = document.getElementById("week-grid");
    grid.innerHTML = "";

    var todayStr = formatDate(new Date());

    for (var i = 0; i < dates.length; i++) {
      var date = dates[i];
      var dayTasks = [];
      for (var taskId in tasks) {
        if (tasks[taskId].day === date) {
          dayTasks.push({ id: taskId, data: tasks[taskId] });
        }
      }
      // Sort by createdAt
      dayTasks.sort(function (a, b) {
        return (a.data.createdAt || 0) - (b.data.createdAt || 0);
      });

      var column = renderDay(date, dayTasks, date === todayStr);
      grid.appendChild(column);
    }
  }

  function renderDay(date, dayTasks, isToday) {
    var user = getCurrentUser();
    var isAdmin = user === ADMIN_USER;

    var col = document.createElement("div");
    col.className = "day-column" + (isToday ? " today" : "");

    // Day header
    var header = document.createElement("div");
    header.className = "day-header";
    header.textContent = formatDateDisplay(date);
    col.appendChild(header);

    // Task list
    var taskList = document.createElement("div");
    taskList.className = "task-list";

    for (var i = 0; i < dayTasks.length; i++) {
      var taskEl = renderTask(dayTasks[i].id, dayTasks[i].data, isAdmin);
      taskList.appendChild(taskEl);
    }

    if (dayTasks.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty-day";
      empty.textContent = "No tasks";
      taskList.appendChild(empty);
    }

    col.appendChild(taskList);

    // Add task button (Adriana only)
    if (isAdmin) {
      var addBtn = document.createElement("button");
      addBtn.className = "btn-add-task";
      addBtn.textContent = "+ Add Task";
      addBtn.addEventListener("click", function () {
        showTaskForm(col, date);
      });
      col.appendChild(addBtn);
    }

    return col;
  }

  function renderTask(taskId, task, isAdmin) {
    var card = document.createElement("div");
    card.className = "task-card" + (task.completed ? " completed" : "");

    // Checkbox
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.className = "task-checkbox";
    checkbox.addEventListener("change", function () {
      toggleTaskComplete(taskId, task.completed);
    });
    card.appendChild(checkbox);

    // Task text and assignee
    var content = document.createElement("div");
    content.className = "task-content";

    var textSpan = document.createElement("span");
    textSpan.className = "task-text";
    textSpan.textContent = task.text;
    content.appendChild(textSpan);

    var badge = document.createElement("span");
    badge.className = "assignee-badge";
    badge.textContent = task.assignedTo;
    badge.style.backgroundColor = MEMBER_COLORS[task.assignedTo] || "#999";
    content.appendChild(badge);

    if (task.completed && task.completedBy) {
      var doneBy = document.createElement("span");
      doneBy.className = "done-by";
      doneBy.textContent = "by " + task.completedBy;
      content.appendChild(doneBy);
    }

    card.appendChild(content);

    // Delete button (Adriana only)
    if (isAdmin) {
      var delBtn = document.createElement("button");
      delBtn.className = "btn-delete-task";
      delBtn.textContent = "\u00D7";
      delBtn.title = "Remove task";
      delBtn.addEventListener("click", function () {
        removeTask(taskId);
      });
      card.appendChild(delBtn);
    }

    return card;
  }

  // --- Task Form ---

  function showTaskForm(column, date) {
    // Remove any existing form in this column
    var existing = column.querySelector(".task-form");
    if (existing) {
      existing.remove();
      return;
    }

    var form = document.createElement("div");
    form.className = "task-form";

    var input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Task description...";
    input.className = "task-input";
    form.appendChild(input);

    var select = document.createElement("select");
    select.className = "task-assignee-select";
    for (var i = 0; i < FAMILY_MEMBERS.length; i++) {
      var opt = document.createElement("option");
      opt.value = FAMILY_MEMBERS[i];
      opt.textContent = FAMILY_MEMBERS[i];
      select.appendChild(opt);
    }
    form.appendChild(select);

    var btnRow = document.createElement("div");
    btnRow.className = "form-buttons";

    var saveBtn = document.createElement("button");
    saveBtn.className = "btn-save-task";
    saveBtn.textContent = "Add";
    saveBtn.addEventListener("click", function () {
      addTask(input.value, select.value, date);
      input.value = "";
      input.focus();
    });
    btnRow.appendChild(saveBtn);

    var cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-cancel-task";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", function () {
      form.remove();
    });
    btnRow.appendChild(cancelBtn);

    form.appendChild(btnRow);

    // Insert before the add button
    var addButton = column.querySelector(".btn-add-task");
    column.insertBefore(form, addButton);

    input.focus();

    // Allow Enter key to submit
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        saveBtn.click();
      }
    });
  }

  // --- Init ---
  document.addEventListener("DOMContentLoaded", initApp);
})();
