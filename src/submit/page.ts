export const SUBMIT_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Request — TPaaS</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      font-family: system-ui, sans-serif;
      background: #0f0f12;
      color: #e8e6e3;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    main {
      width: 100%;
      max-width: 22rem;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 0.25rem;
    }
    p {
      margin: 0 0 1.5rem;
      font-size: 0.875rem;
      color: #9a9690;
      line-height: 1.5;
    }
    label {
      display: block;
      font-size: 0.8125rem;
      margin-bottom: 0.5rem;
      color: #c4c0b8;
    }
    input[type="file"], input[type="text"], input[type="url"], select {
      width: 100%;
      padding: 0.75rem;
      background: #1a1a20;
      border: 1px solid #2e2e38;
      border-radius: 8px;
      color: inherit;
      font-size: 0.875rem;
    }
    details {
      margin-top: 1rem;
      font-size: 0.8125rem;
      color: #9a9690;
    }
    details summary {
      cursor: pointer;
      color: #c4c0b8;
      margin-bottom: 0.75rem;
    }
    .field {
      margin-bottom: 0.75rem;
    }
    button {
      margin-top: 1rem;
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: 0.9375rem;
      font-weight: 500;
      border: none;
      border-radius: 8px;
      background: #d4a72c;
      color: #0f0f12;
      cursor: pointer;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #status {
      margin-top: 1rem;
      font-size: 0.875rem;
      min-height: 1.25rem;
    }
    #status.ok { color: #7dcea0; }
    #status.err { color: #e88a8a; }
    a { color: #d4a72c; }
  </style>
</head>
<body>
  <main>
    <h1>Request a trolley problem</h1>
    <p>Upload a JPEG or PNG (max 5 MB). Duplicates are rejected. Browse approved memes at <a href="/">gallery</a> or <a href="/random">random</a>.</p>
    <form id="form">
      <label for="image">Image</label>
      <input id="image" name="image" type="file" accept="image/jpeg,image/png" required>
      <details>
        <summary>Optional attribution</summary>
        <div class="field">
          <label for="attribution_label">Credit label</label>
          <input id="attribution_label" name="attribution_label" type="text" maxlength="120" placeholder="e.g. u/username">
        </div>
        <div class="field">
          <label for="attribution_source_url">Source URL</label>
          <input id="attribution_source_url" name="attribution_source_url" type="url" placeholder="https://…">
        </div>
        <div class="field">
          <label for="attribution_kind">Type</label>
          <select id="attribution_kind" name="attribution_kind">
            <option value="">—</option>
            <option value="poster">Poster</option>
            <option value="uploader">Uploader</option>
            <option value="collection">Collection</option>
          </select>
        </div>
      </details>
      <button type="submit" id="btn">Submit</button>
    </form>
    <p id="status" role="status"></p>
  </main>
  <script>
    const form = document.getElementById("form");
    const status = document.getElementById("status");
    const btn = document.getElementById("btn");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.className = "";
      status.textContent = "";
      btn.disabled = true;
      try {
        const res = await fetch("/submit", { method: "POST", body: new FormData(form) });
        const data = await res.json().catch(() => ({}));
        if (res.status === 202) {
          status.className = "ok";
          status.textContent = "Submitted — pending review. ID: " + data.id;
          form.reset();
        } else if (res.status === 409) {
          status.className = "err";
          status.textContent = data.error || "Duplicate image";
        } else {
          status.className = "err";
          status.textContent = data.error || "Submit failed (" + res.status + ")";
        }
      } catch {
        status.className = "err";
        status.textContent = "Network error";
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
