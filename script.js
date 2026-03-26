(() => {
  // ---------------------------------------------------------------------------
  // App setup and shared helpers
  // ---------------------------------------------------------------------------
  // Save all app data under one key.
  const KEY = "focuspulse-state-v6";
  const TIMER = 50 * 60;

  // ---------------------------------------------------------------------------
  // 1. Badges
  // Defines each badge, how progress is measured, and which badge art to show.
  // ---------------------------------------------------------------------------
  const BADGES = [
    {
      key: "planner",
      name: "Planner Pro",
      detail: "Add 3 tasks to your list.",
      tone: "sky",
      image: "images/badges/planner-pro.svg",
      goal: 3,
      value: (currentData) => currentData.stats.created,
    },
    {
      key: "tamer",
      name: "Task Tamer",
      detail: "Complete 3 tasks.",
      tone: "lime",
      image: "images/badges/task-tamer.svg",
      goal: 3,
      value: (currentData) => currentData.stats.completed,
    },
    {
      key: "deep",
      name: "Deep Work",
      detail: "Finish 1 full focus session.",
      tone: "gold",
      image: "images/badges/deep-work.svg",
      goal: 1,
      value: (currentData) => currentData.stats.sessions,
    },
    {
      key: "balanced",
      name: "Break Balanced",
      detail: "Finish 3 full focus sessions.",
      tone: "mint",
      image: "images/badges/break-balanced.svg",
      goal: 3,
      value: (currentData) => currentData.stats.sessions,
    },
    {
      key: "streak",
      name: "Streak Starter",
      detail: "Reach a 7 day streak.",
      tone: "flame",
      image: "images/badges/streak-starter.svg",
      goal: 7,
      value: (currentData) => currentData.streak.best,
    },
    {
      key: "momentum",
      name: "Momentum Queen",
      detail: "Complete 10 tasks or sessions.",
      tone: "rose",
      image: "images/badges/momentum-queen.svg",
      goal: 10,
      value: (currentData) =>
        currentData.stats.completed + currentData.stats.sessions,
    },
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const text = (s, v) =>
    $$(s).forEach((n) => {
      n.textContent = v;
    });
  const esc = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const uid = () => Math.random().toString(36).slice(2, 10);
  const email = (v) => String(v).trim().toLowerCase();
  const first = (v) => String(v).trim().split(/\s+/)[0] || "Student";
  const dayKey = (offset = 0) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const parseDay = (v) => {
    const p = String(v).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  };
  const dayDiff = (from, to) =>
    Math.round((parseDay(to) - parseDay(from)) / 86400000);
  const formatClock = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const effort = (v) => v.charAt(0).toUpperCase() + v.slice(1);

  // This is the starter data for a guest or new account.
  const emptyData = () => ({
    note: "Ready to start your next sprint.",
    streak: { count: 0, best: 0, last: "", days: [] },
    stats: { created: 0, completed: 0, sessions: 0 },
    tasks: [],
    timer: { taskId: "", left: TIMER, running: false },
    badges: [],
  });

  let state = loadState();
  let timerId = 0;

  init();

  // ---------------------------------------------------------------------------
  // Storage and shared state
  // ---------------------------------------------------------------------------
  function init() {
    prepare();
    bindTheme();
    bindDashboard();
    bindAuth();
    render();
    window.addEventListener("storage", () => {
      stopTimer();
      state = loadState();
      prepare();
      render();
    });
  }

  function loadState() {
    const raw = read();
    const next = {
      theme: "light",
      auth: { mode: "signin", current: "", remembered: "", users: [] },
      guest: emptyData(),
    };

    if (!raw || typeof raw !== "object") {
      write(next);
      return next;
    }

    next.theme = raw.theme === "dark" ? "dark" : "light";
    next.guest = normalizeData(raw.guest || raw);

    if (raw.auth && typeof raw.auth === "object") {
      next.auth.mode = raw.auth.mode === "signup" ? "signup" : "signin";
      next.auth.current =
        typeof raw.auth.current === "string" ? raw.auth.current : "";
      next.auth.remembered =
        typeof raw.auth.remembered === "string" ? raw.auth.remembered : "";
      next.auth.users = Array.isArray(raw.auth.users)
        ? raw.auth.users.map(normalizeUser).filter(Boolean)
        : [];

      if (!next.auth.users.some((u) => u.id === next.auth.current))
        next.auth.current = "";
    }

    return next;
  }

  function normalizeUser(raw) {
    const userEmail = email(raw && raw.email ? raw.email : "");
    const fullName = String(
      (raw && (raw.name || `${raw.first || ""} ${raw.last || ""}`)) || "",
    ).trim();

    return userEmail
      ? {
          id: raw && raw.id ? raw.id : uid(),
          name: fullName || "Student",
          email: userEmail,
          password: String(raw && raw.password ? raw.password : ""),
          data: normalizeData(raw && raw.data ? raw.data : {}),
        }
      : null;
  }

  function normalizeData(raw = {}) {
    // Clean old or mixed saved data before the app uses it.
    const tasks = Array.isArray(raw.tasks)
      ? raw.tasks
          .filter((t) => t && t.title)
          .map((t) => ({
            id: t.id || uid(),
            title: String(t.title),
            due: typeof t.due === "string" ? t.due : "",
            effort:
              t.effort === "high" || t.effort === "low" ? t.effort : "medium",
            createdAt: Number(t.createdAt) || Date.now(),
          }))
      : [];
    const streak = raw.streak || {};
    const stats = raw.stats || {};
    const timer = raw.timer || raw.session || {};

    return {
      note:
        typeof raw.note === "string" && raw.note
          ? raw.note
          : "Ready to start your next sprint.",
      streak: {
        count: Number(streak.count) || 0,
        best: Number(streak.best) || 0,
        last:
          typeof streak.last === "string"
            ? streak.last
            : typeof streak.lastDate === "string"
              ? streak.lastDate
              : "",
        days: (Array.isArray(streak.days)
          ? streak.days
          : Array.isArray(streak.dates)
            ? streak.dates
            : []
        ).slice(-7),
      },
      stats: {
        created: Number.isFinite(Number(stats.created))
          ? Number(stats.created)
          : tasks.length + (Number(stats.completed) || 0),
        completed: Number(stats.completed) || 0,
        sessions: Number(stats.sessions) || 0,
      },
      tasks,
      timer: {
        taskId: typeof timer.taskId === "string" ? timer.taskId : "",
        left: Number(timer.left) > 0 ? Number(timer.left) : TIMER,
        running: false,
      },
      badges: Array.isArray(raw.badges)
        ? [
            ...new Set(
              raw.badges.filter((key) =>
                BADGES.some((badge) => badge.key === key),
              ),
            ),
          ]
        : [],
    };
  }

  function read() {
    try {
      return JSON.parse(window.localStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  }

  function write(next = state) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }

  function save() {
    write(state);
  }

  function currentUser() {
    return state.auth.users.find((u) => u.id === state.auth.current) || null;
  }

  function data() {
    return (currentUser() || { data: state.guest }).data;
  }

  function prepare() {
    // Reset the streak if the user skipped too many days.
    const currentData = data();
    if (
      currentData.streak.last &&
      dayDiff(currentData.streak.last, dayKey()) > 1 &&
      currentData.streak.count
    ) {
      currentData.streak.count = 0;
      currentData.note =
        "Your streak reset after a break. Start again with one small step today.";
    }

    syncTask();
    syncBadges();
    save();
  }

  function updateAndRender() {
    prepare();
    render();
  }

  // ---------------------------------------------------------------------------
  // 1. Badges
  // Unlocks badges, calculates badge progress, and renders achievements UI.
  // ---------------------------------------------------------------------------
  function syncBadges() {
    // Unlock any badge whose goal has been reached.
    const currentData = data();
    currentData.badges = [
      ...new Set([
        ...currentData.badges,
        ...BADGES.filter((badge) => badge.value(currentData) >= badge.goal).map(
          (badge) => badge.key,
        ),
      ]),
    ];
  }

  function badgeProgress(badge) {
    const value = badge.value(data());
    return {
      progress: Math.min(Math.round((value / badge.goal) * 100), 100),
      remaining: Math.max(badge.goal - value, 0),
    };
  }

  function nextBadge() {
    return (
      BADGES.filter((badge) => !data().badges.includes(badge.key))
        .map((badge) => ({ badge, progress: badgeProgress(badge) }))
        .sort((a, b) => a.progress.remaining - b.progress.remaining)[0] || null
    );
  }

  function renderAchievements() {
    const upcoming = nextBadge();
    text("[data-badgehero]", data().badges.length);
    text(
      "[data-badgehint]",
      upcoming
        ? `${upcoming.progress.remaining} step${upcoming.progress.remaining === 1 ? "" : "s"} left for ${upcoming.badge.name}.`
        : "Every badge is unlocked.",
    );
    text("[data-streakvalue]", `${data().streak.count} days`);
    text("[data-streakhint]", `Best streak: ${data().streak.best} days`);
    renderBadgeCards("badges");
    renderBadgeGoals();
  }

  function renderBadgeCards(id, limit) {
    const items = typeof limit === "number" ? BADGES.slice(0, limit) : BADGES;
    $(`#${id}`).innerHTML = items
      .map((badge) => {
        const progress = badgeProgress(badge),
          unlocked = data().badges.includes(badge.key);
        return `<article class="badge-card ${unlocked ? "unlocked" : "locked"}"><span class="badge-mark ${badge.tone}" aria-hidden="true"><img src="${badge.image}" alt=""></span><strong>${esc(badge.name)}</strong><p>${esc(badge.detail)}</p><span class="badge-state">${esc(unlocked ? "Unlocked" : `${progress.remaining} left`)}</span></article>`;
      })
      .join("");
  }

  function renderBadgeGoals() {
    const locked = BADGES.filter((badge) => !data().badges.includes(badge.key))
      .map((badge) => ({ badge, progress: badgeProgress(badge) }))
      .sort((a, b) => a.progress.remaining - b.progress.remaining);

    $("#badgegoals").innerHTML = locked.length
      ? locked
          .slice(0, 3)
          .map(
            (item) =>
              `<article class="spotlight-card"><strong>${esc(item.badge.name)}</strong><p>${esc(item.badge.detail)}</p><div class="progress-bar bar-light"><span style="width: ${item.progress.progress}%;"></span></div></article>`,
          )
          .join("")
      : `<article class="spotlight-card"><strong>All badges unlocked</strong><p>Your achievement cabinet is fully complete.</p><div class="progress-bar bar-light"><span style="width: 100%;"></span></div></article>`;
  }

  // ---------------------------------------------------------------------------
  // 2. Streaks
  // Tracks daily study activity and renders the 7-day streak strip.
  // ---------------------------------------------------------------------------
  function markStudyDay() {
    // More work on the same day should not add extra streak days.
    const currentData = data(),
      today = dayKey();

    if (currentData.streak.last === today) {
      currentData.streak.days = [
        ...new Set([...(currentData.streak.days || []), today]),
      ].slice(-7);
      return;
    }

    currentData.streak.count =
      currentData.streak.last && dayDiff(currentData.streak.last, today) === 1
        ? currentData.streak.count + 1
        : 1;
    currentData.streak.best = Math.max(
      currentData.streak.best,
      currentData.streak.count,
    );
    currentData.streak.last = today;
    currentData.streak.days = [
      ...new Set([...(currentData.streak.days || []), today]),
    ].slice(-7);
  }

  function renderWeek() {
    $("#week").innerHTML = Array.from({ length: 7 }, (_, index) => {
      const offset = index - 6,
        date = new Date(),
        key = dayKey(offset);
      date.setDate(date.getDate() + offset);
      return `<span class="day-box${data().streak.days.includes(key) ? " active" : ""}">${date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)}</span>`;
    }).join("");
    text("#best", `Best: ${data().streak.best} days`);
    text("#streak", data().streak.count);
  }

  // ---------------------------------------------------------------------------
  // 3. Login and creating account
  // Handles sign in, sign up, sign out, and the auth page state.
  // ---------------------------------------------------------------------------
  function bindAuth() {
    if (!document.body.classList.contains("auth")) return;

    $$("[data-auth-mode]").forEach((button) =>
      button.addEventListener("click", () => {
        state.auth.mode =
          button.dataset.authMode === "signup" ? "signup" : "signin";
        save();
        render();
      }),
    );

    $("#authform")?.addEventListener("submit", (event) => {
      event.preventDefault();
      state.auth.mode === "signup" ? createAccount() : signIn();
    });

    $("#logout")?.addEventListener("click", signOut);
  }

  function createAccount() {
    const name = $("#authname")?.value.trim() || "";
    const userEmail = email($("#authemail")?.value || "");
    const password = $("#authpassword")?.value.trim() || "";

    if (!name || !userEmail || !password)
      return setAuthMessage(
        "Fill in your name, email, and password first.",
        "error",
      );

    if (state.auth.users.some((entry) => entry.email === userEmail))
      return setAuthMessage(
        "That email already has an account. Switch to sign in.",
        "error",
      );

    state.auth.users.push({
      id: uid(),
      name,
      email: userEmail,
      password,
      data: clone(data()),
    });
    state.auth.current = state.auth.users[state.auth.users.length - 1].id;
    state.auth.remembered = userEmail;
    data().note = `Welcome, ${first(name)}. Your account is ready.`;
    updateAndRender();
    setAuthMessage(
      `Account created for ${name}. Taking you to the dashboard.`,
      "success",
    );
    goHome();
  }

  function signIn() {
    const userEmail = email($("#authemail")?.value || "");
    const password = $("#authpassword")?.value.trim() || "";
    const current = state.auth.users.find(
      (entry) => entry.email === userEmail && entry.password === password,
    );

    if (!userEmail || !password)
      return setAuthMessage("Enter your email and password first.", "error");

    if (!current)
      return setAuthMessage(
        "No account matches that email and password.",
        "error",
      );

    stopTimer();
    state.auth.current = current.id;
    state.auth.remembered = userEmail;
    prepare();
    data().note = `Welcome back, ${first(current.name)}.`;
    save();
    render();
    setAuthMessage(
      `Signed in as ${current.name}. Taking you to the dashboard.`,
      "success",
    );
    goHome();
  }

  function signOut() {
    stopTimer();
    state.auth.current = "";
    prepare();
    data().note = "You are signed out. Guest mode is active.";
    save();
    render();
    setAuthMessage("You have been signed out on this device.", "success");
  }

  function goHome() {
    window.setTimeout(() => {
      window.location.href = "index.html";
    }, 350);
  }

  function renderAuth() {
    const signup = state.auth.mode === "signup",
      current = currentUser();
    $("#authnamefield").hidden = !signup;
    $("#authname").required = signup;
    $("#authformtitle").textContent = signup ? "Create account" : "Sign in";
    $("#authpill").textContent = signup ? "New student" : "Returning student";
    $("#authhelper").textContent = signup
      ? "Already have an account? Switch to sign in."
      : "New here? Switch to create account.";
    $("#authsubmit").textContent = signup ? "Create Account" : "Sign In";
    $("#logout").hidden = !current;

    if ($("#authemail") && state.auth.remembered && !$("#authemail").value)
      $("#authemail").value = state.auth.remembered;

    $$("[data-auth-mode]").forEach((button) => {
      const active = button.dataset.authMode === state.auth.mode;
      button.classList.toggle("button-main", active);
      button.classList.toggle("button-ghost", !active);
      button.setAttribute("aria-pressed", String(active));
    });

    setAuthMessage(
      current
        ? `Signed in as ${current.name}. Your progress is saved on this device.`
        : signup
          ? "Create an account to save your tasks, streak, timer, and achievements."
          : "Sign in to continue with your saved tasks, streak, timer, and achievements.",
      current ? "success" : "",
    );
  }

  function setAuthMessage(message, tone) {
    const box = $("#authmsg");
    if (!box) return;
    box.textContent = message;
    box.classList.remove("success", "error");
    if (tone) box.classList.add(tone);
  }

  // ---------------------------------------------------------------------------
  // 4. Timer
  // Runs the focus countdown for the currently selected task.
  // ---------------------------------------------------------------------------
  function selectedTask() {
    syncTask();
    return data().tasks.find((task) => task.id === data().timer.taskId) || null;
  }

  function startTimer() {
    stopTimer();
    data().timer.running = true;
    data().note = "Timer running. Stay on one task until the session ends.";
    save();
    render();
    timerId = window.setInterval(() => {
      if (data().timer.left > 0) {
        data().timer.left -= 1;
        renderTimer();
      }

      if (data().timer.left === 0) {
        stopTimer();
        data().timer.running = false;
        data().timer.left = TIMER;
        data().stats.sessions += 1;
        data().note =
          "Session complete. Take a short break before the next one.";
        markStudyDay();
        updateAndRender();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = 0;
    }
  }

  function pauseTimer() {
    stopTimer();
    data().timer.running = false;
    data().note = "Timer paused.";
    save();
    render();
  }

  function resetTimer() {
    stopTimer();
    data().timer.running = false;
    data().timer.left = TIMER;
    data().note = "Timer reset and ready to start again.";
    save();
    render();
  }

  function renderTimer() {
    const task = selectedTask();
    const progress = Math.round((data().timer.left / TIMER) * 100);
    text("#clock", formatClock(data().timer.left));
    text("#topic", task ? task.title : "Choose a task to begin");
    text("#state", data().note);
    text("#sessioncount", data().stats.sessions);
    text("#taskcount", data().tasks.length);
    text("#autopriority", "On");
    text(
      "#start",
      data().timer.running
        ? "Pause"
        : data().timer.left < TIMER
          ? "Resume"
          : "Start",
    );

    if ($(".timer-shell"))
      $(".timer-shell").style.background =
        `conic-gradient(var(--ghost) 0 ${progress}%, rgba(247, 247, 255, 0.14) ${progress}% 100%)`;
  }

  // ---------------------------------------------------------------------------
  // 5. Task manager
  // Creates, sorts, completes, removes, and displays study tasks.
  // ---------------------------------------------------------------------------
  function syncTask() {
    // Keep the timer linked to a real task in the list.
    const tasks = sortedTasks();
    data().timer.taskId = tasks.some((task) => task.id === data().timer.taskId)
      ? data().timer.taskId
      : tasks[0]?.id || "";
  }

  function sortedTasks() {
    return [...data().tasks].sort((a, b) => taskScore(b) - taskScore(a));
  }

  function taskScore(task) {
    // Higher score means the task should appear earlier.
    const gap = task.due ? dayDiff(dayKey(), task.due) : 7;
    return (
      (gap < 0 ? 90 + Math.abs(gap) * 10 : Math.max(0, 60 - gap * 12)) +
      (task.effort === "high" ? 30 : task.effort === "medium" ? 18 : 10)
    );
  }

  function dueText(task) {
    if (!task.due) return "No deadline set";
    const gap = dayDiff(dayKey(), task.due);
    if (gap < 0)
      return `${Math.abs(gap)} day${Math.abs(gap) === 1 ? "" : "s"} overdue`;
    if (gap === 0) return "Due today";
    if (gap === 1) return "Due tomorrow";
    return `Due in ${gap} days`;
  }

  function dueShort(task) {
    if (!task.due) return "Open";
    const gap = dayDiff(dayKey(), task.due);
    if (gap < 0) return "Late";
    if (gap === 0) return "Today";
    if (gap === 1) return "Next";
    return `${gap}d`;
  }

  function priorityBadge(task, index) {
    const gap = task.due ? dayDiff(dayKey(), task.due) : 7;
    if (index === 0) return { text: "Best Next Task", tone: "badge-high" };
    return gap <= 0 || task.effort === "high"
      ? { text: "High Priority", tone: "badge-high" }
      : { text: "In Queue", tone: "badge-calm" };
  }

  function bindDashboard() {
    if (!document.body.classList.contains("dashboard")) return;

    // Task creation form.
    $("#entry")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const task = $("#task"),
        due = $("#due"),
        effortBox = $("#effort");
      if (!task || !task.value.trim()) return;
      data().tasks.push({
        id: uid(),
        title: task.value.trim(),
        due: due?.value || "",
        effort: effortBox?.value || "medium",
        createdAt: Date.now(),
      });
      data().stats.created += 1;
      data().note = `"${task.value.trim()}" was added to your task list.`;
      task.value = "";
      if (due) due.value = "";
      if (effortBox) effortBox.value = "medium";
      updateAndRender();
    });

    // Task completion and removal buttons.
    $("#tasks")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      const task = data().tasks.find(
        (entry) => entry.id === button?.dataset.id,
      );
      if (!button || !task) return;
      data().tasks = data().tasks.filter((entry) => entry.id !== task.id);
      if (button.dataset.action === "done") {
        data().stats.completed += 1;
        data().note = `"${task.title}" was completed.`;
        markStudyDay();
      } else {
        data().note = `"${task.title}" was removed from your list.`;
      }
      updateAndRender();
    });

    // Task picker for the timer.
    $("#pick")?.addEventListener("change", (event) => {
      data().timer.taskId = event.target.value;
      data().note = "Timer task updated.";
      save();
      render();
    });

    // Timer controls tied to the selected task.
    $("#start")?.addEventListener("click", () => {
      if (!selectedTask()) {
        data().note = "Add or choose a task before you start the timer.";
        save();
        render();
        return;
      }
      data().timer.running ? pauseTimer() : startTimer();
    });

    $("#reset")?.addEventListener("click", resetTimer);
  }

  function renderDashboard() {
    const tasks = sortedTasks();
    const upcoming = nextBadge();
    text("[data-streakhero]", `${data().streak.count} days`);
    text(
      "[data-streakhint]",
      data().streak.count
        ? "Keep showing up each day to grow your streak."
        : "Complete a task or timer session today to start your streak.",
    );
    text("[data-taskhero]", data().stats.completed);
    text(
      "[data-taskhint]",
      `${data().tasks.length} active task${data().tasks.length === 1 ? "" : "s"} in your list.`,
    );
    text("[data-badgehero]", data().badges.length);
    text(
      "[data-badgehint]",
      upcoming
        ? `${upcoming.progress.remaining} step${upcoming.progress.remaining === 1 ? "" : "s"} left for ${upcoming.badge.name}.`
        : "Every badge is unlocked.",
    );
    text(
      "[data-planpill]",
      `${data().tasks.length} active task${data().tasks.length === 1 ? "" : "s"}`,
    );
    text(
      "[data-radarpill]",
      `${Math.min(tasks.length, 3)} top pick${tasks.length === 1 ? "" : "s"}`,
    );

    $("#tasks").innerHTML = tasks.length
      ? tasks
          .map((task, index) => {
            const badge = priorityBadge(task, index);
            return `<div class="schedule-item"><div class="schedule-time">${esc(dueShort(task))}</div><div class="schedule-card"><div class="task-copy"><h3>${esc(task.title)}</h3><p>${esc(dueText(task))} - ${esc(effort(task.effort))} effort</p></div><div class="task-actions"><span class="task-badge ${badge.tone}">${esc(badge.text)}</span><button class="mini-btn" type="button" data-action="done" data-id="${task.id}">Done</button><button class="mini-btn ghost" type="button" data-action="remove" data-id="${task.id}">Remove</button></div></div></div>`;
          })
          .join("")
      : `<div class="task-empty"><strong>Your task list is empty.</strong><p>Add a study task above and it will be sorted for you.</p></div>`;

    $("#radar").innerHTML = tasks.length
      ? tasks
          .slice(0, 3)
          .map(
            (task, index) =>
              `<li class="priority-item"><div><strong>${esc(task.title)}</strong><p>${esc(dueText(task))}. ${esc(effort(task.effort))} effort keeps it near the top.</p></div><span class="priority-rank">${String(index + 1).padStart(2, "0")}</span></li>`,
          )
          .join("")
      : `<li class="priority-item"><div><strong>No task picked yet</strong><p>Add a task and auto priority will rank it here.</p></div><span class="priority-rank">00</span></li>`;

    $("#pick").innerHTML = tasks.length
      ? tasks
          .map(
            (task) => `<option value="${task.id}">${esc(task.title)}</option>`,
          )
          .join("")
      : `<option value="">No task available yet</option>`;

    $("#pick").disabled = !tasks.length;
    if (tasks.length) $("#pick").value = data().timer.taskId;

    renderTimer();
    renderWeek();
    renderBadgeCards("badgepreview", 3);
  }

  // ---------------------------------------------------------------------------
  // Theme and shared rendering
  // ---------------------------------------------------------------------------
  function bindTheme() {
    $$("[data-mode-toggle]").forEach((button) =>
      button.addEventListener("click", () => {
        state.theme = state.theme === "dark" ? "light" : "dark";
        save();
        render();
      }),
    );
  }

  function render() {
    renderTheme();
    renderNav();
    if (document.body.classList.contains("dashboard")) renderDashboard();
    if (document.body.classList.contains("awards")) renderAchievements();
    if (document.body.classList.contains("auth")) renderAuth();
  }

  function renderTheme() {
    document.body.classList.toggle("dark", state.theme === "dark");
    $$("[data-mode-toggle]").forEach((button) => {
      button.textContent = state.theme === "dark" ? "Light Mode" : "Dark Mode";
    });
  }

  function renderNav() {
    text(".streak-num", data().streak.count);
    $$(".streak-chip").forEach((node) =>
      node.setAttribute(
        "aria-label",
        `Current streak ${data().streak.count} days`,
      ),
    );
    $$("[data-auth-link]").forEach((node) => {
      node.textContent = currentUser() ? "Account" : "Login";
    });
  }
})();
