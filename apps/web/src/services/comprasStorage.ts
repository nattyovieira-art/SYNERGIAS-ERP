import type { Compra } from '../types/Compra'
import {
  definirColecaoMemoria,
  obterColecaoMemoria,
  sincronizarColecaoCentral,
  sincronizarColecaoCentralAgora,
} from './erpApi'

const CHAVE_COMPRAS = 'synergias_erp_compras'
const CHAVE_ULT_NSU_DFE = 'synergias_erp_compras_dfe_ult_nsu'

export function listarComprasStorage(): Compra[] {
  const centrais = obterColecaoMemoria<Compra>('compras')
  if (centrais.length > 0) {
    const indice2431 = centrais.findIndex((compra: any) =>
      somenteDigitos(compra.numeroNFe) === '2431' ||
      somenteDigitos(compra.numeroCompra) === '001454',
    )
    const compra2431: any = indice2431 >= 0 ? centrais[indice2431] : undefined
    if (compra2431 && !compra2431.conversaoEmbalagensCorrigida) {
      const itens = (compra2431.itens || []).map((item: any) => {
        const identificacao = `${item.produtoCodigo || ''} ${item.codigoBarras || ''} ${item.descricao || ''}`
        const bobinaCaixa8 =
          /7901210137|(?:BOBINA\s+200\s+SACOS\s+30CMX40CM)/i.test(identificacao)
        const fator = bobinaCaixa8 ? 8 : Math.max(1, Number(item.fatorConversao || 1))
        const quantidadeFiscal = Number(item.quantidadeFiscal ?? item.quantidade ?? 0)
        const quantidadeConvertida = quantidadeFiscal * fator
        const custoFinalItem = Number(
          item.custoFinalItem ?? item.totalFiscal ?? item.total ?? 0,
        )
        return {
          ...item,
          fatorConversao: fator,
          quantidadeConvertida,
          custoUnitarioConvertido: quantidadeConvertida > 0
            ? custoFinalItem / quantidadeConvertida
            : 0,
        }
      })
      const corrigidas = centrais.map((compra, indice) => indice === indice2431
        ? {
            ...compra2431,
            itens,
            conversaoEmbalagensCorrigida: true,
            atualizadoEm: new Date().toISOString(),
          } as Compra
        : compra)
      definirColecaoMemoria('compras', corrigidas)
      localStorage.setItem(CHAVE_COMPRAS, JSON.stringify(corrigidas))
      sincronizarColecaoCentral('compras', corrigidas)
      return corrigidas
    }
    return centrais
  }
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

function somenteDigitos(valor: unknown): string {
  return String(valor || '').replace(/\D/g, '')
}

function identificadorNota(compra: Compra): string {
  const chave = somenteDigitos(compra.chaveAcessoNFe)
  if (chave.length === 44) return `CHAVE:${chave}`

  const numero = somenteDigitos(compra.numeroNFe)
  if (!numero) return ''
  const serie = somenteDigitos(compra.serieNFe)
  const emitente = somenteDigitos(compra.fornecedorDocumento)
  return `NOTA:${emitente}:${serie}:${numero}`
}

function mesmaNota(a: Compra, b: Compra): boolean {
  const chaveA = somenteDigitos(a.chaveAcessoNFe)
  const chaveB = somenteDigitos(b.chaveAcessoNFe)
  if (chaveA.length === 44 && chaveB.length === 44) return chaveA === chaveB

  const numeroA = somenteDigitos(a.numeroNFe)
  const numeroB = somenteDigitos(b.numeroNFe)
  if (!numeroA || !numeroB || numeroA !== numeroB) return false
  const serieA = somenteDigitos(a.serieNFe)
  const serieB = somenteDigitos(b.serieNFe)
  const emitenteA = somenteDigitos(a.fornecedorDocumento)
  const emitenteB = somenteDigitos(b.fornecedorDocumento)
  return serieA === serieB && emitenteA === emitenteB
}

export function encontrarCompraComNotaDuplicada(compra: Compra): Compra | undefined {
  const identificador = identificadorNota(compra)
  if (!identificador) return undefined
  return listarComprasStorage().find(
    (existente) => existente.id !== compra.id && mesmaNota(existente, compra),
  )
}

function persistirCompras(compras: Compra[]): void {
  definirColecaoMemoria('compras', compras)
  localStorage.setItem(CHAVE_COMPRAS, JSON.stringify(compras))
  sincronizarColecaoCentral('compras', compras)
}

export function salvarCompraStorage(compra: Compra): void {
  const compras = listarComprasStorage()
  const duplicada = encontrarCompraComNotaDuplicada(compra)
  if (duplicada) {
    throw new Error(`Nota fiscal já cadastrada na compra ${duplicada.numeroCompra}.`)
  }
  const indice = compras.findIndex((item) => item.id === compra.id)

  if (indice >= 0) {
    compras[indice] = compra
  } else {
    compras.unshift(compra)
  }

  persistirCompras(compras)
}

export async function salvarCompraStorageConfirmado(compra: Compra): Promise<void> {
  salvarCompraStorage(compra)
  await sincronizarColecaoCentralAgora('compras', listarComprasStorage())
}

export function excluirCompraStorage(id: string): void {
  const existente = buscarCompraStorage(id)
  if (existente?.movimentouEstoque) {
    throw new Error('Compra com estoque movimentado não pode ser excluída. Registre uma devolução ou estorno auditado.')
  }
  const compras = listarComprasStorage().filter((compra) => compra.id !== id)

  persistirCompras(compras)
}

export async function excluirCompraStorageConfirmado(id: string): Promise<void> {
  excluirCompraStorage(id)
  await sincronizarColecaoCentralAgora('compras', listarComprasStorage(), true)
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
  const notasExistentes = new Set(comprasAtuais.map(identificadorNota).filter(Boolean))

  let importadas = 0
  let duplicadas = 0

  for (const compraRecebida of comprasImportadas) {
    const duplicada =
      (compraRecebida.chaveAcessoNFe &&
        chavesExistentes.has(compraRecebida.chaveAcessoNFe)) ||
      (identificadorNota(compraRecebida) && notasExistentes.has(identificadorNota(compraRecebida))) ||
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
    const nota = identificadorNota(compraSegura)
    if (nota) notasExistentes.add(nota)
    importadas += 1
  }

  persistirCompras(comprasAtuais)

  return {
    importadas,
    duplicadas,
  }
}

// Compatibilidade com a versão anterior do módulo.
export const importarComprasHistoricasStorage = importarComprasDFeStorage
