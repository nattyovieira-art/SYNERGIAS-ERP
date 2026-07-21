import type { Compra } from '../types/Compra'

const CHAVE_COMPRAS = 'synergias_erp_compras'
const CHAVE_ULT_NSU_DFE = 'synergias_erp_compras_dfe_ult_nsu'

export function listarComprasStorage(): Compra[] {
  try {
    const dados = localStorage.getItem(CHAVE_COMPRAS)

    if (!dados) return []

    const compras = JSON.parse(dados) as Compra[]

    return Array.isArray(compras) ? compras : []
  } catch {
    return []
  }
}

export function buscarCompraStorage(id: string): Compra | undefined {
  return listarComprasStorage().find((compra) => compra.id === id)
}

export function salvarCompraStorage(compra: Compra): void {
  const compras = listarComprasStorage()
  const indice = compras.findIndex((item) => item.id === compra.id)

  if (indice >= 0) {
    compras[indice] = compra
  } else {
    compras.unshift(compra)
  }

  localStorage.setItem(CHAVE_COMPRAS, JSON.stringify(compras))
}

export function excluirCompraStorage(id: string): void {
  const compras = listarComprasStorage().filter((compra) => compra.id !== id)

  localStorage.setItem(CHAVE_COMPRAS, JSON.stringify(compras))
}

export function gerarNumeroCompraStorage(): string {
  const compras = listarComprasStorage()

  const maiorNumero = compras.reduce((maior, compra) => {
    const numero = Number(String(compra.numeroCompra || '').replace(/\D/g, ''))

    return Number.isFinite(numero) && numero > maior ? numero : maior
  }, 1446)

  return String(maiorNumero + 1).padStart(6, '0')
}

export function obterUltNSUDFeStorage(): string {
  return localStorage.getItem(CHAVE_ULT_NSU_DFE) || '000000000000000'
}

export function salvarUltNSUDFeStorage(ultNSU: string): void {
  localStorage.setItem(
    CHAVE_ULT_NSU_DFE,
    String(ultNSU || '0').replace(/\D/g, '').padStart(15, '0').slice(-15),
  )
}

export function importarComprasDFeStorage(
  comprasImportadas: Compra[],
): {
  importadas: number
  duplicadas: number
} {
  const comprasAtuais = listarComprasStorage()

  const chavesExistentes = new Set(
    comprasAtuais
      .map((compra) => compra.chaveAcessoNFe)
      .filter(Boolean),
  )

  const idsExistentes = new Set(comprasAtuais.map((compra) => compra.id))

  let importadas = 0
  let duplicadas = 0

  for (const compraRecebida of comprasImportadas) {
    const duplicada =
      (compraRecebida.chaveAcessoNFe &&
        chavesExistentes.has(compraRecebida.chaveAcessoNFe)) ||
      idsExistentes.has(compraRecebida.id)

    if (duplicada) {
      duplicadas += 1
      continue
    }

    const compraSegura: Compra = {
      ...compraRecebida,
      origem: 'SEFAZ_DFE',

      // Toda NF-e importada entra neutra.
      // Natália decide manualmente por compra se movimentará estoque.
      importacaoHistorica: false,
      movimentarEstoque: false,
      movimentouEstoque: false,

      itens: compraRecebida.itens.map((item) => {
        const unidadeFiscal = item.unidadeFiscal || item.unidade || 'UN'
        const quantidadeFiscal =
          Number(item.quantidadeFiscal ?? item.quantidade ?? 0)
        const custoUnitarioFiscal =
          Number(item.custoUnitarioFiscal ?? item.custoUnitario ?? 0)
        const totalFiscal =
          Number(item.totalFiscal ?? item.total ?? 0)

        return {
          ...item,
          unidadeFiscal,
          quantidadeFiscal,
          custoUnitarioFiscal,
          totalFiscal,
          unidadeControle: item.unidadeControle || unidadeFiscal,
          fatorConversao: Number(item.fatorConversao || 1),
          quantidadeConvertida:
            Number(item.quantidadeConvertida) || quantidadeFiscal,
          custoUnitarioConvertido:
            Number(item.custoUnitarioConvertido) || custoUnitarioFiscal,
        }
      }),

      atualizadoEm: new Date().toISOString(),
    }

    comprasAtuais.unshift(compraSegura)

    if (compraSegura.chaveAcessoNFe) {
      chavesExistentes.add(compraSegura.chaveAcessoNFe)
    }

    idsExistentes.add(compraSegura.id)
    importadas += 1
  }

  localStorage.setItem(CHAVE_COMPRAS, JSON.stringify(comprasAtuais))

  return {
    importadas,
    duplicadas,
  }
}

// Compatibilidade com a versão anterior do módulo.
export const importarComprasHistoricasStorage = importarComprasDFeStorage
