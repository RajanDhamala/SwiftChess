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
  <div className="sw:w-full sw:max-w-[576px] sw:bg-white/5 sw:rounded-xl sw:p-3">
    <h3 className="sw:text-xs sw:text-gray-400 sw:uppercase sw:tracking-wider sw:mb-2">Load Position (FEN)</h3>
    <div className="sw:flex sw:gap-2">
      <input
        type="text"
        value={fenInput}
        onChange={(e) => onFenInputChange(e.target.value)}
        placeholder="Paste FEN string..."
        className="sw:flex-1 sw:bg-black/30 sw:text-[#80cbc4] sw:text-xs sw:rounded sw:px-2 sw:py-1.5 sw:border sw:border-gray-700 sw:focus:border-blue-500 sw:focus:outline-none sw:placeholder-gray-600"
      />
      <button
        onClick={onLoad}
        className="sw:px-3 sw:py-1.5 sw:rounded sw:bg-violet-600 sw:hover:bg-violet-700 sw:text-white sw:text-xs sw:font-semibold sw:transition-colors"
      >
        Load
      </button>
    </div>
    {fenError && <p className="sw:text-red-400 sw:text-[10px] sw:mt-1">{fenError}</p>}
  </div>
)
