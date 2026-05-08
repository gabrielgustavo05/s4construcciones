export default function PageHeader({ title, subtitle, eyebrow, actions, live = false }) {
  return (
    <header className="ph page-header-shell">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="page-header-actions">
        {live && <span className="live-pill"><span /> En vivo</span>}
        {actions}
      </div>
    </header>
  );
}
