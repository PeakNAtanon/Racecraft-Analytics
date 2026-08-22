import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-race-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-race-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-race-red text-white hover:bg-race-red/90",
        outline: "border border-race-line bg-transparent text-race-text hover:bg-race-elevated",
        secondary: "bg-race-elevated text-race-text hover:bg-race-line",
        ghost: "text-race-muted hover:bg-race-elevated hover:text-race-text",
        link: "h-auto min-h-0 px-0 py-0 text-race-cyan underline-offset-4 hover:underline",
      },
      size: {
        default: "",
        sm: "min-h-9 rounded-md px-3 text-xs",
        lg: "min-h-12 rounded-lg px-6 text-base",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
