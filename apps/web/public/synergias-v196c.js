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
    const estilo = getComputedStyle(el);

    return (
      estilo.display !== "none" &&
      estilo.visibility !== "hidden" &&
      el.getClientRects().length > 0
    );
  }

  function css(el, propriedade, valor) {
    if (el instanceof HTMLElement) {
      el.style.setProperty(propriedade, valor, "important");
    }
  }

  function localizarRotulo(textos) {
    const alvos = textos.map(normalizar);

    return (
      Array.from(
        document.querySelectorAll(
          "label, span, strong, div, p, h1, h2, h3, h4"
        )
      ).find(
        (el) => visivel(el) && alvos.includes(normalizar(el.textContent))
      ) || null
    );
  }

  function localizarCampo(rotulo) {
    let atual = rotulo && rotulo.parentElement;

    for (let nivel = 0; nivel < 5 && atual; nivel += 1) {
      const candidatos = Array.from(
        atual.querySelectorAll(
          "input, select, button, a, [role='button']"
        )
      ).filter(visivel);

      const campo = candidatos.find((el) => {
        const r = el.getBoundingClientRect();
        return r.width >= 120 && r.height >= 40;
      });

      if (campo) return campo;
      atual = atual.parentElement;
    }

    return null;
  }

  function localizarPainelPedido(campoPedido) {
    let atual = campoPedido && campoPedido.parentElement;

    for (let nivel = 0; nivel < 9 && atual; nivel += 1) {
      const texto = normalizar(atual.textContent);

      if (
        texto.includes("PEDIDO") &&
        texto.includes("ORIGEM ORCAMENTO") &&
        texto.includes("VENDEDOR") &&
        texto.includes("STATUS")
      ) {
        return atual;
      }

      atual = atual.parentElement;
    }

    return null;
  }

  function localizarOrigem(rotuloOrigem) {
    let atual = rotuloOrigem && rotuloOrigem.parentElement;

    for (let nivel = 0; nivel < 5 && atual; nivel += 1) {
      const candidatos = Array.from(
        atual.querySelectorAll(
          "button, a, [role='button'], div, span, strong, input"
        )
      ).filter(visivel);

      const numero = candidatos.find((el) => {
        if (el === rotuloOrigem) return false;

        const valor =
          el instanceof HTMLInputElement
            ? String(el.value || "").trim()
            : String(el.textContent || "").trim();

        return /^\d{3,10}$/.test(valor);
      });

      if (numero) return numero;
      atual = atual.parentElement;
    }

    return null;
  }

  function localizarStatusTopo(painel) {
    if (!painel) return null;

    return (
      Array.from(
        painel.querySelectorAll(
          "button, a, [role='button'], div, span, strong"
        )
      )
        .filter(visivel)
        .find((el) =>
          ["ENTREGUE", "ENTREGAR", "CONCLUIDO", "ABERTO"].includes(
            normalizar(el.textContent)
          )
        ) || null
    );
  }

  function ajustarOrigem(campoPedido, origem) {
    if (!campoPedido || !origem) return;

    const r = campoPedido.getBoundingClientRect();
    const largura = Math.round(r.width);
    const altura = Math.round(r.height);

    for (const prop of ["width", "min-width", "max-width"]) {
      css(origem, prop, `${largura}px`);
    }

    for (const prop of ["height", "min-height", "max-height"]) {
      css(origem, prop, `${altura}px`);
    }

    css(origem, "padding", "0 18px");
    css(origem, "box-sizing", "border-box");
    css(origem, "display", "inline-flex");
    css(origem, "align-items", "center");
    css(origem, "justify-content", "center");
    css(origem, "border-radius", "14px");
    css(origem, "background", "#f97316");
    css(origem, "border", "2px solid #ea580c");
    css(origem, "color", "#ffffff");
    css(origem, "font-size", "22px");
    css(origem, "font-weight", "900");
    css(origem, "line-height", "1");
    css(origem, "box-shadow", "0 6px 14px rgba(249,115,22,.22)");
    css(origem, "margin", "0");
  }

  function ajustarStatusTopo(status, painel) {
    if (!status || !painel) return;

    const painelRect = painel.getBoundingClientRect();
    const altura = Math.max(190, Math.round(painelRect.height - 32));

    let coluna = status.parentElement;

    for (let nivel = 0; nivel < 5 && coluna && coluna !== painel; nivel += 1) {
      const r = coluna.getBoundingClientRect();

      if (r.width >= 170 && r.width <= 320) break;
      coluna = coluna.parentElement;
    }

    if (!(coluna instanceof HTMLElement) || coluna === painel) {
      coluna = status.parentElement;
    }

    const largura =
      coluna instanceof HTMLElement
        ? Math.max(200, Math.round(coluna.getBoundingClientRect().width))
        : 220;

    if (coluna instanceof HTMLElement) {
      for (const prop of ["width", "min-width", "max-width"]) {
        css(coluna, prop, `${largura}px`);
      }

      for (const prop of ["height", "min-height", "max-height"]) {
        css(coluna, prop, `${altura}px`);
      }

      css(coluna, "display", "flex");
      css(coluna, "align-items", "stretch");
      css(coluna, "justify-content", "stretch");
      css(coluna, "align-self", "stretch");
      css(coluna, "padding", "0");
    }

    css(status, "width", "100%");
    css(status, "min-width", "100%");
    css(status, "max-width", "100%");
    css(status, "height", "100%");
    css(status, "min-height", `${altura}px`);
    css(status, "max-height", `${altura}px`);
    css(status, "padding", "14px 18px");
    css(status, "box-sizing", "border-box");
    css(status, "display", "flex");
    css(status, "align-items", "center");
    css(status, "justify-content", "center");
    css(status, "text-align", "center");
    css(status, "border-radius", "0 0 95px 0");
    css(status, "background", "#2563eb");
    css(status, "border", "2px solid #1d4ed8");
    css(status, "color", "#ffffff");
    css(status, "font-size", "28px");
    css(status, "font-weight", "900");
    css(status, "line-height", "1.05");
    css(status, "box-shadow", "0 8px 18px rgba(37,99,235,.22)");
    css(status, "margin", "0");
  }

  function corrigirTopoPedido() {
    const rotuloPedido = localizarRotulo([
      "Nº Pedido",
      "N° Pedido",
      "N Pedido",
      "Nº do Pedido"
    ]);

    const campoPedido = localizarCampo(rotuloPedido);
    if (!campoPedido) return;

    const painel = localizarPainelPedido(campoPedido);
    if (!painel) return;

    const rotuloOrigem = localizarRotulo(["Origem Orçamento"]);
    const origem = localizarOrigem(rotuloOrigem);
    const status = localizarStatusTopo(painel);

    ajustarOrigem(campoPedido, origem);
    ajustarStatusTopo(status, painel);
  }

  function estaNaListaPedido(el) {
    let atual = el;

    for (let nivel = 0; nivel < 8 && atual; nivel += 1) {
      const texto = normalizar(atual.textContent);

      if (
        texto.includes("PEDIDO EMITIDO") ||
        texto.includes("NF-E EMITIDA") ||
        texto.includes("ENTREGA:")
      ) {
        return true;
      }

      atual = atual.parentElement;
    }

    return false;
  }

  function diminuirConcluidoLista() {
    const candidatos = Array.from(
      document.querySelectorAll(
        "button, a, [role='button'], div, span, strong"
      )
    ).filter(visivel);

    for (const el of candidatos) {
      if (normalizar(el.textContent) !== "CONCLUIDO") continue;
      if (!estaNaListaPedido(el)) continue;

      css(el, "width", "96px");
      css(el, "min-width", "96px");
      css(el, "max-width", "96px");
      css(el, "padding-left", "8px");
      css(el, "padding-right", "8px");
      css(el, "box-sizing", "border-box");
      css(el, "display", "inline-flex");
      css(el, "align-items", "center");
      css(el, "justify-content", "center");
      css(el, "white-space", "nowrap");
    }
  }

  function pontuarLinha(linha, indiceSituacao) {
    const celulas = Array.from(linha.querySelectorAll("td"));
    const situacao = normalizar(
      celulas[indiceSituacao] ? celulas[indiceSituacao].textContent : ""
    );

    let pontos = 0;

    if (situacao && situacao !== "-") pontos += 10;
    if (situacao === "ABERTO") pontos += 20;
    if (situacao === "CONCLUIDO") pontos += 30;
    if (situacao === "ENTREGUE") pontos += 40;

    return pontos;
  }

  function deduplicarTabela(tabela) {
    const cabecalhos = Array.from(tabela.querySelectorAll("thead th")).map(
      (th) => normalizar(th.textContent)
    );

    const indicePedido = cabecalhos.findIndex((h) => h === "PEDIDO");
    const indiceSituacao = cabecalhos.findIndex((h) => h === "SITUACAO");

    if (indicePedido < 0 || indiceSituacao < 0) return;

    const corpo = tabela.querySelector("tbody");
    if (!corpo) return;

    const linhas = Array.from(corpo.querySelectorAll("tr"));
    const porPedido = new Map();

    for (const linha of linhas) {
      const celulas = Array.from(linha.querySelectorAll("td"));

      if (celulas.length <= indicePedido) continue;

      const numero = String(
        celulas[indicePedido].textContent || ""
      ).trim();

      if (!numero) continue;

      const existente = porPedido.get(numero);

      if (!existente) {
        porPedido.set(numero, linha);
        continue;
      }

      const pontosNova = pontuarLinha(linha, indiceSituacao);
      const pontosExistente = pontuarLinha(existente, indiceSituacao);

      if (pontosNova >= pontosExistente) {
        existente.remove();
        porPedido.set(numero, linha);
      } else {
        linha.remove();
      }
    }

    tabela.setAttribute("data-synergias-v196c", "deduplicada");
  }

  function corrigirRelatorio() {
    const tabelas = Array.from(document.querySelectorAll("table")).filter(
      visivel
    );

    for (const tabela of tabelas) {
      const texto = normalizar(tabela.textContent);

      if (
        texto.includes("PEDIDO") &&
        texto.includes("EMISSAO") &&
        texto.includes("CLIENTE") &&
        texto.includes("VENDEDOR") &&
        texto.includes("SITUACAO") &&
        texto.includes("TOTAL")
      ) {
        deduplicarTabela(tabela);
      }
    }
  }

  function aplicarTudo() {
    corrigirTopoPedido();
    diminuirConcluidoLista();
    corrigirRelatorio();
  }

  let agendado = false;

  function agendar() {
    if (agendado) return;

    agendado = true;

    requestAnimationFrame(() => {
      agendado = false;
      aplicarTudo();
    });
  }

  document.addEventListener("DOMContentLoaded", aplicarTudo);
  window.addEventListener("load", aplicarTudo);

  new MutationObserver(agendar).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  setInterval(aplicarTudo, 900);
})();