export function PageHeader({
  title,
  support,
  meta,
}: {
  title: React.ReactNode;
  support?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header-copy">
        <h1>{title}</h1>
        {support && <p>{support}</p>}
      </div>
      {meta && <div className="page-header-meta">{meta}</div>}
    </div>
  );
}
