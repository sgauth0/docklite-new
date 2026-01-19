import { redirect } from 'next/navigation';

export default function DnsRedirectPage() {
  redirect('/network?tab=dns');
}
