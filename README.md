# ADO Timer

A VSCode extension that tracks time spent on Azure DevOps work items directly from the editor status bar.

## Features

- Start a timer for any Azure DevOps work item by ID
- Live elapsed time display in the status bar
- Pause and resume tracking
- Stop and submit: automatically updates **CompletedWork** and **RemainingWork** on the work item
- Cancel without recording time
- Quick Pick menu accessible via a single status bar click
- Session persisted across VSCode restarts

## Requirements

- VSCode `^1.85.0`
- An Azure DevOps **Personal Access Token (PAT)** with at least **Work Items (Read & Write)** scope

## Setup

1. Install the extension.
2. Open **Settings** (`Ctrl+,`) and search for `adoTimer`.
3. Fill in the three required fields:

| Setting | Description | Example |
|---|---|---|
| `adoTimer.organization` | ADO organization name | `obitec` |
| `adoTimer.project` | ADO project name | `my-project` |
| `adoTimer.pat` | Personal Access Token | `xxxxxxxxxxxx` |

Or run the command **ADO Timer: Configurar** to open settings directly.

## Usage

All actions are available via the Command Palette (`Ctrl+Shift+P`) or by clicking the status bar item.

| Command | Description |
|---|---|
| **ADO Timer: Iniciar** | Prompt for a work item ID and start the timer |
| **ADO Timer: Pausar** | Pause the running timer |
| **ADO Timer: Retomar** | Resume a paused timer |
| **ADO Timer: Parar e Enviar** | Stop the timer and push the logged hours to ADO |
| **ADO Timer: Cancelar** | Discard the current timer without recording anything |
| **ADO Timer: Configurar** | Open the extension settings |

### Status bar states

| Display | Meaning |
|---|---|
| `$(clock) ADO Timer` | No active timer — click to start |
| `$(clock) #1234 — 00:42:15` | Timer running for work item #1234 |
| `$(debug-pause) #1234 — 00:42:15 (pausado)` | Timer paused |

### Stopping a timer

When you run **Parar e Enviar**, a confirmation dialog shows the time that will be logged and the new values for `CompletedWork` and `RemainingWork` before anything is sent to ADO.

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (recompiles on save)
npm run watch
```

Press `F5` in VSCode to open an Extension Development Host with the extension loaded.

## Author

Developed by **Breno Verdi**.

