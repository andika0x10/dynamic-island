import type { ButtonHTMLAttributes } from 'react'
import styles from './Controls.module.css'
export function Button({ className = '', primary, icon, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; icon?: boolean }) {
  return <button type="button" className={`${styles.button} ${primary ? styles.primary : ''} ${icon ? styles.icon : ''} ${className}`} {...props} />
}
export function ErrorMessage({ message }: { message: string }) { return message ? <p className={styles.error} role="alert">{message}</p> : null }
