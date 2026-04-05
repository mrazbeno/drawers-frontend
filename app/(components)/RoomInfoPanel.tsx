"use client"

import { ForeignUserMap } from "@/app/lib/types";
import { Crown } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";

interface BrushSettingsPanelProps {
    foreignUsers: ForeignUserMap;
    myUserId: string
    myUsername: string
    hostUserId: string
}



export default function RoomInfoPanel({ foreignUsers, myUsername, myUserId, hostUserId }: BrushSettingsPanelProps) {
    return (
        <div className="flex w-full h-full grow select-none">
            <div className="flex w-full h-full flex-col gap-2">
                <h1>Members ({foreignUsers.size + 1})</h1>
                <div className={`flex px-2 py-1 rounded-sm gap-1 border-white border-solid border-2`} >
                    {myUsername} (You)
                    {hostUserId === myUserId ? <Crown fill="orange" /> : <></>}
                </div>
                <div className="relative shrink grow flex">
                    <div className="absolute h-full w-full">
                        <ScrollArea className=" h-full">
                            <div className="flex flex-col gap-1">
                                {Array.from(foreignUsers.values()).map((v, i) => (
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