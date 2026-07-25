import heroLogo from "@/assets/fut-cajazeiras-escudo.png.asset.json";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-24 w-24",
  xl: "h-40 w-40",
};

export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  return (
    <img
      src={heroLogo.url}
      alt="Escudo do Fut Cajazeiras"
      className={cn("object-contain drop-shadow-[0_0_25px_rgba(217,167,86,0.25)]", sizes[size], className)}
      loading="eager"
    />
  );
}
