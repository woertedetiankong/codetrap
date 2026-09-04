export const WEB_SHELL_CLIENT_SCRIPT = `    const SHELL_LAYOUT_KEY = "codetrap-shell-layout";
    const SHELL_SIDEBAR_KEY = "codetrap-sidebar-collapsed";
    const SHELL_QUEUE_KEY = "codetrap-queue-collapsed";
    const SHELL_DESKTOP_QUERY = "(min-width: 1061px)";
    const SHELL_SPLITTER_WIDTH = 8;
    // These keys name column positions, not content: rail is the left column
    // (the active view's list) and queue the right one (projects and sessions).
    const SHELL_PANE_MIN = { rail: 320, detail: 460, queue: 250 };
    const SHELL_COLLAPSE_THRESHOLD = { rail: 230, queue: 180 };
    const SHELL_REVEAL_EDGE_WIDTH = 18;
    const SHELL_PEEK_WIDTH = { rail: 390, queue: 330 };

    function shellElement() {
      return document.querySelector(".shell");
    }

    function isDesktopShellLayout() {
      return window.matchMedia(SHELL_DESKTOP_QUERY).matches;
    }

    function readShellLayout() {
      try {
        const saved = JSON.parse(localStorage.getItem(SHELL_LAYOUT_KEY) || "null");
        if (saved && Number.isFinite(saved.rail)) {
          const detail = Number.isFinite(saved.detail) ? saved.detail : saved.queue;
          if (Number.isFinite(detail)) return { rail: saved.rail, detail };
        }
      } catch (_error) {}
      return null;
    }

    function writeShellLayout(layout) {
      try {
        localStorage.setItem(SHELL_LAYOUT_KEY, JSON.stringify({
          rail: Math.round(layout.rail),
          detail: Math.round(layout.detail)
        }));
      } catch (_error) {}
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function shellAvailableWidth(shell) {
      let splitterCount = 0;
      if (!state.sidebarCollapsed) splitterCount += 1;
      if (!state.queueCollapsed) splitterCount += 1;
      return Math.max(0, shell.getBoundingClientRect().width - (SHELL_SPLITTER_WIDTH * splitterCount));
    }

    function currentShellLayout() {
      const saved = readShellLayout();
      const railWidth = document.querySelector(".rail")?.getBoundingClientRect().width || 0;
      const detailWidth = document.querySelector(".detail")?.getBoundingClientRect().width || 0;
      const rail = railWidth > 0 ? railWidth : saved?.rail || SHELL_PANE_MIN.rail;
      const detail = detailWidth > 0 ? detailWidth : saved?.detail || SHELL_PANE_MIN.detail;
      return { rail, detail };
    }

    function normalizeSidebarCollapsedShellLayout(shell, layout) {
      const available = shellAvailableWidth(shell);
      const minimumTotal = SHELL_PANE_MIN.detail + SHELL_PANE_MIN.queue;
      if (available < minimumTotal) return null;

      const saved = readShellLayout();
      const rail = Number.isFinite(Number(layout.rail)) ? Number(layout.rail) : saved?.rail || SHELL_PANE_MIN.rail;
      let detail = Number(layout.detail);
      if (!Number.isFinite(detail)) detail = saved?.detail || SHELL_PANE_MIN.detail;
      detail = clamp(detail, SHELL_PANE_MIN.detail, available - SHELL_PANE_MIN.queue);

      return { rail: Math.round(rail), detail: Math.round(detail), available };
    }

    function queueWidthForLayout(shell, layout) {
      const available = shellAvailableWidth(shell);
      const rail = state.sidebarCollapsed ? 0 : Number(layout.rail);
      const detail = Number(layout.detail);
      if (!Number.isFinite(detail)) return SHELL_PANE_MIN.queue;
      return available - (Number.isFinite(rail) ? rail : SHELL_PANE_MIN.rail) - detail;
    }

    function collapseTargetForLayout(side, layout) {
      const shell = shellElement();
      if (!shell || !isDesktopShellLayout()) return null;
      if (side === "left" && !state.sidebarCollapsed && Number(layout.rail) <= SHELL_COLLAPSE_THRESHOLD.rail) {
        return "sidebar";
      }
      if (side === "right" && !state.queueCollapsed && queueWidthForLayout(shell, layout) <= SHELL_COLLAPSE_THRESHOLD.queue) {
        return "queue";
      }
      return null;
    }

    function setShellCollapseTarget(target) {
      const shell = shellElement();
      if (!shell) return;
      shell.classList.toggle("rail-collapse-target", target === "sidebar");
      shell.classList.toggle("queue-collapse-target", target === "queue");
    }

    function normalizeQueueCollapsedShellLayout(shell, layout) {
      const available = shellAvailableWidth(shell);
      const minimumTotal = SHELL_PANE_MIN.rail + SHELL_PANE_MIN.detail;
      if (available < minimumTotal) return null;

      let rail = Number(layout.rail);
      if (!Number.isFinite(rail)) rail = SHELL_PANE_MIN.rail;
      rail = clamp(rail, SHELL_PANE_MIN.rail, available - SHELL_PANE_MIN.detail);
      const detail = available - rail;

      return { rail: Math.round(rail), detail: Math.round(detail), available };
    }

    function normalizeDetailOnlyShellLayout(shell, layout) {
      const available = shellAvailableWidth(shell);
      if (available < SHELL_PANE_MIN.detail) return null;

      const saved = readShellLayout();
      const rail = Number.isFinite(Number(layout.rail)) ? Number(layout.rail) : saved?.rail || SHELL_PANE_MIN.rail;
      const detail = Number.isFinite(Number(layout.detail)) ? Number(layout.detail) : saved?.detail || SHELL_PANE_MIN.detail;
      return { rail: Math.round(rail), detail: Math.round(detail), available };
    }

    function normalizeShellLayout(shell, layout) {
      const available = shellAvailableWidth(shell);
      const minimumTotal = SHELL_PANE_MIN.rail + SHELL_PANE_MIN.detail + SHELL_PANE_MIN.queue;
      if (available < minimumTotal) return null;

      let rail = Number(layout.rail);
      let detail = Number(layout.detail);
      if (!Number.isFinite(rail)) rail = SHELL_PANE_MIN.rail;
      if (!Number.isFinite(detail)) detail = SHELL_PANE_MIN.detail;

      rail = clamp(rail, SHELL_PANE_MIN.rail, available - SHELL_PANE_MIN.detail - SHELL_PANE_MIN.queue);
      detail = clamp(detail, SHELL_PANE_MIN.detail, available - rail - SHELL_PANE_MIN.queue);

      return { rail: Math.round(rail), detail: Math.round(detail), available };
    }

    function syncShellSplitterValues(layout) {
      const left = document.querySelector("[data-splitter='left']");
      const right = document.querySelector("[data-splitter='right']");
      if (left) {
        left.setAttribute("aria-hidden", String(state.sidebarCollapsed));
        left.setAttribute("aria-valuemin", String(SHELL_PANE_MIN.rail));
        left.setAttribute("aria-valuenow", String(Math.round(layout.rail)));
        left.tabIndex = state.sidebarCollapsed ? -1 : 0;
      }
      if (right) {
        right.setAttribute("aria-hidden", String(state.queueCollapsed));
        right.setAttribute("aria-valuemin", String(SHELL_PANE_MIN.detail));
        right.setAttribute("aria-valuenow", String(Math.round(layout.detail)));
        right.tabIndex = state.queueCollapsed ? -1 : 0;
      }
    }

    function applyShellLayout(layout, persist = false) {
      const shell = shellElement();
      if (!shell) return null;
      if (!isDesktopShellLayout()) {
        shell.classList.remove("rail-collapsed");
        shell.classList.remove("queue-collapsed");
        clearShellPeek();
        shell.style.gridTemplateColumns = "";
        return null;
      }
      shell.classList.toggle("rail-collapsed", state.sidebarCollapsed);
      shell.classList.toggle("queue-collapsed", state.queueCollapsed);
      if (state.sidebarCollapsed && state.queueCollapsed) {
        const detailOnly = normalizeDetailOnlyShellLayout(shell, layout);
        if (!detailOnly) {
          shell.style.gridTemplateColumns = "";
          return null;
        }
        shell.style.gridTemplateColumns = "minmax(" + SHELL_PANE_MIN.detail + "px, 1fr)";
        syncShellSplitterValues(detailOnly);
        if (persist) writeShellLayout(detailOnly);
        return detailOnly;
      }
      if (state.sidebarCollapsed) {
        const collapsed = normalizeSidebarCollapsedShellLayout(shell, layout);
        if (!collapsed) {
          shell.style.gridTemplateColumns = "";
          return null;
        }
        shell.style.gridTemplateColumns = collapsed.detail + "px " + SHELL_SPLITTER_WIDTH + "px minmax(" + SHELL_PANE_MIN.queue + "px, 1fr)";
        syncShellSplitterValues(collapsed);
        if (persist) writeShellLayout(collapsed);
        return collapsed;
      }
      if (state.queueCollapsed) {
        const collapsed = normalizeQueueCollapsedShellLayout(shell, layout);
        if (!collapsed) {
          shell.style.gridTemplateColumns = "";
          return null;
        }
        shell.style.gridTemplateColumns = collapsed.rail + "px " + SHELL_SPLITTER_WIDTH + "px minmax(" + SHELL_PANE_MIN.detail + "px, 1fr)";
        syncShellSplitterValues(collapsed);
        if (persist) writeShellLayout(collapsed);
        return collapsed;
      }
      const normalized = normalizeShellLayout(shell, layout);
      if (!normalized) {
        shell.style.gridTemplateColumns = "";
        return null;
      }
      shell.style.gridTemplateColumns = normalized.rail + "px " + SHELL_SPLITTER_WIDTH + "px " + normalized.detail + "px " + SHELL_SPLITTER_WIDTH + "px minmax(" + SHELL_PANE_MIN.queue + "px, 1fr)";
      syncShellSplitterValues(normalized);
      if (persist) writeShellLayout(normalized);
      return normalized;
    }

    function applySavedShellLayout() {
      const shell = shellElement();
      if (!shell) return;
      if (!isDesktopShellLayout()) {
        shell.classList.remove("rail-collapsed");
        shell.classList.remove("queue-collapsed");
        clearShellPeek();
        shell.style.gridTemplateColumns = "";
        renderSidebarToggle();
        return;
      }
      shell.classList.toggle("rail-collapsed", state.sidebarCollapsed);
      shell.classList.toggle("queue-collapsed", state.queueCollapsed);
      const saved = readShellLayout();
      if (saved) {
        applyShellLayout(saved);
      } else {
        shell.style.gridTemplateColumns = "";
        syncShellSplitterValues(currentShellLayout());
      }
      renderSidebarToggle();
    }

    function resetShellLayout() {
      const shell = shellElement();
      try {
        localStorage.removeItem(SHELL_LAYOUT_KEY);
      } catch (_error) {}
      if (shell) shell.style.gridTemplateColumns = "";
      syncShellSplitterValues(currentShellLayout());
    }

    function setSidebarCollapsed(collapsed) {
      state.sidebarCollapsed = Boolean(collapsed);
      try {
        localStorage.setItem(SHELL_SIDEBAR_KEY, state.sidebarCollapsed ? "true" : "false");
      } catch (_error) {}
      if (!state.sidebarCollapsed) setShellPeek("rail", false);
      applySavedShellLayout();
      renderSidebarToggle();
    }

    function setQueueCollapsed(collapsed) {
      state.queueCollapsed = Boolean(collapsed);
      try {
        localStorage.setItem(SHELL_QUEUE_KEY, state.queueCollapsed ? "true" : "false");
      } catch (_error) {}
      if (!state.queueCollapsed) setShellPeek("queue", false);
      applySavedShellLayout();
      renderSidebarToggle();
    }

    function renderSidebarToggle() {
      const button = el("sidebar-toggle");
      const queueButton = el("queue-toggle");
      const desktop = isDesktopShellLayout();
      if (button) {
        const effectiveCollapsed = state.sidebarCollapsed && desktop;
        const label = t(effectiveCollapsed ? "action.showSidebar" : "action.hideSidebar");
        button.classList.toggle("active", effectiveCollapsed);
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-pressed", String(effectiveCollapsed));
        button.title = label;
      }
      if (queueButton) {
        const effectiveCollapsed = state.queueCollapsed && desktop;
        const label = t(effectiveCollapsed ? "action.showQueue" : "action.hideQueue");
        queueButton.classList.toggle("active", effectiveCollapsed);
        queueButton.setAttribute("aria-label", label);
        queueButton.setAttribute("aria-pressed", String(effectiveCollapsed));
        queueButton.title = label;
      }
    }

    function nextShellLayout(side, start, delta) {
      if (side === "left") {
        return { rail: start.rail + delta, detail: start.detail - delta };
      }
      return { rail: start.rail, detail: start.detail + delta };
    }

    function nudgeShellLayout(side, delta) {
      applyShellLayout(nextShellLayout(side, currentShellLayout(), delta), true);
    }

    function setShellPeek(side, active) {
      const shell = shellElement();
      if (!shell) return;
      const enabled = Boolean(active) && isDesktopShellLayout();
      if (side === "rail") shell.classList.toggle("rail-peeking", enabled && state.sidebarCollapsed);
      if (side === "queue") shell.classList.toggle("queue-peeking", enabled && state.queueCollapsed);
    }

    function clearShellPeek() {
      const shell = shellElement();
      if (!shell) return;
      shell.classList.remove("rail-peeking");
      shell.classList.remove("queue-peeking");
    }

    function updateShellPeekFromPointer(event) {
      const shell = shellElement();
      if (!shell || !isDesktopShellLayout()) {
        clearShellPeek();
        return;
      }
      const rect = shell.getBoundingClientRect();
      const insideY = event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!insideY) {
        clearShellPeek();
        return;
      }
      if (state.sidebarCollapsed) {
        const leftDistance = event.clientX - rect.left;
        const leftLimit = shell.classList.contains("rail-peeking") ? SHELL_PEEK_WIDTH.rail : SHELL_REVEAL_EDGE_WIDTH;
        setShellPeek("rail", leftDistance >= 0 && leftDistance <= leftLimit);
      } else {
        setShellPeek("rail", false);
      }
      if (state.queueCollapsed) {
        const rightDistance = rect.right - event.clientX;
        const rightLimit = shell.classList.contains("queue-peeking") ? SHELL_PEEK_WIDTH.queue : SHELL_REVEAL_EDGE_WIDTH;
        setShellPeek("queue", rightDistance >= 0 && rightDistance <= rightLimit);
      } else {
        setShellPeek("queue", false);
      }
    }

    function initShellResizers() {
      const splitters = document.querySelectorAll("[data-splitter]");
      if (!splitters.length) return;
      applySavedShellLayout();

      splitters.forEach((splitter) => {
        splitter.addEventListener("pointerdown", (event) => {
          if (!isDesktopShellLayout()) return;
          if (splitter.dataset.splitter === "left" && state.sidebarCollapsed) return;
          if (splitter.dataset.splitter === "right" && state.queueCollapsed) return;
          event.preventDefault();
          const side = splitter.dataset.splitter;
          const start = currentShellLayout();
          const startX = event.clientX;
          let lastDelta = 0;

          splitter.classList.add("dragging");
          document.body.classList.add("resizing-panes");
          if (splitter.setPointerCapture) splitter.setPointerCapture(event.pointerId);

          const onMove = (moveEvent) => {
            lastDelta = moveEvent.clientX - startX;
            const requested = nextShellLayout(side, start, lastDelta);
            setShellCollapseTarget(collapseTargetForLayout(side, requested));
            applyShellLayout(requested);
          };

          const stop = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", stop);
            window.removeEventListener("pointercancel", stop);
            splitter.classList.remove("dragging");
            document.body.classList.remove("resizing-panes");
            const requested = nextShellLayout(side, start, lastDelta);
            const collapseTarget = collapseTargetForLayout(side, requested);
            setShellCollapseTarget(null);
            if (collapseTarget === "sidebar") {
              setSidebarCollapsed(true);
            } else if (collapseTarget === "queue") {
              setQueueCollapsed(true);
            } else {
              applyShellLayout(currentShellLayout(), true);
            }
          };

          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", stop);
          window.addEventListener("pointercancel", stop);
        });

        splitter.addEventListener("keydown", (event) => {
          if (!isDesktopShellLayout() || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
          if (splitter.dataset.splitter === "left" && state.sidebarCollapsed) return;
          if (splitter.dataset.splitter === "right" && state.queueCollapsed) return;
          event.preventDefault();
          const step = event.shiftKey ? 48 : 16;
          nudgeShellLayout(splitter.dataset.splitter, event.key === "ArrowRight" ? step : -step);
        });

        splitter.addEventListener("dblclick", resetShellLayout);
      });

      let resizeFrame = 0;
      window.addEventListener("resize", () => {
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = 0;
          applySavedShellLayout();
          renderSidebarToggle();
        });
      });
      window.addEventListener("mousemove", updateShellPeekFromPointer);
      document.addEventListener("mouseleave", clearShellPeek);
    }
`;
