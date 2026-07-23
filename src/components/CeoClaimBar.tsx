import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { ShieldCheck, ShieldAlert, Key, LogOut, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export const CeoClaimBar: React.FC = () => {
  const navigate = useNavigate();
  const { currentRole, currentTeamId, activeClass, currentClassTeams, isReadOnly, isCeo, ceoName, claimCeoSlot, releaseCeoSlot, logout, selectTeam } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (currentRole !== 'STUDENT') {
    const teamsList = activeClass?.gameState?.teams || activeClass?.teamRegistry || [];
    const activeTeamObj = teamsList.find(t => t.id === currentTeamId);

    return (
      <div className="w-full bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 mb-6 shadow-md text-foreground relative overflow-hidden">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500" />
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Facilitator Control Mode</span>
              <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold">Full Edit & View Access</span>
            </div>
            <p className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-2">
              {activeTeamObj ? (
                <>
                  <span className="text-muted-foreground">Viewing & Editing:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold text-white shadow-sm" style={{ backgroundColor: activeTeamObj.color }}>
                    {activeTeamObj.name}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Viewing: <strong className="text-foreground">All Teams Overview</strong> (Select a team to focus inputs)</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-semibold">Team Focus:</span>
            <Select
              value={currentTeamId || 'all'}
              onValueChange={(val) => selectTeam(val === 'all' ? null : val)}
            >
              <SelectTrigger className="w-[180px] h-8 bg-background border-border text-foreground text-xs font-semibold">
                <SelectValue placeholder="Select Team" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="all" className="text-xs font-semibold">-- View All Teams --</SelectItem>
                {teamsList.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                      <span>{t.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  const team = (currentTeamId && currentClassTeams[currentTeamId])
    || activeClass?.teamRegistry?.find(t => t.id === currentTeamId)
    || activeClass?.gameState?.teams.find(t => t.id === currentTeamId);

  if (!team) {
    return (
      <div className="w-full bg-card border border-destructive/40 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 mb-6 shadow-md text-foreground">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h4 className="font-semibold text-destructive">Team Lookup Error</h4>
            <p className="text-xs text-muted-foreground">
              Your team ({currentTeamId}) could not be located in this class session. Please log out and re-enter your team access code, or contact your facilitator.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={logout} className="border-border hover:bg-muted text-foreground">
          Logout
        </Button>
      </div>
    );
  }

  const handleClaim = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (isSubmitting) return;
    
    console.log("handleClaim triggered with name:", nameInput, "newPin:", pinInput, "currentPin:", currentPinInput);
    if (!nameInput.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    if (!ceoName && !pinInput.trim()) {
      toast.error('Please choose a 4-digit PIN code.');
      return;
    }
    if (ceoName && !currentPinInput.trim()) {
      toast.error('Please enter the current PIN to authorize.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      console.log("Calling claimCeoSlot...");
      const success = await claimCeoSlot(nameInput.trim(), pinInput.trim() || undefined, ceoName ? currentPinInput.trim() : undefined);
      console.log("claimCeoSlot returned success:", success);
      if (success) {
        setIsOpen(false);
        setNameInput('');
        setPinInput('');
        setCurrentPinInput('');
      } else {
        toast.error('Failed to claim CEO seat. PIN code may be incorrect.');
      }
    } catch (err: any) {
      console.error('Error claiming CEO seat:', err);
      toast.error(err.message || 'Error claiming CEO seat');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 mb-6 shadow-md relative overflow-hidden">
      {/* Dynamic glow effect based on role */}
      <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${
        isCeo ? 'from-emerald-500 to-teal-500' : (ceoName ? 'from-amber-500 to-orange-500' : 'from-blue-500 to-indigo-500')
      }`} />

      <div className="flex items-center gap-3">
        {isCeo ? (
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role Status</span>
            <span
              className="w-2.5 h-2.5 rounded-full border border-border"
              style={{ backgroundColor: team.color }}
            />
            <span className="text-xs font-bold uppercase" style={{ color: team.color }}>
              {team.name}
            </span>
          </div>

          <p className="text-sm font-semibold text-foreground mt-0.5">
            {isCeo ? (
              <span className="text-emerald-600">You are the active CEO ({ceoName}) and have edit permissions.</span>
            ) : ceoName ? (
              <span className="text-amber-600">CEO {ceoName} is logged in. You are a viewing director (read-only).</span>
            ) : (
              <span className="text-muted-foreground">Viewing Director (read-only mode). No CEO claimed yet.</span>
            )}
          </p>
        </div>
      </div>

      <div>
        {isCeo ? (
          <Button
            variant="destructive"
            onClick={releaseCeoSlot}
            size="sm"
            className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 gap-1.5 h-8"
          >
            <LogOut className="h-4 w-4" />
            Release CEO Seat
          </Button>
        ) : (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold gap-1.5 shadow-lg shadow-blue-500/10">
                <Key className="h-4 w-4" />
                {ceoName ? 'Resume / Take Over CEO' : 'Claim CEO Seat'}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-sm">
              <DialogHeader>
                <DialogTitle>{ceoName ? 'Resume or Take Over CEO Spot' : 'Claim CEO Spot'}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {ceoName 
                    ? `This seat is currently claimed by ${ceoName}. Enter your name and the correct PIN to resume your session or take it over.` 
                    : 'Enter your name and choose a PIN code. You need this PIN to edit decisions.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleClaim} className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">CEO Full Name</label>
                  <Input
                    required
                    placeholder="e.g. Alice Smith"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="bg-background border-border text-foreground"
                  />
                </div>
                {ceoName && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Current CEO PIN Code</label>
                    <Input
                      required
                      type="password"
                      maxLength={4}
                      placeholder="e.g. 1235"
                      value={currentPinInput}
                      onChange={(e) => setCurrentPinInput(e.target.value)}
                      className="bg-background border-border text-foreground tracking-widest text-center font-mono"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {ceoName ? 'Choose New PIN Code (Optional)' : 'CEO 4-Digit PIN Code'}
                  </label>
                  <Input
                    type="password"
                    maxLength={4}
                    placeholder={ceoName ? 'Leave blank to keep current PIN' : 'e.g. 1234'}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="bg-background border-border text-foreground tracking-widest text-center font-mono"
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-border bg-background hover:bg-muted text-foreground">
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    {isSubmitting ? 'Claiming...' : 'Claim Seat'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};
