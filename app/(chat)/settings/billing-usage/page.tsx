import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function BillingUsagePage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Billing and Usage</CardTitle>
          <CardDescription>
            View your billing information and usage statistics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Billing and usage details will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
