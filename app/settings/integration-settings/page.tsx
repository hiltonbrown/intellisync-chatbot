import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function IntegrationSettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Integration Settings</CardTitle>
          <CardDescription>
            Manage integrations with third-party services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Integration settings will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
