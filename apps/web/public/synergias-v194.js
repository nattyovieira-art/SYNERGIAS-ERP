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
    const s = window.getComputedStyle(el);
    return s.display !== "none" &&
      s.visibility !== "hidden" &&
      el.getClientRects().length > 0;
  }

  function contemContextoPedido(el) {
    let atual = el;
    for (let i = 0; i < 8 && atual; i += 1) {
      const texto = normalizar(atual.textContent);
      if (
        texto.indexOf("N PEDIDO") >= 0 &&
        texto.indexOf("ORIGEM ORCAMENTO") >= 0 &&
        texto.indexOf("VENDEDOR") >= 0
      ) {
        return true;
      }
      atual = atual.parentElement;
    }
    return false;
  }

  function localizarWrapper(el) {
    let atual = el.parentElement;
    for (let i = 0; i < 5 && atual; i += 1) {
      if (!atual.parentElement) break;
      const rect = atual.getBoundingClientRect();
      if (rect.width >= 150) return atual;
      atual = atual.parentElement;
    }
    return el.parentElement || el;
  }

  function aplicarBotaoGrande() {
    const candidatos = Array.from(document.querySelectorAll("button, a, div, span"));

    candidatos.forEach((el) => {
      if (!visivel(el)) return;

      const texto = normalizar(el.textContent);
      if (!["ENTREGUE", "ENTREGAR", "CONCLUIDO", "CONCLUÍDO"].includes(texto)) return;
      if (!contemContextoPedido(el)) return;

      el.classList.add("synergias-v194-acao-botao");
      el.setAttribute("data-status", texto);

      const wrapper = localizarWrapper(el);
      if (wrapper) {
        wrapper.classList.add("synergias-v194-acao-coluna");
      }
    });
  }

  function aplicar() {
    aplicarBotaoGrande();
  }

  let agendado = false;
  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => {
      agendado = false;
      aplicar();
    });
  }

  document.addEventListener("DOMContentLoaded", aplicar);
  window.addEventListener("load", aplicar);

  new MutationObserver(agendar).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  setInterval(aplicar, 1200);
})();