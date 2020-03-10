import React from 'react';
import Icon from '../icon';

const ToolItem = (props: any) => {
  const onClick = (evt: any) => {
    props.onClick(evt, props.name);
  }
  return (
    <Icon data={props.name}
      onClick={onClick} className={`items ${props.name} ${props.active ? 'active' : ''}`} />
  )
}

interface ToolsProps {
  items: any[]
  currentTool: string
  handleToolClick: (evt: any, name: string) => void
};

export default function Tools (props: ToolsProps) {
  return (
    <div className="menu">
      {props.items.map((item: any, key: number) => (
        <ToolItem key={key}
          name={item.name}
          onClick={props.handleToolClick}
          active={props.currentTool === item.name}
        >
        </ToolItem>
      ))}
    </div>
  )
}