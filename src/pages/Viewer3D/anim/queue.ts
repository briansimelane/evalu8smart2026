export type SceneAnimType =
  | 'office_opened'
  | 'expansion_progress'
  | 'logistics_pulse'
  | 'customer_sold'
  | 'control_changed'
  | 'tech_progress'
  | 'patent_claimed';

export interface SceneAnimItem {
  id: string;
  type: SceneAnimType;
  regionName?: string;
  connectorId?: string;
  techName?: string;
  teamId?: string;
  teamColor: string;
  duration: number; // in ms
  startTime?: number;
}

export class SceneAnimQueue {
  private queue: SceneAnimItem[] = [];
  private active: SceneAnimItem[] = [];
  private maxConcurrent = 3;
  private maxQueueLength = 6;
  private onUpdate: () => void;

  constructor(onUpdate: () => void) {
    this.onUpdate = onUpdate;
  }

  enqueue(item: SceneAnimItem) {
    // If queue is longer than maxQueueLength, collapse to final state (drop older queued items)
    if (this.queue.length >= this.maxQueueLength) {
      this.queue = this.queue.slice(-2);
    }
    this.queue.push(item);
    this.process();
  }

  getActiveItems(): SceneAnimItem[] {
    return this.active;
  }

  private process() {
    const now = performance.now();
    // Remove completed active items
    this.active = this.active.filter(item => {
      if (!item.startTime) return false;
      return now - item.startTime < item.duration;
    });

    // Fill slots from queue
    while (this.active.length < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift()!;
      next.startTime = performance.now();
      this.active.push(next);
    }

    this.onUpdate();

    if (this.active.length > 0) {
      requestAnimationFrame(() => this.process());
    }
  }
}
