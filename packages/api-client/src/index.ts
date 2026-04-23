import type { HealthResponse } from '@aquatv/types';

export interface ApiClientOptions {
  baseUrl: string;
  token?: string;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
  }

  async getHealth(): Promise<HealthResponse> {
    const init: RequestInit = {};

    if (this.token) {
      init.headers = { Authorization: `Bearer ${this.token}` };
    }

    const response = await fetch(`${this.baseUrl}/health`, init);

    if (!response.ok) {
      throw new Error(`Health request failed: ${response.status}`);
    }

    const data = (await response.json()) as HealthResponse;
    return data;
  }
}
