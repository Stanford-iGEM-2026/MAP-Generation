import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_layout/_auth')({
  component: AuthRoute,
});

function AuthRoute() {
  return <Outlet />;
}
