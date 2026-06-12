// @module platforms/dom — shadow DOM query helpers
  function isVisible(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function collectDeepRoots(root = document, roots = [], visited = new Set()) {
    if (!root || visited.has(root)) return roots;

    visited.add(root);
    roots.push(root);

    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) {
        collectDeepRoots(element.shadowRoot, roots, visited);
      }
    }

    return roots;
  }

  function queryAllDeep(selector, root = document) {
    const nodes = [];

    for (const scope of collectDeepRoots(root)) {
      nodes.push(...scope.querySelectorAll(selector));
    }

    return nodes;
  }

  function queryFirstDeep(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];

    for (const selector of list) {
      for (const scope of collectDeepRoots(document)) {
        const node = scope.querySelector(selector);
        if (node) return node;
      }
    }

    return null;
  }

  function queryVisibleFirstDeep(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];

    for (const selector of list) {
      for (const node of queryAllDeep(selector)) {
        if (isVisible(node)) return node;
      }
    }

    return null;
  }

  function queryFirst(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];

    for (const selector of list) {
      const node = document.querySelector(selector);
      if (node) return node;
    }

    return null;
  }

  function queryVisibleFirst(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];

    for (const selector of list) {
      for (const node of document.querySelectorAll(selector)) {
        if (isVisible(node)) return node;
      }
    }

    return null;
  }
