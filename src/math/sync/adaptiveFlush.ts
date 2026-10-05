/**
* Adjust the op-queue flush interval based on estimated round-trip time.
* Uses the time between sending a broadcast and receiving its echo (self-send=true).
*/
export class AdaptiveFlush {
private rtt = 200; // starting estimate, ms
private interval = 800; // starting flush interval, ms

recordRTT(ms: number) {
this.rtt = (this.rtt * 0.8) + (ms * 0.2); // exponential moving average

// Scale flush interval: faster RTT → more frequent flush
if (this.rtt < 80) this.interval = 400;
else if (this.rtt < 200) this.interval = 800;
else if (this.rtt < 600) this.interval = 1500;
else this.interval = 3000; // very slow network
}

get currentInterval() { return this.interval; }
}
