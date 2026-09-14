import { Palette, Moon, Sun, Type } from 'lucide-react';
import { useTheme, ThemeMode, ColorTheme, FontTheme } from './ThemeProvider';

export function ThemeSwitcher() {
  const { mode, setMode, colorTheme, setColorTheme, font, setFont } = useTheme();

  const colors: { value: ColorTheme; label: string; bg: string }[] = [
    { value: 'emerald', label: 'Emerald', bg: 'bg-emerald-500' },
    { value: 'indigo', label: 'Indigo', bg: 'bg-indigo-500' },
    { value: 'violet', label: 'Violet', bg: 'bg-violet-500' },
    { value: 'monochrome', label: 'Monochrome', bg: 'bg-gray-800 dark:bg-gray-200' },
  ];

  const fonts: { value: FontTheme; label: string; previewClass: string }[] = [
    { value: 'inter', label: 'Inter', previewClass: 'font-sans' },
    { value: 'outfit', label: 'Outfit', previewClass: 'font-sans' },
    { value: 'roboto', label: 'Roboto', previewClass: 'font-sans' },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 bg-card rounded-xl border border-border shadow-sm w-full max-w-sm">
      {/* Mode Switcher */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wider">
          {mode === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
          Appearance
        </p>
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 text-sm font-medium capitalize rounded-md transition-all ${
                mode === m
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Color Theme Switcher */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
          <Palette size={14} />
          Theme Color
        </p>
        <div className="grid grid-cols-4 gap-3">
          {colors.map((c) => (
            <button
              key={c.value}
              onClick={() => setColorTheme(c.value)}
              className={`group flex flex-col items-center gap-1.5`}
            >
              <div
                className={`w-8 h-8 rounded-full ${c.bg} shadow-sm transition-transform group-hover:scale-110 flex items-center justify-center ${
                  colorTheme === c.value ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                }`}
              >
                {colorTheme === c.value && (
                  <div className="w-2 h-2 rounded-full bg-background" />
                )}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground">
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Font Switcher */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
          <Type size={14} />
          Typography
        </p>
        <div className="flex flex-col gap-2">
          {fonts.map((f) => (
            <button
              key={f.value}
              onClick={() => setFont(f.value)}
              className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg border transition-colors ${
                font === f.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-transparent hover:bg-muted text-muted-foreground'
              }`}
            >
              <span className={`${f.previewClass} font-medium`}>{f.label}</span>
              <span className="text-xs opacity-60">Aa</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
