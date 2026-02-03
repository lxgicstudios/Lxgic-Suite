import { PromptSegment } from './core.js';

export interface Breakpoint {
  id: string;
  type: 'index' | 'segmentType' | 'condition';
  value: number | string;
  enabled: boolean;
  hitCount: number;
  condition?: string;
}

export class BreakpointManager {
  private breakpoints: Map<string, Breakpoint> = new Map();
  private nextId: number = 1;

  /**
   * Add a breakpoint at a specific segment index
   */
  addIndexBreakpoint(index: number): Breakpoint {
    const id = `bp_${this.nextId++}`;
    const breakpoint: Breakpoint = {
      id,
      type: 'index',
      value: index,
      enabled: true,
      hitCount: 0
    };
    this.breakpoints.set(id, breakpoint);
    return breakpoint;
  }

  /**
   * Add a breakpoint for a segment type
   */
  addTypeBreakpoint(segmentType: PromptSegment['type']): Breakpoint {
    const id = `bp_${this.nextId++}`;
    const breakpoint: Breakpoint = {
      id,
      type: 'segmentType',
      value: segmentType,
      enabled: true,
      hitCount: 0
    };
    this.breakpoints.set(id, breakpoint);
    return breakpoint;
  }

  /**
   * Add a conditional breakpoint
   */
  addConditionalBreakpoint(condition: string): Breakpoint {
    const id = `bp_${this.nextId++}`;
    const breakpoint: Breakpoint = {
      id,
      type: 'condition',
      value: condition,
      enabled: true,
      hitCount: 0,
      condition
    };
    this.breakpoints.set(id, breakpoint);
    return breakpoint;
  }

  /**
   * Remove a breakpoint by ID
   */
  removeBreakpoint(id: string): boolean {
    return this.breakpoints.delete(id);
  }

  /**
   * Enable/disable a breakpoint
   */
  toggleBreakpoint(id: string): boolean {
    const bp = this.breakpoints.get(id);
    if (bp) {
      bp.enabled = !bp.enabled;
      return true;
    }
    return false;
  }

  /**
   * Check if execution should break at given position
   */
  shouldBreak(index: number, segmentType: PromptSegment['type']): boolean {
    for (const bp of this.breakpoints.values()) {
      if (!bp.enabled) continue;

      let shouldHit = false;

      switch (bp.type) {
        case 'index':
          shouldHit = bp.value === index;
          break;
        case 'segmentType':
          shouldHit = bp.value === segmentType;
          break;
        case 'condition':
          // Evaluate condition (simple implementation)
          shouldHit = this.evaluateCondition(bp.condition!, { index, segmentType });
          break;
      }

      if (shouldHit) {
        bp.hitCount++;
        return true;
      }
    }
    return false;
  }

  /**
   * Evaluate a breakpoint condition
   */
  private evaluateCondition(
    condition: string,
    context: { index: number; segmentType: string }
  ): boolean {
    try {
      // Simple condition evaluation
      // Supports: index == N, type == "name", index > N, index < N
      const trimmed = condition.trim().toLowerCase();

      // Index conditions
      const indexMatch = trimmed.match(/index\s*(==|>|<|>=|<=)\s*(\d+)/);
      if (indexMatch) {
        const [, op, numStr] = indexMatch;
        const num = parseInt(numStr, 10);
        switch (op) {
          case '==': return context.index === num;
          case '>': return context.index > num;
          case '<': return context.index < num;
          case '>=': return context.index >= num;
          case '<=': return context.index <= num;
        }
      }

      // Type conditions
      const typeMatch = trimmed.match(/type\s*==\s*["']?(\w+)["']?/);
      if (typeMatch) {
        return context.segmentType === typeMatch[1];
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get all breakpoints
   */
  getAllBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Get breakpoint count
   */
  getBreakpointCount(): number {
    return this.breakpoints.size;
  }

  /**
   * Get enabled breakpoint count
   */
  getEnabledBreakpointCount(): number {
    return Array.from(this.breakpoints.values()).filter(bp => bp.enabled).length;
  }

  /**
   * Clear all breakpoints
   */
  clearAll(): void {
    this.breakpoints.clear();
  }

  /**
   * Export breakpoints as JSON
   */
  toJSON(): object {
    return {
      breakpoints: Array.from(this.breakpoints.values())
    };
  }

  /**
   * Import breakpoints from JSON
   */
  fromJSON(data: { breakpoints: Breakpoint[] }): void {
    this.breakpoints.clear();
    for (const bp of data.breakpoints) {
      this.breakpoints.set(bp.id, bp);
    }
    // Update nextId to avoid collisions
    const maxId = Math.max(
      0,
      ...Array.from(this.breakpoints.keys())
        .map(id => parseInt(id.replace('bp_', ''), 10))
        .filter(n => !isNaN(n))
    );
    this.nextId = maxId + 1;
  }
}
