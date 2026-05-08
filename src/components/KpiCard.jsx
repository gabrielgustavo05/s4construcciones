export default function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
  meta,
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-card-top">
        <span className="kpi-label">{label}</span>
        {Icon && (
          <span className="kpi-icon">
            <Icon size={17} strokeWidth={1.9} />
          </span>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-footer">
        <span>{sub}</span>
        {meta && <strong>{meta}</strong>}
      </div>
    </article>
  );
}
