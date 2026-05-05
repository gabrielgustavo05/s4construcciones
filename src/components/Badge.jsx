import { badgeClass } from '../lib/helpers';

export default function Badge({ estado }) {
  return (
    <span className={`b ${badgeClass(estado)}`}>{estado}</span>
  );
}
