import React from 'react';

interface SlideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SlideMenu({ isOpen, onClose }: SlideMenuProps) {
  const menuItems = ['Dashboard', 'Markets', 'History', 'Settings'];

  return (
    <>
      <div className={`overlay ${isOpen ? 'visible' : ''}`} onClick={onClose} />
      <div className={`slide-menu ${isOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <div className="menu-title">Menu</div>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="menu-items">
          {menuItems.map((item) => (
            <div key={item} className="menu-item" onClick={() => console.log('Menu item clicked:', item)}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
