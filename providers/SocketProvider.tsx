"use client";

import { TypedSocket } from "@/app/lib/TypedSocket";
import { RoomUsers, ServerToClientEvents } from "drawers-shared";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { io } from "socket.io-client";

export interface SocketContextType {
  socket: TypedSocket | null;
  updateRoomId: (id: string) => void
  getRoomId: () => string
  connectToRoom: (username: string, onSuccess: ServerToClientEvents["join_success"], onError: ServerToClientEvents["join_error"]) => void;
  onEvent: typeof TypedSocket.prototype.on
  offEvent: typeof TypedSocket.prototype.off
  emitEvent: typeof TypedSocket.prototype.emit
  getThisUserId: () => string,
  fetchUsers: () => Promise<{users: RoomUsers, hostId: string}>,
  getOwnUserName: () => string
  disconnect: () => void
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within <SocketProvider />");
  return ctx;
};

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [roomId, setRoomId] = useState<string>("")
  const [ownUserId, setOwnUserId] = useState<string>("")
  const [ownUsername, setOwnUserName] = useState<string>("")

  const updateRoomId = (id: string) => {
    setRoomId(id)
  }

  const getOwnUserName = () => ownUsername
  const getThisUserId = () => ownUserId
  const getRoomId = () => { return roomId }

  const connectToRoom = (
    username: string,
    onSuccess: ServerToClientEvents["join_success"],
    onError: ServerToClientEvents["join_error"],
  ) => {
    if (!socket) {
      const newSocket: TypedSocket = new TypedSocket(io(process.env.NEXT_PUBLIC_WS_URL!, {
        transports: ["websocket"],
      }));

      const onJoinSuccess = (myId: string) => {
        setOwnUserName(username)
        setOwnUserId(v => myId)
        onSuccess(myId)
      }

      newSocket.on("connect", () => {
        console.log("Connected...");

        newSocket.on("join_success", onJoinSuccess)
        newSocket.on("join_error", onError)

        newSocket.emit("join_room", { roomId, username });
      });

      newSocket.on("disconnect", () => {
        console.log("Disconnected...");
        
        newSocket.off("join_success", onJoinSuccess)
        newSocket.off("join_error", onError)
      });


      setSocket(newSocket);
    } else {
      socket.emit("join_room", { roomId, username });
    }
  };

  const onEvent = socket ? socket.on : () => {}
  const offEvent = socket ? socket.off : () => {}
  const emitEvent = socket ? socket.emit : () => {}

  const fetchUsers = async (): Promise<{users: RoomUsers, hostId: string}> => {
    let to: NodeJS.Timeout | number
    return new Promise<{users: RoomUsers, hostId: string}>((res, rej) => {
      const cb = async (users: RoomUsers, hostId: string) => {
        clearTimeout(to)
        socket?.off("return_users", cb)
        res({users, hostId})
      }

      socket?.on("return_users", cb)
      socket?.emit("fetch_users", roomId)
      to = setTimeout(() => { rej("Fetch users request timed out. (10s)") }, 10_000)
    })
  }

  const disconnect = () => {
    socket?.disconnect()
    setRoomId("")
    setOwnUserId("")
    setOwnUserName("")
    setSocket(null)
  }

  // Clean up socket on full app unload
  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{disconnect,  getOwnUserName, socket, updateRoomId, getRoomId, connectToRoom, onEvent, offEvent, emitEvent, getThisUserId, fetchUsers }}>
      {children}
    </SocketContext.Provider>
  );
};
