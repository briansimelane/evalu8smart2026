import React, { useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { ShieldCheck, ShieldAlert, Key, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export const CeoClaimBar: React.FC = () => {
  const { currentRole, currentTeamId, activeClass, isReadOnly, isCeo, ceoName, claimCeoSlot, releaseCeoSlot } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (currentRole !== 'STUDENT') return null;

  const team = activeClass?.gameState?.teams.find(t => t.id === currentTeamId);
  if (!team) return null;

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
                    required={!ceoName}
                    type="password"
                    maxLength={4}
                    placeholder={ceoName ? "Leave blank to keep current PIN" : "e.g. 1234"}
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
                    onClick={() => handleClaim()}
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
