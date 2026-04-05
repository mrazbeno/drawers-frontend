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

const MAX_USR_LEN = 24
const MIN_USR_LEN = 3

const GITHUB_URL: string = "https://github.com/mrazbeno/drawers-frontend"
const IS_DEMO: boolean = process.env.NEXT_PUBLIC_IS_LIVE_DEMO == "TRUE"

const usernameRegex = /^(?=.*[A-Za-z0-9])[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/;

function isValidUsername(username: string): boolean {
    const trimmed = username.trim();
    if (trimmed.length < MIN_USR_LEN || trimmed.length > MAX_USR_LEN) return false;
    return usernameRegex.test(trimmed);
}

export default function HomeMenu () {
    const [roomId, setRoomId] = useState("");
    const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
    const [isUsernameDialogOpen, setIsUsernameDialogOpen] = useState(false);
    const [username, setUsername] = useState("");

    const router = useRouter()
    const socket = useSocket()

    async function createRoom() {
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
            setIsUsernameDialogOpen(true);

        } catch (error) {
            // Network-level error (connection refused, DNS, CORS, etc.)
            console.error(error);

            toast.error("Cannot connect to server.");
        }
    }

    async function joinRoom() {
        try {
            const resp = await fetch(
                `${process.env.NEXT_PUBLIC_WS_URL}/rooms/${roomId}`,
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
            socket.updateRoomId(roomId);
            setIsUsernameDialogOpen(true);

        } catch (error) {
            // Network-level error
            console.error(error);
            toast.error("Cannot connect to server.");
        }
    }

    async function enterRoom(username: string) {

        const isNameValid = isValidUsername(username)
        if (!isNameValid) {
            toast.error("Username validation failed (1)");
            return;
        }

        const resp = await fetch(
            `${process.env.NEXT_PUBLIC_WS_URL}/validate_username`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roomId: socket.getRoomId(), username })
            })
        if (resp.status !== 200) {
            toast.error("Username validation failed (2)");
            return;
        }

        socket.connectToRoom(username, joinSuccess, joinFail)
    }

    function joinSuccess() {
        router.push("/canvas")
    }

    function joinFail(data: { message: string }) {
        toast.error("Failed to join room...")
    }

    const handleUsernameSubmit = async () => {
        if (!username.trim()) {
            toast.error("Please enter a username");
            return;
        }

        enterRoom(username)
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
                            >
                                <Pencil className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                Create Room
                            </Button>

                            <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="xl" className="border-2">
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
                                                onChange={(e) => setRoomId(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") joinRoom();
                                                }}
                                                className="h-12 text-lg"
                                            />
                                        </div>
                                        <Button
                                            onClick={joinRoom}
                                            className="w-full h-12 text-lg"
                                            variant="hero"
                                        >
                                            Join Room
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            {/* Username Dialog */}
                            <Dialog open={isUsernameDialogOpen} onOpenChange={setIsUsernameDialogOpen}>
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
                                                onChange={(e) => setUsername(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleUsernameSubmit();
                                                }}
                                                className="h-12 text-lg"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleUsernameSubmit}
                                            className="w-full h-12 text-lg"
                                            variant="hero"
                                        >
                                            Enter Canvas
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

                    {/* Right Image */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-[var(--gradient-primary)] opacity-20 blur-3xl rounded-full"></div>
                        <div className="relative flex flex-col gap-2">
                            <Label className="text-muted-foreground" aria-labelledby="demo_video">Take a peek at the canvas</Label>
                            <video title="Canvas demo video" id="demo_video" className="rounded-md relative shadow-[var(--shadow-card)] w-full h-auto" autoPlay muted loop playsInline poster="/demo/home_draw_poster.png">
                                <source src="/demo/drawers_hero_video_solo.mp4" />
                                Your browser does not support the video tag.
                            </video>
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
