export function DrawCheck({ show, size = 14 }: { show: boolean; size?: number }) {
  return (
    <svg
      className={`draw-check ${show ? "is-visible" : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path className="draw-check-path" d="M4 12.5L9.5 18L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
