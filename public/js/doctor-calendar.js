(function () {
  var root = document.getElementById('doctorBookingRuntime');
  if (!root) return;

  var raw = root.getAttribute('data-slots') || '';
  var slots = [];
  try {
    slots = JSON.parse(decodeURIComponent(raw));
  } catch (e) {
    slots = [];
  }

  var calendarTitle = document.getElementById('calendarTitle');
  var calendarGrid = document.getElementById('calendarGrid');
  var slotsTitle = document.getElementById('slotsTitle');
  var slotsList = document.getElementById('slotsList');
  var selectedSlotInput = document.getElementById('selectedSlotId');
  var prevBtn = document.getElementById('calendarPrev');
  var nextBtn = document.getElementById('calendarNext');

  var available = slots.filter(function (s) {
    return s.status === 'available';
  });

  var byDate = {};
  available.forEach(function (s) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  Object.keys(byDate).forEach(function (dateKey) {
    byDate[dateKey].sort(function (a, b) {
      return a.timeLabel.localeCompare(b.timeLabel);
    });
  });

  var dateKeys = Object.keys(byDate).sort();
  var selectedDate = dateKeys[0] || null;
  var selectedSlotId = byDate[selectedDate] && byDate[selectedDate][0] ? byDate[selectedDate][0].id : '';

  if (selectedSlotInput) selectedSlotInput.value = selectedSlotId;

  var months = [];
  dateKeys.forEach(function (dateKey) {
    var monthKey = dateKey.slice(0, 7);
    if (months.indexOf(monthKey) < 0) months.push(monthKey);
  });
  var monthIndex = selectedDate ? Math.max(0, months.indexOf(selectedDate.slice(0, 7))) : 0;

  function monthLabel(monthKey) {
    var parts = monthKey.split('-');
    var y = Number(parts[0]);
    var m = Number(parts[1]) - 1;
    var d = new Date(Date.UTC(y, m, 1));
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  function buildDayCells(monthKey) {
    var parts = monthKey.split('-');
    var y = Number(parts[0]);
    var m = Number(parts[1]) - 1;
    var first = new Date(Date.UTC(y, m, 1));
    var startDay = first.getUTCDay();
    var lastDate = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

    var html = '';
    for (var i = 0; i < startDay; i++) {
      html += '<button type="button" class="calendar-day blank" disabled></button>';
    }

    for (var day = 1; day <= lastDate; day++) {
      var dayKey = monthKey + '-' + String(day).padStart(2, '0');
      var hasSlot = Object.prototype.hasOwnProperty.call(byDate, dayKey);
      var isSelected = selectedDate === dayKey;
      var cls = 'calendar-day' + (hasSlot ? ' available' : '') + (isSelected ? ' active' : '');
      html += '<button type="button" class="' + cls + '" data-date="' + dayKey + '" ' + (hasSlot ? '' : 'disabled') + '>' + day + '</button>';
    }

    return html;
  }

  function renderSlots() {
    if (!slotsList || !slotsTitle) return;
    if (!selectedDate || !byDate[selectedDate] || byDate[selectedDate].length === 0) {
      slotsTitle.textContent = 'Available Time Slots';
      slotsList.innerHTML = '<p class="error">No available slots for selected date.</p>';
      if (selectedSlotInput) selectedSlotInput.value = '';
      return;
    }

    var day = selectedDate;
    slotsTitle.textContent = 'Available Time Slots for ' + day;

    var html = '';
    byDate[selectedDate].forEach(function (slot) {
      var active = slot.id === selectedSlotId ? ' active' : '';
      html += '<button type="button" class="slot-btn' + active + '" data-slot-id="' + slot.id + '">' + slot.timeLabel + ' UTC</button>';
    });
    slotsList.innerHTML = html;

    if (!selectedSlotId && byDate[selectedDate][0]) {
      selectedSlotId = byDate[selectedDate][0].id;
    }
    if (selectedSlotInput) selectedSlotInput.value = selectedSlotId || '';
  }

  function renderCalendar() {
    if (!calendarTitle || !calendarGrid) return;
    if (!months.length) {
      calendarTitle.textContent = 'No Availability';
      calendarGrid.innerHTML = '<p class="error">No upcoming available slots.</p>';
      renderSlots();
      return;
    }

    if (monthIndex < 0) monthIndex = 0;
    if (monthIndex > months.length - 1) monthIndex = months.length - 1;

    var monthKey = months[monthIndex];
    calendarTitle.textContent = monthLabel(monthKey);
    calendarGrid.innerHTML = buildDayCells(monthKey);

    calendarGrid.querySelectorAll('.calendar-day.available').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedDate = btn.getAttribute('data-date');
        if (byDate[selectedDate] && byDate[selectedDate][0]) {
          selectedSlotId = byDate[selectedDate][0].id;
        } else {
          selectedSlotId = '';
        }
        renderCalendar();
        renderSlots();
      });
    });

    renderSlots();
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      monthIndex -= 1;
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      monthIndex += 1;
      renderCalendar();
    });
  }

  if (slotsList) {
    slotsList.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains('slot-btn')) return;
      selectedSlotId = target.getAttribute('data-slot-id') || '';
      if (selectedSlotInput) selectedSlotInput.value = selectedSlotId;
      slotsList.querySelectorAll('.slot-btn').forEach(function (btn) {
        btn.classList.remove('active');
      });
      target.classList.add('active');
    });
  }

  renderCalendar();
})();
