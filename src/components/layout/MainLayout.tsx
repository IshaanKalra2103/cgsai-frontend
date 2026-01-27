import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Leaf, LogOut, FileSearch, FolderOpen, Settings } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = location.pathname === '/admin' ? 'admin' : 
                     location.pathname === '/documents' ? 'documents' : 'evaluation';

  const handleTabChange = (value: string) => {
    if (value === 'evaluation') navigate('/');
    else if (value === 'documents') navigate('/documents');
    else if (value === 'admin') navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Leaf className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">CGS AI</h1>
                <p className="text-sm text-muted-foreground">Methane Mitigation Paper Evaluator</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{user?.email}</p>
                <Badge variant="outline" className="text-xs capitalize">
                  {user?.role}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4">
          <Tabs value={currentTab} onValueChange={handleTabChange}>
            <TabsList className="h-12 bg-transparent gap-2">
              <TabsTrigger 
                value="evaluation" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
              >
                <FileSearch className="h-4 w-4" />
                Evaluation
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                Document Hub
              </TabsTrigger>
              {user?.role === 'admin' && (
                <TabsTrigger 
                  value="admin" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Admin
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
