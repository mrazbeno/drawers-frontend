"use client"

import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, useSidebar, Sidebar } from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { LogOut, Eraser, Settings, Users, ArrowLeftFromLine, Download  } from "lucide-react"
import BrushSettingsPanel from "./BrushSettingsPanel"
import CopyButton from "./CopyButton"
import RoomInfoPanel from "./RoomInfoPanel"
import { BrushSettings } from "drawers-shared"
import { ForeignUserMap } from "@/app/lib/types"
import { Separator } from "@/components/ui/separator"

interface CanvasSidePanelProps {
    hostUserId: string;
    thisUserId: string;
    thisUsername: string;
    currentRoomId: string;
    isMobile: boolean;

    foreignUserStates: ForeignUserMap;
    onSidePanelTabChange: (tab: string) => void;

    onLeaveRoom: () => void;
    onClearCanvas: () => void;
    onResizeViewport: () => void;

    brushSettings: BrushSettings;
    onBrushSettingsChange: (next: BrushSettings) => void;

    onExportSvg: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

export default function CanvasSidePanel(

    {
        hostUserId,
        thisUserId,
        thisUsername,
        onClearCanvas,
        onLeaveRoom,
        isMobile,
        currentRoomId,
        onBrushSettingsChange,
        brushSettings,
        foreignUserStates,
        onSidePanelTabChange,
        onResizeViewport,
        onExportSvg
    }: CanvasSidePanelProps

) {

    const sidebar = useSidebar()

    return (
        <div className="absolute flex flex-row z-20" >
            <Sidebar className="" >
                <SidebarHeader className="p-2">
                    <div className="flex flex-col gap-2" >
                        <div className="flex gap-2 grow" >
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button className="grow" variant={"destructive"}>
                                        {true ? "Leave room" : <></>}
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
                                        <AlertDialogAction onClick={e => { onLeaveRoom() }}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            {hostUserId === thisUserId ? (
                                <div className="">
                                    {false ? (
                                        <Button onClick={e => { onClearCanvas() }} ><Eraser /></Button>

                                    ) : (

                                        <Button onClick={e => { onClearCanvas() }}>Clear canvas</Button>
                                    )}
                                </div>
                            ) : <></>}
                        </div>
                        <div className="flex gap-2 items-center">
                            <Label htmlFor="room_id_input" className={`whitespace-nowrap`}>Room code:</Label>
                            <Input id="room_id_input" disabled type="text" readOnly value={currentRoomId} />
                            <CopyButton showText={!isMobile} copyString={currentRoomId}></CopyButton>
                        </div>

                            <div className="grow">

                        <Button
                            type="button"
                            onClick={onExportSvg}
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
                            <BrushSettingsPanel brushSettings={brushSettings} onBrushSettingsChange={onBrushSettingsChange} />
                        </TabsContent>
                        <TabsContent value="room_info" className="grow p-2">
                            <RoomInfoPanel foreignUsers={foreignUserStates} myUserId={thisUserId} myUsername={thisUsername} hostUserId={hostUserId}></RoomInfoPanel>
                        </TabsContent>
                    </Tabs>

                </SidebarContent>
                {
                    isMobile ? (
                        <SidebarFooter>
                            <Button onClick={e => { onResizeViewport(); sidebar.toggleSidebar(); }} variant={"destructive"}><ArrowLeftFromLine /> Close sidebar</Button>
                        </SidebarFooter>
                    ) : (
                        <></>
                    )
                }
            </Sidebar>
            <SidebarTrigger onClick={e => { onResizeViewport()}} variant={"secondary"} size={"lg"} className="size-10 m-2 z-10" />
        </div>
    )
}