(function () {
  "use strict";

  function normalizar(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function visivel(el) {
    if (!(el instanceof HTMLElement)) return false;
    var s = window.getComputedStyle(el);
    return s.display !== "none" &&
      s.visibility !== "hidden" &&
      el.getClientRects().length > 0;
  }

  function aplicarConcluido() {
    document.querySelectorAll("button, span, strong, div").forEach(function (el) {
      if (!visivel(el)) return;
      if (normalizar(el.textContent) !== "CONCLUIDO") return;

      var p = el;
      var emLista = false;

      for (var i = 0; i < 8 && p; i += 1) {
        var t = normalizar(p.textContent);
        if (
          t.indexOf("PEDIDO EMITIDO") >= 0 ||
          t.indexOf("ENTREGA:") >= 0 ||
          t.indexOf("NF-E EMITIDA") >= 0
        ) {
          emLista = true;
          break;
        }
        p = p.parentElement;
      }

      if (emLista) {
        el.classList.add("synergias-v193-concluido");
      }
    });
  }

  function aplicarOrigem() {
    var todos = Array.from(document.querySelectorAll("label, div, span, strong, p, h1, h2, h3"));

    todos.forEach(function (rotulo) {
      if (!visivel(rotulo)) return;

      var texto = normalizar(rotulo.textContent);
      if (texto !== "ORIGEM ORCAMENTO") return;

      var container = rotulo.parentElement;
      if (!container) return;

      var candidatos = Array.from(
        container.querySelectorAll("button, a, div, span, strong, input")
      );

      var numero = candidatos.find(function (el) {
        if (!visivel(el) || el === rotulo) return false;

        var valor = el instanceof HTMLInputElement
          ? String(el.value || "").trim()
          : String(el.textContent || "").trim();

        return /^\d{3,8}$/.test(valor);
      });

      if (!numero && container.nextElementSibling) {
        var prox = container.nextElementSibling;
        var valorProx = String(prox.textContent || "").trim();
        if (/^\d{3,8}$/.test(valorProx)) numero = prox;
      }

      if (numero) {
        numero.classList.add("synergias-v193-origem");
      }
    });
  }

  function aplicar() {
    aplicarConcluido();
    aplicarOrigem();
  }

  var agendado = false;
  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(function () {
      agendado = false;
      aplicar();
    });
  }

  document.addEventListener("DOMContentLoaded", aplicar);
  window.addEventListener("load", aplicar);

  new MutationObserver(agendar).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  setInterval(aplicar, 1200);
})();