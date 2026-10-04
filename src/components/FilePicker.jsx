import React, { useRef } from 'react';

export default function FilePicker({ onFileSelect, selectedFile }) {
  const inputRef = useRef(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="file-picker" id="file-picker">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleChange}
        style={{ display: 'none' }}
        id="video-file-input"
      />

      {!selectedFile ? (
        <div
          className="file-picker-zone"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        >
          <div className="file-picker-icon">🎬</div>
          <h3>Choose your movie</h3>
          <p>Tap to browse videos on your device</p>
        </div>
      ) : (
        <>
          <div className="file-info">
            <div className="file-icon">🎥</div>
            <div className="file-details">
              <div className="file-name">{selectedFile.name}</div>
              <div className="file-size">{selectedFile.sizeFormatted}</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleClick}
            id="change-file-btn"
          >
            Change file
          </button>
        </>
      )}
    </div>
  );
}
