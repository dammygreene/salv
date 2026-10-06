export function StatModule({
  tone,
  label,
  value,
  unit,
  caption,
}: {
  tone: "recover" | "cull" | "watch" | "unknown";
  label: string;
  value: string;
  unit?: string;
  caption: string;
}) {
  return (
    <div className={`stat-module stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </strong>
      <i className="stat-caption">{caption}</i>
    </div>
  );
}
