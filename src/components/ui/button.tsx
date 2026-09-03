import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 select-none",
  {
    variants: {
      variant: {
        /* ação principal: tinta sólida que vira terracota no hover (protótipo) */
        solid: "bg-ink text-surface hover:bg-accent font-medium",
        outline: "border border-line text-ink bg-transparent hover:border-line-contrast",
        quiet: "text-ink-muted hover:bg-sunken hover:text-ink",
        ghost: "text-ink-muted hover:text-ink",
        chip: "border border-line text-ink-2 bg-transparent hover:border-accent hover:text-ink rounded-full",
        danger: "bg-danger text-surface hover:opacity-90 font-medium",
        link: "text-accent underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-[30px] px-3 text-[12.5px] rounded-[8px]",
        md: "h-9 px-4 text-[13.5px] rounded-[10px]",
        lg: "h-11 px-5 text-[14.5px] rounded-[11px]",
        icon: "h-7 w-7 rounded-[7px]",
        iconLg: "h-9 w-9 rounded-[9px]",
      },
    },
    defaultVariants: { variant: "solid", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
