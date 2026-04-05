import { cn } from "@/lib/utils";

interface SmiLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function SmiLogo({ className, size = "md", showText = true }: SmiLogoProps) {
  const sizes = {
    sm: { icon: "h-6 w-6", text: "text-base" },
    md: { icon: "h-8 w-8", text: "text-lg" },
    lg: { icon: "h-12 w-12", text: "text-2xl" },
  };

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={sizes[size].icon}
      >
        <rect width="40" height="40" rx="10" className="fill-foreground" />
        <text
          x="20"
          y="22"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="16"
          className="fill-background"
          letterSpacing="-0.5"
        >
          SMI
        </text>
        {/* Price tag accent */}
        <rect
          x="26"
          y="6"
          width="8"
          height="8"
          rx="2"
          fill="#f97316"
          transform="rotate(15 30 10)"
        />
        <circle cx="30.5" cy="9" r="1.2" className="fill-foreground" />
      </svg>
      {showText && (
        <span className={cn("font-bold tracking-tight", sizes[size].text)}>
          Selling<span className="text-orange-500">My</span>Items
        </span>
      )}
    </span>
  );
}
