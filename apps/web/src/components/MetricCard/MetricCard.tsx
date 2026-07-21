type MetricCardProps = {
  title: string
  value: string
  description: string
}

function MetricCard({ title, value, description }: MetricCardProps) {
  return (
    <div className="metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </div>
  )
}

export default MetricCard