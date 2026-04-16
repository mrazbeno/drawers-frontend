"use client";

import CanvasClient from "./CanvasClient";
import { useDrawingRoomSession } from "@/app/lib/drawing/react/DrawingRoomSessionProvider";
import { RoomPresenceProvider } from "@/app/lib/drawing/react/RoomPresenceProvider";
import { DrawingRoomProvider } from "@/app/lib/drawing/react/DrawingRoomProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function JoinedRoomContent() {
  const { socket, roomId, thisUserId } = useDrawingRoomSession();
  const router = useRouter()

  const isRoomSessionMissing = !socket || !roomId || !thisUserId

  useEffect(() => {
    if (isRoomSessionMissing) { router.replace("/"); }
  }, [isRoomSessionMissing, router])

  if (isRoomSessionMissing) {
  return (
    <div className="p-4 text-white bg-red-900">
      Room session not found. Redirecting...
    </div>
  );
}

  return (
    <DrawingRoomProvider
      key={`${roomId}:${thisUserId}`}
      socket={socket}
      roomId={roomId}
      userId={thisUserId}
    >
        <SidebarProvider className="h-full">
      <CanvasClient />
        </SidebarProvider>
    </DrawingRoomProvider>
  );
}

export default function CanvasPageClient() {
  return (
    <RoomPresenceProvider>
      <JoinedRoomContent />
    </RoomPresenceProvider>
  );
}