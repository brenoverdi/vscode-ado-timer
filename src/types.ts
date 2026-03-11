export interface TimerSession {
  workItemId: number;
  workItemTitle: string;
  startTime: number;       // Date.now() in ms
  pausedMs: number;        // Total accumulated paused ms
  isPaused: boolean;
  pauseStart?: number;     // If paused, the moment it was paused
  initialCompleted: number; // CompletedWork before start
  initialRemaining: number; // RemainingWork before start
}

export interface AdoWorkItem {
  id: number;
  fields: {
    'System.Title': string;
    'System.State'?: string;
    'System.WorkItemType'?: string;
    'System.BoardColumn'?: string;
    'Microsoft.VSTS.Scheduling.CompletedWork'?: number;
    'Microsoft.VSTS.Scheduling.RemainingWork'?: number;
  };
}

export interface WorkItemUpdate {
  completedWork: number;
  remainingWork: number;
}
