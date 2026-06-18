'use strict';

// Shared bilingual (EN / 中) toggle used across all pages.
// The initial <html> class is set by an inline head script to avoid a flash;
// this file wires the toggle buttons and keeps input placeholders in sync.
(function () {
  var KEY = "site-lang";

  function current() {
    return document.documentElement.classList.contains("lang-zh") ? "zh" : "en";
  }

  function apply(lang) {
    var el = document.documentElement;
    el.classList.remove("lang-en", "lang-zh");
    el.classList.add("lang-" + lang);
    el.setAttribute("lang", lang === "zh" ? "zh-Hant" : "en");
    try { localStorage.setItem(KEY, lang); } catch (e) { /* ignore */ }

    document.querySelectorAll("[data-ph-en]").forEach(function (input) {
      var ph = lang === "zh" ? input.getAttribute("data-ph-zh") : input.getAttribute("data-ph-en");
      if (ph != null) input.setAttribute("placeholder", ph);
    });

    document.dispatchEvent(new CustomEvent("languagechange", { detail: { lang: lang } }));
  }

  document.querySelectorAll("[data-lang-set]").forEach(function (btn) {
    btn.addEventListener("click", function () { apply(btn.getAttribute("data-lang-set")); });
  });

  // Sync placeholders / dispatch event for the language chosen by the head script.
  apply(current());
})();
