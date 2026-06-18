import { TopBar } from '@/components/layout/TopBar';
import { SubscriberTable } from '@/components/subscribers/SubscriberTable';

export default function SubscribersPage() {
  return (
    <div>
      <TopBar title="Subscribers" />
      <div className="p-6">
        <SubscriberTable />
      </div>
    </div>
  );
}
