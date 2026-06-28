import logoAsset from "@/assets/qualixa-logo.png.asset.json";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 44 }: LogoProps) {
  return (
    <img
      src={logoAsset.url}
      alt="Qualixa"
      width={size}
      height={size}
      className={cn("object-contain select-none", className)}
      style={{ width: size, height: size, background: "transparent" }}
      draggable={false}
    />
  );
}

