import * as vscode from 'vscode';
import { TimerService } from './timer';
import { AdoClient } from './adoClient';
import { StatusBarManager } from './statusBar';

let timerService: TimerService;
let statusBar: StatusBarManager;

export function activate(ctx: vscode.ExtensionContext): void {
  timerService = new TimerService(ctx);
  statusBar = new StatusBarManager(timerService);

  // Restore interval if a session was active when VSCode closed
  if (timerService.isActive() && !timerService.isPaused()) {
    statusBar.start();
  } else {
    statusBar.refresh();
  }

  ctx.subscriptions.push(
    vscode.commands.registerCommand('adoTimer.start', cmdStart),
    vscode.commands.registerCommand('adoTimer.stop', cmdStop),
    vscode.commands.registerCommand('adoTimer.pause', cmdPause),
    vscode.commands.registerCommand('adoTimer.resume', cmdResume),
    vscode.commands.registerCommand('adoTimer.cancel', cmdCancel),
    vscode.commands.registerCommand('adoTimer.configure', cmdConfigure),
    vscode.commands.registerCommand('adoTimer.quickPick', cmdQuickPick),
    vscode.commands.registerCommand('adoTimer.changeStatus', cmdChangeStatus)
  );

  ctx.subscriptions.push({ dispose: () => statusBar.dispose() });
}

export function deactivate(): void {}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getAdoClient(): AdoClient | null {
  const cfg = vscode.workspace.getConfiguration('adoTimer');
  const org = cfg.get<string>('organization', '').trim();
  const project = cfg.get<string>('project', '').trim();
  const pat = cfg.get<string>('pat', '').trim();

  if (!org || !project || !pat) {
    vscode.window.showErrorMessage(
      'ADO Timer: Configure organização, projeto e PAT em Settings (adoTimer.*) antes de usar.',
      'Abrir Configurações'
    ).then((action) => {
      if (action === 'Abrir Configurações') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'adoTimer');
      }
    });
    return null;
  }

  return new AdoClient(org, project, pat);
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function cmdStart(): Promise<void> {
  if (timerService.isActive()) {
    vscode.window.showWarningMessage('ADO Timer: Um timer já está ativo. Pare ou cancele-o primeiro.');
    return;
  }

  const idStr = await vscode.window.showInputBox({
    prompt: 'ID do Work Item (Azure DevOps)',
    placeHolder: 'ex: 1234',
    validateInput: (v) => (/^\d+$/.test(v.trim()) ? null : 'Informe apenas o número do work item'),
  });
  if (!idStr) return;

  const client = getAdoClient();
  if (!client) return;

  const id = parseInt(idStr.trim(), 10);

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `ADO Timer: Carregando WI #${id}...` },
    async () => {
      const wi = await client.getWorkItem(id);
      const title = wi.fields['System.Title'] ?? `Work Item #${id}`;
      const completed = wi.fields['Microsoft.VSTS.Scheduling.CompletedWork'] ?? 0;
      const remaining = wi.fields['Microsoft.VSTS.Scheduling.RemainingWork'] ?? 0;

      timerService.start(id, title, completed, remaining);
      statusBar.start();
      vscode.window.showInformationMessage(`ADO Timer iniciado: #${id} — ${title}`);
    }
  ).then(undefined, (err: Error) => {
    vscode.window.showErrorMessage(`ADO Timer: Erro ao carregar WI #${id}: ${err.message}`);
  });
}

async function cmdChangeStatusAndUpdateTime(): Promise<void> {
  if (!timerService.isActive()) {
    vscode.window.showWarningMessage('ADO Timer: Nenhum timer ativo.');
    return;
  }
  const session = timerService.getSession()!;
  const client = getAdoClient();
  if (!client) return;
  const wi = await client.getWorkItem(session.workItemId);
  const currentState = wi.fields['System.State'] ?? 'Unknown';
  const workItemType = wi.fields['System.WorkItemType'] ?? '';
  const allStates = await client.getWorkItemTypeStates(workItemType);
  const stateItems = allStates.map(s => ({ label: s, description: s === currentState ? '(atual)' : undefined }));
  const picked = await vscode.window.showQuickPick(stateItems, { placeHolder: `Estado atual: ${currentState} — selecione o novo estado` });
  if (!picked) return;
  await client.updateWorkItemState(session.workItemId, picked.label);
  vscode.window.showInformationMessage(`ADO Timer: Estado de #${session.workItemId} atualizado para "${picked.label}".`);
  const forceZero = picked.label === 'Resolved' || picked.label === 'Closed';
  await cmdStop(forceZero);
}

async function cmdChangeStatus(): Promise<void> {

    const idStr = await vscode.window.showInputBox({
    prompt: 'ID do Work Item (Azure DevOps)',
    placeHolder: 'ex: 1234',
    validateInput: (v) => (/^\d+$/.test(v.trim()) ? null : 'Informe apenas o número do work item'),
  });
  if (!idStr) return;

  const id = parseInt(idStr.trim(), 10);


  const client = getAdoClient();
  if (!client) return;
  const wi = await client.getWorkItem(id);
  const currentState = wi.fields['System.State'] ?? 'Unknown';
  const workItemType = wi.fields['System.WorkItemType'] ?? '';
  const allStates = await client.getWorkItemTypeStates(workItemType);
  const stateItems = allStates.map(s => ({ label: s, description: s === currentState ? '(atual)' : undefined }));
  const picked = await vscode.window.showQuickPick(stateItems, { placeHolder: `Estado atual: ${currentState} — selecione o novo estado` });
  if (!picked) return;
  await client.updateWorkItemState(id, picked.label);
  if (picked.label === 'Resolved' || picked.label === 'Closed') {
    const completedWork = wi.fields['Microsoft.VSTS.Scheduling.CompletedWork'] ?? 0;
    await client.patchWorkItem(id, completedWork, 0);
  }
  vscode.window.showInformationMessage(`ADO Timer: Estado de #${id} atualizado para "${picked.label}".`);
}

