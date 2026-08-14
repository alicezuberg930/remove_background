import { m } from 'framer-motion';
import { forwardRef } from 'react';

type IconButtonAnimateProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'small' | 'medium' | 'large';
  icon: React.ReactNode
};

const IconButtonAnimate = forwardRef<HTMLButtonElement, IconButtonAnimateProps>(
  ({ children, size = 'medium', icon, ...other }, ref) => (
    <AnimateWrap size={size}>
      <button
        ref={ref}
        {...other}
        className="inline-flex items-center justify-center rounded-full p-2 hover:bg-gray-100 active:scale-95 transition-colors"
        style={{
          width: size === 'small' ? 32 : size === 'large' ? 48 : 40,
          height: size === 'small' ? 32 : size === 'large' ? 48 : 40
        }}
      >
        {icon}
        {children}
      </button>
    </AnimateWrap>
  )
);

export default IconButtonAnimate;

type AnimateWrapProps = {
  children: React.ReactNode;
  size: 'small' | 'medium' | 'large';
};

const varSmall = {
  hover: { scale: 1.1 },
  tap: { scale: 0.95 },
};

const varMedium = {
  hover: { scale: 1.09 },
  tap: { scale: 0.97 },
};

const varLarge = {
  hover: { scale: 1.08 },
  tap: { scale: 0.99 },
};

function AnimateWrap({ size, children }: AnimateWrapProps) {
  const variants =
    size === 'small' ? varSmall : size === 'large' ? varLarge : varMedium;

  return (
    <m.div
      whileHover="hover"
      whileTap="tap"
      variants={variants}
      // className="inline-flex"
    >
      {children}
    </m.div>
  );
}