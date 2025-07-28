import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to login page - this should be the first page users see
  // The login page will handle role-based redirects after authentication
  redirect('/auth/login');
} 