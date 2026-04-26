import React from 'react'

interface FenLoaderProps {
  fenInput: string
  fenError: string
  onFenInputChange: (value: string) => void
  onLoad: () => void
}

export const FenLoader: React.FC<FenLoaderProps> = ({
  fenInput,
  fenError,
  onFenInputChange,
  onLoad,
}) => (
  <div className="w-full max-w-[576px] bg-white/5 rounded-xl p-3">
    <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Load Position (FEN)</h3>
    <div className="flex gap-2">
      <input
        type="text"
        value={fenInput}
        onChange={(e) => onFenInputChange(e.target.value)}
        placeholder="Paste FEN string..."
        className="flex-1 bg-black/30 text-[#80cbc4] text-xs rounded px-2 py-1.5 border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-600"
      />
      <button
        onClick={onLoad}
        className="px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
      >
        Load
      </button>
    </div>
    {fenError && <p className="text-red-400 text-[10px] mt-1">{fenError}</p>}
  </div>
)
