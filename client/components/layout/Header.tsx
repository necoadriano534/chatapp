import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Button } from '../ui/button';
import { LogOut, Moon, Sun } from 'lucide-react';

export default function Header() {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 h-16 bg-background border-b flex items-center justify-between px-4 md:px-6">
      <div className="md:hidden w-10" /> {/* Spacer for mobile menu button */}
      
      <div className="flex-1 md:flex-none">
        <h1 className="text-lg font-semibold md:hidden text-center">ChatApp</h1>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        <span className="hidden md:inline text-sm text-muted-foreground">
          {user?.name}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          aria-label="Logout"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
