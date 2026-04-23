export type MediaKind = 'video' | 'image';

export interface DeviceStatus {
  id: string;
  name: string;
  online: boolean;
  freeDiskMb?: number;
  appVersion?: string;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
}
