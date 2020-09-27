/*
eslint-disable
 */
import React from 'react';

export function PositionHandler({ positionStyle, children }) {
  return <div style={{ ...positionStyle, width: '100%', zIndex: 999 }}>{children}</div>;
}
