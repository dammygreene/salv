import { AssetStatus } from "@/lib/types";
import { assetStatusLabel } from "@/lib/data";

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <i />
      {assetStatusLabel[status]}
    </span>
  );
}
