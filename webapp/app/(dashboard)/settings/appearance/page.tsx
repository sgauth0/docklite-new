'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState('cyberpunk');
  const [animations, setAnimations] = useState(true);
  const [neonIntensity, setNeonIntensity] = useState(100);
  const [fontSize, setFontSize] = useState('medium');

  const themes = [
    { id: 'cyberpunk', name: 'Cyberpunk', description: 'Default neon cyberpunk theme', preview: 'bg-gradient-to-br from-purple-900 to-cyan-900' },
    { id: 'dark', name: 'Dark Mode', description: 'Clean dark theme with minimal neon', preview: 'bg-gradient-to-br from-gray-900 to-black' },
    { id: 'retro', name: 'Retro', description: '80s retro computing aesthetic', preview: 'bg-gradient-to-br from-green-900 to-black' },
    { id: 'matrix', name: 'Matrix', description: 'Green matrix code theme', preview: 'bg-gradient-to-br from-green-900 to-black' }
  ];

  const fontSizes = [
    { id: 'small', name: 'Small', size: '12px' },
    { id: 'medium', name: 'Medium', size: '14px' },
    { id: 'large', name: 'Large', size: '16px' },
    { id: 'xlarge', name: 'Extra Large', size: '18px' }
  ];

  const handleSaveSettings = () => {
    // Save settings to localStorage or API
    localStorage.setItem('docklite-theme', theme);
    localStorage.setItem('docklite-animations', animations.toString());
    localStorage.setItem('docklite-neon-intensity', neonIntensity.toString());
    localStorage.setItem('docklite-font-size', fontSize);
    
    // Show success message
    alert('Appearance settings saved! Refresh the page to apply changes.');
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold neon-text mb-2" style={{ color: 'var(--neon-cyan)' }}>
            🎨 Appearance Settings
          </h1>
          <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
            ▶ CUSTOMIZE YOUR VISUAL EXPERIENCE ◀
          </p>
        </div>
        <Link
          href="/settings"
          className="cyber-button inline-flex items-center gap-2"
        >
          ← Back to Settings
        </Link>
      </div>

      {/* Theme Selection */}
      <div className="card-vapor p-6 rounded-xl">
        <h2 className="text-2xl font-bold neon-text mb-6" style={{ color: 'var(--neon-pink)' }}>
          🎭 Theme Selection
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {themes.map((themeOption) => (
            <div
              key={themeOption.id}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                theme === themeOption.id 
                  ? 'border-cyan-500 bg-cyan-500/10' 
                  : 'border-purple-500/20 hover:border-purple-500/40'
              }`}
              onClick={() => setTheme(themeOption.id)}
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
        <h2 className="text-2xl font-bold neon-text mb-6" style={{ color: 'var(--neon-green)' }}>
          🔤 Font Settings
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block font-bold mb-3">Font Size</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {fontSizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setFontSize(size.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    fontSize === size.id
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-purple-500/20 hover:border-purple-500/40'
                  }`}
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
        <h2 className="text-2xl font-bold neon-text mb-6" style={{ color: 'var(--neon-yellow)' }}>
          ✨ Visual Effects
        </h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">Animations & Transitions</div>
              <div className="text-sm opacity-70">Enable smooth animations and hover effects</div>
            </div>
            <button 
              onClick={() => setAnimations(!animations)}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                animations 
                  ? 'bg-green-500 text-black' 
                  : 'bg-gray-600 text-white'
              }`}
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
                className="flex-1 h-2 bg-purple-900 rounded-lg appearance-none cursor-pointer"
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
        <h2 className="text-2xl font-bold neon-text mb-6" style={{ color: 'var(--neon-purple)' }}>
          👁️ Preview
        </h2>
        <div className="p-6 rounded-lg border-2 border-purple-500/30" style={{ filter: `brightness(${neonIntensity / 100})` }}>
          <div className="text-center mb-4">
            <div className="text-4xl mb-2 animate-float">📦</div>
            <h3 className="text-xl font-bold neon-text mb-2" style={{ color: 'var(--neon-cyan)' }}>
              Sample Container
            </h3>
            <div className="text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>
              Preview of your theme settings
            </div>
          </div>
          <div className="flex gap-2 justify-center">
            <button className="px-3 py-1 rounded text-sm font-bold" style={{ background: 'var(--neon-green)', color: 'var(--bg-darker)' }}>
              START
            </button>
            <button className="px-3 py-1 rounded text-sm font-bold" style={{ background: 'var(--neon-purple)', color: 'white' }}>
              VIEW
            </button>
            <button className="px-3 py-1 rounded text-sm font-bold" style={{ background: '#ff6b6b', color: 'white' }}>
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
          💾 Save Appearance Settings
        </button>
        <div className="text-xs opacity-60 mt-2" style={{ color: 'var(--text-secondary)' }}>
          Changes will apply after page refresh
        </div>
      </div>
    </div>
  );
}
