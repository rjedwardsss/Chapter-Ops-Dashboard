(function () {
  "use strict";

  function uid() {
    return Math.random().toString(36).slice(2, 9);
  }

  function today(offset) {
    offset = offset || 0;
    var d = new Date(Date.now() + offset * 86400000);
    return d.toISOString().slice(0, 10);
  }

  function fmtDate(s) {
    if (!s) return "—";
    var d = new Date(s + "T00:00:00");
    return d.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function parseDay(s) {
    return new Date(s + "T12:00:00").getTime();
  }

  function daysFromToday(dateStr) {
    var t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    var t1 = new Date(dateStr + "T12:00:00");
    t1.setHours(0, 0, 0, 0);
    return Math.round((t1.getTime() - t0.getTime()) / 86400000);
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function downloadCsv(filename, rows) {
    var csv = rows
      .map(function (r) {
        return r
          .map(function (v) {
            return '"' + String(v).replace(/"/g, '""') + '"';
          })
          .join(",");
      })
      .join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function normalizeMember(raw) {
    var history = Array.isArray(raw.paymentHistory) ? raw.paymentHistory : [];
    return {
      id: raw.id,
      name: raw.name,
      role: raw.role,
      dues: Number(raw.dues) || 0,
      paid: Number(raw.paid) || 0,
      paymentHistory: history.map(function (p) {
        return {
          id: p.id || uid(),
          date: p.date || today(),
          amount: Number(p.amount) || 0,
          note: p.note,
        };
      }),
      notes: typeof raw.notes === "string" ? raw.notes : "",
    };
  }

  function normalizeTask(raw) {
    var pr = raw.priority;
    var priority = pr === "low" || pr === "high" ? pr : "med";
    var col = raw.col === "doing" || raw.col === "done" ? raw.col : "todo";
    return {
      id: raw.id,
      title: raw.title,
      assignee: raw.assignee || "Unassigned",
      col: col,
      priority: priority,
      dueDate: typeof raw.dueDate === "string" ? raw.dueDate : "",
    };
  }

  function seedMembers() {
    return [
      {
        id: uid(),
        name: "Bob Smith",
        role: "Secretary",
        dues: 300,
        paid: 0,
        paymentHistory: [],
        notes: "",
      },
      {
        id: uid(),
        name: "John Doe",
        role: "Treasurer",
        dues: 300,
        paid: 150,
        paymentHistory: [{ id: uid(), date: today(-5), amount: 150, note: "Partial — Venmo" }],
        notes: "",
      },
      {
        id: uid(),
        name: "RJ Edwards",
        role: "President",
        dues: 300,
        paid: 300,
        paymentHistory: [{ id: uid(), date: today(-12), amount: 300, note: "Full dues" }],
        notes: "",
      },
    ];
  }

  function seedEvents() {
    return [
      { id: uid(), title: "Chapter Meeting", date: today(3), yes: [], no: [], maybe: [] },
      { id: uid(), title: "Philanthropy Night", date: today(10), yes: [], no: [], maybe: [] },
    ];
  }

  function seedTasks() {
    return [
      {
        id: uid(),
        title: "Book room for meeting",
        assignee: "Bob Smith",
        col: "done",
        priority: "low",
        dueDate: today(-2),
      },
      {
        id: uid(),
        title: "Collect remaining dues",
        assignee: "John Doe",
        col: "doing",
        priority: "high",
        dueDate: today(5),
      },
      {
        id: uid(),
        title: "Publish event agenda",
        assignee: "RJ Edwards",
        col: "todo",
        priority: "med",
        dueDate: today(7),
      },
    ];
  }

  var members = [];
  var events = [];
  var tasks = [];
  var sortAsc = true;
  var search = "";
  var draggedMemberId = null;
  var draggedTaskId = null;
  var detailMemberId = null;
  var toastTimer = null;

  function saveAll() {
    if (members.length) localStorage.setItem("members", JSON.stringify(members));
    if (events.length || localStorage.getItem("events")) {
      localStorage.setItem("events", JSON.stringify(events));
    }
    if (tasks.length || localStorage.getItem("tasks")) {
      localStorage.setItem("tasks", JSON.stringify(tasks));
    }
  }

  function loadAll() {
    try {
      var savedMembers = localStorage.getItem("members");
      var savedEvents = localStorage.getItem("events");
      var savedTasks = localStorage.getItem("tasks");
      var rawM = savedMembers ? JSON.parse(savedMembers) : seedMembers();
      members = rawM.map(normalizeMember);
      events = savedEvents ? JSON.parse(savedEvents) : seedEvents();
      var rawT = savedTasks ? JSON.parse(savedTasks) : seedTasks();
      tasks = rawT.map(normalizeTask);
    } catch (e) {
      members = seedMembers();
      events = seedEvents();
      tasks = seedTasks();
    }
  }

  function statusText(m) {
    if (m.paid >= m.dues) return "Paid";
    if (m.paid > 0) return "Partial";
    return "Due";
  }

  function statusClass(m) {
    if (m.paid >= m.dues) return "status paid";
    if (m.paid > 0) return "status partial";
    return "status due";
  }

  function computeTotals() {
    var totalDues = 0;
    var totalPaid = 0;
    var countPaid = 0;
    var countPartial = 0;
    var countDue = 0;
    members.forEach(function (m) {
      totalDues += m.dues;
      totalPaid += m.paid;
      if (m.paid >= m.dues) countPaid++;
      else if (m.paid > 0) countPartial++;
      else countDue++;
    });
    var outstanding = Math.max(0, totalDues - totalPaid);
    var pct = totalDues ? Math.round((totalPaid / totalDues) * 100) : 0;
    return { totalDues: totalDues, totalPaid: totalPaid, outstanding: outstanding, countPaid: countPaid, countPartial: countPartial, countDue: countDue, pct: pct };
  }

  function upcomingEventsCount() {
    var t = today();
    return events.filter(function (e) {
      return (e.date || "") >= t;
    }).length;
  }

  function nextEventId() {
    var t = today();
    var future = events
      .filter(function (e) {
        return (e.date || "") >= t;
      })
      .sort(function (a, b) {
        return (a.date || "").localeCompare(b.date || "");
      });
    return future[0] ? future[0].id : null;
  }

  function avgRsvpYesPct() {
    var n = members.length || 1;
    if (!events.length) return 0;
    var sum = events.reduce(function (acc, ev) {
      return acc + (ev.yes.length / n) * 100;
    }, 0);
    return Math.round(sum / events.length);
  }

  function engagementPct() {
    if (!members.length || !events.length) return 0;
    var engaged = members.filter(function (m) {
      return events.some(function (ev) {
        return ev.yes.indexOf(m.id) !== -1;
      });
    }).length;
    return Math.round((engaged / members.length) * 100);
  }

  function buildAlerts() {
    var items = [];
    members.forEach(function (m) {
      if (m.paid < m.dues) {
        items.push({ key: "due-" + m.id, kind: "danger", text: m.name + ": $" + (m.dues - m.paid) + " outstanding" });
      }
    });
    events.forEach(function (ev) {
      var d = daysFromToday(ev.date);
      if (d >= 0 && d <= 7) {
        items.push({
          key: "soon-" + ev.id,
          kind: "info",
          text: ev.title + " in " + (d === 0 ? "today" : d === 1 ? "1 day" : d + " days"),
        });
      }
      var n = members.length || 1;
      var yesPct = Math.round((ev.yes.length / n) * 100);
      if (d >= 0 && d <= 14 && yesPct < 35 && n >= 2) {
        items.push({
          key: "low-" + ev.id,
          kind: "warn",
          text: 'Low RSVP for "' + ev.title + '" (' + yesPct + "% yes)",
        });
      }
    });
    return items.slice(0, 8);
  }

  function filteredMembers() {
    var q = search.toLowerCase();
    return members
      .filter(function (m) {
        return m.name.toLowerCase().indexOf(q) !== -1 || m.role.toLowerCase().indexOf(q) !== -1;
      })
      .sort(function (a, b) {
        return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      });
  }

  function showToast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.add("hidden");
    }, 2000);
  }

  function recordPayment(memberId, amount, note) {
    if (amount <= 0) return;
    members = members.map(function (m) {
      if (m.id !== memberId) return m;
      var room = Math.max(0, m.dues - m.paid);
      var actual = room > 0 ? Math.min(amount, room) : 0;
      if (actual <= 0) return m;
      var nextPaid = Math.min(m.dues, m.paid + actual);
      var entry = { id: uid(), date: today(), amount: actual, note: note };
      return {
        id: m.id,
        name: m.name,
        role: m.role,
        dues: m.dues,
        paid: nextPaid,
        paymentHistory: m.paymentHistory.concat([entry]),
        notes: m.notes,
      };
    });
    document.getElementById("pay-amount").value = "";
    document.getElementById("pay-note").value = "";
    saveAll();
    showToast("Payment recorded");
    render();
  }

  function togglePaid(id) {
    members = members.map(function (m) {
      if (m.id !== id) return m;
      if (m.paid >= m.dues) {
        return { id: m.id, name: m.name, role: m.role, dues: m.dues, paid: 0, paymentHistory: [], notes: m.notes };
      }
      var delta = m.dues - m.paid;
      return {
        id: m.id,
        name: m.name,
        role: m.role,
        dues: m.dues,
        paid: m.dues,
        paymentHistory: m.paymentHistory.concat([{ id: uid(), date: today(), amount: delta, note: "Marked paid (full)" }]),
        notes: m.notes,
      };
    });
    saveAll();
    render();
  }

  function addMember() {
    var name = window.prompt("Member name");
    if (!name) return;
    var role = window.prompt("Role (e.g., Member, Treasurer)") || "Member";
    var dues = parseInt(window.prompt("Dues amount (e.g., 300)") || "300", 10) || 300;
    members.push({ id: uid(), name: name, role: role, dues: dues, paid: 0, paymentHistory: [], notes: "" });
    saveAll();
    showToast("Member added");
    render();
  }

  function removeMember(id) {
    if (!window.confirm("Remove this member?")) return;
    members = members.filter(function (m) {
      return m.id !== id;
    });
    if (detailMemberId === id) closeDrawer();
    events = events.map(function (ev) {
      return {
        id: ev.id,
        title: ev.title,
        date: ev.date,
        yes: ev.yes.filter(function (x) {
          return x !== id;
        }),
        maybe: ev.maybe.filter(function (x) {
          return x !== id;
        }),
        no: ev.no.filter(function (x) {
          return x !== id;
        }),
      };
    });
    saveAll();
    render();
  }

  function exportMembersCsv() {
    var rows = [["Name", "Role", "Dues", "Paid", "Outstanding", "Status"]];
    members.forEach(function (m) {
      rows.push([m.name, m.role, m.dues, m.paid, m.dues - m.paid, statusText(m)]);
    });
    downloadCsv("members.csv", rows);
    showToast("CSV exported");
  }

  function addEvent() {
    var title = document.getElementById("event-title").value.trim();
    var dateInput = document.getElementById("event-date").value;
    var date = dateInput || today(7);
    if (!title) {
      window.alert("Please enter a title");
      return;
    }
    events.push({ id: uid(), title: title, date: date, yes: [], no: [], maybe: [] });
    document.getElementById("event-title").value = "";
    saveAll();
    showToast("Event created");
    render();
  }

  function deleteEvent(id) {
    events = events.filter(function (e) {
      return e.id !== id;
    });
    saveAll();
    render();
  }

  function updateRsvp(eventId, memberId, value) {
    events = events.map(function (ev) {
      if (ev.id !== eventId) return ev;
      var yes = ev.yes.filter(function (x) {
        return x !== memberId;
      });
      var maybe = ev.maybe.filter(function (x) {
        return x !== memberId;
      });
      var no = ev.no.filter(function (x) {
        return x !== memberId;
      });
      if (value === "yes") yes = yes.concat([memberId]);
      if (value === "maybe") maybe = maybe.concat([memberId]);
      if (value === "no") no = no.concat([memberId]);
      return { id: ev.id, title: ev.title, date: ev.date, yes: yes, maybe: maybe, no: no };
    });
    saveAll();
    render();
  }

  function addTask() {
    var title = document.getElementById("task-title").value.trim();
    if (!title) return;
    var assignee = document.getElementById("task-assignee").value || "Unassigned";
    var priority = document.getElementById("task-priority").value;
    var due = document.getElementById("task-due").value || "";
    tasks.push({
      id: uid(),
      title: title,
      assignee: assignee,
      col: "todo",
      priority: priority,
      dueDate: due,
    });
    document.getElementById("task-title").value = "";
    saveAll();
    showToast("Task added");
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter(function (t) {
      return t.id !== id;
    });
    saveAll();
    render();
  }

  function dropTask(col) {
    if (!draggedTaskId) return;
    tasks = tasks.map(function (t) {
      return t.id === draggedTaskId ? Object.assign({}, t, { col: col }) : t;
    });
    draggedTaskId = null;
    saveAll();
    render();
  }

  function clearDone() {
    if (!tasks.some(function (t) {
      return t.col === "done";
    }))
      return;
    if (!window.confirm("Remove all tasks in Done?")) return;
    tasks = tasks.filter(function (t) {
      return t.col !== "done";
    });
    saveAll();
    render();
  }

  function handleMemberDrop(targetId) {
    if (!draggedMemberId) return;
    var next = members.slice();
    var fromIndex = next.findIndex(function (m) {
      return m.id === draggedMemberId;
    });
    if (fromIndex === -1) return;
    var moved = next.splice(fromIndex, 1)[0];
    if (targetId === null) next.push(moved);
    else {
      var toIndex = next.findIndex(function (m) {
        return m.id === targetId;
      });
      if (toIndex === -1) next.push(moved);
      else next.splice(toIndex, 0, moved);
    }
    members = next;
    draggedMemberId = null;
    saveAll();
    render();
  }

  function updateMemberNotes(id, notes) {
    members = members.map(function (m) {
      return m.id === id ? Object.assign({}, m, { notes: notes }) : m;
    });
    saveAll();
  }

  function formatDue(d) {
    return d ? fmtDate(d) : "";
  }

  function openDrawer(id) {
    detailMemberId = id;
    document.getElementById("pay-amount").value = "";
    document.getElementById("pay-note").value = "";
    document.getElementById("drawer-backdrop").classList.remove("hidden");
    document.getElementById("member-drawer").classList.remove("hidden");
    renderDrawer();
  }

  function closeDrawer() {
    detailMemberId = null;
    document.getElementById("drawer-backdrop").classList.add("hidden");
    document.getElementById("member-drawer").classList.add("hidden");
  }

  function getDetailMember() {
    if (!detailMemberId) return null;
    for (var i = 0; i < members.length; i++) {
      if (members[i].id === detailMemberId) return members[i];
    }
    return null;
  }

  function attendanceSummaryForMember(m) {
    return events.map(function (ev) {
      var rsvp = "—";
      if (ev.yes.indexOf(m.id) !== -1) rsvp = "yes";
      else if (ev.maybe.indexOf(m.id) !== -1) rsvp = "maybe";
      else if (ev.no.indexOf(m.id) !== -1) rsvp = "no";
      return { title: ev.title, date: ev.date, rsvp: rsvp };
    });
  }

  function renderDrawer() {
    var m = getDetailMember();
    if (!m) return;
    document.getElementById("drawer-title").textContent = m.name;
    document.getElementById("drawer-role").textContent = m.role;
    document.getElementById("drawer-dues-line").textContent =
      "Owed $" + m.dues + " · Paid $" + m.paid + " · Outstanding $" + Math.max(0, m.dues - m.paid);
    var st = document.getElementById("drawer-status");
    st.className = statusClass(m);
    st.textContent = statusText(m);

    var hist = document.getElementById("drawer-history");
    var histEmpty = document.getElementById("drawer-history-empty");
    if (!m.paymentHistory.length) {
      hist.innerHTML = "";
      hist.classList.add("hidden");
      histEmpty.classList.remove("hidden");
    } else {
      hist.classList.remove("hidden");
      histEmpty.classList.add("hidden");
      var sorted = m.paymentHistory.slice().sort(function (a, b) {
        return parseDay(b.date) - parseDay(a.date);
      });
      hist.innerHTML = sorted
        .map(function (p) {
          return (
            "<li><span>" +
            esc(fmtDate(p.date) + " · $" + p.amount + (p.note ? " — " + p.note : "")) +
            "</span></li>"
          );
        })
        .join("");
    }

    var att = document.getElementById("drawer-attendance");
    att.innerHTML = attendanceSummaryForMember(m)
      .map(function (row) {
        return (
          "<li><span>" +
          esc(row.title + " (" + fmtDate(row.date) + ")") +
          '</span><span class="rsvp-label">' +
          esc(row.rsvp) +
          "</span></li>"
        );
      })
      .join("");

    document.getElementById("drawer-notes").value = m.notes;
  }

  function renderKpis(totals) {
    document.getElementById("kpi-members").textContent = String(members.length);
    document.getElementById("kpi-dues").textContent = "$" + totals.totalDues;
    document.getElementById("kpi-collected").textContent = "$" + totals.totalPaid;
    document.getElementById("kpi-pct-sub").textContent = totals.pct + "% of total";
    document.getElementById("kpi-outstanding").textContent = "$" + totals.outstanding;
    document.getElementById("kpi-events").textContent = String(upcomingEventsCount());
  }

  function renderAlerts() {
    var list = buildAlerts();
    var panel = document.getElementById("alerts-panel");
    var container = document.getElementById("alerts-list");
    if (!list.length) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");
    container.innerHTML = list
      .map(function (a) {
        return '<span class="alert-pill ' + esc(a.kind) + '">' + esc(a.text) + "</span>";
      })
      .join("");
  }

  function renderMembersSection(totals) {
    document.getElementById("pill-collected").innerHTML =
      "Collected <strong>$" + totals.totalPaid + "</strong> / $" + totals.totalDues;
    document.getElementById("pill-counts").innerHTML =
      "Paid <strong>" +
      totals.countPaid +
      "</strong> · Partial <strong>" +
      totals.countPartial +
      '</strong> · Due <strong>' +
      totals.countDue +
      "</strong>";
    var bar = document.getElementById("dues-bar");
    bar.style.width = totals.pct + "%";
    if (totals.pct >= 100) bar.setAttribute("data-complete", "true");
    else bar.removeAttribute("data-complete");

    var tbody = document.getElementById("members-tbody");
    var rows = filteredMembers();
    tbody.innerHTML = rows
      .map(function (m) {
        var dragClass = draggedMemberId === m.id ? " dragging" : "";
        return (
          '<tr class="member-row' +
          dragClass +
          '" draggable="true" data-member-id="' +
          esc(m.id) +
          '">' +
          '<td class="drag-handle" title="Drag to reorder">☰</td>' +
          '<td><button type="button" class="member-name-btn" data-open-member="' +
          esc(m.id) +
          '">' +
          esc(m.name) +
          "</button></td>" +
          "<td>" +
          esc(m.role) +
          "</td>" +
          "<td>$" +
          m.dues +
          "</td>" +
          "<td>$" +
          m.paid +
          '</td><td><span class="' +
          statusClass(m) +
          '">' +
          esc(statusText(m)) +
          "</span></td>" +
          '<td class="row-actions"><div class="action-buttons">' +
          '<button type="button" class="button secondary sm" data-toggle-paid="' +
          esc(m.id) +
          '">' +
          (m.paid >= m.dues ? "Mark unpaid" : "Mark paid") +
          "</button>" +
          '<button type="button" class="button secondary sm danger" data-remove-member="' +
          esc(m.id) +
          '">Remove</button>' +
          "</div></td></tr>"
        );
      })
      .join("");

    Array.prototype.forEach.call(tbody.querySelectorAll("tr[data-member-id]"), function (tr) {
      var mid = tr.getAttribute("data-member-id");
      tr.addEventListener("dragstart", function () {
        draggedMemberId = mid;
      });
      tr.addEventListener("dragover", function (e) {
        e.preventDefault();
      });
      tr.addEventListener("drop", function (e) {
        e.preventDefault();
        handleMemberDrop(mid);
      });
    });
  }

  function renderAnalytics(totals) {
    document.getElementById("analytics-pay-pct").textContent = totals.pct + "%";
    document.getElementById("analytics-mini-bar").style.width = totals.pct + "%";
    document.getElementById("analytics-pay-hint").textContent =
      "$" + totals.totalPaid + " collected · $" + totals.outstanding + " remaining";
    document.getElementById("analytics-rsvp").textContent = avgRsvpYesPct() + "%";
    document.getElementById("analytics-engage").textContent = engagementPct() + "%";
  }

  function renderTaskAssigneeSelect() {
    var sel = document.getElementById("task-assignee");
    var current = sel.value;
    sel.innerHTML = members
      .map(function (m) {
        return '<option value="' + esc(m.name) + '">' + esc(m.name) + "</option>";
      })
      .join("");
    if (current && Array.prototype.some.call(sel.options, function (o) { return o.value === current; })) {
      sel.value = current;
    } else if (members[0]) sel.value = members[0].name;
  }

  function renderKanban() {
    function tasksInCol(col) {
      return tasks.filter(function (t) {
        return t.col === col;
      });
    }
    function renderCol(colId, col, showDel) {
      var el = document.getElementById(colId);
      el.innerHTML = tasksInCol(col)
        .map(function (task) {
          var dueHtml = task.dueDate ? '<span class="due-tag">Due ' + esc(formatDue(task.dueDate)) + "</span>" : "";
          var delBtn = showDel
            ? '<button type="button" class="task-del" data-delete-task="' + esc(task.id) + '" title="Remove">✕</button>'
            : "";
          return (
            '<div class="task-card" draggable="true" data-task-id="' +
            esc(task.id) +
            '">' +
            '<div class="task-top"><div class="task-title">' +
            esc(task.title) +
            "</div>" +
            delBtn +
            "</div>" +
            '<div class="task-meta"><span class="chip">' +
            esc(task.assignee) +
            '</span><span class="prio prio-' +
            esc(task.priority) +
            '">' +
            esc(task.priority) +
            " priority</span>" +
            dueHtml +
            "</div></div>"
          );
        })
        .join("");

      Array.prototype.forEach.call(el.querySelectorAll(".task-card[data-task-id]"), function (card) {
        var tid = card.getAttribute("data-task-id");
        card.addEventListener("dragstart", function () {
          draggedTaskId = tid;
        });
      });
      Array.prototype.forEach.call(el.querySelectorAll("[data-delete-task]"), function (btn) {
        btn.addEventListener("click", function () {
          deleteTask(btn.getAttribute("data-delete-task"));
        });
      });
    }
    renderCol("kanban-todo", "todo", false);
    renderCol("kanban-doing", "doing", false);
    renderCol("kanban-done", "done", true);

    Array.prototype.forEach.call(document.querySelectorAll(".col[data-kanban-col]"), function (colEl) {
      var col = colEl.getAttribute("data-kanban-col");
      colEl.ondragover = function (e) {
        e.preventDefault();
      };
      colEl.ondrop = function (e) {
        e.preventDefault();
        dropTask(col);
      };
    });
  }

  function renderEvents() {
    var el = document.getElementById("events-list");
    var next = nextEventId();
    if (!events.length) {
      el.innerHTML = '<div class="empty">No events yet.</div>';
      return;
    }
    var sorted = events.slice().sort(function (a, b) {
      return (a.date || "").localeCompare(b.date || "");
    });
    el.innerHTML = sorted
      .map(function (ev) {
        var total = members.length || 1;
        var yes = ev.yes.length;
        var maybe = ev.maybe.length;
        var no = ev.no.length;
        var responded = yes + maybe + no;
        var pct = Math.round((yes / total) * 100);
        var days = daysFromToday(ev.date);
        var isNext = ev.id === next;
        var dayLabel =
          days < 0 ? Math.abs(days) + "d ago" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : "In " + days + " days";
        var dayClass = "event-days";
        if (days <= 1 && days >= 0) dayClass += " today";
        else if (days <= 3 && days >= 0) dayClass += " soon";
        var cardClass = "event-card" + (isNext ? " event-card--next" : "");
        var attendees = members
          .map(function (m) {
            var y = ev.yes.indexOf(m.id) !== -1;
            var mb = ev.maybe.indexOf(m.id) !== -1;
            var n = ev.no.indexOf(m.id) !== -1;
            return (
              '<div class="attendee">' +
              '<span class="name">' +
              esc(m.name) +
              '</span><button type="button" class="yes' +
              (y ? " active" : "") +
              '" data-rsvp-event="' +
              esc(ev.id) +
              '" data-rsvp-member="' +
              esc(m.id) +
              '" data-rsvp-value="yes">Yes</button>' +
              '<button type="button" class="maybe' +
              (mb ? " active" : "") +
              '" data-rsvp-event="' +
              esc(ev.id) +
              '" data-rsvp-member="' +
              esc(m.id) +
              '" data-rsvp-value="maybe">Maybe</button>' +
              '<button type="button" class="no' +
              (n ? " active" : "") +
              '" data-rsvp-event="' +
              esc(ev.id) +
              '" data-rsvp-member="' +
              esc(m.id) +
              '" data-rsvp-value="no">No</button></div>'
            );
          })
          .join("");
        return (
          '<div class="' +
          cardClass +
          '" data-event-id="' +
          esc(ev.id) +
          '">' +
          '<div class="event-head"><div><div class="event-title">' +
          esc(ev.title) +
          '</div><div class="event-meta"><span class="event-date-badge">' +
          esc(fmtDate(ev.date)) +
          '</span><span class="' +
          dayClass +
          '">' +
          esc(dayLabel) +
          "</span>" +
          (isNext ? '<span class="chip">Next up</span>' : "") +
          '</div></div><button type="button" class="button secondary sm" data-delete-event="' +
          esc(ev.id) +
          '">Delete</button></div>' +
          '<div class="stats"><span class="badge">Yes ' +
          yes +
          '</span><span class="badge">Maybe ' +
          maybe +
          '</span><span class="badge">No ' +
          no +
          '</span><span class="badge">RSVP ' +
          responded +
          "/" +
          total +
          '</span><span class="badge">Attending ' +
          pct +
          "%</span></div>" +
          '<div class="attendees">' +
          attendees +
          "</div></div>"
        );
      })
      .join("");

    Array.prototype.forEach.call(el.querySelectorAll("[data-delete-event]"), function (btn) {
      btn.addEventListener("click", function () {
        deleteEvent(btn.getAttribute("data-delete-event"));
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll("[data-rsvp-event]"), function (btn) {
      btn.addEventListener("click", function () {
        updateRsvp(btn.getAttribute("data-rsvp-event"), btn.getAttribute("data-rsvp-member"), btn.getAttribute("data-rsvp-value"));
      });
    });
  }

  function render() {
    var totals = computeTotals();
    renderKpis(totals);
    renderAlerts();
    renderMembersSection(totals);
    renderAnalytics(totals);
    renderTaskAssigneeSelect();
    renderKanban();
    renderEvents();
    if (detailMemberId) renderDrawer();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("footer-year").textContent = "© " + new Date().getFullYear();

    loadAll();
    saveAll();
    document.getElementById("search").value = search;

    document.getElementById("member-drop-end").addEventListener("dragover", function (e) {
      e.preventDefault();
    });
    document.getElementById("member-drop-end").addEventListener("drop", function (e) {
      e.preventDefault();
      handleMemberDrop(null);
    });

    document.getElementById("search").addEventListener("input", function (e) {
      search = e.target.value;
      render();
    });

    document.getElementById("btn-sort-name").addEventListener("click", function () {
      sortAsc = !sortAsc;
      render();
    });

    document.getElementById("btn-add-member").addEventListener("click", addMember);
    document.getElementById("btn-export-csv").addEventListener("click", exportMembersCsv);
    document.getElementById("btn-add-event").addEventListener("click", addEvent);
    document.getElementById("btn-add-task").addEventListener("click", addTask);
    document.getElementById("btn-clear-done").addEventListener("click", clearDone);

    document.getElementById("drawer-backdrop").addEventListener("click", closeDrawer);
    document.getElementById("drawer-close").addEventListener("click", closeDrawer);

    document.getElementById("pay-apply").addEventListener("click", function () {
      var m = getDetailMember();
      if (!m) return;
      var n = parseInt(document.getElementById("pay-amount").value, 10);
      if (!isFinite(n) || n <= 0) {
        showToast("Enter a valid amount");
        return;
      }
      recordPayment(m.id, n, document.getElementById("pay-note").value.trim() || undefined);
    });

    document.getElementById("drawer-notes").addEventListener("input", function (e) {
      var m = getDetailMember();
      if (!m) return;
      updateMemberNotes(m.id, e.target.value);
    });

    document.addEventListener("keydown", function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      tag = tag.toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea") {
        e.preventDefault();
        document.getElementById("search").focus();
      }
      if (e.key === "Escape" && detailMemberId) closeDrawer();
    });

    document.getElementById("members-tbody").addEventListener("click", function (e) {
      var openBtn = e.target.closest("[data-open-member]");
      if (openBtn) {
        openDrawer(openBtn.getAttribute("data-open-member"));
        return;
      }
      var tp = e.target.closest("[data-toggle-paid]");
      if (tp) {
        togglePaid(tp.getAttribute("data-toggle-paid"));
        return;
      }
      var rm = e.target.closest("[data-remove-member]");
      if (rm) {
        removeMember(rm.getAttribute("data-remove-member"));
      }
    });

    render();
  });
})();
