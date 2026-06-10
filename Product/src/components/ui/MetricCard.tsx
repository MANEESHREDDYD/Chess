import { Card } from './Card';

type MetricCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  action?: string;
};

export function MetricCard({ label, value, helper, action }: MetricCardProps) {
  return (
    <Card className="ui-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <p>{helper}</p> : null}
      {action ? <small>{action}</small> : null}
    </Card>
  );
}
