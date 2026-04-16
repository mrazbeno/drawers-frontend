"use client"

import { Crown } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDrawingRoomSession } from "../lib/drawing/react/DrawingRoomSessionProvider";
import { useRoomPresence } from '../lib/drawing/react/RoomPresenceProvider';

export default function RoomInfoPanel() {

    const {foreignUserStates, hostUserId} = useRoomPresence()
    const {ownUsername, thisUserId} = useDrawingRoomSession()

    return (
        <div className="flex w-full h-full grow select-none">
            <div className="flex w-full h-full flex-col gap-2">
                <h1>Members ({foreignUserStates.size + 1})</h1>
                <div className={`flex px-2 py-1 rounded-sm gap-1 border-white border-solid border-2`} >
                    {ownUsername} (You)
                    {hostUserId === thisUserId ? <Crown fill="orange" /> : <></>}
                </div>
                <div className="relative shrink grow flex">
                    <div className="absolute h-full w-full">
                        <ScrollArea className=" h-full">
                            <div className="flex flex-col gap-1">
                                {Array.from(foreignUserStates.values()).map((v, i) => (
                                    <div key={i} className={`flex px-2 py-1 rounded-sm gap-1 border-white border-solid border-1`} style={{ backgroundColor: v.color }}>
                                        {v.username}
                                        {hostUserId === v.id ? <Crown fill="orange" /> : <></>}
                                        <div className={` rounded-full h-full ratio-1`}></div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>
        </div>
    );
}