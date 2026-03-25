(function () {
  var form = document.getElementById('workspaceUploadForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var status = document.getElementById('workspaceUploadStatus');
    status.textContent = 'Uploading...';

    var data = new FormData(form);
    var res = await fetch('/documents/upload', {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' }
    });

    var json = await res.json().catch(function () {
      return null;
    });

    if (!res.ok) {
      status.textContent = json && json.error ? json.error : 'Upload failed';
      status.className = 'error';
      return;
    }

    status.textContent = 'Uploaded successfully.';
    status.className = 'success';
    form.reset();
  });
})();
