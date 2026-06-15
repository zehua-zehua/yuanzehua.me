(function () {
  const DEFAULT_VERSION = "loopi_v0_2";
  const VISITOR_KEY = "loopi_feedback_visitor_id";

  function getVisitorId() {
    try {
      const existing = window.localStorage.getItem(VISITOR_KEY);
      if (existing) return existing;
      const next =
        window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      window.localStorage.setItem(VISITOR_KEY, next);
      return next;
    } catch (_error) {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  function setText(root, selector, value) {
    const node = root.querySelector(selector);
    if (node) node.textContent = value;
  }

  async function fetchSummary(versionName) {
    const response = await fetch(
      `/api/pet-feedback-summary?version=${encodeURIComponent(versionName)}`,
      { headers: { accept: "application/json" } }
    );
    if (!response.ok) throw new Error("summary_failed");
    return response.json();
  }

  function renderSummary(panel, data) {
    const count = data.feedback_count || 0;
    const average =
      data.average_score === null || data.average_score === undefined
        ? "--"
        : Number(data.average_score).toFixed(1);

    setText(panel, "[data-pet-summary-count]", String(count));
    setText(panel, "[data-pet-summary-score]", average);
    setText(
      panel,
      "[data-pet-summary-status]",
      count
        ? `已收到 ${count} 条真实反馈。`
        : "正在等待第一条真实反馈。"
    );

    const tagRoot = panel.querySelector("[data-pet-summary-tags]");
    if (!tagRoot) return;

    tagRoot.innerHTML = "";
    if (!data.top_tags || !data.top_tags.length) {
      const empty = document.createElement("span");
      empty.className = "pet-summary-tag is-empty";
      empty.textContent = "暂无标签";
      tagRoot.appendChild(empty);
      return;
    }

    data.top_tags.forEach((item) => {
      const tag = document.createElement("span");
      tag.className = "pet-summary-tag";
      tag.textContent = `${item.tag} · ${item.count}`;
      tagRoot.appendChild(tag);
    });
  }

  async function loadSummaries() {
    const panels = document.querySelectorAll("[data-pet-summary-panel]");
    await Promise.all(
      Array.from(panels).map(async (panel) => {
        const versionName = panel.dataset.versionName || DEFAULT_VERSION;
        try {
          const data = await fetchSummary(versionName);
          if (data.ok) renderSummary(panel, data);
        } catch (_error) {
          setText(panel, "[data-pet-summary-status]", "反馈统计暂时不可用。");
        }
      })
    );
  }

  function setupFeedbackForm(form) {
    const versionName = form.dataset.versionName || DEFAULT_VERSION;
    const status = form.querySelector("[data-pet-feedback-status]");
    const submit = form.querySelector("[data-pet-feedback-submit]");
    let selectedScore = null;

    form.querySelectorAll("[data-pet-tag]").forEach((button) => {
      button.addEventListener("click", () => {
        const pressed = button.getAttribute("aria-pressed") === "true";
        button.setAttribute("aria-pressed", pressed ? "false" : "true");
      });
    });

    form.querySelectorAll("[data-pet-score]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedScore = Number(button.dataset.petScore);
        form
          .querySelectorAll("[data-pet-score]")
          .forEach((item) => item.setAttribute("aria-pressed", "false"));
        button.setAttribute("aria-pressed", "true");
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!selectedScore) {
        status.textContent = "请先选择 1-5 分。";
        return;
      }

      const tags = Array.from(form.querySelectorAll("[data-pet-tag]"))
        .filter((button) => button.getAttribute("aria-pressed") === "true")
        .map((button) => button.dataset.petTag);
      const freeText = form.querySelector("[data-pet-feedback-text]")?.value || "";

      submit.disabled = true;
      status.textContent = "正在保存反馈...";

      try {
        const response = await fetch("/api/pet-feedback", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            version_name: versionName,
            score: selectedScore,
            tags,
            free_text_feedback: freeText,
            page_path: window.location.pathname || "/",
            visitor_id: getVisitorId(),
          }),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "submit_failed");
        }

        status.textContent = "已收到，谢谢你帮助 Loopi 进化。";
        form.querySelector("[data-pet-feedback-text]").value = "";
        selectedScore = null;
        form
          .querySelectorAll("[data-pet-score], [data-pet-tag]")
          .forEach((item) => item.setAttribute("aria-pressed", "false"));
        await loadSummaries();
      } catch (_error) {
        status.textContent = "暂时保存失败。数据库配置完成后这里会自动可用。";
      } finally {
        submit.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-pet-feedback]").forEach(setupFeedbackForm);
    loadSummaries();
  });
})();
