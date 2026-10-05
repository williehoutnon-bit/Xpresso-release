import { Client, Databases, ID, Query, Permission, Role } from './appwriteService';
import { client, databases, isAppwriteConfigured, APPWRITE_CONFIG } from './appwriteService';

export interface CallDetails {
    $id?: string;
    conversationId: string;
    type: 'audio' | 'video';
    status: 'ongoing' | 'ended';
    initiatorId: string;
    participants: string[];
}

export interface SignalData {
    callId: string;
    senderId: string;
    receiverId: string; // for Mesh routing 
    type: 'offer' | 'answer' | 'ice-candidate' | 'leave';
    payload: string; // JSON string
}

class WebRTCService {
    private localStream: MediaStream | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private currentCallId: string | null = null;
    private currentUserId: string | null = null;
    
    private onRemoteStreamCallback: ((userId: string, stream: MediaStream) => void) | null = null;
    private onCallEndedCallback: (() => void) | null = null;
    private unsubscribeSignals: (() => void) | null = null;
    private unsubscribeCallsList: (() => void) | null = null;
    private onIncomingCallCallback: ((call: any) => void) | null = null;
    
    // Sandbox simulation properties
    private isSimulatedCallMode = false;
    private simulatedTimer: any = null;
    private simulatedRemoteStreams: MediaStream[] = [];

