import React from 'react';
import { useAuthStore } from '../store';

interface Props {
  branchCount: number;
  maxBranches: number;
  staffCounts: Record<string, number>; // branch_id -> active staff count
  maxStaff: number;
}

export default function BranchUsageMeter({ branchCount, maxBranches, staffCounts, maxStaff }: Props) {
  const totalStaff = Object.values(staffCounts).reduce((a, b) => a + b, 0);
  const totalStaffSlots = Object.keys(staffCounts).length * maxStaff;

  const branchPct = maxBranches > 0 ? Math.min((branchCount / maxBranches) * 100, 100) : 0;
  const staffPct = totalStaffSlots > 0 ? Math.min((totalStaff / totalStaffSlots) * 100, 100) : 0;

  const barColor = (pct: number) => {
    if (pct >= 90) return 'from-red-500 to-rose-500';
    if (pct >= 70) return 'from-amber-500 to-orange-500';
    return 'from-blue-500 to-cyan-500';
  };

  return (
    <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 mb-6">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Subscription Usage</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Branches */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300 font-medium">Branch Slots</span>
            <span className={`text-sm font-bold ${branchPct >= 90 ? 'text-red-400' : 'text-white'}`}>
              {branchCount} / {maxBranches === 9999 ? '∞' : maxBranches}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${barColor(branchPct)}`}
              style={{ width: `${branchPct}%` }}
            />
          </div>
          {branchPct >= 90 && (
            <p className="text-xs text-red-400 mt-1">Branch limit almost reached</p>
          )}
        </div>

        {/* Staff */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300 font-medium">Staff Slots (all branches)</span>
            <span className={`text-sm font-bold ${staffPct >= 90 ? 'text-red-400' : 'text-white'}`}>
              {totalStaff} / {totalStaffSlots === 0 ? '—' : totalStaffSlots}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${barColor(staffPct)}`}
              style={{ width: `${staffPct}%` }}
            />
          </div>
          {staffPct >= 90 && (
            <p className="text-xs text-red-400 mt-1">Staff slots running low</p>
          )}
        </div>
      </div>
    </div>
  );
}
