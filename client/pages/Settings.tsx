import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Settings as SettingsIcon, Shield, Globe, Webhook } from 'lucide-react';
import GeneralSettings from './settings/GeneralSettings';
import SecuritySettings from './settings/SecuritySettings';
import ChannelsSettings from './settings/ChannelsSettings';
import WebhooksSettings from './settings/WebhooksSettings';

const settingsNav = [
  { name: 'Geral', href: '/settings/general', icon: SettingsIcon, roles: ['admin', 'attendant', 'client'] },
  { name: 'Segurança', href: '/settings/security', icon: Shield, roles: ['admin', 'attendant', 'client'] },
  { name: 'Canais', href: '/settings/channels', icon: Globe, roles: ['admin'] },
  { name: 'Webhooks', href: '/settings/webhooks', icon: Webhook, roles: ['admin'] },
];

export default function Settings() {
  const { user } = useAuth();

  const filteredNav = settingsNav.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Settings sidebar */}
      <aside className="w-full md:w-64 shrink-0">
        <nav className="space-y-1 bg-card rounded-lg p-2 border">
          {filteredNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Settings content */}
      <div className="flex-1">
        <Routes>
          <Route index element={<Navigate to="/settings/general" replace />} />
          <Route path="general" element={<GeneralSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="channels" element={<ChannelsSettings />} />
          <Route path="webhooks" element={<WebhooksSettings />} />
        </Routes>
      </div>
    </div>
  );
}
