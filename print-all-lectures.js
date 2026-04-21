(function () {
  function getLectureEntries() {
    const rows = Array.from(document.querySelectorAll("#schedule tbody tr"));

    return rows
      .filter((row) => {
        const typeCell = row.children[4];
        return typeCell && typeCell.textContent.includes("Lecture");
      })
      .map((row) => {
        const cells = row.children;
        const topicCell = cells[6];
        const link = topicCell ? topicCell.querySelector('a[href^="lecture"]') : null;

        return {
          number: cells[0] ? cells[0].textContent.trim() : "",
          date: cells[1] ? cells[1].textContent.trim() : "",
          day: cells[2] ? cells[2].textContent.trim() : "",
          time: cells[3] ? cells[3].textContent.trim() : "",
          module: cells[5] ? cells[5].textContent.trim() : "",
          topic: topicCell ? topicCell.textContent.trim() : "",
          href: link ? link.getAttribute("href") : null,
        };
      });
  }

  function sanitizeClone(root) {
    const clone = root.cloneNode(true);

    clone.querySelectorAll(
      "script, style, nav, header, footer, .fab-btn, .scroll-top, .nav-wrapper, .nav-tabs, .progress-bar, .search-box, .theme-toggle, .print-lecture-btn"
    ).forEach((node) => node.remove());

    clone.querySelectorAll("[onclick], [onkeyup], [onchange], [oninput]").forEach((node) => {
      node.removeAttribute("onclick");
      node.removeAttribute("onkeyup");
      node.removeAttribute("onchange");
      node.removeAttribute("oninput");
    });

    return clone;
  }

  function buildUnavailableLecture(entry, note) {
    return `
      <article class="print-lecture">
        <div class="print-lecture-head">
          <div class="print-lecture-kicker">Lecture ${entry.number}</div>
          <h2>${entry.topic || "Untitled Lecture"}</h2>
          <div class="print-meta">
            <span>${entry.date}</span>
            <span>${entry.day}</span>
            <span>${entry.time}</span>
            <span>${entry.module}</span>
          </div>
        </div>
        <div class="print-card lecture-error">
          <strong>Lecture notes unavailable.</strong>
          <p>${note}</p>
        </div>
      </article>
    `;
  }

  async function fetchLectureMarkup(entry) {
    if (!entry.href) {
      return buildUnavailableLecture(entry, "No lecture page is linked in the schedule for this lecture.");
    }

    try {
      const response = await fetch(new URL(entry.href, window.location.href).href, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const html = await response.text();
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const tabContents = Array.from(parsed.querySelectorAll(".tab-content"));

      let bodyMarkup = "";

      if (tabContents.length > 0) {
        bodyMarkup = tabContents
          .map((tab) => {
            const clone = sanitizeClone(tab);
            clone.classList.add("print-tab-content");
            clone.classList.remove("active");
            clone.removeAttribute("id");
            return clone.outerHTML;
          })
          .join("");
      } else {
        const source = parsed.querySelector(".content") || parsed.querySelector(".container") || parsed.body;
        const clone = sanitizeClone(source);
        bodyMarkup = clone.innerHTML;
      }

      return `
        <article class="print-lecture">
          <div class="print-lecture-head">
            <div class="print-lecture-kicker">Lecture ${entry.number}</div>
            <h2>${entry.topic || parsed.title || "Untitled Lecture"}</h2>
            <div class="print-meta">
              <span>${entry.date}</span>
              <span>${entry.day}</span>
              <span>${entry.time}</span>
              <span>${entry.module}</span>
            </div>
          </div>
          <div class="print-lecture-body">
            ${bodyMarkup}
          </div>
        </article>
      `;
    } catch (error) {
      return buildUnavailableLecture(
        entry,
        "The page " + entry.href + " could not be loaded into the print bundle. " +
          "If you are opening the site directly as local files, your browser may block cross-file loading."
      );
    }
  }

  function buildPrintDocument(lectureMarkup, count) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>CS 637 Lecture Print Pack</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <style>
    :root {
      --ink: #111827;
      --muted: #475569;
      --border: #cbd5e1;
      --soft: #f8fafc;
    }

    * {
      box-sizing: border-box;
    }

    @page {
      margin: 0.7in;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
    }

    body {
      padding: 24px;
    }

    .print-shell {
      max-width: 960px;
      margin: 0 auto;
    }

    .print-cover {
      margin-bottom: 36px;
      padding-bottom: 20px;
      border-bottom: 3px solid var(--border);
    }

    .print-cover h1 {
      margin: 0 0 10px;
      font-size: 2rem;
    }

    .print-cover p {
      margin: 0;
      color: var(--muted);
    }

    .print-lecture {
      page-break-inside: avoid;
      break-inside: avoid-page;
    }

    .print-lecture + .print-lecture {
      margin-top: 36px;
      padding-top: 28px;
      border-top: 2px solid var(--border);
      page-break-before: always;
      break-before: page;
    }

    .print-lecture-head {
      margin-bottom: 20px;
    }

    .print-lecture-kicker {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      margin-bottom: 6px;
    }

    .print-lecture-head h2 {
      margin: 0 0 10px;
      font-size: 1.65rem;
      line-height: 1.25;
    }

    .print-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--muted);
      font-size: 0.92rem;
    }

    .print-meta span {
      padding: 4px 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: #ffffff;
    }

    .print-tab-content {
      display: block !important;
      opacity: 1 !important;
      transform: none !important;
      animation: none !important;
    }

    .print-tab-content + .print-tab-content {
      margin-top: 26px;
      padding-top: 22px;
      border-top: 1px solid var(--border);
    }

    .print-lecture-body .container,
    .print-lecture-body .content {
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }

    .print-lecture-body .card,
    .print-lecture-body .theorem-card,
    .print-lecture-body .proof-card,
    .print-lecture-body .idea-card,
    .print-lecture-body .remark-card,
    .print-lecture-body .summary-card,
    .print-lecture-body .definition-card,
    .print-lecture-body .example-card,
    .print-lecture-body .note-card,
    .print-lecture-body .info-box,
    .print-lecture-body .formula-box,
    .print-lecture-body .figure-box,
    .print-card {
      margin-bottom: 16px;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-left: 4px solid #64748b;
      border-radius: 8px;
      background: #ffffff !important;
      box-shadow: none !important;
      color: var(--ink) !important;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }

    .lecture-error {
      border-left-color: #b91c1c;
    }

    .print-lecture-body .formula-box {
      background: var(--soft) !important;
      overflow: visible !important;
    }

    .print-lecture-body table,
    .print-lecture-body .mini-table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0 18px;
      font-size: 0.95rem;
    }

    .print-lecture-body th,
    .print-lecture-body td {
      border: 1px solid var(--border);
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }

    .print-lecture-body th {
      background: var(--soft);
      font-weight: 700;
    }

    .print-lecture-body .two-col,
    .print-lecture-body .grid-2,
    .print-lecture-body .figure-grid {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 14px !important;
    }

    .print-lecture-body h2,
    .print-lecture-body h3,
    .print-lecture-body h4 {
      margin: 0 0 10px;
      color: var(--ink) !important;
    }

    .print-lecture-body p {
      margin: 0 0 10px;
    }

    .print-lecture-body ul,
    .print-lecture-body ol {
      margin: 10px 0 12px 22px;
      padding: 0;
    }

    .print-lecture-body li {
      margin: 6px 0;
      padding: 0;
    }

    .print-lecture-body li::before {
      content: none !important;
    }

    .print-lecture-body svg,
    .print-lecture-body img {
      max-width: 100%;
      height: auto;
    }

    .print-lecture-body a {
      color: inherit;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <main class="print-shell">
    <section class="print-cover">
      <h1>CS 637: Mathematics-II</h1>
      <p>Lecture print pack generated from the course index. Included lecture rows: ${count}.</p>
    </section>
    ${lectureMarkup}
  </main>
  <script>
    window.addEventListener("load", function () {
      if (window.renderMathInElement) {
        renderMathInElement(document.body, {
          delimiters: [
            { left: "\\\\[", right: "\\\\]", display: true },
            { left: "\\\\(", right: "\\\\)", display: false }
          ]
        });
      }

      window.setTimeout(function () {
        window.focus();
        window.print();
      }, 350);
    });
  </script>
</body>
</html>`;
  }

  async function handlePrintAllLectures(button) {
    const entries = getLectureEntries();
    if (!entries.length) {
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Preparing...";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      button.disabled = false;
      button.textContent = originalText;
      window.alert("Please allow pop-ups for this page so the lecture print view can open.");
      return;
    }

    printWindow.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Preparing lecture print view</title><style>body{font-family:Arial,sans-serif;padding:32px;line-height:1.6;color:#111827}h1{font-size:1.4rem;margin-bottom:8px}p{color:#475569}</style></head><body><h1>Preparing lecture print view...</h1><p>Loading lecture pages and assembling a printable packet.</p></body></html>`);
    printWindow.document.close();

    try {
      const markup = await Promise.all(entries.map((entry) => fetchLectureMarkup(entry)));
      printWindow.document.open();
      printWindow.document.write(buildPrintDocument(markup.join(""), entries.length));
      printWindow.document.close();
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function initPrintAllLectures() {
    const button = document.getElementById("print-all-lectures");
    if (!button) {
      return;
    }

    button.addEventListener("click", function () {
      handlePrintAllLectures(button);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPrintAllLectures);
  } else {
    initPrintAllLectures();
  }
})();
