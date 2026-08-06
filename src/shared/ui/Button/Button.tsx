import type { ComponentChildren, JSX } from 'preact'

import { cx } from '../../lib/class-name'
import styles from './Button.module.css'

type ButtonAttributes = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'class' | 'className' | 'children'
>

export interface ButtonProps extends ButtonAttributes {
  variant?: 'primary' | 'default' | 'ghost' | 'danger'
  /** アイコンのみのボタン。正方形にして余白を詰める。 */
  square?: boolean
  // CSS Modules のクラス名は string | undefined になるため undefined を明示的に許す
  class?: string | undefined
  children?: ComponentChildren
}

export function Button({
  variant = 'default',
  square = false,
  class: className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      class={cx(styles.button, styles[variant], square && styles.square, className)}
    >
      {children}
    </button>
  )
}