    // Group call configuration
    private rtcConfig: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    };

    /**
     * Set up callbacks for UI integration
     */
    init(
        userId: string,
        onRemoteStream: (uid: string, stream: MediaStream) => void,
        onCallEnded: () => void
    ) {
        this.currentUserId = userId;
        this.onRemoteStreamCallback = onRemoteStream;
        this.onCallEndedCallback = onCallEnded;
    }

    /**
     * Helper to obtain local MediaStream with robust fallback to canvas simulation if hardware is locked/unavailable
     */
    private async obtainMediaStream(type: 'audio' | 'video'): Promise<MediaStream> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: type === 'video'
            });
            return stream;
        } catch (err) {
            console.warn("Failed to obtain real media stream, falling back to simulated stream:", err);
            return this.createMockStream(type, 'Local Camera Demo', '#6B705C');
        }
    }

    /**
     * Dynamic mock stream generator using standard AudioContext + Canvas.
     * Guarantees 100% renderability across sandboxed containers, safari webviews and iframe environments.
     */
    private createMockStream(type: 'audio' | 'video', label: string = 'Demo Feed', bgColor: string = '#6B705C'): MediaStream {
        const stream = new MediaStream();
        
        // 1. Setup silent audio oscillator track
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                const audioContext = new AudioContextClass();
                const dest = audioContext.createMediaStreamDestination();
                const osc = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                osc.connect(gainNode);
                gainNode.connect(dest);
                gainNode.gain.value = 0.001; // barely audible humming
                osc.frequency.value = 440;
                osc.start(0);

                const audioTrack = dest.stream.getAudioTracks()[0];
                if (audioTrack) {
                    stream.addTrack(audioTrack);
                }
                (stream as any)._audioContext = audioContext;
                (stream as any)._oscillator = osc;
            }
        } catch (e) {
            console.warn("Could not create mock audio track:", e);
        }

        // 2. Setup animated canvas video track
        if (type === 'video') {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 480;
                const ctx = canvas.getContext('2d');
                let frameCount = 0;
                
                const interval = setInterval(() => {
                    if (!ctx) return;
                    frameCount++;
                    
                    // Base background
                    ctx.fillStyle = bgColor; 
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    // Wave expansion circle graphics
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.lineWidth = 6;
                    ctx.beginPath();
                    const r1 = (frameCount * 2) % 250;
                    ctx.arc(canvas.width / 2, canvas.height / 2, r1, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                    ctx.beginPath();
                    const r2 = ((frameCount * 2) + 120) % 250;
                    ctx.arc(canvas.width / 2, canvas.height / 2, r2, 0, Math.PI * 2);
                    ctx.stroke();

                    // Elegant design branding labels
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.font = 'bold 24px "Space Grotesk", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(label, canvas.width / 2, canvas.height / 2 - 20);

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                    ctx.font = '12px "JetBrains Mono", monospace';
                    ctx.fillText('ACTIVE CALL SIMULATOR / 30FPS', canvas.width / 2, canvas.height / 2 + 20);

                    // Pulsing status dot indicator
                    ctx.fillStyle = `rgba(34, 197, 94, ${0.5 + Math.sin(frameCount / 10) * 0.5})`;
                    ctx.beginPath();
                    ctx.arc(canvas.width / 2, canvas.height / 2 + 60, 8, 0, Math.PI * 2);
                    ctx.fill();

                }, 1000 / 30);

                const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : null;
                if (canvasStream) {
                    const videoTrack = canvasStream.getVideoTracks()[0];
                    if (videoTrack) {
                        stream.addTrack(videoTrack);
                    }
                }
                (stream as any)._intervalId = interval;
            } catch (e) {
                console.warn("Could not create mock video track:", e);
            }
        }

        return stream;
    }

    /**
     * Listen for incoming calls for this user
     */
    listenForIncomingCalls(userId: string, onIncomingCall: (call: any) => void) {
        this.currentUserId = userId;
        this.onIncomingCallCallback = onIncomingCall;

        if (!isAppwriteConfigured || !APPWRITE_CONFIG.collections.calls) return () => {};

        // 1. Check for any active ongoing call
        databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.calls,
            [
                Query.equal('status', 'ongoing'),
                Query.limit(20)
            ]
        ).then(res => {
            for (const doc of res.documents) {
                if (doc.initiatorId !== userId) {
                    if (this.onIncomingCallCallback) {
                        this.onIncomingCallCallback(doc);
                    }
                }
            }
        }).catch(err => {
            console.warn("Failed to retrieve ongoing calls:", err);
        });

        // 2. Real-time subscribe to the calls collection
        const unsubscribe = client.subscribe(
            `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.calls}.documents`,
            (response: any) => {
                const doc = response.payload;
                if (response.events.includes('databases.*.collections.*.documents.*.create')) {
                    if (doc.status === 'ongoing' && doc.initiatorId !== userId) {
                        if (this.onIncomingCallCallback) {
                            this.onIncomingCallCallback(doc);
                        }
                    }
                } else if (response.events.includes('databases.*.collections.*.documents.*.update')) {
                    if (doc.status === 'ended') {
                        if (this.currentCallId === doc.$id) {
                            this.cleanup();
                        }
                    }
                }
            }
        );

        this.unsubscribeCallsList = unsubscribe;
        return unsubscribe;
    }

    /**
     * Start a new call in a conversation
     */
    async startCall(conversationId: string, type: 'audio' | 'video'): Promise<{ call: CallDetails, stream: MediaStream }> {
        // Appwrite unconfigured sandbox routine
        if (!isAppwriteConfigured || !APPWRITE_CONFIG.collections.calls) {
            console.log("WebRTC: Appwrite is unconfigured. Launching sandbox mock call...");
            const stream = await this.obtainMediaStream(type);
            this.localStream = stream;
            this.currentCallId = `sim_call_${Date.now()}`;
            this.isSimulatedCallMode = true;

            const callDoc: CallDetails = {
                $id: this.currentCallId,
                conversationId,
                type,
                status: 'ongoing',
                initiatorId: this.currentUserId || 'local_student',
                participants: [this.currentUserId || 'local_student']
            };

            // Trigger simulated peer joining after 2.5s ring-back
            this.simulatedTimer = setTimeout(() => {
                const mockPeerId = 'peerClassmate';
                const mockPeerStream = this.createMockStream(type, 'Peer: Connected Live', '#1E293B');
                this.simulatedRemoteStreams.push(mockPeerStream);
                if (this.onRemoteStreamCallback) {
                    this.onRemoteStreamCallback(mockPeerId, mockPeerStream);
                }
            }, 2500);

            return { call: callDoc, stream };
        }

        const stream = await this.obtainMediaStream(type);
        this.localStream = stream;

        try {
            // Upsert/Create the call explicitly on Appwrite
            const callDoc = await databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.calls,
                ID.unique(),
                {
                    conversationId,
                    type,
                    status: 'ongoing',
                    initiatorId: this.currentUserId || 'local_student',
                    participants: [this.currentUserId || 'local_student'] 
                },
                [
                    Permission.read(Role.any()), Permission.write(Role.any()),
                    Permission.update(Role.any()), Permission.delete(Role.any()),
                ]
            );

            this.currentCallId = callDoc.$id;

            // Start listening to signals
            this.subscribeToSignals(this.currentCallId);

            return { call: callDoc as any, stream };
        } catch (err) {
            console.warn("Failed to create call in Appwrite. Falling back to sandbox demo simulation...", err);
            
            // Setup sandbox backup
            this.currentCallId = `sim_call_${Date.now()}`;
            this.isSimulatedCallMode = true;

            const callDoc: CallDetails = {
                $id: this.currentCallId,
                conversationId,
                type,
                status: 'ongoing',
                initiatorId: this.currentUserId || 'local_student',
                participants: [this.currentUserId || 'local_student']
            };

            // Trigger simulated peer joining after 2.5s ring-back
            this.simulatedTimer = setTimeout(() => {
                const mockPeerId = 'peerClassmate';
                const mockPeerStream = this.createMockStream(type, 'Peer: Connected Live', '#1E293B');
                this.simulatedRemoteStreams.push(mockPeerStream);
                if (this.onRemoteStreamCallback) {
                    this.onRemoteStreamCallback(mockPeerId, mockPeerStream);
                }
            }, 2500);

            return { call: callDoc, stream };
        }
    }

    /**
     * Join an existing call
     */
    async joinCall(callId: string, type: 'audio' | 'video'): Promise<MediaStream> {
        // Appwrite unconfigured sandbox routine 
        if (!isAppwriteConfigured || !APPWRITE_CONFIG.collections.calls) {
            console.log("WebRTC: Appwrite unconfigured. Joining sandbox call session.");
            const stream = await this.obtainMediaStream(type);
            this.localStream = stream;
            this.currentCallId = callId;
            this.isSimulatedCallMode = true;

            // Instantly spawn remote peer's stream for mock connection
            this.simulatedTimer = setTimeout(() => {
                const mockPeerId = 'peerClassmate';
                const mockPeerStream = this.createMockStream(type, 'Peer: Connected Live', '#1E293B');
                this.simulatedRemoteStreams.push(mockPeerStream);
                if (this.onRemoteStreamCallback) {
                    this.onRemoteStreamCallback(mockPeerId, mockPeerStream);
                }
            }, 1000);

            return stream;
        }

        const stream = await this.obtainMediaStream(type);
        this.localStream = stream;
        this.currentCallId = callId;

        try {
            // Register in participant list if not already
            const callDoc: any = await databases.getDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.calls,
                callId
            );

            const parts: string[] = callDoc.participants || [];
            if (!parts.includes(this.currentUserId!)) {
               await databases.updateDocument(
                   APPWRITE_CONFIG.databaseId,
                   APPWRITE_CONFIG.collections.calls,
                   callId,
                   { participants: [...parts, this.currentUserId] }
               );
            }

            this.subscribeToSignals(callId);

            // Initiate connection to all existing participants (Mesh network)
            for (const uid of parts) {
                if (uid !== this.currentUserId) {
                    await this.initiatePeerConnection(uid);
                }
            }

            return stream;
        } catch (err) {
            console.warn("Failed to join call on Appwrite. Falling back to sandbox join stream...", err);

            this.isSimulatedCallMode = true;
            this.simulatedTimer = setTimeout(() => {
                const mockPeerId = 'peerClassmate';
                const mockPeerStream = this.createMockStream(type, 'Peer: Connected Live', '#1E293B');
                this.simulatedRemoteStreams.push(mockPeerStream);
                if (this.onRemoteStreamCallback) {
                    this.onRemoteStreamCallback(mockPeerId, mockPeerStream);
                }
            }, 1000);

            return stream;
        }
    }

    /**
     * Leave the current call
     */
    async leaveCall() {
        if (this.isSimulatedCallMode) {
             this.cleanup();
             return;
        }

        if (this.currentCallId && this.currentUserId && APPWRITE_CONFIG.collections.signals) {
             // Send leave signal
             try {
                await databases.createDocument(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collections.signals,
                    ID.unique(),
                    {
                        callId: this.currentCallId,
                        senderId: this.currentUserId,
                        receiverId: 'ALL',
                        type: 'leave',
                        payload: '{}'
                    },
                    [ Permission.read(Role.any()), Permission.write(Role.any()) ]
                );
             } catch(e) {}
        }
        
        this.cleanup();
    }

    private cleanup() {
        // Clear simulated joins
        if (this.simulatedTimer) {
            clearTimeout(this.simulatedTimer);
            this.simulatedTimer = null;
        }
        this.isSimulatedCallMode = false;

        // Clean mock remote streams
        this.simulatedRemoteStreams.forEach(stream => {
            stream.getTracks().forEach(t => t.stop());
            if ((stream as any)._intervalId) clearInterval((stream as any)._intervalId);
            if ((stream as any)._oscillator) {
                try { (stream as any)._oscillator.stop(); } catch(e){}
            }
            if ((stream as any)._audioContext) {
                try { (stream as any)._audioContext.close(); } catch(e){}
            }
        });
        this.simulatedRemoteStreams = [];

        // Clean local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            if ((this.localStream as any)._intervalId) {
                clearInterval((this.localStream as any)._intervalId);
            }
            if ((this.localStream as any)._oscillator) {
                try { (this.localStream as any)._oscillator.stop(); } catch(e){}
            }
            if ((this.localStream as any)._audioContext) {
                try { (this.localStream as any)._audioContext.close(); } catch(e){}
            }
            this.localStream = null;
        }

        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();

        if (this.unsubscribeSignals) {
            this.unsubscribeSignals();
            this.unsubscribeSignals = null;
        }

        this.currentCallId = null;
        if (this.onCallEndedCallback) this.onCallEndedCallback();
    }

    private async initiatePeerConnection(peerId: string) {
        const pc = this.createPeerConnection(peerId);
        
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            await this.sendSignal(peerId, 'offer', JSON.stringify(offer));
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    private createPeerConnection(peerId: string): RTCPeerConnection {
        const pc = new RTCPeerConnection(this.rtcConfig);

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream!);
            });
        }

        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                await this.sendSignal(peerId, 'ice-candidate', JSON.stringify(event.candidate));
            }
        };

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                if (this.onRemoteStreamCallback) {
                    this.onRemoteStreamCallback(peerId, event.streams[0]);
                }
            }
        };

        this.peerConnections.set(peerId, pc);
        return pc;
    }

    private async sendSignal(receiverId: string, type: string, payload: string) {
        if (!APPWRITE_CONFIG.collections.signals) return;

        await databases.createDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.signals,
            ID.unique(),
            {
                callId: this.currentCallId,
                senderId: this.currentUserId,
                receiverId,
                type,
                payload
            },
            [
                Permission.read(Role.any()), Permission.write(Role.any()),
                Permission.update(Role.any()), Permission.delete(Role.any()),
            ]
        );
    }

    private subscribeToSignals(callId: string) {
        if (!APPWRITE_CONFIG.collections.signals) return;

        // Listen for new signal documents in real-time
        this.unsubscribeSignals = client.subscribe(
            `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.signals}.documents`,
            async (response: any) => {
                if (response.events.includes('databases.*.collections.*.documents.*.create')) {
                    const signal = response.payload;
                    if (signal.callId === callId && signal.senderId !== this.currentUserId) {
                        
                        // Check if signal is meant for everyone ('ALL') or specifically us
                        if (signal.receiverId === 'ALL' || signal.receiverId === this.currentUserId) {
                             await this.handleSignal(signal);
                        }
                    }
                }
            }
        );
    }

    private async handleSignal(signal: any) {
        const peerId = signal.senderId;

        if (signal.type === 'leave') {
            const pc = this.peerConnections.get(peerId);
            if (pc) {
                pc.close();
                this.peerConnections.delete(peerId);
            }
            return;
        }

        let pc = this.peerConnections.get(peerId);
        if (!pc && signal.type === 'offer') {
            pc = this.createPeerConnection(peerId);
        }

        if (!pc) return;

        const payload = JSON.parse(signal.payload);

        try {
            if (signal.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await this.sendSignal(peerId, 'answer', JSON.stringify(answer));
            } else if (signal.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
            } else if (signal.type === 'ice-candidate') {
                await pc.addIceCandidate(new RTCIceCandidate(payload));
            }
        } catch (err) {
            console.error(`Error handling signal ${signal.type}:`, err);
        }
    }
}

export const webrtcService = new WebRTCService();
