(function () {
  var backBtn = document.getElementById('btnBackNav');
  var forwardBtn = document.getElementById('btnForwardNav');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      window.history.back();
    });
  }
  if (forwardBtn) {
    forwardBtn.addEventListener('click', function () {
      window.history.forward();
    });
  }

  var addBtn = document.getElementById('btnAddMedication');
  var rows = document.getElementById('medicationRows');
  if (!addBtn || !rows) return;

  addBtn.addEventListener('click', function () {
    var row = document.createElement('div');
    row.className = 'med-form-row';
    row.innerHTML =
      '<input name="medicationName" placeholder="Medicine name" required />' +
      '<input name="dosage" placeholder="Dosage" />' +
      '<input name="frequency" placeholder="Frequency" />' +
      '<input name="duration" placeholder="Duration" />';
    rows.appendChild(row);
  });
})();
