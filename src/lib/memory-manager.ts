export class MemoryBlock {
  size: number;
  free: boolean;
  pid: string;
  startAddress: number;

  constructor(size: number, free: boolean = true, pid: string = "None", startAddress: number = 0) {
    this.size = size;
    this.free = free;
    this.pid = pid;
    this.startAddress = startAddress;
  }
}

export class MemoryManager {
  memory: MemoryBlock[];
  totalSize: number;
  processColors: { [key: string]: string };
  colorIndex: number;
  nextFitIndex: number;
  colors: string[];

  constructor() {
    this.memory = [];
    this.totalSize = 0;
    this.processColors = {};
    this.colorIndex = 0;
    this.nextFitIndex = 0;
    this.colors = [
      '#e74c3c', '#e67e22', '#9b59b6', '#8e44ad', '#16a085',
      '#27ae60', '#f1c40f', '#f39c12', '#d35400', '#c0392b',
      '#1abc9c', '#2980b9', '#e84393', '#6c5ce7', '#fd79a8'
    ];
  }

  initMemory(totalSize: number) {
    this.memory = [new MemoryBlock(totalSize)];
    this.totalSize = totalSize;
    this.nextFitIndex = 0;
    return true;
  }

  mergeFreeBlocks() {
    let mergedAny = false;
    for (let i = 0; i < this.memory.length - 1; i++) {
      if (this.memory[i].free && this.memory[i + 1].free) {
        this.memory[i].size += this.memory[i + 1].size;
        this.memory.splice(i + 1, 1);
        mergedAny = true;
        i--; // Check again from this position
        
        // Adjust next fit index if needed
        if (this.nextFitIndex > i + 1) {
          this.nextFitIndex--;
        }
      }
    }
    return mergedAny;
  }

  allocate(pid: string, size: number, type: string) {
    if (size <= 0) {
      return false;
    }
    
    if (!pid.trim()) {
      return false;
    }
    
    // Check if process ID already exists
    for (let i = 0; i < this.memory.length; i++) {
      if (!this.memory[i].free && this.memory[i].pid === pid) {
        return false;
      }
    }

    let bestIdx = -1, worstIdx = -1, firstIdx = -1, nextIdx = -1;
    let minSize = Infinity, maxSize = -1;

    // First Fit
    for (let i = 0; i < this.memory.length; i++) {
      if (this.memory[i].free && this.memory[i].size >= size) {
        firstIdx = i;
        break;
      }
    }

    // Next Fit (start searching from the last allocation position)
    for (let i = 0; i < this.memory.length; i++) {
      const index = (this.nextFitIndex + i) % this.memory.length;
      if (this.memory[index].free && this.memory[index].size >= size) {
        nextIdx = index;
        break;
      }
    }

    // Best Fit and Worst Fit
    for (let i = 0; i < this.memory.length; i++) {
      if (this.memory[i].free && this.memory[i].size >= size) {
        if (this.memory[i].size < minSize) {
          minSize = this.memory[i].size;
          bestIdx = i;
        }
        if (this.memory[i].size > maxSize) {
          maxSize = this.memory[i].size;
          worstIdx = i;
        }
      }
    }

    let idx = -1;
    if (type === "first") idx = firstIdx;
    else if (type === "next") idx = nextIdx;
    else if (type === "best") idx = bestIdx;
    else if (type === "worst") idx = worstIdx;

    if (idx === -1) {
      return false;
    }

    // Assign a color to the process
    if (!this.processColors[pid]) {
      this.processColors[pid] = this.colors[this.colorIndex % this.colors.length];
      this.colorIndex++;
    }
    
    // Split block if there is extra space
    if (this.memory[idx].size > size) {
      const remainingSize = this.memory[idx].size - size;
      const newStartAddress = this.memory[idx].startAddress + size;
      
      // Create new block for the remaining memory
      this.memory.splice(idx + 1, 0, new MemoryBlock(remainingSize, true, "None", newStartAddress));
      
      // Update current block
      this.memory[idx].size = size;
    }

    // Allocate memory
    this.memory[idx].free = false;
    this.memory[idx].pid = pid;
    
    // Always update next fit pointer after any allocation
    // This ensures nextFitIndex changes after all types of allocation
    this.nextFitIndex = (idx + 1) % this.memory.length;
    
    return true;
  }

  deallocate(pid: string) {
    for (let i = 0; i < this.memory.length; i++) {
      if (!this.memory[i].free && this.memory[i].pid === pid) {
        this.memory[i].free = true;
        this.memory[i].pid = "None";
        this.mergeFreeBlocks();
        return true;
      }
    }
    return false;
  }

  calculateStats() {
    let usedMemory = 0;
    let freeMemory = 0;
    let freeBlocks = 0;
    
    for (let i = 0; i < this.memory.length; i++) {
      if (this.memory[i].free) {
        freeMemory += this.memory[i].size;
        freeBlocks++;
      } else {
        usedMemory += this.memory[i].size;
      }
    }
    
    const usedPercent = this.totalSize > 0 ? parseFloat(((usedMemory / this.totalSize) * 100).toFixed(1)) : 0;
    const freePercent = this.totalSize > 0 ? parseFloat(((freeMemory / this.totalSize) * 100).toFixed(1)) : 0;
    
    // Calculate fragmentation (ratio of number of free blocks to total free memory)
    let fragmentation = 0;
    if (freeMemory > 0 && freeBlocks > 1) {
      fragmentation = parseFloat(((freeBlocks - 1) / freeBlocks * 100).toFixed(1));
    }
    
    return {
      total: this.totalSize,
      used: usedMemory,
      usedPercent,
      free: freeMemory,
      freePercent,
      fragmentation
    };
  }

  // Check for small fragments less than the threshold size
  checkSmallFragments(threshold: number) {
    let fragmentCount = 0;
    let totalSize = 0;
    
    for (let i = 0; i < this.memory.length; i++) {
      if (this.memory[i].free && this.memory[i].size < threshold) {
        fragmentCount++;
        totalSize += this.memory[i].size;
      }
    }
    
    return { fragmentCount, totalSize };
  }

  // Compact memory by moving all allocated blocks to the beginning
  // and merging all free blocks together at the end
  compactMemory(threshold: number = 4) {
    // First check if compaction is needed
    const { fragmentCount } = this.checkSmallFragments(threshold);
    if (fragmentCount === 0) return false;
    
    // Temporary array to hold all allocated blocks
    const allocatedBlocks: MemoryBlock[] = [];
    let totalFreeSize = 0;
    
    // Collect all allocated blocks and calculate total free size
    for (let i = 0; i < this.memory.length; i++) {
      if (!this.memory[i].free) {
        allocatedBlocks.push(this.memory[i]);
      } else {
        totalFreeSize += this.memory[i].size;
      }
    }
    
    // Create new memory layout
    this.memory = [];
    let currentAddress = 0;
    
    // Add all allocated blocks at the beginning
    for (let i = 0; i < allocatedBlocks.length; i++) {
      allocatedBlocks[i].startAddress = currentAddress;
      this.memory.push(allocatedBlocks[i]);
      currentAddress += allocatedBlocks[i].size;
    }
    
    // Add one large free block at the end if there is free space
    if (totalFreeSize > 0) {
      this.memory.push(new MemoryBlock(totalFreeSize, true, "None", currentAddress));
    }
    
    // Reset next fit index to beginning of free space
    this.nextFitIndex = allocatedBlocks.length > 0 ? allocatedBlocks.length : 0;
    
    return true;
  }
}
