import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/90",
  secondary: "bg-transparent text-ink border border-border hover:border-ink/40",
  ghost: "bg-transparent text-muted hover:text-ink",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
