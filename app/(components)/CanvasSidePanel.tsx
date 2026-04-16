"use client"

import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, useSidebar, Sidebar } from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { LogOut, Settings, Users, ArrowLeftFromLine, Download } from "lucide-react"
import BrushSettingsPanel from "./BrushSettingsPanel"
import CopyButton from "./CopyButton"
import RoomInfoPanel from "./RoomInfoPanel"
import { useResponsive } from "@/hooks/useResponsive"
import { useDrawingRoomSession } from "../lib/drawing/react/DrawingRoomSessionProvider"
import React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useDrawingRoom } from "../lib/drawing/react/DrawingRoomProvider"
import { Separator } from "@/components/ui/separator"
import { useRoomPresence } from "../lib/drawing/react/RoomPresenceProvider"

export default function CanvasSidePanel() {

    const sidebar = useSidebar()
    const router = useRouter()

    const { isMobile } = useResponsive()

    const { hostUserId, refreshRoomInfo } = useRoomPresence()
    const { thisUserId, roomId, disconnect } = useDrawingRoomSession()
    const { runtime } = useDrawingRoom()

    const resizeViewport = React.useCallback(() => {
        runtime.resize();
    }, [runtime]);

    const onSidePanelTabChange = React.useCallback(
        async (tab: string) => {
            if (tab === "room_info") {
                await refreshRoomInfo();
            }
        },
        [refreshRoomInfo]
    );

    const leaveRoom = React.useCallback(() => {
        disconnect();
        router.push("/");
    }, [disconnect, router]);


    const clearCanvas = React.useCallback(() => {
        if (hostUserId !== thisUserId) return;
        runtime.clear();
    }, [hostUserId, thisUserId, runtime]);


    const exportSvg = React.useCallback(() => {
        const svgText = runtime.exportSvg();

        if (!svgText) {
            toast.info("There is no drawing to export.");
            return;
        }

        const blob = new Blob([svgText], {
            type: "image/svg+xml;charset=utf-8",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "drawing.svg";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        toast.success("SVG downloaded.");
    }, [runtime]);

    return (
        <div className="absolute flex flex-row z-20" >
            <Sidebar className="" >
                <SidebarHeader className="p-2">
                    <div className="flex flex-col gap-2" >
                        <div className="flex gap-2 grow" >
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button className="grow" variant={"destructive"}>
                                        Leave room
                                        <LogOut />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure you want to leave this room?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {hostUserId === thisUserId ? "You are the host of this room. If you leave, another random user will be promoted to host." : "You can re-enter this room with the provided room ID as long as the room is active."}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={leaveRoom}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            {hostUserId === thisUserId ? (
                                <div>
                                    <Button onClick={clearCanvas}>Clear canvas</Button>
                                </div>
                            ) : <></>}
                        </div>
                        <div className="flex gap-2 items-center">
                            <Label htmlFor="room_id_input" className={`whitespace-nowrap`}>Room code:</Label>
                            <Input id="room_id_input" disabled type="text" readOnly value={roomId} />
                            <CopyButton showText={!isMobile} copyString={roomId}></CopyButton>
                        </div>

                        <div className="grow">

                            <Button
                                type="button"
                                onClick={exportSvg}
                                size="lg"
                                variant="secondary"
                                className="shadow-md w-full"
                                title="Export SVG"
                            >
                                <Download />
                                Download SVG
                            </Button>
                        </div>
                    </div>
                </SidebarHeader>
                <Separator></Separator>
                <SidebarContent className="p-2">
                    <Tabs onValueChange={e => { onSidePanelTabChange(e) }} defaultValue="settings" className="w-full grow">
                        <TabsList className="w-full">
                            <TabsTrigger value="settings">
                                <Settings />
                                Settings
                            </TabsTrigger>
                            <TabsTrigger value="room_info">
                                <Users />
                                Room info
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="settings" className="w-full flex flex-col gap-2 p-2">
                            <BrushSettingsPanel />
                        </TabsContent>
                        <TabsContent value="room_info" className="grow p-2">
                            <RoomInfoPanel />
                        </TabsContent>
                    </Tabs>

                </SidebarContent>
                {
                    isMobile ? (
                        <SidebarFooter>
                            <Button onClick={e => { resizeViewport(); sidebar.toggleSidebar(); }} variant={"destructive"}><ArrowLeftFromLine /> Close sidebar</Button>
                        </SidebarFooter>
                    ) : (
                        <></>
                    )
                }
            </Sidebar>
            <SidebarTrigger onClick={e => { resizeViewport() }} variant={"secondary"} size={"lg"} className="size-10 m-2 z-10" />
        </div>
    )
}