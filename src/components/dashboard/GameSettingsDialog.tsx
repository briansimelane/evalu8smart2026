import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, DollarSign, Package, Wrench, Microscope, Truck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGame } from '@/contexts/GameContext';
import { Combination, COMBINATIONS as DEFAULT_COMBINATIONS } from '@/data/combinations';
import { toast } from 'sonner';

export function GameSettingsDialog() {
  const { getCombinations, updateCombinations } = useGame();
  
  // Local state for combinations editor
  const [editedCombinations, setEditedCombinations] = useState<Combination[]>([]);
  const [activeComboGroup, setActiveComboGroup] = useState('1');

  // Initialize editable copy when dialog opened or external context updates
  useEffect(() => {
    setEditedCombinations([...getCombinations()]);
  }, [getCombinations]);

  const handleCombinationChange = (comboNum: number, posNum: number, field: keyof Combination, value: string) => {
    const numValue = parseInt(value) || 0;
    setEditedCombinations(prev => prev.map(c => 
      (c.combination === comboNum && c.position === posNum) ? { ...c, [field]: numValue } : c
    ));
  };

  const saveCombinations = () => {
    updateCombinations(editedCombinations);
    toast.success('Combinations updated and synced to the Game Database.');
  };

  const resetCombinations = () => {
    if (confirm('Are you sure you want to reset all combinations to their original hardcoded defaults?')) {
      updateCombinations(null);
      setEditedCombinations([...DEFAULT_COMBINATIONS]);
      toast.info('Combinations reset to original defaults.');
    }
  };

  // Extract the specific 14 positions for the active combination tab
  const currentComboRows = editedCombinations.filter(c => c.combination === parseInt(activeComboGroup));

  const getHeatmapColor = (field: keyof Combination, value: number) => {
    if (field === 'price') {
      if (value <= -2) return 'bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-100';
      if (value === -1) return 'bg-red-100 dark:bg-red-800/40 text-red-900 dark:text-red-100';
      if (value === 0) return 'bg-transparent';
      return 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100';
    }
    
    if (field === 'products') {
      if (value <= 2) return 'bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-100';
      if (value === 3) return 'bg-orange-100 dark:bg-orange-900/40 text-orange-900 dark:text-orange-100';
      if (value === 4) return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100';
      if (value === 5) return 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100';
      return 'bg-green-200 dark:bg-green-800/40 text-green-900 dark:text-green-100';
    }

    // improve, research, logistics
    if (value <= 0) return 'bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-100';
    if (value === 1) return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100';
    if (value === 2) return 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100';
    return 'bg-green-200 dark:bg-green-800/40 text-green-900 dark:text-green-100';
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="hover:bg-secondary hover:text-white transition-colors" title="Game Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Game Settings</DialogTitle>
          <DialogDescription>
            Configure combinations, improvement cards, and global game rules here. Changes sync to all Teams.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="combinations" className="mt-4 w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="combinations">Combinations</TabsTrigger>
            <TabsTrigger value="cards">Improvement Cards</TabsTrigger>
            <TabsTrigger value="rules">Rules Adjustment</TabsTrigger>
          </TabsList>
          
          <TabsContent value="combinations" className="p-4 bg-secondary/10 rounded-lg mt-2 min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Combinations Setup</h3>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={resetCombinations}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Original
                </Button>
                <Button variant="default" size="sm" onClick={saveCombinations}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <Label>Editing Combination Group:</Label>
              <Select value={activeComboGroup} onValueChange={setActiveComboGroup}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select combination" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                    <SelectItem key={num} value={num.toString()}>Combination {num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-md overflow-x-auto bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground text-xs">
                  <tr>
                    <th className="px-4 py-3 text-center w-24 uppercase font-bold tracking-wider">Pos</th>
                    <th className="px-4 py-3 text-center" title="Price Effect"><DollarSign className="h-5 w-5 mx-auto text-red-500" /></th>
                    <th className="px-4 py-3 text-center" title="Products"><Package className="h-5 w-5 mx-auto text-black dark:text-white" /></th>
                    <th className="px-4 py-3 text-center" title="Improve Yield"><Wrench className="h-5 w-5 mx-auto text-yellow-500" /></th>
                    <th className="px-4 py-3 text-center" title="Research Yield"><Microscope className="h-5 w-5 mx-auto text-purple-500" /></th>
                    <th className="px-4 py-3 text-center" title="Logistics Yield"><Truck className="h-5 w-5 mx-auto text-blue-500" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {currentComboRows.map((row) => (
                    <tr key={`${row.combination}-${row.position}`} className="even:bg-muted/40 hover:bg-muted/60 transition-colors">
                      <td className="px-4 py-2 text-center font-bold text-muted-foreground">{row.position}</td>
                      <td className="px-4 py-2">
                        <Input 
                          type="number" 
                          value={row.price} 
                          onChange={(e) => handleCombinationChange(row.combination, row.position, 'price', e.target.value)}
                          className={`w-20 form-input h-8 font-mono text-center mx-auto transition-colors focus-visible:ring-offset-1 ${getHeatmapColor('price', row.price)}`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input 
                          type="number" 
                          value={row.products} 
                          onChange={(e) => handleCombinationChange(row.combination, row.position, 'products', e.target.value)}
                          className={`w-20 form-input h-8 font-mono text-center mx-auto transition-colors focus-visible:ring-offset-1 ${getHeatmapColor('products', row.products)}`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input 
                          type="number" 
                          value={row.improve} 
                          onChange={(e) => handleCombinationChange(row.combination, row.position, 'improve', e.target.value)}
                          className={`w-20 form-input h-8 font-mono text-center mx-auto transition-colors focus-visible:ring-offset-1 ${getHeatmapColor('improve', row.improve)}`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input 
                          type="number" 
                          value={row.research} 
                          onChange={(e) => handleCombinationChange(row.combination, row.position, 'research', e.target.value)}
                          className={`w-20 form-input h-8 font-mono text-center mx-auto transition-colors focus-visible:ring-offset-1 ${getHeatmapColor('research', row.research)}`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input 
                          type="number" 
                          value={row.logistics} 
                          onChange={(e) => handleCombinationChange(row.combination, row.position, 'logistics', e.target.value)}
                          className={`w-20 form-input h-8 font-mono text-center mx-auto transition-colors focus-visible:ring-offset-1 ${getHeatmapColor('logistics', row.logistics)}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </TabsContent>
          
          <TabsContent value="cards" className="p-4 bg-secondary/10 rounded-lg mt-2 min-h-[400px]">
            <h3 className="text-lg font-semibold mb-2">Improvement Cards</h3>
            <p className="text-sm text-muted-foreground">
              (Settings interface for managing and allocating improvement cards will be implemented here)
            </p>
          </TabsContent>
          
          <TabsContent value="rules" className="p-4 bg-secondary/10 rounded-lg mt-2 min-h-[400px]">
            <h3 className="text-lg font-semibold mb-2">Rules Adjustment</h3>
            <p className="text-sm text-muted-foreground">
              (Settings interface for configuring initial start cash, regions max caps, and tech costs will be implemented here)
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