async function cmdStop(forceRemainingZero = false): Promise<void> {
  if (!timerService.isActive()) {
    vscode.window.showWarningMessage('ADO Timer: Nenhum timer ativo.');
    return;
  }

  // Resume to get accurate elapsed if paused
  if (timerService.isPaused()) timerService.resume();

  const session = timerService.getSession()!;
  const elapsedH = Math.ceil(timerService.elapsedHours() * 2) / 2;
  const elapsedDisplay = elapsedH.toFixed(2);

  const newCompleted = session.initialCompleted + elapsedH;
  const newRemaining = forceRemainingZero ? 0 : Math.max(0, session.initialRemaining - elapsedH);

  const confirm = await vscode.window.showInformationMessage(
    `Registrar ${elapsedDisplay}h em #${session.workItemId} — "${session.workItemTitle}"?\n` +
      `CompletedWork: ${session.initialCompleted.toFixed(2)}h → ${newCompleted.toFixed(2)}h\n` +
      `RemainingWork: ${session.initialRemaining.toFixed(2)}h → ${newRemaining.toFixed(2)}h`,
    { modal: true },
    'Confirmar',
    'Cancelar'
  );

  if (confirm !== 'Confirmar') return;

  const client = getAdoClient();
  if (!client) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'ADO Timer: Enviando para o ADO...' },
    async () => {
      await client.patchWorkItem(session.workItemId, newCompleted, newRemaining);
      timerService.clear();
      statusBar.stop();
      vscode.window.showInformationMessage(
        `ADO Timer: ${elapsedDisplay}h registrado em #${session.workItemId} com sucesso!`
      );
    }
  ).then(undefined, (err: Error) => {
    timerService.clear();
    statusBar.stop();
    vscode.window.showErrorMessage(`ADO Timer: Erro ao enviar para o ADO: ${err.message}`);
  });
}

function cmdPause(): void {
  if (!timerService.isRunning()) {
    vscode.window.showWarningMessage('ADO Timer: Timer não está rodando.');
    return;
  }
  timerService.pause();
  statusBar.stop();
  statusBar.refresh();
  vscode.window.showInformationMessage('ADO Timer pausado.');
}

function cmdResume(): void {
  if (!timerService.isPaused()) {
    vscode.window.showWarningMessage('ADO Timer: Timer não está pausado.');
    return;
  }
  timerService.resume();
  statusBar.start();
  vscode.window.showInformationMessage('ADO Timer retomado.');
}

async function cmdCancel(): Promise<void> {
  if (!timerService.isActive()) {
    vscode.window.showWarningMessage('ADO Timer: Nenhum timer ativo.');
    return;
  }

  const session = timerService.getSession()!;
  const confirm = await vscode.window.showWarningMessage(
    `Cancelar timer de #${session.workItemId} — "${session.workItemTitle}"? O tempo não será registrado.`,
    { modal: true },
    'Cancelar Timer'
  );

  if (confirm === 'Cancelar Timer') {
    timerService.clear();
    statusBar.stop();
    vscode.window.showInformationMessage('ADO Timer cancelado.');
  }
}

async function cmdConfigure(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.openSettings', 'adoTimer');
}

async function cmdQuickPick(): Promise<void> {
  const items: vscode.QuickPickItem[] = [];

  if (!timerService.isActive()) {
    items.push({ label: '$(play) Iniciar', description: 'Iniciar rastreamento de um work item' });
    items.push({ label: '$(check) Mudar status de um item', description: 'Mudar o status de um work item' });

  } else if (timerService.isRunning()) {
    items.push(
      { label: '$(debug-pause) Pausar', description: 'Pausar o timer' },
      { label: '$(check) Parar e Enviar', description: 'Parar e registrar o tempo no ADO' },
      { label: '$(check) Mudar o status da tarefa', description: 'Mudar o status da tarefa' },
      { label: '$(close) Cancelar', description: 'Descartar o timer sem registrar' },
    );
  } else {
    items.push(
      { label: '$(debug-continue) Retomar', description: 'Retomar o timer pausado' },
      { label: '$(check) Parar e Enviar', description: 'Parar e registrar o tempo no ADO' },
      { label: '$(check) Atualizar tempo e mudar o status da tarefa', description: 'Atualizar tempo e mudar o status da tarefa' },
      { label: '$(close) Cancelar', description: 'Descartar o timer sem registrar' },
    );
  }
  items.push({ label: '$(settings-gear) Configurar', description: 'Abrir configurações ADO Timer' });

  const picked = await vscode.window.showQuickPick(items, { placeHolder: 'ADO Timer — selecione uma ação' });
  if (!picked) return;

  if (picked.label.includes('Iniciar')) return cmdStart();
  if (picked.label.includes('Mudar status') && !timerService.isActive()) return cmdChangeStatus();
  if (picked.label.includes('Mudar o status') && timerService.isActive()) return cmdChangeStatusAndUpdateTime();
  if (picked.label.includes('Pausar')) return cmdPause();
  if (picked.label.includes('Retomar')) return cmdResume();
  if (picked.label.includes('Parar')) return cmdStop();
  if (picked.label.includes('Cancelar')) return cmdCancel();
  if (picked.label.includes('Configurar')) return cmdConfigure();
  if (picked.label.includes('Atualizar tempo')) return cmdChangeStatusAndUpdateTime();
}
