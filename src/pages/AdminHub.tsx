import React from 'react';
import { useSession } from '@/contexts/SessionContext';
import { Trash2, ShieldAlert, LogOut, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

export const AdminHub: React.FC = () => {
  const { classes, deleteClass, logout } = useSession();

  const handleDeleteClass = async (id: string, name: string) => {
    if (confirm(`ADMIN FORCE: Are you sure you want to permanently delete class "${name}"?`)) {
      try {
        await deleteClass(id);
        toast.success(`Class "${name}" has been permanently deleted.`);
      } catch (err) {
        toast.error('Failed to delete class.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      {/* Top Navbar */}
      <div className="flex items-center justify-between border-b border-border pb-5 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-red-600">
              System Admin Control Room
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Master settings and global classes overview</p>
          </div>
        </div>
        <Button variant="destructive" onClick={logout} className="gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>

      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl text-foreground flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-red-600" />
              All System Classes ({classes.length})
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              List of all sessions currently active on this server database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No classes exist in the database.</p>
            ) : (
              <Table className="border border-border">
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border">
                    <TableHead className="text-foreground font-semibold">Class Name</TableHead>
                    <TableHead className="text-foreground font-semibold">Facilitator Code</TableHead>
                    <TableHead className="text-foreground font-semibold">Teams Count</TableHead>
                    <TableHead className="text-foreground font-semibold">Created Date</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((cls) => (
                    <TableRow key={cls.id} className="border-border hover:bg-muted/10 transition-colors">
                      <TableCell className="font-semibold text-foreground">{cls.name}</TableCell>
                      <TableCell className="font-mono text-emerald-700 font-bold tracking-wider">
                        {cls.facilitatorCode}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {cls.gameState?.teams?.length || 0} teams
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(cls.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => handleDeleteClass(cls.id, cls.name)}
                          className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
