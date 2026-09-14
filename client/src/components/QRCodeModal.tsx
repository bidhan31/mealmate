import React from 'react';
import { QrCode, X, Copy, Check, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteCode: string;
  homeName: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  inviteCode,
  homeName,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast.success('Invite code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate deterministic 21x21 QR pattern based on the invite code
  const getQRGrid = (seedStr: string) => {
    const size = 21;
    const grid: boolean[][] = Array(size).fill(false).map(() => Array(size).fill(false));

    // Simple hash for seed
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }

    // Standard QR Position Finder Patterns (Top-Left, Top-Right, Bottom-Left)
    const addFinderPattern = (r: number, c: number) => {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
            if (r + i < size && c + j < size) grid[r + i][c + j] = true;
          }
        }
      }
    };

    addFinderPattern(0, 0);
    addFinderPattern(0, size - 7);
    addFinderPattern(size - 7, 0);

    // Fill inner data area using seed hash
    let lcg = Math.abs(hash);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Skip finder patterns
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= size - 8;
        const inBottomLeft = r >= size - 8 && c < 8;
        if (!inTopLeft && !inTopRight && !inBottomLeft) {
          lcg = (lcg * 1664525 + 1013904223) % 4294967296;
          grid[r][c] = lcg % 2 === 0;
        }
      }
    }

    return grid;
  };

  const grid = getQRGrid(inviteCode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center space-y-1.5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-1">
            <QrCode className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold tracking-tight">Home Invite QR</h3>
          <p className="text-sm text-muted-foreground">
            Scan or share this code to join <span className="font-semibold text-foreground">{homeName}</span>
          </p>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-5 bg-white dark:bg-zinc-900 rounded-xl border border-border/80 shadow-inner">
          <div className="grid grid-cols-21 gap-0.5 w-52 h-52 p-2 bg-white dark:bg-zinc-900 rounded-lg">
            {grid.map((row, rIdx) =>
              row.map((cell, cIdx) => (
                <div
                  key={`${rIdx}-${cIdx}`}
                  className={`w-full h-full rounded-[1px] ${
                    cell ? 'bg-zinc-950 dark:bg-zinc-100' : 'bg-white dark:bg-zinc-900'
                  }`}
                />
              ))
            )}
          </div>
        </div>

        {/* Invite Code display & Copy */}
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
            <div>
              <p className="text-xs text-muted-foreground font-medium">INVITE CODE</p>
              <p className="font-mono text-lg font-bold tracking-widest text-primary">{inviteCode}</p>
            </div>
            <Button size="sm" variant={copied ? 'secondary' : 'default'} onClick={handleCopy} className="gap-1.5">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5" />
            <span>Members can enter this code in Onboarding page</span>
          </div>
        </div>
      </div>
    </div>
  );
};
