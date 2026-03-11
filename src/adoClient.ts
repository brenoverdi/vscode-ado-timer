import * as https from 'https';
import { AdoWorkItem } from './types';

export class AdoClient {
  private readonly org: string;
  private readonly project: string;
  private readonly authHeader: string;

  constructor(organization: string, project: string, pat: string) {
    this.org = organization;
    this.project = encodeURIComponent(project);
    this.authHeader = 'Basic ' + Buffer.from(':' + pat).toString('base64');
  }

  getWorkItem(id: number): Promise<AdoWorkItem> {
    const fields = [
      'System.Title',
      'System.State',
      'System.WorkItemType',
      'System.BoardColumn',
      'Microsoft.VSTS.Scheduling.CompletedWork',
      'Microsoft.VSTS.Scheduling.RemainingWork',
    ].join(',');

    const path = `/${this.org}/${this.project}/_apis/wit/workitems/${id}?api-version=7.1&fields=${encodeURIComponent(fields)}`;
    return this.request<AdoWorkItem>('GET', path);
  }

  async getWorkItemTypeStates(workItemType: string): Promise<string[]> {
    const path = `/${this.org}/${this.project}/_apis/wit/workitemtypes/${encodeURIComponent(workItemType)}/states?api-version=7.1`;
    const response = await this.request<{ value: Array<{ name: string }> }>('GET', path);
    return response.value.map(s => s.name);
  }

  patchWorkItem(id: number, completedWork: number, remainingWork: number): Promise<AdoWorkItem> {
    const body = JSON.stringify([
      { op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.CompletedWork', value: completedWork },
      { op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork', value: remainingWork },
    ]);
    const path = `/${this.org}/${this.project}/_apis/wit/workitems/${id}?api-version=7.1`;
    return this.request<AdoWorkItem>('PATCH', path, body, 'application/json-patch+json');
  }

  updateWorkItemState(id: number, newState: string): Promise<AdoWorkItem> {
    const body = JSON.stringify([
      {
        op: 'add',
        path: '/fields/System.State',
        value: newState,
      },
    ]);
    const path = `/${this.org}/${this.project}/_apis/wit/workitems/${id}?api-version=7.1`;
    return this.request<AdoWorkItem>('PATCH', path, body, 'application/json-patch+json');
  }

  private request<T>(method: string, path: string, body?: string, contentType?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: 'dev.azure.com',
        path,
        method,
        headers: {
          Authorization: this.authHeader,
          Accept: 'application/json',
          ...(body
            ? {
                'Content-Type': contentType ?? 'application/json',
                'Content-Length': Buffer.byteLength(body),
              }
            : {}),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`ADO API error ${res.statusCode}: ${data}`));
            return;
          }
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}
