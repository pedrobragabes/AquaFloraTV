import { DeviceDetailDashboard } from './device-detail-dashboard';

type DeviceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DeviceDetailPage({ params }: DeviceDetailPageProps) {
  const { id } = await params;

  return <DeviceDetailDashboard deviceId={id} />;
}
