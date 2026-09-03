import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ select
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Selecione",
  className,
  id,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: { value: string; label: string; hint?: string }[];
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-[10px] border border-line-strong bg-card px-3 text-[14px] text-ink",
          "transition-colors focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:bg-sunken",
          "data-[placeholder]:text-ink-faint",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="ml-auto">
          <ChevronDown className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[12px] border border-line-strong bg-surface shadow-pop"
        >
          <SelectPrimitive.Viewport className="scroll-slim max-h-72 overflow-y-auto p-1.5">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-sunken"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                {option.hint && <span className="text-[11.5px] text-ink-faint">{option.hint}</span>}
                <SelectPrimitive.ItemIndicator className="ml-auto">
                  <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

// ------------------------------------------------------------------ switch
export function Switch({
  checked,
  onCheckedChange,
  id,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border border-transparent transition-colors",
        "data-[state=checked]:bg-ink data-[state=unchecked]:bg-line-contrast disabled:opacity-45",
      )}
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-surface shadow-raise transition-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}

// ---------------------------------------------------------------- checkbox
export function Checkbox({
  checked,
  onCheckedChange,
  id,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-line-contrast bg-card transition-colors",
        "data-[state=checked]:border-ink data-[state=checked]:bg-ink disabled:opacity-45",
      )}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="h-3 w-3 text-surface" aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

// -------------------------------------------------------------------- tabs
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.List className={cn("flex items-center gap-1 border-b border-line-soft", className)}>
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "-mb-px border-b-2 border-transparent px-3 py-2.5 text-[13px] text-ink-muted transition-colors",
        "hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink",
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Content value={value} className={cn("focus:outline-none", className)}>
      {children}
    </TabsPrimitive.Content>
  );
}

// --------------------------------------------------------------- tag input
export function TagInput({
  value,
  onChange,
  placeholder = "Digite e pressione Enter",
  id,
  max = 60,
  tone = "neutral",
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  id?: string;
  max?: number;
  tone?: "neutral" | "danger";
}) {
  const [draft, setDraft] = React.useState("");

  const add = () => {
    const clean = draft.trim();
    if (!clean || value.includes(clean) || value.length >= max) {
      setDraft("");
      return;
    }
    onChange([...value, clean]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-line-strong bg-card p-2 focus-within:border-accent">
        {value.map((tag) => (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px]",
              tone === "danger" ? "bg-danger-soft text-danger" : "bg-sunken text-ink-2",
            )}
          >
            {tag}
            <button
              type="button"
              aria-label={`Remover ${tag}`}
              onClick={() => onChange(value.filter((item) => item !== tag))}
              className="text-ink-faint transition-colors hover:text-ink"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add();
            }
            if (event.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={add}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[140px] flex-1 bg-transparent px-1.5 py-1 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>
    </div>
  );
}
