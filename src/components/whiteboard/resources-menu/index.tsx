import React from 'react';
import { SceneResource } from '../../../stores/whiteboard';

type ResourceMenuProps = {
  active: number
  items: SceneResource[]
  onClose: (evt: any) => void
  onClick: (rootPath: string) => void
}

export const ResourcesMenu: React.FC<ResourceMenuProps> = (
  {
    onClose,
    items,
    active,
    onClick
  }
) => {
  return (
    <div className="resource-menu-container">
      <div className="menu-header">
        <div className="menu-title">Course Document Center</div>
        <div className="menu-close" onClick={onClose}></div>
      </div>
      <div className="menu-body">
        <div className="menu-items">
          {items.map((it: any, key: number) => (
            <div key={key} className={`item ${active === key ? 'active' : ''} ${key} ${active}`}
                onClick={() => {
                  onClick(it.rootPath);
                }}>
              <div className={`cover-item ${it.file.type.match(/ppt/) ? 'ppt-cover' : 'doc-cover'}`}></div>
              <div className="title">{it.file.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}