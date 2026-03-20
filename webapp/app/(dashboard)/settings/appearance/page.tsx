'use client';

import { useEffect, useState } from 'react';
import { Palette, TextT, Sparkle, Eye, Package } from '@phosphor-icons/react';

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState('cyberpunk');
  const [animations, setAnimations] = useState(true);
  const [neonIntensity, setNeonIntensity] = useState(100);
  const [fontSize, setFontSize] = useState('medium');

  const themes = [
    {
      id: 'cyberpunk',
      name: 'Neon',
      description: 'Original DockLite neon cyber theme',
      preview: 'bg-gradient-to-br from-purple-900 via-blue-900 to-cyan-900',
    },
    {
      id: 'corpo',
      name: 'Corpo',
      description: 'Clean greys with soft pink accents',
      preview: 'bg-gradient-to-br from-gray-100 via-gray-200 to-pink-200',
    },
    {
      id: 'corpo-blue',
      name: 'Corpo Blue',
      description: 'Clean greys with cool blue accents',
      preview: 'theme-preview-corpo-blue',
    },
    {
      id: 'unicorn',
      name: 'Unicorn',
      description: 'Spectrum palette with DockLite brand colors',
      preview: 'theme-preview-unicorn',
    },
  ];

  const fontSizes = [
    { id: 'small', name: 'Small', size: '12px' },
    { id: 'medium', name: 'Medium', size: '14px' },
    { id: 'large', name: 'Large', size: '16px' },
    { id: 'xlarge', name: 'Extra Large', size: '18px' }
  ];

  const applyTheme = (themeId: string) => {
    document.documentElement.setAttribute('data-theme', themeId);
  };

  useEffect(() => {
    let savedTheme = localStorage.getItem('docklite-theme') || 'cyberpunk';
    // Migrate old 'new' theme to 'unicorn'
    if (savedTheme === 'new') {
      savedTheme = 'unicorn';
      localStorage.setItem('docklite-theme', 'unicorn');
    }
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('docklite-theme', theme);
    localStorage.setItem('docklite-animations', animations.toString());
    localStorage.setItem('docklite-neon-intensity', neonIntensity.toString());
    localStorage.setItem('docklite-font-size', fontSize);
    applyTheme(theme);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold neon-text flex items-center gap-2" style={{ color: 'var(--neon-cyan)' }}>
          <Palette size={20} weight="duotone" />
          Appearance Settings
        </h2>
        <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
          Customize your visual experience
        </p>
      </div>

      {/* Theme Selection */}
      <div className="card-vapor p-6 rounded-xl">
        <h2 className="text-2xl font-bold neon-text mb-6 flex items-center gap-2" style={{ color: 'var(--neon-pink)' }}>
          <Palette size={20} weight="duotone" />
          Theme Selection
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {themes.map((themeOption) => (
            <div
              key={themeOption.id}
              className="p-4 rounded-lg border-2 cursor-pointer transition-all"
              style={theme === themeOption.id ? {
                borderColor: 'var(--neon-cyan)',
                background: 'rgba(var(--neon-cyan-rgb), 0.1)'
              } : {
                borderColor: 'rgba(var(--neon-purple-rgb), 0.2)'
              }}
              onClick={() => {
                setTheme(themeOption.id);
                applyTheme(themeOption.id);
              }}
            >
              <div className={`w-full h-20 rounded-lg mb-3 ${themeOption.preview}`}></div>
              <h3 className="font-bold mb-1">{themeOption.name}</h3>
              <p className="text-xs opacity-70">{themeOption.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Font Settings */}
      <div className="card-vapor p-6 rounded-xl">
        <h2 className="text-2xl font-bold neon-text mb-6 flex items-center gap-2" style={{ color: 'var(--neon-green)' }}>
          <TextT size={20} weight="duotone" />
          Font Settings
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block font-bold mb-3">Font Size</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {fontSizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setFontSize(size.id)}
                  className="p-3 rounded-lg border-2 transition-all"
                  style={fontSize === size.id ? {
                    borderColor: 'var(--neon-cyan)',
                    background: 'rgba(var(--neon-cyan-rgb), 0.1)'
                  } : {
                    borderColor: 'rgba(var(--neon-purple-rgb), 0.2)'
                  }}
                >
                  <div className="font-bold" style={{ fontSize: size.size }}>Aa</div>
                  <div className="text-xs mt-1">{size.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Effects */}
      <div className="card-vapor p-6 rounded-xl">
        <h2 className="text-2xl font-bold neon-text mb-6 flex items-center gap-2" style={{ color: 'var(--neon-yellow)' }}>
          <Sparkle size={20} weight="duotone" />
          Visual Effects
        </h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">Animations & Transitions</div>
              <div className="text-sm opacity-70">Enable smooth animations and hover effects</div>
            </div>
            <button
              onClick={() => setAnimations(!animations)}
              className="px-4 py-2 rounded-lg font-bold transition-all"
              style={animations ? {
                background: 'var(--status-success)',
                color: 'var(--button-text)'
              } : {
                background: 'var(--surface-dim)',
                color: 'var(--text-primary)'
              }}
            >
              {animations ? 'ON' : 'OFF'}
            </button>
          </div>

          <div>
            <label className="block font-bold mb-3">Neon Glow Intensity</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="200"
                value={neonIntensity}
                onChange={(e) => setNeonIntensity(Number(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                style={{ background: 'var(--neon-purple)' }}
              />
              <span className="text-sm font-mono w-12">{neonIntensity}%</span>
            </div>
            <div className="text-xs opacity-70 mt-2">
              Adjust the intensity of neon glow effects
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="card-vapor p-6 rounded-xl">
        <h2 className="text-2xl font-bold neon-text mb-6 flex items-center gap-2" style={{ color: 'var(--neon-purple)' }}>
          <Eye size={20} weight="duotone" />
          Preview
        </h2>
        <div className="p-6 rounded-lg border-2" style={{
          borderColor: 'rgba(var(--neon-purple-rgb), 0.3)',
          filter: `brightness(${neonIntensity / 100})`
        }}>
          <div className="text-center mb-4">
            <div className="flex justify-center mb-2 animate-float">
              <Package size={32} weight="duotone" color="var(--neon-cyan)" />
            </div>
            <h3 className="text-xl font-bold neon-text mb-2" style={{ color: 'var(--neon-cyan)' }}>
              Sample Container
            </h3>
            <div className="text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>
              Preview of your theme settings
            </div>
          </div>
          <div className="flex gap-2 justify-center">
            <button className="px-3 py-1 rounded text-sm font-bold" style={{ background: 'var(--neon-green)', color: 'var(--button-text)' }}>
              START
            </button>
            <button className="px-3 py-1 rounded text-sm font-bold" style={{ background: 'var(--neon-purple)', color: 'var(--button-text)' }}>
              VIEW
            </button>
            <button className="px-3 py-1 rounded text-sm font-bold" style={{ background: 'var(--status-error)', color: 'var(--button-text)' }}>
              STOP
            </button>
          </div>
        </div>
      </div>

      {/* Save Settings */}
      <div className="text-center">
        <button
          onClick={handleSaveSettings}
          className="btn-neon px-8 py-3 font-bold text-lg"
        >
          Apply Theme
        </button>
        <div className="text-xs opacity-60 mt-2" style={{ color: 'var(--text-secondary)' }}>
          Theme updates immediately.
        </div>
      </div>
    </div>
  );
}
