import { m, type MotionProps } from 'framer-motion';
import { varSlide } from './variants';
import { Typography, type TypographyProps } from '@/components/ui/typography';

type Props = MotionProps & TypographyProps;

interface TextAnimateProps extends Props {
  text: string;
}

export default function TextAnimate({ text, variants, ...other }: Readonly<TextAnimateProps>) {
  const AnimatedTyphgraphy = m(Typography)

  return (
    <AnimatedTyphgraphy
      variants={variants || varSlide().inLeft}
      {...other}
    >
      {text.split('').map((letter, index) => (
        <m.span key={index} variants={variants || varSlide().inLeft}>
          {letter}
        </m.span>
      ))}
    </AnimatedTyphgraphy>
  );
}
