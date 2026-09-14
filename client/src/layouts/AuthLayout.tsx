import { Outlet, Link } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold text-primary tracking-tight">
            MealMate
          </Link>
          <p className="text-sm text-muted-foreground mt-2 font-medium">Meal &amp; expense management for shared homes</p>
        </div>
        <div className="bg-card text-card-foreground rounded-2xl shadow-lg border border-border p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
