import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info, Mouse, Smartphone, Pen, Brush, Move, ZoomIn } from "lucide-react";

export default function InputGuideDialog() {


    return (

        <div className="absolute m-2 right-0 top-0 z-10">


            <Dialog >
                <DialogTrigger asChild>
                    <Button className="grow" variant={"secondary"}>
                        Controls
                        <Info />
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">Canvas controls</DialogTitle>
                    </DialogHeader>
                    <Card >
                        <CardContent className="p-0">
                            <div
                                className="grid gap-2 p-2 w-full h-full"
                                style={{

                                    gridTemplateColumns: `repeat(4, minmax(0, 1fr))`,
                                    gridTemplateRows: `repeat(4, minmax(0, 1fr))`,
                                }}
                            >
                                <div></div>
                                <div className="flex flex-row gap-1 items-center"><Mouse />Desktop</div>
                                <div className="flex flex-row gap-1 items-center"><Smartphone />Phone</div>
                                <div className="flex flex-row gap-1 items-center"><Pen />Stylus</div>

                                <div className="flex flex-row gap-1 items-center"><Brush />Draw</div>
                                <div className="flex items-center">Left mouse button</div>
                                <div className="flex items-center">Single finger</div>
                                <div className="flex items-center">Pen</div>

                                <div className="flex flex-row gap-1 items-center"><Move />Pan</div>
                                <div className="flex items-center">Right mouse button</div>
                                <div className="flex items-center">Two fingers swipe</div>
                                <div className="flex items-center">Two fingers swipe</div>

                                <div className="flex flex-row gap-1 items-center"><ZoomIn />Zoom</div>
                                <div className="flex items-center">Mouse wheel</div>
                                <div className="flex items-center">Two fingers pinch</div>
                                <div className="flex items-center">Two fingers pinch</div>
                            </div>
                        </CardContent>
                    </Card>
                </DialogContent>
            </Dialog>

        </div>

    )
}