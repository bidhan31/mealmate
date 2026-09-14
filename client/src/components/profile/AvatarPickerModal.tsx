import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { X, Check, Image as ImageIcon, Sparkles } from 'lucide-react';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar: string | null;
  onSelectAvatar: (avatarUrl: string) => void;
}

// Curated avatar presets (using SVG dicebear styles & high quality avatars)
const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Alexander',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/personas/svg?seed=Trouble',
  'https://api.dicebear.com/7.x/personas/svg?seed=Cookie',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Lily',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Jasper',
  'https://api.dicebear.com/7.x/micah/svg?seed=Bandit',
  'https://api.dicebear.com/7.x/micah/svg?seed=Casper',
];

export function AvatarPickerModal({
  isOpen,
  onClose,
  currentAvatar,
  onSelectAvatar,
}: AvatarPickerModalProps) {
  const [selected, setSelected] = useState<string>(currentAvatar || PRESET_AVATARS[0]);
  const [customUrl, setCustomUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');

  if (!isOpen) return null;

  const handleSave = () => {
    const finalUrl = activeTab === 'custom' && customUrl.trim() ? customUrl.trim() : selected;
    onSelectAvatar(finalUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Choose Profile Avatar</h3>
              <p className="text-xs text-muted-foreground">Select an avatar preset or provide a custom image URL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border/50 px-6 pt-3 bg-muted/10 gap-4">
          <button
            onClick={() => setActiveTab('presets')}
            className={`pb-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'presets'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Avatar Gallery
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`pb-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'custom'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Custom Image Link
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'presets' ? (
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-4">
              {PRESET_AVATARS.map((url, idx) => {
                const isSelected = selected === url;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelected(url)}
                    className={`relative group p-2 rounded-2xl border-2 transition-all flex items-center justify-center bg-muted/30 hover:bg-muted ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
                        : 'border-border/40 hover:border-border'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Avatar Preset ${idx + 1}`}
                      className="w-16 h-16 rounded-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Direct Image Web Link (URL)</label>
                <Input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/my-photo.jpg"
                  type="url"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Paste a direct link to any JPG, PNG, WebP, or SVG avatar image.
                </p>
              </div>

              {/* Preview */}
              <div className="mt-4 p-4 border border-border/50 rounded-xl bg-muted/20 flex flex-col items-center justify-center space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Preview</p>
                <img
                  src={customUrl.trim() || currentAvatar || PRESET_AVATARS[0]}
                  alt="Avatar Preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-primary/30 shadow-lg bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix';
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/50 bg-muted/20">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply Avatar
          </Button>
        </div>
      </div>
    </div>
  );
}
