<?php
/* SYNERGIAS_CONSOLIDADO_V178 */
/* SYNERGIAS_DANFE_V177_FRETE_CODBARRAS */
declare(strict_types=1);

define('SYNERGIAS_AUTH_BOOTSTRAP', true);
require dirname(__DIR__) . '/bootstrap.php';
exigirAutenticacao();

$chave = preg_replace('/\D+/', '', (string)($_GET['chave'] ?? '')) ?: '';
if (!preg_match('/^\d{44}$/', $chave)) {
    http_response_code(400);
    exit('Chave inválida.');
}

$home = rtrim((string)(getenv('HOME') ?: ''), '/\\');
if ($home === '' || !is_dir($home)) {
    $home = dirname(rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\'));
}

$arquivoXml = $home . '/synergias_private/fiscal-nfe/' . $chave . '-procNFe.xml';
if (!is_file($arquivoXml)) {
    http_response_code(404);
    exit('XML autorizado não encontrado.');
}

$doc = new DOMDocument('1.0', 'UTF-8');
$doc->preserveWhiteSpace = false;
if (!@$doc->load($arquivoXml, LIBXML_NONET | LIBXML_NOBLANKS)) {
    http_response_code(500);
    exit('XML autorizado inválido.');
}

$xp = new DOMXPath($doc);
$esc = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$q = static function (DOMXPath $xp, string $expr, ?DOMNode $ctx = null): string {
    $lista = $xp->query($expr, $ctx);
    return $lista && $lista->length ? trim((string)$lista->item(0)?->textContent) : '';
};
$money = static function (string $v): string {
    return number_format((float)str_replace(',', '.', $v ?: '0'), 2, ',', '.');
};
$num = static function (string $v, int $casas = 3): string {
    return number_format((float)str_replace(',', '.', $v ?: '0'), $casas, ',', '.');
};
$dataBr = static function (string $iso, bool $hora = false): string {
    if ($iso === '') return '';
    try {
        $d = new DateTimeImmutable($iso);
        return $d->format($hora ? 'd/m/Y H:i:s' : 'd/m/Y');
    } catch (Throwable) {
        return $iso;
    }
};
$docFmt = static function (string $v): string {
    $d = preg_replace('/\D+/', '', $v) ?: '';
    if (strlen($d) === 14) return substr($d,0,2).'.'.substr($d,2,3).'.'.substr($d,5,3).'/'.substr($d,8,4).'-'.substr($d,12,2);
    if (strlen($d) === 11) return substr($d,0,3).'.'.substr($d,3,3).'.'.substr($d,6,3).'-'.substr($d,9,2);
    return $v;
};
$cepFmt = static function (string $v): string {
    $d = preg_replace('/\D+/', '', $v) ?: '';
    return strlen($d) === 8 ? substr($d,0,5).'-'.substr($d,5,3) : $v;
};

$nfe = $xp->query('//*[local-name()="NFe"]')->item(0);
$inf = $xp->query('//*[local-name()="infNFe"]')->item(0);
$emit = $xp->query('//*[local-name()="emit"]')->item(0);
$dest = $xp->query('//*[local-name()="dest"]')->item(0);
$enderEmit = $xp->query('//*[local-name()="enderEmit"]')->item(0);
$enderDest = $xp->query('//*[local-name()="enderDest"]')->item(0);
$tot = $xp->query('//*[local-name()="ICMSTot"]')->item(0);
$transp = $xp->query('//*[local-name()="transp"]')->item(0);
$vol = $xp->query('//*[local-name()="vol"]')->item(0);
$prot = $xp->query('//*[local-name()="protNFe"]')->item(0);

$nNF = $q($xp, './/*[local-name()="nNF"]', $inf);
$serie = $q($xp, './/*[local-name()="serie"]', $inf);
$dhEmi = $q($xp, './/*[local-name()="dhEmi"]', $inf);
$natOp = $q($xp, './/*[local-name()="natOp"]', $inf);
$tpNF = $q($xp, './/*[local-name()="tpNF"]', $inf);
$tpAmb = $q($xp, './/*[local-name()="tpAmb"]', $inf);
$protocolo = $q($xp, './/*[local-name()="nProt"]', $prot);
$dhRecbto = $q($xp, './/*[local-name()="dhRecbto"]', $prot);

$emitCnpj = $q($xp, './/*[local-name()="CNPJ"]', $emit);
$emitNome = $q($xp, './/*[local-name()="xNome"]', $emit);
$emitFant = $q($xp, './/*[local-name()="xFant"]', $emit);
$emitIE = $q($xp, './/*[local-name()="IE"]', $emit);
$emitIM = $q($xp, './/*[local-name()="IM"]', $emit);
$emitEndereco = trim(implode(', ', array_filter([
    $q($xp, './/*[local-name()="xLgr"]', $enderEmit),
    $q($xp, './/*[local-name()="nro"]', $enderEmit),
    $q($xp, './/*[local-name()="xCpl"]', $enderEmit),
])));
$emitCidade = trim(implode(' - ', array_filter([
    $q($xp, './/*[local-name()="xBairro"]', $enderEmit),
    $q($xp, './/*[local-name()="xMun"]', $enderEmit),
    $q($xp, './/*[local-name()="UF"]', $enderEmit),
])));
$emitCep = $cepFmt($q($xp, './/*[local-name()="CEP"]', $enderEmit));
$emitFone = '51.98264.2434';

$destDoc = $q($xp, './/*[local-name()="CNPJ"]', $dest) ?: $q($xp, './/*[local-name()="CPF"]', $dest);
$destNome = $q($xp, './/*[local-name()="xNome"]', $dest);
$destIE = $q($xp, './/*[local-name()="IE"]', $dest);
$destEndereco = trim(implode(', ', array_filter([
    $q($xp, './/*[local-name()="xLgr"]', $enderDest),
    $q($xp, './/*[local-name()="nro"]', $enderDest),
    $q($xp, './/*[local-name()="xCpl"]', $enderDest),
])));
$destBairro = $q($xp, './/*[local-name()="xBairro"]', $enderDest);
$destCidade = $q($xp, './/*[local-name()="xMun"]', $enderDest);
$destUF = $q($xp, './/*[local-name()="UF"]', $enderDest);
$destCep = $cepFmt($q($xp, './/*[local-name()="CEP"]', $enderDest));
$destFone = $q($xp, './/*[local-name()="fone"]', $enderDest);

$modFrete = $q($xp, './/*[local-name()="modFrete"]', $transp);
$transporta = $xp->query('.//*[local-name()="transporta"]', $transp)->item(0);
$transportaNome = $q($xp, './/*[local-name()="xNome"]', $transporta);
$transportaDoc = $q($xp, './/*[local-name()="CNPJ"]', $transporta) ?: $q($xp, './/*[local-name()="CPF"]', $transporta);
$transportaIE = $q($xp, './/*[local-name()="IE"]', $transporta);
$transportaEnd = $q($xp, './/*[local-name()="xEnder"]', $transporta);
$transportaMun = $q($xp, './/*[local-name()="xMun"]', $transporta);
$transportaUF = $q($xp, './/*[local-name()="UF"]', $transporta);

$freteDescricao = match ($modFrete) {
    '0' => '0 - Emitente',
    '1' => '1 - Destinatário',
    '2' => '2 - Terceiros',
    '3' => '3 - Próprio remetente',
    '4' => '4 - Próprio destinatário',
    '9' => '9 - Sem frete',
    default => $modFrete,
};

$logoData = '/logo-synergias.png';

$detalhes = $xp->query('//*[local-name()="det"]');
$duplicatas = $xp->query('//*[local-name()="dup"]');
$infCpl = $q($xp, '//*[local-name()="infAdic"]/*[local-name()="infCpl"]');

// NF-es antigas podem ter sido autorizadas sem <cobr>/<dup>. Nesse caso,
// recupera a fatura do pedido persistido no servidor, sem alterar o XML autorizado.
$faturaFallback = [];
if (!$duplicatas || $duplicatas->length === 0) {
    $numeroPedido = '';
    if (preg_match('/Pedido\s*:\s*(\d+)/i', $infCpl, $mPedido)) $numeroPedido = $mPedido[1];
    if ($numeroPedido !== '') {
        try {
            $pdoDanfe = obterPdo();
            $stmtDanfe = $pdoDanfe->prepare('SELECT payload FROM erp_storage WHERE collection = :collection LIMIT 1');
            $stmtDanfe->execute(['collection' => 'vendas']);
            $registroDanfe = $stmtDanfe->fetch();
            $vendasDanfe = $registroDanfe ? json_decode((string)$registroDanfe['payload'], true) : [];
            if (is_array($vendasDanfe)) {
                foreach ($vendasDanfe as $vendaDanfe) {
                    if (!is_array($vendaDanfe)) continue;
                    $numeroVenda = preg_replace('/\D+/', '', (string)($vendaDanfe['numeroPedido'] ?? $vendaDanfe['numero'] ?? '')) ?: '';
                    if ($numeroVenda !== $numeroPedido) continue;
                    $parcelasDanfe = is_array($vendaDanfe['parcelas'] ?? null) ? $vendaDanfe['parcelas'] : [];
                    foreach ($parcelasDanfe as $idxDanfe => $parcelaDanfe) {
                        if (!is_array($parcelaDanfe)) continue;
                        $valorDanfe = (float)($parcelaDanfe['valor'] ?? 0);
                        $vencDanfe = trim((string)($parcelaDanfe['vencimento'] ?? $parcelaDanfe['dataVencimento'] ?? ''));
                        if ($valorDanfe <= 0 || $vencDanfe === '') continue;
                        $faturaFallback[] = [
                            'numero' => str_pad((string)($parcelaDanfe['numero'] ?? ($idxDanfe + 1)), 3, '0', STR_PAD_LEFT),
                            'vencimento' => $vencDanfe,
                            'valor' => $valorDanfe,
                            'banco' => trim((string)($parcelaDanfe['bancoCobranca'] ?? $vendaDanfe['bancoCobranca'] ?? '')),
                        ];
                    }
                    break;
                }
            }
        } catch (Throwable $erroFatura) {
            error_log('[DANFE FATURA] '.$erroFatura->getMessage());
        }
    }
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DANFE NF-e <?= $esc($nNF) ?></title>
<?php /* SYNERGIAS_DANFE_HEADER_VERSION = "V163" */ ?>
<style>
@page{size:A4 portrait;margin:6mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}
body{font-size:7.8px}
.actions{max-width:200mm;margin:8px auto;display:flex;gap:8px}
.actions button{padding:8px 12px;border:1px solid #777;border-radius:6px;background:#fff;font-weight:700;cursor:pointer}
.danfe{width:198mm;margin:0 auto}
.box{border:1px solid #000}
.row{display:flex;width:100%}
.cell{border-right:1px solid #000;border-bottom:1px solid #000;padding:2.5px 4px;min-height:9mm;overflow:hidden}
.row>.cell:last-child{border-right:0}
.row:last-child>.cell{border-bottom:0}
.label{font-size:6.1px;text-transform:uppercase;line-height:1.2}
.value{font-size:8.7px;line-height:1.25;margin-top:1.5px}
.value.big{font-size:10.5px;font-weight:700}
.center{text-align:center}.right{text-align:right}.bold{font-weight:700}
.receipt{height:20mm;margin-bottom:1mm}
.receipt .topline{height:6mm;padding:1.5px 3px;border-bottom:1px solid #000;font-size:5.7px}
.receipt .sign{width:83%}.receipt .number{width:17%;text-align:center;font-size:10px;padding-top:2mm}
.dashed{border-top:1px dashed #000;margin:.7mm 0 1mm}
.header{height:34mm}
.logo-cell{width:11%;display:flex;align-items:center;justify-content:center;padding:1.1mm .8mm;border-right:1px solid #000;overflow:hidden}
.logo-cell img{display:block;width:18.5mm;height:18.5mm;max-width:18.5mm;max-height:18.5mm;object-fit:contain;border:0;outline:0;box-shadow:none;background:transparent}
.emit-cell{width:31%;text-align:left;padding:2.6mm 2.2mm 1.5mm;font-size:7.4px;line-height:1.42;display:flex;flex-direction:column;justify-content:flex-start;gap:.7mm}
.danfe-cell{width:19%;text-align:center;padding:1.8mm 1.2mm 1mm}
.control-cell{width:39%;padding:0}
.title-danfe{font-size:16px;font-weight:700;line-height:1.08;margin-bottom:1.3mm}
.emit-company{font-size:11.6px;font-weight:700;line-height:1.18;margin-top:.2mm;margin-bottom:.6mm}
.emit-address{font-size:7.6px;line-height:1.36}
.emit-address + .emit-address{margin-top:.35mm}
.danfe-doc-subtitle{margin-top:1.2mm;line-height:1.18;font-size:7px}
.danfe-entry-exit{margin-top:1.4mm;text-align:left;padding-left:2mm;line-height:1.25}
.danfe-number-box{margin-top:1.2mm;line-height:1.2}
.barcode-wrap{height:9mm;padding:.5mm 2mm .3mm;border-bottom:1px solid #000}
#barcode{width:100%;height:7.5mm;display:block}
.key{padding:.6mm 1.5mm;border-bottom:1px solid #000;text-align:center;font-size:8px;letter-spacing:.15px}
.portal{padding:.8mm 1.5mm;text-align:center;font-size:5.5px;line-height:1.1}
.section-title{font-size:6px;margin-top:1.4mm;text-transform:uppercase}
.grid-table{width:100%;border-collapse:collapse;table-layout:fixed}
.grid-table th,.grid-table td{border:1px solid #000;padding:1px 2px;vertical-align:top}
.grid-table th{font-size:5.3px;font-weight:400;text-transform:uppercase;background:#fff}
.grid-table td{font-size:6.8px;line-height:1.15}
.items th{font-size:5.5px;text-align:center;white-space:nowrap}
.items td{height:5.3mm;vertical-align:middle}
.items .desc{font-size:6.8px}
.items-space{display:none}
.tax td{font-size:8px;text-align:right;height:6mm;vertical-align:bottom;padding:0 .7mm .5mm}
.tax th{font-size:5px;text-align:left;height:2.8mm;padding:.25mm .5mm}
.additional{display:flex;min-height:22mm}
.additional>div{padding:2px 3px;border-right:1px solid #000}
.additional>div:last-child{border-right:0}
.watermark{position:fixed;inset:42% 0 auto;text-align:center;transform:rotate(-28deg);font-size:42px;font-weight:700;color:rgba(0,0,0,.07);pointer-events:none;z-index:0}
.content{position:relative;z-index:1}
@media print{.actions{display:none}.danfe{width:198mm}.watermark{display:block}.grid-table thead{display:table-header-group}.grid-table tr{break-inside:avoid;page-break-inside:avoid}.section-title{break-after:avoid;page-break-after:avoid}.additional{break-inside:avoid;page-break-inside:avoid}}
.fatura-table th,.fatura-table td{border:1px solid #777;padding:1.2mm;font-size:7px}.fatura-table td{font-size:8.5px;font-weight:700}
</style>
</head>
<body>
<div class="actions"><button onclick="window.print()">Imprimir / Salvar em PDF</button><button onclick="window.close()">Fechar</button></div>
<?php if ($tpAmb === '2'): ?><div class="watermark">SEM VALOR FISCAL - HOMOLOGAÇÃO</div><?php endif; ?>
<div class="danfe content">
  <div class="box receipt">
    <div class="topline">RECEBEMOS DE <?= $esc($emitNome) ?> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO</div>
    <div class="row" style="height:14mm">
      <div class="cell sign" style="width:17%"><div class="label">Data de recebimento</div></div>
      <div class="cell sign" style="width:66%"><div class="label">Identificação e assinatura do recebedor</div></div>
      <div class="cell number"><div class="bold">NF-e</div><div>Nº <?= $esc($nNF) ?></div><div>Série <?= $esc($serie) ?></div></div>
    </div>
  </div>
  <div class="dashed"></div>

  <div class="box header row">
    <div class="cell logo-cell"><img src="<?= $esc($logoData) ?>" alt="Logo Synergias"></div>
    <div class="cell emit-cell">
      <div class="emit-company"><?= $esc($emitNome) ?></div>
      <div class="emit-address"><?= $esc($emitEndereco) ?></div>
      <div class="emit-address"><?= $esc($emitCidade) ?><?= $emitCep ? ' - '.$esc($emitCep) : '' ?></div>
      <?php if ($emitFone !== ''): ?><div class="emit-address">Fone: <?= $esc($emitFone) ?></div><?php endif; ?>
    </div>
    <div class="cell danfe-cell">
      <div class="title-danfe">DANFE</div>
      <div class="danfe-doc-subtitle">DOCUMENTO AUXILIAR<br>DA NOTA FISCAL ELETRÔNICA</div>
      <div class="danfe-entry-exit">0 - ENTRADA<br>1 - SAÍDA <span style="float:right;border:1px solid #000;padding:1.5mm 2mm;font-size:9px"><?= $esc($tpNF) ?></span></div>
      <div class="danfe-number-box">Nº <?= $esc($nNF) ?><br>SÉRIE: <?= $esc($serie) ?><br>PÁGINA 1 DE 1</div>
    </div>
    <div class="cell control-cell">
      <div class="label" style="padding:1mm 2mm 0">Controle do Fisco</div>
      <div class="barcode-wrap"><svg id="barcode" aria-label="Código de barras da chave de acesso"></svg></div>
      <div class="label" style="padding:1mm 2mm 0">Chave de acesso</div>
      <div class="key"><?= $esc($chave) ?></div>
      <div class="portal">Consulta de autenticidade no portal nacional da NF-e<br>www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizada.</div>
    </div>
  </div>

  <div class="box" style="border-top:0">
    <div class="row">
      <div class="cell" style="width:53%"><div class="label">Natureza da operação</div><div class="value"><?= $esc($natOp) ?></div></div>
      <div class="cell" style="width:47%"><div class="label">Protocolo de autorização de uso</div><div class="value"><?= $esc($protocolo) ?><?= $dhRecbto ? ' - '.$esc($dataBr($dhRecbto, true)) : '' ?></div></div>
    </div>
    <div class="row">
      <div class="cell" style="width:27%"><div class="label">Inscrição estadual</div><div class="value"><?= $esc($emitIE) ?></div></div>
      <div class="cell" style="width:37%"><div class="label">Inscrição estadual do subst. trib.</div><div class="value"></div></div>
      <div class="cell" style="width:36%"><div class="label">CNPJ</div><div class="value"><?= $esc($docFmt($emitCnpj)) ?></div></div>
    </div>
  </div>

  <div class="section-title">Destinatário/Remetente</div>
  <div class="box">
    <div class="row">
      <div class="cell" style="width:65%"><div class="label">Nome/Razão social</div><div class="value big"><?= $esc($destNome) ?></div></div>
      <div class="cell" style="width:22%"><div class="label">CNPJ/CPF</div><div class="value big"><?= $esc($docFmt($destDoc)) ?></div></div>
      <div class="cell" style="width:13%"><div class="label">Data de emissão</div><div class="value big"><?= $esc($dataBr($dhEmi)) ?></div></div>
    </div>
    <div class="row">
      <div class="cell" style="width:41%"><div class="label">Endereço</div><div class="value big"><?= $esc($destEndereco) ?></div></div>
      <div class="cell" style="width:25%"><div class="label">Bairro/Distrito</div><div class="value big"><?= $esc($destBairro) ?></div></div>
      <div class="cell" style="width:21%"><div class="label">CEP</div><div class="value big"><?= $esc($destCep) ?></div></div>
      <div class="cell" style="width:13%"><div class="label">Data de entrada/saída</div><div class="value big"><?= $esc($dataBr($dhEmi)) ?></div></div>
    </div>
    <div class="row">
      <div class="cell" style="width:25%"><div class="label">Município</div><div class="value big"><?= $esc($destCidade) ?></div></div>
      <div class="cell" style="width:19%"><div class="label">Fone/Fax</div><div class="value"><?= $esc($destFone) ?></div></div>
      <div class="cell" style="width:15%"><div class="label">UF</div><div class="value big"><?= $esc($destUF) ?></div></div>
      <div class="cell" style="width:28%"><div class="label">Inscrição estadual</div><div class="value"><?= $esc($destIE) ?></div></div>
      <div class="cell" style="width:13%"><div class="label">Hora entrada/saída</div><div class="value"><?= $esc($dataBr($dhEmi, true)) ?></div></div>
    </div>
  </div>

  <div class="section-title">Fatura</div>
  <table class="grid-table" data-ajuste="SYNERGIAS_DANFE_FATURA_TABELA_V263">
    <thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead>
    <tbody>
    <?php if ($duplicatas && $duplicatas->length): ?>
      <?php foreach ($duplicatas as $dup): ?>
        <tr><td><?= $esc(str_pad($q($xp, './/*[local-name()="nDup"]', $dup), 3, '0', STR_PAD_LEFT)) ?></td><td><?= $esc($dataBr($q($xp, './/*[local-name()="dVenc"]', $dup))) ?></td><td>R$ <?= $esc($money($q($xp, './/*[local-name()="vDup"]', $dup))) ?></td></tr>
      <?php endforeach; ?>
    <?php elseif ($faturaFallback): ?>
      <?php foreach ($faturaFallback as $fat): ?>
        <tr><td><?= $esc($fat['numero']) ?></td><td><?= $esc($dataBr($fat['vencimento'])) ?></td><td>R$ <?= $esc($money((string)$fat['valor'])) ?></td></tr>
      <?php endforeach; ?>
    <?php else: ?>
      <tr><td colspan="3">Pagamento conforme pedido</td></tr>
    <?php endif; ?>
    </tbody>
  </table>

  <div class="section-title">Cálculo do imposto</div>
  <table class="grid-table tax">
    <tr>
      <th>Base de cálc. do ICMS</th><th>Valor do ICMS</th><th>Base de cálc. do ICMS ST</th><th>Valor do ICMS ST</th><th>V. Imp. importação</th><th>V. ICMS UF remet.</th><th>Valor do FCP</th><th>Valor do PIS</th><th>V. total de produtos</th>
    </tr>
    <tr>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vBC"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vICMS"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vBCST"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vST"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vII"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vICMSUFRemet"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vFCP"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vPIS"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vProd"]',$tot))) ?></td>
    </tr>
    <tr>
      <th>Valor do frete</th><th>Valor do seguro</th><th>Desconto</th><th>Outras despesas</th><th>Valor do IPI</th><th>V. ICMS UF dest.</th><th>V. aprox. tributos</th><th>Valor da COFINS</th><th>V. total da nota</th>
    </tr>
    <tr>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vFrete"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vSeg"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vDesc"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vOutro"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vIPI"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vICMSUFDest"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'//*[local-name()="vTotTrib"]'))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vCOFINS"]',$tot))) ?></td>
      <td><?= $esc($money($q($xp,'.//*[local-name()="vNF"]',$tot))) ?></td>
    </tr>
  </table>

  <div class="section-title">Transportador/Volumes transportados</div>
  <div class="box">
    <div class="row">
      <div class="cell" style="width:37%"><div class="label">Razão social</div><div class="value"><?= $esc($transportaNome) ?></div></div>
      <div class="cell" style="width:18%"><div class="label">Frete por conta</div><div class="value"><?= $esc($freteDescricao) ?></div></div>
      <div class="cell" style="width:10%"><div class="label">Código ANTT</div><div class="value"><?= $esc($q($xp,'//*[local-name()="RNTC"]')) ?></div></div>
      <div class="cell" style="width:14%"><div class="label">Placa</div><div class="value"><?= $esc($q($xp,'//*[local-name()="placa"]')) ?></div></div>
      <div class="cell" style="width:6%"><div class="label">UF</div><div class="value"><?= $esc($q($xp,'//*[local-name()="veicTransp"]/*[local-name()="UF"]')) ?></div></div>
      <div class="cell" style="width:15%"><div class="label">CNPJ/CPF</div><div class="value"><?= $esc($docFmt($transportaDoc)) ?></div></div>
    </div>
    <div class="row">
      <div class="cell" style="width:37%"><div class="label">Endereço</div><div class="value"><?= $esc($transportaEnd) ?></div></div>
      <div class="cell" style="width:18%"><div class="label">Município</div><div class="value"><?= $esc($transportaMun) ?></div></div>
      <div class="cell" style="width:10%"><div class="label">UF</div><div class="value"><?= $esc($transportaUF) ?></div></div>
      <div class="cell" style="width:35%"><div class="label">Inscrição estadual</div><div class="value"><?= $esc($transportaIE) ?></div></div>
    </div>
    <div class="row">
      <div class="cell" style="width:13%"><div class="label">Quantidade</div><div class="value"><?= $esc($q($xp,'.//*[local-name()="qVol"]',$vol)) ?></div></div>
      <div class="cell" style="width:18%"><div class="label">Espécie</div><div class="value"><?= $esc($q($xp,'.//*[local-name()="esp"]',$vol)) ?></div></div>
      <div class="cell" style="width:18%"><div class="label">Marca</div><div class="value"><?= $esc($q($xp,'.//*[local-name()="marca"]',$vol)) ?></div></div>
      <div class="cell" style="width:18%"><div class="label">Numeração</div><div class="value"><?= $esc($q($xp,'.//*[local-name()="nVol"]',$vol)) ?></div></div>
      <div class="cell" style="width:17%"><div class="label">Peso bruto</div><div class="value"><?= $esc($q($xp,'.//*[local-name()="pesoB"]',$vol)) ?></div></div>
      <div class="cell" style="width:16%"><div class="label">Peso líquido</div><div class="value"><?= $esc($q($xp,'.//*[local-name()="pesoL"]',$vol)) ?></div></div>
    </div>
  </div>

  <div class="section-title">Dados do produto/serviço</div>
  <table class="grid-table items">
    <colgroup><col style="width:9%"><col style="width:38%"><col style="width:7%"><col style="width:4%"><col style="width:4%"><col style="width:3%"><col style="width:5%"><col style="width:6%"><col style="width:7%"><col style="width:5%"><col style="width:5%"><col style="width:4%"><col style="width:3%"></colgroup>
    <thead><tr><th>Código de barras</th><th>Descrição do produto/serviço</th><th>NCM/SH</th><th>CST</th><th>CFOP</th><th>UN</th><th>Qtd.</th><th>Vlr. unit.</th><th>Vlr. total</th><th>BC ICMS</th><th>Vlr. ICMS</th><th>Alíq. ICMS</th><th>Alíq. IPI</th></tr></thead>
    <tbody>
    <?php if ($detalhes): foreach ($detalhes as $det):
      $prod = $xp->query('.//*[local-name()="prod"]', $det)->item(0);
      $imposto = $xp->query('.//*[local-name()="imposto"]', $det)->item(0);
      $orig = $q($xp,'.//*[local-name()="orig"]',$imposto);
      $cst = $q($xp,'.//*[local-name()="CSOSN"]',$imposto) ?: $q($xp,'.//*[local-name()="CST"]',$imposto);
      $cstExibe = $orig . $cst;
    ?>
      <tr>
        <?php
          $codigoBarrasDanfe = $q($xp,'.//*[local-name()="cEAN"]',$prod);
          if ($codigoBarrasDanfe === '' || strtoupper($codigoBarrasDanfe) === 'SEM GTIN') {
            $codigoBarrasDanfe = $q($xp,'.//*[local-name()="cEANTrib"]',$prod);
          }
          if ($codigoBarrasDanfe === '' || strtoupper($codigoBarrasDanfe) === 'SEM GTIN') {
            $codigoBarrasDanfe = '-';
          }
        ?>
        <td><?= $esc($codigoBarrasDanfe) ?></td>
        <td class="desc"><?= $esc($q($xp,'.//*[local-name()="xProd"]',$prod)) ?></td>
        <td><?= $esc($q($xp,'.//*[local-name()="NCM"]',$prod)) ?></td>
        <td><?= $esc($cstExibe) ?></td>
        <td><?= $esc($q($xp,'.//*[local-name()="CFOP"]',$prod)) ?></td>
        <td><?= $esc($q($xp,'.//*[local-name()="uCom"]',$prod)) ?></td>
        <td class="right"><?= $esc($num($q($xp,'.//*[local-name()="qCom"]',$prod),3)) ?></td>
        <td class="right"><?= $esc($money($q($xp,'.//*[local-name()="vUnCom"]',$prod))) ?></td>
        <td class="right"><?= $esc($money($q($xp,'.//*[local-name()="vProd"]',$prod))) ?></td>
        <td class="right"><?= $esc($money($q($xp,'.//*[local-name()="vBC"]',$imposto))) ?></td>
        <td class="right"><?= $esc($money($q($xp,'.//*[local-name()="vICMS"]',$imposto))) ?></td>
        <td class="right"><?= $esc($money($q($xp,'.//*[local-name()="pICMS"]',$imposto))) ?></td>
        <td class="right"><?= $esc($money($q($xp,'.//*[local-name()="pIPI"]',$imposto))) ?></td>
      </tr>
    <?php endforeach; endif; ?>
    </tbody>
  </table>
  <div class="items-space"></div>

  <div class="section-title">Cálculo do ISSQN</div>
  <table class="grid-table"><tr><th>Inscrição municipal</th><th>Valor total dos serviços</th><th>Base de cálculo do ISSQN</th><th>Valor do ISSQN</th></tr><tr><td><?= $esc($emitIM) ?></td><td class="right">0,00</td><td class="right">0,00</td><td class="right">0,00</td></tr></table>

  <div class="section-title">Dados adicionais</div>
  <div class="box additional"><div style="width:53%"><div class="label">Informações complementares</div><div class="value" style="font-size:6px"><?= nl2br($esc($infCpl)) ?></div></div><div style="width:47%"><div class="label">Reservado ao Fisco</div></div></div>
</div>
<script>
(function(){
  const digits = <?= json_encode($chave, JSON_UNESCAPED_SLASHES) ?>;
  const patterns = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];
  if (!/^\d{44}$/.test(digits)) return;
  const codes=[105]; for(let i=0;i<digits.length;i+=2) codes.push(Number(digits.slice(i,i+2)));
  let sum=105; for(let i=1;i<codes.length;i++) sum+=codes[i]*i; codes.push(sum%103,106);
  let x=0; const scale=1.25, h=40; const ns='http://www.w3.org/2000/svg'; const svg=document.getElementById('barcode');
  codes.forEach(c=>{const p=patterns[c]; for(let i=0;i<p.length;i++){const w=Number(p[i])*scale; if(i%2===0){const r=document.createElementNS(ns,'rect'); r.setAttribute('x',String(x));r.setAttribute('y','0');r.setAttribute('width',String(w));r.setAttribute('height',String(h));r.setAttribute('fill','#000');svg.appendChild(r);} x+=w;}});
  svg.setAttribute('viewBox',`0 0 ${x} ${h}`); svg.setAttribute('preserveAspectRatio','none');
})();
</script>
</body>
</html>
