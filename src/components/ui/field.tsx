import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-[10px] border border-line-strong bg-card px-3 text-[14px] text-ink",
        "placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-[10px] border border-line-strong bg-card px-3 py-2.5 text-[14px] leading-relaxed text-ink",
        "placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none resize-y min-h-[88px]",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("text-[13px] font-medium text-ink", className)} {...props}>
      {children}
    </label>
  );
}

export function MonoLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("label-mono", className)}>{children}</span>;
}

export function Hint({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("text-[12.5px] leading-relaxed text-ink-muted", className)}>{children}</p>;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-[12.5px] text-danger">
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  error,
  optional,
  htmlFor,
  children,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optional?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <div className="flex items-baseline gap-2">
          <Label htmlFor={htmlFor}>{label}</Label>
          {optional && <span className="text-[11.5px] text-ink-faint">opcional</span>}
        </div>
      )}
      {children}
      {hint && !error && <Hint>{hint}</Hint>}
      <FieldError>{error}</FieldError>
    </div>
  );
}
