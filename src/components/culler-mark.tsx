export function CullerMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="culler-mark"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--accent)" />
      <path d="M9 17.5L14 22.5L23 11" stroke="var(--text-on-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
