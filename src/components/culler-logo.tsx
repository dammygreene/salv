import Image from "next/image";

export function CullerLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/culler-logo-on-dark.svg"
      alt="Culler"
      width={116}
      height={46}
      className={className}
      priority
    />
  );
}
