export type PX = string
export type Percent = number
export type Color = string
export type URL = string

import { Properties } from 'csstype'

export type CSSProperties = Properties<string | number>

export interface ICommonStyle {
  size?: ISizeStyle
  transform?: ITransformStyle
  text?: ITextStyle
  margin?: IDistanceStyleWithAuto
  padding?: IDistanceStyle
  border?: IBorderStyle
  background?: IBackgroundStyle
  position?: IPositionStyle
  zIndex?: number
  custom?: ICustomStyle[]
  self?: object
  display?: string
  flexConfig?: {
    flexDirection?: string
    justifyContent?: string
    alignItems?: string
    flexWrap?: string
  }
}

export interface IPositionStyle {
  position?: 'fixed' | 'absolute' | 'relative' | 'static'
  top?: PX
  right?: PX | 'auto'
  bottom?: PX
  left?: PX | 'auto'
}

export interface ISizeStyle {
  autoWidth: boolean
  width: PX
  autoHeight: boolean
  height: PX
}

export interface ITransformStyle {
  rotate: number
  opacity: number
  scale: number
  radius: PX
}

export interface ITextStyle {
  color: Color
  fontSize: PX
  lineHeight: PX
  textAlign: 'left' | 'center' | 'right' | 'justify'
  weight: 'lighter' | 'bolder' | 'normal'
  opacity: number
}

export interface IBorderStyle {
  type: 'none' | 'solid' | 'dashed'
  color: Color
  width: PX
  radius?: PX
  radiusInfo?: {
    topLeft: string
    topRight: string
    bottomRight: string
    bottomLeft: string
  }
}

export interface IBackgroundStyle {
  bgType: 'color' | 'image'
  color: Color
  image: URL
  size: string
  repeat: string
  position?: string
  positionObj?: {
    left: string
    top: string
  }
}

export interface IDistanceStyle {
  top?: PX
  right?: PX
  bottom?: PX
  left?: PX
}

export interface IDistanceStyleWithAuto {
  top?: PX
  right?: PX | 'auto'
  bottom?: PX
  left?: PX | 'auto'
}

export interface ICustomStyle {
  key: string
  value: string
}
