import type { Compra } from '../types/Compra'
import { listarComprasStorage } from './comprasStorage'
import {
  gerarAnaliseFiscalCompra,
  listarAnalisesFiscaisStorage,
  type AnaliseFiscalCompra,
  type AnaliseFiscalItem,
} from './analiseFiscalStorage'

export type PendenciaRevisaoFiscal = {
  id: string
  compra: Compra
  analise: AnaliseFiscalCompra
  item: AnaliseFiscalItem
}

export function listarPendenciasRevisaoFiscal(): PendenciaRevisaoFiscal[] {
  const compras = listarComprasStorage()
  const analisesSalvas = listarAnalisesFiscaisStorage()

  const pendencias: PendenciaRevisaoFiscal[] = []

  for (const compra of compras) {
    const possuiDocumentoFiscal =
      Boolean(compra.numeroNFe) ||
      Boolean(compra.chaveAcessoNFe) ||
      Boolean(compra.xmlNFe) ||
      compra.origem === 'SEFAZ_DFE' ||
      compra.origem === 'XML_NFE'

    if (!possuiDocumentoFiscal) continue

    let analise = analisesSalvas.find(
      (item) => item.compraId === compra.id,
    )

    if (!analise || analise.itens.length === 0) {
      analise = gerarAnaliseFiscalCompra(compra)
    }

    for (const item of analise.itens) {
      if (item.classificacao !== 'REVISAO_FISCAL_NECESSARIA') continue

      pendencias.push({
        id: `${compra.id}::${item.itemId}`,
        compra,
        analise,
        item,
      })
    }
  }

  return pendencias.sort((a, b) =>
    String(b.compra.dataEmissao || '').localeCompare(
      String(a.compra.dataEmissao || ''),
    ),
  )
}
