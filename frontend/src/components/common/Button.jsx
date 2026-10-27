import styles from './Button.module.css';

export default function Button({ variant = 'primary', type = 'button', className = '', ...props }) {
  return (
    <button type={type} className={`${styles.button} ${styles[variant]} ${className}`} {...props} />
  );
}
