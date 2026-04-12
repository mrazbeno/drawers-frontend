"use client"

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Pencil, Users, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useSocket } from "@/providers/SocketProvider";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { VideoWithOverlaySkeleton } from "./(components)/VideoWithOverlaySkeleton";
import { Skeleton } from "@/components/ui/skeleton";

// TODO: put username validation params in the shared package 

const MAX_USR_LEN = 24
const MIN_USR_LEN = 3

const GITHUB_URL: string = "https://github.com/mrazbeno/drawers-frontend"
const IS_DEMO: boolean = process.env.NEXT_PUBLIC_IS_LIVE_DEMO == "TRUE"

const usernameRegex = /^(?=.*[A-Za-z0-9])[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/;

/**
 * 
 * @param username 
 * @returns null on SUCCESS, error msg otherwise
 */
function isValidUsername(username: string): string | null {
    const trimmed = username.trim();
    if (trimmed.length < MIN_USR_LEN || trimmed.length > MAX_USR_LEN)
        return "Username must be between 3-24 characters.";

    if (!usernameRegex.test(trimmed))
        return "Username must only contain letters and numbers."

    return null
}

export default function HomeMenu() {
    const [roomId, setRoomId] = useState("");
    const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
    const [isUsernameDialogOpen, setIsUsernameDialogOpen] = useState(false);
    const [username, setUsername] = useState("");

    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [isJoiningRoom, setIsJoiningRoom] = useState(false);
    const [isEnteringRoom, setIsEnteringRoom] = useState(false);

    const router = useRouter()
    const socket = useSocket()

    const isBusy = isCreatingRoom || isJoiningRoom || isEnteringRoom;

    async function createRoom() {
        if (isBusy) return;

        setIsCreatingRoom(true);

        try {
            const resp = await fetch(`${process.env.NEXT_PUBLIC_WS_URL}/rooms`, {
                method: "POST",
            });

            // Handle HTTP errors (server responded but not OK)
            if (!resp.ok) {
                let msg = "Failed to create room";
                try {
                    const data = await resp.json();
                    msg = data.error || msg;
                } catch {
                    msg = "An error occured"
                }

                toast.error(msg);
                return;
            }

            // Success case
            const data = await resp.json();
            const roomId = data.roomId;

            socket.updateRoomId(roomId);
            setUsername("");
            setIsUsernameDialogOpen(true);

        } catch (error) {
            // Network-level error (connection refused, DNS, CORS, etc.)
            console.error(error);
            toast.error("Cannot connect to server.");
        } finally {
            setIsCreatingRoom(false);
        }
    }

    async function joinRoom() {
        if (isBusy) return;

        const trimmedRoomId = roomId.trim();
        if (!trimmedRoomId) {
            toast.error("Please enter a room ID");
            return;
        }

        setIsJoiningRoom(true);

        try {
            const resp = await fetch(
                `${process.env.NEXT_PUBLIC_WS_URL}/rooms/${trimmedRoomId}`,
                { method: "GET" }
            );

            // Handle HTTP errors
            if (!resp.ok) {
                let msg = "Failed to join room";

                try {
                    const data = await resp.json();
                    msg = data.error || msg;
                } catch {
                    msg = "An error occurred";
                }

                toast.error(msg);
                return;
            }

            // Success
            socket.updateRoomId(trimmedRoomId);
            setUsername("");
            setIsJoinDialogOpen(false);
            setIsUsernameDialogOpen(true);

        } catch (error) {
            // Network-level error
            console.error(error);
            toast.error("Cannot connect to server.");
        } finally {
            setIsJoiningRoom(false);
        }
    }

    async function enterRoom(username: string) {
        if (isBusy) return;

        // Validate locally first
        const nameValiddationErrorMsg: string | null = isValidUsername(username)
        if (nameValiddationErrorMsg !== null) {
            toast.error(nameValiddationErrorMsg);
            return;
        }

        setIsEnteringRoom(true);

        // Backend / true validation + global duplication check
        try {
            const resp = await fetch(
                `${process.env.NEXT_PUBLIC_WS_URL}/validate_username`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ roomId: socket.getRoomId(), username })
                })

            if (resp.status !== 200) {
                let errorMsg = "Username validation failed";

                try {
                    const data = await resp.json();
                    errorMsg = data.error || errorMsg;
                } catch { }

                toast.error(errorMsg);
                return;
            }

            socket.connectToRoom(username, joinSuccess, joinFail)
        } catch (error) {
            console.error(error)
            toast.error("Cannot connect to server.")
            setIsEnteringRoom(false);
        }
    }

    function joinSuccess() {
        router.push("/canvas")
    }

    function joinFail(data: { message: string }) {
        setIsEnteringRoom(false);
        toast.error(`Failed to join room: '${data.message}'`)
    }

    const handleUsernameSubmit = async () => {
        if (isEnteringRoom) return;

        if (!username.trim()) {
            toast.error("Please enter a username");
            return;
        }

        await enterRoom(username.trim())
    };

    React.useEffect(() => {
        socket.disconnect()
        return () => { }
    }, [])

    return (
        <div className="min-h-screen bg-[var(--gradient-hero)] flex flex-col w-full">

            {
                IS_DEMO &&
                <div className="relative top-2 w-full flex flex-col justify-center items-center">
                    <div className="flex gap-1 flex-row text-[#E5AB40]">
                        <TriangleAlert stroke="#E5AB40" />
                        DEMO
                    </div>
                    <p className="text-sm text-[#E5AB40]"> WebSocket server is hosted on Render free tier.</p>
                    <p className="text-sm text-[#E5AB40]">May take a minute to wake up after inactivity.</p>
                </div>
            }

            {/* Hero Section */}
            <main className="flex-1 flex items-center justify-center px-6 py-12">
                <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Content */}
                    <div className="space-y-8 text-center lg:text-left">
                        <div className="space-y-4">
                            <h2 className="text-5xl md:text-6xl font-bold leading-tight">
                                Drawers,
                                <span className="block text-primary opacity-50">
                                    Shared Canvas
                                </span>
                            </h2>
                            <p className="text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0">
                                Draw together in real-time with just a brush. No complicated tools—just pure creative fun!
                            </p>
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                            <Button
                                variant="hero"
                                size="xl"
                                onClick={createRoom}
                                className="group"
                                disabled={isBusy}
                                aria-busy={isCreatingRoom}
                            >
                                <Pencil className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                {isCreatingRoom ? "Creating Room..." : "Create Room"}
                            </Button>

                            <Dialog
                                open={isJoinDialogOpen}
                                onOpenChange={(open) => {
                                    if (isJoiningRoom || isEnteringRoom) return;
                                    setIsJoinDialogOpen(open);
                                }}
                            >
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="xl"
                                        className="border-2"
                                        disabled={isBusy}
                                    >
                                        <Users className="w-5 h-5" />
                                        Join Room
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="text-2xl">Join a Room</DialogTitle>
                                        <DialogDescription>
                                            Enter the room ID shared with you to start collaborating
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 pt-4">
                                        <div className="space-y-2">
                                            <Input
                                                placeholder="Enter room ID..."
                                                value={roomId}
                                                disabled={isJoiningRoom || isEnteringRoom}
                                                onChange={(e) => setRoomId(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && !isJoiningRoom && !isEnteringRoom) {
                                                        joinRoom();
                                                    }
                                                }}
                                                className="h-12 text-lg"
                                                aria-busy={isJoiningRoom}
                                            />
                                        </div>
                                        <Button
                                            onClick={joinRoom}
                                            className="w-full h-12 text-lg"
                                            variant="hero"
                                            disabled={isJoiningRoom || isEnteringRoom || !roomId.trim()}
                                            aria-busy={isJoiningRoom}
                                        >
                                            {isJoiningRoom ? "Joining Room..." : "Join Room"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            {/* Username Dialog */}
                            <Dialog
                                open={isUsernameDialogOpen}
                                onOpenChange={(open) => {
                                    if (isEnteringRoom) return;
                                    setIsUsernameDialogOpen(open);
                                }}
                            >
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="text-2xl">Choose Your Username</DialogTitle>
                                        <DialogDescription>
                                            Pick a username to join room: {socket.getRoomId()}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 pt-4">
                                        <div className="space-y-2">
                                            <Input
                                                placeholder="Enter your username..."
                                                value={username}
                                                disabled={isEnteringRoom}
                                                onChange={(e) => setUsername(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && !isEnteringRoom) {
                                                        handleUsernameSubmit();
                                                    }
                                                }}
                                                className="h-12 text-lg"
                                                aria-busy={isEnteringRoom}
                                            />
                                        </div>
                                        <Button
                                            onClick={handleUsernameSubmit}
                                            className="w-full h-12 text-lg"
                                            variant="hero"
                                            disabled={isEnteringRoom || !username.trim()}
                                            aria-busy={isEnteringRoom}
                                        >
                                            {isEnteringRoom ? "Entering Canvas..." : "Enter Canvas"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>

                        {/* Feature Pills */}
                        <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                            <div className="px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium">
                                🖌️ Configurable brush only
                            </div>
                            <div className="px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium">
                                👥 Real-time drawing sync
                            </div>
                            <div className="px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium">
                                🎯 Host controls canvas
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="mt-6 p-4 rounded-xl bg-accent/50 border-2 border-accent text-sm">
                            <p className="font-semibold text-accent-foreground mb-1">💡 How it works:</p>
                            <p className="text-muted-foreground">
                                Created rooms get a shareable ID and others may join. Everyone draws on the same canvas. Only the room host can clear the canvas. If they leave, a random user becomes the new host!
                            </p>
                        </div>
                    </div>

                    {/* <VideoWithOverlaySkeleton/> */}
                    {/* Right Video */}
                    <div className="relative">
                        {/* <div className="absolute inset-0 bg-[var(--gradient-primary)] opacity-20 blur-3xl rounded-full"></div> */}
                        <div className="relative flex flex-col gap-2 ">
                            <Label className="text-muted-foreground" aria-labelledby="demo_video">Take a peek at the canvas</Label>
                            
                            <div className="relative aspect-video">
                                <video title="Canvas demo video" id="demo_video" className="z-2 absolute rounded-md relative shadow-[var(--shadow-card)] w-full h-auto" autoPlay muted loop playsInline>
                                    <source src="/demo/drawers_hero_video_solo.mp4" />
                                    Your browser does not support the video tag.
                                </video>

                                <div
                                    className={'absolute top-0 left-0 h-full w-full z-1'}
                                >
                                    <Skeleton className="w-full h-full rounded-md" />
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}

            {IS_DEMO && (
                <footer className="w-full px-6 py-8 border-t border-border/50">
                    <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
                        <p>This is a small live demo of my project on <Link className="underline" href={GITHUB_URL}>Github</Link>. </p>
                    </div>
                </footer>
            )}

            <div className="min-h-screen min-w-screen fixed -z-1"
                style={{ background: "radial-gradient(125% 125% at 50% 10%, #000000 40%, #2b0707 100%)" }}
            />
        </div>
    );
};