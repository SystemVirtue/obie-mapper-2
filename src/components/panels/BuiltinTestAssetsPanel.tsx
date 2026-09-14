import { TestTube2 } from "lucide-react";
import { getBuiltinTestAssets } from "@/lib/builtin-test-assets";
import type { MediaAsset } from "@/lib/projection-types";

interface Props {
  onAddAsset: (asset: Omit<MediaAsset, "id">) => void;
}

export default function BuiltinTestAssetsPanel({ onAddAsset }: Props) {
  const addPack = () => {
    for (const asset of getBuiltinTestAssets()) onAddAsset(asset);
  };

  return (
    <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
        <TestTube2 className="size-3" /> Built-in source tests
      </div>
      <p className="mb-2 text-[10px] leading-snug text-muted-foreground">
        Adds 3 Butterchurn-style, 3 MilkDrop-style, 3 transparent GIF and 3 short WebM assets. No upload required.
      </p>
      <button
        type="button"
        onClick={addPack}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-2 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20"
      >
        <TestTube2 className="size-3.5" /> Add test asset pack (12)
      </button>
    </div>
  );
}
