import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Info,
  Mouse,
  Smartphone,
  Pen,
  Brush,
  Move,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";

type ControlRow = {
  action: string;
  icon: LucideIcon;
  desktop: string;
  phone: string;
  stylus: string;
};

const controls: ControlRow[] = [
  {
    action: "Draw",
    icon: Brush,
    desktop: "Left mouse button",
    phone: "Single finger",
    stylus: "Pen",
  },
  {
    action: "Pan",
    icon: Move,
    desktop: "Right mouse button",
    phone: "Two-finger swipe",
    stylus: "Two-finger swipe",
  },
  {
    action: "Zoom",
    icon: ZoomIn,
    desktop: "Mouse wheel",
    phone: "Two-finger pinch",
    stylus: "Two-finger pinch",
  },
];

const platforms = [
  { key: "desktop", label: "Desktop", icon: Mouse },
  { key: "phone", label: "Phone", icon: Smartphone },
  { key: "stylus", label: "Stylus", icon: Pen },
] as const;

export default function InputGuideDialog() {
  return (
    <div className="absolute right-0 top-0 z-10 m-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" className="gap-2">
            Controls
            <Info className="h-4 w-4" />
          </Button>
        </DialogTrigger>

        <DialogContent
          className="
            w-[calc(100vw-1rem)]
            max-w-[calc(100vw-1rem)]
            sm:max-w-[700px]
            lg:max-w-[900px]
            p-0
            gap-0
          "
        >
          <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
            <DialogTitle className="text-lg sm:text-xl">
              Canvas controls
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
            <Card>
              <CardContent className="p-3 sm:p-4">
                {/* Very small screens: compact stacked cards */}
                <div className="space-y-2 xs:space-y-3 sm:hidden">
                  {controls.map(
                    ({ action, icon: ActionIcon, desktop, phone, stylus }) => (
                      <div
                        key={action}
                        className="rounded-lg border p-2.5 space-y-2"
                      >
                        <div className="flex items-center gap-2 font-medium text-sm">
                          <ActionIcon className="h-4 w-4 shrink-0" />
                          <span>{action}</span>
                        </div>

                        <div className="space-y-2 text-xs leading-snug">
                          <div className="grid grid-cols-[16px_1fr] gap-x-2">
                            <Mouse className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-muted-foreground">Desktop: </span>
                              <span>{desktop}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-[16px_1fr] gap-x-2">
                            <Smartphone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-muted-foreground">Phone: </span>
                              <span>{phone}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-[16px_1fr] gap-x-2">
                            <Pen className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-muted-foreground">Stylus: </span>
                              <span>{stylus}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* sm and up: proper grid, no forced min width */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-4 gap-y-3 items-start text-sm">
                    <div />
                    {platforms.map(({ label, icon: Icon }) => (
                      <div
                        key={label}
                        className="flex items-center gap-2 font-medium text-muted-foreground"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                      </div>
                    ))}

                    {controls.map(
                      ({ action, icon: ActionIcon, desktop, phone, stylus }) => (
                        <div key={action} className="contents">
                          <div className="flex items-center gap-2 font-medium whitespace-nowrap">
                            <ActionIcon className="h-4 w-4 shrink-0" />
                            <span>{action}</span>
                          </div>
                          <div className="min-w-0">{desktop}</div>
                          <div className="min-w-0">{phone}</div>
                          <div className="min-w-0">{stylus}</div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}