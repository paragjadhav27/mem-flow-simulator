
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MemoryBlock, MemoryManager } from '@/lib/memory-manager';

const Index = () => {
  const { toast } = useToast();
  const [memoryManager, setMemoryManager] = useState<MemoryManager | null>(null);
  const [totalMemory, setTotalMemory] = useState<number>(1000);
  const [processId, setProcessId] = useState<string>('');
  const [memorySize, setMemorySize] = useState<number | ''>('');
  const [fitType, setFitType] = useState<string>('first');
  const [processToFree, setProcessToFree] = useState<string>('');
  const [allocatedProcesses, setAllocatedProcesses] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('setup');
  const [logs, setLogs] = useState<{message: string, type: string}[]>([
    {message: 'System started. Initialize memory to begin.', type: 'info'}
  ]);
  const [stats, setStats] = useState({
    total: 0,
    used: 0,
    usedPercent: 0,
    free: 0,
    freePercent: 0,
    fragmentation: 0
  });
  const [showCompactionDialog, setShowCompactionDialog] = useState(false);
  const [smallFragments, setSmallFragments] = useState(0);
  const [totalSmallFragmentSize, setTotalSmallFragmentSize] = useState(0);
  const [compactionThreshold, setCompactionThreshold] = useState(4000);
  
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Initialize memory manager
  useEffect(() => {
    const manager = new MemoryManager();
    setMemoryManager(manager);
  }, []);

  // Auto-scroll log container
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const logMessage = (message: string, type: string = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [...prevLogs, { message: `[${timestamp}] ${message}`, type }]);
  };

  const initializeMemory = () => {
    if (!memoryManager) return;
    
    if (isNaN(totalMemory) || totalMemory <= 0) {
      toast({
        title: "Invalid input",
        description: "Total memory size must be a positive number.",
        variant: "destructive"
      });
      return;
    }

    memoryManager.initMemory(totalMemory);
    updateUIState();
    logMessage(`Memory initialized with size ${totalMemory} bytes.`, 'info');
    setActiveTab('allocate');
  };

  const allocateMemory = () => {
    if (!memoryManager) return;
    
    if (memoryManager.memory.length === 0) {
      toast({
        title: "Memory not initialized",
        description: "Please initialize memory first.",
        variant: "destructive"
      });
      setActiveTab('setup');
      return;
    }

    const size = typeof memorySize === 'number' ? memorySize : 0;
    
    if (size <= 0) {
  toast({
    title: "Invalid input",
    description: "Size must be greater than 0.",
    variant: "destructive"
  });
  return;
} else if (size > stats.free) { // Use stats.free instead of undefined variable
  toast({
    title: "Insufficient memory",
    description: `Size exceeds available free memory (${stats.free} bytes).`,
    variant: "destructive"
  });
  return;
}
    
    if (!processId.trim()) {
      toast({
        title: "Invalid input",
        description: "Process ID cannot be empty.",
        variant: "destructive"
      });
      return;
    }
    
    // Check if process ID already exists
    if (allocatedProcesses.includes(processId)) {
      toast({
        title: "Invalid input",
        description: `Process ID "${processId}" already exists.`,
        variant: "destructive"
      });
      return;
    }

    const success = memoryManager.allocate(processId, size, fitType);
    
    if (success) {
      setProcessId('');
      setMemorySize('');
      logMessage(`Allocated ${size} bytes to ${processId} using ${fitType} Fit.`, 'success');
      updateUIState();
      
      // Check for fragmentation after allocation
      checkForFragmentation();
    }
  };

  const deallocateMemory = () => {
    if (!memoryManager) return;
    
    if (memoryManager.memory.length === 0) {
      toast({
        title: "Memory not initialized",
        description: "Please initialize memory first.",
        variant: "destructive"
      });
      setActiveTab('setup');
      return;
    }
    
    if (!processToFree) {
      toast({
        title: "Invalid input",
        description: "Please select a process to free.",
        variant: "destructive"
      });
      return;
    }
    
    const success = memoryManager.deallocate(processToFree);
    
    if (success) {
      logMessage(`Deallocated process ${processToFree}.`, 'info');
      updateUIState();
      
      // Check for fragmentation after deallocation
      checkForFragmentation();
    }
  };

  const compactMemory = () => {
    if (!memoryManager) return;
    
    const success = memoryManager.compactMemory(compactionThreshold);
    
    if (success) {
      logMessage(`Memory compaction completed. Consolidated ${smallFragments} fragments (${totalSmallFragmentSize} bytes).`, 'success');
      updateUIState();
      setShowCompactionDialog(false);
    } else {
      logMessage('Memory compaction failed or was not needed.', 'error');
    }
  };

  const checkForFragmentation = () => {
    if (!memoryManager) return;
    
    const { fragmentCount, totalSize } = memoryManager.checkSmallFragments(compactionThreshold);
    
    if (fragmentCount > 0) {
      setSmallFragments(fragmentCount);
      setTotalSmallFragmentSize(totalSize);
      setShowCompactionDialog(true);
    }
  };

  const updateUIState = () => {
    if (!memoryManager) return;
    
    // Update allocated processes list
    const processes = new Set<string>();
    for (const block of memoryManager.memory) {
      if (!block.free && block.pid !== "None") {
        processes.add(block.pid);
      }
    }
    setAllocatedProcesses(Array.from(processes));
    
    // Update stats
    const stats = memoryManager.calculateStats();
    setStats(stats);
  };

  const renderMemoryBlocks = () => {
    if (!memoryManager) return null;
    
    return memoryManager.memory.map((block, index) => {
      const percentage = (block.size / (memoryManager.totalSize || 1)) * 100;
      const startPercentage = (block.startAddress / (memoryManager.totalSize || 1)) * 100;
      
      return (
        <div 
          key={index}
          className={`absolute h-full flex items-center justify-center transition-all duration-300 ease-in-out overflow-hidden text-xs font-semibold text-white border-r border-white/30 ${block.free ? 'bg-blue-500' : 'bg-red-500'}`}
          style={{
            left: `${startPercentage}%`,
            width: `${percentage}%`,
            backgroundColor: block.free ? undefined : memoryManager.processColors[block.pid]
          }}
        >
          <span>{block.free ? `Free: ${block.size}` : `${block.pid}: ${block.size}`}</span>
        </div>
      );
    });
  };

  const renderNextFitPointer = () => {
    if (!memoryManager || memoryManager.memory.length === 0) return null;
    
    let pointerPos = 0;
    for (let i = 0; i < memoryManager.nextFitIndex; i++) {
      pointerPos += memoryManager.memory[i].size;
    }
    
    // Add half of the current block's size to center the pointer
    if (memoryManager.nextFitIndex < memoryManager.memory.length) {
      pointerPos += memoryManager.memory[memoryManager.nextFitIndex].size / 2;
    }
    
    const pointerPercentage = (pointerPos / (memoryManager.totalSize || 1)) * 100;
    
    return (
      <div 
        className="absolute -top-4 w-0 h-0 border-l-8 border-r-8 border-t-[12px] border-l-transparent border-r-transparent border-t-orange-500 transform -translate-x-1/2 transition-all duration-300 ease-in-out"
        style={{ left: `${pointerPercentage}%` }}
      />
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">Memory Allocation Simulator</h1>
        
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-4 mb-6">
            <TabsTrigger value="setup">Memory Setup</TabsTrigger>
            <TabsTrigger value="allocate">Allocate Memory</TabsTrigger>
            <TabsTrigger value="deallocate">Deallocate Memory</TabsTrigger>
            <TabsTrigger value="visualization">Visualization</TabsTrigger>
          </TabsList>
          
          <TabsContent value="setup">
            <Card>
              <CardHeader>
                <CardTitle>Initialize Memory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                  <div className="flex-1">
                    <Label htmlFor="totalMemory">Total Memory Size (bytes):</Label>
                    <Input 
                      id="totalMemory" 
                      type="number" 
                      min="10" 
                      value={totalMemory} 
                      onChange={(e) => setTotalMemory(parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={initializeMemory}>Initialize Memory</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="allocate">
            <Card>
              <CardHeader>
                <CardTitle>Allocate Memory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label htmlFor="processId">Process ID:</Label>
                    <Input 
                      id="processId" 
                      placeholder="e.g., P1" 
                      value={processId}
                      onChange={(e) => setProcessId(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="memorySize">Memory Size (bytes):</Label>
                    <Input 
                      id="memorySize" 
                      type="number" 
                      min="1" 
                      value={memorySize}
                      onChange={(e) => setMemorySize(e.target.value ? parseInt(e.target.value) : '')}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fitType">Allocation Algorithm:</Label>
                    <Select value={fitType} onValueChange={setFitType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first">First Fit</SelectItem>
                        <SelectItem value="next">Next Fit</SelectItem>
                        <SelectItem value="best">Best Fit</SelectItem>
                        <SelectItem value="worst">Worst Fit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={allocateMemory} className="bg-green-500 hover:bg-green-600">Allocate Memory</Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="deallocate">
            <Card>
              <CardHeader>
                <CardTitle>Deallocate Memory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="processToFree">Select Process to Free:</Label>
                    <Select value={processToFree} onValueChange={setProcessToFree}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={allocatedProcesses.length ? "Select a process" : "No processes allocated"} />
                      </SelectTrigger>
                      <SelectContent>
                        {allocatedProcesses.length === 0 ? (
                          <SelectItem value="" disabled>No processes allocated</SelectItem>
                        ) : (
                          allocatedProcesses.map((pid) => (
                            <SelectItem key={pid} value={pid}>{pid}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button 
                    onClick={deallocateMemory} 
                    className="bg-red-500 hover:bg-red-600"
                    disabled={allocatedProcesses.length === 0}
                  >
                    Deallocate Memory
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      const { fragmentCount, totalSize } = memoryManager?.checkSmallFragments(compactionThreshold) || { fragmentCount: 0, totalSize: 0 };
                      setSmallFragments(fragmentCount);
                      setTotalSmallFragmentSize(totalSize);
                      if (fragmentCount > 0) {
                        setShowCompactionDialog(true);
                      } else {
                        toast({
                          title: "No compaction needed",
                          description: `No memory fragments smaller than ${compactionThreshold} bytes found.`,
                        });
                      }
                    }} 
                    variant="outline"
                  >
                    Check for Fragmentation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="visualization">
            <Card>
              <CardHeader>
                <CardTitle>Memory Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-100 p-4 rounded-lg border-l-4 border-blue-500">
                    <h3 className="text-sm text-gray-500 mb-2">Total Memory</h3>
                    <p className="text-xl font-bold">{stats.total} bytes</p>
                  </div>
                  <div className="bg-gray-100 p-4 rounded-lg border-l-4 border-red-500">
                    <h3 className="text-sm text-gray-500 mb-2">Used Memory</h3>
                    <p className="text-xl font-bold">{stats.used} bytes ({stats.usedPercent}%)</p>
                  </div>
                  <div className="bg-gray-100 p-4 rounded-lg border-l-4 border-green-500">
                    <h3 className="text-sm text-gray-500 mb-2">Free Memory</h3>
                    <p className="text-xl font-bold">{stats.free} bytes ({stats.freePercent}%)</p>
                  </div>
                  <div className="bg-gray-100 p-4 rounded-lg border-l-4 border-purple-500">
                    <h3 className="text-sm text-gray-500 mb-2">Fragmentation</h3>
                    <p className="text-xl font-bold">{stats.fragmentation}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Memory Visualization</h2>
          
          <div className="flex flex-wrap gap-6 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-500 rounded"></div>
              <span>Free Memory</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-500 rounded"></div>
              <span>Allocated Memory</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-orange-500 rounded"></div>
              <span>Next Fit Pointer</span>
            </div>
          </div>
          
          <div className="relative h-20 bg-gray-100 rounded-lg shadow-inner mb-2 overflow-hidden">
            {renderNextFitPointer()}
            {renderMemoryBlocks()}
          </div>
          
          <div className="flex justify-between text-xs text-gray-500 mb-8">
            <span>0</span>
            <span>{memoryManager?.totalSize || 0}</span>
          </div>
        </div>
        
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Memory Blocks</h2>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Block #</TableHead>
                  <TableHead>Start Address</TableHead>
                  <TableHead>End Address</TableHead>
                  <TableHead>Size (bytes)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Process ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memoryManager?.memory.map((block, index) => {
                  const endAddress = block.startAddress + block.size - 1;
                  return (
                    <TableRow key={index} className={index === memoryManager.nextFitIndex ? "bg-orange-50" : undefined}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{block.startAddress}</TableCell>
                      <TableCell>{endAddress}</TableCell>
                      <TableCell>{block.size}</TableCell>
                      <TableCell>{block.free ? 'Free' : 'Allocated'}</TableCell>
                      <TableCell>{block.pid}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Operation Log</h2>
          <div 
            ref={logContainerRef}
            className="h-48 overflow-y-auto border rounded-lg p-4 bg-gray-50"
          >
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`py-1 border-b border-gray-100 font-mono text-sm ${
                  log.type === 'error' ? 'text-red-600' : 
                  log.type === 'success' ? 'text-green-600' : 
                  'text-blue-600'
                }`}
              >
                {log.message}
              </div>
            ))}
          </div>
        </div>
        
        <Dialog open={showCompactionDialog} onOpenChange={setShowCompactionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Memory Fragmentation Detected</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>Found {smallFragments} small memory fragments (less than {compactionThreshold} bytes) totaling {totalSmallFragmentSize} bytes.</p>
              <p className="mt-2">Would you like to compact the memory to reduce fragmentation?</p>
              
              <div className="mt-4">
                <Label htmlFor="compactionThreshold">Fragment Size Threshold (bytes):</Label>
                <Input 
                  id="compactionThreshold" 
                  type="number" 
                  min="1" 
                  value={compactionThreshold} 
                  onChange={(e) => setCompactionThreshold(parseInt(e.target.value) || 4)}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCompactionDialog(false)}>Cancel</Button>
              <Button onClick={compactMemory}>Compact Memory</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Index;
