import * as vscode from 'vscode';
import { TimerSession } from './types';

const STATE_KEY = 'adoTimer.session';

export class TimerService {
  private ctx: vscode.ExtensionContext;

  constructor(ctx: vscode.ExtensionContext) {
    this.ctx = ctx;
  }

  getSession(): TimerSession | undefined {
    return this.ctx.globalState.get<TimerSession>(STATE_KEY);
  }

  start(workItemId: number, workItemTitle: string, initialCompleted: number, initialRemaining: number): void {
    const session: TimerSession = {
      workItemId,
      workItemTitle,
      startTime: Date.now(),
      pausedMs: 0,
      isPaused: false,
      initialCompleted,
      initialRemaining,
    };
    this.ctx.globalState.update(STATE_KEY, session);
  }

  pause(): boolean {
    const session = this.getSession();
    if (!session || session.isPaused) return false;

    session.isPaused = true;
    session.pauseStart = Date.now();
    this.ctx.globalState.update(STATE_KEY, session);
    return true;
  }

  resume(): boolean {
    const session = this.getSession();
    if (!session || !session.isPaused || session.pauseStart === undefined) return false;

    session.pausedMs += Date.now() - session.pauseStart;
    session.isPaused = false;
    session.pauseStart = undefined;
    this.ctx.globalState.update(STATE_KEY, session);
    return true;
  }

  clear(): void {
    this.ctx.globalState.update(STATE_KEY, undefined);
  }

  /** Elapsed active milliseconds (excludes paused time). */
  elapsedMs(): number {
    const session = this.getSession();
    if (!session) return 0;

    const pausedMs = session.isPaused && session.pauseStart !== undefined
      ? session.pausedMs + (Date.now() - session.pauseStart)
      : session.pausedMs;

    return Date.now() - session.startTime - pausedMs;
  }

  elapsedHours(): number {
    return this.elapsedMs() / 3_600_000;
  }

  isRunning(): boolean {
    const s = this.getSession();
    return !!s && !s.isPaused;
  }

  isPaused(): boolean {
    const s = this.getSession();
    return !!s && s.isPaused;
  }

  isActive(): boolean {
    return !!this.getSession();
  }
}

/** Format ms as HH:MM:SS */
export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
