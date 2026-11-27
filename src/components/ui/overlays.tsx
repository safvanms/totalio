"use client";

/**
 * Overlay primitives: Dialog (bottom-sheet style on phones), Sheet (side
 * drawer), AlertDialog, Popover, Tooltip, DropdownMenu. All content is
 * clamped to the viewport so nothing overflows small screens.
 */
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertPrimitive from "@radix-ui/react-alert-dialog";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

/* Dialog -------------------------------------------------------------- */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlayCls =
  "fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { size?: "sm" | "md" | "lg" | "xl"; hideClose?: boolean }
>(({ className, children, size = "md", hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={overlayCls} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Mobile: bottom sheet. sm+: centred modal.
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8 duration-200",
        "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(88dvh,860px)] sm:w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-bottom-2",
        size === "sm" && "sm:max-w-md",
        size === "md" && "sm:max-w-lg",
        size === "lg" && "sm:max-w-2xl",
        size === "xl" && "sm:max-w-4xl",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden" aria-hidden />
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "absolute right-3 top-3 text-muted-foreground")}
        >
          <X />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex shrink-0 flex-col gap-1 px-5 pb-3 pt-4 pr-14 sm:px-6 sm:pt-6", className)} {...props} />;
}

/** Scrollable body between header and footer. */
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-2 sm:px-6", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "safe-bottom flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/30 px-5 pt-4 sm:flex-row sm:justify-end sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold tracking-tight", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

/* Sheet (side drawer) ------------------------------------------------- */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogTitle;
export const SheetDescription = DialogDescription;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "left" | "right" }
>(({ className, children, side = "right", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={overlayCls} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 z-50 flex h-full w-[min(100vw-3rem,420px)] flex-col bg-card shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out duration-300",
        side === "left"
          ? "left-0 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
          : "right-0 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:w-[min(100vw-3rem,480px)]",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "absolute right-3 top-3 text-muted-foreground")}
      >
        <X />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

/* AlertDialog --------------------------------------------------------- */

export const AlertDialog = AlertPrimitive.Root;
export const AlertDialogTrigger = AlertPrimitive.Trigger;

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertPrimitive.Portal>
    <AlertPrimitive.Overlay className={overlayCls} />
    <AlertPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border bg-card p-5 shadow-2xl sm:p-6",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200",
        className,
      )}
      {...props}
    />
  </AlertPrimitive.Portal>
));
AlertDialogContent.displayName = "AlertDialogContent";

export const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
AlertDialogTitle.displayName = "AlertDialogTitle";

export const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

export const AlertDialogCancel = AlertPrimitive.Cancel;
export const AlertDialogAction = AlertPrimitive.Action;

/* Popover ------------------------------------------------------------- */

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 6, collisionPadding = 12, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "z-50 max-h-[var(--radix-popover-content-available-height)] max-w-[calc(100vw-1.5rem)] overflow-auto rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = "PopoverContent";

/* Tooltip ------------------------------------------------------------- */

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        "z-50 max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md animate-in fade-in-0 zoom-in-95",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

/** Convenience wrapper. */
export function Hint({ label, children, side }: { label: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

/* DropdownMenu -------------------------------------------------------- */

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuSub = MenuPrimitive.Sub;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={12}
      className={cn(
        "z-50 min-w-[11rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-xl",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </MenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

const itemCls =
  "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 sm:py-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <MenuPrimitive.Item
    ref={ref}
    className={cn(itemCls, destructive && "text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive", className)}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <MenuPrimitive.CheckboxItem ref={ref} className={cn(itemCls, "pl-8", className)} checked={checked} {...props}>
    <span className="absolute left-2.5 flex h-4 w-4 items-center justify-center">
      <MenuPrimitive.ItemIndicator>
        <Check className="!text-primary" />
      </MenuPrimitive.ItemIndicator>
    </span>
    {children}
  </MenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

export const DropdownMenuLabel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-2.5 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />
);

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>
>(({ className, ...props }, ref) => <MenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.SubTrigger>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.SubTrigger ref={ref} className={cn(itemCls, "data-[state=open]:bg-accent", className)} {...props}>
    {children}
    <ChevronRight className="ml-auto" />
  </MenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

export const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.SubContent
      ref={ref}
      collisionPadding={12}
      className={cn("z-50 min-w-[10rem] overflow-hidden rounded-xl border bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95", className)}
      {...props}
    />
  </MenuPrimitive.Portal>
));
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";
