import * as vscode from 'vscode';
import { TimerService, formatElapsed } from './timer';

export class StatusBarManager {
  private item: vscode.StatusBarItem;
  private timer: TimerService;
  private interval: ReturnType<typeof setInterval> | undefined;

  constructor(timer: TimerService) {
    this.timer = timer;
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'adoTimer.quickPick';
    this.item.show();
    this.refresh();
  }

  start(): void {
    this.interval = setInterval(() => this.refresh(), 1000);
    this.refresh();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.refresh();
  }

  refresh(): void {
    const session = this.timer.getSession();

    if (!session) {
      this.item.text = '$(clock) ADO Timer';
      this.item.tooltip = 'Clique para iniciar rastreamento de tempo';
      this.item.backgroundColor = undefined;
      return;
    }

    const elapsed = formatElapsed(this.timer.elapsedMs());
    const id = session.workItemId;

    if (session.isPaused) {
      this.item.text = `$(debug-pause) #${id} — ${elapsed} (pausado)`;
      this.item.tooltip = `${session.workItemTitle}\nClique para ver ações`;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.item.text = `$(clock) #${id} — ${elapsed}`;
      this.item.tooltip = `${session.workItemTitle}\nClique para ver ações`;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.activeBackground');
    }
  }

  dispose(): void {
    this.stop();
    this.item.dispose();
  }
}
