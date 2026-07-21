type Serie = {
  nome: string
  valores: number[]
}

type ChartCardProps = {
  titulo: string
  subtitulo: string
  labels: string[]
  series: Serie[]
  formato?: 'moeda' | 'numero'
  compacto?: boolean
}

function formatarValor(valor: number, formato: 'moeda' | 'numero') {
  if (formato === 'moeda') {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    })
  }

  return valor.toLocaleString('pt-BR')
}

function ChartCard({ titulo, subtitulo, labels, series, formato = 'numero', compacto = false }: ChartCardProps) {
  const largura = 820
  const altura = compacto ? 220 : 300
  const margem = { topo: 18, direita: 18, baixo: 42, esquerda: 58 }
  const larguraUtil = largura - margem.esquerda - margem.direita
  const alturaUtil = altura - margem.topo - margem.baixo
  const todos = series.flatMap((serie) => serie.valores)
  const maximo = Math.max(...todos, 1)
  const passoX = labels.length > 1 ? larguraUtil / (labels.length - 1) : larguraUtil

  const pontos = (valores: number[]) =>
    valores
      .map((valor, indice) => {
        const x = margem.esquerda + indice * passoX
        const y = margem.topo + alturaUtil - (valor / maximo) * alturaUtil
        return `${x},${y}`
      })
      .join(' ')

  const graduacoes = [0, 0.25, 0.5, 0.75, 1]

  return (
    <article className="panel dashboard-chart-card">
      <div className="panel-header chart-card-header">
        <div>
          <h2>{titulo}</h2>
          <span>{subtitulo}</span>
        </div>

        <div className="chart-legend">
          {series.map((serie, indice) => (
            <span key={serie.nome}>
              <i className={`chart-dot chart-dot-${indice + 1}`} />
              {serie.nome}
            </span>
          ))}
        </div>
      </div>

      <div className="chart-wrap">
        <svg className="real-chart" viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={titulo}>
          {graduacoes.map((fracao) => {
            const y = margem.topo + alturaUtil - fracao * alturaUtil
            return (
              <g key={fracao}>
                <line className="chart-grid-line" x1={margem.esquerda} x2={largura - margem.direita} y1={y} y2={y} />
                <text className="chart-axis-label" x={4} y={y + 4}>
                  {formatarValor(maximo * fracao, formato)}
                </text>
              </g>
            )
          })}

          {series.map((serie, indice) => (
            <polyline key={serie.nome} className={`chart-series chart-series-${indice + 1}`} points={pontos(serie.valores)} />
          ))}

          {series.map((serie, serieIndice) =>
            serie.valores.map((valor, indice) => {
              const x = margem.esquerda + indice * passoX
              const y = margem.topo + alturaUtil - (valor / maximo) * alturaUtil
              return (
                <circle key={`${serie.nome}-${indice}`} className={`chart-point chart-point-${serieIndice + 1}`} cx={x} cy={y} r={4.5}>
                  <title>{`${serie.nome} · ${labels[indice]}: ${formatarValor(valor, formato)}`}</title>
                </circle>
              )
            }),
          )}

          {labels.map((label, indice) => {
            const x = margem.esquerda + indice * passoX
            return (
              <text key={`${label}-${indice}`} className="chart-axis-label chart-month-label" x={x} y={altura - 12} textAnchor="middle">
                {label}
              </text>
            )
          })}
        </svg>
      </div>
    </article>
  )
}

export default ChartCard
