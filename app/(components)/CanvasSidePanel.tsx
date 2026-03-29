"use client"

import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, useSidebar, Sidebar } from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { LogOut, Eraser, Settings, Users } from "lucide-react"
import BrushSettingsPanel from "./BrushSettingsPanel"
import CopyButton from "./CopyButton"
import RoomInfoPanel from "./RoomInfoPanel"
import { BrushSettings } from "drawers-shared"
import { ForeignUserMap } from "@/app/lib/types"

interface CanvasSidePanelProps {
    hostUserId: string,
    thisUserId: string,
    thisUsername: string
    clearCanvas: Function
    leaveRoom: Function
    resize: Function
    isMobile: boolean
    currentRoomId: string
    setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
    brushSettings: BrushSettings
    foreignUserStates: ForeignUserMap
    onSidePanelTabChange: (e: string) => void
}

export default function CanvasSidePanel(

    {
        hostUserId,
        thisUserId,
        thisUsername,
        clearCanvas,
        leaveRoom,
        isMobile,
        currentRoomId,
        setBrushSettings,
        brushSettings,
        foreignUserStates,
        onSidePanelTabChange,
        resize
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
                                        <AlertDialogAction onClick={e => { leaveRoom() }}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            {hostUserId === thisUserId ? (
                                <div className="">
                                    {false ? (
                                        <Button onClick={e => { clearCanvas() }} ><Eraser /></Button>

                                    ) : (

                                        <Button onClick={e => { clearCanvas() }}>Clear canvas</Button>
                                    )}
                                </div>
                            ) : <></>}
                        </div>
                        <div className="flex gap-2 items-center">
                            <Label htmlFor="room_id_input" className={`whitespace-nowrap`}>Room code:</Label>
                            <Input id="room_id_input" disabled type="text" readOnly value={currentRoomId} />
                            <CopyButton showText={!isMobile} copyString={currentRoomId}></CopyButton>
                        </div>
                    </div>
                </SidebarHeader>
                <SidebarContent>
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
                            {/* <div>BRUSH</div> */}
                            <BrushSettingsPanel brushSettings={brushSettings} setBrushSettings={setBrushSettings} />
                        </TabsContent>
                        <TabsContent value="room_info" className="grow p-2">
                            {/* <div>MEMBERS</div> */}
                            <RoomInfoPanel foreignUsers={foreignUserStates} myUserId={thisUserId} myUsername={thisUsername} hostUserId={hostUserId}></RoomInfoPanel>
                        </TabsContent>
                    </Tabs>

                </SidebarContent>
                {
                    isMobile ? (
                        <SidebarFooter>
                            <Button onClick={e => { resize(); sidebar.toggleSidebar(); }}>Close sidebar</Button>
                        </SidebarFooter>
                    ) : (
                        <></>
                    )
                }
            </Sidebar>
            <SidebarTrigger onClick={e => { resize()}} variant={"default"} className=" size-11 m-2 z-10 bg-blue-300" />
        </div>
    )
}